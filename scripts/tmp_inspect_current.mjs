import pg from 'pg';
const p=new pg.Pool({host:'localhost',port:5432,database:'projetoeleitor_db',user:'projetoeleitor_user',password:'projetoeleitorsenha'});
(async()=>{
  for(const q of [
    `select source,scope,batch_id from civica.active_complement_publications where source in ('camara','senado') order by source,scope`,
    `select table_name from information_schema.tables where table_schema='civica_committees_poc' order by table_name`,
    `select a.scope,a.batch_id,b.reconciliation_json from civica.active_complement_publications a join civica.complement_batches b on b.id=a.batch_id where a.source in ('camara','senado') and a.scope like '%agenda%'`
  ]) console.log(JSON.stringify((await p.query(q)).rows,null,2));
  await p.end();
})().catch(e=>{console.error(e);process.exit(1)});
