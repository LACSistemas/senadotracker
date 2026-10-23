import { writeFileSync } from 'node:fs';
import { clearSecurityCache, loadSecurityPage, scopeOf } from '../../apps/web/lib/security/load.ts';
/**
 * Medição da montagem de dados da página de Segurança (sem rede): nº de SQL, tempo de banco, tempo total, tamanho do JSON e p95 por comando, com cache frio (por requisição) e quente.
 * Uso: perf.ts <saida.json> [iterações]
 */
const out = process.argv[2]!; const N = Number(process.argv[3] ?? 12);
const TERR: Array<['uf' | 'municipio', string, string]> = [['municipio', '3205309', 'Vitória/ES'], ['municipio', '3205002', 'Serra/ES'], ['municipio', '3200359', 'Alto Rio Novo/ES'], ['municipio', '3550308', 'São Paulo/SP'], ['municipio', '3304557', 'Rio de Janeiro/RJ'], ['municipio', '3106200', 'Belo Horizonte/MG'], ['municipio', '2611606', 'Recife/PE'], ['municipio', '4314902', 'Porto Alegre/RS'], ['municipio', '2927408', 'Salvador/BA'], ['uf', 'ES', 'ES'], ['uf', 'SP', 'SP'], ['uf', 'MG', 'MG']];
const pct = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] ?? 0; };
const rows: Array<Record<string, unknown>> = [];
for (const [kind, code, label] of TERR) {
  const scope = await scopeOf(kind, code); if (!scope) continue; const cold: number[] = [], warm: number[] = [], sql: number[] = [], dbw: number[] = [], stmts: number[] = []; let kb = 0;
  await loadSecurityPage(scope);
  for (let i = 0; i < N; i++) { clearSecurityCache(); const t = performance.now(); const d = await loadSecurityPage(scope); cold.push(performance.now() - t); sql.push(d.meta.sqlStatements); dbw.push(d.meta.dbMs); stmts.push(...(d.meta.statementMs ?? [])); kb = Math.round(JSON.stringify(d).length / 1024); }
  for (let i = 0; i < N; i++) { const t = performance.now(); await loadSecurityPage(scope); warm.push(performance.now() - t); }
  rows.push({ label, sqlStatements: Math.max(...sql), jsonKB: kb, coldMs: { p50: Math.round(pct(cold, 50)), p95: Math.round(pct(cold, 95)) }, dbWallMs: { p50: Math.round(pct(dbw, 50)), p95: Math.round(pct(dbw, 95)) }, warmMs: { p50: Math.round(pct(warm, 50)), p95: Math.round(pct(warm, 95)) }, statementMs: { p50: Math.round(pct(stmts, 50)), p95: Math.round(pct(stmts, 95)), max: Math.round(Math.max(...stmts)) } });
  console.log(label, JSON.stringify(rows.at(-1)));
}
writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), iterations: N, note: 'tempos da camada de dados (SQL + montagem), sem rede nem renderização; frio = cache de leituras estaduais limpo a cada requisição', rows }, null, 1));
process.exit(0);
