import pg from 'pg'; import fs from 'fs';
const e=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(x=>x.includes('=')).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1).trim()]}));
const p=new pg.Pool({host:e.DB_HOST,port:+e.DB_PORT,database:e.DB_NAME,user:e.DB_USER,password:e.DB_PASSWORD});
const qs=[
 ['pg_profiles',`select source,count(*)::int n from civica.profiles group by source`],
 ['pg_expenses',`select e.source,e.year,count(*)::int n,sum(e.net_cents-e.refund_cents)::bigint total from civica.expenses e join civica.active_expense_publications a on a.source=e.source and a.batch_id=e.batch_id group by e.source,e.year order by 1,2`],
 ['pg_budgets',`select source,year,count(*)::int n,sum(coalesce(spent_cents,0))::bigint spent from civica.cabinet_monthly_budgets b join civica.active_cabinet_budget_publications a on a.source=b.source and a.batch_id=b.batch_id group by source,year`],
 ['pg_staff',`select source,count(*)::int n,count(*) filter(where external_id is not null)::int linked from civica.functional_staff_assignments f join civica.active_staff_snapshot_publications a on a.source=f.source and a.batch_id=f.batch_id group by source`],
 ['pg_party',`select count(*)::int n,count(distinct person_id)::int people from civica.party_memberships`],
 ['pg_appointments',`select source,count(*)::int n from civica.legislative_appointments group by source`],
 ['pg_complements',`select source,kind,count(*)::int n from civica.legislative_complements l join civica.active_complement_publications a on a.source=l.source and a.batch_id=l.batch_id group by source,kind order by 1,2`]
]; for(const [n,q] of qs){try{console.log(n,await p.query(q).then(x=>x.rows))}catch(err){console.log(n,'ERR',err.message)}} await p.end();
