import { writeFile } from 'node:fs/promises';
import { storageConfig } from '../../apps/collector/src/exec/storage.ts';
import { extractIndFile, locateIndFiles, readIndInventory, readIndTsv } from '../../apps/collector/src/exec/educacao-ind.ts';
import { IND_MEASURES, parseCell, type IndFamily } from '../../packages/db/src/exec/index.ts';
import { openPool } from './db.ts';

/**
 * Reconciliação da P10.3 (somente leitura). EXEC_DATABASE_URL aponta para o banco avaliado.
 *   npx tsx scripts/exec/educacao-p103-reconcilia.ts <saida.json> [anos]
 * A) integridade RAW → publicado: células numéricas lidas das planilhas oficiais (já extraídas) × células não nulas no banco, por edição × família × nível.
 * B) invariantes dos próprios indicadores oficiais: distribuições que devem somar 100 (AFD, IED, ICG, IRD territoriais) com a tolerância do arredondamento.
 * C) coerência com a oferta da P10.2: indicador de etapa de uma escola só existe se a escola tem matrícula na etapa.
 * D) ATU oficial × razão derivada da P10.2 (matrículas ÷ turmas) em Brasil.
 * E) infraestrutura: contagens do banco × levantamento independente da P10 (2021–2025) e invariantes de resposta.
 */
const out = process.argv[2]!; const years = process.argv[3] ? process.argv[3].split(',').map(Number) : Array.from({ length: 19 }, (_, i) => 2007 + i);
const pool = openPool(2); const cfg = storageConfig(); const q = async (sql: string, a: unknown[] = []) => (await pool.query(sql, a)).rows;
try {
  const inv = await readIndInventory(); const A: Array<Record<string, unknown>> = [];
  for (const y of years) {
    const files = await locateIndFiles(cfg, y, inv);
    const db: Record<string, Record<string, number>> = {};
    for (const [tbl, key] of [['exec_edu_ind_school', 'escolas'], ['exec_edu_ind_terr', 'terr']] as const) {
      const cols = IND_MEASURES.filter(m => key === 'escolas' ? m.level !== 'terr' : m.level !== 'school').map(m => m.code);
      const r = (await q(`SELECT ${cols.map(c => `count(${c})::bigint ${c}`).join(', ')} FROM civica_exec.${tbl} WHERE year = $1`, [y]))[0] as Record<string, string>;
      db[key] = Object.fromEntries(cols.map(c => [c, Number(r[c])]));
    }
    const fileCells: Record<string, Record<string, number>> = { escolas: {}, terr: {} };
    for (const f of files) {
      const ex = await extractIndFile(cfg, f); const rows = await readIndTsv(ex.tsv, f.level); const key = f.level === 'escolas' ? 'escolas' : 'terr';
      for (const row of rows) for (const [code, raw] of Object.entries(row.v)) { const c = parseCell(code, raw); if (c.st === 'num') fileCells[key]![code] = (fileCells[key]![code] ?? 0) + 1; }
    }
    for (const fam of ['ATU', 'HAD', 'DSU', 'AFD', 'IED', 'IRD', 'ICG'] as IndFamily[]) for (const key of ['escolas', 'terr'] as const) {
      const codes = IND_MEASURES.filter(m => m.family === fam && (key === 'escolas' ? m.level !== 'terr' : m.level !== 'school')).map(m => m.code);
      const fcells = codes.reduce((n, c) => n + (fileCells[key]![c] ?? 0), 0), dcells = codes.reduce((n, c) => n + (db[key]![c] ?? 0), 0);
      if (fcells || dcells) A.push({ year: y, family: fam, level: key, cellsFile: fcells, cellsDb: dcells, equal: fcells === dcells });
    }
  }
  const B: Array<Record<string, unknown>> = [];
  const dist = async (label: string, tbl: string, where: string, cols: string[]) => {
    const r = (await q(`SELECT year, count(*)::int n, count(*) FILTER (WHERE abs(s - 1000) > 3)::int bad FROM (SELECT year, ${cols.map(c => `coalesce(${c},0)`).join(' + ')} AS s, ${cols.map(c => `${c} IS NOT NULL`).join(' OR ')} AS has_any FROM civica_exec.${tbl} ${where}) x WHERE has_any GROUP BY year ORDER BY year`));
    for (const x of r) B.push({ check: label, year: x.year, rows: x.n, outsideTolerance: x.bad });
  };
  const grp = (p: string, st: string[], n: number) => st.map(s => Array.from({ length: n }, (_, i) => `${p}_${s}${i + 1}`));
  for (const cols of grp('afd', ['inf', 'fun', 'ai', 'af', 'med', 'eja_fun', 'eja_med'], 5)) { await dist(`${cols[0]!.slice(0, -1)} soma 100 (escola)`, 'exec_edu_ind_school', '', cols); await dist(`${cols[0]!.slice(0, -1)} soma 100 (território)`, 'exec_edu_ind_terr', '', cols); }
  for (const cols of grp('ied', ['fun', 'ai', 'af', 'med'], 6)) { await dist(`${cols[0]!.slice(0, -1)} soma 100 (escola)`, 'exec_edu_ind_school', '', cols); await dist(`${cols[0]!.slice(0, -1)} soma 100 (território)`, 'exec_edu_ind_terr', '', cols); }
  await dist('icg_n1..6 soma 100 (território)', 'exec_edu_ind_terr', '', ['icg_n1', 'icg_n2', 'icg_n3', 'icg_n4', 'icg_n5', 'icg_n6']);
  await dist('ird_b1..4 soma 100 (território)', 'exec_edu_ind_terr', '', ['ird_b1', 'ird_b2', 'ird_b3', 'ird_b4']);
  const C = await q(`SELECT s.year, count(*)::int escolas,
      count(*) FILTER (WHERE s.atu_ai IS NOT NULL AND coalesce(o.mat_fund_ai, 0) = 0)::int atu_ai_sem_matricula, count(*) FILTER (WHERE s.atu_af IS NOT NULL AND coalesce(o.mat_fund_af, 0) = 0)::int atu_af_sem_matricula,
      count(*) FILTER (WHERE s.atu_med IS NOT NULL AND coalesce(o.mat_med, 0) = 0)::int atu_med_sem_matricula, count(*) FILTER (WHERE s.atu_cre IS NOT NULL AND coalesce(o.mat_inf_cre, 0) = 0)::int atu_cre_sem_matricula,
      count(*) FILTER (WHERE s.atu_pre IS NOT NULL AND coalesce(o.mat_inf_pre, 0) = 0)::int atu_pre_sem_matricula, count(*) FILTER (WHERE o.inep IS NULL)::int sem_oferta
    FROM civica_exec.exec_edu_ind_school s LEFT JOIN civica_exec.exec_edu_offer_year o ON o.inep = s.inep AND o.year = s.year GROUP BY s.year ORDER BY s.year`);
  const D = await q(`SELECT t.year, t.atu_inf::int atu_inf10, t.atu_fun::int atu_fun10, t.atu_med::int atu_med10,
      round(a.mi::numeric / nullif(a.ti, 0), 1) deriv_inf, round(a.mf::numeric / nullif(a.tf, 0), 1) deriv_fun, round(a.mm::numeric / nullif(a.tm, 0), 1) deriv_med
    FROM civica_exec.exec_edu_ind_terr t JOIN (SELECT year, sum(coalesce(mat_inf_cre,0) + coalesce(mat_inf_pre,0)) mi, sum(coalesce(tur_inf_cre,0) + coalesce(tur_inf_pre,0)) ti, sum(coalesce(mat_fund_ai,0) + coalesce(mat_fund_af,0)) mf, sum(coalesce(tur_fund_ai,0) + coalesce(tur_fund_af,0)) tf, sum(coalesce(mat_med,0)) mm, sum(coalesce(tur_med,0)) tm FROM civica_exec.exec_edu_offer_agg GROUP BY year) a ON a.year = t.year
    WHERE t.entity_id = 76 AND t.dep = 0 AND t.loc = 0 ORDER BY t.year`);
  const E = await q(`SELECT year, sum(schools)::int escolas, sum(internet_t)::int internet_sim, sum(internet_f)::int internet_nao, sum(biblioteca_t)::int biblioteca_sim, sum(biblioteca_f)::int biblioteca_nao, sum(lab_informatica_t)::int labinf_sim, sum(lab_informatica_f)::int labinf_nao,
      sum(quadra_t)::int quadra_sim, sum(quadra_f)::int quadra_nao, sum(agua_rede_t)::int agua_sim, sum(agua_rede_f)::int agua_nao, sum(esgoto_rede_t)::int esgoto_sim, sum(esgoto_rede_f)::int esgoto_nao FROM civica_exec.exec_edu_infra_agg GROUP BY year ORDER BY year`);
  const F = await q(`SELECT year, count(*) FILTER (WHERE agua_inexistente AND agua_rede)::int agua_inexistente_e_rede, count(*) FILTER (WHERE energia_inexistente AND energia_rede)::int energia_inexistente_e_rede,
      count(*) FILTER (WHERE esgoto_inexistente AND esgoto_rede)::int esgoto_inexistente_e_rede, count(*) FILTER (WHERE NOT internet AND banda_larga)::int banda_larga_sem_internet, count(*) FILTER (WHERE internet IS NOT NULL AND NOT internet AND internet_alunos)::int internet_alunos_sem_internet,
      count(*) FILTER (WHERE biblioteca AND biblioteca_ou_leitura IS NOT NULL AND NOT biblioteca_ou_leitura)::int biblioteca_sem_biblioteca_ou_leitura FROM civica_exec.exec_edu_infra_year GROUP BY year ORDER BY year`);
  await writeFile(out, JSON.stringify({ at: new Date().toISOString(), A_cellsFileVsDb: A, B_sumTo100: B, C_atuVsOffer: C, D_atuVsDerived: D, E_infraTotals: E, F_infraInvariants: F }, null, 1));
  const badA = A.filter(x => !x.equal).length; console.log(JSON.stringify({ cellChecks: A.length, cellMismatches: badA, sumChecks: B.length, sumViolations: B.reduce((n, x) => n + Number(x.outsideTolerance), 0) }));
} finally { await pool.end(); }
