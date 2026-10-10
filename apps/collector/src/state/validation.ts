import type {
  CoverageManifest,
  ExternalIdentityKey,
  HouseConfig,
  IdentityMapping,
  IngestionRevision,
  NormalizedAgendaItem,
  NormalizedAttendance,
  NormalizedDeliberation,
  NormalizedLegislativeAppointment,
  NormalizedNorm,
  NormalizedVote,
  ProviderBinding,
  PublicDomainRevision,
  QualityReport,
} from './contracts.ts';

const authorities = new Set(['primary', 'secondary', 'enrichment', 'fallback']);
const mergeStrategies = new Set(['exclusive', 'union', 'overlay', 'reconcile']);

function required(value: string, field: string): void {
  if (!value.trim()) throw new Error(`${field} must not be empty`);
}

function dateOrNull(value: string | null | undefined, field: string): void {
  if (value !== null && value !== undefined && Number.isNaN(Date.parse(value))) throw new Error(`${field} must be an ISO date/time`);
}

export function validateExternalIdentityKey(key: ExternalIdentityKey): void {
  required(key.house, 'house'); required(key.provider, 'provider'); required(key.resource, 'resource'); required(key.externalId, 'externalId');
}

export function externalIdentityKeyFingerprint(key: ExternalIdentityKey): string {
  validateExternalIdentityKey(key);
  return [key.house, key.provider, key.resource, key.externalId].join('/');
}

export function externalIdentityKeysEqual(a: ExternalIdentityKey, b: ExternalIdentityKey): boolean {
  return externalIdentityKeyFingerprint(a) === externalIdentityKeyFingerprint(b);
}

export function validateProviderBinding(binding: ProviderBinding): void {
  required(binding.provider, 'provider'); required(binding.domain, 'domain');
  if (!Number.isInteger(binding.priority) || binding.priority < 0) throw new Error('priority must be a non-negative integer');
  if (binding.capabilities.length === 0 || new Set(binding.capabilities).size !== binding.capabilities.length || binding.capabilities.some(capability => !capability.trim())) throw new Error('capabilities must be non-empty and unique');
  if (!authorities.has(binding.authority)) throw new Error(`invalid authority: ${binding.authority}`);
  if (!mergeStrategies.has(binding.mergeStrategy)) throw new Error(`invalid merge strategy: ${binding.mergeStrategy}`);
}

export function validateHouseConfig(config: HouseConfig): void {
  required(config.house, 'house'); required(config.name, 'name');
  const seen = new Set<string>();
  for (const binding of config.bindings) {
    validateProviderBinding(binding);
    const key = `${binding.provider}|${binding.domain}`;
    if (seen.has(key) && binding.mergeStrategy === 'exclusive') throw new Error(`duplicate exclusive binding: ${key}`);
    seen.add(key);
  }
}

export function validateCoverageManifest(manifest: CoverageManifest): void {
  required(manifest.house, 'house'); required(manifest.provider, 'provider'); required(manifest.domain, 'domain'); required(manifest.capability, 'capability');
  dateOrNull(manifest.earliestRecordDate, 'earliestRecordDate'); dateOrNull(manifest.latestRecordDate, 'latestRecordDate'); dateOrNull(manifest.checkedAt, 'checkedAt');
  if (manifest.earliestRecordDate && manifest.latestRecordDate && Date.parse(manifest.earliestRecordDate) > Date.parse(manifest.latestRecordDate)) throw new Error('earliestRecordDate must not be after latestRecordDate');
}

export function validateInterval(start: string, end?: string): void {
  dateOrNull(start, 'start'); dateOrNull(end, 'end');
  if (end !== undefined && Date.parse(start) > Date.parse(end)) throw new Error('interval start must not be after end');
}

export function validateIngestionRevision(revision: IngestionRevision): void {
  required(revision.house, 'house'); required(revision.provider, 'provider'); required(revision.domain, 'domain'); required(revision.runId, 'runId'); required(revision.batchId, 'batchId');
}

export function validatePublicDomainRevision(revision: PublicDomainRevision): void {
  required(revision.house, 'house'); required(revision.domain, 'domain'); required(revision.revisionId, 'revisionId');
  if (revision.contributions.length === 0) throw new Error('public revision needs at least one contribution');
  for (const contribution of revision.contributions) {
    validateIngestionRevision(contribution);
    if (contribution.house !== revision.house || contribution.domain !== revision.domain) throw new Error('contribution house/domain does not match public revision');
  }
}

export function validateIdentityMapping(mapping: IdentityMapping): void {
  validateExternalIdentityKey(mapping.external); required(mapping.rawId, 'rawId');
  if (mapping.confidence !== undefined && (mapping.confidence < 0 || mapping.confidence > 1)) throw new Error('confidence must be between 0 and 1');
  if (mapping.validFrom !== undefined || mapping.validTo !== undefined) validateInterval(mapping.validFrom ?? mapping.validTo!, mapping.validTo);
  if (mapping.status === 'confirmed' && !mapping.canonicalEntityId) throw new Error('confirmed identity mapping needs canonicalEntityId');
}

export function qualityReportFromCounts(counts: Omit<QualityReport, 'status'>): QualityReport {
  const failed = counts.identityCollisions > 0 || counts.missingRequiredIds > 0 || counts.duplicateNaturalKeys > 0 || counts.brokenRelations > 0 || counts.invalidIntervals > 0;
  return { ...counts, status: failed ? 'FAIL' : 'PASS' };
}

export function validateNormalizedDeliberation(value: NormalizedDeliberation): void {
  validateExternalIdentityKey(value.key);
  validateExternalIdentityKey(value.session ?? value.proposal ?? value.objectExternalKey ?? value.key);
}

export function validateNormalizedVote(value: NormalizedVote): void {
  validateExternalIdentityKey(value.deliberation);
  required(value.choice, 'choice');
}

export function validateNormalizedAttendance(value: NormalizedAttendance): void {
  validateExternalIdentityKey(value.session);
  required(value.state, 'state');
  dateOrNull(value.occurredAt, 'occurredAt');
}

export function validateNormalizedAgendaItem(value: NormalizedAgendaItem): void {
  validateExternalIdentityKey(value.meeting);
  if (value.proposal) validateExternalIdentityKey(value.proposal);
  if (value.externalObject) validateExternalIdentityKey(value.externalObject);
  dateOrNull(value.addedAt, 'addedAt'); dateOrNull(value.removedAt, 'removedAt');
  if (value.addedAt && value.removedAt && Date.parse(value.addedAt) > Date.parse(value.removedAt)) throw new Error('agenda item addedAt must not be after removedAt');
}

export function validateNormalizedAppointment(value: NormalizedLegislativeAppointment): void {
  validateExternalIdentityKey(value.person);
  if (value.proposal) validateExternalIdentityKey(value.proposal);
  if (value.body) validateExternalIdentityKey(value.body);
  if (value.commission) validateExternalIdentityKey(value.commission);
  required(value.kind, 'kind');
  if (value.start !== undefined) validateInterval(value.start, value.end);
  dateOrNull(value.occurredAt, 'occurredAt');
}

export function validateNormalizedNorm(value: NormalizedNorm): void {
  validateExternalIdentityKey(value.key);
  validateExternalIdentityKey(value.proposal);
}
