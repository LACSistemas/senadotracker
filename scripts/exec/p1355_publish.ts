import {openPool} from './db.ts';
import {applyExecMigrations} from '../../packages/db/src/exec/migrations.ts';
import {publishSlice} from '../../packages/db/src/exec/publication.ts';

async function main(){
 const pool=openPool(2);
 const db=(await pool.query('select current_database() database, pg_database_size(current_database())::bigint size')).rows[0];
 if(db.database!=='projetoeleitor_db') throw new Error('DATABASE_GUARD');
 const before=Number(db.size); console.log('DB_BEFORE',before);
 await applyExecMigrations(pool);
 const counts=(await pool.query(`select
  (select count(1)::int from civica_exec.exec_work_c_project) projects,
  (select count(1)::int from civica_exec.exec_work_c_contract) contracts,
  (select count(1)::int from civica_exec.exec_work_c_commitment) commitments,
  (select count(1)::int from civica_exec.exec_work_c_physical) physical,
  (select count(distinct project_id)::int from civica_exec.exec_work_c_commitment where paid>0) projects_paid,
  (select count(distinct project_id)::int from civica_exec.exec_work_c_commitment where liquidation>0) projects_liquidated,
  (select count(distinct project_id)::int from civica_exec.exec_work_c_commitment) projects_commitments,
  (select count(distinct project_id)::int from civica_exec.exec_work_c_physical) projects_physical,
  (select count(1)::int from civica_exec.exec_fin_contract) pncp_contracts,
  (select count(1)::int from civica_exec.exec_work_c_contract where transparency_url ilike '%pncp%') work_external_ids,
  (select count(1)::int from civica_exec.exec_work_c_contract wc where exists (select 1 from civica_exec.exec_fin_contract fc where fc.supplier=wc.supplier_cnpj and fc.year=extract(year from wc.signed))) candidate_supplier_year,
  (select count(1)::int from civica_exec.exec_work_c_contract wc where exists (select 1 from civica_exec.exec_fin_contract fc where fc.pncp_id=wc.contract_number)) exact_id_matches`)).rows[0];
 const sourceHash=(await pool.query(`select md5(concat_ws('|',${Object.keys(counts).map(k=>`'${k}='||${Number(counts[k])}`).join(',')},coalesce((select max(revision_id)::text from civica_exec.exec_work_c_project),''))) h`)).rows[0].h;
 const result=await publishSlice(pool,{datasetId:180,uf:0,competence:202610,sourceHash,parserVersion:'p1355-v1',bootstrap:true,contiguity:false,tables:[],inputs:{source:'existing Obrasgov/PNCP/finance tables'},quality:{...counts,verifiedEdges:0,unverifiedLinksPublished:0},derive:async(c,run)=>{
   await c.query(`insert into civica_exec.exec_work_integration_snapshot(source_hash,status,finished_at,source_projects,source_contracts,source_commitments,source_physical,edge_rows,verified_pncp_links,verified_payment_links,verified_asset_links,quality) values(decode($1,'hex'),'PUBLISHED',now(),$2,$3,$4,$5,0,0,$6,0,$7::jsonb) on conflict(source_hash) do update set finished_at=now(),status='PUBLISHED'`,[sourceHash,counts.projects,counts.contracts,counts.commitments,counts.physical,counts.projects_paid,JSON.stringify(counts)]);
 }});
 console.log('PUBLISH',result);
 const after=Number((await pool.query('select pg_database_size(current_database())::bigint size')).rows[0].size);
 console.log('COUNTS',counts); console.log('DB_AFTER',after,'GROWTH',after-before);
 await pool.end();
}
main().catch(e=>{console.error(e);process.exit(1)});
