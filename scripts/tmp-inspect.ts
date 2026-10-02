import fs from 'node:fs';
for (const line of fs.readFileSync('.env','utf8').split(/\r?\n/)) { const m=line.match(/^([A-Z0-9_]+)=(.*)$/); if(m) process.env[m[1]]=m[2]; }
import { Pool } from 'pg';
const p=new Pool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
for (const q of [
`select current_database(),current_user`,
`select schemaname,tablename from pg_tables where schemaname in ('civica','civica_poc','civica_people_poc','civica_finance_poc','civica_votes_presence_poc') order by 1,2`,
`select table_schema,table_name,column_name,data_type from information_schema.columns where table_schema in ('civica','civica_poc','civica_people_poc','civica_finance_poc','civica_votes_presence_poc') and table_name in ('profiles','expenses','proposal_authors','proposals','votes','deliberations','expanded_costs','active_publications','active_expense_publications','active_expanded_cost_publications') order by 1,2,ordinal_position`,
`select * from civica.active_expense_publications`,
`select source,year,count(*)::int n from civica.expenses group by source,year order by 1,2 desc limit 20`,
`select table_name,column_name,data_type from information_schema.columns where table_schema='civica' and table_name in ('normative_values','cabinet_staff','expanded_costs','cabinet_monthly_budgets','cabinet_offices') order by 1,ordinal_position`,
`select key,kind,applies_to,value_cents,valid_from,valid_to from civica.normative_values order by valid_from desc limit 20`,
]) { const r=await p.query(q); console.log('\nQ',q,'\n',JSON.stringify(r.rows,null,2)); }
await p.end();
