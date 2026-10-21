import fs from 'node:fs';
import pg from 'pg';

// Use the same connection contract as the collectors. This script is
// deliberately refusal-first: it must never create indexes in the lab or in
// an accidentally selected database.
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
  if (match) process.env[match[1]] = match[2].replace(/^"|"$/g, '');
}

const expectedDatabase = 'projetoeleitor_db';
const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 1,
});

try {
  const identity = (await pool.query('SELECT current_database(), current_user')).rows[0];
  if (identity?.current_database !== expectedDatabase || process.env.DB_NAME !== expectedDatabase) {
    throw new Error(`Refusing read-path optimization: expected ${expectedDatabase}, got ${identity?.current_database ?? '<unknown>'}`);
  }

  // The web read path groups the annual expenses by person and month. The
  // existing profile-period index starts at external_id, so it cannot narrow
  // the full-house aggregation by source/year. This covering key order lets
  // PostgreSQL bitmap-scan exactly the active source/year slice while keeping
  // batch/person/month available for the join and grouping.
  await pool.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS expenses_source_year_batch_external_month_idx
    ON civica.expenses (source, year, batch_id, external_id, month)`);
  // Profile activity joins filter the JSON publication by personExternalId.
  // Without a matching expression index PostgreSQL scans every atom row for
  // the active batch before it can join the handful of matching proposals.
  await pool.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS proposal_detail_atoms_person_external_idx
    ON civica_poc.proposal_detail_atoms (source, ((payload->>'personExternalId')), batch_id, proposal_id, occurred_at DESC)`);
  await pool.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS legislative_complements_source_batch_kind_key_idx
    ON civica.legislative_complements (source, batch_id, kind, external_key)`);
  await pool.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS votes_source_batch_external_delib_idx
    ON civica_votes_presence_poc.votes (source, batch_id, external_id, deliberation_id)`);
  await pool.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS deliberations_source_batch_year_date_idx
    ON civica_votes_presence_poc.deliberations (source, batch_id, year, date, external_id)`);

  for (const table of ['civica.expenses', 'civica.profiles', 'civica_poc.proposal_authors', 'civica_poc.proposals', 'civica_poc.proposal_detail_atoms', 'civica.legislative_complements', 'civica_votes_presence_poc.votes', 'civica_votes_presence_poc.deliberations']) {
    await pool.query(`ANALYZE ${table}`);
  }

  const index = (await pool.query(`
    SELECT schemaname, indexrelname AS indexname, pg_size_pretty(pg_relation_size(indexrelid)) AS size
    FROM pg_stat_user_indexes
    WHERE (schemaname='civica' AND indexrelname IN ('expenses_source_year_batch_external_month_idx','legislative_complements_source_batch_kind_key_idx'))
       OR (schemaname='civica_poc' AND indexrelname='proposal_detail_atoms_person_external_idx')
       OR (schemaname='civica_votes_presence_poc' AND indexrelname IN ('votes_source_batch_external_delib_idx','deliberations_source_batch_year_date_idx'))
    ORDER BY schemaname,indexrelname
  `)).rows;
  console.log(JSON.stringify({ database: identity.current_database, user: identity.current_user, indexes: index }, null, 2));
} finally {
  await pool.end();
}
