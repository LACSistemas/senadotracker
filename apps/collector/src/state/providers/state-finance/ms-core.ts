import type { CollectorContext, CollectorProvider, CollectorManifest, CanonicalValidation } from '../../../core/collector-provider.ts';
import type { NormalizedExpense, Provenance } from '../../contracts.ts';
import { parseMsCeapCsv, provenanceForRaw } from './index.ts';

/** Structural Core bridge for the audited MS CEAP CSV parser. */
export const MS_CEAP_MANIFEST: CollectorManifest = {
  house: 'MS', domain: 'finance', provider: 'alms_ceap_csv', providerVersion: 'alms_ceap_csv:v1',
  collectionModel: 'SNAPSHOT', source: { url: 'https://transparencia2.al.ms.gov.br/ceap/notas/exportar-csv?ano=2026', format: 'text/csv' },
  schemaPolicy: { version: 'ms-ceap-csv-v1', unknownDrift: 'FAIL_CLOSED' }, revisionScope: 'MS:finance',
};

export interface MsCeapCoreInput { readonly body: string; readonly sourceUrl?: string; readonly rawId?: string; readonly fetchedAt?: string; }
function provenance(input: MsCeapCoreInput): Provenance { const endpoint = input.sourceUrl ?? MS_CEAP_MANIFEST.source.url; return provenanceForRaw(input.rawId ?? `raw:ms-ceap:${input.body.length}`, endpoint, input.body, input.fetchedAt); }
function normalizedBody(body: string): string { const lines = body.replace(/^\uFEFF/, '').split(/\r?\n/); const headerIndex = lines.findIndex(line => /Deputado/i.test(line) && /CPF\/CNPJ/i.test(line) && /Valor/i.test(line)); return headerIndex > 0 ? lines.slice(headerIndex).join('\n') : body; }
function validateCsvSource(input: MsCeapCoreInput): CanonicalValidation { const header = normalizedBody(input.body).replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? ''; const normalized = header.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); const missing = ['deputado','cpf/cnpj','ano','mes','documento','valor'].filter(value => !normalized.includes(value)); return missing.length === 0 ? { ok: true } : { ok: false, errors: [`MS CEAP CSV missing columns: ${missing.join(', ')}`] }; }

export function createMsCeapCoreProvider(input: MsCeapCoreInput): CollectorProvider<MsCeapCoreInput, readonly NormalizedExpense[], NormalizedExpense> {
  return {
    manifest: MS_CEAP_MANIFEST,
    async fetch(_context: CollectorContext): Promise<MsCeapCoreInput> { return input; },
    validateSource: validateCsvSource,
    async parse(source: MsCeapCoreInput): Promise<readonly NormalizedExpense[]> { return parseMsCeapCsv(normalizedBody(source.body), source.sourceUrl ?? MS_CEAP_MANIFEST.source.url, provenance(source)); },
    async canonicalize(parsed: readonly NormalizedExpense[]): Promise<readonly NormalizedExpense[]> { return parsed; },
    validateCanonical(values: readonly NormalizedExpense[]): CanonicalValidation { const ids = values.map(value => String(value.key.externalId)); const duplicateIds = ids.length - new Set(ids).size; const invalid = values.filter(value => !value.key.externalId || !value.provenance.rawId || (value.amountCents != null && !Number.isFinite(value.amountCents))).length; return duplicateIds === 0 && invalid === 0 ? { ok: true } : { ok: false, errors: [`MS CEAP canonical validation failed: duplicates=${duplicateIds}, invalid=${invalid}`] }; },
    logicalId(value: any): string { return String(value.key.externalId); },
    semanticValue(value: any): unknown { return { id: value.key.externalId, person: value.person?.externalId ?? null, competence: value.competence ?? null, amountCents: value.amountCents ?? null, category: value.category ?? null, supplier: value.supplier?.externalId ?? null, supplierName: value.supplierName ?? null, supplierDocument: value.supplierDocument ?? null, fiscalDocument: value.fiscalDocument ?? null }; },
  };
}

