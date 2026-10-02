import pg from 'pg';
const p=new pg.Pool({host:'localhost',port:5432,database:'projetoeleitor_db',user:'projetoeleitor_user',password:'projetoeleitorsenha'});
(async()=>{for(const q of [
`WITH universe AS (SELECT DISTINCT p.external_id proposal_id FROM civica_poc.proposals p JOIN civica_poc.active_publications ap ON ap.source=p.source AND ap.batch_id=p.batch_id WHERE p.source='camara' AND (p.year=2026 OR (p.year=0 AND extract(year from p.presented_at)::int=2026))), themed AS (SELECT DISTINCT ON (c.proposal_id) c.proposal_id,c.payload->>'label' label FROM civica.legislative_complements c JOIN civica.active_complement_publications cp ON cp.source=c.source AND cp.batch_id=c.batch_id JOIN universe u ON u.proposal_id=c.proposal_id WHERE c.source='camara' AND c.kind='theme' AND cp.scope='themes-2026' AND NULLIF(c.payload->>'label','') IS NOT NULL ORDER BY c.proposal_id,c.external_key) SELECT count(*) n,count(distinct proposal_id) p FROM themed`,
`select count(distinct external_id) n from civica_poc.proposals p join civica_poc.active_publications ap on ap.source=p.source and ap.batch_id=p.batch_id where p.source='camara' and p.year=2026`,
`select count(distinct proposal_id) from civica.legislative_complements c join civica.active_complement_publications cp on cp.source=c.source and cp.batch_id=c.batch_id where c.source='camara' and c.kind='theme' and cp.scope='themes-2026'`
,
`select count(*) n from (select distinct p.external_id proposal_id from civica_poc.proposals p join civica_poc.active_publications ap on ap.source=p.source and ap.batch_id=p.batch_id where p.source='camara' and (p.year=2026 or (p.year=0 and extract(year from p.presented_at)::int=2026))) x`
])console.log((await p.query(q)).rows);await p.end()})().catch(e=>{console.error(e);process.exit(1)});
