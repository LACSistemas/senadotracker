import {openPool} from './db.ts';

const queries: Record<string,string> = {
  project_overview_by_id: `select * from civica_exec.exec_work_project_overview_v where project_id=$1`,
  project_contracts: `select project_id,contract_id,contract_number,amount_global,amount_accumulated from civica_exec.exec_work_c_contract where project_id=$1 order by contract_id`,
  project_commitments: `select project_id,commitment_key,nr_empenho,emission_date,value_cents,liquidation,paid from civica_exec.exec_work_c_commitment where project_id=$1 order by emission_date,commitment_key`,
  project_physical: `select project_id,execution_id,percent,start_date,end_date,updated_at from civica_exec.exec_work_c_physical where project_id=$1 order by updated_at desc`,
  project_history: `select project_id,history_id,status_code,status_date from civica_exec.exec_work_c_history where project_id=$1 order by status_date desc`,
  municipal_summary: `select first_ibge7,count(*)::int projects,sum(coalesce(planned_amount,0))::numeric planned_amount,sum(coalesce(committed_cents,0))::numeric committed_cents,sum(coalesce(paid,0))::numeric paid from civica_exec.exec_work_project_overview_v where first_ibge7 is not null group by first_ibge7 order by projects desc`,
  state_summary: `select uf,count(*)::int projects,sum(coalesce(planned_amount,0))::numeric planned_amount,sum(coalesce(committed_cents,0))::numeric committed_cents,sum(coalesce(paid,0))::numeric paid from civica_exec.exec_work_project_overview_v group by uf order by projects desc`,
  verified_links: `select target_system,target_entity_type,count(*)::int links from civica_exec.exec_work_verified_links_v group by target_system,target_entity_type`,
  siconfi_context: `select funcao,count(*)::int rows,count(distinct entity_id)::int entities from civica_exec.exec_fin_exec where funcao in (15,16,17,25,26) group by funcao order by funcao`,
};

async function main(){
  const pool=openPool(2);
  const db=(await pool.query('select current_database() database')).rows[0];
  if(db.database!=='projetoeleitor_db') throw new Error('DATABASE_GUARD');
  const sample=(await pool.query('select project_id from civica_exec.exec_work_c_project order by project_id limit 1')).rows[0].project_id;
  const out:any={database:db.database,sampleProjectId:sample,queries:{}};
  for(const [name,sql] of Object.entries(queries)){
    const params=name.startsWith('project_')?[sample]:[];
    const r=await pool.query(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ${sql}`,params);
    const p=r.rows[0]['QUERY PLAN'][0];
    out.queries[name]={executionTimeMs:p['Execution Time'],planningTimeMs:p['Planning Time'],plan:p.Plan?.['Node Type'],rows:p.Plan?.['Actual Rows']};
  }
  console.log(JSON.stringify(out,null,2));
  await pool.end();
}
main().catch(e=>{console.error(e);process.exit(1)});
