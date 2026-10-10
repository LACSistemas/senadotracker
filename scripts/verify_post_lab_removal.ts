import fs from 'node:fs';
import pg from 'pg';
const env: Record<string, string> = {};
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) { const m = line.match(/^\s*([^#=]+)=(.*)$/); if (m) env[m[1]!.trim()] = m[2]!.trim().replace(/^['"]|['"]$/g, ''); }
const client = new pg.Client({ host: env.DB_HOST ?? 'localhost', port: Number(env.DB_PORT ?? 5432), database: 'projetoeleitor_db', user: env.DB_USER, password: env.DB_PASSWORD, connectionTimeoutMillis: 15_000 });
await client.connect();
try {
  const proof = (await client.query(`SELECT current_database() AS database,current_user AS user,pg_database_size(current_database())::bigint AS size_bytes`)).rows[0] as any;
  const checks = {
    currentDatabase: proof.database === 'projetoeleitor_db',
    nationalHouses: Number((await client.query(`SELECT count(*)::int AS n FROM civica_national.houses`)).rows[0].n),
    nationalCapabilityRows: Number((await client.query(`SELECT count(*)::int AS n FROM civica_national.domain_capabilities`)).rows[0].n),
    activeStatePublications: Number((await client.query(`SELECT count(*)::int AS n FROM civica_state.active_publications`)).rows[0].n),
    activeBudgetPublications: Number((await client.query(`SELECT count(*)::int AS n FROM civica_state_budget.active_publications`)).rows[0].n),
    stateParliamentarians: Number((await client.query(`SELECT count(*)::int AS n FROM civica_state.current_state_parliamentarians`)).rows[0].n),
    labDatabaseAbsent: !(await client.query(`SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname='civica_postgres_lab') AS exists`)).rows[0].exists,
  };
  if (!checks.currentDatabase || checks.nationalHouses !== 29 || checks.nationalCapabilityRows !== 261 || checks.activeBudgetPublications !== 15 || !checks.labDatabaseAbsent) throw new Error(`Post-removal verification failed: ${JSON.stringify(checks)}`);
  const out = { generatedAt: new Date().toISOString(), database: proof.database, user: proof.user, sizeBytes: Number(proof.size_bytes), sizeGiB: +(Number(proof.size_bytes) / 1024 ** 3).toFixed(3), checks, labDropped: true };
  fs.writeFileSync('artifacts/P26_1R_lab_removal_postcheck.json', JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(out, null, 2));
} finally { await client.end(); }
