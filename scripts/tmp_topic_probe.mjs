import pg from 'pg';
const p=new pg.Pool({host:'localhost',port:5432,database:'projetoeleitor_db',user:'projetoeleitor_user',password:'projetoeleitorsenha'});
(async()=>{
for(const q of [
`select a.source,a.scope,a.batch_id,b.record_count from civica.active_complement_publications a join civica.complement_batches b on b.id=a.batch_id where a.scope like '%theme%' or a.scope like '%topic%'`,
`select source,kind,count(*)::int n,count(distinct proposal_id)::int proposals from civica.legislative_complements where kind='theme' group by source,kind`,
`select source,count(*)::int n,count(distinct proposal_id)::int proposals from civica_poc.proposal_detail_atoms where kind='theme' group by source`,
`select source,batch_id,count(*)::int n,count(distinct proposal_id)::int proposals from civica.legislative_complements where kind='theme' group by source,batch_id order by source,n desc`,
`select column_name,data_type from information_schema.columns where table_schema='civica' and table_name='legislative_complements' order by ordinal_position`
]) console.log(JSON.stringify((await p.query(q)).rows,null,2)); await p.end()})().catch(e=>{console.error(e);process.exit(1)});
