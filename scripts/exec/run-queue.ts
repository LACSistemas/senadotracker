import { spawn } from 'node:child_process';
import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { storageConfig } from '../../apps/collector/src/exec/storage.ts';

/**
 * Fila de comandos com número limitado de workers (CIVICA_EXEC_MAX_WORKERS). Cada linha é um comando de scripts/exec (ex.: "cnes-pilot.ts RO 201301 202609 st,lt,eq").
 * Retomável por construção: os próprios pilotos pulam o que já está publicado. Falha de um item não derruba os outros; VolumeError/BudgetError
 * interrompem a fila inteira (nada é gravado fora do SSD).
 * Uso: node --import tsx scripts/exec/run-queue.ts <nome> <arquivo-com-comandos> [--workers N]
 */
const [name, file] = process.argv.slice(2);
const cfg = storageConfig();
const workers = process.argv.includes('--workers') ? Number(process.argv[process.argv.indexOf('--workers') + 1]) : cfg.maxWorkers;
await mkdir(cfg.logsDir, { recursive: true });
const { readFile } = await import('node:fs/promises');
const jobs = (await readFile(file!, 'utf8')).split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'));
const qlog = join(cfg.logsDir, `queue-${name}.jsonl`);
let halted = false; let next = 0; const failed: string[] = [];
async function runOne(cmd: string, attempt = 1): Promise<void> {
  const t0 = Date.now();
  const code = await new Promise<{ code: number; tail: string }>(res => {
    const p = spawn(process.execPath, ['--import', 'tsx', ...cmd.split(/\s+/).map((a, i) => i === 0 ? `scripts/exec/${a}` : a)], { stdio: ['ignore', 'pipe', 'pipe'] });
    let tail = ''; const keep = (d: Buffer) => { tail = (tail + d.toString()).slice(-4000); };
    p.stdout.on('data', keep); p.stderr.on('data', keep); p.on('close', c => res({ code: c ?? -1, tail }));
  });
  if (code.code !== 0 && !/VolumeError|BudgetError/.test(code.tail) && attempt < 3) {   // falhas transitórias (ex.: timeout de bloqueio com outra fila) são retomáveis: tenta de novo
    await appendFile(qlog, JSON.stringify({ at: new Date().toISOString(), cmd, retry: attempt, tail: code.tail.split('\n').filter(l => /rror/.test(l)).slice(-2).join(' | ').slice(0, 300) }) + '\n');
    await new Promise(r => setTimeout(r, 60_000)); return runOne(cmd, attempt + 1);
  }
  const rec = { cmd, code: code.code, s: Math.round((Date.now() - t0) / 1000), tail: code.tail.split('\n').filter(l => l && !/ExperimentalWarning|trace-warnings/.test(l)).slice(-12).join(' | ').slice(-900) };
  await appendFile(qlog, JSON.stringify({ at: new Date().toISOString(), ...rec }) + '\n');
  if (code.code !== 0) { failed.push(cmd); if (/VolumeError|BudgetError/.test(code.tail)) { halted = true; console.error('HALT:', rec.tail); } }
}
await Promise.all(Array.from({ length: workers }, async () => { while (!halted && next < jobs.length) await runOne(jobs[next++]!); }));
console.log(JSON.stringify({ name, jobs: jobs.length, ran: Math.min(next, jobs.length), failed, halted }));
process.exit(failed.length || halted ? 1 : 0);
