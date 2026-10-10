export type CollectorDomain = 'finance' | 'profiles' | 'mandates' | 'commissions' | 'agenda' | 'propositions' | (string & {});
export type CollectionModel =
  | 'SNAPSHOT'
  | 'INCREMENTAL'
  | 'EVENT_STREAM'
  | 'FULL_SNAPSHOT'
  | 'PARTITIONED_BY_COMPETENCE'
  | 'PARTITIONED_BY_PARLIAMENTARIAN_COMPETENCE'
  | 'IMMUTABLE_DOCUMENT_CORPUS'
  | 'CUMULATIVE_SNAPSHOT'
  | 'ROLLING_WINDOW'
  | 'INCREMENTAL_APPEND_ONLY'
  | 'OTHER_PROVEN_MODEL';
export type EnrichmentMode = 'NEW_ONLY' | 'REPROCESS_ALL';

export interface CollectorManifest {
  readonly house: string;
  readonly domain: CollectorDomain;
  readonly provider: string;
  readonly providerVersion: string;
  readonly collectionModel: CollectionModel;
  readonly source: { readonly url: string; readonly format: string };
  readonly schemaPolicy: { readonly version: string; readonly unknownDrift: 'FAIL_CLOSED' };
  readonly revisionScope: string;
}

export interface CollectorContext {
  readonly runId: string;
  readonly house: string;
  readonly domain: CollectorDomain;
  readonly provider: string;
  readonly providerVersion: string;
  readonly startedAt: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface CanonicalValidation { readonly ok: boolean; readonly errors?: readonly string[]; readonly warnings?: readonly string[]; }
export interface CollectorProvider<TSource, TParsed, TCanonical> {
  readonly manifest: CollectorManifest;
  fetch(context: CollectorContext): Promise<TSource>;
  validateSource(source: TSource): CanonicalValidation;
  parse(source: TSource): Promise<TParsed>;
  canonicalize(parsed: TParsed): Promise<TCanonical | readonly TCanonical[]>;
  validateCanonical(canonical: TCanonical | readonly TCanonical[]): CanonicalValidation;
  logicalId(value: TCanonical): string;
  semanticValue?(value: TCanonical): unknown;
}
