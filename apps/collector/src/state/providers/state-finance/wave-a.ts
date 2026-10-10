import type { CollectorManifest } from '../../../core/collector-provider.ts';
import type { NormalizedExpense } from '../../contracts.ts';
import { parseCeVdpCsv, parseDelimitedRows, parseMsCeapCsv, parsePtBrCents } from './index.ts';
import { createStateFinanceCoreProvider, parseCanonicalFixture, type StateFinanceProviderConfig, type StateFinanceSource } from './core-adapter.ts';

const manifest = (house: string, provider: string, version: string, url: string, format: string, schema: string): CollectorManifest => ({
  house, domain: 'finance', provider, providerVersion: version, collectionModel: 'SNAPSHOT',
  source: { url, format }, schemaPolicy: { version: schema, unknownDrift: 'FAIL_CLOSED' }, revisionScope: `${house}:finance`,
});

export const AM_MANIFEST = manifest('AM', 'aleam_ceap_pdf', 'aleam_ceap_pdf:v1', 'https://www.aleam.gov.br/transparencia/wp-content/themes/transparencia/createCeap.php', 'application/pdf', 'aleam-ceap-pdf-v1');
export const AP_MANIFEST = manifest('AP', 'alap_ceap', 'alap_ceap:v1', 'https://al.ap.leg.br/transparencia/pagina.php?pg=ceap', 'text/html', 'alap-ceap-v1');
export const CE_MANIFEST = manifest('CE', 'alce_vdp_csv', 'alce_vdp_csv:v1', 'https://transparencia.al.ce.gov.br/despesas/verba-desempenho-parlamentar/csv?mes={month}&ano=2026', 'text/csv', 'alce-vdp-csv-v1');
export const DF_MANIFEST = manifest('DF', 'cldf_ckan_vi', 'cldf_ckan_vi:v1', 'https://dados.cl.df.gov.br/dataset/662b8e54-727c-4e97-873c-d8c168ecc465/resource/5e3b2a07-e18a-439f-b89c-617c68eb1ef2/download/verba_indenizatoria_2026_corrigido-1.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'cldf-ckan-vi-v1');
export const MG_MANIFEST = manifest('MG', 'almg_verba_indenizatoria', 'almg_verba_indenizatoria:v1', 'https://www.almg.gov.br/transparencia/prestacao-de-contas/deputados/verba-indenizatoria/', 'text/html', 'almg-verba-v1');
export const MS_MANIFEST = manifest('MS', 'alms_ceap_csv', 'alms_ceap_csv:v1', 'https://transparencia2.al.ms.gov.br/ceap/notas/exportar-csv?ano=2026', 'text/csv', 'ms-ceap-csv-v1');
export const PE_MANIFEST = manifest('PE', 'alepe_ceap', 'alepe_ceap:v1', 'https://www.alepe.pe.gov.br/servicos/transparencia/dep/deputados.php?leg=-16', 'application/json', 'alepe-ceap-v1');
export const RN_MANIFEST = manifest('RN', 'alrn_ceap', 'alrn_ceap:v1', 'https://api-transparencia.al.rn.leg.br/verbas/despesas/', 'application/json', 'alrn-ceap-v1');
export const SE_MANIFEST = manifest('SE', 'alese_ressarcimento', 'alese_ressarcimento:v1', 'https://al.se.leg.br/portal-da-transparencia/despesas/ressarcimento-dos-deputados/', 'text/csv', 'alese-ressarcimento-v1');
export const SP_MANIFEST = manifest('SP', 'alesp_open_data', 'alesp_open_data:v1', 'https://www3.al.sp.gov.br/repositorio/dados-abertos/output/json/despesas_gabinetes.json', 'application/json', 'alesp-open-data-v1');
export const TO_MANIFEST = manifest('TO', 'aleto_codap', 'aleto_codap:v1', 'https://www.al.to.leg.br/transparencia/verbaIndenizatoria', 'text/html', 'aleto-codap-v1');

function fixtureProvider(config: StateFinanceProviderConfig, input: StateFinanceSource) {
  return createStateFinanceCoreProvider(config, input);
}

const fixtureParser = (house: string, provider: string) => (source: StateFinanceSource, provenance: Parameters<NonNullable<StateFinanceProviderConfig['parser']>>[1]): readonly NormalizedExpense[] => parseCanonicalFixture(house, provider, source, provenance);

export function createAmCoreProvider(input: StateFinanceSource) { return fixtureProvider({ manifest: AM_MANIFEST, parser: fixtureParser('AM', 'aleam_ceap_pdf') }, input); }
export function createApCoreProvider(input: StateFinanceSource) { return fixtureProvider({ manifest: AP_MANIFEST, parser: fixtureParser('AP', 'alap_ceap') }, input); }
export function createDfCoreProvider(input: StateFinanceSource) { return fixtureProvider({ manifest: DF_MANIFEST, parser: fixtureParser('DF', 'cldf_ckan_vi') }, input); }
export function createMgCoreProvider(input: StateFinanceSource) { return fixtureProvider({ manifest: MG_MANIFEST, parser: fixtureParser('MG', 'almg_verba_indenizatoria') }, input); }
export function createPeCoreProvider(input: StateFinanceSource) { return fixtureProvider({ manifest: PE_MANIFEST, parser: fixtureParser('PE', 'alepe_ceap') }, input); }
export function createRnCoreProvider(input: StateFinanceSource) { return fixtureProvider({ manifest: RN_MANIFEST, parser: fixtureParser('RN', 'alrn_ceap') }, input); }
export function createSeCoreProvider(input: StateFinanceSource) { return fixtureProvider({ manifest: SE_MANIFEST, parser: fixtureParser('SE', 'alese_ressarcimento') }, input); }
export function createToCoreProvider(input: StateFinanceSource) { return fixtureProvider({ manifest: TO_MANIFEST, parser: fixtureParser('TO', 'aleto_codap') }, input); }

export function createCeCoreProvider(input: StateFinanceSource) {
  return fixtureProvider({ manifest: CE_MANIFEST, requiredColumns: ['DEPUTADO', 'PERIODO', 'EMPENHO', 'VALOR'], parser: (source, provenance) => {
    const firstLine = source.body.split(/\r?\n/, 1)[0] ?? '';
    const lines = /DEPUTADO\s*;\s*PERIODO/i.test(firstLine) ? source.body : source.body.replace(/^\uFEFF?[^\r\n]*\r?\n/, '');
    return parseCeVdpCsv(lines, source.sourceUrl, provenance);
  } }, input);
}

function parseSpJson(source: StateFinanceSource, provenance: Parameters<NonNullable<StateFinanceProviderConfig['parser']>>[1]): readonly NormalizedExpense[] {
  const document = JSON.parse(source.body) as unknown;
  const rows = Array.isArray(document) ? document : ((document as { rows?: unknown[] })?.rows ?? []);
  return rows.map((raw, ordinal) => {
    const row = raw as Record<string, unknown>;
    const person = String(row.deputado ?? row.nome ?? row.parlamentar ?? '');
    const competence = row.ano != null && row.mes != null ? `${row.ano}-${String(row.mes).padStart(2, '0')}` : undefined;
    const amount = typeof row.valor === 'number' ? Math.round(row.valor * 100) : parsePtBrCents(String(row.valor ?? ''));
    const id = String(row.id ?? `${row.matricula ?? person}:${row.ano ?? ''}:${row.mes ?? ''}:${row.cnpj ?? row.cpf ?? ''}:${row.valor ?? ''}`);
    const personId = String(row.idDeputado ?? row.matricula ?? person);
    return { key: { house: 'SP' as never, provider: 'alesp_open_data' as never, resource: 'expense' as never, externalId: id as never }, person: personId ? { house: 'SP' as never, provider: 'alesp_open_data' as never, resource: 'person' as never, externalId: personId as never } : undefined, competence, temporalPrecision: competence ? 'month' : 'unknown', amountCents: amount, claimedAmountCents: amount, category: String(row.tipo ?? '') || undefined, supplierName: String(row.fornecedor ?? '') || undefined, supplierDocument: String(row.cnpj ?? row.cpf ?? '') || undefined, description: String(row.observacao ?? '') || undefined, sourceUrl: source.sourceUrl, granularity: 'itemized', provenance } as NormalizedExpense;
  });
}

export function createSpCoreProvider(input: StateFinanceSource) {
  return fixtureProvider({ manifest: SP_MANIFEST, parser: parseSpJson }, input);
}

export const WAVE_A_PROVIDER_IDS = {
  AM: 'aleam_ceap_pdf', AP: 'alap_ceap', CE: 'alce_vdp_csv', DF: 'cldf_ckan_vi', MG: 'almg_verba_indenizatoria', MS: 'alms_ceap_csv', PE: 'alepe_ceap', RN: 'alrn_ceap', SE: 'alese_ressarcimento', SP: 'alesp_open_data', TO: 'aleto_codap',
} as const;

