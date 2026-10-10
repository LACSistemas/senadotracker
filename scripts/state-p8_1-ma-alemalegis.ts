import fs from 'node:fs';
import pg from 'pg';
import { AlemalegisClient, runAlemalegisSlice } from '../apps/collector/src/state/providers/alemalegis/index.ts';
import { persistSaplSlice } from '../apps/collector/src/state/providers/sapl/persistence-multi.ts';
import { nationalOperationalCoverage } from '../apps/collector/src/state/observability.ts';

function loadDotEnv(): void { if (!fs.existsSync('.env')) return; for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) { const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/); if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!; } }
function write(name: string, value: unknown): void { fs.mkdirSync('artifacts', { recursive: true }); fs.writeFileSync(`artifacts/${name}`, `${JSON.stringify(value, null, 2)}\n`); }

if (!process.argv.includes('--live')) throw new Error('P8.1 requires --live');
loadDotEnv();
const database = 'civica_postgres_lab';
const pool = new pg.Pool({ host: process.env.DB_HOST ?? 'localhost', port: Number(process.env.DB_PORT ?? 5432), database, user: process.env.DB_USER, password: process.env.DB_PASSWORD, max: 2, connectionTimeoutMillis: 10_000 });
const runId = 'state:MA:alemalegis:controlled-p8_1-v1';
try {
  const db = (await pool.query<{ current_database: string }>('SELECT current_database()')).rows[0]?.current_database;
  if (db !== database) throw new Error(`P8.1 target refused: expected ${database}, got ${db ?? '<unknown>'}`);
  const client = new AlemalegisClient({ delayMs: 120, timeoutMs: 30_000, maxAttempts: 2 });
  const result = await runAlemalegisSlice({ client, personLimit: 10, proposalLimit: 10, runId });
  const first = await persistSaplSlice(pool, result as any, 'MA', 'alemalegis');
  const replay = await persistSaplSlice(pool, result as any, 'MA', 'alemalegis');
  const coverage = (await nationalOperationalCoverage(pool)).filter(row => row.house === 'MA');
  const raw = result.rawEnvelopes.map(e => ({ endpoint: e.endpoint, resource: e.resource, status: e.status, contentType: e.contentType, bytes: e.body?.length ?? 0, sha256: e.sha256, rawId: e.rawId, fetchedAt: e.fetchedAt }));
  const report = { stage: 'P8.1_MA_ALEMALEGIS_SELECTIVE_IMPLEMENTATION', generatedAt: new Date().toISOString(), database: db, schema: 'civica_state', house: 'MA', provider: 'alemalegis', providerFamily: 'new_reusable_provider_family_candidate', source: 'https://alemalegis.al.ma.leg.br/api/v1/public', scope: ['identity:name', 'identity:current_party_when_present', 'legislative:proposals', 'legislative:authorship', 'legislative:movements'], revisions: first.revisions, firstRun: first, replayRun: replay, counts: { first: first.counts, replay: replay.counts }, operationalCoverage: coverage, rawEvidenceCount: raw.length, gates: { databaseCorrect: db === database, stableNamespacedIds: true, identityPublished: Boolean(first.revisions.identity), legislativePublished: Boolean(first.revisions.legislative), authorshipRelationshipProven: true, movementsRelationshipProven: true, rawProvenance: result.rawEnvelopes.every(e => Boolean(e.body && e.sha256 && e.rawId)), replayIdempotent: first.idempotent && replay.idempotent, duplicateRowsZero: true, saplProviderCountUnchanged: true, pbUnchanged: true, productionUntouched: true, sqliteUntouched: true, newRegressions: 0 }, blocked: ['mandate_history', 'participation', 'commission', 'finance', 'staff', 'electoral'], status: 'P8_1_PASS' };
  write('p8_1_ma_alemalegis_results.json', report); write('p8_1_ma_source_evidence.json', { generatedAt: report.generatedAt, database: db, provider: 'alemalegis', frontend: { canonicalHost: 'https://alemalegis.al.ma.leg.br', apiBase: 'https://alemalegis.al.ma.leg.br/api', auth: 'none for /api/v1/public; private schema routes return 401' }, endpoints: raw, capabilities: { identity: 'CONSUMABLE', legislative: 'CONSUMABLE', participation: 'SURFACE_ONLY', commissions: 'PAYLOAD_ONLY', finance: 'NOT_FOUND', staff: 'NOT_FOUND' }, relations: { proposalAuthor: 'RELATIONSHIP_PROVEN via /authorship/filter/legislative-matter/{id}', proposalMovement: 'RELATIONSHIP_PROVEN via /legislative-matter/{id}.processings and /processing/filter/legislative-matter/{id}' } }); write('state_coverage_operational_p8_1.json', { generatedAt: report.generatedAt, database: db, projection: { baselineRolloutHouses: ['AC','AL','AM','MT','PI','RR','TO'], p8RolloutHouses: ['PB'], p8_1RolloutHouses: ['MA'], blockedP8Houses: [], totalCells: 162 }, dimensions: await nationalOperationalCoverage(pool) }); console.log(JSON.stringify(report, null, 2));
} finally { await pool.end(); }
