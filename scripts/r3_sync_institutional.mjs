import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';
const sqlite=new DatabaseSync('data/senadotracker.sqlite',{readOnly:true});
const revision=sqlite.prepare('select revision_id from active_supplier_aggregate_revision where singleton=1').get().revision_id;
const rows=sqlite.prepare('select supplier_id,year,institution,institutional_paid_scaled,institutional_contracts,institutional_commitments from supplier_global_house_yearly where revision_id=? and institutional_paid_scaled is not null').all(revision);
const client=new pg.Client({host:'localhost',port:5432,database:'projetoeleitor_db',user:'projetoeleitor_user',password:'projetoeleitorsenha'}); await client.connect(); await client.query('begin'); let updated=0;
for(const row of rows){const r=await client.query(`update civica_finance_poc.supplier_global_house_yearly set institutional_paid_scaled=$1,institutional_contracts=$2,institutional_commitments=$3 where revision_id=$4 and supplier_id=$5 and year=$6 and institution=$7`,[row.institutional_paid_scaled,row.institutional_contracts,row.institutional_commitments,revision,row.supplier_id,row.year,row.institution]);updated+=r.rowCount??0;}
await client.query('commit'); console.log(JSON.stringify({revision,sourceRows:rows.length,updated})); await client.end(); sqlite.close();
