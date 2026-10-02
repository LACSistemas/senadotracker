import pg from 'pg';
const p=new pg.Pool({host:'localhost',port:5432,database:'civica_postgres_lab',user:'projetoeleitor_user',password:process.env.DB_PASSWORD});
console.log((await p.query("select exists(select 1 from pg_extension where extname='unaccent')")).rows);
console.log((await p.query("select column_name from information_schema.columns where table_schema='civica_poc' and table_name='proposals'")).rows);
await p.end();
