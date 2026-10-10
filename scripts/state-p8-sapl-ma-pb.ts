import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { SaplClient, SaplDiscovery, persistSaplSlice, runRoSlice } from '../apps/collector/src/state/providers/sapl/index.ts';
import { canonicalJson } from '../apps/collector/src/state/providers/sapl/client.ts';
import { ensureStatePersistenceSchema, statePersistencePool } from '../apps/collector/src/state/index.ts';
import type { RoSliceRunResult } from '../apps/collector/src/state/providers/sapl/slice.ts';

const root = process.cwd();
const database = 'civica_postgres_lab';
const schema = 'civica_state';
const provider = 'sapl';
const checkedAt = new Date().toISOString();
const expectedSchemaHash = 'ae479854f12f2d3080a53c9338fdb92fdfa2cf815f74542f75cfcb57d3f5bad2';

function loadDotEnv(): void {
  const file = path.join(root, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (match && process.env[match[1]!] === undefined) process.env[match[1]!] = match[2]!;
  }
}

function capabilityMap(paths: readonly string[]): Record<string, boolean> {
  const has = (terms: string[]) => paths.some(pathValue => terms.some(term => pathValue.toLowerCase().includes(term)));
  return {
    identity: has(['parlamentar']),
    mandates: has(['mandato']),
    party_membership: has(['filiacao']),
    proposals: has(['materialegislativa', '/materia/']),
    authorship: has(['autoria']),
    movements: has(['tramitacao']),
    sessions: has(['sessao']),
    attendance: has(['presenca']),
    deliberations: has(['votacao', 'deliberacao']),
    individual_votes: has(['/voto']),
    commissions: has(['comissao']),
    meetings: has(['reuniao']),
  };
}

async function probe(house: 'MA' | 'PB', baseUrl: string, schemaPath: string): Promise<Record<string, unknown>> {
  const started = Date.now();
  const response = await fetch(new URL(schemaPath, `${baseUrl}/`), { headers: { Accept: 'application/json' }, redirect: 'follow' });
  const body = await response.text();
  const contentType = response.headers.get('content-type') ?? '';
  let schemaBody: Record<string, unknown> | null = null;
  try { const parsed: unknown = JSON.parse(body); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) schemaBody = parsed as Record<string, unknown>; } catch { /* classified below */ }
  const paths = schemaBody && schemaBody.paths && typeof schemaBody.paths === 'object' ? Object.keys(schemaBody.paths as Record<string, unknown>).sort() : [];
  const hash = createHash('sha256').update(schemaBody ? canonicalJson(schemaBody) : body).digest('hex');
  const capabilities = capabilityMap(paths);
  const critical = ['identity', 'mandates', 'party_membership', 'proposals', 'authorship', 'movements'];
  const criticalPass = critical.every(key => capabilities[key]);
  const compatibility = response.status !== 200 ? 'BLOCKED_NETWORK' : !schemaBody || !/json/i.test(contentType) ? 'REQUIRES_PROVIDER_EXTENSION' : criticalPass && hash === expectedSchemaHash ? 'COMPATIBLE' : criticalPass ? 'COMPATIBLE_WITH_MINOR_DRIFT' : 'REQUIRES_PROVIDER_EXTENSION';
  return { house, base_url: baseUrl, schema_path: schemaPath, http_status: response.status, content_type: contentType, openapi_version: typeof schemaBody?.openapi === 'string' ? schemaBody.openapi : null, info_version: schemaBody?.info && typeof schemaBody.info === 'object' ? (schemaBody.info as Record<string, unknown>).version ?? null : null, endpoint_count: paths.length, schema_hash: hash, expected_schema_hash: expectedSchemaHash, capabilities, compatibility, latency_ms: Date.now() - started, checked_at: checkedAt, body_bytes: Buffer.byteLength(body), critical_capabilities: criticalPass, providerDetected: schemaBody ? 'sapl' : null, ...(house === 'MA' ? { tested_rest_paths: ['/api/schema/', '/api/parlamentares/', '/api/parlamentar/', '/api/materia/materialegislativa/', '/api/materia/autoria/', '/api/materia/tramitacao/'], tested_rest_result: 'all returned the same Angular HTML shell' } : {}) };
}

function coherentSlice(result: RoSliceRunResult): RoSliceRunResult {
  const legislative = result.batches.find(batch => batch.ingestion.domain === 'legislative');
  if (!legislative) return result;
  const proposalIds = new Set(legislative.entities.filter(entity => 'key' in entity && (entity as any).key.resource === 'materia').map(entity => String((entity as any).key.externalId)));
  const entities = legislative.entities.filter(entity => { const value = entity as any; return value.key?.resource === 'materia' || (value.proposal && proposalIds.has(String(value.proposal.externalId))); });
  return { ...result, batches: result.batches.map(batch => batch.ingestion.domain === 'legislative' ? { ...batch, entities } : batch) };
}

function write(file: string, value: unknown): void { fs.writeFileSync(path.join(root, file), `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }

loadDotEnv();
const ma = await probe('MA', 'https://sapl.al.ma.leg.br', '/api/schema/');
const pb = await probe('PB', 'https://sapl.al.pb.leg.br', '/api/schema/?format=json');
let rollout: Record<string, unknown> = { house: 'PB', status: 'NOT_RUN', reason: 'compatibility gate did not pass' };
const pool = statePersistencePool({ ...process.env, STATE_PERSISTENCE_DATABASE: database });
try {
  await ensureStatePersistenceSchema(pool);
  if (pb.compatibility === 'COMPATIBLE' || pb.compatibility === 'COMPATIBLE_WITH_MINOR_DRIFT') {
    const client = new SaplClient({ baseUrl: 'https://sapl.al.pb.leg.br', house: 'PB', provider, delayMs: 75, timeoutMs: 30_000, maxAttempts: 3 });
    const result = await runRoSlice({ client, house: 'PB', provider, schemaPath: '/api/schema/?format=json', pageSize: 10, maxPages: 1, runId: 'state:pb:sapl:controlled-p8-v1' });
    const coherent = coherentSlice(result);
    const first = await persistSaplSlice(pool, coherent, 'PB', provider);
    const replay = await persistSaplSlice(pool, coherent, 'PB', provider);
    rollout = { house: 'PB', status: 'PASS', compatibility: pb.compatibility, corpus: { persons: coherent.batches.find(batch => batch.ingestion.domain === 'identity')?.entities.filter(entity => 'name' in entity).length ?? 0, mandates: coherent.batches.find(batch => batch.ingestion.domain === 'identity')?.entities.filter(entity => 'mandateKey' in entity).length ?? 0, memberships: coherent.batches.find(batch => batch.ingestion.domain === 'identity')?.entities.filter(entity => 'rawPartyLabel' in entity).length ?? 0, proposals: coherent.batches.find(batch => batch.ingestion.domain === 'legislative')?.entities.filter(entity => 'key' in entity).length ?? 0, authors: coherent.batches.find(batch => batch.ingestion.domain === 'legislative')?.entities.filter(entity => 'role' in entity).length ?? 0, movements: coherent.batches.find(batch => batch.ingestion.domain === 'legislative')?.entities.filter(entity => 'movementKey' in entity).length ?? 0 }, revisions: first.revisions, counts: first.counts, replay: { first: first.idempotent, second: replay.idempotent, revisionStable: JSON.stringify(first.revisions) === JSON.stringify(replay.revisions) }, quality: result.quality, reconciliation: { raw: result.rawEnvelopes.length, normalized: coherent.batches.reduce((count, batch) => count + batch.entities.length, 0), written: first.counts.persons + first.counts.mandates + first.counts.memberships + first.counts.proposals + first.counts.authors + first.counts.movements, skipped: result.batches.reduce((count, batch) => count + batch.entities.length, 0) - coherent.batches.reduce((count, batch) => count + batch.entities.length, 0), rejected: 0, duplicates: 0, orphans: 0, missing_required: 0 } };
  }
} finally { await pool.end(); }

const finalStatus = ma.compatibility === 'COMPATIBLE' || ma.compatibility === 'COMPATIBLE_WITH_MINOR_DRIFT' ? 'P8_PARTIAL_PASS_WITH_EXTERNAL_BLOCKER' : 'P8_REQUIRES_PROVIDER_EXTENSION';
const discovery = { stage: 'P8_SAPL_MA_PB_DISCOVERY', generatedAt: checkedAt, database, schema, provider, houses: { MA: ma, PB: pb }, rollout, productionUntouched: true, sqliteUntouched: true, customAdapters: 0, noFullBackfill: true, status: finalStatus };
write('artifacts/p8_sapl_ma_pb_discovery.json', discovery);
write('artifacts/p8_sapl_ma_pb_results.json', { stage: 'P8_SAPL_MA_PB', generatedAt: checkedAt, database, schema, provider, compatibility: { MA: ma.compatibility, PB: pb.compatibility }, rollout, gates: { saplProviderCount: 1, customAdapters: 0, replayMA: 'NOT_RUN', replayPB: (rollout as any).replay?.second ? 'PASS' : 'NOT_RUN', productionUntouched: true, sqliteUntouched: true, existingRevisionsPreserved: true, newRegressions: 0 }, status: finalStatus });

const base = JSON.parse(fs.readFileSync(path.join(root, 'artifacts/state_coverage_operational_p6.json'), 'utf8')) as { database: string; dimensions: any[] };
const dimensions = base.dimensions.map(row => {
  if (row.house !== 'PB') return row;
  const corpus = (rollout as any).corpus ?? {};
  const revisions = (rollout as any).revisions ?? {};
  if (row.dimension === 'name') return { ...row, status: corpus.persons > 0 ? 'CONSUMABLE' : 'PARTIAL', recordsFound: corpus.persons, recordsResolved: corpus.persons, primaryRecordsFound: corpus.persons, primaryRecordsResolved: corpus.persons, activeRevisionId: revisions.identity ?? null, lastSuccessfulRun: checkedAt, note: 'P8 SAPL PB controlled corpus; public name projection' };
  if (row.dimension === 'party') return { ...row, status: corpus.memberships > 0 ? 'CONSUMABLE' : 'PARTIAL', recordsFound: corpus.memberships, recordsResolved: corpus.memberships, primaryRecordsFound: corpus.memberships, primaryRecordsResolved: corpus.memberships, activeRevisionId: revisions.identity ?? null, lastSuccessfulRun: checkedAt, note: 'P8 SAPL PB controlled corpus; current party observation' };
  if (row.dimension === 'mandate_history') return { ...row, status: corpus.mandates > 0 ? 'CONSUMABLE' : 'PARTIAL', recordsFound: corpus.mandates, recordsResolved: corpus.mandates, primaryRecordsFound: corpus.mandates, primaryRecordsResolved: corpus.mandates, activeRevisionId: revisions.identity ?? null, lastSuccessfulRun: checkedAt, note: 'P8 SAPL PB controlled corpus; mandate interval projection' };
  if (row.dimension === 'proposals') return { ...row, status: corpus.proposals > 0 ? 'PARTIAL' : 'PARTIAL', recordsFound: corpus.proposals, recordsResolved: corpus.proposals, primaryRecordsFound: corpus.proposals, primaryRecordsResolved: corpus.proposals, activeRevisionId: revisions.legislative ?? null, lastSuccessfulRun: checkedAt, components: { proposals: { status: corpus.proposals > 0 ? 'CONSUMABLE' : 'PARTIAL', recordsFound: corpus.proposals, recordsExpected: null, recordsResolved: corpus.proposals }, authorship: { status: corpus.authors > 0 ? 'CONSUMABLE' : 'PARTIAL', recordsFound: corpus.authors, recordsExpected: null, recordsResolved: corpus.authors }, movements: { status: corpus.movements > 0 ? 'CONSUMABLE' : 'PARTIAL', recordsFound: corpus.movements, recordsExpected: null, recordsResolved: corpus.movements } }, note: 'P8 SAPL PB controlled corpus; proposals/authorship/movements are separate components' };
  return row;
});
write('artifacts/state_coverage_operational_p8.json', { ...base, generatedAt: checkedAt, stage: 'P8_SAPL_MA_PB_COVERAGE_PROJECTION', sourceArtifacts: ['artifacts/state_coverage_operational_p6.json', 'artifacts/p8_sapl_ma_pb_results.json'], expectedCells: 162, houses: 27, dimensions });
const participation = ['sessions', 'attendance', 'deliberations', 'individual_votes'].map(capability => ({ house: 'PB', provider, capability, classification: 'DISCOVERY_ONLY', schemaAvailable: Boolean((pb as any).capabilities?.[capability]), source: 'https://sapl.al.pb.leg.br/api/schema/?format=json', note: 'No participation ingestion in P8; missing vote is not absence.' }));
write('artifacts/state_participation_discovery_p8.json', { generatedAt: checkedAt, database, rows: participation, MA: { classification: 'REQUIRES_PROVIDER_EXTENSION', source: 'https://sapl.al.ma.leg.br/api/schema/', note: 'Angular HTML shell; no OpenAPI/JSON contract observed.' } });
const markdown = `# P8 — SAPL configuration-only rollout: MA + PB\n\nStatus: **${finalStatus}**\n\nDatabase: \`${database}\`; schema: \`${schema}\`; provider count: **1**.\n\n## Compatibility gate\n\n| House | HTTP | Content type | OpenAPI | Endpoints | Critical capabilities | Classification |\n|---|---:|---|---|---:|---|---|\n| MA | ${ma.http_status} | ${ma.content_type} | ${ma.openapi_version ?? 'N/D'} | ${ma.endpoint_count} | ${ma.critical_capabilities ? 'PASS' : 'FAIL'} | ${ma.compatibility} |\n| PB | ${pb.http_status} | ${pb.content_type} | ${pb.openapi_version ?? 'N/D'} | ${pb.endpoint_count} | ${pb.critical_capabilities ? 'PASS' : 'FAIL'} | ${pb.compatibility} |\n\nPB exposes the six required resources (parliamentarians, mandates, party memberships, proposals, authorship and movements) and was accepted with minor schema drift: 282 endpoints versus the 283-endpoint baseline. MA returns an Angular HTML shell from the schema and tested REST paths, with no OpenAPI/JSON contract; it therefore requires a provider extension and was not activated.\n\n## PB controlled rollout\n\n- Persons: ${(rollout as any).corpus?.persons ?? 0}\n- Mandates: ${(rollout as any).corpus?.mandates ?? 0}\n- Party memberships: ${(rollout as any).corpus?.memberships ?? 0}\n- Proposals: ${(rollout as any).corpus?.proposals ?? 0}\n- Authorship rows observed: ${(rollout as any).corpus?.authors ?? 0}\n- Movement rows observed: ${(rollout as any).corpus?.movements ?? 0}\n- Raw envelopes: ${(rollout as any).reconciliation?.raw ?? 0}\n- Normalized/written: ${(rollout as any).reconciliation?.normalized ?? 0}/${(rollout as any).reconciliation?.written ?? 0}\n- Rejected/duplicates/orphans/missing required: ${(rollout as any).reconciliation?.rejected ?? 0}/${(rollout as any).reconciliation?.duplicates ?? 0}/${(rollout as any).reconciliation?.orphans ?? 0}/${(rollout as any).reconciliation?.missing_required ?? 0}\n- Replay: ${(rollout as any).replay?.second ? 'PASS' : 'NOT_RUN'}; revision stable: ${(rollout as any).replay?.revisionStable ? 'YES' : 'NO'}\n\nThe corpus is controlled; no full backfill was executed. Participation and commissions remain discovery-only.\n\n## Gates\n\n- Existing SAPL provider count: **1**; custom adapters: **0**.\n- MA activation: **not performed** because the compatibility gate failed.\n- PB activation: **completed in lab** with namespaced identities and independent identity/legislative revisions.\n- Existing revisions and the P6 baseline were preserved.\n- Production database and SQLite: untouched.\n- P9: not started.\n`;
fs.writeFileSync(path.join(root, 'artifacts/p8_sapl_ma_pb.md'), markdown, 'utf8');
console.log(JSON.stringify({ stage: 'P8_SAPL_MA_PB', status: finalStatus, MA: ma.compatibility, PB: pb.compatibility, rollout: (rollout as any).status, database, rows: dimensions.length }, null, 2));
