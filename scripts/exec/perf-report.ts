import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { storageConfig } from '../../apps/collector/src/exec/storage.ts';

/** Gera desempenho_backfill.csv a partir dos logs jsonl dos collectors (um registro por unidade publicável) + resumo das filas (erros e novas tentativas). */
const out = process.argv[2] ?? 'docs/executivo-collector-plan/execucao/saude-nacional-p1';
const cfg = storageConfig();
const read = async (f: string) => { try { return (await readFile(join(cfg.logsDir, f), 'utf8')).split('\n').filter(l => l.trim().startsWith('{')).map(l => { try { return JSON.parse(l) as Record<string, unknown>; } catch { return null; } }).filter((x): x is Record<string, unknown> => x !== null); } catch { return []; } };
const rows: string[] = ['collector,uf,competencia,tipo,tempo_total_s,bytes,registros,publicacao_status,erros,retries'];
const files = await readdir(cfg.logsDir);
for (const f of files.filter(x => /^cnes-[A-Z]{2}-\d+-\d+\.jsonl$/.test(x))) for (const r of await read(f)) rows.push(['cnes', r.uf, r.competence, r.kind, (Number(r.ms) / 1000).toFixed(1), r.bytes, r.rowsOut, r.status, 0, 0].join(','));
for (const r of await read('cnes-pf.jsonl')) rows.push(['cnes', r.uf, r.competence, 'pf', (Number(r.ms) / 1000).toFixed(1), r.bytes, r.rowsOut, r.status, 0, 0].join(','));
for (const r of await read('epi-sih-month.jsonl')) if (r.status) rows.push(['sih-rd', 'BR', r.competence, 'hospital27+residencia', r.s, r.bytes, r.rowsRead, r.status, 0, 0].join(','));
for (const r of await read('epi-vital.jsonl')) rows.push(['vital', r.uf, r.year, 'sinasc+sim', '', '', r.births ?? '', `${r.sinasc}/${r.sim}`, 0, 0].join(','));
const q = (await Promise.all(files.filter(x => x.startsWith('queue-')).map(async f => ({ f, l: await read(f) }))));
const errs = q.flatMap(x => x.l.filter(r => r.code !== undefined && r.code !== 0).map(r => `${x.f}:${String(r.cmd)}`));
const retries = q.reduce((n, x) => n + x.l.filter(r => r.retry !== undefined).length, 0);
await writeFile(join(out, 'desempenho_backfill.csv'), rows.join('\n') + '\n');
await writeFile(join(out, '_filas_resumo.json'), JSON.stringify({ filas: q.map(x => ({ fila: x.f, entradas: x.l.length, falhas: x.l.filter(r => r.code !== undefined && r.code !== 0).length, retries: x.l.filter(r => r.retry !== undefined).length })), falhasDefinitivas: errs.length, retriesTotal: retries }, null, 2));
console.log(rows.length - 1, 'linhas;', errs.length, 'falhas de fila;', retries, 'retries');
