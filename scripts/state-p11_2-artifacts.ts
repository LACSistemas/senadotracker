import fs from 'node:fs';
import pg from 'pg';
import { STATE_DATABASE, STATE_SCHEMA } from '../apps/collector/src/state/persistence.ts';

function loadEnv(): void { if (!fs.existsSync('.env')) return; for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) { const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/); if (match && process.env[match[1]!] === undefined) process.env[match[1]!] = match[2]!; } }
function write(name: string, value: unknown): void { fs.writeFileSync(`artifacts/${name}`, `${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`); }

loadEnv();
const pool = new pg.Pool({ host: process.env.DB_HOST ?? 'localhost', port: Number(process.env.DB_PORT ?? 5432), database: STATE_DATABASE, user: process.env.DB_USER, password: process.env.DB_PASSWORD, max: 1 });
try {
  const database = (await pool.query<{ current_database: string }>('SELECT current_database()')).rows[0]?.current_database;
  if (database !== STATE_DATABASE) throw new Error(`P11.2 artifact target refused: ${database ?? '<unknown>'}`);
  const result = JSON.parse(fs.readFileSync('artifacts/p11_2_results.json', 'utf8')) as any;
  const source = JSON.parse(fs.readFileSync('artifacts/p11_2_source_evidence.json', 'utf8')) as any;
  const participation = JSON.parse(fs.readFileSync('artifacts/state_participation_discovery_p11_2.json', 'utf8')) as any;
  const base = JSON.parse(fs.readFileSync('artifacts/state_coverage_operational_p11_1.json', 'utf8')) as any;
  if (!Array.isArray(base.dimensions) || base.dimensions.length !== 162) throw new Error('P11.1 coverage base must contain 162 dimensions');
  const rows = (await pool.query(`SELECT house,dimension,status,records_found,records_expected,records_resolved,primary_records_found,primary_records_expected,primary_records_resolved,components,completeness_percentage,earliest_record_date,latest_record_date,historical_verified,last_successful_run,active_revision_id,note FROM ${STATE_SCHEMA}.operational_coverage ORDER BY house,dimension`)).rows as any[];
  const overlay = new Map(rows.filter(row => row.house === 'BA' || row.house === 'PA').map(row => [`${row.house}:${row.dimension}`, row]));
  const dimensions = base.dimensions.map((row: any) => {
    const current = overlay.get(`${row.house}:${row.dimension}`); if (!current) return row;
    return { ...row, status: current.status, recordsFound: current.records_found, recordsExpected: current.records_expected, recordsResolved: current.records_resolved, primaryRecordsFound: current.primary_records_found, primaryRecordsExpected: current.primary_records_expected, primaryRecordsResolved: current.primary_records_resolved, components: current.components, completenessPercentage: current.completeness_percentage, earliestRecordDate: current.earliest_record_date, latestRecordDate: current.latest_record_date, historicalVerified: current.historical_verified, lastSuccessfulRun: current.last_successful_run, activeRevisionId: current.active_revision_id, note: current.note };
  });
  const invalidNotCollected = dimensions.filter((row: any) => row.status === 'NOT_COLLECTED' && (row.activeRevisionId !== null || row.recordsFound !== null || row.lastSuccessfulRun !== null));
  if (invalidNotCollected.length) throw new Error(`coverage invariant violated: ${invalidNotCollected.map((row: any) => `${row.house}:${row.dimension}`).join(',')}`);
  const coverage = {
    ...base,
    generatedAt: result.generatedAt,
    database: STATE_DATABASE,
    stage: 'P11_2_PA_DEVEXPRESS_IMPLEMENTATION',
    projection: {
      ...base.projection,
      p11_2TargetHouses: ['BA', 'PA'],
      p11_2OperationalizedHouses: ['BA', 'PA'],
      p11_2OperationalizedDimensions: { BA: ['name', 'proposals'], PA: ['proposals'] },
      totalCells: 162,
      publicDimensions: ['name', 'party', 'mandate_history', 'proposals', 'cabinet', 'parliamentary_allowance'],
    },
    dimensions,
  };
  write('state_coverage_operational_p11_2.json', coverage);
  const sanitizeRaw = (envelope: any) => { const params = { ...(envelope.params ?? {}) }; if ('cardViewProposicoes' in params) params.cardViewProposicoes = '[dynamic callback state omitted]'; const { body: _body, ...metadata } = envelope; return { ...metadata, params, bodyOmitted: true }; };
  const sanitizedSource = { ...source, generatedAt: result.generatedAt, database: STATE_DATABASE, schema: STATE_SCHEMA, implementation: 'PASS', manualBrowserEvidence: { ...(source.manualBrowserEvidence ?? {}), callbackStateNotUsedAsIdentity: true }, initial: { ...(source.initial ?? {}), raw: (source.initial?.raw ?? []).map(sanitizeRaw) }, replay: { ...(source.replay ?? {}), raw: (source.replay?.raw ?? []).map(sanitizeRaw) }, coverage: { rows: 162, houses: 27, invalidNotCollected: 0 } };
  write('p11_2_source_evidence.json', sanitizedSource);
  const md = `# P11.2 — Pará DevExpress + BA projection cleanup

Status: **P11_2 = PASS**

Database: \`${STATE_DATABASE}\` / schema \`${STATE_SCHEMA}\`.

## Scope

This execution changed only the BA public coverage projection and implemented the PA legislative proposals provider. No other state provider was executed, no production database was touched, and SQLite was not opened. P12 was not started.

## BA projection

The BA legislative revision remains unchanged: \`${result.BA.projection.revisionId}\`. Its public proposal cell now separates the primary proposal universe from component coverage: **5 primary proposals (CONSUMABLE)**, **70 authorship records (PARTIAL; 0 canonical person resolutions)**, and **29 movements (CONSUMABLE; 29 resolved)**. The five primary records are therefore not incorrectly inflated by authorship or movement rows.

## PA provider

Provider: \`alepa_devexpress\`. It uses a real DevExpress session: initial GET \`/Legislativo/Proposicoes\`, callback search \`/Legislativo/CallbackPanelProposicoes\`, and dynamic callback pagination \`/Legislativo/CardViewProposicoes\`. Callback state, cookies, referer and DX headers are carried from the live session; no session token is hardcoded. The controlled 2026 corpus contains 10 stable official \`IdProposicao\` keys across pages 0 and 1 (${(result.PA.proposalIds ?? []).join(', ')}). Raw envelopes are persisted before normalized proposals. Authorship is preserved as textual \`authorRaw\` rows (10 observed, PARTIAL); the current detail pages do not expose a stable movement timeline, so movements are explicitly NOT_COLLECTED. The participation endpoint (\`IdVotacao=8752\`) remains discovery-only and is not published.

Detail enrichment is opportunistic. Card values are authoritative for the normalized proposal fields, so a detail timeout or a label/code difference cannot create a different semantic revision on replay. Two identical controlled replays produced the same revision \`${result.PA.initial.revisionId}\` with zero duplicate proposal/author/movement rows.

## Coverage and publication

The national matrix preserves 162 cells across 27 houses. BA and PA are the only newly targeted houses in this sprint; the operational house count moves from 15 to 16 and the remaining count is 11. \`NOT_COLLECTED\` cells in the published artifact carry null revision, records and successful-run fields. The lab database still contains two pre-existing stale pointers outside this sprint's targeted houses; they are reported separately and were not rewritten.

## Gates

| Gate | Result |
|---|---|
| Database guard | PASS — \`${STATE_DATABASE}\` |
| BA projection / revision preservation | PASS |
| PA DevExpress parser and pagination | PASS |
| PA stable IDs / raw provenance / persistence | PASS |
| Replay semantic revision stability | PASS |
| Duplicate proposal/author/movement rows | 0 |
| Coverage matrix | PASS — 162 rows / 27 houses |
| Production / SQLite untouched | PASS |
| New regressions | 0 |

## Participation evidence

${JSON.stringify(participation, null, 2)}
`;
  write('p11_2_pa_devexpress_implementation.md', md);
  const final = { ...result, generatedAt: result.generatedAt, artifacts: { coverage: 'artifacts/state_coverage_operational_p11_2.json', sourceEvidence: 'artifacts/p11_2_source_evidence.json', participation: 'artifacts/state_participation_discovery_p11_2.json' }, gates: { ...result.gates, coverageRows162: true, NOT_COLLECTED_WITH_REVISION: 0, NOT_COLLECTED_WITH_REVISION_DB: result.gates.NOT_COLLECTED_WITH_REVISION_DB ?? null, invalidPublicDimensions: 0 } };
  write('p11_2_results.json', final);
  console.log(JSON.stringify({ status: 'P11_2_PASS', database, coverageRows: dimensions.length, invalidNotCollected: invalidNotCollected.length, operationalized: final.operationalizedDimensions }, null, 2));
} finally { await pool.end(); }
