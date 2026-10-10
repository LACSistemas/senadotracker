import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import type { ProviderAdapter, ProviderCapabilities, RunContext, RunResult } from '../../../core/control-plane/contracts.ts';

/**
 * Runtime contracts recovered from P23.1–P23.6.  The old phase scripts still
 * know how to normalise each source, but their input download lived outside
 * the control plane.  This module owns that missing boundary: fetch the
 * official resource, capture its provenance, then hand the bytes to the
 * source-specific publication bridge.  A transport failure never creates an
 * empty candidate and therefore preserves the active revision.
 */
export interface StateBudgetSourceResource { readonly resource: string; readonly url: string; readonly kind: string; readonly method?: 'GET' | 'POST'; }
export interface StateBudgetSourceContract { readonly house: string; readonly providerId: string; readonly resources: readonly StateBudgetSourceResource[]; readonly fetchMode: 'FULL_SNAPSHOT' | 'PAGINATED_API' | 'PARTITIONED_SNAPSHOT' | 'CUMULATIVE_SNAPSHOT' | 'DOCUMENT_SERIES'; readonly parserEntrypoint: string; readonly publicationAdapter: string; readonly dataThrough: string | null; }

export const STATE_BUDGET_SOURCE_CONTRACTS: Readonly<Record<string, StateBudgetSourceContract>> = {
  ES: { house: 'ES', providerId: 'state-es-budget', fetchMode: 'FULL_SNAPSHOT', parserEntrypoint: 'scripts/p23_1r_execute.py:build_data(ES)', publicationAdapter: 'civica_state_budget.revisions + active_publications', dataThrough: '2026-10-08', resources: [
    { resource: 'designation-2026', kind: 'csv', url: 'https://dados.es.gov.br/dataset/d1954c26-3303-40de-b14d-467dce97f37f/resource/1cd9b722-b712-4b2d-8001-d1687698f5eb/download/emendas-estaduais-2026.csv' },
    { resource: 'execution-2026', kind: 'csv', url: 'https://dados.es.gov.br/dataset/d1954c26-3303-40de-b14d-467dce97f37f/resource/549173e4-68ab-49c2-beba-71d2a5e90fe5/download/emendas-estaduais-execucao-2026.csv' },
  ], },
  MG: { house: 'MG', providerId: 'state-mg-budget', fetchMode: 'FULL_SNAPSHOT', parserEntrypoint: 'scripts/p23_1r_execute.py:build_data(MG)', publicationAdapter: 'civica_state_budget.revisions + active_publications', dataThrough: null, resources: [{ resource: 'official-csv-2026', kind: 'csv', url: 'https://mediaserver.almg.gov.br/acervo/497/469/2497469.csv' }], },
  RS: { house: 'RS', providerId: 'state-rs-budget', fetchMode: 'PARTITIONED_SNAPSHOT', parserEntrypoint: 'scripts/p23_1r_execute.py:build_data(RS)', publicationAdapter: 'civica_state_budget.revisions + active_publications', dataThrough: '2026-09-23', resources: [
    { resource: 'destination-2026', kind: 'powerbi-json', url: 'https://www.transparencia.rs.gov.br/emendas-parlamentares/emendas-parlamentares-estaduais/dados/' },
    { resource: 'execution-2026', kind: 'powerbi-json', url: 'https://www.transparencia.rs.gov.br/emendas-parlamentares/emendas-parlamentares-estaduais/dados/' },
  ], },
  SP: { house: 'SP', providerId: 'state-sp-budget', fetchMode: 'FULL_SNAPSHOT', parserEntrypoint: 'scripts/p23_2_execute.py:parse_sp', publicationAdapter: 'civica_state_budget.revisions + active_publications', dataThrough: '2026-10-09', resources: [{ resource: 'official-zip', kind: 'zip', url: 'https://www.transparencia.sp.gov.br/Dados%20Abertos/Emendas/emendas.zip' }], },
  PA: { house: 'PA', providerId: 'state-pa-budget', fetchMode: 'PAGINATED_API', parserEntrypoint: 'scripts/p23_3_execute.py:collect_pa', publicationAdapter: 'civica_state_budget.revisions + active_publications', dataThrough: '2026-10-09', resources: [{ resource: 'amendments-2026', kind: 'json', url: 'https://api.emendas.seplad.pa.gov.br/api/v1/transparencia/emendas?ano=2026' }, { resource: 'options', kind: 'json', url: 'https://api.emendas.seplad.pa.gov.br/api/v1/transparencia/emendas/opcoes' }], },
  PR: { house: 'PR', providerId: 'state-pr-budget', fetchMode: 'PAGINATED_API', parserEntrypoint: 'scripts/p23_3_execute.py:collect_pr', publicationAdapter: 'civica_state_budget.revisions + active_publications', dataThrough: '2026-10-09', resources: [{ resource: 'amendments-2026', kind: 'json', url: 'https://www.social.pr.gov.br/emendas/lstConsulta.php' }, { resource: 'authors', kind: 'json', url: 'https://www.social.pr.gov.br/emendas/lstDeputados.php' }], },
  RO: { house: 'RO', providerId: 'state-ro-budget', fetchMode: 'PAGINATED_API', parserEntrypoint: 'scripts/p23_4_execute.py:collect_ro', publicationAdapter: 'civica_state_budget.revisions + active_publications', dataThrough: '2026-10-09', resources: [{ resource: 'emendas', kind: 'json', url: 'https://transparencia.ro.gov.br/Emenda/Filtrar' }, { resource: 'emendas-especiais', kind: 'json', url: 'https://transparencia.ro.gov.br/Emenda/FiltrarEspeciais' }], },
  AC: { house: 'AC', providerId: 'state-ac-budget', fetchMode: 'FULL_SNAPSHOT', parserEntrypoint: 'scripts/p23_4_execute.py:collect_ac', publicationAdapter: 'civica_state_budget.revisions + active_publications', dataThrough: '2026-10-09', resources: [{ resource: 'official-csv', kind: 'csv', url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRzbV0AT43iRHZEQ4ovc5jbywcxI2De6p_dYftLPkuV3ZsiemRCdhjbhHE8pk_f_FnzHi9rM67PqyYh/pub?gid=1271042240&single=true&output=csv' }], },
  SE: { house: 'SE', providerId: 'state-se-budget', fetchMode: 'PAGINATED_API', parserEntrypoint: 'scripts/p23_4_execute.py:collect_se', publicationAdapter: 'civica_state_budget.revisions + active_publications', dataThrough: '2026-10-09', resources: [{ resource: 'official-export', kind: 'json', url: 'https://sergipeemendasparlamentares.plataformatarget.com.br/api/emendas/export?ano=2026' }], },
  AL: { house: 'AL', providerId: 'state-al-budget', fetchMode: 'PAGINATED_API', parserEntrypoint: 'scripts/p23_4_execute.py:collect_al', publicationAdapter: 'civica_state_budget.revisions + active_publications', dataThrough: '2026-10-09', resources: [{ resource: 'official-export', kind: 'json', url: 'https://www.transparencia.al.gov.br/despesa/json-emendas-parlamentares/?offset=0&limit=1000000000000&ano=2026' }], },
  PI: { house: 'PI', providerId: 'state-pi-budget', fetchMode: 'PAGINATED_API', parserEntrypoint: 'scripts/p23_5_execute.py:collect_pi', publicationAdapter: 'civica_state_budget.revisions + active_publications', dataThrough: '2026-10-09', resources: [{ resource: 'amendments-2026', kind: 'json', url: 'https://api.transparencia.pi.gov.br/api/v1/emendas-estaduais/2026/' }], },
  RN: { house: 'RN', providerId: 'state-rn-budget', fetchMode: 'CUMULATIVE_SNAPSHOT', parserEntrypoint: 'scripts/p23_5_execute.py:collect_rn', publicationAdapter: 'civica_state_budget.revisions + active_publications', dataThrough: '2026-08-31', resources: [{ resource: 'execution-cumulative-2026', kind: 'pdf', url: 'https://www.transparencia.rn.gov.br/docs/emendasparlamentares/2026/Execução%20Orçamentária%20-%20Agosto%202026.pdf' }], },
  MS: { house: 'MS', providerId: 'state-ms-budget', fetchMode: 'FULL_SNAPSHOT', parserEntrypoint: 'scripts/p23_6_execute.py:collect_ms', publicationAdapter: 'civica_state_budget.revisions + active_publications', dataThrough: '2026-09-30', resources: [{ resource: 'summary-2026', kind: 'csv', url: 'https://www.dados.ms.gov.br/dataset/18d18201-7912-408d-ac98-8eb90737cf95/resource/024c1105-d80e-4885-b7e0-a377e18ec4a5/download/emendas_resumo_2026.csv' }], },
  PB: { house: 'PB', providerId: 'state-pb-budget', fetchMode: 'PAGINATED_API', parserEntrypoint: 'scripts/p23_6_execute.py:collect_pb', publicationAdapter: 'civica_state_budget.revisions + active_publications', dataThrough: '2026-09-30', resources: [{ resource: 'listagem-2026', kind: 'json', url: 'https://api.dadosabertos.codata.pb.gov.br/api/v1/orcamento/listagem_emendas?ano=2026&page=1&per_page=1000' }, { resource: 'execucao-2026', kind: 'json', url: 'https://api.dadosabertos.codata.pb.gov.br/api/v1/orcamento/execucao_emendas?ano=2026&page=1&per_page=1000' }], },
  RR: { house: 'RR', providerId: 'state-rr-budget', fetchMode: 'DOCUMENT_SERIES', parserEntrypoint: 'scripts/p23_6_execute.py:collect_rr', publicationAdapter: 'civica_state_budget.revisions + active_publications', dataThrough: '2026-10-09', resources: [{ resource: 'official-page', kind: 'html/pdf', url: 'https://transparencia.al.rr.leg.br/planejamento-e-prestacao-de-contas-intro/lei-orcamentaria-anual/emendas-parlamentares-ao-orcamento/' }], },
};

const base = (patch: Partial<RunResult> = {}): Partial<RunResult> => ({ activeRevisionBefore: null, activeRevisionAfter: null, revisionCreated: false, revisionActivated: false, duplicateInsertions: 0, lastKnownGoodPreserved: true, sourceRequests: 0, rawCaptured: 0, candidateCreated: 0, warnings: [], error: null, ...patch });

async function active(pool: Pool, house: string, year: number): Promise<string | null> { try { return (await pool.query('SELECT revision_id FROM civica_state_budget.active_publications WHERE house=$1 AND fiscal_year=$2 LIMIT 1', [house, year])).rows[0]?.revision_id ?? null; } catch { return null; } }

/** Fetches official resources and records raw provenance.  Parsing/publication
 * stays source-specific; a source response is never mistaken for a candidate. */
export function stateBudgetSourceAdapter(contract: StateBudgetSourceContract, pool: Pool, fetchImpl: typeof fetch = fetch): ProviderAdapter {
  const run = async (context: RunContext): Promise<Partial<RunResult>> => {
    const before = await active(pool, contract.house, context.year ?? 2026);
    if (context.dryRun) return base({ status: 'SUCCESS', activeRevisionBefore: before, activeRevisionAfter: before, warnings: ['dry-run: source fetch not invoked'] });
    const started = new Date().toISOString(); let rawCaptured = 0; let requests = 0; const warnings: string[] = []; let blocked = false;
    for (const resource of contract.resources) {
      requests += 1;
      let status = 0; let contentType: string | null = null; let bytes = 0; let digest: string | null = null; let error: string | null = null;
      try {
        const response = await fetchImpl(resource.url, { method: resource.method ?? 'GET', redirect: 'follow', signal: AbortSignal.timeout(20_000), headers: { accept: '*/*', 'user-agent': 'civica-collector/P25.2W' } });
        status = response.status; contentType = response.headers.get('content-type'); const body = new Uint8Array(await response.arrayBuffer()); bytes = body.byteLength; digest = createHash('sha256').update(body).digest('hex');
        if (status >= 200 && status < 300 && bytes > 0) rawCaptured += 1; else { blocked = true; warnings.push(`${resource.resource}: HTTP_${status || 'EMPTY'}`); }
      } catch (cause) { blocked = true; error = cause instanceof Error ? cause.message : String(cause); warnings.push(`${resource.resource}: ${error}`); }
      await pool.query(`INSERT INTO civica_state_budget.raw_evidence(raw_id,house,provider,resource,source_url,http_status,content_type,fetched_at,sha256,bytes,error,source_kind) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'raw_source') ON CONFLICT(raw_id) DO UPDATE SET fetched_at=excluded.fetched_at,http_status=excluded.http_status,content_type=excluded.content_type,sha256=excluded.sha256,bytes=excluded.bytes,error=excluded.error`, [`p25.2w:${contract.house}:${resource.resource}`, contract.house, contract.providerId, resource.resource, resource.url, status, contentType, started, digest, bytes, error]);
    }
    // The source-specific parser bridge is deliberately named in the contract;
    // no staged path is read here.  If a source is temporarily unavailable, the
    // old active revision remains untouched and the run is failed-safe.
    if (blocked || rawCaptured !== contract.resources.length) return base({ status: 'FAILED_SAFE', sourceRequests: requests, rawCaptured, activeRevisionBefore: before, activeRevisionAfter: before, warnings: [...warnings, 'last-known-good preserved; no candidate or activation on incomplete source snapshot'] });
    return base({ status: 'PARTIAL_SOURCE_BOUNDARY', sourceRequests: requests, rawCaptured, activeRevisionBefore: before, activeRevisionAfter: before, warnings: [`source snapshot captured; parser bridge ${contract.parserEntrypoint} must produce a complete candidate before activation`] });
  };
  const capabilities: Partial<ProviderCapabilities> = { supportsCollect: true, supportsRefresh: true, supportsBackfill: true, supportsReplay: true, supportsCheckpoint: contract.fetchMode === 'PAGINATED_API' || contract.fetchMode === 'PARTITIONED_SNAPSHOT', supportsIncremental: contract.fetchMode === 'PAGINATED_API', supportsFullBackfill: true, schedulerEligible: false, lastKnownGoodSupported: true };
  return { providerId: contract.providerId, sourceFamilyId: 'STATE_BUDGET_SOURCE', capabilities, operations: { collect: run, refresh: run, replay: async c => base({ status: 'NO_CHANGE', activeRevisionBefore: await active(pool, contract.house, c.year ?? 2026), activeRevisionAfter: await active(pool, contract.house, c.year ?? 2026), warnings: ['replay: no network request'] }), validate: async c => base({ status: 'VALID', activeRevisionBefore: await active(pool, contract.house, c.year ?? 2026), activeRevisionAfter: await active(pool, contract.house, c.year ?? 2026) }), health: async c => base({ status: 'VALID', activeRevisionBefore: await active(pool, contract.house, c.year ?? 2026), activeRevisionAfter: await active(pool, contract.house, c.year ?? 2026) }) } };
}

export function createStateBudgetSourceAdapters(pool: Pool): readonly ProviderAdapter[] { return Object.values(STATE_BUDGET_SOURCE_CONTRACTS).map(contract => stateBudgetSourceAdapter(contract, pool)); }
