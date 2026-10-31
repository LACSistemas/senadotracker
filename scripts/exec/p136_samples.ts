import {openPool} from './db.ts';
const p=openPool(1);
const qs=[
['missingMunicipalities','with allm as (select distinct ibge7::int ibge7 from civica_exec.exec_work_c_location where ibge7 is not null), firstm as (select distinct first_ibge7 ibge7 from civica_exec.exec_work_project_overview_v where first_ibge7 is not null) select a.ibge7 from allm a left join firstm f using(ibge7) where f.ibge7 is null order by a.ibge7'],
['physicalSamples','select project_id,count(*)::int facts,count(*) filter(where percent is not null)::int percent_rows,count(*) filter(where percent>0)::int positive_rows,count(*) filter(where percent=100)::int full_rows,max(percent) max_percent from civica_exec.exec_work_c_physical group by project_id order by facts desc,project_id limit 10'],
['contractSamples','select project_id,count(*)::int n from civica_exec.exec_work_c_contract group by project_id order by n desc,project_id limit 5'],
['commitmentSamples','select project_id,count(*)::int n,sum(paid)::numeric paid from civica_exec.exec_work_c_commitment group by project_id order by n desc,project_id limit 5'],
['multi','select project_id,count(distinct ibge7)::int municipalities from civica_exec.exec_work_c_location where ibge7 is not null group by project_id having count(distinct ibge7)>1 order by municipalities desc,project_id limit 5'],
['historySamples','select project_id,count(*)::int n from civica_exec.exec_work_c_history group by project_id order by n desc,project_id limit 5'],
['vitoria','select m.entity_id,m.name,m.uf_code from civica_exec.exec_entity m where m.kind=4 and m.ibge7=3205309'],
['serra','select m.entity_id,m.name,m.uf_code from civica_exec.exec_entity m where m.kind=4 and m.ibge7=3205001'],
['sp','select m.entity_id,m.name,m.uf_code from civica_exec.exec_entity m where m.kind=4 and m.ibge7=3550308'],
['rj','select m.entity_id,m.name,m.uf_code from civica_exec.exec_entity m where m.kind=4 and m.ibge7=3304557']];
for(const [n,s] of qs) console.log(n,(await p.query(s)).rows);
await p.end();
