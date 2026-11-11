import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { openPool } from './db.ts';

/** P14.11 — jurisprudência geral do STF (acórdãos + decisões monocráticas), achada por investigação de
 * schema real (ver postgres-judiciary-stf-jurisprudencia.ts). A busca (`jurisprudencia.stf.jus.br/api/
 * search/search`, Elasticsearch) nunca deixa acessar o registro 10.000 de uma busca (`"O maior registro
 * que pode ser acessado... é o de número 10000"`, confirmado real) — pra coletar os 372.583 acórdãos e
 * 759.958 decisões desde 1892 é preciso janelar por ano (anos com <=9500 docs) ou por mês (anos maiores,
 * a maioria desde ~2001), confirmado por agregação real que nenhum mês ultrapassa a janela segura.
 *
 * Escopo de banco deliberadamente enxuto (combinado com o usuário): o JSON bruto de CADA janela, com
 * `inteiro_teor_texto`/`decisao_texto` completos, vai só pro arquivo em D:\Civica — nunca no Postgres. O
 * Postgres recebe metadados + `ementa_texto` completo (acórdãos) + um resumo truncado (decisões, cujo
 * único campo de conteúdo é grande). Isso é o que mantém o crescimento do banco abaixo de 1GB.
 *
 * Resumível por desenho: cada janela só é considerada "buscada" quando seu arquivo final existe (escrita
 * atômica via arquivo .tmp + rename); se o processo for interrompido, rodar de novo pula janelas já
 * completas e só refaz o upsert (idempotente) a partir do arquivo já salvo — nenhuma requisição repetida
 * sem necessidade. A revisão de publicação só é ativada no fim, depois de TODAS as janelas de AMBAS as
 * bases — uma coleta parcial nunca fica visível como se fosse a edição completa. */
const RAW_DIR = 'D:/Civica/judiciario/stf-jurisprudencia';
const SEARCH_URL = 'https://jurisprudencia.stf.jus.br/api/search/search';
const USER_AGENT = 'civica-jud/1.0 (pesquisa de dados abertos)';
const EDITION_DATE = new Date().toISOString().slice(0, 10);
const REVISION = `p152-stf-juris-${EDITION_DATE.replaceAll('-', '')}`;
const BASELINE = 34_715_438_227;
const MAX_GROWTH = 1_100_000_000; // ~1.1GB — teto combinado com o usuário (~1GB) com uma margem pequena
const SAFE_WINDOW = 9500; // < 10000 (teto real do ES), com margem de segurança
const PAGE_SIZE = 200;
const DELAY_MS = 150;
const MIN_YEAR = Number(process.env.P152_MIN_YEAR ?? 1890);
const MAX_YEAR = new Date().getFullYear();
const pool = openPool(3);

const sha256 = (b: Buffer | string) => crypto.createHash('sha256').update(b).digest('hex');
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

async function postSearch(body: unknown, tries = 4): Promise<any> {
  let last: unknown;
  for (let n = 1; n <= tries; n++) {
    try {
      const r = await fetch(SEARCH_URL, {
        method: 'POST',
        headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/json', Origin: 'https://jurisprudencia.stf.jus.br' },
        body: JSON.stringify(body),
      });
      if (r.status !== 200) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
      return await r.json();
    } catch (e) { last = e; await sleep(800 * n); }
  }
  throw new Error(`falha na busca STF: ${last instanceof Error ? last.message : String(last)}`);
}

const rangeFilter = (gte: string, lte: string) => ({ range: { julgamento_data: { gte, lte, format: 'yyyy-MM-dd' } } });
// `post_filter` filtra HITS mas, por desenho do Elasticsearch, NUNCA as agregações (é calculado depois
// delas) — achado real (bug próprio, não documentado em nenhum README): as duas primeiras rodadas de
// teste deram o MESMO total pras duas bases porque o filtro de `base` ficava só no post_filter dos
// histogramas de planejamento. Pra CONTAR (planejar janelas) o filtro de base tem que ir dentro do
// `query.bool.filter`; pra BUSCAR de fato (fetchWindowHits), post_filter já funciona corretamente — não
// precisa mudar lá, e os dados já coletados nesta sessão de teste são válidos (vieram da busca, não do
// histograma).
const baseQuery = (base: string, extraFilters: unknown[] = []) => ({
  query: { function_score: { query: { bool: { filter: [{ query_string: { query: '*' } }, ...extraFilters] } } } },
  post_filter: { bool: { must: [{ term: { base } }] } },
});
const aggQuery = (base: string, extraFilters: unknown[] = []) => ({
  query: { function_score: { query: { bool: { filter: [{ query_string: { query: '*' } }, { term: { base } }, ...extraFilters] } } } },
});

async function yearHistogram(base: string): Promise<Map<number, number>> {
  const body = { ...aggQuery(base), size: 0, from: 0, aggs: { buckets: { date_histogram: { field: 'julgamento_data', calendar_interval: 'year', format: 'yyyy' } } } };
  const r = await postSearch(body);
  const map = new Map<number, number>();
  for (const b of r.result.aggregations.buckets.buckets as Array<{ key_as_string: string; doc_count: number }>) {
    const y = Number(b.key_as_string);
    if (b.doc_count > 0 && y >= MIN_YEAR && y <= MAX_YEAR) map.set(y, b.doc_count);
  }
  return map;
}

async function monthHistogram(base: string, year: number): Promise<Map<number, number>> {
  const body = { ...aggQuery(base, [rangeFilter(`${year}-01-01`, `${year}-12-31`)]), size: 0, from: 0, aggs: { buckets: { date_histogram: { field: 'julgamento_data', calendar_interval: 'month', format: 'yyyy-MM' } } } };
  const r = await postSearch(body);
  const map = new Map<number, number>();
  for (const b of r.result.aggregations.buckets.buckets as Array<{ key_as_string: string; doc_count: number }>) {
    const m = Number(b.key_as_string.slice(5, 7));
    if (b.doc_count > 0) map.set(m, b.doc_count);
  }
  return map;
}

type Win = { key: string; gte: string; lte: string; count: number };
async function buildWindows(base: string): Promise<Win[]> {
  const years = await yearHistogram(base);
  await sleep(DELAY_MS);
  const windows: Win[] = [];
  for (const [year, count] of [...years.entries()].sort((a, b) => a[0] - b[0])) {
    if (count <= SAFE_WINDOW) {
      windows.push({ key: `${year}`, gte: `${year}-01-01`, lte: `${year}-12-31`, count });
      continue;
    }
    const months = await monthHistogram(base, year);
    await sleep(DELAY_MS);
    for (const [month, mCount] of [...months.entries()].sort((a, b) => a[0] - b[0])) {
      if (mCount > SAFE_WINDOW) throw new Error(`COLLECTION_GRANULARITY_INSUFFICIENT: ${base} ${year}-${month} tem ${mCount} docs, acima da janela segura de ${SAFE_WINDOW}`);
      const mm = String(month).padStart(2, '0');
      const lastDay = new Date(year, month, 0).getDate();
      windows.push({ key: `${year}-${mm}`, gte: `${year}-${mm}-01`, lte: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`, count: mCount });
    }
  }
  return windows;
}

async function fetchWindowHits(base: string, win: Win): Promise<any[]> {
  const hits: any[] = [];
  for (let from = 0; from < win.count; from += PAGE_SIZE) {
    const size = Math.min(PAGE_SIZE, win.count - from);
    const body = { ...baseQuery(base, [rangeFilter(win.gte, win.lte)]), size, from, sort: [{ julgamento_data: 'asc' }] };
    const r = await postSearch(body);
    hits.push(...r.result.hits.hits);
    await sleep(DELAY_MS);
  }
  return hits;
}

const nullable = (v: unknown) => (v == null || v === '') ? null : String(v);
function parseAcordaoRow(h: any): Record<string, unknown> {
  const s = h._source;
  return {
    doc_id: s.id, processo_codigo_completo: nullable(s.processo_codigo_completo), processo_numero: s.processo_numero ?? null,
    classe_sigla: nullable(s.processo_classe_processual_unificada_sigla), uf_sigla: nullable(s.procedencia_geografica_uf_sigla),
    relator_nome: nullable(s.relator_processo_nome), orgao_julgador: nullable(s.orgao_julgador), is_repercussao_geral: s.is_repercussao_geral ?? null,
    julgamento_data: nullable(s.julgamento_data), publicacao_data: nullable(s.publicacao_data),
    ementa_texto: nullable(s.ementa_texto), inteiro_teor_url: nullable(s.inteiro_teor_url), dje_url: nullable(s.dje_url),
    raw_row_hash: sha256(JSON.stringify(s)),
  };
}
function parseDecisaoRow(h: any): Record<string, unknown> {
  const s = h._source;
  return {
    doc_id: s.id, processo_codigo_completo: nullable(s.processo_codigo_completo), processo_numero: s.processo_numero ?? null,
    classe_sigla: nullable(s.processo_classe_processual_unificada_sigla), uf_sigla: nullable(s.procedencia_geografica_uf_sigla),
    relator_nome: nullable(s.relator_processo_nome), is_decisao_presidencia: s.is_decisao_presidencia ?? null,
    julgamento_data: nullable(s.julgamento_data), publicacao_data: nullable(s.publicacao_data),
    decisao_resumo: s.decisao_texto ? String(s.decisao_texto).slice(0, 300) : null,
    inteiro_teor_url: nullable(s.inteiro_teor_url), dje_url: nullable(s.dje_url),
    raw_row_hash: sha256(JSON.stringify(s)),
  };
}

async function upsertAcordaos(rows: Record<string, unknown>[], snapshotId: string) {
  if (!rows.length) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const r of rows) {
      await client.query(
        `INSERT INTO civica_jud.jud_stf_jurisprudencia_acordao(doc_id,publication_revision_id,processo_codigo_completo,processo_numero,classe_sigla,uf_sigla,relator_nome,orgao_julgador,is_repercussao_geral,julgamento_data,publicacao_data,ementa_texto,inteiro_teor_url,dje_url,source_snapshot_id,raw_row_hash,provenance)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'{}'::jsonb)
         ON CONFLICT(doc_id,publication_revision_id) DO UPDATE SET processo_codigo_completo=EXCLUDED.processo_codigo_completo,processo_numero=EXCLUDED.processo_numero,classe_sigla=EXCLUDED.classe_sigla,uf_sigla=EXCLUDED.uf_sigla,relator_nome=EXCLUDED.relator_nome,orgao_julgador=EXCLUDED.orgao_julgador,is_repercussao_geral=EXCLUDED.is_repercussao_geral,julgamento_data=EXCLUDED.julgamento_data,publicacao_data=EXCLUDED.publicacao_data,ementa_texto=EXCLUDED.ementa_texto,inteiro_teor_url=EXCLUDED.inteiro_teor_url,dje_url=EXCLUDED.dje_url,raw_row_hash=EXCLUDED.raw_row_hash
         WHERE civica_jud.jud_stf_jurisprudencia_acordao.raw_row_hash IS DISTINCT FROM EXCLUDED.raw_row_hash`,
        [r.doc_id, REVISION, r.processo_codigo_completo, r.processo_numero, r.classe_sigla, r.uf_sigla, r.relator_nome, r.orgao_julgador, r.is_repercussao_geral, r.julgamento_data, r.publicacao_data, r.ementa_texto, r.inteiro_teor_url, r.dje_url, snapshotId, r.raw_row_hash],
      );
    }
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}
async function upsertDecisoes(rows: Record<string, unknown>[], snapshotId: string) {
  if (!rows.length) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const r of rows) {
      await client.query(
        `INSERT INTO civica_jud.jud_stf_jurisprudencia_decisao(doc_id,publication_revision_id,processo_codigo_completo,processo_numero,classe_sigla,uf_sigla,relator_nome,is_decisao_presidencia,julgamento_data,publicacao_data,decisao_resumo,inteiro_teor_url,dje_url,source_snapshot_id,raw_row_hash,provenance)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'{}'::jsonb)
         ON CONFLICT(doc_id,publication_revision_id) DO UPDATE SET processo_codigo_completo=EXCLUDED.processo_codigo_completo,processo_numero=EXCLUDED.processo_numero,classe_sigla=EXCLUDED.classe_sigla,uf_sigla=EXCLUDED.uf_sigla,relator_nome=EXCLUDED.relator_nome,is_decisao_presidencia=EXCLUDED.is_decisao_presidencia,julgamento_data=EXCLUDED.julgamento_data,publicacao_data=EXCLUDED.publicacao_data,decisao_resumo=EXCLUDED.decisao_resumo,inteiro_teor_url=EXCLUDED.inteiro_teor_url,dje_url=EXCLUDED.dje_url,raw_row_hash=EXCLUDED.raw_row_hash
         WHERE civica_jud.jud_stf_jurisprudencia_decisao.raw_row_hash IS DISTINCT FROM EXCLUDED.raw_row_hash`,
        [r.doc_id, REVISION, r.processo_codigo_completo, r.processo_numero, r.classe_sigla, r.uf_sigla, r.relator_nome, r.is_decisao_presidencia, r.julgamento_data, r.publicacao_data, r.decisao_resumo, r.inteiro_teor_url, r.dje_url, snapshotId, r.raw_row_hash],
      );
    }
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

async function registerSnapshot(resourceName: string, sourceUrl: string, win: Win, bytes: number, hash: string, rawPath: string, parsedRows: number) {
  const snapshotId = `STF:JUR:SNAP:${sha256(`${resourceName}:${win.key}`).slice(0, 48)}`;
  await pool.query(
    `INSERT INTO civica_jud.jud_source_snapshot(snapshot_id,provider,resource_name,source_url,fetched_at,http_status,content_type,bytes,sha256,raw_path,parser_version,source_rows,parsed_rows,rejected_rows,duplicate_rows,status,details)
     VALUES($1,'STF',$2,$3,$4,200,'application/json',$5,$6,$7,'p14.11-v1',$8,$8,0,0,'COMPLETE',$9)
     ON CONFLICT(snapshot_id) DO UPDATE SET fetched_at=EXCLUDED.fetched_at,bytes=EXCLUDED.bytes,sha256=EXCLUDED.sha256,parsed_rows=EXCLUDED.parsed_rows WHERE civica_jud.jud_source_snapshot.sha256 IS DISTINCT FROM EXCLUDED.sha256`,
    [snapshotId, resourceName, sourceUrl, new Date().toISOString(), bytes, hash, rawPath, parsedRows, JSON.stringify({ window: win.key, gte: win.gte, lte: win.lte, count: win.count })],
  );
  return snapshotId;
}

async function checkBudget(before: number) {
  const now = Number((await pool.query<{ bytes: string }>('SELECT pg_database_size(current_database())::text bytes')).rows[0]?.bytes ?? 0);
  const growth = now - before;
  if (growth > MAX_GROWTH) throw new Error(`DB_BUDGET_GATE failed mid-run: growth=${growth} > ${MAX_GROWTH}`);
  return { now, growth };
}

try {
  const db = (await pool.query<{ current_database: string }>('SELECT current_database()')).rows[0]?.current_database;
  if (db !== 'projetoeleitor_db') throw new Error(`DATABASE_GUARD failed: ${db}`);
  const before = Number((await pool.query<{ bytes: string }>('SELECT pg_database_size(current_database())::text bytes')).rows[0]?.bytes ?? 0);

  const totals = { acordaos: 0, decisoes: 0, windowsDone: 0, windowsSkippedRefetch: 0 };
  const BASES: Array<{ base: 'acordaos' | 'decisoes'; resourceName: string; dir: string; parse: (h: any) => Record<string, unknown>; upsert: (rows: Record<string, unknown>[], snapshotId: string) => Promise<void> }> = [
    { base: 'acordaos', resourceName: 'jurisprudencia-acordaos', dir: path.join(RAW_DIR, 'acordaos'), parse: parseAcordaoRow, upsert: upsertAcordaos },
    { base: 'decisoes', resourceName: 'jurisprudencia-decisoes', dir: path.join(RAW_DIR, 'decisoes'), parse: parseDecisaoRow, upsert: upsertDecisoes },
  ];

  for (const { base, resourceName, dir, parse, upsert } of BASES) {
    await fs.mkdir(dir, { recursive: true });
    console.log(JSON.stringify({ phase: 'windows', base }));
    const windows = await buildWindows(base);
    console.log(JSON.stringify({ phase: 'windows_built', base, windowCount: windows.length, totalDocs: windows.reduce((a, w) => a + w.count, 0) }));

    for (const win of windows) {
      const finalPath = path.join(dir, `${win.key}.json`);
      let hits: any[];
      let raw: Buffer;
      let refetched = false;
      try {
        raw = await fs.readFile(finalPath);
        hits = JSON.parse(raw.toString('utf8'));
        totals.windowsSkippedRefetch++;
      } catch {
        hits = await fetchWindowHits(base, win);
        raw = Buffer.from(JSON.stringify(hits));
        const tmpPath = `${finalPath}.tmp`;
        await fs.writeFile(tmpPath, raw);
        await fs.rename(tmpPath, finalPath);
        refetched = true;
      }
      const rows = hits.map(parse);
      const snapshotId = await registerSnapshot(resourceName, SEARCH_URL, win, raw.length, sha256(raw), finalPath, rows.length);
      await upsert(rows, snapshotId);
      if (base === 'acordaos') totals.acordaos += rows.length; else totals.decisoes += rows.length;
      totals.windowsDone++;
      console.log(JSON.stringify({ phase: 'window_done', base, window: win.key, rows: rows.length, refetched, cumulativeAcordaos: totals.acordaos, cumulativeDecisoes: totals.decisoes }));
      if (totals.windowsDone % 25 === 0) {
        const { growth } = await checkBudget(before);
        console.log(JSON.stringify({ phase: 'budget_check', windowsDone: totals.windowsDone, dbGrowth: growth, dbRemaining: MAX_GROWTH - growth }));
      }
      if (refetched) await sleep(DELAY_MS);
    }
  }

  const semantic = sha256(`${totals.acordaos}:${totals.decisoes}:${REVISION}`);
  const rowCount = totals.acordaos + totals.decisoes;
  await pool.query(
    `INSERT INTO civica_jud.jud_publication_revision(revision_id,scope,snapshot_ids,semantic_hash,row_count,state,is_active,last_known_good,previous_revision_id,created_at,activated_at,provenance)
     VALUES($1,'STF_JURISPRUDENCIA_GERAL','[]'::jsonb,$2,$3,'ACTIVE',true,true,(SELECT revision_id FROM civica_jud.jud_publication_revision WHERE scope='STF_JURISPRUDENCIA_GERAL' AND is_active=true AND revision_id<>$1 ORDER BY created_at DESC LIMIT 1),$4,$4,$5)
     ON CONFLICT(revision_id) DO UPDATE SET semantic_hash=EXCLUDED.semantic_hash,row_count=EXCLUDED.row_count,state='ACTIVE',is_active=true,last_known_good=true,activated_at=EXCLUDED.activated_at
     WHERE civica_jud.jud_publication_revision.semantic_hash IS DISTINCT FROM EXCLUDED.semantic_hash OR civica_jud.jud_publication_revision.is_active IS DISTINCT FROM true`,
    [REVISION, semantic, rowCount, new Date().toISOString(), JSON.stringify(totals)],
  );
  await pool.query(`UPDATE civica_jud.jud_publication_revision SET is_active=false WHERE scope='STF_JURISPRUDENCIA_GERAL' AND revision_id<>$1`, [REVISION]);

  const { now: after, growth } = await checkBudget(before);
  console.log(JSON.stringify({ database: db, revision: REVISION, ...totals, dbBefore: before, dbAfter: after, dbGrowth: growth, dbRemaining: MAX_GROWTH - growth }, null, 2));
} catch (error) { console.error(error); process.exitCode = 1; } finally { await pool.end(); }
