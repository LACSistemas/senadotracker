import { openPool } from './db.ts';

const p = openPool(3);
const q = async (sql: string, params: unknown[] = []) => (await p.query(sql, params)).rows;
const out: any = {};
out.schemaTables = await q(`select table_name, pg_total_relation_size(format('%I.%I','civica_exec',table_name))::bigint as bytes from information_schema.tables where table_schema='civica_exec' and table_name in ('exec_edu_infra_agg','exec_edu_infra_cov','exec_edu_infra_year','exec_tra_cov','exec_tra_frota_mun_mes','exec_tra_infr_uf_mes') order by table_name`);
out.rowCounts = [];
for (const t of out.schemaTables) out.rowCounts.push({ table: t.table_name, rows: (await q(`select count(*)::int as n from civica_exec.${t.table_name}`))[0]?.n ?? 0 });
out.sourceColumns = await q(`select table_name,column_name,data_type from information_schema.columns where table_schema='civica_exec' and table_name in ('exec_edu_infra_agg','exec_edu_infra_cov','exec_edu_infra_year','exec_tra_cov','exec_tra_frota_mun_mes','exec_tra_infr_uf_mes') order by table_name,ordinal_position`);
out.schemaMigrations = await q(`select * from civica_exec.schema_migrations order by 1 desc limit 20`);
out.referenceRows = await q(`select count(*)::int as rows, min(code)::text as min_code, max(code)::text as max_code from civica_exec.exec_ref_code`);
out.dbSize = await q(`select current_database() as database, pg_database_size(current_database())::bigint as bytes`);
console.log(JSON.stringify(out, null, 2));
await p.end();
