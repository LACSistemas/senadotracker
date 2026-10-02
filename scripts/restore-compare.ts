import pg from 'pg';
import { createHash } from 'node:crypto';

const base={host:process.env.DB_HOST,port:Number(process.env.DB_PORT??5432),user:process.env.DB_USER,password:process.env.DB_PASSWORD};
const main=new pg.Pool({...base,database:'projetoeleitor_db',max:2});
const restore=new pg.Pool({...base,database:'civica_cutover_restore_validation',max:2});
const queries={
  proposals:"SELECT source,batch_id FROM civica_poc.active_publications ORDER BY source,batch_id",
  people:"SELECT source,batch_id FROM civica.active_publications ORDER BY source,batch_id",
  legislative:"SELECT source,batch_id FROM civica.active_legislative_publications ORDER BY source,batch_id",
  expenses:"SELECT source,year,batch_id FROM civica.active_expense_publications ORDER BY source,year,batch_id",
  elections:"SELECT election_id,batch_id FROM civica.active_electoral_publications ORDER BY election_id,batch_id",
  counts:[
    "SELECT count(*)::int n FROM civica_poc.proposals p JOIN civica_poc.active_publications a ON a.source=p.source AND a.batch_id=p.batch_id",
    "SELECT count(*)::int n FROM civica.profiles p JOIN civica.active_publications a ON a.batch_id=p.batch_id",
    "SELECT count(*)::int n FROM civica.deliberations d JOIN civica.active_legislative_publications a ON a.batch_id=d.batch_id",
    "SELECT count(*)::int n FROM civica.legislative_votes v JOIN civica.active_legislative_publications a ON a.batch_id=v.batch_id",
    "SELECT count(*)::int n FROM civica.expenses e JOIN civica.active_expense_publications a ON a.source=e.source AND a.year=e.year AND a.batch_id=e.batch_id",
    "SELECT count(*)::int n FROM civica.candidacies c JOIN civica.active_electoral_publications a ON a.batch_id=c.batch_id",
    "SELECT count(*)::int n FROM civica_finance_poc.supplier_market_all_points",
    "SELECT count(*)::int n FROM civica_poc.proposition_operational_components",
  ],
};
const canon=(rows:any[])=>rows.map(row=>JSON.stringify(row)).join('\n');
const compare:any={databasePair:['projetoeleitor_db','civica_cutover_restore_validation'],activePublications:{},counts:{}};
for(const [name,sql] of Object.entries(queries)){if(name==='counts')continue;const a=(await main.query(sql as string)).rows,b=(await restore.query(sql as string)).rows;const sa=canon(a),sb=canon(b);compare.activePublications[name]={main:a,restore:b,status:sa===sb?'MATCH':'MISMATCH'};}
const countSql=queries.counts as string[];for(let i=0;i<countSql.length;i++){const a=Number((await main.query(countSql[i]!)).rows[0]?.n??0),b=Number((await restore.query(countSql[i]!)).rows[0]?.n??0);compare.counts[['proposals','profiles','deliberations','votes','expenses','candidacies','supplier_market_all_points','operational_components'][i]!]={main:a,restore:b,status:a===b?'MATCH':'MISMATCH'};}
const [aRev,bRev]=await Promise.all([main.query('SELECT revision_id FROM civica_finance_poc.active_supplier_aggregate_revision'),restore.query('SELECT revision_id FROM civica_finance_poc.active_supplier_aggregate_revision')]);compare.derivedRevision={main:aRev.rows,restore:bRev.rows,status:JSON.stringify(aRev.rows)===JSON.stringify(bRev.rows)?'MATCH':'MISMATCH'};
compare.status=Object.values(compare.activePublications).every((x:any)=>x.status==='MATCH')&&Object.values(compare.counts).every((x:any)=>x.status==='MATCH')&&compare.derivedRevision.status==='MATCH'?'PASS':'MISMATCH';
console.log(JSON.stringify(compare,null,2));await main.end();await restore.end();
