import { writeFile } from 'node:fs/promises';
import { getEducationNationalOffer } from '../../packages/db/src/exec/index.ts';
import { openPool } from './db.ts';

/** Números do relatório da P10.2 (perguntas Q1–Q16), somente leitura. EXEC_DATABASE_URL aponta para banco de teste quando definido. npx tsx scripts/exec/educacao-oferta-numeros.ts <saida.json> */
const pool = openPool(2);
try {
  const one = async (sql: string, a: unknown[] = []) => (await pool.query(sql, a)).rows;
  const nat = (await getEducationNationalOffer(pool, { year: 2025 }))!;
  const stageDep = await one(`SELECT dep, sum(mat_inf_cre + mat_inf_pre)::bigint inf, sum(mat_fund_ai + mat_fund_af)::bigint fund, sum(mat_med)::bigint med, sum(mat_eja_fund + mat_eja_med)::bigint eja,
    sum(mat_bas - mat_inf_cre - mat_inf_pre - mat_fund_ai - mat_fund_af - mat_med - mat_eja_fund - mat_eja_med)::bigint prof_ni, sum(mat_bas)::bigint bas,
    sum(tur_inf_cre + tur_inf_pre)::bigint t_inf, sum(tur_fund_ai + tur_fund_af)::bigint t_fund, sum(tur_med)::bigint t_med, sum(tur_eja)::bigint t_eja, sum(tur_bas)::bigint t_bas
    FROM civica_exec.exec_edu_offer_agg WHERE year = 2025 GROUP BY dep ORDER BY dep`);
  const stageLoc = await one(`SELECT loc, sum(mat_bas)::bigint bas, sum(tur_bas)::bigint t_bas, sum(mat_inf_cre + mat_inf_pre)::bigint inf, sum(mat_fund_ai + mat_fund_af)::bigint fund, sum(mat_med)::bigint med FROM civica_exec.exec_edu_offer_agg WHERE year = 2025 GROUP BY loc ORDER BY loc`);
  const series = await one(`SELECT year, sum(mat_bas)::bigint mat, sum(tur_bas)::bigint tur, sum(schools)::bigint escolas, sum(mat_inf_cre + mat_inf_pre)::bigint inf, sum(mat_fund_ai + mat_fund_af)::bigint fund, sum(mat_med)::bigint med, sum(mat_eja_fund + mat_eja_med)::bigint eja, sum(mat_prof)::bigint prof_total,
    sum(mat_bas - mat_inf_cre - mat_inf_pre - mat_fund_ai - mat_fund_af - mat_med - mat_eja_fund - mat_eja_med)::bigint prof_ni, sum(mat_esp_cc + mat_esp_ce)::bigint esp, sum(mat_int_fund)::bigint int_fund, sum(tur_inf_cre + tur_inf_pre)::bigint t_inf, sum(tur_fund_ai + tur_fund_af)::bigint t_fund, sum(tur_med)::bigint t_med, sum(tur_eja)::bigint t_eja
    FROM civica_exec.exec_edu_offer_agg GROUP BY year ORDER BY year`);
  const schools = (await one(`SELECT (SELECT count(*) FROM civica_exec.exec_edu_school)::int cadastro, (SELECT count(DISTINCT inep) FROM civica_exec.exec_edu_offer_year)::int com_oferta_alguma_edicao,
    (SELECT count(*) FROM civica_exec.exec_edu_offer_year)::int linhas_oferta, (SELECT count(*) FROM civica_exec.exec_edu_school_year)::int linhas_cadastro,
    (SELECT count(*) FROM (SELECT inep FROM civica_exec.exec_edu_offer_year GROUP BY inep HAVING count(*) = 19) x)::int oferta_nas_19,
    (SELECT count(*) FROM civica_exec.exec_edu_offer_year WHERE year = 2025 AND mat_bas > 0 AND tur_bas > 0)::int mat_e_tur_2025, (SELECT count(*) FROM civica_exec.exec_edu_offer_year WHERE year = 2025 AND mat_bas IS NULL)::int so_turma_2025,
    (SELECT count(*) FROM civica_exec.exec_edu_school_year WHERE year = 2025)::int cadastro_2025, (SELECT count(*) FROM civica_exec.exec_edu_offer_year WHERE year = 2025)::int oferta_2025`))[0];
  const bit0 = (await one(`SELECT count(*)::int fatias, sum(CASE WHEN o.with_mat = c.with_mat THEN 1 ELSE 0 END)::int iguais FROM civica_exec.exec_edu_offer_cov o JOIN civica_exec.exec_edu_cov c USING (year, uf)`))[0];
  const rej = (await one(`SELECT sum(rows_in)::int rows_in, sum(valid)::int valid, sum(rejected)::int rejected FROM civica_exec.exec_edu_offer_cov`))[0];
  const rowsByYear = await one(`SELECT year, sum(rows_in)::int rows_in, sum(valid)::int valid, sum(rejected)::int rejected, sum(with_mat)::int with_mat, sum(with_tur)::int with_tur, sum(only_tur)::int only_tur FROM civica_exec.exec_edu_offer_cov GROUP BY year ORDER BY year`);
  const nulls = await one(`SELECT year, count(mat_noturno)::int noturno, count(mat_ead)::int ead, count(tur_int_fund)::int tur_int, count(mat_int_fund)::int mat_int FROM civica_exec.exec_edu_offer_year GROUP BY year ORDER BY year`);
  const res = { at: new Date().toISOString(), nacional2025: { totals: nat.totals, stages: nat.stages, byDependency: nat.byDependency, byLocation: nat.byLocation, special: nat.special }, stageDep, stageLoc, series, schools, bit0, rej, rowsByYear, nulls };
  await writeFile(process.argv[2]!, JSON.stringify(res, null, 1)); console.log(JSON.stringify({ totals: nat.totals, schools, bit0, rej }));
} finally { await pool.end(); }
