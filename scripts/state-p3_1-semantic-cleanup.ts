import fs from 'node:fs';
import { ensureStatePersistenceSchema, nationalOperationalCoverage, statePersistencePool } from '../apps/collector/src/state/index.ts';

function loadDotEnv(): void {
  if (!fs.existsSync('.env')) return;
  for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (match && process.env[match[1]!] === undefined) process.env[match[1]!] = match[2]!;
  }
}

loadDotEnv();
const pool = statePersistencePool({ ...process.env, STATE_PERSISTENCE_DATABASE: 'civica_postgres_lab' });
try {
  await ensureStatePersistenceSchema(pool);
  const current = (await pool.query<{ current_database: string }>('SELECT current_database()')).rows[0]?.current_database;
  if (current !== 'civica_postgres_lab') throw new Error(`P3.1 target refused: ${current ?? '<unknown>'}`);
  const updated = await pool.query<{ dimension: string }>(`UPDATE civica_state.operational_coverage SET last_successful_run=NULL, active_revision_id=NULL, updated_at=now() WHERE house='PR' AND status='NOT_COLLECTED' RETURNING dimension`);
  const coverage = await nationalOperationalCoverage(pool);
  const report = {
    stage: 'P3_1_SEMANTIC_CLEANUP',
    generatedAt: new Date().toISOString(),
    database: current,
    house: 'PR',
    clearedDimensions: updated.rows.map(row => row.dimension).sort(),
    prOperationalCoverage: coverage.filter(row => row.house === 'PR'),
    totalCells: coverage.length,
    expectedCells: 162,
    gate: updated.rows.length >= 5 && coverage.length === 162 && coverage.filter(row => row.house === 'PR' && row.status === 'NOT_COLLECTED').every(row => row.lastSuccessfulRun === null && row.activeRevisionId === null),
  };
  fs.mkdirSync('artifacts', { recursive: true });
  fs.writeFileSync('artifacts/state_coverage_operational_p3_1.json', `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally { await pool.end(); }
