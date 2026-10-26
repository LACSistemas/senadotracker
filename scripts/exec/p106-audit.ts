import { openPool } from './db.ts';
import { statfs } from 'node:fs/promises';
const pool = openPool(2);
try {
  const q = async (sql: string, args: unknown[] = []) => (await pool.query(sql, args)).rows;
  const free = async (p: string) => { try { const s = await statfs(p); return Number(s.bavail) * Number(s.bsize); } catch (e) { return String(e); } };
  console.log(JSON.stringify({
    database: await q('select current_database() db,current_user usr,pg_database_size(current_database())::bigint bytes'),
    actions: await q("select exercicio,acao,sum(emp)::bigint emp,sum(liq)::bigint liq,sum(pago)::bigint pago,count(*)::int rows from civica_exec.exec_fin_exec where acao in ('0515','00PI','0969','00SB') group by 1,2 order by 1,2"),
    educationActions: await q("select exercicio,acao,sum(emp)::bigint emp,sum(liq)::bigint liq,sum(pago)::bigint pago,count(*)::int rows from civica_exec.exec_fin_exec where funcao=12 group by 1,2 order by 1,2 limit 200"),
    columns: await q("select column_name,data_type from information_schema.columns where table_schema='civica_exec' and table_name='exec_fin_exec' order by ordinal_position"),
    siope: await q("select r.parser_version,count(*)::int runs,sum(r.rows_out)::bigint rows_out from civica_exec.exec_ingestion_run r where r.dataset_id=108 group by 1 order by 1"),
    publications: await q("select count(*)::int publications,min(competence)::int first_comp,max(competence)::int last_comp from civica_exec.exec_publication where dataset_id=108"),
    p106Publications: await q("select dataset_id,count(*)::int publications,min(competence)::int first_comp,max(competence)::int last_comp from civica_exec.exec_publication where dataset_id in (112,113) group by 1 order by 1"),
    p106Facts: await q("select source_dataset,program_code,financial_stage,count(*)::int rows,sum(amount_cents)::bigint amount_cents,count(distinct school_inep)::int schools from civica_exec.exec_edu_program_fact group by 1,2,3 order by 1,2,3"),
    disk: { c: await free('C:/'), d: await free('D:/') },
  }, null, 2));
} finally { await pool.end(); }
