import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';
import { writeFile } from 'node:fs/promises';
const year=2026; const sqlite=new DatabaseSync('data/senadotracker.sqlite');
const pool=new pg.Pool({host:'localhost',port:5432,database:'projetoeleitor_db',user:'projetoeleitor_user',password:'projetoeleitorsenha'});
const itemKey=row=>[row.source,row.meeting_external_id,row.item_external_id].map(x=>String(x??'')).join('|');
const matterKey=row=>[row.source,row.proposal_source,row.proposal_id].map(x=>String(x??'')).join('|');
const only=(a,b)=>[...a].filter(x=>!b.has(x)).sort(); const out={generatedAt:new Date().toISOString(),year,sources:{}};
for(const source of ['senado','camara']){
 const sqliteRows=sqlite.prepare('SELECT i.source,m.external_id meeting_external_id,i.external_id item_external_id,i.proposal_source,i.proposal_id,m.scheduled_date FROM commission_agenda_items i JOIN commission_meetings m ON m.id=i.meeting_id WHERE i.source=? AND i.active=1 AND m.scheduled_date>=? AND m.scheduled_date<?').all(source,`${year}-01-01`,`${year+1}-01-01`);
 const pgRows=(await pool.query('SELECT i.source,m.external_id meeting_external_id,i.external_id item_external_id,i.proposal_source,i.proposal_id,m.scheduled_date FROM civica_committees_poc.agenda_items i JOIN civica_committees_poc.meetings m ON m.id=i.meeting_id WHERE i.source=$1 AND i.active=true AND m.scheduled_date >= $2 AND m.scheduled_date < $3',[source,`${year}-01-01`,`${year+1}-01-01`])).rows;
 const sqliteItems=new Set(sqliteRows.map(itemKey)), pgItems=new Set(pgRows.map(itemKey)), sqliteMatters=new Set(sqliteRows.filter(r=>r.proposal_id!=null).map(matterKey)), pgMatters=new Set(pgRows.filter(r=>r.proposal_id!=null).map(matterKey));
 out.sources[source]={items:{sqlite:sqliteItems.size,pg:pgItems.size,intersection:[...sqliteItems].filter(x=>pgItems.has(x)).length,onlySqlite:only(sqliteItems,pgItems),onlyPg:only(pgItems,sqliteItems)},matters:{sqlite:sqliteMatters.size,pg:pgMatters.size,intersection:[...sqliteMatters].filter(x=>pgMatters.has(x)).length,onlySqlite:only(sqliteMatters,pgMatters),onlyPg:only(pgMatters,sqliteMatters)},cutoff:{sqlite:sqliteRows.map(r=>r.scheduled_date).filter(Boolean).sort().at(-1)??null,pg:pgRows.map(r=>r.scheduled_date).filter(Boolean).sort().at(-1)??null}};
}
await pool.end(); await writeFile('artifacts/r1_7_agenda_set_reconciliation.json',JSON.stringify(out,null,2));
console.log(JSON.stringify({generatedAt:out.generatedAt,sources:Object.fromEntries(Object.entries(out.sources).map(([s,v])=>[s,{items:{sqlite:v.items.sqlite,pg:v.items.pg,intersection:v.items.intersection,onlySqlite:v.items.onlySqlite.length,onlyPg:v.items.onlyPg.length},matters:{sqlite:v.matters.sqlite,pg:v.matters.pg,intersection:v.matters.intersection,onlySqlite:v.matters.onlySqlite.length,onlyPg:v.matters.onlyPg.length},cutoff:v.cutoff}]))},null,2));
