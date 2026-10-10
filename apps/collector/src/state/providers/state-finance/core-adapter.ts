import type { CollectorContext, CollectorManifest, CollectorProvider, CanonicalValidation } from '../../../core/collector-provider.ts';
import type { NormalizedExpense, Provenance } from '../../contracts.ts';
import { createHash } from 'node:crypto';

/**
 * Source envelope used by the permanent state-finance providers.  The Core
 * owns lifecycle/reconciliation; providers only know how to validate and
 * transform the source contract.
 */
export interface StateFinanceSource {
  readonly body: string;
  readonly sourceUrl: string;
  readonly contentType: string;
  readonly rawId?: string;
  readonly fetchedAt?: string;
  /** Request parameters known before parsing (profile, competence, resource). */
  readonly requestContext?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface StateFinanceProviderConfig {
  readonly manifest: CollectorManifest;
  readonly requiredColumns?: readonly string[];
  readonly parser: (source: StateFinanceSource, provenance: Provenance) => readonly NormalizedExpense[];
}

export function sourceProvenance(source: StateFinanceSource, house: string, provider: string): Provenance {
  const sha256 = createHash('sha256').update(source.body).digest('hex');
  return {
    rawId: source.rawId ?? `raw:state-finance:${house.toLowerCase()}:${sha256}`,
    endpoint: source.sourceUrl,
    fetchedAt: source.fetchedAt ?? new Date().toISOString(),
    sha256,
    ...(source.requestContext ? { requestContext: source.requestContext } : {}),
  };
}

function validateSource(source: StateFinanceSource, requiredColumns: readonly string[]): CanonicalValidation {
  if (!source.body.trim()) return { ok: false, errors: ['empty source body'] };
  if (!source.sourceUrl.startsWith('http')) return { ok: false, errors: ['source URL must be official HTTP endpoint'] };
  const header = source.body.split(/\r?\n/).slice(0, 8).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const missing = requiredColumns.filter(column => !header.includes(column.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()));
  return missing.length ? { ok: false, errors: [`source schema missing: ${missing.join(', ')}`] } : { ok: true };
}

function canonicalValue(value: NormalizedExpense): unknown {
  return {
    externalId: value.key.externalId,
    person: value.person?.externalId ?? null,
    competence: value.competence ?? null,
    occurredAt: value.occurredAt ?? null,
    amountCents: value.amountCents ?? null,
    category: value.category ?? null,
    supplier: value.supplier?.externalId ?? null,
    supplierName: value.supplierName ?? null,
    supplierDocument: value.supplierDocument ?? null,
    fiscalDocument: value.fiscalDocument ?? null,
    description: value.description ?? null,
  };
}

export function createStateFinanceCoreProvider(config: StateFinanceProviderConfig, input: StateFinanceSource): CollectorProvider<StateFinanceSource, readonly NormalizedExpense[], NormalizedExpense> {
  return {
    manifest: config.manifest,
    async fetch(): Promise<StateFinanceSource> { return input; },
    validateSource(source): CanonicalValidation { return validateSource(source, config.requiredColumns ?? []); },
    async parse(source): Promise<readonly NormalizedExpense[]> { return config.parser(source, sourceProvenance(source, config.manifest.house, config.manifest.provider)); },
    async canonicalize(parsed): Promise<readonly NormalizedExpense[]> { return parsed; },
    validateCanonical(values): CanonicalValidation {
      const rows = Array.isArray(values) ? values : [values];
      const ids = rows.map(row => String(row.key.externalId));
      const duplicateCount = ids.length - new Set(ids).size;
      const invalid = rows.filter(row => !row.key.externalId || !row.provenance.rawId || (row.amountCents != null && !Number.isFinite(row.amountCents))).length;
      return duplicateCount || invalid ? { ok: false, errors: [`canonical validation failed: duplicates=${duplicateCount}, invalid=${invalid}`] } : { ok: true };
    },
    logicalId(value): string { return String(value.key.externalId); },
    semanticValue(value): unknown { return canonicalValue(value); },
  };
}

export interface CanonicalFixtureRow {
  readonly external_id: string;
  readonly person_external_id?: string | null;
  readonly occurred_at?: string | null;
  readonly competence?: string | null;
  readonly amount_cents?: number | null;
  readonly category?: string | null;
  readonly supplier_name?: string | null;
  readonly supplier_document?: string | null;
  readonly fiscal_document_number?: string | null;
  readonly description?: string | null;
  readonly source_url?: string | null;
}

export function parseCanonicalFixture(house: string, provider: string, source: StateFinanceSource, provenance: Provenance): readonly NormalizedExpense[] {
  const parsed = JSON.parse(source.body) as { sourceRows?: CanonicalFixtureRow[]; rows?: CanonicalFixtureRow[] };
  const rows = parsed.sourceRows ?? parsed.rows ?? [];
  return rows.map(row => {
    const externalId = String(row.external_id);
    const person = row.person_external_id ? { house: house as never, provider: provider as never, resource: 'person' as never, externalId: row.person_external_id as never } : undefined;
    return {
      key: { house: house as never, provider: provider as never, resource: 'expense' as never, externalId: externalId as never },
      person,
      occurredAt: row.occurred_at ?? undefined,
      competence: row.competence ?? undefined,
      periodStart: row.occurred_at ?? undefined,
      periodEnd: row.occurred_at ?? undefined,
      temporalPrecision: row.occurred_at ? 'day' : row.competence ? 'month' : 'unknown',
      amountCents: row.amount_cents == null ? undefined : Number(row.amount_cents),
      claimedAmountCents: row.amount_cents == null ? undefined : Number(row.amount_cents),
      category: row.category ?? undefined,
      supplierName: row.supplier_name ?? undefined,
      supplierDocument: row.supplier_document ?? undefined,
      fiscalDocument: row.fiscal_document_number ?? undefined,
      description: row.description ?? undefined,
      sourceUrl: row.source_url ?? source.sourceUrl,
      granularity: 'itemized',
      provenance,
    } as NormalizedExpense;
  });
}

