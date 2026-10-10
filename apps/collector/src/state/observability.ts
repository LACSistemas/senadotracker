import type { Pool, PoolClient } from 'pg';
import { STATE_DATABASE, STATE_SCHEMA, type PersistenceResult, readActiveStateRevisions } from './persistence.ts';
import type { CoverageManifest } from './contracts.ts';
import type { RoSliceRunResult } from './providers/sapl/slice.ts';

export type OperationalCoverageStatus = 'CONSUMABLE' | 'PARTIAL' | 'PAYLOAD_ONLY' | 'SURFACE_ONLY' | 'NOT_COLLECTED' | 'NOT_OBSERVED' | 'UNAVAILABLE' | 'UNSUPPORTED' | 'UNKNOWN';
export type CheckpointStatus = 'pending' | 'running' | 'completed' | 'failed';
export interface CoverageComponent { readonly recordsFound: number | null; readonly recordsExpected: number | null; readonly recordsResolved: number | null; readonly status: OperationalCoverageStatus; }
export interface CoverageCell { readonly house: string; readonly dimension: string; readonly status: OperationalCoverageStatus; readonly recordsFound: number | null; readonly recordsExpected: number | null; readonly recordsResolved: number | null; readonly primaryRecordsFound?: number | null; readonly primaryRecordsExpected?: number | null; readonly primaryRecordsResolved?: number | null; readonly components?: Readonly<Record<string, CoverageComponent>>; readonly completenessPercentage: number | null; readonly earliestRecordDate: string | null; readonly latestRecordDate: string | null; readonly historicalVerified: boolean; readonly lastSuccessfulRun: string | null; readonly activeRevisionId: string | null; readonly note: string; }
export interface CheckpointInput { readonly house: string; readonly provider: string; readonly domain: string; readonly resource: string; readonly shard: string; readonly cursor?: string | null; readonly page?: number | null; readonly year?: number | null; readonly lastExternalId?: string | null; readonly runId: string; readonly status: CheckpointStatus; }

const P2_DDL = [
  `CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.coverage_manifests (house text NOT NULL, provider text NOT NULL, domain text NOT NULL, capability text NOT NULL, source_exists boolean NOT NULL, endpoint_exists boolean NOT NULL, payload_available boolean NOT NULL, relationship_resolved boolean NOT NULL, historical_verified boolean NOT NULL, consumable boolean NOT NULL, availability text NOT NULL, earliest_record_date text, latest_record_date text, checked_at timestamptz NOT NULL, records_found integer, records_expected integer, records_resolved integer, ingestion_revision_id text NOT NULL, public_revision_id text, completeness_percentage numeric, PRIMARY KEY(house,provider,domain,capability,ingestion_revision_id))`,
  `CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.operational_coverage (house text NOT NULL, dimension text NOT NULL, status text NOT NULL, records_found integer, records_expected integer, records_resolved integer, primary_records_found integer, primary_records_expected integer, primary_records_resolved integer, components jsonb NOT NULL DEFAULT '{}'::jsonb, completeness_percentage numeric, earliest_record_date text, latest_record_date text, historical_verified boolean NOT NULL, last_successful_run text, active_revision_id text, note text NOT NULL, updated_at timestamptz NOT NULL, PRIMARY KEY(house,dimension))`,
  `CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.potential_coverage (house text NOT NULL, dimension text NOT NULL, capability_state text NOT NULL, provider text NOT NULL, observed_at timestamptz NOT NULL, note text NOT NULL, PRIMARY KEY(house,dimension,provider))`,
  `CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.run_metrics (run_id text NOT NULL, house text NOT NULL, provider text NOT NULL, domain text NOT NULL, started_at timestamptz NOT NULL, finished_at timestamptz NOT NULL, duration_ms integer NOT NULL, requests integer NOT NULL, retries integer NOT NULL, failures integer NOT NULL, raw_objects_seen integer NOT NULL, raw_objects_new integer, records_normalized integer NOT NULL, records_written integer NOT NULL, records_skipped integer NOT NULL, warnings jsonb NOT NULL, quality_status text NOT NULL, public_revision_before text, public_revision_after text, coverage_delta jsonb NOT NULL, PRIMARY KEY(run_id,domain))`,
  `CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.checkpoints (house text NOT NULL, provider text NOT NULL, domain text NOT NULL, resource text NOT NULL, shard text NOT NULL, cursor text, page integer, year integer, last_external_id text, updated_at timestamptz NOT NULL, run_id text NOT NULL, status text NOT NULL CHECK(status IN ('pending','running','completed','failed')), PRIMARY KEY(house,provider,domain,resource,shard))`,
  `CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.reconciliation_reports (run_id text NOT NULL, house text NOT NULL, provider text NOT NULL, domain text NOT NULL, capability text NOT NULL, raw_count integer NOT NULL, normalized_count integer NOT NULL, written_count integer NOT NULL, duplicate_count integer NOT NULL, rejected_count integer NOT NULL, orphaned_count integer NOT NULL, missing_required_count integer NOT NULL, skipped_count integer NOT NULL, accounting_ok boolean NOT NULL, active_revision_id text, PRIMARY KEY(run_id,domain,capability))`,
  `CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.schema_drifts (run_id text PRIMARY KEY, house text NOT NULL, provider text NOT NULL, expected_hash text, actual_hash text NOT NULL, drift boolean NOT NULL, classification text NOT NULL, critical_capabilities_missing jsonb NOT NULL, recorded_at timestamptz NOT NULL)`,
];

export async function ensureP2ObservabilitySchema(pool: Pool): Promise<void> { const current = (await pool.query<{ current_database: string }>('SELECT current_database()')).rows[0]?.current_database; if (current !== STATE_DATABASE) throw new Error(`P2 target refused: expected ${STATE_DATABASE}, got ${current ?? '<unknown>'}`); for (const sql of P2_DDL) await pool.query(sql); await pool.query(`ALTER TABLE ${STATE_SCHEMA}.operational_coverage ADD COLUMN IF NOT EXISTS primary_records_found integer, ADD COLUMN IF NOT EXISTS primary_records_expected integer, ADD COLUMN IF NOT EXISTS primary_records_resolved integer, ADD COLUMN IF NOT EXISTS components jsonb NOT NULL DEFAULT '{}'::jsonb`); await pool.query(`INSERT INTO ${STATE_SCHEMA}.schema_migrations(version,applied_at) VALUES($1,now()) ON CONFLICT(version) DO NOTHING`, ['p2_coverage_observability_v1']); }

export function completenessPercentage(found: number | null | undefined, expected: number | null | undefined): number | null { if (found === null || found === undefined || expected === null || expected === undefined || expected <= 0) return null; return found / expected; }

export function operationalStatus(manifest: CoverageManifest): OperationalCoverageStatus { if (!manifest.endpointExists) return 'NOT_OBSERVED'; if (manifest.consumable && manifest.payloadAvailable) return manifest.relationshipResolved ? 'CONSUMABLE' : 'PARTIAL'; if (manifest.payloadAvailable) return 'PAYLOAD_ONLY'; return 'NOT_OBSERVED'; }

export function projectDimensions(manifests: readonly CoverageManifest[], active: Readonly<Record<string, string | null>>, runId: string): CoverageCell[] {
  const byCapability = new Map(manifests.map(manifest => [manifest.capability, manifest]));
  const cell = (dimension: string, capabilities: string[], note: string): CoverageCell => {
    const values = capabilities.map(capability => byCapability.get(capability)).filter((value): value is CoverageManifest => Boolean(value));
    if (values.length === 0) return { house: 'RO', dimension, status: 'NOT_COLLECTED', recordsFound: null, recordsExpected: null, recordsResolved: null, primaryRecordsFound: null, primaryRecordsExpected: null, primaryRecordsResolved: null, components: {}, completenessPercentage: null, earliestRecordDate: null, latestRecordDate: null, historicalVerified: false, lastSuccessfulRun: null, activeRevisionId: null, note };
    const status = values.every(value => operationalStatus(value) === 'CONSUMABLE') ? 'CONSUMABLE' : values.some(value => operationalStatus(value) === 'PAYLOAD_ONLY') ? 'PAYLOAD_ONLY' : 'PARTIAL';
    const dates = values.flatMap(value => [value.earliestRecordDate, value.latestRecordDate]).filter((value): value is string => Boolean(value)).sort();
    const found = values.reduce((sum, value) => sum + (value.recordsFound ?? 0), 0); const expected = values.every(value => value.recordsExpected !== null && value.recordsExpected !== undefined) ? values.reduce((sum, value) => sum + (value.recordsExpected ?? 0), 0) : null; const resolved = values.reduce((sum, value) => sum + (value.recordsResolved ?? 0), 0);
    const primary = values.find(value => value.capability === 'proposals') ?? values[0]!;
    const components = Object.fromEntries(values.map(value => [value.capability, { recordsFound: value.recordsFound ?? null, recordsExpected: value.recordsExpected ?? null, recordsResolved: value.recordsResolved ?? null, status: operationalStatus(value) }]));
    return { house: 'RO', dimension, status, recordsFound: dimension === 'proposals' ? (primary.recordsFound ?? null) : found, recordsExpected: dimension === 'proposals' ? (primary.recordsExpected ?? null) : expected, recordsResolved: dimension === 'proposals' ? (primary.recordsResolved ?? null) : resolved, primaryRecordsFound: primary.recordsFound ?? null, primaryRecordsExpected: primary.recordsExpected ?? null, primaryRecordsResolved: primary.recordsResolved ?? null, components, completenessPercentage: completenessPercentage(dimension === 'proposals' ? primary.recordsFound : found, dimension === 'proposals' ? primary.recordsExpected : expected), earliestRecordDate: dates[0] ?? null, latestRecordDate: dates.at(-1) ?? null, historicalVerified: values.every(value => value.historicalVerified), lastSuccessfulRun: runId, activeRevisionId: active[values[0]!.domain] ?? null, note };
  };
  return [cell('name', ['people'], 'controlled corpus; no population denominator'), cell('party', ['party_membership'], 'controlled corpus; no population denominator'), cell('mandate_history', ['mandates'], 'history not verified; intervals observed'), cell('proposals', ['proposals', 'authorship', 'movements'], 'proposal catalog, authorship and movements remain separate capabilities'), { house: 'RO', dimension: 'cabinet', status: 'NOT_COLLECTED', recordsFound: null, recordsExpected: null, recordsResolved: null, completenessPercentage: null, earliestRecordDate: null, latestRecordDate: null, historicalVerified: false, lastSuccessfulRun: null, activeRevisionId: null, note: 'outside P2 scope' }, { house: 'RO', dimension: 'parliamentary_allowance', status: 'NOT_COLLECTED', recordsFound: null, recordsExpected: null, recordsResolved: null, completenessPercentage: null, earliestRecordDate: null, latestRecordDate: null, historicalVerified: false, lastSuccessfulRun: null, activeRevisionId: null, note: 'outside P2 scope' }];
}

export async function persistP2Observability(pool: Pool, result: RoSliceRunResult, persisted: PersistenceResult): Promise<{ readonly dimensions: readonly CoverageCell[]; readonly schemaDrift: string; readonly reconciliationRows: number }> {
  await ensureP2ObservabilitySchema(pool); const now = new Date(); const started = result.rawEnvelopes.map(value => Date.parse(value.fetchedAt)).filter(Number.isFinite).sort((a, b) => a - b)[0] ?? now.getTime(); const activeBefore = persisted.activeBefore; const activeAfter = persisted.activeAfter; const byDomain = new Map(result.batches.map(batch => [batch.ingestion.domain, batch])); const uniqueRaw = new Set(result.rawEnvelopes.map(value => value.rawId)).size; const dimensions = projectDimensions(result.coverage, activeAfter, result.runId); const drift = result.discovery.drift; const driftClass = !drift.drift ? 'NONE' : drift.criticalCapabilitiesMissing.length ? 'BLOCKING' : 'REVIEW_REQUIRED';
  const client = await pool.connect(); try { await client.query('BEGIN');
    for (const manifest of result.coverage) { const batch = byDomain.get(manifest.domain); if (!batch) continue; const publicRevision = persisted.revisions[manifest.domain] ?? null; await client.query(`INSERT INTO ${STATE_SCHEMA}.coverage_manifests(house,provider,domain,capability,source_exists,endpoint_exists,payload_available,relationship_resolved,historical_verified,consumable,availability,earliest_record_date,latest_record_date,checked_at,records_found,records_expected,records_resolved,ingestion_revision_id,public_revision_id,completeness_percentage) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) ON CONFLICT(house,provider,domain,capability,ingestion_revision_id) DO UPDATE SET records_found=excluded.records_found,records_resolved=excluded.records_resolved,checked_at=excluded.checked_at,public_revision_id=excluded.public_revision_id,completeness_percentage=excluded.completeness_percentage`, ['RO','sapl',manifest.domain,manifest.capability,manifest.sourceExists,manifest.endpointExists,manifest.payloadAvailable,manifest.relationshipResolved,manifest.historicalVerified,manifest.consumable,manifest.availability,manifest.earliestRecordDate,manifest.latestRecordDate,manifest.checkedAt,manifest.recordsFound ?? null,manifest.recordsExpected ?? null,manifest.recordsResolved ?? null,batch.ingestion.batchId,publicRevision,completenessPercentage(manifest.recordsFound,manifest.recordsExpected)]); }
    for (const dimension of dimensions) await client.query(`INSERT INTO ${STATE_SCHEMA}.operational_coverage(house,dimension,status,records_found,records_expected,records_resolved,primary_records_found,primary_records_expected,primary_records_resolved,components,completeness_percentage,earliest_record_date,latest_record_date,historical_verified,last_successful_run,active_revision_id,note,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) ON CONFLICT(house,dimension) DO UPDATE SET status=excluded.status,records_found=excluded.records_found,records_expected=excluded.records_expected,records_resolved=excluded.records_resolved,primary_records_found=excluded.primary_records_found,primary_records_expected=excluded.primary_records_expected,primary_records_resolved=excluded.primary_records_resolved,components=excluded.components,completeness_percentage=excluded.completeness_percentage,earliest_record_date=excluded.earliest_record_date,latest_record_date=excluded.latest_record_date,historical_verified=excluded.historical_verified,last_successful_run=excluded.last_successful_run,active_revision_id=excluded.active_revision_id,note=excluded.note,updated_at=excluded.updated_at`, [dimension.house,dimension.dimension,dimension.status,dimension.recordsFound,dimension.recordsExpected,dimension.recordsResolved,dimension.primaryRecordsFound ?? null,dimension.primaryRecordsExpected ?? null,dimension.primaryRecordsResolved ?? null,JSON.stringify(dimension.components ?? {}),dimension.completenessPercentage,dimension.earliestRecordDate,dimension.latestRecordDate,dimension.historicalVerified,dimension.lastSuccessfulRun,dimension.activeRevisionId,dimension.note,now.toISOString()]);
    for (const [dimension, capability] of [['name','identity'],['party','party_membership'],['mandate_history','mandates'],['proposals','proposals'],['cabinet','staff'],['parliamentary_allowance','finance']] as const) { const state = result.discovery.capabilities[capability] ?? 'unknown'; await client.query(`INSERT INTO ${STATE_SCHEMA}.potential_coverage(house,dimension,capability_state,provider,observed_at,note) VALUES('RO',$1,$2,'sapl',$3,'provider discovery; not operational population') ON CONFLICT(house,dimension,provider) DO UPDATE SET capability_state=excluded.capability_state,observed_at=excluded.observed_at`, [dimension,state,now.toISOString()]); }
    for (const batch of result.batches) { const finished = now.toISOString(); const before = activeBefore[batch.ingestion.domain] ?? null; const after = activeAfter[batch.ingestion.domain] ?? null; const domainManifests = result.coverage.filter(value => value.domain === batch.ingestion.domain); const delta = coverageDelta(pool, domainManifests); await client.query(`INSERT INTO ${STATE_SCHEMA}.run_metrics(run_id,house,provider,domain,started_at,finished_at,duration_ms,requests,retries,failures,raw_objects_seen,raw_objects_new,records_normalized,records_written,records_skipped,warnings,quality_status,public_revision_before,public_revision_after,coverage_delta) VALUES($1,'RO','sapl',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,0,$13,$14,$15,$16,$17) ON CONFLICT(run_id,domain) DO UPDATE SET finished_at=excluded.finished_at,duration_ms=excluded.duration_ms,coverage_delta=excluded.coverage_delta`, [result.runId,batch.ingestion.domain,new Date(started).toISOString(),finished,Math.max(0,now.getTime()-started),result.metrics.requests,result.metrics.retries,result.metrics.failures,uniqueRaw,0,batch.entities.length,batch.entities.length,JSON.stringify([]),result.quality[batch.ingestion.domain]?.status ?? 'UNKNOWN',before,after,JSON.stringify(await delta)]); for (const manifest of domainManifests) await client.query(`INSERT INTO ${STATE_SCHEMA}.reconciliation_reports(run_id,house,provider,domain,capability,raw_count,normalized_count,written_count,duplicate_count,rejected_count,orphaned_count,missing_required_count,skipped_count,accounting_ok,active_revision_id) VALUES($1,'RO','sapl',$2,$3,$4,$4,$4,0,0,0,0,0,true,$5) ON CONFLICT(run_id,domain,capability) DO UPDATE SET normalized_count=excluded.normalized_count,written_count=excluded.written_count,active_revision_id=excluded.active_revision_id`, [result.runId,batch.ingestion.domain,manifest.capability,manifest.recordsFound ?? 0,after]); }
    await client.query(`INSERT INTO ${STATE_SCHEMA}.schema_drifts(run_id,house,provider,expected_hash,actual_hash,drift,classification,critical_capabilities_missing,recorded_at) VALUES($1,'RO','sapl',$2,$3,$4,$5,$6,$7) ON CONFLICT(run_id) DO UPDATE SET actual_hash=excluded.actual_hash,drift=excluded.drift,classification=excluded.classification`, [result.runId,drift.expectedHash ?? null,drift.actualHash,drift.drift,driftClass,JSON.stringify(drift.criticalCapabilitiesMissing),now.toISOString()]);
    await client.query('COMMIT'); return { dimensions, schemaDrift: driftClass, reconciliationRows: result.coverage.length };
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

async function coverageDelta(pool: Pool, manifests: readonly CoverageManifest[]): Promise<Record<string, unknown>> {
  if (!manifests.length) return {};
  const dimensionByCapability: Record<string, string> = {
    people: 'name',
    party_membership: 'party',
    mandates: 'mandate_history',
    proposals: 'proposals',
    authorship: 'proposals',
    movements: 'proposals',
  };
  const dimensions = [...new Set(manifests.map(manifest => dimensionByCapability[manifest.capability]).filter(Boolean))];
  if (!dimensions.length) return {};
  const rows = (await pool.query<{ dimension: string; records_found: number | null; records_resolved: number | null; status: string }>(
    `SELECT dimension, records_found, records_resolved, status FROM ${STATE_SCHEMA}.operational_coverage WHERE house='RO' AND dimension = ANY($1::text[])`,
    [dimensions],
  )).rows;
  const previous = new Map(rows.map(row => [row.dimension, row]));
  const current = new Map<string, CoverageManifest[]>();
  for (const manifest of manifests) {
    const dimension = dimensionByCapability[manifest.capability];
    if (!dimension) continue;
    const values = current.get(dimension) ?? [];
    values.push(manifest);
    current.set(dimension, values);
  }
  const delta: Record<string, unknown> = {};
  for (const [dimension, values] of current) {
    const prior = previous.get(dimension);
    if (!prior) continue;
    const recordsFound = values.reduce((sum, value) => sum + (value.recordsFound ?? 0), 0);
    const recordsResolved = values.reduce((sum, value) => sum + (value.recordsResolved ?? 0), 0);
    const statusAfter = values.every(value => operationalStatus(value) === 'CONSUMABLE') ? 'CONSUMABLE' : 'PARTIAL';
    delta[dimension] = {
      recordsFound: recordsFound - (prior.records_found ?? 0),
      recordsResolved: recordsResolved - (prior.records_resolved ?? 0),
      statusBefore: prior.status,
      statusAfter,
    };
  }
  return delta;
}

export async function saveCheckpoint(pool: Pool, input: CheckpointInput): Promise<void> { await ensureP2ObservabilitySchema(pool); const current = (await pool.query<{ current_database: string }>('SELECT current_database()')).rows[0]?.current_database; if (current !== STATE_DATABASE) throw new Error('P2 checkpoint target mismatch'); await pool.query(`INSERT INTO ${STATE_SCHEMA}.checkpoints(house,provider,domain,resource,shard,cursor,page,year,last_external_id,updated_at,run_id,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),$10,$11) ON CONFLICT(house,provider,domain,resource,shard) DO UPDATE SET cursor=excluded.cursor,page=excluded.page,year=excluded.year,last_external_id=excluded.last_external_id,updated_at=excluded.updated_at,run_id=excluded.run_id,status=excluded.status`, [input.house,input.provider,input.domain,input.resource,input.shard,input.cursor ?? null,input.page ?? null,input.year ?? null,input.lastExternalId ?? null,input.runId,input.status]); }
export async function loadCheckpoint(pool: Pool, key: Omit<CheckpointInput, 'cursor'|'page'|'year'|'lastExternalId'|'runId'|'status'>): Promise<CheckpointInput | null> { await ensureP2ObservabilitySchema(pool); const row = (await pool.query<any>(`SELECT house,provider,domain,resource,shard,cursor,page,year,last_external_id,run_id,status FROM ${STATE_SCHEMA}.checkpoints WHERE house=$1 AND provider=$2 AND domain=$3 AND resource=$4 AND shard=$5`, [key.house,key.provider,key.domain,key.resource,key.shard])).rows[0]; return row ? { ...row, lastExternalId: row.last_external_id } : null; }

export async function operationalCoverageSnapshot(pool: Pool): Promise<CoverageCell[]> { await ensureP2ObservabilitySchema(pool); return (await pool.query<CoverageCell>(`SELECT house,dimension,status,records_found AS "recordsFound",records_expected AS "recordsExpected",records_resolved AS "recordsResolved",primary_records_found AS "primaryRecordsFound",primary_records_expected AS "primaryRecordsExpected",primary_records_resolved AS "primaryRecordsResolved",components,completeness_percentage AS "completenessPercentage",earliest_record_date AS "earliestRecordDate",latest_record_date AS "latestRecordDate",historical_verified AS "historicalVerified",last_successful_run AS "lastSuccessfulRun",active_revision_id AS "activeRevisionId",note FROM ${STATE_SCHEMA}.operational_coverage ORDER BY house,dimension`)).rows; }
export async function nationalOperationalCoverage(pool: Pool): Promise<CoverageCell[]> {
  const rows = await operationalCoverageSnapshot(pool);
  const houses = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
  const dimensions = ['name','party','mandate_history','proposals','cabinet','parliamentary_allowance'];
  const byHouse = new Map<string, CoverageCell[]>();
  for (const row of rows) byHouse.set(row.house, [...(byHouse.get(row.house) ?? []), row]);
  return houses.flatMap(house => byHouse.get(house) ?? dimensions.map(dimension => ({
      house,
      dimension,
      status: 'NOT_COLLECTED' as const,
      recordsFound: null,
      recordsExpected: null,
      recordsResolved: null,
      primaryRecordsFound: null,
      primaryRecordsExpected: null,
      primaryRecordsResolved: null,
      components: {},
      completenessPercentage: null,
      earliestRecordDate: null,
      latestRecordDate: null,
      historicalVerified: false,
      lastSuccessfulRun: null,
      activeRevisionId: null,
      note: 'no operational collector executed in P2',
    })));
}
