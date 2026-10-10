import pg, { type Pool, type PoolClient } from 'pg';
import { createHash } from 'node:crypto';
import type {
  ExternalIdentityKey,
  NormalizedBatch,
  NormalizedEntity,
  NormalizedMovement,
  NormalizedProposalAuthor,
  NormalizedPartyMembership,
  Publication,
  QualityReport,
  RawEnvelope,
} from './contracts.ts';
import type { RoSliceRunResult } from './providers/sapl/slice.ts';
import { canonicalJson } from './providers/sapl/client.ts';

/** P1.5 is deliberately isolated from the federal runtime schemas. */
export const STATE_SCHEMA = 'civica_state';
export const STATE_DATABASE = process.env.STATE_PERSISTENCE_DATABASE ?? process.env.CIVICA_STATE_DATABASE ?? process.env.DB_NAME ?? 'projetoeleitor_db';
export const STATE_MIGRATION = 'p1_5_state_persistence_v1';
export const STATE_FINANCE_MIGRATION = 'p18_1a2_finance_expenses_v1';
export const STATE_TIMELINE_MIGRATION = 'p22_1_timeline_events_v1';
export const STATE_TYPE_SEMANTICS_MIGRATION = 'p22_1r_proposal_type_semantics_v1';

const DDL = [
  `CREATE SCHEMA IF NOT EXISTS ${STATE_SCHEMA}`,
  `CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.ingestion_runs (
    run_id text PRIMARY KEY, house text NOT NULL, provider text NOT NULL, started_at timestamptz NOT NULL,
    finished_at timestamptz, status text NOT NULL CHECK (status IN ('staged','published','rejected','failed')),
    parser_version text NOT NULL, discovery_schema_hash text, expected_count integer, quality jsonb NOT NULL DEFAULT '{}'::jsonb,
    reconciliation jsonb NOT NULL DEFAULT '{}'::jsonb
  )`,
  `CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.raw_objects (
    raw_id text PRIMARY KEY, house text NOT NULL, provider text NOT NULL, resource text NOT NULL, endpoint text NOT NULL,
    params jsonb NOT NULL, external_id text, fetched_at timestamptz NOT NULL, observed_at timestamptz,
    status integer NOT NULL, content_type text NOT NULL, sha256 text NOT NULL UNIQUE, body text NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.ingestion_revisions (
    house text NOT NULL, provider text NOT NULL, domain text NOT NULL, run_id text NOT NULL REFERENCES ${STATE_SCHEMA}.ingestion_runs(run_id),
    batch_id text NOT NULL, PRIMARY KEY (house, provider, domain, run_id), UNIQUE (batch_id)
  )`,
  `CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.identity_mappings (
    house text NOT NULL, provider text NOT NULL, resource text NOT NULL, external_id text NOT NULL,
    canonical_entity_id text, status text NOT NULL, confidence numeric, method text, valid_from text, valid_to text,
    raw_id text NOT NULL, PRIMARY KEY (house, provider, resource, external_id)
  )`,
  `CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.public_domain_revisions (
    house text NOT NULL, domain text NOT NULL, revision_id text NOT NULL, status text NOT NULL CHECK (status IN ('staged','active','rejected')),
    quality jsonb NOT NULL, created_at timestamptz NOT NULL, activated_at timestamptz, PRIMARY KEY (house, domain, revision_id)
  )`,
  `CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.public_revision_contributions (
    house text NOT NULL, domain text NOT NULL, revision_id text NOT NULL, provider text NOT NULL, run_id text NOT NULL, batch_id text NOT NULL,
    PRIMARY KEY (house, domain, revision_id, provider, run_id, batch_id),
    FOREIGN KEY (house, domain, revision_id) REFERENCES ${STATE_SCHEMA}.public_domain_revisions(house, domain, revision_id)
  )`,
  `CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.active_publications (
    house text NOT NULL, domain text NOT NULL, revision_id text NOT NULL, activated_at timestamptz NOT NULL,
    PRIMARY KEY (house, domain), FOREIGN KEY (house, domain, revision_id) REFERENCES ${STATE_SCHEMA}.public_domain_revisions(house, domain, revision_id)
  )`,
  `CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.persons (
    revision_id text NOT NULL, house text NOT NULL, provider text NOT NULL, external_id text NOT NULL, name text NOT NULL,
    availability text, raw_id text NOT NULL, provenance jsonb NOT NULL, PRIMARY KEY (revision_id, house, provider, external_id)
  )`,
  `CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.mandates (
    revision_id text NOT NULL, house text NOT NULL, provider text NOT NULL, person_external_id text NOT NULL, mandate_key text NOT NULL,
    start_at text, end_at text, raw_id text NOT NULL, provenance jsonb NOT NULL,
    PRIMARY KEY (revision_id, house, provider, person_external_id, mandate_key)
  )`,
  `CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.party_memberships (
    revision_id text NOT NULL, house text NOT NULL, provider text NOT NULL, person_external_id text NOT NULL, membership_key text NOT NULL,
    provider_party_id text, raw_party_label text, canonical_party text, alias text, start_at text, end_at text, raw_id text NOT NULL, provenance jsonb NOT NULL,
    PRIMARY KEY (revision_id, house, provider, person_external_id, membership_key)
  )`,
  `CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.proposals (
    revision_id text NOT NULL, house text NOT NULL, provider text NOT NULL, external_id text NOT NULL, title text, type text, number text,
    year integer, presented_at text, status text, raw_id text NOT NULL, provenance jsonb NOT NULL,
    PRIMARY KEY (revision_id, house, provider, external_id)
  )`,
  `ALTER TABLE ${STATE_SCHEMA}.proposals ADD COLUMN IF NOT EXISTS type_code text`,
  `ALTER TABLE ${STATE_SCHEMA}.proposals ADD COLUMN IF NOT EXISTS type_label text`,
  `ALTER TABLE ${STATE_SCHEMA}.proposals ADD COLUMN IF NOT EXISTS type_group text`,
  `ALTER TABLE ${STATE_SCHEMA}.proposals ADD COLUMN IF NOT EXISTS type_confidence text`,
  `CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.proposal_authors (
    revision_id text NOT NULL, house text NOT NULL, provider text NOT NULL, proposal_external_id text NOT NULL, author_key text NOT NULL,
    actor_type text NOT NULL, actor_type_raw text, actor_type_canonical text, person_external_id text, organization_external_id text, actor_external_key jsonb,
    author_raw text, role text NOT NULL, author_order integer, raw_id text NOT NULL, provenance jsonb NOT NULL,
    PRIMARY KEY (revision_id, house, provider, proposal_external_id, author_key)
  )`,
  `ALTER TABLE ${STATE_SCHEMA}.proposal_authors ADD COLUMN IF NOT EXISTS actor_type_raw text`,
  `ALTER TABLE ${STATE_SCHEMA}.proposal_authors ADD COLUMN IF NOT EXISTS actor_type_canonical text`,
  `CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.movements (
    revision_id text NOT NULL, house text NOT NULL, provider text NOT NULL, proposal_external_id text NOT NULL, movement_key text NOT NULL,
    occurred_at text, body text, status text, raw_id text NOT NULL, provenance jsonb NOT NULL,
    PRIMARY KEY (revision_id, house, provider, proposal_external_id, movement_key)
  )`,
  `CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.expenses (
    revision_id text NOT NULL, house text NOT NULL, provider text NOT NULL, external_id text NOT NULL,
    person_external_id text, occurred_at text, competence text, period_start text, period_end text,
    temporal_precision text NOT NULL, amount_cents bigint, category text, supplier_external_id text,
    raw_id text NOT NULL, provenance jsonb NOT NULL,
    PRIMARY KEY (revision_id, house, provider, external_id)
  )`,
  `CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.state_commissions (
    revision_id text NOT NULL, house text NOT NULL, provider text NOT NULL, external_id text NOT NULL,
    name text NOT NULL, kind text, source_key jsonb NOT NULL, observed_at timestamptz,
    raw_id text NOT NULL, provenance jsonb NOT NULL, semantic_hash text NOT NULL,
    PRIMARY KEY (revision_id, house, provider, external_id)
  )`,
  `CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.state_commission_memberships (
    revision_id text NOT NULL, house text NOT NULL, provider text NOT NULL, commission_external_id text NOT NULL,
    person_external_id text NOT NULL, membership_key text NOT NULL, role text, party text,
    start_at text, end_at text, source_key jsonb NOT NULL, observed_at timestamptz,
    raw_id text NOT NULL, provenance jsonb NOT NULL, semantic_hash text NOT NULL,
    PRIMARY KEY (revision_id, house, provider, commission_external_id, person_external_id, membership_key)
  )`,
  `CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.state_meetings (
    revision_id text NOT NULL, house text NOT NULL, provider text NOT NULL, external_id text NOT NULL,
    commission_external_id text, occurred_at text, kind text, status text, scope text,
    source_key jsonb NOT NULL,
    raw_id text NOT NULL, provenance jsonb NOT NULL, semantic_hash text NOT NULL,
    PRIMARY KEY (revision_id, house, provider, external_id)
  )`,
  `CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.state_attendance (
    revision_id text NOT NULL, house text NOT NULL, provider text NOT NULL, meeting_external_id text NOT NULL,
    person_external_id text NOT NULL, attendance_key text NOT NULL, state text NOT NULL, scope text NOT NULL,
    occurred_at text, source_key jsonb NOT NULL, raw_id text NOT NULL, provenance jsonb NOT NULL, semantic_hash text NOT NULL,
    PRIMARY KEY (revision_id, house, provider, meeting_external_id, person_external_id, attendance_key)
  )`,
  `CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.state_agenda_items (
    revision_id text NOT NULL, house text NOT NULL, provider text NOT NULL, meeting_external_id text NOT NULL,
    agenda_key text NOT NULL, proposal_external_id text, external_object_id text, order_no integer,
    status text, result text, added_at text, removed_at text, source_key jsonb NOT NULL,
    raw_id text NOT NULL, provenance jsonb NOT NULL, semantic_hash text NOT NULL,
    PRIMARY KEY (revision_id, house, provider, meeting_external_id, agenda_key)
  )`,
  `CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.state_deliberations (
    revision_id text NOT NULL, house text NOT NULL, provider text NOT NULL, external_id text NOT NULL,
    meeting_external_id text, agenda_key text, proposal_external_id text, order_no integer,
    occurred_at text, body text, outcome text, scope text, participation_scope text, source_key jsonb NOT NULL,
    raw_id text NOT NULL, provenance jsonb NOT NULL, semantic_hash text NOT NULL,
    PRIMARY KEY (revision_id, house, provider, external_id)
  )`,
  `CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.state_individual_votes (
    revision_id text NOT NULL, house text NOT NULL, provider text NOT NULL, deliberation_external_id text NOT NULL,
    person_external_id text NOT NULL, vote_key text NOT NULL, meeting_external_id text, proposal_external_id text,
    choice text NOT NULL, scope text, participation_scope text, source_key jsonb NOT NULL, raw_id text NOT NULL, provenance jsonb NOT NULL, semantic_hash text NOT NULL,
    PRIMARY KEY (revision_id, house, provider, deliberation_external_id, person_external_id, vote_key)
  )`,
  `CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.state_documents (
    revision_id text NOT NULL, house text NOT NULL, provider text NOT NULL, external_id text NOT NULL,
    proposal_external_id text, document_type text, title text, description text, official_date text,
    source_locator text, source_key jsonb NOT NULL, raw_id text NOT NULL, provenance jsonb NOT NULL, semantic_hash text NOT NULL,
    PRIMARY KEY (revision_id, house, provider, external_id)
  )`,
  `CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.state_proposal_relations (
    revision_id text NOT NULL, house text NOT NULL, provider text NOT NULL, from_proposal_external_id text NOT NULL,
    to_external_id text NOT NULL, relation_key text NOT NULL, kind text NOT NULL, source_key jsonb NOT NULL,
    raw_id text NOT NULL, provenance jsonb NOT NULL, semantic_hash text NOT NULL,
    PRIMARY KEY (revision_id, house, provider, from_proposal_external_id, to_external_id, relation_key)
  )`,
  `CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.state_units (
    revision_id text NOT NULL, house text NOT NULL, provider text NOT NULL, external_id text NOT NULL,
    name text NOT NULL, sigla text, kind text, source_key jsonb NOT NULL,
    raw_id text NOT NULL, provenance jsonb NOT NULL, semantic_hash text NOT NULL,
    PRIMARY KEY (revision_id, house, provider, external_id)
  )`,
  `CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.state_proposal_units (
    revision_id text NOT NULL, house text NOT NULL, provider text NOT NULL, proposal_external_id text NOT NULL,
    unit_external_id text NOT NULL, relation_key text NOT NULL, relation_kind text NOT NULL, source_key jsonb NOT NULL,
    raw_id text NOT NULL, provenance jsonb NOT NULL, semantic_hash text NOT NULL,
    PRIMARY KEY (revision_id, house, provider, proposal_external_id, unit_external_id, relation_key)
  )`,
  `CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.state_proposal_publications (
    revision_id text NOT NULL, house text NOT NULL, provider text NOT NULL, external_id text NOT NULL,
    proposal_external_id text NOT NULL, published_at text, kind text, source_locator text, source_key jsonb NOT NULL,
    raw_id text NOT NULL, provenance jsonb NOT NULL, semantic_hash text NOT NULL,
    PRIMARY KEY (revision_id, house, provider, external_id)
  )`,
  `CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.state_proposal_themes (
    revision_id text NOT NULL, house text NOT NULL, provider text NOT NULL, proposal_external_id text NOT NULL,
    theme_key text NOT NULL, label text NOT NULL, taxonomy text, source_key jsonb NOT NULL,
    raw_id text NOT NULL, provenance jsonb NOT NULL, semantic_hash text NOT NULL,
    PRIMARY KEY (revision_id, house, provider, proposal_external_id, theme_key)
  )`,
  `CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.state_rapporteurships (
    revision_id text NOT NULL, house text NOT NULL, provider text NOT NULL, proposal_external_id text NOT NULL,
    rapporteur_key text NOT NULL, person_external_id text, source_person_id text, role_raw text NOT NULL, body_source_id text, body_name_raw text,
    assigned_at text, ended_at text, observed_at text, source_key jsonb NOT NULL,
    raw_id text NOT NULL, provenance jsonb NOT NULL, semantic_hash text NOT NULL,
    PRIMARY KEY (revision_id, house, provider, proposal_external_id, rapporteur_key)
  )`,
  `CREATE TABLE IF NOT EXISTS ${STATE_SCHEMA}.state_proposal_events (
    id bigint GENERATED BY DEFAULT AS IDENTITY,
    revision_id text NOT NULL, house text NOT NULL, provider text NOT NULL,
    proposal_external_id text NOT NULL, source_event_key text NOT NULL, event_order integer NOT NULL,
    occurred_at text, event_date_precision text NOT NULL,
    event_type text NOT NULL, event_type_raw text, description_raw text NOT NULL,
    origin_body_id text, origin_body_raw text, destination_body_id text, destination_body_raw text,
    status_raw text, source_url text, raw_id text NOT NULL, provenance jsonb NOT NULL,
    semantic_hash text NOT NULL,
    PRIMARY KEY (revision_id, house, provider, proposal_external_id, source_event_key)
  )`,
  `ALTER TABLE ${STATE_SCHEMA}.state_proposal_events ADD COLUMN IF NOT EXISTS id bigint GENERATED BY DEFAULT AS IDENTITY`,
  `CREATE UNIQUE INDEX IF NOT EXISTS state_proposal_events_id_idx ON ${STATE_SCHEMA}.state_proposal_events(id)`,
  `CREATE INDEX IF NOT EXISTS state_proposal_events_lookup_idx ON ${STATE_SCHEMA}.state_proposal_events(house, proposal_external_id, revision_id, event_order)`,
  // Additive P18.1A2 contract extension.  All fields remain nullable because
  // state providers legitimately expose different monetary semantics.
  ...[
    ['gross_amount_cents', 'bigint'], ['claimed_amount_cents', 'bigint'],
    ['reimbursed_amount_cents', 'bigint'], ['glosa_amount_cents', 'bigint'],
    ['supplier_name', 'text'], ['supplier_document', 'text'], ['supplier_document_type', 'text'],
    ['fiscal_document_number', 'text'], ['fiscal_document_type', 'text'], ['description', 'text'],
    ['mechanism_type', 'text'], ['mechanism_name', 'text'], ['source_granularity', 'text'],
    ['attachment_url', 'text'], ['source_url', 'text'], ['linkage_method', 'text'], ['linkage_status', 'text'],
  ].map(([column, type]) => `ALTER TABLE ${STATE_SCHEMA}.expenses ADD COLUMN IF NOT EXISTS ${column} ${type}`),
];

export interface PersistenceCounts { readonly raw: number; readonly identityMappings: number; readonly persons: number; readonly mandates: number; readonly memberships: number; readonly proposals: number; readonly authors: number; readonly movements: number; }
export interface PersistenceResult { readonly database: string; readonly migration: string; readonly revisions: Readonly<Record<string, string>>; readonly activeBefore: Readonly<Record<string, string | null>>; readonly activeAfter: Readonly<Record<string, string | null>>; readonly counts: PersistenceCounts; readonly idempotent: boolean; }

export function statePersistencePool(env: NodeJS.ProcessEnv = process.env): Pool {
  const target = env.STATE_PERSISTENCE_DATABASE ?? '';
  if (target !== STATE_DATABASE) throw new Error(`P1.5 target refused: set STATE_PERSISTENCE_DATABASE=${STATE_DATABASE}`);
  return new pg.Pool({ host: env.DB_HOST ?? 'localhost', port: Number(env.DB_PORT ?? 5432), database: target, user: env.DB_USER, password: env.DB_PASSWORD, max: 3, connectionTimeoutMillis: 10_000 });
}

export async function ensureStatePersistenceSchema(pool: Pool): Promise<void> {
  const current = (await pool.query<{ current_database: string }>('SELECT current_database()')).rows[0]?.current_database;
  if (current !== STATE_DATABASE) throw new Error(`P1.5 schema migration refused on ${current ?? '<unknown>'}`);
  for (const statement of DDL) await pool.query(statement);
  await pool.query(`INSERT INTO ${STATE_SCHEMA}.schema_migrations(version, applied_at) VALUES($1, now()) ON CONFLICT(version) DO NOTHING`, [STATE_MIGRATION]);
  await pool.query(`INSERT INTO ${STATE_SCHEMA}.schema_migrations(version, applied_at) VALUES($1, now()) ON CONFLICT(version) DO NOTHING`, [STATE_FINANCE_MIGRATION]);
  await pool.query(`INSERT INTO ${STATE_SCHEMA}.schema_migrations(version, applied_at) VALUES($1, now()) ON CONFLICT(version) DO NOTHING`, [STATE_TIMELINE_MIGRATION]);
  await pool.query(`INSERT INTO ${STATE_SCHEMA}.schema_migrations(version, applied_at) VALUES($1, now()) ON CONFLICT(version) DO NOTHING`, [STATE_TYPE_SEMANTICS_MIGRATION]);
}

export function validatePersistenceInput(result: RoSliceRunResult): { readonly status: 'PASS' | 'FAIL'; readonly errors: readonly string[] } {
  const errors: string[] = [];
  const envelopes = new Set(result.rawEnvelopes.map(value => value.rawId));
  const entityKeys = new Set<string>();
  const proposals = new Set<string>();
  for (const batch of result.batches) {
    for (const entity of batch.entities) {
      const key = normalizedKey(entity);
      if (entityKeys.has(`${batch.ingestion.domain}:${key}`)) errors.push(`duplicate natural key ${batch.ingestion.domain}:${key}`);
      entityKeys.add(`${batch.ingestion.domain}:${key}`);
      if (!('provenance' in entity) || !envelopes.has(entity.provenance.rawId)) errors.push(`missing provenance ${key}`);
      if (isProposal(entity)) proposals.add(String((entity as any).key.externalId));
      const interval = entity as { start?: string; end?: string };
      if (interval.start && interval.end && Date.parse(interval.end) < Date.parse(interval.start)) errors.push(`invalid interval ${key}`);
    }
  }
  const legislative = result.batches.find(batch => batch.ingestion.domain === 'legislative');
  for (const entity of legislative?.entities ?? []) {
    if (isAuthor(entity) && !proposals.has(String(entity.proposal.externalId))) errors.push(`orphan author ${normalizedKey(entity)}`);
    if (isMovement(entity) && !proposals.has(String(entity.proposal.externalId))) errors.push(`orphan movement ${normalizedKey(entity)}`);
  }
  for (const [domain, quality] of Object.entries(result.quality)) if (quality.status === 'FAIL') errors.push(`${domain} quality status FAIL`);
  return { status: errors.length ? 'FAIL' : 'PASS', errors };
}

export async function persistRoSlice(pool: Pool, result: RoSliceRunResult): Promise<PersistenceResult> {
  const valid = validatePersistenceInput(result);
  if (valid.status === 'FAIL') throw new Error(`P1.5 quality gate failed: ${valid.errors.join('; ')}`);
  await ensureStatePersistenceSchema(pool);
  const activeBefore = await activeRevisions(pool);
  const revisions: Record<string, string> = {};
  for (const batch of result.batches) revisions[batch.ingestion.domain] = publicRevisionId(batch);
  await withTransaction(pool, async client => {
    const now = new Date().toISOString();
    const quality = JSON.stringify(result.quality);
    const firstEnvelope = result.rawEnvelopes[0];
    await client.query(`INSERT INTO ${STATE_SCHEMA}.ingestion_runs(run_id,house,provider,started_at,finished_at,status,parser_version,discovery_schema_hash,expected_count,quality,reconciliation) VALUES($1,$2,$3,$4,$5,'published',$6,$7,$8,$9,$10) ON CONFLICT(run_id) DO NOTHING`, [result.runId, 'RO', 'sapl', firstEnvelope?.fetchedAt ?? now, now, 'sapl-p1.5-v1', result.discovery.schemaHash ?? null, result.batches.reduce((n, b) => n + b.entities.length, 0), quality, JSON.stringify({ sanity: result.sanity, metrics: result.metrics })]);
    for (const envelope of uniqueEnvelopes(result.rawEnvelopes)) await saveRaw(client, envelope);
    for (const batch of result.batches) {
      await client.query(`INSERT INTO ${STATE_SCHEMA}.ingestion_revisions(house,provider,domain,run_id,batch_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT(house,provider,domain,run_id) DO NOTHING`, ['RO','sapl',batch.ingestion.domain,result.runId,batch.ingestion.batchId]);
      const revisionId = revisions[batch.ingestion.domain]!;
      await client.query(`INSERT INTO ${STATE_SCHEMA}.public_domain_revisions(house,domain,revision_id,status,quality,created_at,activated_at) VALUES($1,$2,$3,'active',$4,$5,$5) ON CONFLICT(house,domain,revision_id) DO UPDATE SET quality=excluded.quality,status='active'`, ['RO',batch.ingestion.domain,revisionId,quality,now]);
      await client.query(`INSERT INTO ${STATE_SCHEMA}.public_revision_contributions(house,domain,revision_id,provider,run_id,batch_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`, ['RO',batch.ingestion.domain,revisionId,'sapl',result.runId,batch.ingestion.batchId]);
      await persistEntities(client, batch, revisionId);
      await client.query(`INSERT INTO ${STATE_SCHEMA}.active_publications(house,domain,revision_id,activated_at) VALUES($1,$2,$3,$4) ON CONFLICT(house,domain) DO UPDATE SET revision_id=excluded.revision_id,activated_at=excluded.activated_at`, ['RO',batch.ingestion.domain,revisionId,now]);
    }
  });
  const activeAfter = await activeRevisions(pool);
  const counts = await stateCounts(pool);
  const second = await semanticReplayCheck(pool, revisions);
  return { database: STATE_DATABASE, migration: STATE_MIGRATION, revisions, activeBefore, activeAfter, counts, idempotent: second };
}

async function persistEntities(client: PoolClient, batch: NormalizedBatch, revisionId: string): Promise<void> {
  for (const entity of batch.entities) {
    const key = entity as any; const p = (entity as any).provenance;
    if (key.key) await client.query(`INSERT INTO ${STATE_SCHEMA}.identity_mappings(house,provider,resource,external_id,canonical_entity_id,status,method,raw_id) VALUES($1,$2,$3,$4,$5,'confirmed','provider-external-id',$6) ON CONFLICT(house,provider,resource,external_id) DO UPDATE SET raw_id=excluded.raw_id`, [key.key.house, key.key.provider, key.key.resource, key.key.externalId, `state:${key.key.house}:entity:${key.key.resource}:${key.key.externalId}`, p.rawId]);
    if (isPerson(entity)) await client.query(`INSERT INTO ${STATE_SCHEMA}.persons(revision_id,house,provider,external_id,name,availability,raw_id,provenance) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`, [revisionId, key.key.house, key.key.provider, key.key.externalId, key.name, key.status ?? null, p.rawId, JSON.stringify(p)]);
    else if (isMandate(entity)) await client.query(`INSERT INTO ${STATE_SCHEMA}.mandates(revision_id,house,provider,person_external_id,mandate_key,start_at,end_at,raw_id,provenance) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`, [revisionId, key.person.house, key.person.provider, key.person.externalId, key.mandateKey, key.start ?? null, key.end ?? null, p.rawId, JSON.stringify(p)]);
    else if (isMembership(entity)) { const membershipKey = membershipNaturalKey(entity); await client.query(`INSERT INTO ${STATE_SCHEMA}.party_memberships(revision_id,house,provider,person_external_id,membership_key,provider_party_id,raw_party_label,canonical_party,alias,start_at,end_at,raw_id,provenance) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT DO NOTHING`, [revisionId, key.person.house, key.person.provider, key.person.externalId, membershipKey, key.providerPartyId ?? null, key.rawPartyLabel ?? null, key.canonicalParty ?? null, key.alias ?? null, key.start ?? null, key.end ?? null, p.rawId, JSON.stringify(p)]); }
    else if (isProposal(entity)) await client.query(`INSERT INTO ${STATE_SCHEMA}.proposals(revision_id,house,provider,external_id,title,type,number,year,presented_at,status,raw_id,provenance) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT DO NOTHING`, [revisionId, key.key.house, key.key.provider, key.key.externalId, key.title ?? null, key.type ?? null, key.number ?? null, key.year ?? null, key.presentedAt ?? null, key.status ?? null, p.rawId, JSON.stringify(p)]);
    else if (isAuthor(entity)) { const authorKey = authorNaturalKey(entity); await client.query(`INSERT INTO ${STATE_SCHEMA}.proposal_authors(revision_id,house,provider,proposal_external_id,author_key,actor_type,actor_type_raw,actor_type_canonical,person_external_id,organization_external_id,actor_external_key,author_raw,role,author_order,raw_id,provenance) VALUES($1,$2,$3,$4,$5,$6,$6,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) ON CONFLICT DO NOTHING`, [revisionId, key.proposal.house, key.proposal.provider, key.proposal.externalId, authorKey, key.actorType, key.person?.externalId ?? null, key.organization?.externalId ?? null, key.actorExternalKey ? JSON.stringify(key.actorExternalKey) : null, key.authorRaw ?? null, key.role, key.order ?? null, p.rawId, JSON.stringify(p)]); }
    else if (isTheme(entity)) { const themeKey = `${key.providerThemeId ?? ''}|${key.label}|${key.taxonomy ?? ''}`; await client.query(`INSERT INTO ${STATE_SCHEMA}.state_proposal_themes(revision_id,house,provider,proposal_external_id,theme_key,label,taxonomy,source_key,raw_id,provenance,semantic_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING`, [revisionId, key.proposal.house, key.proposal.provider, key.proposal.externalId, themeKey, key.label, key.taxonomy ?? null, JSON.stringify({ providerThemeId: key.providerThemeId ?? null }), p.rawId, JSON.stringify(p), createHash('sha256').update(themeKey).digest('hex')]); }
    else if (isAppointment(entity)) { const appointmentKey = `${key.person.externalId}|${key.proposal?.externalId ?? ''}|${key.body?.externalId ?? ''}|${key.commission?.externalId ?? ''}|${key.kind}|${key.role ?? ''}|${key.occurredAt ?? key.start ?? ''}`; await client.query(`INSERT INTO ${STATE_SCHEMA}.state_rapporteurships(revision_id,house,provider,proposal_external_id,rapporteur_key,person_external_id,source_person_id,role_raw,body_source_id,body_name_raw,assigned_at,ended_at,observed_at,source_key,raw_id,provenance,semantic_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) ON CONFLICT DO NOTHING`, [revisionId, key.person.house, key.person.provider, key.proposal?.externalId ?? '', appointmentKey, key.person.externalId, key.person.externalId, key.role ?? key.kind, key.body?.externalId ?? key.commission?.externalId ?? null, null, key.start ?? key.occurredAt ?? null, key.end ?? null, key.occurredAt ?? null, JSON.stringify({ body: key.body ?? null, commission: key.commission ?? null }), p.rawId, JSON.stringify(p), createHash('sha256').update(appointmentKey).digest('hex')]); }
    else if (isMovement(entity)) await client.query(`INSERT INTO ${STATE_SCHEMA}.movements(revision_id,house,provider,proposal_external_id,movement_key,occurred_at,body,status,raw_id,provenance) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING`, [revisionId, key.proposal.house, key.proposal.provider, key.proposal.externalId, key.movementKey, key.occurredAt ?? null, key.body ?? null, key.status ?? null, p.rawId, JSON.stringify(p)]);
  }
}

async function saveRaw(client: PoolClient, envelope: RawEnvelope): Promise<void> {
  if (!envelope.body) throw new Error(`P1.5 raw body missing for ${envelope.rawId}`);
  const values = ['RO', 'sapl', envelope.resource, envelope.endpoint, JSON.stringify(envelope.params), envelope.externalId ?? null, envelope.fetchedAt, envelope.observedAt ?? null, envelope.status, envelope.contentType, envelope.sha256, envelope.body];
  await client.query(`INSERT INTO ${STATE_SCHEMA}.raw_objects(raw_id,house,provider,resource,endpoint,params,external_id,fetched_at,observed_at,status,content_type,sha256,body) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT(raw_id) DO NOTHING`, [envelope.rawId, envelope.house, envelope.provider, ...values.slice(2)]);
  const row = (await client.query<{ sha256: string }>(`SELECT sha256 FROM ${STATE_SCHEMA}.raw_objects WHERE raw_id=$1`, [envelope.rawId])).rows[0];
  if (row?.sha256 !== envelope.sha256) throw new Error(`raw hash mismatch for ${envelope.rawId}`);
}

async function withTransaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> { const client = await pool.connect(); try { await client.query('BEGIN'); const value = await work(client); await client.query('COMMIT'); return value; } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); } }
async function activeRevisions(pool: Pool): Promise<Record<string, string | null>> { const rows = (await pool.query<{ domain: string; revision_id: string }>(`SELECT domain,revision_id FROM ${STATE_SCHEMA}.active_publications WHERE house='RO'`)).rows; return Object.fromEntries(['identity','legislative'].map(domain => [domain, rows.find(row => row.domain === domain)?.revision_id ?? null])); }
async function stateCounts(pool: Pool): Promise<PersistenceCounts> { const q = async (table: string) => Number((await pool.query(`SELECT count(*)::int AS n FROM ${STATE_SCHEMA}.${table}`)).rows[0]?.n ?? 0); return { raw: await q('raw_objects'), identityMappings: await q('identity_mappings'), persons: await q('persons'), mandates: await q('mandates'), memberships: await q('party_memberships'), proposals: await q('proposals'), authors: await q('proposal_authors'), movements: await q('movements') }; }
async function semanticReplayCheck(pool: Pool, revisions: Record<string, string>): Promise<boolean> { const rows = (await pool.query<{ domain: string; revision_id: string }>(`SELECT domain,revision_id FROM ${STATE_SCHEMA}.active_publications WHERE house='RO'`)).rows; return Object.entries(revisions).every(([domain, revision]) => rows.some(row => row.domain === domain && row.revision_id === revision)); }
function uniqueEnvelopes(values: readonly RawEnvelope[]): RawEnvelope[] { return [...new Map(values.map(value => [value.rawId, value])).values()]; }
function publicRevisionId(batch: NormalizedBatch): string { const payload = batch.entities.map(entity => canonicalJson(semanticEntity(entity))).sort().join('\n'); return `state:RO:${batch.ingestion.domain}:${createHash('sha256').update(payload).digest('hex')}`; }
function semanticEntity(entity: NormalizedEntity): unknown { const value = { ...(entity as any) }; delete value.provenance; return value; }
function normalizedKey(entity: NormalizedEntity): string { const value = entity as any; if (value.key) return `${value.key.house}/${value.key.provider}/${value.key.resource}/${value.key.externalId}`; if (value.person && value.mandateKey) return `${value.person.externalId}/mandate/${value.mandateKey}`; if (value.person && value.proposal) return `${value.proposal.externalId}/author/${value.role}/${value.order ?? ''}`; if (value.proposal && value.movementKey) return `${value.proposal.externalId}/movement/${value.movementKey}`; return canonicalJson(entity); }
function isPerson(entity: NormalizedEntity): entity is any { const value = entity as any; return Boolean(value.key && value.name && value.provenance && value.key.resource === 'parlamentar'); }
function isProposal(entity: NormalizedEntity): entity is any { const value = entity as any; return Boolean(value.key && value.provenance && value.key.resource === 'materia'); }
function isMandate(entity: NormalizedEntity): entity is any { return Boolean((entity as any).mandateKey); }
function isMembership(entity: NormalizedEntity): entity is NormalizedPartyMembership { const value = entity as any; return Boolean(value.person && !value.mandateKey && !value.staffKey && !value.proposal && (value.providerPartyId || value.rawPartyLabel || value.start || value.end)); }
function isAuthor(entity: NormalizedEntity): entity is NormalizedProposalAuthor { const value = entity as any; return Boolean(value.proposal && value.role); }
function isMovement(entity: NormalizedEntity): entity is NormalizedMovement { return Boolean((entity as any).movementKey); }
function isTheme(entity: NormalizedEntity): entity is any { const value = entity as any; return Boolean(value.proposal && value.label && value.provenance && !value.role && !value.movementKey); }
function isAppointment(entity: NormalizedEntity): entity is any { const value = entity as any; return Boolean(value.person && value.kind && value.provenance && (value.proposal || value.body || value.commission)); }
function isIntervalEntity(entity: NormalizedEntity): entity is any { return Boolean((entity as any).start || (entity as any).end); }
function membershipNaturalKey(entity: NormalizedPartyMembership): string { return `${entity.providerPartyId ?? ''}|${entity.rawPartyLabel ?? ''}|${entity.start ?? ''}|${entity.end ?? ''}`; }
function authorNaturalKey(entity: NormalizedProposalAuthor): string { return `${entity.person?.externalId ?? entity.organization?.externalId ?? entity.actorExternalKey?.externalId ?? entity.authorRaw ?? ''}|${entity.actorType}|${entity.role}|${entity.order ?? ''}`; }

export async function readStateCounts(pool: Pool): Promise<PersistenceCounts> { return stateCounts(pool); }
export async function readActiveStateRevisions(pool: Pool): Promise<Readonly<Record<string, string | null>>> { return activeRevisions(pool); }
