import pg from 'pg'; import fs from 'node:fs';
const e=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(x=>x.includes('=')).map(x=>x.split('=')));
const p=new pg.Pool({host:e.DB_HOST,port:+e.DB_PORT,user:e.DB_USER,password:e.DB_PASSWORD,database:'civica_postgres_lab'}); const c=await p.connect();
const q=async(sql,params=[])=> (await c.query(sql,params)).rows;
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\b(DEPUTAD[AO]|DEP\.?|DEPUTADO ESTADUAL|DEPUTADA ESTADUAL)\b/g,'').replace(/[^A-Z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const out={database:(await q('select current_database() db'))[0].db,houses:[]}; if(out.database!=='civica_postgres_lab') throw Error('wrong database');
for(const rev of await q("select distinct on(house) house,revision_id from civica_state.active_publications where domain='legislative' order by house,activated_at desc")){
 const h=rev.house; const roster=await q('select external_id::text,name from civica_state.current_state_parliamentarians where house=$1',[h]); const map=new Map(); for(const r of roster){const k=norm(r.name); if(k&&!map.has(k))map.set(k,String(r.external_id));}
 const rows=await q(`select a.actor_type,a.person_external_id::text person_external_id,a.author_raw,a.actor_external_key from civica_state.proposal_authors a where a.house=$1 and a.revision_id=$2`,[h,rev.revision_id]);
 let person=0,institution=0,collective=0,other=0,unknown=0,linked=0,currentRows=0,currentLinked=0,nameCandidates=0; const unresolved=[];
 const currentIds=new Set(roster.map(r=>String(r.external_id))); for(const a of rows){const t=String(a.actor_type??'').toLowerCase(); if(t==='person')person++; else if(t==='institution')institution++; else if(t==='collective')collective++; else if(t==='other')other++; else unknown++; if(a.person_external_id)linked++; const k=norm(a.author_raw); const candidate=map.get(k); if(candidate){nameCandidates++; currentRows++; if(a.person_external_id===candidate)currentLinked++; else unresolved.push({raw:a.author_raw,candidate});}}
 out.houses.push({house:h,revision_id:rev.revision_id,authors:rows.length,person_rows:person,institution_rows:institution,collective_rows:collective,other_rows:other,unknown_rows:unknown,linked_rows:linked,current_person_rows:currentRows,current_linked_rows:currentLinked,name_candidates:nameCandidates,unresolved_name_candidates:unresolved.slice(0,10),roster_rows:roster.length});
}
console.log(JSON.stringify(out,null,2)); await c.release(); await p.end();
