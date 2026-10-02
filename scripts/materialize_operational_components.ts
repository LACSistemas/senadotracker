import { readFileSync } from 'node:fs';
import pg from 'pg';
import { openDatabase } from '../packages/db/src/index.ts';
import { composeOperationalBundle } from '../apps/web/lib/proposicoes/compose.ts';
import { GROUPS } from '../apps/web/lib/proposicoes/taxonomy.ts';

for (const line of readFileSync('.env','utf8').split(/\r?\n/)) { const m=line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^"|"$/g,''); }
const db=openDatabase(process.env.SENADOTRACKER_DB_PATH??'data/senadotracker.sqlite',true);
const bundle=composeOperationalBundle(db,undefined,Object.fromEntries(GROUPS.map(g=>[g.key,g.label])));
db.close();
const pool=new pg.Pool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT??5432),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
await pool.query(`CREATE TABLE IF NOT EXISTS civica_poc.proposition_operational_components (
  year integer NOT NULL,
  component text NOT NULL,
  payload jsonb NOT NULL,
  source_revision text NOT NULL DEFAULT 'sqlite-initial-authoritative',
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (year, component)
)`);
await pool.query('BEGIN');
try {
  for (const [component,payload] of Object.entries(bundle).filter(([k])=>!['year'].includes(k))) {
    await pool.query(`INSERT INTO civica_poc.proposition_operational_components(year,component,payload,source_revision,refreshed_at) VALUES($1,$2,$3,'sqlite-initial-authoritative',now()) ON CONFLICT(year,component) DO UPDATE SET payload=excluded.payload,source_revision=excluded.source_revision,refreshed_at=excluded.refreshed_at`,[bundle.year,component,JSON.stringify(payload)]);
  }
  await pool.query('COMMIT');
} catch (error) { await pool.query('ROLLBACK'); throw error; }
console.log(JSON.stringify({database:process.env.DB_NAME,year:bundle.year,components:Object.keys(bundle).filter(k=>k!=='year'),rows:Object.keys(bundle).length-1}));
await pool.end();
