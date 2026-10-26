import { writeFile } from 'node:fs/promises';
import {
  getEducationMunicipalityInfra, getEducationNationalInfra, getEducationSchoolInfra, getEducationSchoolIndicators, getEducationTerritoryIndicators,
} from '../../packages/db/src/exec/index.ts';
import { openPool } from './db.ts';

/**
 * Benchmark e testes territoriais dos read models da P10.3 (somente leitura). EXEC_DATABASE_URL aponta para o banco avaliado.
 *   npx tsx scripts/exec/educacao-p103-bench.ts <saida.json> [repetições]
 * Mede p50 e p95 sobre N execuções por caso (N ≥ 20 para p95 ter sentido) e devolve os números dos casos territoriais (Brasil, 7 UFs, 12 municípios).
 */
const out = process.argv[2]!; const N = Number(process.argv[3] ?? 20);
const pool = openPool(3);
const pct = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)]!; };
async function time<T>(fn: () => Promise<T>): Promise<{ r: T; ms: number[] }> {
  const ms: number[] = []; let r!: T;
  for (let i = 0; i < N; i++) { const t = process.hrtime.bigint(); r = await fn(); ms.push(Number(process.hrtime.bigint() - t) / 1e6); }
  return { r, ms };
}
const stat = (ms: number[]) => ({ n: ms.length, p50: Math.round(pct(ms, 0.5) * 10) / 10, p95: Math.round(pct(ms, 0.95) * 10) / 10, max: Math.round(Math.max(...ms) * 10) / 10 });
try {
  const MUN: Array<[string, string]> = [['Vitória/ES', '3205309'], ['Serra/ES', '3205002'], ['Alto Rio Novo/ES', '3200359'], ['São Paulo/SP', '3550308'], ['Rio de Janeiro/RJ', '3304557'], ['Belo Horizonte/MG', '3106200'], ['Recife/PE', '2611606'], ['Porto Alegre/RS', '4314902'], ['Petrolina/PE', '2611101'], ['Chapada de Areia/TO', '1705557'], ['Brasília/DF', '5300108'], ['Boa Vista/RR', '1400100']];
  const UFS: Array<[string, number]> = [['ES', 32], ['SP', 35], ['RJ', 33], ['MG', 31], ['PE', 26], ['RR', 14], ['DF', 53]];
  const res: Record<string, unknown> = { at: new Date().toISOString(), repeticoes: N, casos: [], territorial: {} };
  const casos = res.casos as Array<Record<string, unknown>>; const terr = res.territorial as Record<string, unknown>;
  const add = (nome: string, ms: number[]) => casos.push({ caso: nome, ...stat(ms) });
  const nat = await time(() => getEducationNationalInfra(pool)); add('infra Brasil (resumo + série 19 edições)', nat.ms);
  const natNoSer = await time(() => getEducationNationalInfra(pool, { series: false })); add('infra Brasil sem série', natNoSer.ms);
  terr.brasilInfra2025 = nat.r && Object.fromEntries(nat.r.itens.filter(i => ['internet', 'biblioteca_ou_leitura', 'lab_informatica', 'agua_rede', 'esgoto_rede', 'quadra'].includes(i.code)).map(i => [i.code, { sim: i.sim, nao: i.nao, semResposta: i.semResposta, pct: i.pct }]));
  const indBr = await time(() => getEducationTerritoryIndicators(pool, {})); add('indicadores Brasil (recortes + série)', indBr.ms);
  for (const [sg, uf] of UFS) { const t = await time(() => getEducationNationalInfra(pool, { ufCode: uf })); add(`infra UF ${sg}`, t.ms); terr[`uf_${sg}`] = { escolas: t.r?.universe.escolas, internet: t.r?.itens.find(i => i.code === 'internet')?.pct, biblioteca: t.r?.itens.find(i => i.code === 'biblioteca_ou_leitura')?.pct };
    const ti = await time(() => getEducationTerritoryIndicators(pool, { ufCode: uf })); add(`indicadores UF ${sg}`, ti.ms); }
  for (const [nome, ibge] of MUN) {
    const t = await time(() => getEducationMunicipalityInfra(pool, ibge)); add(`infra município ${nome} (com série)`, t.ms);
    const t2 = await time(() => getEducationMunicipalityInfra(pool, ibge, { series: false })); add(`infra município ${nome} (sem série)`, t2.ms);
    const ti = await time(() => getEducationTerritoryIndicators(pool, { ibge7: ibge })); add(`indicadores município ${nome}`, ti.ms);
    const r = t.r; terr[`mun_${ibge}`] = r && { nome, escolasEmAtividade: r.universe.escolas, semResposta: r.universe.semResposta, internet: r.itens.find(i => i.code === 'internet'), biblioteca: r.itens.find(i => i.code === 'biblioteca_ou_leitura')?.pct, dependencias: r.byDependency.map(d => ({ dep: d.label, escolas: d.escolas })) };
  }
  const t3 = await time(() => getEducationMunicipalityInfra(pool, '3205309', { stage: 'MED' })); add('infra município Vitória, só escolas com ensino médio', t3.ms); terr.vitoriaMedio = t3.r && { escolas: t3.r.universe.escolas, internet: t3.r.itens.find(i => i.code === 'internet')?.pct };
  const sch = (await pool.query(`SELECT o.inep FROM civica_exec.exec_edu_infra_year o WHERE o.year = 2025 AND o.inep IN (SELECT inep FROM civica_exec.exec_edu_school_year WHERE year = 2025 AND entity_id = 3205309) ORDER BY o.inep LIMIT 1`)).rows[0];
  if (sch) { const t = await time(() => getEducationSchoolInfra(pool, Number(sch.inep))); add('infra escola (19 edições)', t.ms); terr.escolaExemplo = { inep: sch.inep, anos: t.r?.years.length }; const ti = await time(() => getEducationSchoolIndicators(pool, Number(sch.inep))); add('indicadores escola', ti.ms); }
  terr.casosEspeciais = {
    semInternet2025: Number((await pool.query(`SELECT count(*) n FROM civica_exec.exec_edu_infra_year WHERE year = 2025 AND internet = false`)).rows[0].n),
    campoNaoInformado2022: Number((await pool.query(`SELECT count(*) n FROM civica_exec.exec_edu_infra_year WHERE year = 2022 AND internet IS NULL`)).rows[0].n),
    bibliotecaAntes2009: Number((await pool.query(`SELECT count(biblioteca) n FROM civica_exec.exec_edu_infra_year WHERE year < 2009`)).rows[0].n),
    escolaSemLinhaDeInfra2025: Number((await pool.query(`SELECT count(*) n FROM civica_exec.exec_edu_school_year y LEFT JOIN civica_exec.exec_edu_infra_year i ON i.inep = y.inep AND i.year = y.year WHERE y.year = 2025 AND i.inep IS NULL`)).rows[0].n),
    escolaParalisadaOuExtintaSemLinha2025: Number((await pool.query(`SELECT count(*) n FROM civica_exec.exec_edu_school_year y LEFT JOIN civica_exec.exec_edu_infra_year i ON i.inep = y.inep AND i.year = y.year WHERE y.year = 2025 AND y.sit <> 1 AND i.inep IS NULL`)).rows[0].n),
    escolasMudaramDependencia2024a2025: Number((await pool.query(`SELECT count(*) n FROM civica_exec.exec_edu_school_year a JOIN civica_exec.exec_edu_school_year b ON a.inep = b.inep AND b.year = 2025 WHERE a.year = 2024 AND a.dep <> b.dep`)).rows[0].n),
    mediaDeSalasUtilizadasMax: Number((await pool.query(`SELECT max(salas_utilizadas) n FROM civica_exec.exec_edu_infra_year WHERE year = 2025`)).rows[0].n),
  };
  await writeFile(out, JSON.stringify(res, null, 1));
  console.log(JSON.stringify(casos.map(c => [c.caso, c.p50, c.p95])));
} finally { await pool.end(); }
