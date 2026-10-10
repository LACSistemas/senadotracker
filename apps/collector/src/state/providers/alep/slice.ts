import { createHash, randomUUID } from 'node:crypto';
import type { CoverageManifest, NormalizedBatch, NormalizedEntity, Publication, QualityReport, RawEnvelope } from '../../contracts.ts';
import { houseCode, providerId } from '../../identifiers.ts';
import { qualityReportFromCounts, validateCoverageManifest, validatePublicDomainRevision } from '../../validation.ts';
import { AlepClient } from './client.ts';
import { AlepDiscovery, type AlepDiscoveryResult } from './discovery.ts';
import { AlepMapper, provenanceFromEnvelope } from './mapper.ts';

export interface AlepSliceOptions { readonly client: AlepClient; readonly year?: number; readonly maxRecords?: number; readonly detailLimit?: number; readonly runId?: string; readonly expectedSchemaHash?: string; }
export interface AlepSliceRunResult { readonly runId: string; readonly discovery: AlepDiscoveryResult; readonly rawEnvelopes: readonly RawEnvelope[]; readonly batches: readonly NormalizedBatch[]; readonly publications: readonly Publication[]; readonly coverage: readonly CoverageManifest[]; readonly quality: Readonly<Record<string, QualityReport>>; readonly metrics: Readonly<import('./client.ts').AlepRequestMetrics>; }

export async function runAlepSlice(options: AlepSliceOptions): Promise<AlepSliceRunResult> {
  const runId = options.runId ?? `state:pr:alep:${randomUUID()}`; const maxRecords = options.maxRecords ?? 5; const detailLimit = Math.min(options.detailLimit ?? 3, maxRecords); const discovery = await new AlepDiscovery(options.client).discover(options.expectedSchemaHash); const rawEnvelopes: RawEnvelope[] = [discovery.schemaEnvelope];
  const listResponse = await options.client.filter({ ...(options.year ? { ano: options.year } : {}), numeroMaximoRegistro: maxRecords }); rawEnvelopes.push(listResponse.envelope);
  const list = extractList(listResponse.data); const mapper = new AlepMapper(); const proposalRecords = list.slice(0, maxRecords); const proposals: NormalizedEntity[] = []; const authors: NormalizedEntity[] = []; const movements: NormalizedEntity[] = [];
  for (const record of proposalRecords) {
    const proposal = mapper.proposal(record, provenanceFromEnvelope(listResponse.envelope)); proposals.push(proposal);
    if (authors.length < detailLimit || movements.length < detailLimit) {
      const detail = await options.client.json<Record<string, unknown>>(`/proposicao/${proposal.key.externalId}`); rawEnvelopes.push(detail.envelope); const value = unwrap(detail.data); const detailProposal = mapper.proposal(value, provenanceFromEnvelope(detail.envelope));
      const existingIndex = proposals.findIndex(entity => 'key' in entity && entity.key.externalId === detailProposal.key.externalId); if (existingIndex >= 0) proposals[existingIndex] = detailProposal;
      if (stringValue(value.autor)) authors.push(mapper.author(value, detailProposal.key, provenanceFromEnvelope(detail.envelope)));
      const tramitacoes = Array.isArray(value.tramites) ? value.tramites : []; for (const tramite of tramitacoes) if (tramite && typeof tramite === 'object') movements.push(mapper.movement(tramite as Record<string, unknown>, detailProposal.key, provenanceFromEnvelope(detail.envelope)));
    }
  }
  const unique = <T extends NormalizedEntity>(values: T[], key: (value: T) => string): T[] => [...new Map(values.map(value => [key(value), value])).values()];
  const proposalEntities = unique(proposals as any[], value => `proposal/${(value as any).key.externalId}`); const authorEntities = unique(authors as any[], value => `author/${(value as any).proposal.externalId}/${(value as any).authorRaw ?? ''}`); const movementEntities = unique(movements as any[], value => `movement/${(value as any).proposal.externalId}/${(value as any).movementKey}`);
  const entities = [...proposalEntities, ...authorEntities, ...movementEntities];
  const dates = proposalEntities.map(value => (value as any).presentedAt).filter(Boolean).sort(); const manifests = [manifest('proposals', proposalEntities.length, true, dates), manifest('authorship', authorEntities.length, true, []), manifest('movements', movementEntities.length, true, movements.map(value => (value as any).occurredAt).filter(Boolean).sort())];
  const quality = qualityFromEntities(entities);
  const batch: NormalizedBatch = { ingestion: { house: houseCode('PR'), provider: providerId('alep_api'), domain: 'legislative', runId, batchId: `${runId}:legislative` }, entities, relations: [], coverage: manifests };
  const revisionId = publicRevisionId(batch); const revision = { house: batch.ingestion.house, domain: batch.ingestion.domain, revisionId, contributions: [batch.ingestion], status: quality.status === 'PASS' ? 'active' as const : 'rejected' as const }; validatePublicDomainRevision(revision); const publication: Publication = { revision, quality };
  return { runId, discovery, rawEnvelopes: [...new Map(rawEnvelopes.map(value => [value.rawId, value])).values()], batches: [batch], publications: [publication], coverage: manifests, quality: { legislative: quality }, metrics: { ...options.client.metrics } };
}

function manifest(capability: string, records: number, resolved: boolean, dates: string[]): CoverageManifest { const sorted = dates.filter(value => !Number.isNaN(Date.parse(value))).sort(); const value: CoverageManifest = { house: houseCode('PR'), provider: providerId('alep_api'), domain: 'legislative', capability, sourceExists: true, endpointExists: true, payloadAvailable: records > 0, relationshipResolved: resolved, historicalVerified: false, consumable: records > 0, earliestRecordDate: sorted[0] ?? null, latestRecordDate: sorted.at(-1) ?? null, checkedAt: new Date().toISOString(), availability: records > 0 ? 'available' : 'not_observed', recordsFound: records, recordsExpected: null, recordsResolved: resolved ? records : 0 }; validateCoverageManifest(value); return value; }
function qualityFromEntities(entities: readonly NormalizedEntity[]): QualityReport { const keys = entities.map(entity => entityKey(entity)); return qualityReportFromCounts({ identityCollisions: 0, missingRequiredIds: 0, duplicateNaturalKeys: keys.length - new Set(keys).size, brokenRelations: 0, invalidIntervals: 0 }); }
function entityKey(entity: NormalizedEntity): string { const value = entity as any; if (value.key) return `proposal/${value.key.externalId}`; if (value.proposal && value.authorRaw !== undefined) return `author/${value.proposal.externalId}/${value.authorRaw}`; if (value.proposal && value.movementKey) return `movement/${value.proposal.externalId}/${value.movementKey}`; return JSON.stringify(value); }
function publicRevisionId(batch: NormalizedBatch): string { const payload = batch.entities.map(entity => JSON.stringify(stripProvenance(entity))).sort().join('\n'); return `state:PR:legislative:${createHash('sha256').update(payload).digest('hex')}`; }
function stripProvenance(entity: NormalizedEntity): unknown { const value = { ...(entity as any) }; delete value.provenance; return value; }
function extractList(value: unknown): Record<string, unknown>[] { if (!value || typeof value !== 'object') return []; const root = value as Record<string, unknown>; return Array.isArray(root.lista) ? root.lista.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object')) : []; }
function unwrap(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) return {}; const root = value as Record<string, unknown>; return root.valor && typeof root.valor === 'object' && !Array.isArray(root.valor) ? root.valor as Record<string, unknown> : root; }
function stringValue(value: unknown): string | undefined { const text = typeof value === 'string' ? value.trim() : value === undefined || value === null ? '' : String(value).trim(); return text || undefined; }
