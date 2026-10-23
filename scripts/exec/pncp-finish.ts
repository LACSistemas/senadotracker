import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { appendFile, mkdir, rm, writeFile, open } from 'node:fs/promises';
import { join } from 'node:path';
import { storageConfig } from '../../apps/collector/src/exec/storage.ts';
import { pncpBundleRel } from '../../apps/collector/src/exec/pncp.ts';
import { publishPncpYear } from '../../apps/collector/src/exec/contratos.ts';
import { openPool } from './db.ts';

/**
 * Conclusão persistente da coleta + publicação do PNCP da P9.5 (2025–2026). Idempotente e recuperável; acionado por tarefa agendada do Windows (Civica-P95-PNCP-Finish),
 * NÃO depende de sessão aberta. Cada execução:
 *   1. pega o lock (D:\Civica\state\pncp-finish.lock; lock de processo morto ou com mais de 6 h é retomado);
 *   2. se OUTRO coletor pncp-fetch.ts está vivo, só registra e sai (nunca inicia coleta concorrente);
 *   3. se faltam meses FECHADOS (jan/2025 até o mês anterior ao atual), inicia UM coletor destacado (retomável por .part) e sai;
 *   4. com todos os meses fechados presentes: publica 2025 e o ano corrente (parcial/preliminar), confere RAW × banco, repete a publicação (NO_CHANGE) e grava DONE;
 *   5. limite de tentativas; ao concluir, desabilita a própria tarefa agendada.
 * Estado: D:\Civica\state\pncp-finish.status.json (último) e pncp-finish.jsonl (histórico). Retomada manual: node --import tsx scripts/exec/pncp-finish.ts
 */
const cfg = storageConfig(); const stateDir = join(cfg.rootDir ?? 'D:\\Civica', 'state'); await mkdir(stateDir, { recursive: true });
const LOCK = join(stateDir, 'pncp-finish.lock'), STATUS = join(stateDir, 'pncp-finish.status.json'), HIST = join(stateDir, 'pncp-finish.jsonl'), TASK = 'Civica-P95-PNCP-Finish', MAX_ATTEMPTS = 200;
const now = new Date(); const log = async (o: Record<string, unknown>) => { const rec = { at: new Date().toISOString(), ...o }; console.log(JSON.stringify(rec)); await appendFile(HIST, JSON.stringify(rec) + '\n'); await writeFile(STATUS, JSON.stringify(rec, null, 1)); };
const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const prior = (() => { try { return JSON.parse(readFileSync(STATUS, 'utf8')) as { attempts?: number; state?: string }; } catch { return {} as { attempts?: number; state?: string }; } })();
if (prior.state === 'DONE') { console.log('já concluído'); process.exit(0); }
const attempts = (prior.attempts ?? 0) + 1;
// ---- lock
if (existsSync(LOCK)) { try { const l = JSON.parse(readFileSync(LOCK, 'utf8')) as { pid: number; at: string }; if (alive(l.pid) && Date.now() - Date.parse(l.at) < 6 * 3600e3) { console.log('outra instância do supervisor em execução'); process.exit(0); } } catch { /* lock ilegível: retoma */ } }
await writeFile(LOCK, JSON.stringify({ pid: process.pid, at: now.toISOString() }));
const pool = openPool(3);
async function main(): Promise<number> {
  if (attempts > MAX_ATTEMPTS) { await log({ state: 'GAVE_UP', attempts, reason: `mais de ${MAX_ATTEMPTS} tentativas` }); return 1; }
  // ---- coletor concorrente?
  const ps = execFileSync('powershell', ['-NoProfile', '-Command', "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'pncp-fetch\\.ts' } | Select-Object -ExpandProperty ProcessId"], { encoding: 'utf8' }).split(/\s+/).filter(Boolean).map(Number).filter(p => p !== process.pid);
  const needMonths: Array<[number, number]> = []; for (let y = 2025; y <= now.getUTCFullYear(); y++) for (let m = 1; m <= 12; m++) { if (y === now.getUTCFullYear() && m >= now.getUTCMonth() + 1) break; needMonths.push([y, m]); }
  const missing = needMonths.filter(([y, m]) => { const p = join(cfg.rawDir, pncpBundleRel(y, m)); return !existsSync(p) || statSync(p).size === 0; });
  if (ps.length) { await log({ state: 'COLLECTOR_RUNNING', attempts, pids: ps, missingMonths: missing.map(([y, m]) => `${y}-${String(m).padStart(2, '0')}`) }); return 0; }
  if (missing.length) {
    const out = await open(join(cfg.logsDir, 'pncp-finish-fetch.out'), 'a'); const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/exec/pncp-fetch.ts', '2025', String(now.getUTCFullYear()), '6'], { cwd: process.cwd(), detached: true, stdio: ['ignore', out.fd, out.fd], env: { ...process.env, PNCP_MIN_SPACING_MS: '200' } });
    child.unref(); await log({ state: 'COLLECTOR_STARTED', attempts, pid: child.pid, missingMonths: missing.map(([y, m]) => `${y}-${String(m).padStart(2, '0')}`) }); return 0;
  }
  // ---- publicação
  const years = [2025, now.getUTCFullYear()].filter((y, i, a) => a.indexOf(y) === i); const published: Array<Record<string, unknown>> = [];
  for (const y of years) {
    const r1 = await publishPncpYear(pool, cfg, y, { allowPartial: false }); const db = Number((await pool.query(`SELECT count(*)::int n FROM civica_exec.exec_fin_contract WHERE year = $1`, [y])).rows[0].n);
    const kept = 'kept' in r1 ? r1.kept : -1; const r2 = await publishPncpYear(pool, cfg, y, {}); const noChange = 'results' in r2 && r2.results!.every(x => x.status === 'NO_CHANGE');
    const ok = r1.status === 'DONE' && db === kept && noChange; published.push({ year: y, status: r1.status, keptInRaw: kept, rowsInDb: db, idempotent: noChange, ok, stats: 'stats' in r1 ? r1.stats : null });
    if (!ok) { await log({ state: 'PUBLISH_CHECK_FAILED', attempts, published }); return 1; }
  }
  await log({ state: 'DONE', attempts, published, closedMonthsPublishedThrough: needMonths.at(-1) });
  try { execFileSync('schtasks', ['/Change', '/TN', TASK, '/DISABLE']); } catch { /* tarefa já removida */ }
  return 0;
}
let code = 1; try { code = await main(); } catch (e) { await log({ state: 'ERROR', attempts, error: e instanceof Error ? e.message : String(e) }); } finally { await pool.end(); await rm(LOCK, { force: true }); }
process.exit(code);
