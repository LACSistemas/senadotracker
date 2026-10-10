import { createHash } from 'node:crypto';
import type { CollectorManifest } from '../../../core/collector-provider.ts';
import type { NormalizedExpense, Provenance } from '../../contracts.ts';
import { createStateFinanceCoreProvider, type StateFinanceSource } from './core-adapter.ts';

/**
 * Permanent Wave B finance providers.  The provider owns only source access,
 * parsing and deterministic projection; publication/reconciliation remains in
 * the Core runner.  Keeping the source contract in code prevents the H
 * harness from becoming the only implementation of a provider.
 */
export const WAVE_B_HOUSES = ['BA', 'ES', 'GO', 'MA', 'PA', 'PI', 'RO', 'RR', 'RS', 'TO', 'AM', 'SE'] as const;
export type WaveBHouse = typeof WAVE_B_HOUSES[number];

export type WaveBStatus =
  | 'PROVEN'
  | 'PARTIAL'
  | 'EXTERNAL_BLOCK'
  | 'SOURCE_SCOPE_MISMATCH'
  | 'SOURCE_CONTRACT_CHANGED';

export interface WaveBManifest {
  readonly house: WaveBHouse;
  readonly provider: string;
  readonly providerVersion: string;
  readonly transport: string;
  readonly granularity: 'ITEM' | 'CATEGORY_MONTH' | 'PARLIAMENTARIAN_PAYMENT';
  readonly sourceContract: string;
  readonly manifest: CollectorManifest;
}

export interface WaveBFetchObservation {
  readonly url: string;
  readonly status: number | null;
  readonly contentType: string;
  readonly bytes: number;
  readonly sha256: string | null;
  readonly durationMs: number;
  readonly error?: string;
}

export interface WaveBAttempt {
  readonly house: WaveBHouse;
  readonly manifest: WaveBManifest;
  readonly observations: readonly WaveBFetchObservation[];
  readonly sourceRows: number;
  readonly canonicalRows: number;
  readonly rows: readonly NormalizedExpense[];
  readonly sourceCompleteness: WaveBStatus;
  readonly completenessReason: string;
  readonly parserVersion: string;
  readonly naturalKeyStrategy: string;
  readonly keyCollisions: number;
}

const contracts: Record<WaveBHouse, Omit<WaveBManifest, 'manifest'>> = {
  BA: { house: 'BA', provider: 'alba_nopapercloud', providerVersion: 'alba_nopapercloud:finance:v1', transport: 'HTML', granularity: 'ITEM', sourceContract: 'https://www.al.ba.gov.br/transparencia/verbas-idenizatorias' },
  ES: { house: 'ES', provider: 'alese_cotas', providerVersion: 'alese_cotas:finance:v1', transport: 'BROWSER_FLOW', granularity: 'CATEGORY_MONTH', sourceContract: 'https://www.al.es.gov.br/Transparencia/CotasParlamentares' },
  GO: { house: 'GO', provider: 'alego_transparencia', providerVersion: 'alego_transparencia:finance:v1', transport: 'HTTP_JSON', granularity: 'PARLIAMENTARIAN_PAYMENT', sourceContract: 'https://transparencia.al.go.leg.br/api/transparencia/dueofs?ano=2026&mes={month}' },
  MA: { house: 'MA', provider: 'alema_ceap', providerVersion: 'alema_ceap:finance:v1', transport: 'JSF', granularity: 'CATEGORY_MONTH', sourceContract: 'https://sistemas.al.ma.leg.br/transparencia/lista-parlamentar.html' },
  PA: { house: 'PA', provider: 'alepa_devexpress', providerVersion: 'alepa_devexpress:finance:v1', transport: 'OTHER', granularity: 'CATEGORY_MONTH', sourceContract: 'https://alepa.quartertec.com.br/api/dashboard/data?dashboardId=dashboard57&itemId=gridDashboardItem2' },
  PI: { house: 'PI', provider: 'alpi_transparencia', providerVersion: 'alpi_transparencia:finance:v1', transport: 'OTHER', granularity: 'ITEM', sourceContract: 'https://transparencia.al.pi.leg.br/grid_transp_publico_gecop/' },
  RO: { house: 'RO', provider: 'alro_transparencia', providerVersion: 'alro_transparencia:finance:v1', transport: 'OTHER', granularity: 'ITEM', sourceContract: 'https://transparencia.al.ro.leg.br/Deputados/VerbaIndenizatoria/' },
  RR: { house: 'RR', provider: 'alrr_verbas', providerVersion: 'alrr_verbas:finance:v1', transport: 'HTTP_PDF', granularity: 'PARLIAMENTARIAN_PAYMENT', sourceContract: 'https://transparencia.al.rr.leg.br/execucao-orcamentaria-e-financeira/verbas-indenizatorias-a-partir-de-set25/' },
  RS: { house: 'RS', provider: 'alrs_custom', providerVersion: 'alrs_custom:finance:v1', transport: 'OTHER', granularity: 'CATEGORY_MONTH', sourceContract: 'https://transparencia.al.rs.gov.br/parlamentares/gastos/pesquisa?ano=2026&mes=1&solicitante=13' },
  TO: { house: 'TO', provider: 'aleto_codap', providerVersion: 'aleto_codap:finance:v1', transport: 'HTTP_PDF', granularity: 'ITEM', sourceContract: 'https://www.al.to.leg.br/transparencia/verbaIndenizatoria' },
  AM: { house: 'AM', provider: 'aleam_ceap_pdf', providerVersion: 'aleam_ceap_pdf:finance:v1', transport: 'HTTP_PDF', granularity: 'ITEM', sourceContract: 'https://www.aleam.gov.br/transparencia/controle-de-cota-parlamentar/' },
  SE: { house: 'SE', provider: 'alese_ressarcimento', providerVersion: 'alese_ressarcimento:finance:v1', transport: 'HTTP_PDF', granularity: 'ITEM', sourceContract: 'https://al.se.leg.br/portal-da-transparencia/despesas/ressarcimento-dos-deputados/' },
};

function manifest(contract: Omit<WaveBManifest, 'manifest'>): WaveBManifest {
  return {
    ...contract,
    manifest: {
      house: contract.house,
      domain: 'finance',
      provider: contract.provider,
      providerVersion: contract.providerVersion,
      collectionModel: 'SNAPSHOT',
      source: { url: contract.sourceContract, format: contract.transport },
      schemaPolicy: { version: `${contract.provider}-v1`, unknownDrift: 'FAIL_CLOSED' },
      revisionScope: `${contract.house}:finance`,
    },
  };
}

export const WAVE_B_PROVIDER_MANIFESTS: Readonly<Record<WaveBHouse, WaveBManifest>> = Object.fromEntries(
  WAVE_B_HOUSES.map(house => [house, manifest(contracts[house])]),
) as Record<WaveBHouse, WaveBManifest>;

export function createWaveBProvider(house: WaveBHouse, source: StateFinanceSource) {
  const contract = WAVE_B_PROVIDER_MANIFESTS[house];
  return createStateFinanceCoreProvider({
    manifest: contract.manifest,
    requiredColumns: house === 'GO' ? ['id', 'valor'] : [],
    parser: input => parseWaveBSource(house, input, sourceProvenance(input, house, contract.provider)),
  }, source);
}

export async function collectWaveBCurrent(house: WaveBHouse, options: { readonly fetchImpl?: typeof fetch; readonly timeoutMs?: number } = {}): Promise<WaveBAttempt> {
  const contract = WAVE_B_PROVIDER_MANIFESTS[house];
  const observations: WaveBFetchObservation[] = [];
  const bodies: { readonly body: string; readonly url: string }[] = [];
  let urls = sourceUrls(house);
  for (let index = 0; index < urls.length; index += 1) {
    const url = urls[index]!;
    const started = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);
      const response = await (options.fetchImpl ?? fetch)(url, { redirect: 'follow', headers: { accept: 'text/html,application/json,text/csv,application/pdf;q=0.9', 'user-agent': 'Civica-P18.3H/1.0' }, signal: controller.signal });
      clearTimeout(timer);
      const body = await response.text();
      const digest = createHash('sha256').update(body).digest('hex');
      observations.push({ url, status: response.status, contentType: response.headers.get('content-type') ?? '', bytes: Buffer.byteLength(body), sha256: digest, durationMs: Date.now() - started });
      if (response.ok) bodies.push({ body, url });
      // BA publishes a finite detail-link universe from the official index.
      // Expand that universe only from links present in the fetched source;
      // never synthesize page numbers or IDs.
      if (house === 'BA' && response.ok && url === contracts.BA.sourceContract) {
        const detailUrls = [...body.matchAll(/href=["']([^"']*verbas-idenizatorias\/\d+[^"']*)["']/gi)].map(match => new URL(match[1]!, url).href);
        urls = [...new Set([...urls, ...detailUrls])];
      }
      // ES exposes the cabinet universe in the official select element. Use
      // only those published IDs and the documented XHR contract; no IDs are
      // guessed. A complete run therefore has cabinet/month units.
      if (house === 'ES' && response.ok && url === contracts.ES.sourceContract) {
        const select = body.match(/<select[^>]+id=["']ddlistDeputado["'][\s\S]*?<\/select>/i)?.[0] ?? '';
        const cabinetIds = [...new Set([...select.matchAll(/<option[^>]+value=["'](\d+)["']/gi)].map(match => match[1]!).filter(value => value !== '0'))];
        const api = (month: number, cabinet: string) => `https://www.al.es.gov.br/Transparencia/Api/CotasParlamentaresNovoTable/${month}/${month}/2026/${cabinet}/false`;
        urls = [...new Set([...urls, ...cabinetIds.flatMap(cabinet => Array.from({ length: 12 }, (_, index) => api(index + 1, cabinet)))])];
      }
    } catch (error) {
      observations.push({ url, status: null, contentType: '', bytes: 0, sha256: null, durationMs: Date.now() - started, error: error instanceof Error ? error.message : String(error) });
    }
  }
  const rows = bodies.flatMap(item => {
    const source = { body: item.body, sourceUrl: item.url, contentType: 'text/html' } satisfies StateFinanceSource;
    return parseWaveBSource(house, source, sourceProvenance(source, house, contract.provider));
  });
  const ids = rows.map(row => String(row.key.externalId));
  const keyCollisions = ids.length - new Set(ids).size;
  const successful = observations.filter(observation => observation.status !== null && observation.status >= 200 && observation.status < 300);
  const sourceCompleteness: WaveBStatus = completenessFor(house, observations, rows);
  return {
    house,
    manifest: contract,
    observations,
    sourceRows: rows.length,
    canonicalRows: rows.length,
    rows,
    sourceCompleteness,
    completenessReason: completenessReason(house, successful.length, urls.length, rows.length),
    parserVersion: 'state-finance-wave-b-v1',
    naturalKeyStrategy: keyStrategy(house),
    keyCollisions,
  };
}

function sourceUrls(house: WaveBHouse): string[] {
  if (house === 'GO') return Array.from({ length: 12 }, (_, index) => `https://transparencia.al.go.leg.br/api/transparencia/dueofs?ano=2026&mes=${index + 1}`);
  return [contracts[house].sourceContract];
}

function completenessFor(house: WaveBHouse, observations: readonly WaveBFetchObservation[], rows: readonly NormalizedExpense[]): WaveBStatus {
  const ok = observations.filter(observation => observation.status !== null && observation.status >= 200 && observation.status < 300).length;
  if (house === 'GO' && ok === 12 && rows.length > 0) return 'PROVEN';
  if (house === 'BA' && ok === observations.length && observations.length > 1 && rows.length > 0) return 'PROVEN';
  if (house === 'ES' && ok === observations.length && observations.length > 1 && rows.length > 0) return 'PROVEN';
  if (ok === 0) return 'EXTERNAL_BLOCK';
  return 'PARTIAL';
}

function completenessReason(house: WaveBHouse, successful: number, expected: number, rows: number): string {
  if (house === 'GO' && successful === expected && rows > 0) return '12 official monthly JSON resources fetched; pagination is source-bounded and every month returned successfully.';
  if (house === 'BA' && successful === expected && expected > 1 && rows > 0) return 'Official BA index links were enumerated from the source and every published detail resource was fetched successfully.';
  if (house === 'ES' && successful === expected && expected > 1 && rows > 0) return 'Official deputy select was enumerated and every documented cabinet/month XHR returned successfully.';
  if (successful === 0) return 'Official source did not return a readable resource during the live attempt.';
  if (house === 'ES') return 'The official browser contract requires cabinet enumeration and per-cabinet requests; the landing page alone is not a completeness proof.';
  if (house === 'MA') return 'The official JSF contract requires parliamentarian/competence export requests; landing HTML is not a completeness proof.';
  if (house === 'RR') return 'The official WPDF page was reachable but the complete 2026 PDF listing was not proven by the current response.';
  return `Only ${successful}/${expected} source resources were fetched successfully; ${rows} canonical rows were observed without a complete source-universe proof.`;
}

function keyStrategy(house: WaveBHouse): string {
  if (house === 'GO') return 'source-native chave|data_dueof|valor_dueof|natureza_numero';
  if (house === 'ES' || house === 'MA' || house === 'PA') return 'parliamentarian|competence|category|amount|source-row-ordinal (source multiplicity must be proven before publication)';
  return 'sha256(source-url|source-row-canonical-fields)';
}

function parseWaveBSource(house: WaveBHouse, source: StateFinanceSource, provenance: Provenance): readonly NormalizedExpense[] {
  if (house === 'GO') return parseGoJson(source, provenance);
  if (house === 'ES') return parseEsAggregated(source, provenance);
  if (house === 'BA') return parseHtmlRows('BA', 'alba_nopapercloud', source, provenance);
  return [];
}

function parseEsAggregated(source: StateFinanceSource, provenance: Provenance): readonly NormalizedExpense[] {
  const text = source.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const name = text.match(/Nome Civil:\s*([^:]+?)\s+Partido:/i)?.[1]?.trim();
  const path = source.sourceUrl.match(/CotasParlamentaresNovoTable\/(\d+)\/(\d+)\/2026\/(\d+)\//i);
  const competence = path ? `2026-${String(Number(path[1])).padStart(2, '0')}` : undefined;
  const providerPersonId = path?.[3];
  const rows: NormalizedExpense[] = [];
  for (const match of text.matchAll(/Produto:\s*([\s\S]*?)\s+Quantidade:\s*[\d.,-]+\s+Valor Solicitado:\s*R\$\s*([\d.]+,\d{2})/gi)) {
    const amount = Number(match[2]!.replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const sourceKey = `${source.sourceUrl}|${match.index}|${match[1]!.trim()}|${match[2]}`;
    rows.push({ key: { house: 'ES' as never, provider: 'alese_cotas' as never, resource: 'expense' as never, externalId: createHash('sha256').update(sourceKey).digest('hex') as never }, ...(providerPersonId ? { person: { house: 'ES' as never, provider: 'alese_cotas' as never, resource: 'person' as never, externalId: providerPersonId as never } } : name ? { person: { house: 'ES' as never, provider: 'alese_cotas' as never, resource: 'person' as never, externalId: name as never } } : {}), ...(competence ? { competence } : {}), temporalPrecision: 'month', amountCents: Math.round(amount * 100), claimedAmountCents: Math.round(amount * 100), category: match[1]!.trim(), sourceUrl: source.sourceUrl, granularity: 'aggregated', provenance: { ...provenance, providerPersonId, providerPersonLabel: name, sourceKey } } as unknown as NormalizedExpense);
  }
  return rows;
}

function parseGoJson(source: StateFinanceSource, provenance: Provenance): readonly NormalizedExpense[] {
  let payload: unknown;
  try { payload = JSON.parse(source.body); } catch { return []; }
  if (!Array.isArray(payload)) return [];
  return payload.filter(value => typeof value === 'object' && value !== null && ('id' in value || 'chave' in value)).filter(value => /cota|indenizat|verba/i.test(String((value as any).natureza_descricao ?? '') + ' ' + String((value as any).linha ?? ''))).map(value => {
    const row = value as Record<string, unknown>;
    const key = String(row.chave ?? row.id);
    const amount = Number(row.valor_dueof);
    return {
      key: { house: 'GO' as never, provider: 'alego_transparencia' as never, resource: 'expense' as never, externalId: key as never },
      competence: `2026-${String(Number(row.mes ?? 1)).padStart(2, '0')}`,
      occurredAt: typeof row.data_dueof === 'string' ? row.data_dueof : undefined,
      temporalPrecision: 'day',
      amountCents: Number.isFinite(amount) ? Math.round(amount * 100) : undefined,
      claimedAmountCents: Number.isFinite(amount) ? Math.round(amount * 100) : undefined,
      category: String(row.natureza_descricao ?? '').trim() || undefined,
      supplierName: String(row.nome_credor ?? '').trim() || undefined,
      supplierDocument: String(row.cpf_cnpj ?? '').trim() || undefined,
      description: String(row.linha ?? '').trim() || undefined,
      sourceUrl: source.sourceUrl,
      granularity: 'aggregated',
      provenance,
    } as unknown as NormalizedExpense;
  });
}

function parseHtmlRows(house: WaveBHouse, provider: string, source: StateFinanceSource, provenance: Provenance): readonly NormalizedExpense[] {
  const rows: NormalizedExpense[] = [];
  const text = source.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  for (const match of text.matchAll(/(\d{1,3}(?:\.\d{3})*,\d{2})/g)) {
    const amount = Number(match[1]!.replace(/\./g, '').replace(',', '.'));
    const sourceKey = `${source.sourceUrl}|${provenance.sha256}|${match.index}|${match[1]}`;
    rows.push({ key: { house: house as never, provider: provider as never, resource: 'expense' as never, externalId: createHash('sha256').update(sourceKey).digest('hex') as never }, amountCents: Math.round(amount * 100), claimedAmountCents: Math.round(amount * 100), sourceUrl: source.sourceUrl, granularity: 'itemized', temporalPrecision: 'unknown', provenance } as unknown as NormalizedExpense);
  }
  return rows;
}

function sourceProvenance(source: StateFinanceSource, house: string, provider: string): Provenance {
  const sha256 = createHash('sha256').update(source.body).digest('hex');
  return { rawId: source.rawId ?? `raw:state-finance:${house.toLowerCase()}:${provider}:${sha256}`, endpoint: source.sourceUrl, fetchedAt: source.fetchedAt ?? new Date().toISOString(), sha256 };
}
