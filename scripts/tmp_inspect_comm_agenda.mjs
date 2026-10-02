import pg from 'pg'; import fs from 'node:fs';
const e=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(x=>x.includes('=')).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1).trim()]}));
const p=new pg.Pool({host:e.DB_HOST,port:+e.DB_PORT,database:e.DB_NAME,user:e.DB_USER,password:e.DB_PASSWORD});
for(const t of ['civica_committees_poc.meetings','civica_committees_poc.agenda_items']){
 const cols=await p.query(`select column_name,data_type from information_schema.columns where table_schema=split_part($1,'.',1) and table_name=split_part($1,'.',2) order by ordinal_position`,[t]); console.log('COLS',t,cols.rows);
 const q=await p.query(`select * from ${t} order by 1 desc limit 3`); console.log('ROWS',t,q.rows);
}
await p.end();
