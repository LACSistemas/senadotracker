import {openPool} from './db.ts';
const p=openPool(1);
for(const [n,s] of Object.entries({
domains:'select domain,count(*)::int definitions from civica_exec.exec_ind_def group by domain order by domain',
d5:'select count(*)::int definitions from civica_exec.exec_ind_def where domain=5',
d5values:'select d.indicator_id,d.code,d.label,d.unit,d.grain,d.ranking_allowed,d.aggregation_allowed,count(v.*)::int values,count(distinct v.entity_id)::int entities,min(v.period_start) min_period,max(v.period_start) max_period from civica_exec.exec_ind_def d left join civica_exec.exec_ind_value v using(indicator_id) where d.domain=5 group by d.indicator_id,d.code,d.label,d.unit,d.grain,d.ranking_allowed,d.aggregation_allowed order by d.indicator_id',
activeD5:'select count(*)::int definitions from civica_exec.exec_ind_latest l join civica_exec.exec_ind_def d using(indicator_id) where d.domain=5',
allLatest:'select count(*)::int rows,count(distinct entity_id)::int entities from civica_exec.exec_ind_latest l join civica_exec.exec_ind_def d using(indicator_id) where d.domain=5',
statuses:'select status,count(*)::int rows from civica_exec.exec_ind_value v join civica_exec.exec_ind_def d using(indicator_id) where d.domain=5 group by status order by status'
})){console.log(n,(await p.query(s)).rows)}
await p.end();

