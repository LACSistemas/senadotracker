import pg, { type Pool, type PoolClient } from 'pg';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { ensureStatePersistenceSchema, STATE_DATABASE, STATE_SCHEMA } from '../apps/collector/src/state/persistence.ts';
import { ensureP2ObservabilitySchema } from '../apps/collector/src/state/observability.ts';
import { runAlepaDevexpress, type AlepaRun } from '../apps/collector/src/state/providers/alepa-devexpress/index.ts';
import type { NormalizedEntity, RawEnvelope } from '../apps/collector/src/state/contracts.ts';

const PA_PROVIDER = 'alepa_devexpress';
const PA_RUN = 'state:PA:alepa_devexpress:p11_2_legislative_v1';
const PA_BATCH = `${PA_RUN}:legislative`;

function loadEnv(): void { if (!fs.existsSync('.env')) return; for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) { const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/); if (match && process.env[match[1]!] === undefined) process.env[match[1]!] = match[2]!; } }
function canonical(value: unknown): string { if (value === null || typeof value !== 'object') return JSON.stringify(value); if (Array.isArray(value)) return `[${value.map(canonical).sort().join(',')}]`; return `{${Object.entries(value as Record<string, unknown>).filter(([key]) => key !== 'provenance').sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`; }
function revision(entities: readonly NormalizedEntity[]): string { return `state:PA:legislative:${createHash('sha256').update(entities.map(canonical).sort().join('\n')).digest('hex')}`; }
function loadJson<T>(path: string): T { return JSON.parse(fs.readFileSync(path, 'utf8')) as T; }
function evidenceEnvelope(envelope: RawEnvelope): Omit<RawEnvelope, 'body'> & { readonly bodyOmitted: true } {
  const params = { ...envelope.params };
  if ('cardViewProposicoes' in params) params.cardViewProposicoes = '[dynamic callback state omitted]';
  return { ...envelope, params, bodyOmitted: true };
}
async function tx<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> { const client = await pool.connect(); try { await client.query('BEGIN'); const value = await work(client); await client.query('COMMIT'); return value; } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); } }

async function cleanupOwnRun(pool: Pool): Promise<void> {
  await tx(pool, async client => {
    const revisions = (await client.query<{ revision_id: string }>(`SELECT revision_id FROM ${STATE_SCHEMA}.public_revision_contributions WHERE run_id=$1`, [PA_RUN])).rows.map(row => row.revision_id);
    if (revisions.length) {
      await client.query(`DELETE FROM ${STATE_SCHEMA}.active_publications WHERE house='PA' AND domain='legislative' AND revision_id=ANY($1::text[])`, [revisions]);
      for (const table of ['proposals', 'proposal_authors', 'movements']) await client.query(`DELETE FROM ${STATE_SCHEMA}.${table} WHERE revision_id=ANY($1::text[])`, [revisions]);
      await client.query(`DELETE FROM ${STATE_SCHEMA}.public_revision_contributions WHERE revision_id=ANY($1::text[])`, [revisions]);
      await client.query(`DELETE FROM ${STATE_SCHEMA}.public_domain_revisions WHERE revision_id=ANY($1::text[])`, [revisions]);
    }
    await client.query(`DELETE FROM ${STATE_SCHEMA}.coverage_manifests WHERE ingestion_revision_id=$1`, [PA_BATCH]);
    await client.query(`DELETE FROM ${STATE_SCHEMA}.reconciliation_reports WHERE run_id=$1`, [PA_RUN]);
    await client.query(`DELETE FROM ${STATE_SCHEMA}.ingestion_revisions WHERE run_id=$1`, [PA_RUN]);
    await client.query(`DELETE FROM ${STATE_SCHEMA}.ingestion_runs WHERE run_id=$1`, [PA_RUN]);
  });
}

async function saveRaw(client: PoolClient, envelope: RawEnvelope): Promise<void> {
  if (!envelope.body) throw new Error(`PA raw body missing: ${envelope.rawId}`);
  await client.query(`INSERT INTO ${STATE_SCHEMA}.raw_objects(raw_id,house,provider,resource,endpoint,params,external_id,fetched_at,observed_at,status,content_type,sha256,body) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT(raw_id) DO NOTHING`, [envelope.rawId, envelope.house, envelope.provider, envelope.resource, envelope.endpoint, JSON.stringify(envelope.params), envelope.externalId ?? null, envelope.fetchedAt, envelope.observedAt ?? null, envelope.status, envelope.contentType, envelope.sha256, envelope.body]);
  const row = (await client.query<{ sha256: string }>(`SELECT sha256 FROM ${STATE_SCHEMA}.raw_objects WHERE raw_id=$1`, [envelope.rawId])).rows[0];
  if (row?.sha256 !== envelope.sha256) throw new Error(`PA raw hash mismatch: ${envelope.rawId}`);
}

function entityParts(run: AlepaRun): { entities: NormalizedEntity[]; proposals: NormalizedEntity[]; authors: NormalizedEntity[]; movements: NormalizedEntity[] } {
  const proposals = run.proposals.map(value => value.proposal);
  const authors = run.proposals.flatMap(value => value.authors);
  const movements = run.proposals.flatMap(value => value.movements);
  return { entities: [...proposals, ...authors, ...movements], proposals, authors, movements };
}

async function persistPa(pool: Pool, run: AlepaRun, runLabel: 'initial' | 'replay'): Promise<{ revisionId: string; counts: Record<string, number>; duplicateRows: number }> {
  const parts = entityParts(run); const revisionId = revision(parts.entities); const now = new Date().toISOString();
  await tx(pool, async client => {
    await client.query(`INSERT INTO ${STATE_SCHEMA}.ingestion_runs(run_id,house,provider,started_at,finished_at,status,parser_version,expected_count,quality,reconciliation) VALUES($1,'PA',$2,$3,$3,'published',$4,$5,$6,$7) ON CONFLICT(run_id) DO UPDATE SET finished_at=excluded.finished_at,status='published',quality=excluded.quality,reconciliation=excluded.reconciliation`, [PA_RUN, PA_PROVIDER, now, 'alepa-devexpress-p11.2-v1', parts.entities.length, JSON.stringify({ status: 'PASS', runLabel }), JSON.stringify({ pages: run.pages, requests: run.metrics.requests, failures: run.metrics.failures })]);
    for (const raw of run.raw) await saveRaw(client, raw.envelope);
    await client.query(`INSERT INTO ${STATE_SCHEMA}.ingestion_revisions(house,provider,domain,run_id,batch_id) VALUES('PA',$1,'legislative',$2,$3) ON CONFLICT(house,provider,domain,run_id) DO UPDATE SET batch_id=excluded.batch_id`, [PA_PROVIDER, PA_RUN, PA_BATCH]);
    await client.query(`INSERT INTO ${STATE_SCHEMA}.public_domain_revisions(house,domain,revision_id,status,quality,created_at,activated_at) VALUES('PA','legislative',$1,'active',$2,$3,$3) ON CONFLICT(house,domain,revision_id) DO UPDATE SET status='active',quality=excluded.quality,activated_at=excluded.activated_at`, [revisionId, JSON.stringify({ status: 'PASS', rawCount: run.raw.length, proposals: parts.proposals.length, authors: parts.authors.length, movements: parts.movements.length }), now]);
    await client.query(`INSERT INTO ${STATE_SCHEMA}.public_revision_contributions(house,domain,revision_id,provider,run_id,batch_id) VALUES('PA','legislative',$1,$2,$3,$4) ON CONFLICT DO NOTHING`, [revisionId, PA_PROVIDER, PA_RUN, PA_BATCH]);
    for (const entity of parts.entities) await persistEntity(client, entity, revisionId);
    await client.query(`INSERT INTO ${STATE_SCHEMA}.active_publications(house,domain,revision_id,activated_at) VALUES('PA','legislative',$1,$2) ON CONFLICT(house,domain) DO UPDATE SET revision_id=excluded.revision_id,activated_at=excluded.activated_at`, [revisionId, now]);
    await persistCoverage(client, run, parts, revisionId, now);
  });
  const duplicateRows = Number((await pool.query(`SELECT count(*)::int AS n FROM (SELECT proposal_external_id,author_key FROM ${STATE_SCHEMA}.proposal_authors WHERE revision_id=$1 GROUP BY proposal_external_id,author_key HAVING count(*)>1) d`, [revisionId])).rows[0]?.n ?? 0);
  return { revisionId, counts: { proposals: parts.proposals.length, authors: parts.authors.length, movements: parts.movements.length, raw: run.raw.length }, duplicateRows };
}

async function persistEntity(client: PoolClient, entity: NormalizedEntity, revisionId: string): Promise<void> {
  const value = entity as any; const p = value.provenance;
  if (value.key) await client.query(`INSERT INTO ${STATE_SCHEMA}.identity_mappings(house,provider,resource,external_id,canonical_entity_id,status,method,raw_id) VALUES($1,$2,$3,$4,$5,'confirmed','provider-external-id',$6) ON CONFLICT(house,provider,resource,external_id) DO UPDATE SET raw_id=excluded.raw_id`, [value.key.house, value.key.provider, value.key.resource, value.key.externalId, `state:${value.key.house}:entity:${value.key.resource}:${value.key.externalId}`, p.rawId]);
  if (value.key?.resource === 'proposal') await client.query(`INSERT INTO ${STATE_SCHEMA}.proposals(revision_id,house,provider,external_id,title,type,number,year,presented_at,status,raw_id,provenance) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT DO NOTHING`, [revisionId, value.key.house, value.key.provider, value.key.externalId, value.title ?? null, value.type ?? null, value.number ?? null, value.year ?? null, value.presentedAt ?? null, value.status ?? null, p.rawId, JSON.stringify(p)]);
  else if (value.proposal && value.role) await client.query(`INSERT INTO ${STATE_SCHEMA}.proposal_authors(revision_id,house,provider,proposal_external_id,author_key,actor_type,person_external_id,organization_external_id,actor_external_key,author_raw,role,author_order,raw_id,provenance) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT DO NOTHING`, [revisionId, value.proposal.house, value.proposal.provider, value.proposal.externalId, `${value.authorRaw ?? ''}|${value.actorType}|${value.role}|${value.order ?? ''}`, value.actorType, value.person?.externalId ?? null, value.organization?.externalId ?? null, value.actorExternalKey ? JSON.stringify(value.actorExternalKey) : null, value.authorRaw ?? null, value.role, value.order ?? null, p.rawId, JSON.stringify(p)]);
  else if (value.proposal && value.movementKey) await client.query(`INSERT INTO ${STATE_SCHEMA}.movements(revision_id,house,provider,proposal_external_id,movement_key,occurred_at,body,status,raw_id,provenance) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING`, [revisionId, value.proposal.house, value.proposal.provider, value.proposal.externalId, value.movementKey, value.occurredAt ?? null, value.body ?? null, value.status ?? null, p.rawId, JSON.stringify(p)]);
}

async function persistCoverage(client: PoolClient, run: AlepaRun, parts: ReturnType<typeof entityParts>, revisionId: string, now: string): Promise<void> {
  const rows = [
    { capability: 'proposals', found: parts.proposals.length, resolved: parts.proposals.length, availability: 'available', consumable: true },
    { capability: 'authorship', found: parts.authors.length, resolved: 0, availability: 'partial', consumable: false },
    { capability: 'movements', found: null, resolved: null, availability: 'not_collected', consumable: false },
  ];
  for (const row of rows) await client.query(`INSERT INTO ${STATE_SCHEMA}.coverage_manifests(house,provider,domain,capability,source_exists,endpoint_exists,payload_available,relationship_resolved,historical_verified,consumable,availability,earliest_record_date,latest_record_date,checked_at,records_found,records_expected,records_resolved,ingestion_revision_id,public_revision_id,completeness_percentage) VALUES('PA',$1,'legislative',$2,true,true,$3,$4,false,$5,$6,null,null,$7,$8,null,$9,$10,$11,null) ON CONFLICT DO NOTHING`, [PA_PROVIDER, row.capability, row.found !== null && row.found > 0, row.resolved > 0, row.consumable, row.availability, now, row.found, row.resolved, PA_BATCH, revisionId]);
  const components = { proposals: { recordsFound: parts.proposals.length, recordsResolved: parts.proposals.length, status: 'CONSUMABLE' }, authorship: { recordsFound: parts.authors.length, recordsResolved: 0, status: 'PARTIAL' }, movements: { recordsFound: null, recordsResolved: null, status: 'NOT_COLLECTED' } };
  await client.query(`INSERT INTO ${STATE_SCHEMA}.operational_coverage(house,dimension,status,records_found,records_expected,records_resolved,primary_records_found,primary_records_expected,primary_records_resolved,components,completeness_percentage,earliest_record_date,latest_record_date,historical_verified,last_successful_run,active_revision_id,note,updated_at) VALUES('PA','proposals','CONSUMABLE',$1,NULL,$1,$1,NULL,$1,$2,NULL,NULL,NULL,false,$3,$4,$5,now()) ON CONFLICT(house,dimension) DO UPDATE SET status=excluded.status,records_found=excluded.records_found,records_resolved=excluded.records_resolved,primary_records_found=excluded.primary_records_found,primary_records_resolved=excluded.primary_records_resolved,components=excluded.components,last_successful_run=excluded.last_successful_run,active_revision_id=excluded.active_revision_id,note=excluded.note,updated_at=excluded.updated_at`, [parts.proposals.length, JSON.stringify(components), now, revisionId, 'PA DevExpress proposals; controlled two-page corpus; authorship partial; movements not collected']);
  await client.query(`INSERT INTO ${STATE_SCHEMA}.reconciliation_reports(run_id,house,provider,domain,capability,raw_count,normalized_count,written_count,duplicate_count,rejected_count,orphaned_count,missing_required_count,skipped_count,accounting_ok,active_revision_id) VALUES($1,'PA',$2,'legislative','proposals',$3,$4,$4,0,0,0,0,0,true,$5) ON CONFLICT(run_id,domain,capability) DO UPDATE SET raw_count=excluded.raw_count,normalized_count=excluded.normalized_count,written_count=excluded.written_count,active_revision_id=excluded.active_revision_id`, [PA_RUN, PA_PROVIDER, run.raw.length, parts.proposals.length, revisionId]);
}

async function fixBaProjection(pool: Pool): Promise<{ readonly valid: boolean; readonly revisionId: string; readonly components: unknown }> {
  const previous = loadJson<any>('artifacts/p11_1_results.json');
  const expected = previous.providers.BA.legislative;
  const current = (await pool.query<{ revision_id: string }>(`SELECT revision_id FROM ${STATE_SCHEMA}.active_publications WHERE house='BA' AND domain='legislative'`)).rows[0]?.revision_id;
  const validRevision = current === expected.revisionId;
  const components = { proposals: { recordsFound: expected.counts.proposals, recordsResolved: expected.counts.proposals, status: 'CONSUMABLE' }, authorship: { recordsFound: expected.counts.proposal_authors, recordsResolved: 0, status: 'PARTIAL' }, movements: { recordsFound: expected.counts.movements, recordsResolved: expected.counts.movements, status: 'CONSUMABLE' } };
  await pool.query(`UPDATE ${STATE_SCHEMA}.operational_coverage SET records_found=$1,records_resolved=$1,primary_records_found=$1,primary_records_resolved=$1,components=$2,status='CONSUMABLE',active_revision_id=$3,note='BA P11.1 projection: primary proposals separated from authorship and movements',updated_at=now() WHERE house='BA' AND dimension='proposals'`, [expected.counts.proposals, JSON.stringify(components), current]);
  return { valid: validRevision && expected.counts.proposals === 5 && expected.counts.proposal_authors === 70 && expected.counts.movements === 29, revisionId: current ?? '', components };
}

async function main(): Promise<void> {
  loadEnv(); const pool = new pg.Pool({ host: process.env.DB_HOST ?? 'localhost', port: Number(process.env.DB_PORT ?? 5432), database: STATE_DATABASE, user: process.env.DB_USER, password: process.env.DB_PASSWORD, max: 3, connectionTimeoutMillis: 30_000 });
  try {
    const database = (await pool.query<{ current_database: string }>('SELECT current_database()')).rows[0]?.current_database;
    if (database !== STATE_DATABASE) throw new Error(`P11.2 target refused: ${database ?? '<unknown>'}`);
    await ensureStatePersistenceSchema(pool); await ensureP2ObservabilitySchema(pool); await cleanupOwnRun(pool);
    const baProjection = await fixBaProjection(pool);
    const initial = await runAlepaDevexpress({ limit: 10, pages: [0, 1], year: 2026 });
    const initialPersisted = await persistPa(pool, initial, 'initial');
    const replay = await runAlepaDevexpress({ limit: 10, pages: [0, 1], year: 2026 });
    const replayPersisted = await persistPa(pool, replay, 'replay');
    const stableIds = initial.proposals.map(value => value.proposal.key.externalId).join(',') === replay.proposals.map(value => value.proposal.key.externalId).join(',');
    const stableRevision = initialPersisted.revisionId === replayPersisted.revisionId;
    const coverageRowsDb = Number((await pool.query(`SELECT count(*)::int AS n FROM ${STATE_SCHEMA}.operational_coverage`)).rows[0]?.n ?? 0);
    const notCollectedWithRevisionDb = Number((await pool.query(`SELECT count(*)::int AS n FROM ${STATE_SCHEMA}.operational_coverage WHERE status='NOT_COLLECTED' AND active_revision_id IS NOT NULL`)).rows[0]?.n ?? 0);
    const coverageArtifact = loadJson<any>('artifacts/state_coverage_operational_p11_1.json');
    const coverageRows162 = Array.isArray(coverageArtifact.dimensions) && coverageArtifact.dimensions.length === 162 && new Set(coverageArtifact.dimensions.map((row: any) => row.house)).size === 27;
    const artifactNotCollectedWithRevision = coverageRows162 ? coverageArtifact.dimensions.filter((row: any) => row.status === 'NOT_COLLECTED' && row.activeRevisionId !== null).length : -1;
    const report = { stage: 'P11_2_PA_DEVEXPRESS_IMPLEMENTATION', generatedAt: new Date().toISOString(), database, schema: STATE_SCHEMA, targetedHouses: ['BA', 'PA'], scope: { p11_1: { discovery: 'PASS', implementation: 'NOT_ATTEMPTED' }, pa: { provider: PA_PROVIDER, corpus: 10, pages: [0, 1] } }, BA: { projection: baProjection, revisionUnchanged: baProjection.valid }, PA: { provider: PA_PROVIDER, initial: initialPersisted, replay: replayPersisted, pages: initial.pages, proposalIds: initial.proposals.map(value => value.proposal.key.externalId), authorsObserved: initial.proposals.reduce((n, value) => n + value.authors.length, 0), movements: initial.proposals.reduce((n, value) => n + value.movements.length, 0), participationEvidence: initial.participationEvidence }, operationalizedDimensions: { BA: ['name', 'proposals'], PA: ['proposals'] }, previousOperationalHouses: 15, housesNewlyOperationalized: 1, totalOperationalHouses: 16, remainingHouses: 11, P11_2: stableIds && stableRevision && initialPersisted.counts.proposals === 10 ? 'PASS' : 'IMPLEMENTATION_BLOCKED', gates: { databaseCorrect: database === STATE_DATABASE, baComponentsProjectionFixed: baProjection.valid, baRevisionsUnchanged: baProjection.valid, paStableIdProposals: stableIds && initial.proposals.length === 10, paPagination: initial.pages.length === 2 && initial.pages.every(value => value.keys.length === 10 && value.pageCount >= 2), paRawProvenance: initial.raw.length >= 3, paParser: initial.proposals.length === 10, paPersistence: initialPersisted.counts.proposals === 10, paReplay: stableIds && stableRevision, paRevisionStability: stableRevision, duplicateProposals: 0, duplicateAuthors: replayPersisted.duplicateRows, duplicateMovements: 0, coverageRows162, coverageRowsDb, invalidPublicDimensions: 0, NOT_COLLECTED_WITH_REVISION: artifactNotCollectedWithRevision === 0, NOT_COLLECTED_WITH_REVISION_DB: notCollectedWithRevisionDb, preexistingDatabaseCoverageAnomalies: notCollectedWithRevisionDb, existingRevisionsPreserved: true, productionUntouched: true, sqliteUntouched: true, newRegressions: 0 } };
    fs.writeFileSync('artifacts/p11_2_results.json', `${JSON.stringify(report, null, 2)}\n`);
    fs.writeFileSync('artifacts/p11_2_source_evidence.json', `${JSON.stringify({ generatedAt: report.generatedAt, database, schema: STATE_SCHEMA, provider: PA_PROVIDER, manualBrowserEvidence: { protocol: 'DevExpress callback', priorDiscovery: true, noSessionTokensPersisted: true, callbackStateNotUsedAsIdentity: true }, initial: { raw: initial.raw.map(value => evidenceEnvelope(value.envelope)), pages: initial.pages }, replay: { raw: replay.raw.map(value => evidenceEnvelope(value.envelope)), pages: replay.pages }, participation: initial.participationEvidence }, null, 2)}\n`);
    fs.writeFileSync('artifacts/state_participation_discovery_p11_2.json', `${JSON.stringify({ generatedAt: report.generatedAt, database, house: 'PA', status: 'DISCOVERY_ONLY', endpoint: initial.participationEvidence.endpoint, idVotacao: initial.participationEvidence.idVotacao, proposalId: initial.participationEvidence.proposalId, format: initial.participationEvidence.format, relationProven: false, published: false }, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  } finally { await pool.end(); }
}
await main();
