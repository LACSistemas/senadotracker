import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { openDatabase } from '@senadotracker/db';
import { parseSenateProcess } from '../apps/collector/src/senate-processes.ts';

for (const line of fs.readFileSync('.env','utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] = m[2];
}
if (process.env.DB_NAME !== 'projetoeleitor_db') throw new Error(`wrong target ${process.env.DB_NAME}`);
const target = JSON.parse(fs.readFileSync('artifacts/state-topic-missing-keys.json','utf8').replace(/^\uFEFF/,''));
const targetKeys = new Set(target.rows.map(x => x.externalKey));
const sqlite = openDatabase('data/senadotracker.sqlite', true);
const rawIds = [...new Set(target.rows.map(x => x.payload.rawId))];
const parsed = [];
for (const rawId of rawIds) {
  const meta = sqlite.prepare('SELECT id,url,fetched_at,status,content_type,sha256,path,bytes FROM raw_objects WHERE id=?').get(rawId);
  if (!meta?.path) throw new Error(`missing SQLite raw evidence ${rawId}`);
  const proposalId = target.rows.find(x => x.payload.rawId === rawId)?.proposalId;
  const process = JSON.parse(fs.readFileSync(meta.path, 'utf8'));
  const records = parseSenateProcess(process, rawId, proposalId);
  const wanted = records.filter(r => r.kind === 'theme' && targetKeys.has(r.externalKey));
  if (!wanted.length) throw new Error(`official parser produced no target themes for ${rawId}`);
  parsed.push(...wanted.map(record => ({ record, meta })));
}
if (parsed.length !== target.rows.length) throw new Error(`target row mismatch: expected ${target.rows.length}, parsed ${parsed.length}`);

const pool = new pg.Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
const runId = `pg-state-topics:senado:2026:${randomUUID()}`;
const now = new Date().toISOString();
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query(`INSERT INTO civica.ingestion_runs(id,source,started_at,finished_at,status,parser_version,roster_complete,expected_count,reconciliation_json)
    VALUES($1,'senado',$2,$2,'published','senate-processes-pg-state-topics-v1',1,$3,$4)`, [runId, now, parsed.length, JSON.stringify({ source: 'senado', scope: 'state-topics-2026', mode: 'official-parser-from-preserved-raw', requestedRawObjects: rawIds.length, records: parsed.length })]);
  for (const { meta } of parsed.filter((x,i,a)=>a.findIndex(y=>y.meta.id===x.meta.id)===i)) {
    await client.query(`INSERT INTO civica.raw_objects(id,run_id,url,fetched_at,status,content_type,sha256,path,bytes)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO NOTHING`, [meta.id, runId, meta.url, meta.fetched_at, meta.status, meta.content_type, meta.sha256, meta.path, meta.bytes]);
  }
  await client.query(`INSERT INTO civica.complement_batches(id,source,scope,published_at,record_count,reconciliation_json)
    VALUES($1,'senado','state-topics-2026',$2,$3,$4)`, [runId, now, parsed.length, JSON.stringify({ source: 'senado', scope: 'state-topics-2026', parser: 'parseSenateProcess', rawObjects: rawIds.length, targetLabels: target.missingLabels.length })]);
  for (const { record } of parsed) {
    await client.query(`INSERT INTO civica.legislative_complements(batch_id,source,external_key,kind,person_external_id,proposal_id,deliberation_id,body_id,occurred_at,raw_id,payload)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb) ON CONFLICT(batch_id,external_key) DO UPDATE SET payload=excluded.payload`, [runId, record.source, record.externalKey, record.kind, record.personExternalId, record.proposalId, record.deliberationId, record.bodyId, record.occurredAt, record.rawId, JSON.stringify(record)]);
  }
  await client.query(`INSERT INTO civica.active_complement_publications(source,scope,batch_id)
    VALUES('senado','state-topics-2026',$1) ON CONFLICT(source,scope) DO UPDATE SET batch_id=excluded.batch_id`, [runId]);
  await client.query('COMMIT');
  console.log(JSON.stringify({ runId, rawObjects: rawIds.length, records: parsed.length, labels: target.missingLabels.length }, null, 2));
} catch (error) { await client.query('ROLLBACK'); throw error; }
finally { client.release(); sqlite.close(); await pool.end(); }
