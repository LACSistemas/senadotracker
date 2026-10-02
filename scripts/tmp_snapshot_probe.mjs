import pg from 'pg';
const p=new pg.Pool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT??5432),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
for(const q of [
  `select table_name from information_schema.tables where table_schema='civica' and table_name ilike '%agenda%' order by 1`,
  `select * from civica.active_complement_publications where scope like '%agenda%'`,
  `select column_name,data_type from information_schema.columns where table_schema='civica' and table_name='complement_batches' order by ordinal_position`,
  `select column_name,data_type from information_schema.columns where table_schema='civica_committees_poc' and table_name='agenda_items' order by ordinal_position`,
  `select source,count(*)::int n,max(coalesce(scheduled_at,occurred_at,created_at)) max_date from civica_committees_poc.agenda_items group by source`,
  `select source,count(*)::int n,max(date)::text max_date from civica_votes_presence_poc.sessions group by source`,
  `select source,count(*)::int n,max(competence) max_comp,min(competence) min_comp from civica.expanded_costs where source='senado' group by source order by max_comp desc`,
  `select source,batch_id,count(*)::int n,max(competence) max_comp,min(competence) min_comp from civica.expanded_costs where source='senado' group by source,batch_id order by max_comp desc`,
  `select * from civica.active_expanded_cost_publications where source='senado'`,
  `select batch_id,competence,rubric,count(*)::int n,sum(value_cents)::bigint total,count(distinct external_id)::int people from civica.expanded_costs where source='senado' group by batch_id,competence,rubric order by competence,rubric`,
  `select batch_id,external_id,sum(value_cents)::bigint total,count(*)::int n from civica.expanded_costs where source='senado' and competence='2026-08' and rubric='cabinet_payroll_gross' and external_id='1173' group by batch_id,external_id`,
  `select count(*)::int n,max(fetched_at) fetched_at,max(url) url from civica.raw_objects where url ilike '%agendareuniao%' or url ilike '%agenda%reuniao%'`,
  `select id,url,fetched_at,path,bytes from civica.raw_objects where url ilike '%agendareuniao%' order by fetched_at desc limit 10`,
]){try{console.log(JSON.stringify(await p.query(q).then(x=>x.rows),null,2))}catch(e){console.log('ERROR',e.message)}}
await p.end();
