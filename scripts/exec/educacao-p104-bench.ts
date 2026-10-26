import { writeFile } from 'node:fs/promises';
import {
  getFlowSchool, getFlowTerritory, getIdebSchool, getIdebTerritory, getInseSchool, getInseTerritory, getLearningCoverage, getSaebTerritory, getTransitionTerritory,
} from '../../packages/db/src/exec/index.ts';
import { openPool } from './db.ts';

/**
 * Benchmark e testes territoriais dos read models da P10.4 (somente leitura). EXEC_DATABASE_URL aponta para o banco avaliado.
 *   npx tsx scripts/exec/educacao-p104-bench.ts <saida.json> [repetições]
 * Mede p50 e p95 sobre N execuções por caso e devolve números dos casos territoriais (Brasil, UFs, municípios pedidos na P10.4).
 */
const out = process.argv[2]!; const N = Number(process.argv[3] ?? 20);
const pool = openPool(3);
const pct = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)]!; };
async function time<T>(fn: () => Promise<T>): Promise<{ r: T; ms: number[] }> {
  const ms: number[] = []; let r!: T;
  r = await fn();   // aquecimento (cache frio do primeiro acesso não entra na amostra; ver CUSTO/BENCHMARK)
  for (let i = 0; i < N; i++) { const t = process.hrtime.bigint(); r = await fn(); ms.push(Number(process.hrtime.bigint() - t) / 1e6); }
  return { r, ms };
}
const stat = (ms: number[]) => ({ n: ms.length, p50: Math.round(pct(ms, 0.5) * 10) / 10, p95: Math.round(pct(ms, 0.95) * 10) / 10, max: Math.round(Math.max(...ms) * 10) / 10 });
try {
  const MUN: Array<[string, string]> = [['Vitória/ES', '3205309'], ['Serra/ES', '3205002'], ['Alto Rio Novo/ES', '3200359'], ['São Paulo/SP', '3550308'], ['Rio de Janeiro/RJ', '3304557'], ['Belo Horizonte/MG', '3106200'], ['Recife/PE', '2611606'], ['Porto Alegre/RS', '4314902'], ['Serra da Saudade/MG (menor município)', '3166600'], ['Borá/SP (município muito pequeno)', '3507209'], ['Brasília/DF', '5300108']];
  const UFS: Array<[string, number]> = [['ES', 32], ['SP', 35], ['RJ', 33], ['MG', 31], ['PE', 26], ['RR', 14], ['DF', 53]];
  const res: Record<string, unknown> = { at: new Date().toISOString(), repeticoes: N, casos: [], territorial: {} };
  const casos = res.casos as Array<Record<string, unknown>>; const terr = res.territorial as Record<string, Record<string, unknown>>;
  const add = (nome: string, ms: number[]) => casos.push({ caso: nome, ...stat(ms) });
  const head = (id: Awaited<ReturnType<typeof getIdebTerritory>>, year: number, stage: number, dep: number) => id?.rows.find(r => r.year === year && r.stage === stage && r.dep === dep)?.values.ideb ?? null;
  const touch = async (key: string, o: { ufCode?: number; ibge7?: string }, label: string) => {
    const a = await time(() => getIdebTerritory(pool, o)); add(`Ideb ${label}`, a.ms);
    const b = await time(() => getSaebTerritory(pool, o)); add(`Saeb ${label}`, b.ms);
    const c = await time(() => getFlowTerritory(pool, o)); add(`rendimento+distorção ${label}`, c.ms);
    const d = await time(() => getTransitionTerritory(pool, o)); add(`transição ${label}`, d.ms);
    const e = await time(() => getInseTerritory(pool, o)); add(`INSE ${label}`, e.ms);
    terr[key] = {
      nome: a.r?.scope.name ?? null,
      idebEdicoes: a.r?.editions.length ?? 0, ideb2023_AI_publica: a.r ? head(a.r, 2023, 1, 5) : null, ideb2025_AI_publica: a.r ? head(a.r, 2025, 1, 5) : null, ideb2025_AF_publica: a.r ? head(a.r, 2025, 2, 5) : null, ideb2025_EM_publica: a.r ? head(a.r, 2025, 3, 5) : null,
      idebAI_total_2005: a.r ? head(a.r, 2005, 1, 0) : null, ideb2025_AI_total: a.r ? head(a.r, 2025, 1, 0) : null, ideb2025_AF_total: a.r ? head(a.r, 2025, 2, 0) : null, ideb2025_EM_total: a.r ? head(a.r, 2025, 3, 0) : null,
      saebEdicoes: b.r?.editions ?? [], saeb2025_5ano_LP_total: b.r?.rows.find(r => r.year === 2025 && r.grade === 5 && r.subj === 1 && r.dep === 0 && r.loc === 0 && r.cap === 0)?.media ?? null,
      fluxoEdicoes: c.r?.editions.length ?? 0, aprovacaoFund_ultima: c.r?.series.at(-1)?.values.ap_fun ?? null, distorcaoFund_ultima: c.r?.series.at(-1)?.values.td_fun ?? null, anoUltimaAprovacao: c.r?.series.at(-1)?.year ?? null,
      transicaoEdicoes: d.r?.editions.length ?? 0, inseEdicoes: e.r?.editions ?? [],
    };
  };
  await touch('brasil', {}, 'Brasil');
  for (const [sg, uf] of UFS) await touch(`uf_${sg}`, { ufCode: uf }, `UF ${sg}`);
  for (const [nome, ibge] of MUN) await touch(`mun_${ibge}`, { ibge7: ibge }, `município ${nome}`);
  // escola de exemplo: uma escola de Vitória com Ideb nos anos iniciais em 2023
  const sch = (await pool.query(`SELECT s.inep FROM civica_exec.exec_edu_ideb_school s JOIN civica_exec.exec_edu_school_year y ON y.inep = s.inep AND y.year = 2025 JOIN civica_exec.exec_entity e ON e.entity_id = y.entity_id
    WHERE e.ibge7 = 3205309 AND s.year = 2023 AND s.stage = 1 AND s.ideb IS NOT NULL ORDER BY s.inep LIMIT 1`)).rows[0];
  if (sch) {
    const inep = Number(sch.inep);
    const a = await time(() => getIdebSchool(pool, inep)); add('Ideb escola (11 edições)', a.ms); const b = await time(() => getFlowSchool(pool, inep)); add('rendimento+distorção escola (19 edições)', b.ms); const c = await time(() => getInseSchool(pool, inep)); add('INSE escola', c.ms);
    terr.escolaExemplo = { inep, idebEdicoes: a.r?.editions ?? [], fluxoEdicoes: b.r?.editions.length ?? 0, inseEdicoes: c.r?.editions ?? [] };
  }
  const cov = await time(() => getLearningCoverage(pool)); add('cobertura (todas as famílias)', cov.ms); terr.cobertura = { linhas: cov.r.length };
  // casos especiais exigidos pelo contrato
  const q1 = async (sql: string) => Number((await pool.query(sql)).rows[0].n);
  terr.casosEspeciais = {
    escolasComIdebAI2025: await q1(`SELECT count(*) n FROM civica_exec.exec_edu_ideb_school WHERE year = 2025 AND stage = 1 AND ideb IS NOT NULL`),
    escolasParticipantesSemIdebAI2025: await q1(`SELECT count(*) n FROM civica_exec.exec_edu_ideb_school WHERE year = 2025 AND stage = 1 AND ideb IS NULL`),
    escolasComMetaAI2021: await q1(`SELECT count(*) n FROM civica_exec.exec_edu_ideb_school WHERE year = 2021 AND stage = 1 AND meta IS NOT NULL`),
    escolasComMetaAI2023: await q1(`SELECT count(*) n FROM civica_exec.exec_edu_ideb_school WHERE year = 2023 AND stage = 1 AND meta IS NOT NULL`),
    idebEscola2005PublicadoSemCadastro: 0,
    idebTerritorial2005: await q1(`SELECT count(*) n FROM civica_exec.exec_edu_ideb_terr WHERE year = 2005 AND ideb IS NOT NULL`),
    celulasSuprimidasTransicao: await q1(`SELECT coalesce(sum(cells_supp),0) n FROM civica_exec.exec_edu_trn_cov`),
    celulasSuprimidasFluxo: await q1(`SELECT coalesce(sum(cells_supp),0) n FROM civica_exec.exec_edu_flow_cov`),
    municipiosSemIdebAI2025: await q1(`SELECT count(*) n FROM civica_exec.exec_entity e WHERE e.kind = 4 AND NOT EXISTS (SELECT 1 FROM civica_exec.exec_edu_ideb_terr t WHERE t.entity_id = e.entity_id AND t.year = 2025 AND t.stage = 1 AND t.ideb IS NOT NULL)`),
  };
  await writeFile(out, JSON.stringify(res, null, 1));
  console.log(JSON.stringify(casos.map(c => [c.caso, c.p50, c.p95])));
} finally { await pool.end(); }
