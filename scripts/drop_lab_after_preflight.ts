import fs from 'node:fs';
import pg from 'pg';

const env: Record<string, string> = {};
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) { const m = line.match(/^\s*([^#=]+)=(.*)$/); if (m) env[m[1]!.trim()] = m[2]!.trim().replace(/^['"]|['"]$/g, ''); }
const preflight = JSON.parse(fs.readFileSync('artifacts/P26_1R_lab_removal_preflight.json', 'utf8')) as any;
const compare = JSON.parse(fs.readFileSync('artifacts/P26_1R_lab_official_state_compare.json', 'utf8')) as any;
const p25c = JSON.parse(fs.readFileSync('artifacts/P25_C.json', 'utf8')) as any;
if (env.DB_NAME !== 'projetoeleitor_db') throw new Error(`DB_NAME guard failed: ${env.DB_NAME ?? '<empty>'}`);
if (preflight.checks.officialDatabase !== true || preflight.checks.labDatabase !== true) throw new Error('Database identity preflight failed');
if (p25c.targetProof?.officialContract !== true || p25c.dataParity?.activeStateParityAtRestore !== true || p25c.dataParity?.activeBudgetParityAtRestore !== true) throw new Error('P25.C cutover parity proof failed');
if (compare.missingOfficialRows?.persons?.length !== 140 || compare.missingOfficialRows?.partyMemberships?.length !== 140 || compare.missingOfficialRows?.profileMetadata?.length !== 140 || compare.rawArchive?.length !== 8) throw new Error('Post-cutover drift archive is incomplete');

const client = new pg.Client({ host: env.DB_HOST ?? 'localhost', port: Number(env.DB_PORT ?? 5432), database: 'projetoeleitor_db', user: env.DB_USER, password: env.DB_PASSWORD, connectionTimeoutMillis: 15_000 });
await client.connect();
try {
  const proof = (await client.query<{ database: string; user: string }>('SELECT current_database() AS database,current_user AS user')).rows[0]!;
  if (proof.database !== 'projetoeleitor_db') throw new Error(`Connected to unexpected database: ${proof.database}`);
  const exists = (await client.query<{ exists: boolean }>(`SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname='civica_postgres_lab')`)).rows[0]!.exists;
  if (!exists) throw new Error('civica_postgres_lab is already absent; refusing an unverified no-op');
  await client.query('DROP DATABASE "civica_postgres_lab" WITH (FORCE)');
  const remains = (await client.query<{ exists: boolean }>(`SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname='civica_postgres_lab')`)).rows[0]!.exists;
  if (remains) throw new Error('DROP DATABASE returned but lab still exists');
  console.log(JSON.stringify({ database: proof.database, user: proof.user, dropped: 'civica_postgres_lab', labExistsAfter: remains, officialStillReachable: true, cutoverParity: 'P25.C active snapshot parity PASS', driftArchive: { persons: 140, partyMemberships: 140, profileMetadata: 140, rawPayloads: 8 }, diskBeforeGiB: 16.968 }, null, 2));
} finally { await client.end(); }
