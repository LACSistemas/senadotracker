import pg from 'pg';
const p=new pg.Pool({host:'localhost',port:5432,user:'projetoeleitor_user',password:'projetoeleitorsenha',database:'civica_postgres_lab'});
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/^(deputad[oa]|senador[oa])\s+/,'').replace(/\s+/g,' ').trim();
const result={};
for(const house of ['PE','SC']){
 const active=(await p.query("select revision_id from civica_state.active_publications where house=$1 and domain='legislative'",[house])).rows[0]?.revision_id;
 const people=(await p.query("select distinct on (external_id) external_id,name,revision_id,provider from civica_state.persons where house=$1 order by external_id,revision_id desc",[house])).rows;
 const byName=new Map(); for(const person of people){const key=norm(person.name); if(key&&!byName.has(key)) byName.set(key,person)}
 const authors=(await p.query("select revision_id,house,provider,proposal_external_id,author_key,author_raw,actor_type from civica_state.proposal_authors where house=$1 and revision_id=$2 and person_external_id is null and lower(coalesce(actor_type,'')) in ('person','parliamentarian','deputy')",[house,active])).rows;
 let matched=0; await p.query('begin'); try { for(const author of authors){const person=byName.get(norm(author.author_raw)); if(!person) continue; await p.query("update civica_state.proposal_authors set person_external_id=$1,actor_type_raw=coalesce(actor_type_raw,actor_type),actor_type_canonical='PERSON' where revision_id=$2 and house=$3 and provider=$4 and proposal_external_id=$5 and author_key=$6",[person.external_id,author.revision_id,house,author.provider,author.proposal_external_id,author.author_key]); matched++; } await p.query('commit'); } catch(e){await p.query('rollback'); throw e}
 result[house]={revision:active,identityRows:people.length,authorRows:authors.length,matched,remainingUnresolved:authors.length-matched};
}
console.log(JSON.stringify(result,null,2)); await p.end();
