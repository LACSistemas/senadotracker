import type { PoolClient } from 'pg';
import { ensurePropositionGraphSchema, ensureTemporalSchema } from '@senadotracker/db';
import { brasiliaTimestamp, normalizeIdentifierYear, normalizeProposalNumber, presentedYearOf, proposalFunctionalGroup, searchText } from '@senadotracker/domain';
import { OfficialHttp, type JsonResponse } from './http.ts';
import { PostgresCollectorStore } from './postgres-collector.ts';
import { idFromUri, text, items as jsonItems, type Json } from './principal-proposal-parser.ts';

/**
 * Coletor de cobertura temporal da Câmara: ENUMERA por data de apresentação (`dataApresentacaoInicio/Fim`, janela máx. 3 meses),
 * independentemente do ano do número, e traz para o catálogo ativo as entidades que faltam.
 *
 * Não cria um segundo universo: cada proposição continua uma linha de `civica_poc.proposals` por `external_id` (no lote ativo da
 * Câmara). A enumeração só descobre entidades; guarda os ids oficiais em `presented_enumeration` apenas para reconciliar.
 */
const API = 'https://dadosabertos.camara.leg.br/api/v2';
export const PRESENTED_COLLECTION_START = '2026-01-01';
/** Janela de sobreposição do modo incremental: reencontra entidades registradas com atraso sem repetir o backfill. */
export const DEFAULT_OVERLAP_DAYS = 21;
const PAGE_SIZE = 100;

export const PRESENTED_SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS civica_poc.presented_coverage_runs (
    id text PRIMARY KEY, source text NOT NULL, range_from date NOT NULL, range_to date NOT NULL, cutoff_at timestamptz NOT NULL,
    started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz, status text NOT NULL DEFAULT 'running',
    official_count integer, catalog_count integer, intersection_count integer, only_official integer, only_catalog integer,
    date_divergent integer, duplicate_external_ids integer, requests integer NOT NULL DEFAULT 0, details jsonb)`,
  `CREATE TABLE IF NOT EXISTS civica_poc.presented_enumeration (
    run_id text NOT NULL, source text NOT NULL, external_id text NOT NULL, type text, number text, identifier_year integer, window_from date NOT NULL,
    window_to date NOT NULL, PRIMARY KEY (run_id, source, external_id))`,
  `CREATE INDEX IF NOT EXISTS presented_enumeration_id_idx ON civica_poc.presented_enumeration (source, external_id)`,
  `CREATE TABLE IF NOT EXISTS civica_poc.presented_window_checkpoints (
    run_id text NOT NULL, source text NOT NULL, window_from date NOT NULL, window_to date NOT NULL, last_page integer NOT NULL DEFAULT 0,
    complete boolean NOT NULL DEFAULT false, items integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (run_id, source, window_from, window_to))`,
];
export async function ensurePresentedSchema(db: { query: PoolClient['query'] }) {
  const done = (await db.query(`SELECT to_regclass('civica_poc.presented_window_checkpoints') IS NOT NULL ok`)).rows[0]?.ok;
  if (done) return;
  for (const sql of PRESENTED_SCHEMA_SQL) await db.query(sql);
}

export interface PresentedOptions {
  /** Início do intervalo (AAAA-MM-DD). Padrão: fim da última execução menos a sobreposição, ou 2026-01-01. */
  from?: string; to?: string; overlapDays?: number;
  /** Rebusca e atualiza (ementa, situação, data, principal) entidades que já estão no catálogo. Padrão: só insere as que faltam. */
  refresh?: boolean; ingest?: boolean; concurrency?: number; limit?: number; resolvePrincipals?: boolean;
  runId?: string; progress?: (message: string) => void; store?: PostgresCollectorStore;
  clientFactory?: (runId: string, store: PostgresCollectorStore) => { json: (url: string) => Promise<JsonResponse> };
  now?: () => Date;
}
export interface PresentedResult {
  runId: string; rangeFrom: string; rangeTo: string; cutoffAt: string; windows: number; pages: number; requests: number; officialCount: number;
  newEntities: number; inserted: number; refreshed: number; failed: number; retried: number; supportPromoted: number; errors: { id: string; error: string }[];
  reconciliation: PresentedReconciliation;
}
export interface PresentedReconciliation {
  officialCount: number; catalogCount: number; intersection: number; onlyOfficial: number; onlyCatalog: number; dateDivergent: number; duplicateExternalIds: number;
  enumeratorDuplicates: number; coverage: 'COMPLETE' | 'PARTIAL'; onlyOfficialSample: string[]; onlyCatalogSample: string[];
}

export const brDay = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(date);
export const addDays = (day: string, delta: number) => { const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + delta); return date.toISOString().slice(0, 10); };

/** Divide [from, to] em janelas mensais (cada uma bem abaixo do limite de 3 meses da API). */
export function monthWindows(from: string, to: string): { from: string; to: string }[] {
  const windows: { from: string; to: string }[] = [];
  let cursor = from;
  while (cursor <= to) {
    const [year, month] = cursor.split('-').map(Number) as [number, number];
    const monthEnd = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${String(monthEnd).padStart(2, '0')}`;
    windows.push({ from: cursor, to: end < to ? end : to });
    cursor = addDays(end, 1);
  }
  return windows;
}

export async function activeBatch(store: PostgresCollectorStore, source: 'camara' | 'senado' = 'camara') {
  const row = (await store.query<{ batch_id: string }>(`SELECT batch_id FROM civica_poc.active_publications WHERE source=$1`, [source])).rows[0];
  if (!row) throw new Error(`Sem lote ativo (${source}) em civica_poc.active_publications`);
  return row.batch_id;
}

/** Enumera todas as entidades apresentadas em [from, to] e grava os ids oficiais da execução (com checkpoint por janela e página). */
async function enumerate(store: PostgresCollectorStore, client: { json: (url: string) => Promise<JsonResponse> }, runId: string, windows: { from: string; to: string }[], result: PresentedResult, progress: (m: string) => void) {
  for (const window of windows) {
    const checkpoint = (await store.query<{ last_page: number; complete: boolean }>(`SELECT last_page,complete FROM civica_poc.presented_window_checkpoints WHERE run_id=$1 AND source='camara' AND window_from=$2 AND window_to=$3`, [runId, window.from, window.to])).rows[0];
    if (checkpoint?.complete) { result.windows++; continue; }
    let page = (checkpoint?.last_page ?? 0) + 1, count = 0;
    while (true) {
      result.requests++;
      const response = await client.json(`${API}/proposicoes?dataApresentacaoInicio=${window.from}&dataApresentacaoFim=${window.to}&itens=${PAGE_SIZE}&pagina=${page}&ordem=ASC&ordenarPor=id`);
      const rows = jsonItems((response.data as Json).dados);
      await store.transaction(async tx => {
        for (const row of rows) await tx.query(
          `INSERT INTO civica_poc.presented_enumeration(run_id,source,external_id,type,number,identifier_year,window_from,window_to) VALUES($1,'camara',$2,$3,$4,$5,$6,$7) ON CONFLICT (run_id,source,external_id) DO NOTHING`,
          [runId, String(row.id), text(row.siglaTipo), text(row.numero), normalizeIdentifierYear(row.ano), window.from, window.to]);
        await tx.query(`INSERT INTO civica_poc.presented_window_checkpoints(run_id,source,window_from,window_to,last_page,complete,items) VALUES($1,'camara',$2,$3,$4,$5,$6)
          ON CONFLICT (run_id,source,window_from,window_to) DO UPDATE SET last_page=excluded.last_page,complete=excluded.complete,items=presented_window_checkpoints.items+excluded.items,updated_at=now()`,
          [runId, window.from, window.to, page, rows.length < PAGE_SIZE, rows.length]);
      });
      count += rows.length; result.pages++;
      if (rows.length < PAGE_SIZE) break;
      page++;
    }
    result.windows++; progress(`apresentadas ${window.from}..${window.to}: ${count} entidades (páginas até ${page})`);
  }
}

/** Busca detalhe + autores + temas de uma entidade e grava no catálogo ativo (idempotente por external_id). */
async function ingestEntity(store: PostgresCollectorStore, client: { json: (url: string) => Promise<JsonResponse> }, batch: string, id: string, refresh: boolean, result: PresentedResult) {
  const [detail, authors, themes] = await Promise.all([client.json(`${API}/proposicoes/${id}`), client.json(`${API}/proposicoes/${id}/autores`), client.json(`${API}/proposicoes/${id}/temas`)]);
  result.requests += 3;
  const d = ((detail.data as Json).dados ?? {}) as Json;
  if (String(d.id ?? '') !== id) throw new Error(`ID retornado ${String(d.id)} diverge de ${id}`);
  const type = text(d.siglaTipo) ?? text(d.descricaoTipo) ?? '?', number = normalizeProposalNumber(d.numero), year = normalizeIdentifierYear(d.ano);
  const label = `${type} ${number ?? ''}${year ? `/${year}` : ''}`.replace(/\s+/g, ' ').trim(), summary = text(d.ementa), presentedAt = brasiliaTimestamp(text(d.dataApresentacao));
  const status = text((d.statusProposicao as Json | undefined)?.descricaoSituacao), principal = idFromUri(d.uriPropPrincipal);
  const authorRows = jsonItems((authors.data as Json).dados).map((a, index) => {
    const authorId = idFromUri(a.uri) ?? searchText(String(a.nome ?? `autor-${index}`)).replace(/\s+/g, '-');
    return { id: authorId, key: `${authorId}:${text(a.ordemAssinatura) ?? index + 1}`, name: text(a.nome), kind: text(a.tipo), proponent: a.proponente === undefined || a.proponente === null ? null : String(a.proponente) === '1' };
  }).filter(a => a.name);
  const themeRows = jsonItems((themes.data as Json).dados).map((t, index) => ({ key: `theme:${id}:${text(t.codTema) ?? index}`, label: text(t.tema) })).filter(t => t.label);
  const existed = Boolean((await store.query(`SELECT 1 FROM civica_poc.proposals WHERE source='camara' AND batch_id=$1 AND external_id=$2`, [batch, id])).rowCount);
  await store.transaction(async (tx: PoolClient) => {
    await tx.query(
      `INSERT INTO civica_poc.proposals(batch_id,source,external_id,type,number,year,functional_group,label,summary,presented_at,status,principal_id,payload,raw_id,search_label,search_summary,search_type,search_number)
       VALUES($1,'camara',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NULL,$12,$13,$14,$15,$16)
       ON CONFLICT (batch_id,external_id) DO ${refresh ? 'UPDATE SET type=excluded.type,number=excluded.number,year=excluded.year,functional_group=excluded.functional_group,label=excluded.label,summary=excluded.summary,presented_at=excluded.presented_at,status=excluded.status,principal_id=excluded.principal_id,raw_id=excluded.raw_id,search_label=excluded.search_label,search_summary=excluded.search_summary,search_type=excluded.search_type,search_number=excluded.search_number' : 'NOTHING'}`,
      [batch, id, type, number, year, proposalFunctionalGroup(type), label, summary, presentedAt, status, principal, detail.rawId, searchText(label), searchText(summary ?? ''), searchText(type), searchText(String(number ?? ''))]);
    await tx.query(`UPDATE civica_poc.proposals SET search_vector=setweight(to_tsvector('simple',coalesce(type||' '||number::text||coalesce('/'||year::text,''),'')),'A') || setweight(to_tsvector('portuguese',coalesce(label,'')),'B') || setweight(to_tsvector('portuguese',coalesce(summary,'')),'C') WHERE batch_id=$1 AND source='camara' AND external_id=$2`, [batch, id]);
    if (!existed || refresh) {
      const known = (await tx.query(`SELECT DISTINCT ON (person_external_id) person_external_id,party,uf FROM civica_poc.proposal_authors WHERE source='camara' AND person_external_id=ANY($1) AND party IS NOT NULL ORDER BY person_external_id,batch_id DESC`, [authorRows.map(a => a.id)])).rows;
      const partyOf = new Map(known.map((r: any) => [String(r.person_external_id), r]));
      await tx.query(`DELETE FROM civica_poc.proposal_authors WHERE batch_id=$1 AND proposal_id=$2`, [batch, id]);
      for (const a of authorRows) await tx.query(`INSERT INTO civica_poc.proposal_authors(batch_id,source,proposal_id,author_key,person_external_id,name,party,uf,search_name,author_kind,proponent) VALUES($1,'camara',$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING`, [batch, id, a.key, a.id, a.name, partyOf.get(a.id)?.party ?? null, partyOf.get(a.id)?.uf ?? null, searchText(a.name!), a.kind, a.proponent]);
      await tx.query(`DELETE FROM civica_poc.proposal_themes WHERE batch_id=$1 AND proposal_id=$2`, [batch, id]);
      for (const t of themeRows) await tx.query(`INSERT INTO civica_poc.proposal_themes(batch_id,source,proposal_id,theme_key,label) VALUES($1,'camara',$2,$3,$4) ON CONFLICT DO NOTHING`, [batch, id, t.key, t.label]);
    }
  });
  return { existed, presentedYear: presentedYearOf(presentedAt) };
}

/** Compara o enumerador oficial da execução com o catálogo no mesmo intervalo (por `external_id`). */
export async function reconcilePresented(store: PostgresCollectorStore, runId: string, from: string, to: string, source: 'camara' | 'senado' = 'camara'): Promise<PresentedReconciliation> {
  const batch = await activeBatch(store, source);
  const SRC = source;
  const one = async (sql: string, values: unknown[] = []) => (await store.query<any>(sql, values)).rows[0];
  const CATALOG = `civica_poc.proposals p WHERE p.source='${SRC}' AND p.batch_id=$1 AND (p.presented_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN $2::date AND $3::date`;
  const officialCount = Number((await one(`SELECT count(DISTINCT external_id)::int n FROM civica_poc.presented_enumeration WHERE run_id=$1 AND source='${SRC}'`, [runId])).n);
  const enumeratorRows = Number((await one(`SELECT count(*)::int n FROM civica_poc.presented_enumeration WHERE run_id=$1 AND source='${SRC}'`, [runId])).n);
  const catalogCount = Number((await one(`SELECT count(*)::int n FROM ${CATALOG}`, [batch, from, to])).n);
  const intersection = Number((await one(`SELECT count(*)::int n FROM civica_poc.presented_enumeration e JOIN civica_poc.proposals p ON p.source='${SRC}' AND p.batch_id=$2 AND p.external_id=e.external_id WHERE e.run_id=$1`, [runId, batch])).n);
  const onlyOfficial = (await store.query<{ external_id: string }>(`SELECT e.external_id FROM civica_poc.presented_enumeration e WHERE e.run_id=$1 AND e.source='${SRC}' AND NOT EXISTS (SELECT 1 FROM civica_poc.proposals p WHERE p.source='${SRC}' AND p.batch_id=$2 AND p.external_id=e.external_id) ORDER BY e.external_id::bigint`, [runId, batch])).rows.map(r => r.external_id);
  const onlyCatalog = (await store.query<{ external_id: string }>(`SELECT p.external_id FROM ${CATALOG} AND NOT EXISTS (SELECT 1 FROM civica_poc.presented_enumeration e WHERE e.run_id=$4 AND e.source='${SRC}' AND e.external_id=p.external_id) ORDER BY p.external_id::bigint`, [batch, from, to, runId])).rows.map(r => r.external_id);
  const dateDivergent = Number((await one(`SELECT count(*)::int n FROM civica_poc.presented_enumeration e JOIN civica_poc.proposals p ON p.source='${SRC}' AND p.batch_id=$2 AND p.external_id=e.external_id WHERE e.run_id=$1 AND NOT ((p.presented_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN e.window_from AND e.window_to)`, [runId, batch])).n);
  const duplicateExternalIds = Number((await one(`SELECT count(*)::int n FROM (SELECT external_id FROM civica_poc.proposals WHERE source='${SRC}' AND batch_id=$1 GROUP BY external_id HAVING count(*)>1) x`, [batch])).n);
  const enumeratorDuplicates = enumeratorRows - officialCount;
  const complete = onlyOfficial.length === 0 && onlyCatalog.length === 0 && dateDivergent === 0 && duplicateExternalIds === 0;
  return { officialCount, catalogCount, intersection, onlyOfficial: onlyOfficial.length, onlyCatalog: onlyCatalog.length, dateDivergent, duplicateExternalIds, enumeratorDuplicates, coverage: complete ? 'COMPLETE' : 'PARTIAL', onlyOfficialSample: onlyOfficial.slice(0, 10), onlyCatalogSample: onlyCatalog.slice(0, 10) };
}

export async function collectCamaraPresentedPostgres(options: PresentedOptions = {}): Promise<PresentedResult> {
  const store = options.store ?? new PostgresCollectorStore(); const ownStore = !options.store, progress = options.progress ?? (() => {});
  const now = options.now?.() ?? new Date(), concurrency = Math.max(1, Math.min(6, options.concurrency ?? 4)), overlap = Math.max(0, options.overlapDays ?? DEFAULT_OVERLAP_DAYS);
  try {
    await store.assertTarget(); await ensureTemporalSchema(store.pool); await ensurePropositionGraphSchema(store.pool); await ensurePresentedSchema(store.pool);
    const batch = await activeBatch(store);
    const last = (await store.query<{ range_to: string }>(`SELECT to_char(range_to,'YYYY-MM-DD') range_to FROM civica_poc.presented_coverage_runs WHERE source='camara' AND status='published' ORDER BY finished_at DESC LIMIT 1`)).rows[0];
    const today = brDay(now), to = options.to ?? today;
    const from = options.from ?? (last ? addDays(last.range_to, -overlap) : PRESENTED_COLLECTION_START);
    const runId = options.runId ?? `presented:camara:${now.getTime()}`;
    const result: PresentedResult = { runId, rangeFrom: from, rangeTo: to, cutoffAt: now.toISOString(), windows: 0, pages: 0, requests: 0, officialCount: 0, newEntities: 0, inserted: 0, refreshed: 0, failed: 0, retried: 0, supportPromoted: 0, errors: [], reconciliation: undefined as unknown as PresentedReconciliation };
    await store.query(`INSERT INTO civica_poc.presented_coverage_runs(id,source,range_from,range_to,cutoff_at) VALUES($1,'camara',$2,$3,$4) ON CONFLICT (id) DO NOTHING`, [runId, from, to, now.toISOString()]);
    const ingestionRun = await store.startRun('camara', `pg:camara-presented:${now.getTime()}`);
    const client = options.clientFactory?.(ingestionRun, store) ?? new OfficialHttp({ source: 'camara', save: raw => store.saveRaw(ingestionRun, raw), timeoutMs: 25_000, maxAttempts: 3, delayMs: 120 });

    await enumerate(store, client, runId, monthWindows(from, to), result, progress);

    // entidades oficiais ausentes do catálogo (e, no modo refresh, também as já existentes)
    const targetsSql = `SELECT e.external_id FROM civica_poc.presented_enumeration e WHERE e.run_id=$1 AND e.source='camara' ${options.refresh ? '' : `AND NOT EXISTS (SELECT 1 FROM civica_poc.proposals p WHERE p.source='camara' AND p.batch_id=$2 AND p.external_id=e.external_id)`} ORDER BY e.external_id::bigint ${options.limit ? `LIMIT ${Math.max(1, Math.floor(options.limit))}` : ''}`;
    const targets = (await store.query<{ external_id: string }>(targetsSql, options.refresh ? [runId] : [runId, batch])).rows.map(r => r.external_id);
    result.newEntities = targets.length;
    if (options.ingest !== false) {
      for (let pass = 1; pass <= 2; pass++) {
        const pending = pass === 1 ? targets : result.errors.splice(0).map(e => e.id);
        if (pass === 2) { result.retried = pending.length; result.failed = 0; }
        let cursor = 0;
        const worker = async () => {
          while (cursor < pending.length) {
            const id = pending[cursor++]!;
            try { const r = await ingestEntity(store, client, batch, id, Boolean(options.refresh), result); if (r.existed) result.refreshed++; else result.inserted++; }
            catch (error) { result.failed++; if (result.errors.length < 100) result.errors.push({ id, error: (error instanceof Error ? error.message : String(error)).slice(0, 200) }); }
            if ((result.inserted + result.refreshed + result.failed) % 100 === 0) progress(`ingestão: ${result.inserted} novas, ${result.refreshed} atualizadas, ${result.failed} falhas`);
          }
        };
        if (pending.length) await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, worker));
        if (!result.errors.length) break;
      }
      // uma entidade existe uma única vez: se estava como matéria de suporte, o catálogo passa a ser a fonte
      const promoted = await store.query(`DELETE FROM civica_poc.proposal_support s WHERE s.source='camara' AND EXISTS (SELECT 1 FROM civica_poc.proposals p WHERE p.source='camara' AND p.batch_id=$1 AND p.external_id=s.external_id)`, [batch]);
      result.supportPromoted = promoted.rowCount ?? 0;
      await store.query(`DELETE FROM civica_poc.proposal_support_themes t WHERE NOT EXISTS (SELECT 1 FROM civica_poc.proposal_support s WHERE s.source=t.source AND s.external_id=t.proposal_id)`);
      await store.query(`UPDATE civica_poc.proposition_batches b SET proposal_count=(SELECT count(*) FROM civica_poc.proposals p WHERE p.batch_id=b.id),author_count=(SELECT count(*) FROM civica_poc.proposal_authors a WHERE a.batch_id=b.id),theme_count=(SELECT count(*) FROM civica_poc.proposal_themes t WHERE t.batch_id=b.id) WHERE b.id=$1`, [batch]);
    }
    result.reconciliation = await reconcilePresented(store, runId, from, to);
    result.officialCount = result.reconciliation.officialCount;
    await store.query(`UPDATE civica_poc.presented_coverage_runs SET status='published',finished_at=now(),official_count=$2,catalog_count=$3,intersection_count=$4,only_official=$5,only_catalog=$6,date_divergent=$7,duplicate_external_ids=$8,requests=$9,details=$10 WHERE id=$1`,
      [runId, result.reconciliation.officialCount, result.reconciliation.catalogCount, result.reconciliation.intersection, result.reconciliation.onlyOfficial, result.reconciliation.onlyCatalog, result.reconciliation.dateDivergent, result.reconciliation.duplicateExternalIds, result.requests, JSON.stringify({ ...result, reconciliation: undefined, errors: result.errors.slice(0, 20), coverage: result.reconciliation.coverage, onlyOfficialSample: result.reconciliation.onlyOfficialSample, onlyCatalogSample: result.reconciliation.onlyCatalogSample })]);
    await store.query(`UPDATE civica.ingestion_runs SET finished_at=$1,status='published',expected_count=$2,roster_complete=1,reconciliation_json=$3 WHERE id=$4`, [new Date().toISOString(), result.officialCount, JSON.stringify({ scope: 'camara-presented', runId, ...result.reconciliation }), ingestionRun]);
    // mantém só as últimas 3 enumerações (são apenas para reconciliar)
    await store.query(`DELETE FROM civica_poc.presented_enumeration WHERE run_id NOT IN (SELECT id FROM (SELECT id,row_number() OVER (PARTITION BY source ORDER BY started_at DESC, id DESC) rn FROM civica_poc.presented_coverage_runs) x WHERE rn<=3)`);
    await store.query(`DELETE FROM civica_poc.presented_window_checkpoints WHERE run_id NOT IN (SELECT id FROM (SELECT id,row_number() OVER (PARTITION BY source ORDER BY started_at DESC, id DESC) rn FROM civica_poc.presented_coverage_runs) x WHERE rn<=3)`);
    if (options.resolvePrincipals !== false && options.ingest !== false && result.inserted + result.refreshed > 0) {
      try { const { resolveCamaraPrincipalsPostgres } = await import('./postgres-principal-resolver.ts'); await resolveCamaraPrincipalsPostgres({ store, scope: 'all', progress }); } catch (error) { progress(`pais históricos: ${error instanceof Error ? error.message : String(error)}`); }
    }
    return result;
  } finally { if (ownStore) await store.pool.end(); }
}
