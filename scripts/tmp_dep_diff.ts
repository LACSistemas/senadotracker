import {DatabaseSync} from 'node:sqlite'; import pg from 'pg';
const s=new DatabaseSync('data/senadotracker.sqlite',{readOnly:true});
const sid='sup_31f934746e5c251a09b7cdc8ceddb95f';
const a=s.prepare("select client_source,client_external_id,net_value_scaled from supplier_parliamentary_clients where supplier_id=? and institution='CAMARA' and year=2026 order by client_source,client_external_id").all(sid);
const p=new pg.Pool({host:'localhost',port:5432,database:'civica_postgres_lab',user:'projetoeleitor_user',password:'projetoeleitorsenha'});
const b=(await p.query("select client_source,client_external_id,net_value_scaled from civica_finance_poc.supplier_parliamentary_clients where supplier_id=$1 and institution='CAMARA' and year=2026 order by client_source,client_external_id",[sid])).rows;
const k=(x:any)=>`${x.client_source}:${x.client_external_id}:${x.net_value_scaled}`; const A=new Set(a.map(k)),B=new Set(b.map(k)); console.log(JSON.stringify({sid,sqlite:a.length,postgres:b.length,sqliteOnly:[...A].filter(x=>!B.has(x)).slice(0,20),pgOnly:[...B].filter(x=>!A.has(x)).slice(0,20)})); await p.end();
