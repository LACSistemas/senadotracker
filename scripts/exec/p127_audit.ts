import { openPool } from './db.ts';

const p = openPool(4);
const q = async (sql: string, params: unknown[] = []) => (await p.query(sql, params)).rows;
const out: any = { database: (await q('select current_database()'))[0].current_database };
out.size = (await q("select pg_database_size(current_database())::bigint as bytes"))[0].bytes.toString();
out.counts = await q(`select v.indicator_id, count(*)::int as rows, count(*) filter (where v.value is not null)::int as valid, count(*) filter (where v.value is null)::int as nulls
  from civica_exec.exec_ind_value v where v.indicator_id between 9001 and 9605 group by v.indicator_id order by v.indicator_id`);
out.publications = await q(`select p.dataset_id, count(*)::int as slices, count(*) filter (where p.state=1)::int as active
  from civica_exec.exec_publication p where p.dataset_id between 120 and 124 group by p.dataset_id order by p.dataset_id`);
out.runs = await q(`select r.dataset_id, r.status, count(*)::int as n from civica_exec.exec_ingestion_run r where r.dataset_id between 120 and 124 group by r.dataset_id,r.status order by r.dataset_id,r.status`);
out.activePublicationStatusIssues = await q(`select count(*)::int as n from civica_exec.exec_publication p left join civica_exec.exec_ingestion_run r on r.run_id=p.run_id where p.dataset_id between 120 and 124 and p.state=1 and coalesce(r.status,-1)<>9`);
out.explainLatest = await q(`explain (analyze, buffers, format json) select l.indicator_id,l.entity_id,l.period_start,l.value,l.numerator,l.denominator
 from civica_exec.exec_ind_latest l join civica_exec.exec_ingestion_run r on r.run_id=l.run_id join civica_exec.exec_publication p on p.run_id=l.run_id and p.state=1
 where l.entity_id=(select entity_id from civica_exec.exec_entity where ibge7=3205309 limit 1)`);
out.explainCoverage = await q(`explain (analyze, buffers, format json) select l.indicator_id,count(*) from civica_exec.exec_ind_latest l join civica_exec.exec_ingestion_run r on r.run_id=l.run_id join civica_exec.exec_publication p on p.run_id=l.run_id and p.state=1 where r.dataset_id between 120 and 124 group by l.indicator_id`);
out.explainMUNICComparator = await q(`explain (analyze, buffers, format json) select sum(case when v.value is not null and v.denominator>0 then v.numerator else 0 end)::numeric, sum(case when v.value is not null and v.denominator>0 then v.denominator else 0 end)::numeric from civica_exec.exec_ind_value v join civica_exec.exec_ingestion_run r on r.run_id=v.run_id join civica_exec.exec_publication p on p.run_id=v.run_id and p.state=1 join civica_exec.exec_entity e using(entity_id) where v.indicator_id=9601 and v.period_start=(select max(period_start) from civica_exec.exec_ind_value where indicator_id=9601) and e.kind=4 and e.uf_code=32`);
console.log(JSON.stringify(out,null,2));
await p.end();
