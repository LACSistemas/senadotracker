import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  getEducationMunicipalitySchools, getEducationSchool, getEducationSchoolHistory, getEducationStateSchools,
} from '../../packages/db/src/exec/index.ts';
import { openPool } from './db.ts';

/**
 * Testes territoriais (G13) e benchmark dos read models (G12) contra o PostgreSQL publicado, somente leitura.
 *   npx tsx scripts/exec/educacao-bench.ts <saida.json> <pasta_sinopse_json>
 * Cada consulta é cronometrada (mediana de 5 execuções, 1 de aquecimento) e as contagens de 2025 são conferidas contra a Sinopse (município e UF).
 */
const [out, sinDir] = process.argv.slice(2); const pool = openPool(2);
const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!;
async function timed<T>(f: () => Promise<T>): Promise<{ ms: number; value: T }> { await f(); const t: number[] = []; let v!: T; for (let i = 0; i < 5; i++) { const s = performance.now(); v = await f(); t.push(performance.now() - s); } return { ms: Math.round(med(t) * 10) / 10, value: v }; }
const UF_NAME: Record<number, string> = { 14: 'Roraima', 26: 'Pernambuco', 31: 'Minas Gerais', 32: 'Espírito Santo', 33: 'Rio de Janeiro', 35: 'São Paulo', 53: 'Distrito Federal' };
try {
  const sin = JSON.parse(await readFile(join(sinDir, 'estab_2025.json'), 'utf8')) as { municipios: Record<string, { E: number }>; ufs: Record<string, { E: number }> };
  const smallest = (await pool.query(`SELECT e.ibge7::text i, e.name, e.uf FROM civica_exec.exec_edu_school_year y JOIN civica_exec.exec_entity e USING (entity_id) WHERE y.year = 2025 GROUP BY e.ibge7, e.name, e.uf ORDER BY count(*), e.ibge7 LIMIT 1`)).rows[0]!;
  const changed = (await pool.query(`WITH l AS (SELECT inep, year, sit, lag(sit) OVER (PARTITION BY inep ORDER BY year) ps, entity_id FROM civica_exec.exec_edu_school_year) SELECT e.ibge7::text i, e.name FROM l JOIN civica_exec.exec_entity e USING (entity_id) WHERE ps = 1 AND sit = 2 AND year = 2025 GROUP BY e.ibge7, e.name ORDER BY count(*) DESC LIMIT 1`)).rows[0]!;
  const munis: Array<[string, string]> = [['3205309', 'Vitória/ES'], ['3205002', 'Serra/ES'], ['3200359', 'Alto Rio Novo/ES'], ['3550308', 'São Paulo/SP'], ['3304557', 'Rio de Janeiro/RJ'], ['3106200', 'Belo Horizonte/MG'], ['2611606', 'Recife/PE'], ['4314902', 'Porto Alegre/RS'],
    [String(smallest.i), `${smallest.name}/${smallest.uf} (menor nº de escolas)`], [String(changed.i), `${changed.name} (escolas que passaram de em atividade a paralisada)`]];
  const res: Record<string, unknown> = { at: new Date().toISOString(), municipalities: [], states: [], school: {}, pagination: {} };
  for (const [ibge, label] of munis) {
    const t = await timed(() => getEducationMunicipalitySchools(pool, ibge, { year: 2025, pageSize: 50 })); const m = t.value!;
    const s = sin.municipios[ibge]?.E;
    (res.municipalities as unknown[]).push({ label, ibge7: ibge, ms: t.ms, registered: m.counts.registered, active: m.counts.active, withEnrollment: m.counts.withEnrollment, sinopseUniverseDb: m.counts.sinopseUniverse, sinopse2025: s ?? null, matchesSinopse: s === m.counts.sinopseUniverse,
      byDependency: m.byDependency.map(d => `${d.dependency.label}:${d.registered}`), seriesYears: m.series.length, pageReturned: m.schools.length, pageTotal: m.page.total, coverageEditions: m.coverage.length });
  }
  for (const uf of [32, 35, 33, 31, 26, 14, 53]) {
    const t = await timed(() => getEducationStateSchools(pool, uf, { year: 2025, listSchools: false })); const l = await timed(() => getEducationStateSchools(pool, uf, { year: 2025, pageSize: 50, dependency: 3, search: 'ESCOLA' }));
    const s = sin.ufs[UF_NAME[uf]!]?.E; const v = t.value!;
    (res.states as unknown[]).push({ uf, name: v.scope.name, summaryMs: t.ms, listFilteredSearchMs: l.ms, registered: v.counts.registered, sinopseUniverseDb: v.counts.sinopseUniverse, sinopse2025: s ?? null, matchesSinopse: s === v.counts.sinopseUniverse, listTotal: l.value!.page.total, seriesYears: v.series.length });
  }
  const sc = await timed(() => getEducationSchool(pool, 32000146)); const hs = await timed(() => getEducationSchoolHistory(pool, 32000146));
  res.school = { inep: 32000146, getEducationSchoolMs: sc.ms, historyMs: hs.ms, editions: sc.value?.editionsPresent };
  res.pagination = { deepPageMs: (await timed(() => getEducationStateSchools(pool, 35, { year: 2025, page: 600, pageSize: 50 }))).ms, emptyResultMs: (await timed(() => getEducationMunicipalitySchools(pool, '3205309', { year: 2025, search: 'zzzzzz' }))).ms, nullYear: await getEducationMunicipalitySchools(pool, '3205309', { year: 1990 }), invalid: await getEducationMunicipalitySchools(pool, 'abc') };
  const all = [...(res.municipalities as Array<{ ms: number }>).map(x => x.ms), ...(res.states as Array<{ summaryMs: number }>).map(x => x.summaryMs)];
  res.maxMs = Math.max(...all); res.allMatchSinopse = [...(res.municipalities as Array<{ matchesSinopse: boolean }>), ...(res.states as Array<{ matchesSinopse: boolean }>)].every(x => x.matchesSinopse);
  await writeFile(out!, JSON.stringify(res, null, 1)); console.log(JSON.stringify({ maxMs: res.maxMs, allMatchSinopse: res.allMatchSinopse, school: res.school, pagination: res.pagination }));
} finally { await pool.end(); }
