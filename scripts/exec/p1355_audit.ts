import {openPool} from './db.ts'; const p=openPool(1);
const qs=[
"select count(1)::int n from civica_exec.exec_work_c_project",
"select count(1)::int n from civica_exec.exec_work_c_location",
"select count(1)::int n from civica_exec.exec_work_c_contract",
"select count(1)::int n from civica_exec.exec_work_c_commitment",
"select count(1)::int n from civica_exec.exec_work_c_physical",
"select count(1)::int n from civica_exec.exec_work_c_history",
"select count(distinct project_id)::int n from civica_exec.exec_work_c_commitment",
"select count(distinct project_id)::int n from civica_exec.exec_work_c_physical",
"select count(distinct project_id)::int n from civica_exec.exec_work_c_contract",
"select count(distinct project_id)::int n from civica_exec.exec_work_c_location",
"select count(1)::int n from civica_exec.exec_work_c_location l join civica_exec.exec_work_c_project p using(project_id) where l.ibge7 is not null",
"select count(1)::int n from civica_exec.exec_work_c_project p left join civica_exec.exec_work_c_location l using(project_id) where l.project_id is null",
"select count(1)::int n from civica_exec.exec_work_c_project p join civica_exec.exec_work_c_location l using(project_id) group by p.project_id having count(1)>1",
"select count(1)::int n from civica_exec.exec_work_c_contract where contract_number is not null",
"select count(1)::int n from civica_exec.exec_work_c_contract where transparency_url ilike '%pncp%'",
"select count(1)::int n from civica_exec.exec_work_c_contract where contract_number in (select pncp_id from civica_exec.exec_fin_contract)",
"select count(1)::int n from civica_exec.exec_work_c_commitment where liquidation is not null or paid is not null",
"select count(1)::int n from civica_exec.exec_work_c_commitment where liquidation is not null and liquidation>0",
"select count(1)::int n from civica_exec.exec_work_c_commitment where paid is not null and paid>0",
"select count(distinct project_id)::int n from civica_exec.exec_work_c_commitment where paid is not null and paid>0",
"select count(distinct project_id)::int n from civica_exec.exec_work_c_commitment where liquidation is not null and liquidation>0",
"select count(distinct project_id)::int n from civica_exec.exec_work_c_project where situation_code in (5,6,7,8)"
]; for(const q of qs){try{console.log(q,(await p.query(q)).rows)}catch(e){console.log('ERR',q,String(e))}}
await p.end();
