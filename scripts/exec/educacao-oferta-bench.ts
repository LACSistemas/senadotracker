import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getEducationMunicipalityOffer, getEducationNationalOffer, getEducationSchoolOffer, getEducationStateOffer } from '../../packages/db/src/exec/index.ts';
import { openPool } from './db.ts';

/**
 * Testes territoriais (G13) e benchmark dos read models de oferta (G9) contra o PostgreSQL publicado, somente leitura.
 *   npx tsx scripts/exec/educacao-oferta-bench.ts <saida.json> <pasta_sinopse_json>
 * Cada consulta é cronometrada (mediana de 5 execuções, 1 de aquecimento) e os totais de 2025 de cada município/UF são conferidos contra a Sinopse (tabelas 1.2 e 4.2).
 */
const [out, sinDir] = process.argv.slice(2); const pool = openPool(2);
const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!;
async function timed<T>(f: () => Promise<T>): Promise<{ ms: number; value: T }> { await f(); const t: number[] = []; let v!: T; for (let i = 0; i < 5; i++) { const s = performance.now(); v = await f(); t.push(performance.now() - s); } return { ms: Math.round(med(t) * 10) / 10, value: v }; }
const UF_NAME: Record<number, string> = { 14: 'Roraima', 26: 'Pernambuco', 31: 'Minas Gerais', 32: 'Espírito Santo', 33: 'Rio de Janeiro', 35: 'São Paulo', 53: 'Distrito Federal' };
try {
  const s12 = JSON.parse(await readFile(join(sinDir, 't12_2025.json'), 'utf8')) as { municipios: Record<string, { E: number }>; ufs: Record<string, { E: number }>; brasil: { E: number } };
  const s42 = JSON.parse(await readFile(join(sinDir, 't42_2025.json'), 'utf8')) as { municipios: Record<string, { E: number }>; ufs: Record<string, { E: number }>; brasil: { E: number } };
  const q1 = async (sql: string) => (await pool.query(sql)).rows[0]!;
  const smallest = await q1(`SELECT e.ibge7::text i, e.name, e.uf FROM civica_exec.exec_edu_offer_year o JOIN civica_exec.exec_edu_school_year y USING (inep, year) JOIN civica_exec.exec_entity e USING (entity_id) WHERE o.year = 2025 GROUP BY e.ibge7, e.name, e.uf ORDER BY count(*), e.ibge7 LIMIT 1`);
  const rich = await q1(`SELECT e.ibge7::text i, e.name, e.uf FROM civica_exec.exec_edu_offer_year o JOIN civica_exec.exec_edu_school_year y USING (inep, year) JOIN civica_exec.exec_entity e USING (entity_id) WHERE o.year = 2025 AND e.ibge7 NOT IN (3550308, 3304557) GROUP BY e.ibge7, e.name, e.uf ORDER BY count(*) FILTER (WHERE o.mat_eja_med > 0) + count(*) FILTER (WHERE o.mat_prof > 0) + count(*) FILTER (WHERE o.mat_esp_ce > 0) + count(*) FILTER (WHERE o.mat_inf_cre > 0) + count(*) FILTER (WHERE o.mat_int_med > 0) DESC LIMIT 1`);
  const dep = await q1(`SELECT e.ibge7::text i, e.name, e.uf FROM civica_exec.exec_edu_school_year a JOIN civica_exec.exec_edu_school_year b ON b.inep = a.inep AND b.year = 2025 AND a.year = 2024 AND a.dep <> b.dep JOIN civica_exec.exec_edu_offer_year o ON o.inep = b.inep AND o.year = 2025 JOIN civica_exec.exec_entity e ON e.entity_id = b.entity_id GROUP BY e.ibge7, e.name, e.uf ORDER BY count(*) DESC LIMIT 1`);
  const munis: Array<[string, string]> = [['3205309', 'Vitória/ES'], ['3205002', 'Serra/ES'], ['3200359', 'Alto Rio Novo/ES'], ['3550308', 'São Paulo/SP'], ['3304557', 'Rio de Janeiro/RJ'], ['3106200', 'Belo Horizonte/MG'], ['2611606', 'Recife/PE'], ['4314902', 'Porto Alegre/RS'],
    [String(smallest.i), `${smallest.name}/${smallest.uf} (menor nº de escolas com oferta)`], [String(rich.i), `${rich.name}/${rich.uf} (mais etapas e modalidades)`], [String(dep.i), `${dep.name}/${dep.uf} (escola que mudou de dependência 2024→2025)`]];
  const res: Record<string, unknown> = { at: new Date().toISOString(), municipalities: [], states: [] };
  for (const [ibge, label] of munis) {
    const t = await timed(() => getEducationMunicipalityOffer(pool, ibge, { year: 2025 })); const m = t.value!; const t2 = await timed(() => getEducationMunicipalityOffer(pool, ibge, { year: 2025, series: false }));
    const sm = s12.municipios[ibge]?.E, st = s42.municipios[ibge]?.E; const stagesSum = m.stages.reduce((n, x) => n + (x.matriculas ?? 0), 0);
    (res.municipalities as unknown[]).push({ label, ibge7: ibge, ms: t.ms, msSemSerie: t2.ms, matriculas: m.totals.matriculas, sinopseMatriculas: sm ?? null, turmas: m.totals.turmas, sinopseTurmas: st ?? null, ok: m.totals.matriculas === (sm ?? 0) && m.totals.turmas === (st ?? 0), etapasSomamTotal: stagesSum === m.totals.matriculas,
      escolas: m.totals.escolas, matPorTurma: m.totals.matPorTurma, series: m.series.length, redes: m.byDependency.map(d => `${d.label}:${d.matriculas}`) });
  }
  for (const uf of [32, 35, 33, 31, 26, 14, 53]) {
    const t = await timed(() => getEducationStateOffer(pool, uf, { year: 2025 })); const v = t.value!; const sm = s12.ufs[UF_NAME[uf]!]?.E, st = s42.ufs[UF_NAME[uf]!]?.E;
    (res.states as unknown[]).push({ uf, name: v.scope.name, ms: t.ms, matriculas: v.totals.matriculas, sinopseMatriculas: sm ?? null, turmas: v.totals.turmas, sinopseTurmas: st ?? null, ok: v.totals.matriculas === sm && v.totals.turmas === st, series: v.series.length });
  }
  const br = await timed(() => getEducationNationalOffer(pool, { year: 2025 })); const b = br.value!;
  res.brasil = { ms: br.ms, matriculas: b.totals.matriculas, sinopse: s12.brasil.E, turmas: b.totals.turmas, sinopseTurmas: s42.brasil.E, ok: b.totals.matriculas === s12.brasil.E && b.totals.turmas === s42.brasil.E, series: b.series.length };
  const probe = await q1(`SELECT inep FROM civica_exec.exec_edu_offer_year WHERE year = 2025 AND inep > 32000100 ORDER BY inep LIMIT 1`); const sc = await timed(() => getEducationSchoolOffer(pool, Number(probe.inep))); res.school = { inep: Number(probe.inep), ms: sc.ms, anos: sc.value?.years.length };
  const all = [...(res.municipalities as Array<{ ms: number }>).map(x => x.ms), ...(res.states as Array<{ ms: number }>).map(x => x.ms), br.ms, sc.ms];
  res.maxMs = Math.max(...all); res.allMatchSinopse = [...(res.municipalities as Array<{ ok: boolean }>), ...(res.states as Array<{ ok: boolean }>), res.brasil as { ok: boolean }].every(x => x.ok);
  await writeFile(out!, JSON.stringify(res, null, 1)); console.log(JSON.stringify({ maxMs: res.maxMs, allMatchSinopse: res.allMatchSinopse, brasil: res.brasil, school: res.school }));
} finally { await pool.end(); }
