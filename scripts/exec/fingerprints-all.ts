import { writeFile } from 'node:fs/promises';
import { openPool } from './db.ts';

/**
 * Fingerprints de TODAS as ondas (Saúde, P9.1–P9.6, território, legislativo) para provar ausência de regressão por evidência persistida (somente leitura).
 *   npx tsx scripts/exec/fingerprints-all.ts <saida.json> [--skip-fin]
 * Valores: md5 ordenado (mesma fórmula dos G0 anteriores onde existe) + contagens. Tabelas grandes usam soma de hashtext por linha (independe da ordem física).
 * `--skip-fin` omite o que o PNCP (P9.5) ainda altera (exec_fin_contract e a faixa 7000 de indicadores) quando a coleta/publicação está em curso.
 */
const out = process.argv[2]; const skipFin = process.argv.includes('--skip-fin');
const pool = openPool(2);
const BANDS: Array<[string, number, number]> = [['saude', 1, 999], ['p91_seguranca', 3001, 3299], ['p92_transito', 4000, 4999], ['p93_efetivos', 5001, 5399], ['p94_prisional', 6000, 6999], ['p95_financas', 7000, 7999], ['p96_criminalidade', 8000, 8999]];
const TABLE_SUMS: Array<[string, string]> = [
  ['exec_pri_fact', 'exec_pri_fact'], ['exec_pri_obs', 'exec_pri_obs'], ['exec_pri_unit', 'exec_pri_unit'], ['exec_tra_cov', 'exec_tra_cov'], ['exec_tra_frota_mun_mes', 'exec_tra_frota_mun_mes'], ['exec_tra_infr_uf_mes', 'exec_tra_infr_uf_mes'],
  ['exec_fin_fact', 'exec_fin_fact'], ['exec_fin_exec', 'exec_fin_exec'], ['exec_fin_dot', 'exec_fin_dot'], ['exec_fin_org', 'exec_fin_org'], ['exec_fin_transfer', 'exec_fin_transfer'], ['exec_fin_cov', 'exec_fin_cov'],
  ['exec_sau_cnes_estab', 'exec_sau_cnes_estab'], ['exec_sau_sih_mun_mes', 'exec_sau_sih_mun_mes'], ['exec_crime_indicator', 'exec_crime_indicator'], ['exec_territory_population', 'exec_territory_population'],
];
try {
  const one = async (sql: string) => (await pool.query(sql)).rows[0];
  const res: Record<string, unknown> = { at: new Date().toISOString(), skipFin };
  const values: Record<string, unknown> = {}; const defs: Record<string, unknown> = {};
  for (const [name, a, b] of BANDS) {
    if (skipFin && name === 'p95_financas') continue;
    values[name] = await one(`SELECT md5(string_agg(indicator_id || ':' || entity_id || ':' || period_start || ':' || coalesce(value::text, 'n') || ':' || flags, ',' ORDER BY indicator_id, entity_id, period_start)) AS h, count(*)::int AS n FROM civica_exec.exec_ind_value WHERE indicator_id BETWEEN ${a} AND ${b}`);
    defs[name] = await one(`SELECT md5(string_agg(t::text, ',' ORDER BY indicator_id)) AS h, count(*)::int AS n FROM civica_exec.exec_ind_def t WHERE indicator_id BETWEEN ${a} AND ${b}`);
  }
  res.indicatorValues = values; res.indicatorDefs = defs;
  const tables: Record<string, unknown> = {};
  for (const [name, t] of TABLE_SUMS) { if (skipFin && name.startsWith('exec_fin_')) continue; tables[name] = await one(`SELECT count(*)::bigint::text AS n, coalesce(sum(hashtext(x::text)::bigint), 0)::text AS s FROM civica_exec.${t} x`); }
  res.tables = tables;
  res.segCovBelow8000 = await one(`SELECT md5(string_agg(t::text, ',' ORDER BY uf, indicator_id, competence)) AS h, count(*)::int AS n FROM civica_exec.exec_seg_cov t WHERE indicator_id < 8000`);
  res.entities = await one(`SELECT md5(string_agg(entity_id || ':' || kind || ':' || ibge7 || ':' || name, ',' ORDER BY entity_id)) AS h, count(*)::int AS n FROM civica_exec.exec_entity`);
  res.publicationsBelow42 = await one(`SELECT md5(string_agg(dataset_id || ':' || uf || ':' || competence || ':' || run_id || ':' || state, ',' ORDER BY dataset_id, uf, competence)) AS h, count(*)::int AS n FROM civica_exec.exec_publication WHERE dataset_id < 42`);
  res.publicationsCrime = await one(`SELECT md5(string_agg(dataset_id || ':' || uf || ':' || competence || ':' || run_id || ':' || state, ',' ORDER BY dataset_id, uf, competence)) AS h, count(*)::int AS n FROM civica_exec.exec_publication WHERE dataset_id >= 42`);
  res.migrations = (await pool.query(`SELECT version, name FROM civica_exec.schema_migrations ORDER BY version`)).rows;
  res.legislativeSchema = await one(`SELECT count(*)::int AS tables, coalesce(sum(n_live_tup), 0)::bigint::text AS live_rows FROM pg_stat_user_tables WHERE schemaname = 'civica'`);
  res.sharedContracts = await one(`SELECT md5(string_agg(table_name || '.' || column_name || ':' || data_type, ',' ORDER BY table_name, ordinal_position)) AS h FROM information_schema.columns WHERE table_schema = 'civica_exec' AND table_name IN ('exec_ind_def', 'exec_ind_value', 'exec_ind_latest', 'exec_entity', 'exec_publication', 'exec_ingestion_run', 'exec_change_log', 'exec_raw_manifest', 'exec_seg_cov', 'exec_crime_indicator')`);
  const json = JSON.stringify(res, null, 1); if (out) await writeFile(out, json); else console.log(json);
} finally { await pool.end(); }
