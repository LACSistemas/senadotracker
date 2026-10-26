import { writeFile } from 'node:fs/promises';
import {
  getEduContractCoverage, getEduContractDetail, getEduContractList, getEduContractsTerritory, getEduOrgan, getEduSuppliers, getEduSupplier, getEduWorkDetail, getEduWorks,
} from '../../packages/db/src/exec/index.ts';
import { openPool } from './db.ts';

/**
 * Benchmark e prova de leitura dos read models de contratações da Educação (P10.7), contra o banco apontado por EXEC_DATABASE_URL (somente leitura).
 * Cenários: Brasil, UFs, Vitória, Serra, Alto Rio Novo, São Paulo, Rio de Janeiro, Belo Horizonte, Recife, um município pequeno (o de menos contratos), fornecedor líder e órgão líder.
 *   npx tsx scripts/exec/edu-contracts-bench.ts <saida.json> [repeticoes]
 */
const [outFile, repArg] = process.argv.slice(2); const REP = Number(repArg ?? 15);
const pool = openPool(2);
const pct = (a: number[], p: number): number => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]!; };
const time = async (fn: () => Promise<unknown>): Promise<{ p50: number; p95: number; max: number; result: unknown }> => {
  const ts: number[] = []; let result: unknown = null;
  for (let i = 0; i < REP; i++) { const t0 = performance.now(); result = await fn(); ts.push(performance.now() - t0); }
  return { p50: Math.round(pct(ts, 0.5) * 10) / 10, p95: Math.round(pct(ts, 0.95) * 10) / 10, max: Math.round(Math.max(...ts) * 10) / 10, result };
};
const MUN: Array<[string, string]> = [['Vitória', '3205309'], ['Serra', '3205002'], ['Alto Rio Novo', '3200359'], ['São Paulo', '3550308'], ['Rio de Janeiro', '3304557'], ['Belo Horizonte', '3106200'], ['Recife', '2611606']];
const UFS = [11, 12, 13, 14, 15, 16, 17, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31, 32, 33, 35, 41, 42, 43, 50, 51, 52, 53];
const out: Record<string, unknown> = { at: new Date().toISOString(), repeticoes: REP }; const rows: Array<Record<string, unknown>> = [];
const slim = (r: any): unknown => r == null ? null : r.total ? { total: r.total, anos: r.byYear?.length, categorias: r.byCategory?.length } : r.rows ? { linhas: r.rows.length, total: r.total ?? null } : { ok: true };
try {
  const add = async (name: string, kind: string, fn: () => Promise<unknown>) => { const t = await time(fn); rows.push({ cenario: name, leitura: kind, p50_ms: t.p50, p95_ms: t.p95, max_ms: t.max, resultado: slim(t.result) }); };
  await add('Brasil', 'territorio', () => getEduContractsTerritory(pool, {}));
  await add('Brasil', 'lista(50)', () => getEduContractList(pool, {}));
  await add('Brasil', 'fornecedores(20)', () => getEduSuppliers(pool, {}));
  for (const u of UFS) await add(`UF ${u}`, 'territorio', () => getEduContractsTerritory(pool, { ufCode: u }));
  for (const [nome, ibge] of MUN) { await add(nome, 'territorio', () => getEduContractsTerritory(pool, { ibge7: ibge })); await add(nome, 'lista(50)', () => getEduContractList(pool, { ibge7: ibge })); await add(nome, 'fornecedores(20)', () => getEduSuppliers(pool, { ibge7: ibge })); }
  const small = (await pool.query(`SELECT e.ibge7 FROM civica_exec.exec_edu_contract c JOIN civica_exec.exec_entity e ON e.entity_id = c.entity_id WHERE e.kind = 4 GROUP BY e.ibge7 ORDER BY count(*), e.ibge7 LIMIT 1`)).rows[0];
  if (small) await add(`menor município com contratos (${small.ibge7})`, 'territorio', () => getEduContractsTerritory(pool, { ibge7: String(small.ibge7).padStart(7, '0') }));
  const topSup = (await pool.query(`SELECT supplier FROM civica_exec.exec_edu_contract WHERE supplier IS NOT NULL AND best_confidence <= 2 GROUP BY supplier ORDER BY count(*) DESC LIMIT 1`)).rows[0];
  if (topSup) await add('fornecedor com mais contratos', 'fornecedor', () => getEduSupplier(pool, String(topSup.supplier).padStart(14, '0')));
  const topOrg = (await pool.query(`SELECT org_cnpj FROM civica_exec.exec_edu_contract WHERE best_confidence <= 2 GROUP BY org_cnpj ORDER BY count(*) DESC LIMIT 1`)).rows[0];
  if (topOrg) await add('órgão com mais contratos', 'órgão', () => getEduOrgan(pool, String(topOrg.org_cnpj).padStart(14, '0')));
  const one = (await pool.query(`SELECT pncp_id FROM civica_exec.exec_edu_contract ORDER BY valor_global DESC NULLS LAST LIMIT 1`)).rows[0];
  if (one) await add('maior contrato', 'detalhe', () => getEduContractDetail(pool, String(one.pncp_id)));
  const ufW = (await pool.query(`SELECT uf FROM civica_exec.exec_edu_work GROUP BY uf ORDER BY count(*) DESC LIMIT 1`)).rows[0];
  if (ufW) { await add(`obras UF ${ufW.uf}`, 'obras(50)', () => getEduWorks(pool, { ufCode: Number(ufW.uf) })); const w = (await pool.query(`SELECT work_id FROM civica_exec.exec_edu_work WHERE uf = $1 ORDER BY committed DESC NULLS LAST LIMIT 1`, [ufW.uf])).rows[0]; if (w) await add('obra com mais empenho', 'detalhe', () => getEduWorkDetail(pool, String(w.work_id))); }
  await add('cobertura', 'cobertura', () => getEduContractCoverage(pool));
  out.cenarios = rows; const p95 = rows.map(r => Number(r.p95_ms)); out.resumo = { leituras: rows.length, p50_mediana_ms: pct(rows.map(r => Number(r.p50_ms)), 0.5), p95_maximo_ms: Math.max(...p95), p95_acima_de_500ms: rows.filter(r => Number(r.p95_ms) > 500).map(r => `${r.cenario}/${r.leitura}=${r.p95_ms}ms`) };
  await writeFile(outFile!, JSON.stringify(out, null, 1)); console.log(JSON.stringify(out.resumo));
} finally { await pool.end(); }
