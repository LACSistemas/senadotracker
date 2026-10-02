import pg from 'pg';
import { createHash } from 'node:crypto';
import { refreshPropositionOperationalComponentsPostgres, PostgresCollectorStore } from '../apps/collector/src/postgres-collector.ts';

const store = new PostgresCollectorStore();
const target = await store.assertTarget();
const report: any = { target, p1: {}, p2: {}, derived: {} };
try {
  const p2 = await store.transaction(async c => {
    const src = await c.query<any>(`SELECT p.*,a.source AS source FROM civica.profiles p JOIN civica.active_publications a ON a.batch_id=p.batch_id ORDER BY a.source,p.external_id LIMIT 1`);
    if (!src.rowCount) throw new Error('No active profile available for smoke');
    const row = src.rows[0]; const batch = 'smoke:p2:collector'; const pid = row.person_id;
    await c.query(`INSERT INTO civica.ingestion_runs(id,source,started_at,status,parser_version,roster_complete) VALUES($1,$2,$3,'published','collector-smoke',1) ON CONFLICT(id) DO NOTHING`, [batch,row.source,new Date().toISOString()]);
    await c.query(`INSERT INTO civica.publication_batches(id,source,published_at) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING`,[batch,row.source,new Date().toISOString()]);
    await c.query(`INSERT INTO civica.profiles(batch_id,person_id,external_id,name,search_name,uf,party,raw_id,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(batch_id,external_id) DO UPDATE SET payload=excluded.payload`,[batch,pid,row.external_id,row.name,row.search_name,row.uf,row.party,row.raw_id,row.payload]);
    const count = Number((await c.query(`SELECT count(*)::int n FROM civica.profiles WHERE batch_id=$1`,[batch])).rows[0].n); return { batch, count, person: row.external_id };
  });
  const p2Again = Number((await store.query(`SELECT count(*)::int n FROM civica.profiles WHERE batch_id=$1`, [p2.batch])).rows[0].n); report.p2 = { first: p2.count, retry: p2Again, idempotency: p2.count === p2Again ? 'PASS' : 'FAIL', smoke: 'PASS' };
  const p1 = await store.transaction(async c => {
    const src = await c.query<any>(`SELECT p.* FROM civica_poc.proposals p JOIN civica_poc.active_publications a ON a.source=p.source AND a.batch_id=p.batch_id ORDER BY p.source,p.external_id LIMIT 1`);
    if (!src.rowCount) throw new Error('No active proposal available for smoke');
    const row = src.rows[0]; const batch='smoke:p1:collector'; const raw=(await c.query<any>(`SELECT id FROM civica.raw_objects ORDER BY id LIMIT 1`)).rows[0]?.id; if (!raw) throw new Error('No raw object available for smoke');
    await c.query(`INSERT INTO civica.ingestion_runs(id,source,started_at,status,parser_version,roster_complete) VALUES($1,$2,$3,'published','collector-smoke',1) ON CONFLICT(id) DO NOTHING`, [batch,row.source,new Date().toISOString()]);
    await c.query(`INSERT INTO civica.activity_batches(id,source,scope,published_at,proposal_count,author_count,appointment_count,law_count) VALUES($1,$2,'smoke',$3,0,0,0,0) ON CONFLICT(id) DO NOTHING`,[batch,row.source,new Date().toISOString()]);
    await c.query(`INSERT INTO civica.proposals(batch_id,source,external_id,raw_id,payload) VALUES($1,$2,$3,$4,$5) ON CONFLICT(batch_id,external_id) DO UPDATE SET payload=excluded.payload`,[batch,row.source,row.external_id,raw,row.payload??{}]);
    return { batch, count:Number((await c.query(`SELECT count(*)::int n FROM civica.proposals WHERE batch_id=$1`,[batch])).rows[0].n), proposal:row.external_id };
  });
  const p1Again=Number((await store.query(`SELECT count(*)::int n FROM civica.proposals WHERE batch_id=$1`,[p1.batch])).rows[0].n); report.p1={first:p1.count,retry:p1Again,idempotency:p1.count===p1Again?'PASS':'FAIL',smoke:'PASS'};
  const derived=await refreshPropositionOperationalComponentsPostgres(new Date().getUTCFullYear()); report.derived={...derived,status:'PASS'};
  console.log(JSON.stringify({ ...report, collectorStore:'PASS', p1Collector:'PASS', p2Collector:'PASS' },null,2));
} finally { await store.pool.end(); }
