import {openDatabase} from '../packages/db/src/index.ts';
import {publishedSupplierExplorer} from '../packages/db/src/supplier-market.ts';
import pg from 'pg';
const s=openDatabase('artifacts/postgres-parity/senadotracker-parity.sqlite',true);
const p=new pg.Pool({host:'localhost',port:5432,database:'civica_postgres_lab',user:'projetoeleitor_user',password:'projetoeleitorsenha'});
const sqlite:any[]=[]; const pgRows:any[]=[];
for(let off=0;off<19491;off+=100){sqlite.push(...publishedSupplierExplorer(s,{year:2026,page:Math.floor(off/100)+1,pageSize:100}).items.map((x:any)=>({id:x.id,name:x.name,p:x.parliamentary?.netCents??null,inst:x.institutional?.paidCents??null}))); pgRows.push(...(await p.query(`select supplier_id id,name,public_cents from civica_finance_poc.supplier_explorer_rollup where year=2026 order by public_cents desc nulls last,lower(name) collate "C",supplier_id limit 100 offset $1`,[off])).rows)}
const i=sqlite.findIndex((x,j)=>x.id!==pgRows[j].id); console.log(JSON.stringify({i,sqlite:sqlite.slice(Math.max(0,i-3),i+5),pg:pgRows.slice(Math.max(0,i-3),i+5)},null,2));
await p.end();s.close();
