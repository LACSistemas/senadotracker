import pg from 'pg';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

try { (process as unknown as { loadEnvFile?: (p?: string) => void }).loadEnvFile?.('.env'); } catch {}
const base = { host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 5432), user: process.env.DB_USER, password: process.env.DB_PASSWORD };
const name = `p106_restore_check_${process.pid}`;
const admin = new pg.Client({ ...base, database: 'postgres' });
const dump = 'artifacts/projetoeleitor_p105_prepublication_20261026.dump';
const restore = (args: string[]) => new Promise<{ code: number; stderr: string }>((resolve, reject) => { const p = spawn('pg_restore', args, { env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD ?? '' }, windowsHide: true }); let stderr = ''; p.stderr.on('data', x => stderr += String(x)); p.on('error', reject); p.on('close', code => resolve({ code: code ?? -1, stderr: stderr.slice(-4000) })); });
await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${name}"`);
  const r = await restore(['--no-owner','--no-privileges','--exit-on-error','--dbname',name,dump]);
  if (r.code !== 0) throw new Error(`pg_restore ${r.code}: ${r.stderr}`);
  const c = new pg.Client({ ...base, database: name }); await c.connect();
  const proof = (await c.query("select current_database() db, count(*)::int tables from information_schema.tables where table_schema not in ('pg_catalog','information_schema')")).rows[0]; await c.end();
  console.log(JSON.stringify({ status: 'PASS', dump, restoredDatabase: proof.db, tables: proof.tables }, null, 2));
} finally { await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`); await admin.end(); }
