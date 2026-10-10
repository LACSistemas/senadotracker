/** Provider-independent contracts for the future state collectors.
 *
 * This module is deliberately persistence-free: providers return these values
 * and a later publication layer decides how/when to store them.
 */

export type HouseCode = string & { readonly __brand: 'HouseCode' };
export type ProviderId = string & { readonly __brand: 'ProviderId' };
export type ResourceType = string & { readonly __brand: 'ResourceType' };
export type ExternalId = string & { readonly __brand: 'ExternalId' };

export type CapabilityState = 'supported' | 'partial' | 'unsupported' | 'unknown';
export type Availability = 'available' | 'partial' | 'unavailable' | 'not_collected' | 'not_observed' | 'unknown';
export type TemporalPrecision = 'instant' | 'day' | 'month' | 'competence' | 'interval' | 'unknown';
export type Authority = 'primary' | 'secondary' | 'enrichment' | 'fallback';
export type MergeStrategy = 'exclusive' | 'union' | 'overlay' | 'reconcile';
export type PublicationStatus = 'staged' | 'active' | 'rejected';
export type IdentityMappingStatus = 'pending' | 'confirmed' | 'ambiguous' | 'rejected';
export type AttendanceScope = 'session' | 'order_of_day' | 'meeting' | 'other';
export type AppointmentKind = 'rapporteurship' | 'reviewer' | 'commission' | 'office' | 'other';

export type UnknownBoolean = boolean | 'unknown';
export type Domain = 'identity' | 'legislative' | 'participation' | 'commission' | 'finance' | 'staff' | 'electoral' | string;

export interface ExternalIdentityKey {
  readonly house: HouseCode;
  readonly provider: ProviderId;
  readonly resource: ResourceType;
  readonly externalId: ExternalId;
}

export interface ProviderBinding {
  readonly provider: ProviderId;
  readonly domain: Domain;
  readonly capabilities: readonly string[];
  readonly priority: number;
  readonly authority: Authority;
  readonly mergeStrategy: MergeStrategy;
  readonly enabled: boolean;
}

export interface HouseConfig {
  readonly house: HouseCode;
  readonly name: string;
  readonly bindings: readonly ProviderBinding[];
}

export interface DiscoveryResult {
  readonly providerDetected: ProviderId;
  readonly version?: string;
  readonly endpoints: readonly string[];
  readonly capabilities: Readonly<Record<string, CapabilityState>>;
  readonly auth: 'none' | 'configured' | 'required' | 'unknown';
  readonly pagination: 'bulk' | 'paginated' | 'per_entity' | 'mixed' | 'unknown';
  readonly schemaHash?: string;
  readonly checkedAt: string;
}

export interface CoverageManifest {
  readonly house: HouseCode;
  readonly provider: ProviderId;
  readonly domain: Domain;
  readonly capability: string;
  readonly sourceExists: UnknownBoolean;
  readonly endpointExists: UnknownBoolean;
  readonly payloadAvailable: UnknownBoolean;
  readonly relationshipResolved: UnknownBoolean;
  readonly historicalVerified: UnknownBoolean;
  readonly consumable: UnknownBoolean;
  readonly earliestRecordDate: string | null;
  readonly latestRecordDate: string | null;
  readonly checkedAt: string;
  readonly availability: Availability;
  readonly recordsFound?: number;
  readonly recordsExpected?: number | null;
  readonly recordsResolved?: number;
}

export interface Provenance {
  readonly rawId: string;
  readonly endpoint: string;
  readonly fetchedAt: string;
  readonly observedAt?: string;
  readonly sha256: string;
  /** Source-native request dimensions retained before parsing. */
  readonly requestContext?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface RawEnvelope {
  readonly house: HouseCode;
  readonly provider: ProviderId;
  readonly resource: ResourceType;
  readonly endpoint: string;
  readonly params: Readonly<Record<string, string | number | boolean | null>>;
  readonly externalId?: ExternalId;
  readonly fetchedAt: string;
  readonly observedAt?: string;
  readonly status: number;
  readonly contentType: string;
  readonly sha256: string;
  readonly rawId: string;
  /** UTF-8 response body retained for the physical raw replay store. */
  readonly body?: string;
}

export interface IngestionRevision {
  readonly house: HouseCode;
  readonly provider: ProviderId;
  readonly domain: Domain;
  readonly runId: string;
  readonly batchId: string;
}

export interface PublicDomainRevision {
  readonly house: HouseCode;
  readonly domain: Domain;
  readonly revisionId: string;
  readonly contributions: readonly IngestionRevision[];
  readonly status: PublicationStatus;
}

export interface IdentityMapping {
  readonly external: ExternalIdentityKey;
  readonly canonicalEntityId?: string;
  readonly status: IdentityMappingStatus;
  readonly confidence?: number;
  readonly method?: string;
  readonly validFrom?: string;
  readonly validTo?: string;
  readonly rawId: string;
}

export interface NormalizedPerson { readonly key: ExternalIdentityKey; readonly name: string; readonly provenance: Provenance; readonly status?: Availability; }
export interface NormalizedMandate { readonly person: ExternalIdentityKey; readonly mandateKey: string; readonly start?: string; readonly end?: string; readonly provenance: Provenance; }
export interface NormalizedPartyMembership { readonly person: ExternalIdentityKey; readonly providerPartyId?: string; readonly rawPartyLabel?: string; readonly canonicalParty?: string; readonly alias?: string; readonly start?: string; readonly end?: string; readonly provenance: Provenance; }
export interface NormalizedProposal { readonly key: ExternalIdentityKey; readonly title?: string; readonly type?: string; readonly number?: string; readonly year?: number; readonly presentedAt?: string; readonly status?: string; readonly provenance: Provenance; }
export type ProposalActorType = 'parliamentarian' | 'executive' | 'board' | 'commission' | 'caucus' | 'organization' | 'citizen' | 'other';
export interface NormalizedProposalAuthor { readonly proposal: ExternalIdentityKey; readonly actorType: ProposalActorType; readonly person?: ExternalIdentityKey; readonly organization?: ExternalIdentityKey; readonly actorExternalKey?: ExternalIdentityKey; readonly authorRaw?: string; readonly role: string; readonly order?: number; readonly provenance: Provenance; }
export interface NormalizedProposalTheme { readonly proposal: ExternalIdentityKey; readonly providerThemeId?: string; readonly label: string; readonly taxonomy?: string; readonly provenance: Provenance; }
export interface NormalizedProposalRelation { readonly from: ExternalIdentityKey; readonly to: ExternalIdentityKey; readonly kind: string; readonly provenance: Provenance; }
export interface NormalizedMovement { readonly proposal: ExternalIdentityKey; readonly movementKey: string; readonly occurredAt?: string; readonly body?: string; readonly status?: string; readonly provenance: Provenance; }
export interface NormalizedNorm { readonly key: ExternalIdentityKey; readonly proposal: ExternalIdentityKey; readonly designation?: string; readonly number?: string; readonly year?: number; readonly type?: string; readonly provenance: Provenance; }
export interface NormalizedLegislativeAppointment { readonly person: ExternalIdentityKey; readonly proposal?: ExternalIdentityKey; readonly body?: ExternalIdentityKey; readonly commission?: ExternalIdentityKey; readonly kind: AppointmentKind; readonly role?: string; readonly start?: string; readonly end?: string; readonly occurredAt?: string; readonly status?: string; readonly provenance: Provenance; }
export interface NormalizedSession { readonly key: ExternalIdentityKey; readonly occurredAt: string; readonly kind?: string; readonly provenance: Provenance; }
export interface NormalizedDeliberation { readonly key: ExternalIdentityKey; readonly session?: ExternalIdentityKey; readonly proposal?: ExternalIdentityKey; readonly objectExternalKey?: ExternalIdentityKey; readonly occurredAt?: string; readonly body?: string; readonly type?: string; readonly nominal?: boolean; readonly result?: string; readonly turn?: string; readonly stage?: string; readonly status?: string; readonly provenance: Provenance; }
export interface NormalizedVote { readonly deliberation: ExternalIdentityKey; readonly person?: ExternalIdentityKey; readonly choice: string; readonly provenance: Provenance; }
export interface NormalizedAttendance { readonly session: ExternalIdentityKey; readonly person?: ExternalIdentityKey; readonly state: string; readonly scope: AttendanceScope; readonly occurredAt?: string; readonly provenance: Provenance; }
export interface NormalizedCommission { readonly key: ExternalIdentityKey; readonly name: string; readonly provenance: Provenance; }
export interface NormalizedCommissionMembership { readonly commission: ExternalIdentityKey; readonly person: ExternalIdentityKey; readonly role?: string; readonly start?: string; readonly end?: string; readonly provenance: Provenance; }
export interface NormalizedMeeting { readonly key: ExternalIdentityKey; readonly commission?: ExternalIdentityKey; readonly occurredAt?: string; readonly provenance: Provenance; }
export interface NormalizedAgendaItem { readonly meeting: ExternalIdentityKey; readonly proposal?: ExternalIdentityKey; readonly externalObject?: ExternalIdentityKey; readonly order?: number; readonly status?: string; readonly result?: string; readonly addedAt?: string; readonly removedAt?: string; readonly provenance: Provenance; }
/**
 * Canonical parliamentary-expense contract.  The original state slice only
 * needed `amountCents` and `category`; these fields are intentionally
 * additive so providers can retain the evidence exposed by state portals
 * without putting supplier/document data in an opaque JSON blob.
 */
export interface NormalizedExpense {
  readonly key: ExternalIdentityKey;
  readonly person?: ExternalIdentityKey;
  readonly occurredAt?: string;
  readonly competence?: string;
  readonly periodStart?: string;
  readonly periodEnd?: string;
  readonly temporalPrecision: TemporalPrecision;
  readonly amountCents?: number;
  readonly grossAmountCents?: number;
  readonly claimedAmountCents?: number;
  readonly reimbursedAmountCents?: number;
  readonly glosaAmountCents?: number;
  readonly category?: string;
  readonly supplier?: ExternalIdentityKey;
  readonly supplierName?: string;
  readonly supplierDocument?: string;
  readonly supplierType?: 'cpf' | 'cnpj' | 'other' | 'unknown';
  readonly fiscalDocument?: string;
  readonly description?: string;
  readonly sourceUrl?: string;
  readonly granularity?: 'itemized' | 'aggregated';
  readonly provenance: Provenance;
}
export interface NormalizedSupplierLink { readonly expense: ExternalIdentityKey; readonly supplier: ExternalIdentityKey; readonly name?: string; readonly document?: string; readonly provenance: Provenance; }
export interface NormalizedStaffAssignment { readonly person: ExternalIdentityKey; readonly staffKey: string; readonly role?: string; readonly start?: string; readonly end?: string; readonly observedAt: string; readonly provenance: Provenance; }

export type NormalizedEntity = NormalizedPerson | NormalizedMandate | NormalizedPartyMembership | NormalizedProposal | NormalizedProposalAuthor | NormalizedProposalTheme | NormalizedProposalRelation | NormalizedMovement | NormalizedNorm | NormalizedLegislativeAppointment | NormalizedSession | NormalizedDeliberation | NormalizedVote | NormalizedAttendance | NormalizedCommission | NormalizedCommissionMembership | NormalizedMeeting | NormalizedAgendaItem | NormalizedExpense | NormalizedSupplierLink | NormalizedStaffAssignment;
export type NormalizedRelation = NormalizedProposalRelation | NormalizedSupplierLink;

export interface NormalizedBatch {
  readonly ingestion: IngestionRevision;
  readonly entities: readonly NormalizedEntity[];
  readonly relations: readonly NormalizedRelation[];
  readonly coverage: readonly CoverageManifest[];
}

export type QualityStatus = 'PASS' | 'WARN' | 'FAIL';
export interface QualityReport {
  readonly status: QualityStatus;
  readonly identityCollisions: number;
  readonly missingRequiredIds: number;
  readonly duplicateNaturalKeys: number;
  readonly brokenRelations: number;
  readonly invalidIntervals: number;
}

export interface Publication { readonly revision: PublicDomainRevision; readonly quality: QualityReport; }

export interface FetchContext { readonly house: HouseCode; readonly provider: ProviderId; readonly domain: Domain; readonly runId: string; readonly year?: number; readonly cursor?: string; }
export interface ProviderPerson { readonly external: ExternalIdentityKey; readonly name: string; readonly provenance: Provenance; }
export interface ProviderMandate { readonly external: ExternalIdentityKey; readonly person: ExternalIdentityKey; readonly start?: string; readonly end?: string; readonly provenance: Provenance; }
export interface ProviderMembership { readonly external: ExternalIdentityKey; readonly person: ExternalIdentityKey; readonly party?: string; readonly provenance: Provenance; }
export interface ProviderProposal { readonly external: ExternalIdentityKey; readonly provenance: Provenance; }
export interface ProviderAuthor { readonly proposal: ExternalIdentityKey; readonly provenance: Provenance; }
export interface ProviderMovement { readonly proposal: ExternalIdentityKey; readonly provenance: Provenance; }
export interface ProviderRelation { readonly from: ExternalIdentityKey; readonly to: ExternalIdentityKey; readonly kind: string; readonly provenance: Provenance; }
export interface ProviderNorm { readonly external: ExternalIdentityKey; readonly proposal?: ExternalIdentityKey; readonly provenance: Provenance; }
export interface ProviderTheme { readonly proposal: ExternalIdentityKey; readonly label: string; readonly provenance: Provenance; }
export interface ProviderAppointment { readonly person: ExternalIdentityKey; readonly provenance: Provenance; }
export interface ProviderSession { readonly external: ExternalIdentityKey; readonly provenance: Provenance; }
export interface ProviderDeliberation { readonly external: ExternalIdentityKey; readonly provenance: Provenance; }
export interface ProviderVote { readonly deliberation: ExternalIdentityKey; readonly provenance: Provenance; }
export interface ProviderAttendance { readonly session: ExternalIdentityKey; readonly provenance: Provenance; }
export interface ProviderCommission { readonly external: ExternalIdentityKey; readonly provenance: Provenance; }
export interface ProviderCommissionMembership { readonly commission: ExternalIdentityKey; readonly person: ExternalIdentityKey; readonly provenance: Provenance; }
export interface ProviderMeeting { readonly external: ExternalIdentityKey; readonly provenance: Provenance; }
export interface ProviderAgendaItem { readonly meeting: ExternalIdentityKey; readonly provenance: Provenance; }
export interface ProviderExpense { readonly external: ExternalIdentityKey; readonly provenance: Provenance; }
export interface ProviderSupplierLink { readonly expense: ExternalIdentityKey; readonly supplier: ExternalIdentityKey; readonly provenance: Provenance; }
export interface ProviderOffice { readonly external: ExternalIdentityKey; readonly provenance: Provenance; }
export interface ProviderStaffAssignment { readonly person: ExternalIdentityKey; readonly provenance: Provenance; }
export interface ProviderCandidacy { readonly external: ExternalIdentityKey; readonly provenance: Provenance; }
export interface ProviderAsset { readonly external: ExternalIdentityKey; readonly provenance: Provenance; }

export interface IdentityProvider { people(context: FetchContext): AsyncIterable<ProviderPerson>; mandates(context: FetchContext): AsyncIterable<ProviderMandate>; memberships(context: FetchContext): AsyncIterable<ProviderMembership>; }
export interface LegislativeProvider { proposals(context: FetchContext): AsyncIterable<ProviderProposal>; authors(context: FetchContext): AsyncIterable<ProviderAuthor>; movements(context: FetchContext): AsyncIterable<ProviderMovement>; relations(context: FetchContext): AsyncIterable<ProviderRelation>; norms(context: FetchContext): AsyncIterable<ProviderNorm>; themes(context: FetchContext): AsyncIterable<ProviderTheme>; appointments(context: FetchContext): AsyncIterable<ProviderAppointment>; }
export interface ParticipationProvider { sessions(context: FetchContext): AsyncIterable<ProviderSession>; deliberations(context: FetchContext): AsyncIterable<ProviderDeliberation>; votes(context: FetchContext): AsyncIterable<ProviderVote>; attendance(context: FetchContext): AsyncIterable<ProviderAttendance>; }
export interface CommissionProvider { commissions(context: FetchContext): AsyncIterable<ProviderCommission>; memberships(context: FetchContext): AsyncIterable<ProviderCommissionMembership>; meetings(context: FetchContext): AsyncIterable<ProviderMeeting>; agendaItems(context: FetchContext): AsyncIterable<ProviderAgendaItem>; }
export interface FinanceProvider { expenses(context: FetchContext): AsyncIterable<ProviderExpense>; suppliers(context: FetchContext): AsyncIterable<ProviderSupplierLink>; }
export interface StaffProvider { offices(context: FetchContext): AsyncIterable<ProviderOffice>; staff(context: FetchContext): AsyncIterable<ProviderStaffAssignment>; }
export interface ElectoralProvider { candidacies(context: FetchContext): AsyncIterable<ProviderCandidacy>; assets(context: FetchContext): AsyncIterable<ProviderAsset>; }
