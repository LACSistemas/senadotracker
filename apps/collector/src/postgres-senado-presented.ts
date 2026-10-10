import type { PoolClient } from 'pg';
import { ensureTemporalSchema } from '@senadotracker/db';
import { brasiliaTimestamp, normalizeIdentifierYear, normalizeProposalNumber, proposalFunctionalGroup, searchText } from '@senadotracker/domain';
import { OfficialHttp, type JsonResponse } from './http.ts';
import { PostgresCollectorStore } from './postgres-collector.ts';
import { activeBatch, addDays, brDay, DEFAULT_OVERLAP_DAYS, ensurePresentedSchema, monthWindows, PRESENTED_COLLECTION_START, reconcilePresented, type PresentedReconciliation } from './postgres-camara-presented.ts';
import { text, items as jsonItems, type Json } from './principal-proposal-parser.ts';

/**
 * Coletor universal de matérias do Senado por data de apresentação (endpoint sucessor `/processo`, validado contra o legado
 * `materia/pesquisa/lista`: 3.483 = 3.483, 0 divergências de id, data, sigla, número, ano e autoria).
 *
 * O catálogo do Senado deixa de depender do cadastro de senadores em exercício: matérias de origem na Câmara, da Presidência,
 * de comissões e de senadores fora de exercício na data da coleta entram no mesmo lote ativo, deduplicadas por `external_id`
 * (código da matéria). O cadastro continua servindo a perfis, autoria e relatoria.
 */
const API = 'https://legis.senado.leg.br/dadosabertos';

export interface SenadoPresentedOptions {
  from?: string; to?: string; overlapDays?: number; refresh?: boolean; /** Só acrescenta autores ausentes (por código do parlamentar) em matérias já existentes; não apaga nem altera nada. */ backfillAuthors?: boolean; ingest?: boolean; concurrency?: number; limit?: number; runId?: string;
  progress?: (message: string) => void; store?: PostgresCollectorStore;
  clientFactory?: (runId: string, store: PostgresCollectorStore) => { json: (url: string) => Promise<JsonResponse> };
  now?: () => Date;
}
export interface SenadoPresentedResult {
  runId: string; rangeFrom: string; rangeTo: string; cutoffAt: string; windows: number; requests: number; officialCount: number;
  newEntities: number; inserted: number; refreshed: number; failed: number; retried: number; errors: { id: string; error: string }[]; reconciliation: PresentedReconciliation;
}

const IDENT = /^([A-Z][A-Z.\-]*)\s+(\d+)\/(\d{4})/;
/** "REQ 1/2026 - CDIR" → { type: 'REQ', number: 1, year: 2026 }. */
export function parseSenadoIdentification(identification: string | null | undefined) {
  const match = IDENT.exec(String(identification ?? '').trim());
  return match ? { type: match[1]!, number: normalizeProposalNumber(match[2]), year: normalizeIdentifierYear(match[3]) } : null;
}

/** Autores de uma matéria a partir de `autoriaIniciativa`/`documento.autoria` do detalhe; UF dos senadores vem do texto "Senador X (PARTIDO/UF)". */
export function senadoAuthors(detail: Json, authorText: string | null) {
  const list = jsonItems(detail.autoriaIniciativa).length ? jsonItems(detail.autoriaIniciativa) : jsonItems((detail.documento as Json | undefined)?.autoria);
  const ufByName = new Map<string, string>();
  for (const m of String(authorText ?? '').matchAll(/Senador(?:a)?\s+([^(]+?)\s*\([^/)]*\/([A-Z]{2})\)/g)) ufByName.set(searchText(m[1]!), m[2]!);
  return list.map((a, index) => {
    const name = text(a.autor); const code = text(a.codigoParlamentar);
    const id = code ?? (name ? searchText(name).replace(/\s+/g, '-') : `autor-${index}`);
    const isSenator = /SENADOR/i.test(String(a.siglaTipo ?? ''));
    return { id, personId: code, key: `${id}:${text(a.ordem) ?? index + 1}`, name, party: text(a.siglaPartido), uf: isSenator && name ? ufByName.get(searchText(name)) ?? null : null, kind: text(a.siglaTipo) };
  }).filter(a => a.name);
}

async function enumerate(store: PostgresCollectorStore, client: { json: (url: string) => Promise<JsonResponse> }, runId: string, windows: { from: string; to: string }[], result: SenadoPresentedResult, progress: (m: string) => void) {
  for (const window of windows) {
    const done = (await store.query(`SELECT 1 FROM civica_poc.presented_window_checkpoints WHERE run_id=$1 AND source='senado' AND window_from=$2 AND window_to=$3 AND complete`, [runId, window.from, window.to])).rowCount;
    if (done) { result.windows++; continue; }
    result.requests++;
    const response = await client.json(`${API}/processo?dataInicioApresentacao=${window.from}&dataFimApresentacao=${window.to}`);
    const rows = Array.isArray(response.data) ? (response.data as Json[]) : [];
    await store.transaction(async tx => {
      for (const row of rows) {
        const parsed = parseSenadoIdentification(text(row.identificacao));
        await tx.query(`INSERT INTO civica_poc.presented_enumeration(run_id,source,external_id,type,number,identifier_year,window_from,window_to) VALUES($1,'senado',$2,$3,$4,$5,$6,$7) ON CONFLICT (run_id,source,external_id) DO NOTHING`,
          [runId, String(row.codigoMateria), parsed?.type ?? null, parsed?.number ?? null, parsed?.year ?? null, window.from, window.to]);
      }
      await tx.query(`INSERT INTO civica_poc.presented_window_checkpoints(run_id,source,window_from,window_to,last_page,complete,items) VALUES($1,'senado',$2,$3,1,true,$4) ON CONFLICT (run_id,source,window_from,window_to) DO UPDATE SET complete=true,items=excluded.items,updated_at=now()`, [runId, window.from, window.to, rows.length]);
    });
    // guarda o corpo da lista para a ingestão (evita pedir de novo)
    (result as any).__rows = [...((result as any).__rows ?? []), ...rows];
    result.windows++; progress(`senado apresentadas ${window.from}..${window.to}: ${rows.length}`);
  }
}

async function ingestEntity(store: PostgresCollectorStore, client: { json: (url: string) => Promise<JsonResponse> }, batch: string, row: Json, refresh: boolean, result: SenadoPresentedResult, authorsOnly = false) {
  const id = String(row.codigoMateria), parsed = parseSenadoIdentification(text(row.identificacao));
  if (!parsed) throw new Error(`identificação não reconhecida: ${String(row.identificacao)}`);
  const detail = await client.json(`${API}/processo/${row.id}`); result.requests++;
  const d = (detail.data ?? {}) as Json;
  if (String(d.codigoMateria ?? '') !== id) throw new Error(`código da matéria ${String(d.codigoMateria)} diverge de ${id}`);
  const label = text(row.identificacao)!, summary = text(row.ementa) ?? text((d.conteudo as Json | undefined)?.ementa), presentedAt = brasiliaTimestamp(text(row.dataApresentacao));
  const authors = senadoAuthors(d, text(row.autoria));
  const themes = jsonItems(d.classificacoes).map(c => ({ key: `theme:${id}:${text(c.codigo)}`, label: text(c.descricaoHierarquia) ?? text(c.descricao) })).filter(t => t.label);
  const existed = Boolean((await store.query(`SELECT 1 FROM civica_poc.proposals WHERE source='senado' AND batch_id=$1 AND external_id=$2`, [batch, id])).rowCount);
  if (existed && authorsOnly && !refresh) {
    let added = 0;
    await store.transaction(async (tx: PoolClient) => {
      for (const a of authors) {
        const present = a.personId ? await tx.query(`SELECT 1 FROM civica_poc.proposal_authors WHERE batch_id=$1 AND proposal_id=$2 AND person_external_id=$3`, [batch, id, a.personId]) : await tx.query(`SELECT 1 FROM civica_poc.proposal_authors WHERE batch_id=$1 AND proposal_id=$2 AND search_name=$3`, [batch, id, searchText(a.name!)]);
        if (present.rowCount) {
          // matéria/autor já existente: apenas completa o tipo do autor quando ainda não foi coletado
          await tx.query(a.personId ? `UPDATE civica_poc.proposal_authors SET author_kind=$4 WHERE batch_id=$1 AND proposal_id=$2 AND person_external_id=$3 AND author_kind IS NULL` : `UPDATE civica_poc.proposal_authors SET author_kind=$4 WHERE batch_id=$1 AND proposal_id=$2 AND search_name=$3 AND author_kind IS NULL`, [batch, id, a.personId ?? searchText(a.name!), a.kind]);
          continue;
        }
        await tx.query(`INSERT INTO civica_poc.proposal_authors(batch_id,source,proposal_id,author_key,person_external_id,name,party,uf,search_name,author_kind) VALUES($1,'senado',$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`, [batch, id, a.key, a.personId, a.name, a.party, a.uf, searchText(a.name!), a.kind]);
        added++;
      }
    });
    return { existed, added };
  }
  await store.transaction(async (tx: PoolClient) => {
    await tx.query(
      `INSERT INTO civica_poc.proposals(batch_id,source,external_id,type,number,year,functional_group,label,summary,presented_at,status,principal_id,payload,raw_id,search_label,search_summary,search_type,search_number)
       VALUES($1,'senado',$2,$3,$4,$5,$6,$7,$8,$9,NULL,NULL,NULL,$10,$11,$12,$13,$14)
       ON CONFLICT (batch_id,external_id) DO ${refresh ? 'UPDATE SET type=excluded.type,number=excluded.number,year=excluded.year,functional_group=excluded.functional_group,label=excluded.label,summary=excluded.summary,presented_at=excluded.presented_at,raw_id=excluded.raw_id,search_label=excluded.search_label,search_summary=excluded.search_summary,search_type=excluded.search_type,search_number=excluded.search_number' : 'NOTHING'}`,
      [batch, id, parsed.type, parsed.number, parsed.year, proposalFunctionalGroup(parsed.type), label, summary, presentedAt, detail.rawId, searchText(label), searchText(summary ?? ''), searchText(parsed.type), searchText(String(parsed.number ?? ''))]);
    await tx.query(`UPDATE civica_poc.proposals SET search_vector=setweight(to_tsvector('simple',coalesce(type||' '||number::text||coalesce('/'||year::text,''),'')),'A') || setweight(to_tsvector('portuguese',coalesce(label,'')),'B') || setweight(to_tsvector('portuguese',coalesce(summary,'')),'C') WHERE batch_id=$1 AND source='senado' AND external_id=$2`, [batch, id]);
    if (!existed || refresh) {
      await tx.query(`DELETE FROM civica_poc.proposal_authors WHERE batch_id=$1 AND proposal_id=$2`, [batch, id]);
      for (const a of authors) await tx.query(`INSERT INTO civica_poc.proposal_authors(batch_id,source,proposal_id,author_key,person_external_id,name,party,uf,search_name,author_kind) VALUES($1,'senado',$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`, [batch, id, a.key, a.personId, a.name, a.party, a.uf, searchText(a.name!), a.kind]);
      await tx.query(`DELETE FROM civica_poc.proposal_themes WHERE batch_id=$1 AND proposal_id=$2`, [batch, id]);
      for (const t of themes) await tx.query(`INSERT INTO civica_poc.proposal_themes(batch_id,source,proposal_id,theme_key,label) VALUES($1,'senado',$2,$3,$4) ON CONFLICT DO NOTHING`, [batch, id, t.key, t.label]);
    }
  });
  return { existed, added: 0 };
}

export async function collectSenadoPresentedPostgres(options: SenadoPresentedOptions = {}): Promise<SenadoPresentedResult> {
  const store = options.store ?? new PostgresCollectorStore(); const ownStore = !options.store, progress = options.progress ?? (() => {});
  const now = options.now?.() ?? new Date(), concurrency = Math.max(1, Math.min(6, options.concurrency ?? 4)), overlap = Math.max(0, options.overlapDays ?? DEFAULT_OVERLAP_DAYS);
  try {
    await store.assertTarget(); await ensureTemporalSchema(store.pool); await ensurePresentedSchema(store.pool);
    const batch = await activeBatch(store, 'senado');
    const last = (await store.query<{ range_to: string }>(`SELECT to_char(range_to,'YYYY-MM-DD') range_to FROM civica_poc.presented_coverage_runs WHERE source='senado' AND status='published' ORDER BY finished_at DESC LIMIT 1`)).rows[0];
    const to = options.to ?? brDay(now), from = options.from ?? (last ? addDays(last.range_to, -overlap) : PRESENTED_COLLECTION_START);
    const runId = options.runId ?? `presented:senado:${now.getTime()}`;
    const result: SenadoPresentedResult = { runId, rangeFrom: from, rangeTo: to, cutoffAt: now.toISOString(), windows: 0, requests: 0, officialCount: 0, newEntities: 0, inserted: 0, refreshed: 0, failed: 0, retried: 0, errors: [], reconciliation: undefined as unknown as PresentedReconciliation };
    await store.query(`INSERT INTO civica_poc.presented_coverage_runs(id,source,range_from,range_to,cutoff_at) VALUES($1,'senado',$2,$3,$4) ON CONFLICT (id) DO NOTHING`, [runId, from, to, now.toISOString()]);
    const ingestionRun = await store.startRun('senado', `pg:senado-presented:${now.getTime()}`);
    const client = options.clientFactory?.(ingestionRun, store) ?? new OfficialHttp({ source: 'senado', save: raw => store.saveRaw(ingestionRun, raw), timeoutMs: 40_000, maxAttempts: 4, delayMs: 200 });

    await enumerate(store, client, runId, monthWindows(from, to), result, progress);
    const listRows = new Map<string, Json>(((result as any).__rows ?? []).map((r: Json) => [String(r.codigoMateria), r]));
    delete (result as any).__rows;

    const targetsSql = `SELECT e.external_id FROM civica_poc.presented_enumeration e WHERE e.run_id=$1 AND e.source='senado' ${options.refresh || options.backfillAuthors ? '' : `AND NOT EXISTS (SELECT 1 FROM civica_poc.proposals p WHERE p.source='senado' AND p.batch_id=$2 AND p.external_id=e.external_id)`} ORDER BY e.external_id::bigint ${options.limit ? `LIMIT ${Math.max(1, Math.floor(options.limit))}` : ''}`;
    const targets = (await store.query<{ external_id: string }>(targetsSql, options.refresh || options.backfillAuthors ? [runId] : [runId, batch])).rows.map(r => r.external_id);
    result.newEntities = options.backfillAuthors ? targets.length : targets.length;
    if (options.ingest !== false) {
      for (let pass = 1; pass <= 2; pass++) {
        const pending = pass === 1 ? targets : result.errors.splice(0).map(e => e.id);
        if (pass === 2) { result.retried = pending.length; result.failed = 0; }
        let cursor = 0;
        const worker = async () => {
          while (cursor < pending.length) {
            const id = pending[cursor++]!;
            try { const row = listRows.get(id); if (!row) throw new Error('matéria ausente da lista desta execução'); const r = await ingestEntity(store, client, batch, row, Boolean(options.refresh), result, Boolean(options.backfillAuthors)); if (r.existed) { result.refreshed++; (result as any).authorsAdded = ((result as any).authorsAdded ?? 0) + r.added; } else result.inserted++; }
            catch (error) { result.failed++; if (result.errors.length < 100) result.errors.push({ id, error: (error instanceof Error ? error.message : String(error)).slice(0, 200) }); }
            if ((result.inserted + result.refreshed + result.failed) % 100 === 0) progress(`senado ingestão: ${result.inserted} novas, ${result.refreshed} atualizadas, ${result.failed} falhas`);
          }
        };
        if (pending.length) await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, worker));
        if (!result.errors.length) break;
      }
      await store.query(`UPDATE civica_poc.proposition_batches b SET proposal_count=(SELECT count(*) FROM civica_poc.proposals p WHERE p.batch_id=b.id),author_count=(SELECT count(*) FROM civica_poc.proposal_authors a WHERE a.batch_id=b.id),theme_count=(SELECT count(*) FROM civica_poc.proposal_themes t WHERE t.batch_id=b.id) WHERE b.id=$1`, [batch]);
    }
    result.reconciliation = await reconcilePresented(store, runId, from, to, 'senado');
    result.officialCount = result.reconciliation.officialCount;
    await store.query(`UPDATE civica_poc.presented_coverage_runs SET status='published',finished_at=now(),official_count=$2,catalog_count=$3,intersection_count=$4,only_official=$5,only_catalog=$6,date_divergent=$7,duplicate_external_ids=$8,requests=$9,details=$10 WHERE id=$1`,
      [runId, result.reconciliation.officialCount, result.reconciliation.catalogCount, result.reconciliation.intersection, result.reconciliation.onlyOfficial, result.reconciliation.onlyCatalog, result.reconciliation.dateDivergent, result.reconciliation.duplicateExternalIds, result.requests, JSON.stringify({ ...result, reconciliation: undefined, errors: result.errors.slice(0, 20), coverage: result.reconciliation.coverage, onlyOfficialSample: result.reconciliation.onlyOfficialSample, onlyCatalogSample: result.reconciliation.onlyCatalogSample })]);
    await store.query(`UPDATE civica.ingestion_runs SET finished_at=$1,status='published',expected_count=$2,roster_complete=1,reconciliation_json=$3 WHERE id=$4`, [new Date().toISOString(), result.officialCount, JSON.stringify({ scope: 'senado-presented', runId, ...result.reconciliation }), ingestionRun]);
    await store.query(`DELETE FROM civica_poc.presented_enumeration WHERE run_id NOT IN (SELECT id FROM (SELECT id,row_number() OVER (PARTITION BY source ORDER BY started_at DESC, id DESC) rn FROM civica_poc.presented_coverage_runs) x WHERE rn<=3)`);
    await store.query(`DELETE FROM civica_poc.presented_window_checkpoints WHERE run_id NOT IN (SELECT id FROM (SELECT id,row_number() OVER (PARTITION BY source ORDER BY started_at DESC, id DESC) rn FROM civica_poc.presented_coverage_runs) x WHERE rn<=3)`);
    return result;
  } finally { if (ownStore) await store.pool.end(); }
}
