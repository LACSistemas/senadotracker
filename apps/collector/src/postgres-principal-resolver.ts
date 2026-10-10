import type { PoolClient } from 'pg';
import { ensurePropositionGraphSchema } from '@senadotracker/db';
import { OfficialHttp, type JsonResponse } from './http.ts';
import { PostgresCollectorStore } from './postgres-collector.ts';
import { parsePrincipalProposal } from './principal-proposal-parser.ts';

const api = 'https://dadosabertos.camara.leg.br/api/v2';
const MAX_ATTEMPTS = 5;
/** Cadeias oficiais de apensação chegam a 6+ saltos; 10 cobre o observado com folga e nunca é ilimitado (ciclos já são barrados por PK + visited). */
export const DEFAULT_MAX_DEPTH = 10;
export const MAX_DEPTH_CAP = 10;
const AMENDMENT_GROUP = 'emendas_substitutivos';

export interface PostgresPrincipalOptions {
  /** `amendments`: só pais de emendas/substitutivos (prioridade do grafo). `all`: pais de qualquer filho do catálogo. */
  scope?: 'amendments' | 'all';
  maxDepth?: number; concurrency?: number; limit?: number; delayMs?: number;
  progress?: (message: string) => void;
  clientFactory?: (runId: string, store: PostgresCollectorStore) => { json: (url: string) => Promise<JsonResponse> };
  store?: PostgresCollectorStore;
}
export interface PostgresPrincipalResult {
  scope: string; seeded: number; queued: number; alreadyKnown: number; attempted: number; resolved: number; notFound: number; failed: number; retried: number; requests: number;
  uniqueParents: number; nestedEnqueued: number; skippedByDepth: number; maxDepth: number; remaining: number; runId: string | null; errors: { parentId: string; error: string }[];
}

/**
 * Pais históricos (matérias de anos anteriores citadas como principal por proposições do catálogo) viram matérias de
 * suporte (`civica_poc.proposal_support`), nunca linhas do lote ativo de 2026. A fila é deduplicada por pai: uma matéria
 * usada por 200 filhos é buscada uma vez. Falha de um pai não bloqueia os demais nem o catálogo dos filhos.
 */
export async function resolveCamaraPrincipalsPostgres(options: PostgresPrincipalOptions = {}): Promise<PostgresPrincipalResult> {
  const store = options.store ?? new PostgresCollectorStore(); const ownStore = !options.store;
  const maxDepth = Math.max(1, Math.min(MAX_DEPTH_CAP, options.maxDepth ?? DEFAULT_MAX_DEPTH)), concurrency = Math.max(1, Math.min(8, options.concurrency ?? 4)), scope = options.scope ?? 'amendments';
  const progress = options.progress ?? (() => {});
  const result: PostgresPrincipalResult = { scope, seeded: 0, queued: 0, alreadyKnown: 0, attempted: 0, resolved: 0, notFound: 0, failed: 0, retried: 0, requests: 0, uniqueParents: 0, nestedEnqueued: 0, skippedByDepth: 0, maxDepth, remaining: 0, runId: null, errors: [] };
  try {
    await store.assertTarget(); await ensurePropositionGraphSchema(store.pool);
    const batch = (await store.query<{ batch_id: string }>(`SELECT batch_id FROM civica_poc.active_publications WHERE source='camara'`)).rows[0]?.batch_id;
    if (!batch) throw new Error('Sem lote ativo da Câmara em civica_poc.active_publications');
    result.seeded = await seedQueue(store, batch, scope);
    const runId = await store.startRun('camara', `pg:camara-principals:${Date.now()}`); result.runId = runId;
    const client = options.clientFactory?.(runId, store) ?? new OfficialHttp({ source: 'camara', save: raw => store.saveRaw(runId, raw), timeoutMs: 20_000, maxAttempts: 3, delayMs: options.delayMs ?? 120 });
    const visited = new Set<string>();
    for (let pass = 1; pass <= 2; pass++) {
      const pending = (await store.query<{ parent_id: string; depth: number; first_child_id: string | null }>(
        `SELECT parent_id,depth,first_child_id FROM civica_poc.principal_resolution_queue
         WHERE source='camara' AND state IN ('pending','failed') AND attempts<$1 AND depth<=$2 ORDER BY priority,depth,parent_id ${options.limit ? 'LIMIT ' + Math.max(1, Math.floor(options.limit)) : ''}`, [MAX_ATTEMPTS, maxDepth])).rows;
      if (!pending.length) break;
      if (pass === 2) result.retried = pending.length;
      let cursor = 0;
      const worker = async () => {
        while (cursor < pending.length) {
          if (options.limit && result.attempted >= options.limit) return;
          const target = pending[cursor++]!;
          if (visited.has(target.parent_id) && pass === 1) continue; visited.add(target.parent_id);
          await resolveOne(store, client, target, maxDepth, result, progress);
        }
      };
      await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, worker));
      // Pais descobertos durante esta passada (o pai de um pai) entram na fila com depth+1: segue até a raiz ou o limite de profundidade.
      while (true) {
        const next = (await store.query<{ parent_id: string; depth: number; first_child_id: string | null }>(
          `SELECT parent_id,depth,first_child_id FROM civica_poc.principal_resolution_queue WHERE source='camara' AND state='pending' AND attempts=0 AND depth<=$1 ORDER BY depth,parent_id`, [maxDepth])).rows.filter(row => !visited.has(row.parent_id));
        if (!next.length || (options.limit && result.attempted >= options.limit)) break;
        cursor = 0; pending.splice(0, pending.length, ...next);
        await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, worker));
      }
    }
    const queue = (await store.query<{ state: string; n: number }>(`SELECT state,count(*)::int n FROM civica_poc.principal_resolution_queue WHERE source='camara' GROUP BY state`)).rows;
    result.remaining = queue.filter(row => row.state === 'pending' || row.state === 'failed').reduce((sum, row) => sum + Number(row.n), 0);
    result.skippedByDepth = Number((await store.query<{ n: number }>(`SELECT count(*)::int n FROM civica_poc.principal_resolution_queue WHERE source='camara' AND state='pending' AND depth>$1`, [maxDepth])).rows[0]?.n ?? 0);
    await store.query(`UPDATE civica.ingestion_runs SET finished_at=$1,status='published',expected_count=$2,roster_complete=1,reconciliation_json=$3 WHERE id=$4`, [new Date().toISOString(), result.resolved, JSON.stringify({ ...result, scope: `principal-proposal-support:${scope}`, errors: result.errors.slice(0, 20) }), runId]);
    return result;
  } finally { if (ownStore) await store.pool.end(); }
}

/** Enfileira pais ausentes. `ON CONFLICT` preserva estado/tentativas: reexecutar não reabre pais já resolvidos. */
async function seedQueue(store: PostgresCollectorStore, batch: string, scope: 'amendments' | 'all') {
  const rows = await store.query(
    `INSERT INTO civica_poc.principal_resolution_queue(source,parent_id,state,depth,priority,first_child_id,child_count)
     SELECT 'camara',c.principal_id,'pending',1,CASE WHEN bool_or(c.functional_group=$2) THEN 0 ELSE 1 END,min(c.external_id),count(*)::int
     FROM civica_poc.proposals c
     WHERE c.source='camara' AND c.batch_id=$1 AND c.principal_id IS NOT NULL AND c.principal_id<>c.external_id ${scope === 'amendments' ? 'AND c.functional_group=$2' : ''}
       AND NOT EXISTS (SELECT 1 FROM civica_poc.proposals p WHERE p.source='camara' AND p.batch_id=$1 AND p.external_id=c.principal_id)
       AND NOT EXISTS (SELECT 1 FROM civica_poc.proposal_support s WHERE s.source='camara' AND s.external_id=c.principal_id)
     GROUP BY c.principal_id
     ON CONFLICT (source,parent_id) DO UPDATE SET child_count=excluded.child_count,priority=LEAST(civica_poc.principal_resolution_queue.priority,excluded.priority),updated_at=now()`, [batch, AMENDMENT_GROUP]);
  return rows.rowCount ?? 0;
}

async function resolveOne(store: PostgresCollectorStore, client: { json: (url: string) => Promise<JsonResponse> }, target: { parent_id: string; depth: number; first_child_id: string | null }, maxDepth: number, result: PostgresPrincipalResult, progress: (m: string) => void) {
  const id = target.parent_id; result.attempted++;
  await store.query(`UPDATE civica_poc.principal_resolution_queue SET attempts=attempts+1,updated_at=now() WHERE source='camara' AND parent_id=$1`, [id]);
  try {
    result.requests += 2;
    const [detail, themes] = await Promise.all([client.json(`${api}/proposicoes/${id}`), client.json(`${api}/proposicoes/${id}/temas`)]);
    const { proposal, themes: themeRows } = parsePrincipalProposal(detail, themes, target.first_child_id ?? id);
    if (proposal.externalId !== id) throw new Error(`ID retornado ${proposal.externalId} diverge de ${id}`);
    await store.transaction(async (tx: PoolClient) => {
      await tx.query(
        `INSERT INTO civica_poc.proposal_support(source,external_id,type,number,year,functional_group,label,summary,presented_at,status,principal_id,previous_id,next_id,catalog_role,discovered_by,depth,raw_id,official_url,resolved_at)
         VALUES('camara',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'relationship_support',$13,$14,$15,$16,now())
         ON CONFLICT (source,external_id) DO UPDATE SET type=excluded.type,number=excluded.number,year=excluded.year,functional_group=excluded.functional_group,label=excluded.label,summary=excluded.summary,presented_at=excluded.presented_at,status=excluded.status,principal_id=excluded.principal_id,previous_id=excluded.previous_id,next_id=excluded.next_id,raw_id=excluded.raw_id,resolved_at=now()`,
        [id, proposal.type, proposal.number && /^\d+$/.test(proposal.number) ? proposal.number : null, proposal.year, proposal.functionalGroup, proposal.label, proposal.summary, proposal.presentedAt ? proposal.presentedAt : null, proposal.status, proposal.principalProposalId ?? null, proposal.previousProposalId ?? null, proposal.nextProposalId ?? null, proposal.discoveredByProposalId ?? null, target.depth, proposal.rawId, proposal.officialUrl]);
      await tx.query('DELETE FROM civica_poc.proposal_support_themes WHERE source=$1 AND proposal_id=$2', ['camara', id]);
      for (const theme of themeRows) await tx.query(`INSERT INTO civica_poc.proposal_support_themes(source,proposal_id,code,label,relevance,raw_id) VALUES('camara',$1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`, [id, theme.code, theme.label, theme.relevance, theme.rawId]);
      await tx.query(`UPDATE civica_poc.principal_resolution_queue SET state='resolved',last_error=NULL,resolved_at=now(),updated_at=now() WHERE source='camara' AND parent_id=$1`, [id]);
      const nested = proposal.principalProposalId;
      if (nested && nested !== id) {
        if (target.depth + 1 > maxDepth) { result.skippedByDepth++; }
        const known = await tx.query(`SELECT 1 FROM civica_poc.proposal_support WHERE source='camara' AND external_id=$1 UNION ALL SELECT 1 FROM civica_poc.proposals p JOIN civica_poc.active_publications a ON a.source=p.source AND a.batch_id=p.batch_id WHERE p.source='camara' AND p.external_id=$1 LIMIT 1`, [nested]);
        if (known.rowCount) result.alreadyKnown++;
        else { const queued = await tx.query(`INSERT INTO civica_poc.principal_resolution_queue(source,parent_id,state,depth,priority,first_child_id,child_count) VALUES('camara',$1,'pending',$2,0,$3,1) ON CONFLICT (source,parent_id) DO NOTHING`, [nested, target.depth + 1, id]); result.nestedEnqueued += queued.rowCount ?? 0; }
      }
    });
    result.resolved++; result.uniqueParents++;
    if (result.attempted % 100 === 0) progress(`principais: ${result.attempted} tentados, ${result.resolved} resolvidos, ${result.failed} falhas, ${result.notFound} não encontrados`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error); const notFound = /HTTP 404/.test(message);
    await store.query(`UPDATE civica_poc.principal_resolution_queue SET state=$2,last_error=$3,updated_at=now() WHERE source='camara' AND parent_id=$1`, [id, notFound ? 'not_found' : 'failed', message.slice(0, 500)]);
    if (notFound) result.notFound++; else { result.failed++; if (result.errors.length < 50) result.errors.push({ parentId: id, error: message.slice(0, 200) }); }
  }
}
