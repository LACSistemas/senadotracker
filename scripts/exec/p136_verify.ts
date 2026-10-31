import {openPool} from './db.ts'; const p=openPool(1);
for(const [n,s] of Object.entries({
catalog:'select count(*)::int n,count(distinct source_family)::int families from civica_exec.exec_infra_editorial_catalog',
mun:'select count(distinct ibge7)::int municipalities,count(distinct project_id)::int projects,count(*)::int rows from civica_exec.exec_work_project_territory_overview_v',
classes:'select allocation_class,count(distinct project_id)::int projects,count(*)::int rows from civica_exec.exec_work_project_territory_overview_v group by allocation_class order by allocation_class',
coverage:'select count(*)::int indicators,sum(observation_count)::int observations from civica_exec.exec_infra_indicator_coverage_v',
latest:'select count(*)::int rows,count(distinct indicator_id)::int indicators,count(distinct entity_id)::int entities from civica_exec.exec_ind_latest l join civica_exec.exec_ind_def d using(indicator_id) where d.domain=5',
size:'select pg_database_size(current_database())::bigint bytes'
})){console.log(n,(await p.query(s)).rows)}
await p.end();
