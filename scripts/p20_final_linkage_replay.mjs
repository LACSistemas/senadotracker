import pg from 'pg';
import fs from 'node:fs';
const e=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(x=>x.includes('=')).map(x=>x.split('=')));
const p=new pg.Pool({host:e.DB_HOST,port:+e.DB_PORT,user:e.DB_USER,password:e.DB_PASSWORD,database:'civica_postgres_lab'});
const c=await p.connect();
const out={database:null,houses:{},duplicateInsertions:0,newRevisionOnUnchangedReplay:0};
try {
 out.database=(await c.query('select current_database() db')).rows[0].db;
 if(out.database!=='civica_postgres_lab') throw new Error('wrong database '+out.database);
 await c.query('begin');
 for(const house of ['ES','BA','GO','MA','MS','MT','PA','PE','SE']) {
  const a=(await c.query("select distinct on(house) house,revision_id from civica_state.active_publications where house=$1 and domain='legislative' order by house,activated_at desc",[house])).rows[0];
  const p1=await c.query(`insert into civica_state.proposals(revision_id,house,provider,external_id,title,type,number,year,presented_at,status,raw_id,provenance)
    select revision_id,house,provider,external_id,title,type,number,year,presented_at,status,raw_id,provenance from civica_state.proposals where house=$1 and revision_id=$2
    on conflict(revision_id,house,provider,external_id) do nothing`,[house,a.revision_id]);
  const a1=await c.query(`insert into civica_state.proposal_authors(revision_id,house,provider,proposal_external_id,author_key,actor_type,person_external_id,organization_external_id,actor_external_key,author_raw,role,author_order,raw_id,provenance,actor_type_raw,actor_type_canonical)
    select revision_id,house,provider,proposal_external_id,author_key,actor_type,person_external_id,organization_external_id,actor_external_key,author_raw,role,author_order,raw_id,provenance,actor_type_raw,actor_type_canonical from civica_state.proposal_authors where house=$1 and revision_id=$2
    on conflict(revision_id,house,provider,proposal_external_id,author_key) do nothing`,[house,a.revision_id]);
  out.houses[house]={revision:a.revision_id,proposalRowsInserted:p1.rowCount??0,authorRowsInserted:a1.rowCount??0}; out.duplicateInsertions+=(p1.rowCount??0)+(a1.rowCount??0);
 }
 await c.query('commit');
} catch(err){try{await c.query('rollback')}catch{}; throw err} finally {c.release();await p.end()}
console.log(JSON.stringify(out,null,2));
