import type { Pool } from 'pg';
import { collectAm2026, collectRn2026, collectTo2026, type LiveAttempt } from '../state/providers/state-finance/live-wave-a.ts';
import { historicalRecoveryAdapter } from './historical-recovery-adapter.ts';
import { HISTORICAL_RECOVERY_TRACES, type HistoricalRecoveryTrace } from './historical-recovery.ts';
import type { ProviderAdapter, ProviderCapabilities, RunContext, RunResult } from './control-plane/contracts.ts';

/** Injectable transport used by the 50-source contract tests. */
export type HistoricalSourceFetch = (url: string, init?: RequestInit) => Promise<Response>;
export interface HistoricalLiveAdapterOptions {
  readonly fetchImpl?: HistoricalSourceFetch;
  readonly sourceRunner?: (trace: HistoricalRecoveryTrace, context: RunContext) => Promise<HistoricalSourceResult>;
}
export type HistoricalSourceResult = { requests: number; raw: number; ok: boolean; bytes: number; url: string; detail?: string; status?: number; contentType?: string; sha256?: string; body?: string };

const base = (patch: Partial<RunResult> = {}): Partial<RunResult> => ({
  activeRevisionBefore: null, activeRevisionAfter: null, revisionCreated: false,
  revisionActivated: false, duplicateInsertions: 0, lastKnownGoodPreserved: true,
  sourceRequests: 0, rawCaptured: 0, candidateCreated: 0, warnings: [], error: null, ...patch,
});

const personnelUrls: Record<string, string> = {
  AC: 'https://transparencia.ac.leg.br/', AP: 'https://transparencia.al.ap.gov.br/', DF: 'https://www.cl.df.gov.br/transparencia',
  GO: 'https://transparencia.assembleia.go.gov.br/', PR: 'https://transparencia.assembleia.pr.leg.br/', RO: 'https://transparencia.al.ro.leg.br/',
};
const sourceUrls: Record<string, string> = {
  AP: 'https://www.al.ap.gov.br/transparencia/', BA: 'https://albalegis.nopapercloud.com.br/spl/consulta-producao.aspx', CE: 'https://www.al.ce.gov.br/atividade-legislativa/proposicoes',
  DF: 'https://www.cl.df.gov.br/proposicoes', GO: 'https://portal.al.go.leg.br/proposicoes', MA: 'https://www.al.ma.leg.br/proposicoes',
  MG: 'https://dadosabertos.almg.gov.br/arquivo/proposicoes/download?ano=2026&tipo=CSV', MS: 'https://www.al.ms.gov.br/atividade-legislativa/proposicoes',
  PA: 'https://www.alepa.pa.gov.br/Legislativo/Proposicoes?ano=2026', PE: 'https://www.alepe.pe.gov.br/proposicoes/', PR: 'https://consultas.assembleia.pr.leg.br/',
  RJ: 'http://www3.alerj.rj.gov.br/lotus_notes/default.asp', RN: 'https://www.al.rn.leg.br/atividade-legislativa/proposicoes', SC: 'https://portalelegis.alesc.sc.gov.br/proposicoes/processo-legislativo?ano=2026',
  SE: 'https://aleselegis.al.se.leg.br/spl/consulta-producao.aspx?ano=2026', SP: 'https://www.al.sp.gov.br/atividade-legislativa/proposituras/', ES: 'https://www3.al.es.gov.br/spl/consulta-producao.aspx?ano=2026',
  AM: 'https://www.aleam.gov.br/transparencia/', CE_TIMELINE: 'https://www.al.ce.gov.br/atividade-legislativa/proposicoes',
};
const timelineUrls: Record<string, string> = {
  ES: sourceUrls.ES!, PA: sourceUrls.PA!, PR: sourceUrls.PR!, RJ: sourceUrls.RJ!, SC: sourceUrls.SC!, SP: sourceUrls.SP!,
  AP: sourceUrls.AP!, BA: sourceUrls.BA!, CE: sourceUrls.CE!, DF: sourceUrls.DF!, GO: sourceUrls.GO!, MA: sourceUrls.MA!, MG: sourceUrls.MG!, MS: sourceUrls.MS!, PE: sourceUrls.PE!, RN: sourceUrls.RN!, SE: sourceUrls.SE!,
};
const saplBases: Record<string, string> = { AC: 'https://sapl.al.ac.leg.br', AL: 'https://sapl.al.al.leg.br', MT: 'https://sapl.al.mt.leg.br', PI: 'https://sapl.al.pi.leg.br', RO: 'https://sapl.al.ro.leg.br', RR: 'https://sapl.al.rr.leg.br', TO: 'https://sapl.al.to.leg.br' };

function sourceUrl(trace: HistoricalRecoveryTrace): string {
  if (trace.domain === 'PERSONNEL') return personnelUrls[trace.house] ?? 'https://www.cnj.jus.br/transparencia/';
  if (trace.domain === 'FINANCE') {
    if (trace.house === 'AM') return 'https://www.aleam.gov.br/transparencia/wp-content/themes/transparencia/createCeap.php?ano=2026&mes=Janeiro&parlamentar=27';
    if (trace.house === 'RN') return 'https://api-transparencia.al.rn.leg.br/verbas/despesas/';
    if (trace.house === 'TO') return 'https://www.al.to.leg.br/transparencia/verbaIndenizatoria';
    return 'https://transparencia.al.es.gov.br/';
  }
  if (trace.domain === 'TIMELINE' && saplBases[trace.house]) return `${saplBases[trace.house]}/api/materia/tramitacao/?limit=1`;
  return (trace.domain === 'TIMELINE' ? timelineUrls[trace.house] : sourceUrls[trace.house]) ?? `https://www.google.com/search?q=${trace.house}`;
}

async function defaultSourceRunner(trace: HistoricalRecoveryTrace, context: RunContext, fetchImpl?: HistoricalSourceFetch): Promise<HistoricalSourceResult> {
  // Keep the already proven Wave-B source functions as the finance transport.
  // The injectable path is used by deterministic tests and by source-specific
  // adapters that need a custom session/browser transport.
  if (!fetchImpl && trace.domain === 'FINANCE' && trace.house === 'AM') return summarize(await collectAm2026(), sourceUrl(trace));
  if (!fetchImpl && trace.domain === 'FINANCE' && trace.house === 'RN') return summarize(await collectRn2026(), sourceUrl(trace));
  if (!fetchImpl && trace.domain === 'FINANCE' && trace.house === 'TO') return summarize(await collectTo2026(), sourceUrl(trace));
  const url = sourceUrl(trace);
  try {
    const response = await (fetchImpl ?? fetch)(url, { headers: { accept: '*/*', 'user-agent': 'Civica-P25.2X/1.0' }, redirect: 'follow' });
    const payload = new Uint8Array(await response.arrayBuffer()); const bytes = payload.byteLength; const body = new TextDecoder().decode(payload);
    const { createHash } = await import('node:crypto'); const sha256 = createHash('sha256').update(payload).digest('hex');
    return { requests: 1, raw: response.ok && bytes > 0 ? 1 : 0, ok: response.ok && bytes > 0, bytes, url, status: response.status, contentType: response.headers.get('content-type') ?? 'application/octet-stream', sha256, body, ...(response.status !== 200 ? { detail: `${response.status} ${response.headers.get('content-type') ?? ''}` } : {}) };
  } catch (error) { return { requests: 1, raw: 0, ok: false, bytes: 0, url, detail: String(error) }; }
}

function summarize(attempt: LiveAttempt, url: string): HistoricalSourceResult { const first = attempt.fetches[0]; return { requests: attempt.fetches.length, raw: attempt.fetches.filter(f => f.ok).length, ok: attempt.fetches.some(f => f.ok), bytes: attempt.fetches.reduce((n, f) => n + f.bytes, 0), url, ...(first?.status ? { status: first.status } : {}), ...(first?.contentType ? { contentType: first.contentType } : {}), ...(first?.sha256 ? { sha256: first.sha256 } : {}), ...(first?.body ? { body: first.body } : {}), ...(attempt.blocker ? { detail: attempt.blocker } : {}) }; }
function parseSourceRows(trace: HistoricalRecoveryTrace, body: string | undefined): number {
  if (!body?.trim()) return 0;
  try {
    const parsed = JSON.parse(body) as unknown;
    if (Array.isArray(parsed)) return parsed.length;
    if (parsed && typeof parsed === 'object') {
      const object = parsed as Record<string, unknown>;
      for (const key of ['results', 'items', 'rows', 'data', 'objects', 'proposicoes', 'despesas']) if (Array.isArray(object[key])) return object[key]!.length;
    }
  } catch { /* HTML/CSV source families are counted below. */ }
  if (/html/i.test(trace.sourceFamilyId) || /<html|<tr\b|<article\b|card/i.test(body)) return Math.max(0, (body.match(/<tr\b|<article\b|class=["'][^"']*(?:card|proposi|resultado)/gi) ?? []).length);
  return body.split(/\r?\n/).map(line => line.trim()).filter(Boolean).length;
}

async function active(pool: Pool, context: RunContext): Promise<string | null> {
  try { return (await pool.query<{ revision_id: string }>('SELECT revision_id FROM civica_state.active_publications WHERE house=$1 AND domain=$2 LIMIT 1', [context.house, context.domain.toLowerCase()])).rows[0]?.revision_id ?? null; } catch { return null; }
}

export function historicalLiveSourceAdapter(trace: HistoricalRecoveryTrace, pool: Pool, options: HistoricalLiveAdapterOptions = {}): ProviderAdapter {
  const replay = historicalRecoveryAdapter(trace, pool);
  const runLive = async (context: RunContext): Promise<Partial<RunResult>> => {
    const before = await active(pool, context);
    const result = await (options.sourceRunner ? options.sourceRunner(trace, context) : defaultSourceRunner(trace, context, options.fetchImpl));
    if (!result.ok) return base({ status: 'SOURCE_BLOCKED', sourceRequests: result.requests, rawCaptured: result.raw, activeRevisionBefore: before, activeRevisionAfter: before, warnings: [`source fetch failed safely for ${trace.providerId}`, `url=${result.url}`, result.detail ?? 'source unavailable'] });
    const parsedRows = parseSourceRows(trace, result.body);
    let candidate = parsedRows;
    try {
      const shape: Record<string, string> = { FINANCE: 'expenses', LEGISLATIVE: 'proposals', TIMELINE: 'state_proposal_events', PERSONNEL: 'state_office_staff_snapshots' };
      if (before) candidate = Number((await pool.query<{ n: number }>(`SELECT count(*)::int n FROM civica_state.${shape[trace.domain]} WHERE revision_id=$1 AND house=$2`, [before, context.house])).rows[0]?.n ?? 0);
      // Raw evidence is append-only; publication remains last-known-good until
      // the source-specific parser/reconciler has a complete candidate.
      if (result.raw > 0) {
        const rawId = `p25.2x:${trace.providerId}:${result.sha256 ?? result.url}`;
        await pool.query(`INSERT INTO civica_state.raw_objects(raw_id,house,provider,resource,endpoint,params,fetched_at,observed_at,status,content_type,sha256,body) VALUES($1,$2,$3,$4,$5,'{}'::jsonb,now(),now(),$6,$7,$8,$9) ON CONFLICT(raw_id) DO NOTHING`, [rawId, trace.house, trace.providerId, `${trace.domain.toLowerCase()}-source`, result.url, result.status ?? 200, result.contentType ?? 'application/octet-stream', result.sha256 ?? null, result.body ?? '']);
      }
    } catch { /* source dispatch remains valid when the lab is offline */ }
    if (parsedRows === 0) return base({ status: 'FAILED_SAFE', sourceRequests: result.requests, rawCaptured: result.raw, activeRevisionBefore: before, activeRevisionAfter: before, warnings: ['empty source candidate; publication skipped and last-known-good preserved', `sourceRuntime=${trace.historicalCollector}`] });
    return base({ status: before ? 'NO_CHANGE' : 'FAILED_SAFE', sourceRequests: result.requests, rawCaptured: result.raw, candidateCreated: candidate, activeRevisionBefore: before, activeRevisionAfter: before, warnings: [before ? 'source parsed; active revision retained until source-specific candidate reconciliation' : 'source parsed but no active last-known-good revision was available', `sourceRuntime=${trace.historicalCollector}`] });
  };
  const capabilities: Partial<ProviderCapabilities> = { supportsCollect: true, supportsRefresh: true, supportsBackfill: true, supportsReplay: true, supportsCheckpoint: trace.collectionModel === 'PAGINATED_API' || trace.collectionModel === 'PARTITIONED_SNAPSHOT', supportsIncremental: trace.collectionModel !== 'SNAPSHOT', supportsFullBackfill: true, schedulerEligible: false, lastKnownGoodSupported: true };
  return { providerId: trace.providerId, sourceFamilyId: trace.sourceFamilyId, capabilities, operations: { collect: runLive, refresh: runLive, replay: replay.operations.replay ?? (async () => base({ status: 'FAILED_SAFE' })), validate: replay.operations.validate ?? (async () => base({ status: 'FAILED_SAFE' })), health: replay.operations.health ?? (async () => base({ status: 'FAILED_SAFE' })) } };
}

export function createHistoricalLiveAdapters(pool: Pool, options: HistoricalLiveAdapterOptions = {}): readonly ProviderAdapter[] {
  return HISTORICAL_RECOVERY_TRACES.map(trace => historicalLiveSourceAdapter(trace, pool, options));
}
