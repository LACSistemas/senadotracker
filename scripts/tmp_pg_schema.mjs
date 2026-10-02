import pg from 'pg'; import fs from 'fs';
const e=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(x=>x.includes('=')).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1).trim()]})); const p=new pg.Pool({host:e.DB_HOST,port:+e.DB_PORT,database:e.DB_NAME,user:e.DB_USER,password:e.DB_PASSWORD});
for(const q of [
`select table_schema,table_name,column_name from information_schema.columns where table_schema in ('civica','civica_people_poc') and table_name in ('profiles','cabinet_monthly_budgets','functional_staff_assignments','active_cabinet_budget_publications','active_staff_snapshot_publications','legislative_complements') order by table_schema,table_name,ordinal_position`,
`select source,count(*)::int n from civica.cabinet_monthly_budgets b join civica.active_cabinet_budget_publications a on a.source=b.source and a.batch_id=b.batch_id group by b.source`,
`select f.source,count(*)::int n,count(*) filter(where f.external_id is not null)::int linked from civica.functional_staff_assignments f join civica.active_staff_snapshot_publications a on a.source=f.source and a.batch_id=f.batch_id group by f.source`,
`select l.source,l.kind,count(*)::int n from civica.legislative_complements l join civica.active_complement_publications a on a.source=l.source and a.batch_id=l.batch_id group by l.source,l.kind order by 1,2`
]){try{console.log(await p.query(q).then(x=>x.rows))}catch(err){console.log('ERR',err.message)}} await p.end();
