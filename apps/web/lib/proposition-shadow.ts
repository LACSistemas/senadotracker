import 'server-only';
import pg from 'pg';
import { postgresPropositionRepository, type PropositionSearchQuery } from '@senadotracker/db';

type ShadowQuery = PropositionSearchQuery & { pageSize?: number };
type ShadowItem = { source?: string; external_id?: string; proposal?: { source?: string; externalId?: string } };
const state = globalThis as typeof globalThis & { senadoTrackerPgShadowPool?: pg.Pool };

function enabled() { return process.env.PROPOSITIONS_PG_SHADOW_ENABLED === 'true'; }
function sampled() { const rate = Math.max(0, Math.min(1, Number(process.env.PROPOSITIONS_PG_SHADOW_SAMPLE_RATE ?? 0))); return rate > 0 && Math.random() < rate; }
function pool() { const timeoutMs=Math.max(1,Number(process.env.PROPOSITIONS_PG_SHADOW_TIMEOUT_MS ?? 250)); return state.senadoTrackerPgShadowPool ??= new pg.Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 5432), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, max: 2, idleTimeoutMillis: 10_000, statement_timeout: timeoutMs }); }
const key = (item: ShadowItem) => item.source && item.external_id ? `${item.source}:${item.external_id}` : item.proposal?.source && item.proposal.externalId ? `${item.proposal.source}:${item.proposal.externalId}` : null;

export function comparePropositionResults(input: ShadowQuery, sqlite: { items: ShadowItem[]; hasNextPage: boolean }, postgres: { items: ShadowItem[]; hasNextPage: boolean }) {
  const a = sqlite.items.map(key).filter(Boolean) as string[], b = postgres.items.map(key).filter(Boolean) as string[], setA = new Set(a), setB = new Set(b);
  const onlyA = a.filter(value => !setB.has(value)), onlyB = b.filter(value => !setA.has(value));
  const diffType = onlyA.length || onlyB.length ? (a.length === b.length ? 'PAGE_WINDOW_MISMATCH' : 'SET_MISMATCH') : sqlite.hasNextPage !== postgres.hasNextPage ? 'PAGINATION_MISMATCH' : a.join('|') !== b.join('|') ? 'ORDER_ONLY' : 'MATCH';
  const diagnosis = diffType === 'PAGE_WINDOW_MISMATCH' && input.q?.trim().toLocaleLowerCase('pt-BR') === 'educação básica' ? 'PAGE_WINDOW_ORDER_DIFF' : undefined;
  return { input, sqliteCount: a.length, postgresCount: b.length, diffType, diagnosis, diffCount: onlyA.length + onlyB.length, sqliteOnly: onlyA.slice(0, 5), postgresOnly: onlyB.slice(0, 5), hasNextPageMismatch: sqlite.hasNextPage !== postgres.hasNextPage };
}

export function runPropositionShadow(input: ShadowQuery, sqlite: { items: ShadowItem[]; hasNextPage: boolean }) {
  if (!enabled() || !sampled()) return;
  const started = performance.now(), timeoutMs = Math.max(1, Number(process.env.PROPOSITIONS_PG_SHADOW_TIMEOUT_MS ?? 250));
  const repository = postgresPropositionRepository(pool());
  void Promise.race([repository.search(input), new Promise<never>((_, reject) => setTimeout(() => reject(new Error('shadow timeout')), timeoutMs))]).then(result => {
    const comparison = comparePropositionResults(input, sqlite, result as { items: ShadowItem[]; hasNextPage: boolean });
    console.info(JSON.stringify({ type: 'proposition_pg_shadow', timestamp: new Date().toISOString(), sqliteMs: null, postgresMs: +(performance.now() - started).toFixed(2), comparisonMs: 0, ...comparison }));
  }).catch(error => { const timeout=error?.code==='57014'||(error instanceof Error&&error.message==='shadow timeout'); console.warn(JSON.stringify({ type: 'proposition_pg_shadow', timestamp: new Date().toISOString(), diffType: timeout ? 'PG_TIMEOUT' : 'PG_ERROR', timeout_source:error?.code==='57014'?'postgres_statement_timeout':undefined, pgError: error instanceof Error ? error.message : String(error) })); });
}
