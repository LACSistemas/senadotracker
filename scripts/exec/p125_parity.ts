import { openPool } from './db.ts';

const p = openPool(2);
const queries = {
  changeLog: `select to_regclass('civica_exec.exec_change_log')::text rel`,
  changeLogCols: `select column_name,data_type from information_schema.columns where table_schema='civica_exec' and table_name='exec_change_log' order by ordinal_position`,
  rawManifest: `select file_id,source_url,rel_path,bytes,encode(sha256,'hex') sha256,competence,state from civica_exec.exec_raw_manifest order by file_id desc limit 10`,
  runStatuses: `select dataset_id,count(*) filter(where status=12)::int no_change,count(*) filter(where status=9)::int published,count(*) filter(where status=11)::int failed from civica_exec.exec_ingestion_run where dataset_id in(122,123) group by dataset_id order by dataset_id`,
  activeFailures: `select count(*)::int active_failed_publications from civica_exec.exec_publication where dataset_id in(122,123) and state=11`,
  regressionCounts: `select indicator_id,count(*)::int rows,count(distinct entity_id)::int entities from civica_exec.exec_ind_value where indicator_id in (9001,9002,9003,9004,9005,9006,9101,9102,9103,9104,9105,9106,9201,9202,9203,9301) group by indicator_id order by indicator_id`,
  raisBrasil: `select extract(year from v.period_start)::int yr,sum(v.value)::numeric total,count(*)::int rows from civica_exec.exec_ind_value v join civica_exec.exec_entity e using(entity_id) where v.indicator_id=9401 and e.kind=1 group by 1 order by 1`,
  raisUf: `select extract(year from v.period_start)::int yr,sum(v.value)::numeric total,count(*)::int rows from civica_exec.exec_ind_value v join civica_exec.exec_entity e using(entity_id) where v.indicator_id=9401 and e.kind=3 group by 1 order by 1`,
  raisMunicipal: `select extract(year from v.period_start)::int yr,sum(v.value)::numeric total,count(*)::int rows from civica_exec.exec_ind_value v join civica_exec.exec_entity e using(entity_id) where v.indicator_id=9401 and e.kind=4 group by 1 order by 1`,
  raisRem: `select extract(year from v.period_start)::int yr,sum(v.value)::numeric total,count(*)::int rows,min(v.value)::numeric min,max(v.value)::numeric max from civica_exec.exec_ind_value v where v.indicator_id=9402 group by 1 order by 1`,
  cagedBrasilStock: `select to_char(v.period_start,'YYYYMM') ym,v.value::numeric value from civica_exec.exec_ind_value v join civica_exec.exec_entity e using(entity_id) where v.indicator_id=9500 and e.kind=1 order by 1`,
  cagedUfStock: `select to_char(v.period_start,'YYYYMM') ym,sum(v.value)::numeric total,count(*)::int rows from civica_exec.exec_ind_value v join civica_exec.exec_entity e using(entity_id) where v.indicator_id=9500 and e.kind=3 group by 1 order by 1`,
  cagedMunicipalStock: `select to_char(v.period_start,'YYYYMM') ym,sum(v.value)::numeric total,count(*)::int rows from civica_exec.exec_ind_value v join civica_exec.exec_entity e using(entity_id) where v.indicator_id=9500 and e.kind=4 group by 1 order by 1`,
};
for (const [name, sql] of Object.entries(queries)) console.log(name, JSON.stringify((await p.query(sql)).rows));
for (const [name, sql] of Object.entries({
  municipalRaisLatest: `select e.entity_id,v.value from civica_exec.exec_ind_value v join civica_exec.exec_entity e using(entity_id) where v.indicator_id=9401 and v.period_start='2025-01-01' and e.kind=4 order by e.ibge7`,
  municipalCagedMonth: `select e.entity_id,a.value adm,d.value dis,b.value bal from civica_exec.exec_entity e join civica_exec.exec_ind_value a on a.entity_id=e.entity_id and a.indicator_id=9501 and a.period_start='2026-08-01' join civica_exec.exec_ind_value d on d.entity_id=e.entity_id and d.indicator_id=9502 and d.period_start=a.period_start join civica_exec.exec_ind_value b on b.entity_id=e.entity_id and b.indicator_id=9503 and b.period_start=a.period_start where e.kind=4 order by e.ibge7`,
} as const)) console.log('explain_'+name, JSON.stringify((await p.query(`explain (analyze, buffers, format json) ${sql}`)).rows));
await p.end();
