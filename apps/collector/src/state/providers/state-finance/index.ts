import { createHash } from 'node:crypto';
import type { ExternalIdentityKey, HouseCode, NormalizedExpense, Provenance, ProviderId, RawEnvelope } from '../../contracts.ts';
import { externalId, houseCode, providerId, resourceType } from '../../identifiers.ts';

/** A lossless, provider-neutral row before it is projected to NormalizedExpense. */
export interface StateExpenseRecord {
  readonly house: string;
  readonly externalId: string;
  readonly personExternalId?: string;
  readonly personLabel?: string;
  readonly mechanism: string;
  readonly competence?: string;
  readonly occurredAt?: string;
  readonly category?: string;
  readonly supplierName?: string;
  readonly supplierDocument?: string;
  readonly fiscalDocument?: string;
  readonly description?: string;
  readonly grossAmountCents?: number;
  readonly claimedAmountCents?: number;
  readonly reimbursedAmountCents?: number;
  readonly glosaAmountCents?: number;
  readonly sourceUrl: string;
  readonly granularity: 'itemized' | 'aggregated';
}

export type FinanceSourceStatus = 'operational_itemized' | 'operational_aggregated' | 'partial_operational' | 'parser_blocked_by_unextractable_source' | 'source_proven_contract_unresolved' | 'implementation_pending' | 'source_mechanics_pending' | 'source_fetch_blocked' | 'source_schema_insufficient' | 'source_published_lag';

export interface StateFinanceSourceContract {
  readonly house: string;
  readonly provider: string;
  readonly url: string;
  readonly format: 'csv' | 'json' | 'xlsx' | 'pdf' | 'html';
  readonly status: FinanceSourceStatus;
  readonly mechanism: string;
  readonly itemized: boolean;
  readonly notes: string;
}

/** The exact 14-house scope of P18.1A.  No other house is enabled here. */
export const P18_1A_HOUSES = ['AL', 'AM', 'BA', 'CE', 'DF', 'GO', 'MG', 'MS', 'PI', 'RO', 'RR', 'SC', 'SE', 'SP'] as const;

export const STATE_FINANCE_SOURCES: readonly StateFinanceSourceContract[] = [
  { house: 'AL', provider: 'al_al_viap', url: 'https://www.al.al.leg.br/transparencia/orcamento-e-financas/viap-verba-indenizatoria-de-atividade-parlamentar/2026', format: 'html', status: 'source_fetch_blocked', mechanism: 'VIAP', itemized: true, notes: 'Official index/month/PDF contract is implemented; this run could not complete the bounded fetch in the execution environment.' },
  { house: 'AM', provider: 'aleam_ceap_pdf', url: 'https://www.aleam.gov.br/transparencia/wp-content/themes/transparencia/createCeap.php?ano=2026&mes=Janeiro&parlamentar=27', format: 'pdf', status: 'operational_itemized', mechanism: 'CEAP', itemized: true, notes: '2026 parameterized native PDFs parsed and published with gross/glosa/net evidence.' },
  { house: 'BA', provider: 'alba_verba_indenizatoria', url: 'https://www.al.ba.gov.br/transparencia/verbas-idenizatorias', format: 'html', status: 'partial_operational', mechanism: 'verba_indenizatoria', itemized: true, notes: 'Published 2026 HTML pages parsed and published; one navigator page timed out and remains an explicit source limitation.' },
  { house: 'CE', provider: 'alce_vdp_csv', url: 'https://transparencia.al.ce.gov.br/despesas/verba-desempenho-parlamentar/csv?mes=10&ano=2026', format: 'csv', status: 'operational_itemized', mechanism: 'verba_desempenho_parlamentar', itemized: true, notes: 'CSV contract has deputy, period, empenho, description, CNPJ, creditor and value; bounded months 01-10/2026 returned the official header with no data rows, so no rows were fabricated.' },
  { house: 'DF', provider: 'cldf_ckan_vi', url: 'https://dados.cl.df.gov.br/dataset/662b8e54-727c-4e97-873c-d8c168ecc465/resource/5e3b2a07-e18a-439f-b89c-617c68eb1ef2/download/verba_indenizatoria_2026_corrigido-1.xlsx', format: 'xlsx', status: 'operational_itemized', mechanism: 'verba_indenizatoria', itemized: true, notes: 'Official 2026 CKAN XLSX parsed with pinned sheet/header contract and published.' },
  { house: 'GO', provider: 'alego_transparencia', url: 'https://portal.al.go.leg.br/gestao-parlamentar/verba-indenizatoria', format: 'html', status: 'source_fetch_blocked', mechanism: 'cota_parlamentar', itemized: true, notes: 'Bounded 2026 individual route probes for IDs 117/122/125 and month forms returned HTTP 404 JSON.' },
  { house: 'MG', provider: 'almg_verba_indenizatoria', url: 'https://www.almg.gov.br/transparencia/prestacao-de-contas/deputados/verba-indenizatoria/detalhe.html?id=28859', format: 'html', status: 'operational_itemized', mechanism: 'verba_indenizatoria', itemized: true, notes: 'Official per-deputy detail pages parsed for the 2026 tables and published.' },
  { house: 'MS', provider: 'alms_ceap_csv', url: 'https://transparencia2.al.ms.gov.br/ceap/notas/exportar-csv?ano=2026', format: 'csv', status: 'operational_itemized', mechanism: 'CEAP', itemized: true, notes: 'CSV has 4,834 2026 rows and document/supplier/proof fields; existing lab rows are preserved.' },
  { house: 'PI', provider: 'alpi_transparencia', url: 'https://transparencia.al.pi.leg.br/grid_transp_publico_gecop/', format: 'html', status: 'partial_operational', mechanism: 'verba_indenizatoria', itemized: true, notes: 'ScriptCase grid parsed a controlled 2026 page; attachment fields remain provenance-only and no OCR is used.' },
  { house: 'RO', provider: 'alro_transparencia', url: 'https://transparencia.al.ro.leg.br/ReceitasDespesas/', format: 'html', status: 'source_schema_insufficient', mechanism: 'verba_indenizatoria', itemized: true, notes: 'Bounded official portal/activity probes expose no proven 2026 indemnity relation.' },
  { house: 'RR', provider: 'alrr_verbas', url: 'https://transparencia.al.rr.leg.br/execucao-orcamentaria-e-financeira/verbas-indenizatorias-a-partir-de-set25/', format: 'html', status: 'source_fetch_blocked', mechanism: 'verba_indenizatoria', itemized: true, notes: 'WPDF page exposes the 2026 folder, but file-listing AJAX was not exposed by the bounded probe.' },
  { house: 'SC', provider: 'alesc_gabinetes_csv', url: 'https://transparencia.alesc.sc.gov.br/gabinetes-parlamentares/csv/2026', format: 'csv', status: 'operational_itemized', mechanism: 'gabinetes_parlamentares', itemized: true, notes: 'Official 2026 CSV returned 10,297 item rows with deputy, category, date and amount.' },
  { house: 'SE', provider: 'alese_ressarcimento', url: 'https://al.se.leg.br/portal-da-transparencia/despesas/ressarcimento-dos-deputados/', format: 'html', status: 'operational_itemized', mechanism: 'ressarcimento', itemized: true, notes: 'Official 2026 page currently exposes five converter CSV resources (Jan-May); future 2026 months are not published and are not fabricated.' },
  { house: 'SP', provider: 'alesp_open_data', url: 'https://www3.al.sp.gov.br/repositorio/dados-abertos/output/json/despesas_gabinetes.json', format: 'json', status: 'operational_itemized', mechanism: 'despesas_gabinetes', itemized: true, notes: 'Official JSON dataset is the existing provider contract; person and supplier keys are explicit.' },
] as const;

const normalise = (value: string | undefined): string => (value ?? '').replace(/^\uFEFF/, '').trim();
const sourceCanonical = (value: string | undefined): string => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

/**
 * The published SC finance revision uses the source-key projection proved by
 * P18.2B2C/B2CR: the deterministic source key is hashed once.  Keeping this
 * as a pure function makes the identity reproducible without consulting the
 * active database.
 */
export function scExpenseExternalIdFromSourceKey(sourceKey: string): string { return sha256(sourceKey); }

/** The MS historical/current revision uses the P18.2B1 canonical projection:
 * provider id + sorted JSON of all ten source columns, normalized as text.
 * Provider versions are deliberately excluded from the identity projection. */
export function msExpenseExternalIdFromSourceRow(row: Record<string, string>): string {
  const fields = ['Deputado', 'Ano', 'M?s', 'Categoria', 'CPF/CNPJ', 'Fornecedor', 'Documento', 'Emiss?o', 'Valor (R$)', 'Comprovante'];
  const byFold = new Map(Object.keys(row).map(key => [folded(key), key]));
  const canonical: Record<string, string> = Object.fromEntries(fields.map(field => [field, sourceCanonical(row[byFold.get(folded(field)) ?? field])]));
  const payload = JSON.stringify(Object.fromEntries(Object.keys(canonical).sort().map(key => [key, canonical[key]])));
  return sha256(`alms_ceap_csv|${payload}`);
}

export function parsePtBrCents(value: string | undefined): number | undefined {
  const input = normalise(value).replace(/R\$\s*/i, '').replace(/\s/g, '');
  if (!input) return undefined;
  const cleaned = input.includes(',') ? input.replace(/\./g, '').replace(',', '.') : input.replace(/,/g, '');
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? Math.round(amount * 100) : undefined;
}

export function parseDelimitedRows(body: string, delimiter = ';'): Record<string, string>[] {
  const lines = body.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];
  const parseLine = (line: string): string[] => {
    const result: string[] = []; let field = ''; let quoted = false;
    for (let i = 0; i < line.length; i += 1) { const ch = line[i]; if (ch === '"') { if (quoted && line[i + 1] === '"') { field += '"'; i += 1; } else quoted = !quoted; } else if (ch === delimiter && !quoted) { result.push(field); field = ''; } else field += ch; }
    result.push(field); return result;
  };
  const headers = parseLine(lines[0] ?? '').map(normalise); return lines.slice(1).map(line => { const values = parseLine(line); return Object.fromEntries(headers.map((header, i) => [header, normalise(values[i] ?? '')])); });
}

export function parseMsCeapCsv(body: string, sourceUrl: string, raw: Provenance): NormalizedExpense[] {
  const lines = body.replace(/^\uFEFF/, '').split(/\r?\n/);
  const headerIndex = lines.findIndex(line => /Deputado/i.test(line) && /CPF\/CNPJ/i.test(line) && /Valor/i.test(line));
  const csvBody = headerIndex > 0 ? lines.slice(headerIndex).join('\n') : body;
  return parseDelimitedRows(csvBody).map(row => {
    const person = value(row, 'Deputado'); const supplierDocument = value(row, 'CPF/CNPJ'); const year = value(row, 'Ano'); const month = value(row, 'Mes'); const document = value(row, 'Documento'); const amountText = value(row, 'Valor (R$)');
    const amount = parsePtBrCents(amountText); const id = msExpenseExternalIdFromSourceRow(row);
    return stripUndefined({ key: expenseKey('MS', id), person: person ? identity('MS', 'person', person) : undefined, competence: year ? `${year}-${monthNumber(month)}` : undefined, temporalPrecision: 'month' as const, amountCents: amount, claimedAmountCents: amount, category: value(row, 'Categoria'), supplier: supplierDocument ? identity('MS', 'supplier', supplierDocument) : undefined, supplierName: value(row, 'Fornecedor') || undefined, supplierDocument: supplierDocument || undefined, fiscalDocument: document || undefined, occurredAt: parseBrazilianDate(value(row, 'Emissao')), description: value(row, 'Categoria') || undefined, sourceUrl, granularity: 'itemized' as const, provenance: { ...raw, sourceRow: row } }) as unknown as NormalizedExpense;
  });
}

export function parseScCabinetCsv(body: string, sourceUrl: string, raw: Provenance): NormalizedExpense[] {
  const occurrences = new Map<string, number>();
  return parseDelimitedRows(body).map(row => { const amountText = value(row, 'Valor'); const amount = parsePtBrCents(amountText); const person = value(row, 'Conta'); const dateText = value(row, 'Data de Referencia'); const date = parseBrazilianDate(dateText); const category = value(row, 'Verba'); const description = value(row, 'Descricao'); const supplierName = value(row, 'Favorecido'); const base = `${person}|${date ?? dateText}|${category}|${description}|${supplierName}|${amountText}`; const ordinal = (occurrences.get(base) ?? 0) + 1; occurrences.set(base, ordinal); const sourceKey = `${base}|occurrence=${ordinal}`; const id = scExpenseExternalIdFromSourceKey(sourceKey); return stripUndefined({ key: expenseKey('SC', id), person: person ? identity('SC', 'person', person) : undefined, occurredAt: date, competence: date?.slice(0, 7), temporalPrecision: 'day' as const, amountCents: amount, claimedAmountCents: amount, category, supplierName: supplierName || undefined, description: description || undefined, sourceUrl, granularity: 'itemized' as const, provenance: { ...raw, sourceKey } }) as unknown as NormalizedExpense; });
}

export function parseCeVdpCsv(body: string, sourceUrl: string, raw: Provenance): NormalizedExpense[] {
  // The official export starts with a non-tabular `;;;` preamble. Locate the
  // header by its contract instead of assuming that it is the first line.
  // This also handles UTF-8 BOM and fails closed when the source changes.
  const lines = body.replace(/^\uFEFF/, '').split(/\r?\n/);
  const headerIndex = lines.findIndex(line => {
    const header = folded(line);
    return header.includes('deputado') && header.includes('periodo') && header.includes('empenho') && header.includes('valor');
  });
  if (headerIndex < 0) return [];
  const csvBody = lines.slice(headerIndex).join('\n');
  return parseDelimitedRows(csvBody).map(row => { const person = value(row, 'DEPUTADO'); const period = value(row, 'PERIODO'); const empenho = value(row, 'EMPENHO'); const cnpj = value(row, 'CNPJ'); const creditor = value(row, 'CREDOR'); const amountText = value(row, 'VALOR'); const amount = parsePtBrCents(amountText); const id = `${person}|${period}|${empenho}|${cnpj}|${creditor}|${amountText}`; return stripUndefined({ key: expenseKey('CE', id), person: person ? identity('CE', 'person', person) : undefined, competence: period || undefined, temporalPrecision: 'month' as const, amountCents: amount, claimedAmountCents: amount, supplier: cnpj ? identity('CE', 'supplier', cnpj) : undefined, supplierName: creditor || undefined, supplierDocument: cnpj || undefined, fiscalDocument: empenho || undefined, description: value(row, 'DESCRICAO') || undefined, sourceUrl, granularity: 'itemized' as const, provenance: { ...raw, sourceRow: row } }) as unknown as NormalizedExpense; }).filter(row => row.person);
}

function identity(house: string, resource: string, value: string): ExternalIdentityKey { return { house: houseCode(house), provider: providerId(`state_finance_${house.toLowerCase()}`), resource: resourceType(resource), externalId: externalId(value) }; }
function expenseKey(house: string, value: string): ExternalIdentityKey { return identity(house, 'expense', value); }
function parseBrazilianDate(value: string | undefined): string | undefined { const m = normalise(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? `${m[3]!}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}` : undefined; }
function monthNumber(value: string | undefined): string { const months: Record<string, string> = { janeiro: '01', fevereiro: '02', marco: '03', abril: '04', maio: '05', junho: '06', julho: '07', agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12' }; return months[folded(normalise(value))] ?? '00'; }
function folded(value: string): string { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function value(row: Record<string, string>, name: string): string { const target = folded(name); const key = Object.keys(row).find(candidate => { const current = folded(candidate); return current === target || current.replace(/e/g, '') === target.replace(/e/g, ''); }); return key ? normalise(row[key]) : ''; }
function stripUndefined<T extends Record<string, unknown>>(valueObject: T): T { return Object.fromEntries(Object.entries(valueObject).filter(([, value]) => value !== undefined)) as T; }


export function provenanceForRaw(rawId: string, endpoint: string, body: string, fetchedAt = new Date().toISOString()): Provenance { return { rawId, endpoint, fetchedAt, sha256: createHash('sha256').update(body).digest('hex') }; }

