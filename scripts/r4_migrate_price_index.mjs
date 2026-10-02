import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) process.env[line.slice(0, i)] = line.slice(i + 1);
}

const sqlite = new DatabaseSync(process.env.SENADOTRACKER_DB_PATH ?? 'data/senadotracker.sqlite', { readOnly: true });
const client = new pg.Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
await client.connect();
try {
  await client.query('BEGIN');
  await client.query(`CREATE TABLE IF NOT EXISTS civica_elections_poc.price_index_batches (
    id text PRIMARY KEY, index_code text NOT NULL, published_at text NOT NULL,
    availability text NOT NULL, first_month text NOT NULL, last_month text NOT NULL,
    record_count integer NOT NULL, official_url text NOT NULL, note text NOT NULL)`);
  await client.query(`CREATE TABLE IF NOT EXISTS civica_elections_poc.active_price_index_publications (
    index_code text PRIMARY KEY, batch_id text NOT NULL)`);
  await client.query(`CREATE TABLE IF NOT EXISTS civica_elections_poc.price_index_values (
    batch_id text NOT NULL, index_code text NOT NULL, reference_month text NOT NULL,
    index_scaled bigint NOT NULL, raw_id text NOT NULL,
    PRIMARY KEY (batch_id,index_code,reference_month))`);
  const batches = sqlite.prepare('SELECT * FROM price_index_batches').all();
  for (const row of batches) await client.query(`INSERT INTO civica_elections_poc.price_index_batches (id,index_code,published_at,availability,first_month,last_month,record_count,official_url,note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO UPDATE SET index_code=excluded.index_code,published_at=excluded.published_at,availability=excluded.availability,first_month=excluded.first_month,last_month=excluded.last_month,record_count=excluded.record_count,official_url=excluded.official_url,note=excluded.note`, [row.id,row.index_code,row.published_at,row.availability,row.first_month,row.last_month,row.record_count,row.official_url,row.note]);
  const values = sqlite.prepare('SELECT * FROM price_index_values').all();
  for (const row of values) await client.query(`INSERT INTO civica_elections_poc.price_index_values (batch_id,index_code,reference_month,index_scaled,raw_id) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (batch_id,index_code,reference_month) DO UPDATE SET index_scaled=excluded.index_scaled,raw_id=excluded.raw_id`, [row.batch_id,row.index_code,row.reference_month,row.index_scaled,row.raw_id]);
  const active = sqlite.prepare('SELECT * FROM active_price_index_publications').all();
  for (const row of active) await client.query(`INSERT INTO civica_elections_poc.active_price_index_publications (index_code,batch_id) VALUES ($1,$2) ON CONFLICT (index_code) DO UPDATE SET batch_id=excluded.batch_id`, [row.index_code,row.batch_id]);
  await client.query('COMMIT');
  const checks = await client.query(`SELECT (SELECT count(*) FROM civica_elections_poc.price_index_values) values_count,(SELECT count(*) FROM civica_elections_poc.price_index_batches) batches_count,(SELECT count(*) FROM civica_elections_poc.active_price_index_publications) active_count`);
  console.log(JSON.stringify({sqliteValues: values.length, sqliteBatches: batches.length, sqliteActive: active.length, postgres: checks.rows[0]}));
} catch (error) { await client.query('ROLLBACK'); throw error; } finally { await client.end(); sqlite.close(); }
