import { randomUUID } from 'node:crypto';
import type { CoverageManifest, IngestionRevision, NormalizedBatch, NormalizedEntity, Publication, QualityReport } from '../../contracts.ts';
import { externalId, houseCode, providerId, resourceType } from '../../identifiers.ts';
import { qualityReportFromCounts, validateCoverageManifest, validateExternalIdentityKey, validatePublicDomainRevision } from '../../validation.ts';
import type { SaplClient } from './client.ts';
import { SaplDiscovery } from './discovery.ts';
import { roSaplEndpoints } from './ro-config.ts';
import { SaplMapper } from './mapper.ts';

export interface RoSliceOptions {
  readonly client: SaplClient;
  readonly house?: string;
  readonly provider?: string;
  readonly endpoints?: Partial<typeof roSaplEndpoints>;
  /** SAPL deployments that expose the schema through a content-negotiated URL. */
  readonly schemaPath?: string;
  readonly pageSize?: number;
  readonly maxPages?: number;
  readonly expectedSchemaHash?: string;
  readonly runId?: string;
  readonly sanity?: { readonly authorshipId: string; readonly proposalId: string; readonly movementId: string };
  readonly verifySanity?: boolean;
}

export interface RoSliceRunResult {
  readonly runId: string;
  readonly discovery: Awaited<ReturnType<SaplDiscovery['discover']>>;
  readonly rawEnvelopes: readonly import('../../contracts.ts').RawEnvelope[];
  readonly batches: readonly NormalizedBatch[];
  readonly publications: readonly Publication[];
  readonly coverage: readonly CoverageManifest[];
  readonly quality: Readonly<Record<string, QualityReport>>;
  readonly metrics: Readonly<import('./client.ts').SaplRequestMetrics>;
  readonly sanity: { readonly requested?: RoSliceOptions['sanity']; readonly observedInSlice: boolean; readonly note: string };
}

export async function runRoSlice(options: RoSliceOptions): Promise<RoSliceRunResult> {
  const house = houseCode(options.house ?? 'RO'); const provider = providerId(options.provider ?? 'sapl'); const endpoints = { ...roSaplEndpoints, ...(options.endpoints ?? {}) }; const runId = options.runId ?? `state:${String(house).toLowerCase()}:sapl:${randomUUID()}`; const pageOptions = { pageSize: options.pageSize ?? 25, maxPages: options.maxPages ?? 1 }; const discovery = new SaplDiscovery(options.client); const discoveryResult = await discovery.discover(options.expectedSchemaHash, options.schemaPath); const mapper = new SaplMapper({ house, provider });
  const rawEnvelopes: import('../../contracts.ts').RawEnvelope[] = [discoveryResult.schemaEnvelope]; const errors: string[] = [];
  const pages = await Promise.all([
    options.client.page<Record<string, unknown>>(endpoints.parliamentary!, pageOptions),
    options.client.page<Record<string, unknown>>(endpoints.mandates!, pageOptions),
    options.client.page<Record<string, unknown>>(endpoints.memberships!, pageOptions),
    options.client.page<Record<string, unknown>>(endpoints.proposals!, pageOptions),
    options.client.page<Record<string, unknown>>(endpoints.authorship!, pageOptions),
    options.client.page<Record<string, unknown>>(endpoints.movements!, pageOptions),
  ]);
  for (const page of pages) rawEnvelopes.push(...page.envelopes);
  const [peoplePage, mandatesPage, membershipsPage, proposalsPage, authorsPage, movementsPage] = pages;
  const people = mapMany(peoplePage.records, record => mapper.person(record, peoplePage.envelopes[0]!), errors);
  const mandates = mapMany(mandatesPage.records, record => mapper.mandate(record, mandatesPage.envelopes[0]!), errors);
  const memberships = mapMany(membershipsPage.records, record => mapper.partyMembership(record, membershipsPage.envelopes[0]!), errors);
  const proposals = mapMany(proposalsPage.records, record => mapper.proposal(record, proposalsPage.envelopes[0]!), errors);
  const authors = mapMany(authorsPage.records, record => mapper.author(record, authorsPage.envelopes[0]!), errors);
  const movements = mapMany(movementsPage.records, record => mapper.movement(record, movementsPage.envelopes[0]!), errors);
  const identityEntities: NormalizedEntity[] = [...people, ...mandates, ...memberships]; const legislativeEntities: NormalizedEntity[] = [...proposals, ...authors, ...movements];
  const identityCoverage = coverage('identity', 'people', people.length, rawEnvelopes, Boolean(people.length), dateRange([]), String(house), String(provider));
  const mandatesCoverage = coverage('identity', 'mandates', mandates.length, rawEnvelopes, mandates.every(value => Boolean(value.person.externalId)), dateRange(mandates.flatMap(value => [value.start, value.end].filter((item): item is string => Boolean(item)))), String(house), String(provider));
  const partyCoverage = coverage('identity', 'party_membership', memberships.length, rawEnvelopes, memberships.every(value => Boolean(value.person.externalId)), dateRange(memberships.flatMap(value => [value.start, value.end].filter((item): item is string => Boolean(item)))), String(house), String(provider));
  const proposalsCoverage = coverage('legislative', 'proposals', proposals.length, rawEnvelopes, proposals.length > 0, dateRange(proposals.flatMap(value => [value.presentedAt].filter((item): item is string => Boolean(item)))), String(house), String(provider));
  const authorshipCoverage = coverage('legislative', 'authorship', authors.length, rawEnvelopes, authors.every(value => Boolean(value.proposal.externalId)), dateRange([]), String(house), String(provider));
  const movementsCoverage = coverage('legislative', 'movements', movements.length, rawEnvelopes, movements.every(value => Boolean(value.proposal.externalId)), dateRange(movements.flatMap(value => [value.occurredAt].filter((item): item is string => Boolean(item)))), String(house), String(provider));
  const identityBatch = batch({ house, provider, domain: 'identity', runId, entities: identityEntities, coverage: [identityCoverage, mandatesCoverage, partyCoverage] });
  const legislativeBatch = batch({ house, provider, domain: 'legislative', runId, entities: legislativeEntities, coverage: [proposalsCoverage, authorshipCoverage, movementsCoverage] });
  const identityQuality = quality(identityEntities, errors, discoveryResult.drift.drift); const legislativeQuality = quality(legislativeEntities, errors, discoveryResult.drift.drift);
  const identityPublication = publication(identityBatch, identityQuality); const legislativePublication = publication(legislativeBatch, legislativeQuality);
  let sanity = options.sanity ? checkSanity(options.sanity, authorsPage.records, proposalsPage.records, movementsPage.records) : { observedInSlice: false, note: 'no sanity IDs requested' };
  if (options.sanity && options.verifySanity && !sanity.observedInSlice) {
    const verified = await verifySanity(options.client, options.sanity);
    rawEnvelopes.push(...verified.envelopes); sanity = verified.result;
  }
  return { runId, discovery: discoveryResult, rawEnvelopes, batches: [identityBatch, legislativeBatch], publications: [identityPublication, legislativePublication], coverage: [identityCoverage, mandatesCoverage, partyCoverage, proposalsCoverage, authorshipCoverage, movementsCoverage], quality: { identity: identityQuality, legislative: legislativeQuality }, metrics: { ...options.client.metrics }, sanity: { ...(options.sanity ? { requested: options.sanity } : {}), ...sanity } };
}

function mapMany<T>(records: Record<string, unknown>[], map: (record: Record<string, unknown>) => T, errors: string[]): T[] { const values: T[] = []; for (const record of records) try { values.push(map(record)); } catch (error) { errors.push(error instanceof Error ? error.message : String(error)); } return values; }
function batch(input: { house: import('../../contracts.ts').HouseCode; provider: import('../../contracts.ts').ProviderId; domain: string; runId: string; entities: NormalizedEntity[]; coverage: CoverageManifest[] }): NormalizedBatch { return { ingestion: { house: input.house, provider: input.provider, domain: input.domain, runId: input.runId, batchId: `${input.runId}:${input.domain}` }, entities: input.entities, relations: [], coverage: input.coverage }; }
function coverage(domain: string, capability: string, records: number, envelopes: readonly import('../../contracts.ts').RawEnvelope[], relationshipResolved: boolean, dates: { earliest: string | null; latest: string | null }, house = 'RO', provider = 'sapl'): CoverageManifest { const envelope = envelopes.find(value => value.resource === resourceType(capability === 'people' ? 'parlamentar' : capability === 'party_membership' ? 'mandato' : capability)) ?? envelopes[0]; const manifest: CoverageManifest = { house: houseCode(house), provider: providerId(provider), domain, capability, sourceExists: true, endpointExists: Boolean(envelope), payloadAvailable: records > 0, relationshipResolved, historicalVerified: false, consumable: records > 0, earliestRecordDate: dates.earliest, latestRecordDate: dates.latest, checkedAt: new Date().toISOString(), availability: records > 0 ? 'available' : 'not_observed', recordsFound: records, recordsExpected: null, recordsResolved: relationshipResolved ? records : 0 }; validateCoverageManifest(manifest); return manifest; }
function quality(entities: readonly NormalizedEntity[], errors: readonly string[], schemaDrift: boolean): QualityReport { const keys = entities.map(entity => entityKey(entity)); const duplicateNaturalKeys = keys.length - new Set(keys).size; const counts = { identityCollisions: 0, missingRequiredIds: errors.length, duplicateNaturalKeys, brokenRelations: 0, invalidIntervals: 0 }; const report = qualityReportFromCounts(counts); return schemaDrift || errors.length ? { ...report, status: 'FAIL' } : report; }
function entityKey(entity: NormalizedEntity): string { if ('key' in entity) return `${entity.key.house}/${entity.key.provider}/${entity.key.resource}/${entity.key.externalId}`; if ('person' in entity && 'mandateKey' in entity) return `${entity.person.externalId}/${entity.mandateKey}`; if ('person' in entity && 'staffKey' in entity) return `${entity.person.externalId}/${entity.staffKey}`; if ('proposal' in entity && 'role' in entity) return `${entity.proposal.externalId}/${entity.role}/${'order' in entity ? entity.order ?? '' : ''}`; if ('proposal' in entity && 'movementKey' in entity) return `${entity.proposal.externalId}/${entity.movementKey}`; return JSON.stringify(entity); }
function publication(batchValue: NormalizedBatch, report: QualityReport): Publication { const revision = { house: batchValue.ingestion.house, domain: batchValue.ingestion.domain, revisionId: `${batchValue.ingestion.batchId}:public`, contributions: [batchValue.ingestion], status: report.status === 'PASS' ? 'active' as const : 'rejected' as const }; validatePublicDomainRevision(revision); return { revision, quality: report }; }
function dateRange(values: readonly string[]): { earliest: string | null; latest: string | null } { const sorted = values.filter(value => !Number.isNaN(Date.parse(value))).sort(); return { earliest: sorted[0] ?? null, latest: sorted.at(-1) ?? null }; }
function checkSanity(expected: NonNullable<RoSliceOptions['sanity']>, authors: readonly Record<string, unknown>[], proposals: readonly Record<string, unknown>[], movements: readonly Record<string, unknown>[]): { observedInSlice: boolean; note: string } { const authorFound = authors.some(value => String(value.id ?? value.pk) === expected.authorshipId && String(value.materia ?? value.materia_id) === expected.proposalId); const proposalFound = proposals.some(value => String(value.id ?? value.pk) === expected.proposalId); const movementFound = movements.some(value => String(value.id ?? value.pk) === expected.movementId && String(value.materia ?? value.materia_id) === expected.proposalId); return { observedInSlice: authorFound && proposalFound && movementFound, note: `authorship=${authorFound}, proposal=${proposalFound}, movement=${movementFound}` }; }

async function verifySanity(client: SaplClient, expected: NonNullable<RoSliceOptions['sanity']>): Promise<{ envelopes: import('../../contracts.ts').RawEnvelope[]; result: { observedInSlice: boolean; note: string } }> {
  const [author, proposal, movement] = await Promise.all([
    client.json<Record<string, unknown>>(`/api/materia/autoria/${expected.authorshipId}/`),
    client.json<Record<string, unknown>>(`/api/materia/materialegislativa/${expected.proposalId}/`),
    client.json<Record<string, unknown>>(`/api/materia/tramitacao/${expected.movementId}/`),
  ]);
  const authorRecord = unwrapRecord(author.data); const proposalRecord = unwrapRecord(proposal.data); const movementRecord = unwrapRecord(movement.data);
  const authorFound = String(authorRecord.id ?? authorRecord.pk) === expected.authorshipId && String(authorRecord.materia ?? authorRecord.materia_id) === expected.proposalId;
  const proposalFound = String(proposalRecord.id ?? proposalRecord.pk) === expected.proposalId;
  const movementFound = String(movementRecord.id ?? movementRecord.pk) === expected.movementId && String(movementRecord.materia ?? movementRecord.materia_id) === expected.proposalId;
  return { envelopes: [author.envelope, proposal.envelope, movement.envelope], result: { observedInSlice: authorFound && proposalFound && movementFound, note: `detail authorship=${authorFound}, proposal=${proposalFound}, movement=${movementFound}` } };
}

function unwrapRecord(value: unknown): Record<string, unknown> { if (value && typeof value === 'object' && !Array.isArray(value)) { const object = value as Record<string, unknown>; for (const key of ['results', 'data', 'object']) if (object[key] && typeof object[key] === 'object' && !Array.isArray(object[key])) return object[key] as Record<string, unknown>; return object; } return {}; }

