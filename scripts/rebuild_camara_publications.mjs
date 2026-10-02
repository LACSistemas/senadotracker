/** Rebuild the Câmara house-operations and agenda read-model publications.
 *
 * This is a migration-time command.  It never becomes a runtime SQLite
 * dependency: the authoritative raw archive is read from civica.raw_objects,
 * while the already published agenda snapshot is copied into the PG
 * publication table with its provenance intact.  No target count is encoded
 * here; all counts come from the source rows/reconciliation.
 */
import pg from 'pg';
import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';

const env=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(x=>x.includes('=')).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1).trim()]}));
const pool=new pg.Pool({host:env.DB_HOST,port:Number(env.DB_PORT??5432),database:env.DB_NAME,user:env.DB_USER,password:env.DB_PASSWORD});
const sqlite=new DatabaseSync('data/senadotracker.sqlite');
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const raw=(await pool.query("SELECT path,url FROM civica.raw_objects WHERE url LIKE '%proposicoes-2026.json' ORDER BY fetched_at DESC LIMIT 1")).rows[0];
if(!raw) throw new Error('raw oficial proposicoes-2026.json ausente em civica.raw_objects');
const propRoot=await json(raw.path); const props=Array.isArray(propRoot?.dados)?propRoot.dados:Array.isArray(propRoot)?propRoot:[];
const backlogRows=props.filter(x=>/tramit/i.test(String(x?.ultimoStatus?.descricaoSituacao??x?.status??'')));
const op=(await pool.query("SELECT a.batch_id,b.reconciliation_json FROM civica.active_complement_publications a JOIN civica.complement_batches b ON b.id=a.batch_id WHERE a.source='camara' AND a.scope='house-operations-2026' LIMIT 1")).rows[0];
if(!op) throw new Error('publicação house-operations-2026 ausente no PostgreSQL');
const previous=op.reconciliation_json&&typeof op.reconciliation_json==='object'?op.reconciliation_json:{};
const sqliteOperations=sqlite.prepare("SELECT b.reconciliation_json FROM active_complement_publications a JOIN complement_batches b ON b.id=a.batch_id WHERE a.source='camara' AND a.scope='house-operations-2026' LIMIT 1").get();
if(!sqliteOperations) throw new Error('snapshot canonical house-operations-2026 ausente no SQLite baseline');
const canonicalOperations=JSON.parse(String(sqliteOperations.reconciliation_json));
const sqliteAgenda=sqlite.prepare("SELECT b.reconciliation_json FROM active_complement_publications a JOIN complement_batches b ON b.id=a.batch_id WHERE a.source='camara' AND a.scope='camara-agenda-2026' LIMIT 1").get();
if(!sqliteAgenda) throw new Error('snapshot canônico camara-agenda-2026 ausente no SQLite baseline');
const agenda=JSON.parse(String(sqliteAgenda.reconciliation_json));
const pgCounts=(await pool.query("SELECT count(*)::int items,count(DISTINCT i.proposal_id)::int matters,max(m.scheduled_date)::text cutoff FROM civica_committees_poc.agenda_items i JOIN civica_committees_poc.meetings m ON m.id=i.meeting_id WHERE i.source='camara' AND i.active=true AND m.scheduled_date >= '2026-01-01' AND m.scheduled_date < '2027-01-01'")).rows[0]??{};
if(Number(pgCounts.items)!==Number(agenda.items)||Number(pgCounts.matters)!==Number(agenda.matters)) throw new Error(`agenda relacional incompatível com snapshot: PG ${pgCounts.items}/${pgCounts.matters}, snapshot ${agenda.items}/${agenda.matters}`);
const now=new Date().toISOString();
const summary={...previous,...canonicalOperations,source:'camara',year:2026,observedAt:now,backlog:backlogRows.length,backlogUniverse:'Proposicoes distintas cujo ultimo status oficial da publicacao anual contem tramitacao.',agendaCoverage:{...agenda,source:'GET /eventos/{id}/pauta',relationalItems:Number(pgCounts.items),relationalMatters:Number(pgCounts.matters)},provenance:{proposicoesRawUrl:raw.url,proposicoesRawPath:raw.path,agendaSnapshotSource:'SQLite canonical official publication promoted once into PostgreSQL',agendaSnapshotScope:'camara-agenda-2026'}};
const client=await pool.connect(); try{await client.query('BEGIN');
  await client.query('UPDATE civica.complement_batches SET reconciliation_json=$2,record_count=1 WHERE id=$1',[op.batch_id,JSON.stringify(summary)]);
  const batchId='pg-camara-agenda-canonical:2026';
  await client.query(`INSERT INTO civica.ingestion_runs(id,source,started_at,finished_at,status,parser_version,expected_count,roster_complete,reconciliation_json) VALUES($1,'camara',$2,$2,'published','camara-agenda-canonical', $3, 1, $4) ON CONFLICT(id) DO UPDATE SET finished_at=excluded.finished_at,status=excluded.status,reconciliation_json=excluded.reconciliation_json`,[batchId,now,Number(agenda.items),JSON.stringify({source:'camara',scope:'camara-agenda-2026',...agenda})]);
  await client.query(`INSERT INTO civica.complement_batches(id,source,scope,published_at,record_count,reconciliation_json) VALUES($1,'camara','camara-agenda-2026',$2,$3,$4) ON CONFLICT(id) DO UPDATE SET published_at=excluded.published_at,record_count=excluded.record_count,reconciliation_json=excluded.reconciliation_json`,[batchId,now,Number(agenda.items),JSON.stringify({...agenda,source:'GET /eventos/{id}/pauta',relationalItems:Number(pgCounts.items),relationalMatters:Number(pgCounts.matters),provenance:summary.provenance})]);
  await client.query(`INSERT INTO civica.active_complement_publications(source,scope,batch_id) VALUES('camara','camara-agenda-2026',$1) ON CONFLICT(source,scope) DO UPDATE SET batch_id=excluded.batch_id`,[batchId]);
  await client.query('COMMIT');
}catch(e){await client.query('ROLLBACK');throw e}finally{client.release();await pool.end();sqlite.close()}
const result={generatedAt:now,source:'camara',houseOperations:{backlog:backlogRows.length,rawUrl:raw.url,rawRows:props.length,rule:'ultimoStatus.descricaoSituacao LIKE %tramit%'} ,agenda:{events:Number(agenda.events),eventsCovered:Number(agenda.eventsCovered),items:Number(agenda.items),matters:Number(agenda.matters),to:agenda.to,relationalItems:Number(pgCounts.items),relationalMatters:Number(pgCounts.matters),relationalCutoff:pgCounts.cutoff,publication:'pg-camara-agenda-canonical:2026'}};
fs.writeFileSync('artifacts/camara_publication_rebuild.json',JSON.stringify(result,null,2)+'\n'); console.log(JSON.stringify(result,null,2));
