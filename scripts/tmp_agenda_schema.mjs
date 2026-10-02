import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';
const db=new DatabaseSync('data/senadotracker.sqlite');
for(const t of ['meetings','agenda_items']){console.log('SQLITE',t,db.prepare(`PRAGMA table_info(${t})`).all())}
const pool=new pg.Pool({host:'localhost',port:5432,database:'projetoeleitor_db',user:'projetoeleitor_user',password:'projetoeleitorsenha'});
for(const s of ['civica_committees_poc']){const r=await pool.query(`select table_name,column_name,data_type from information_schema.columns where table_schema=$1 and table_name in ('meetings','agenda_items') order by table_name,ordinal_position`,[s]);console.log('PG',r.rows)}
await pool.end();
