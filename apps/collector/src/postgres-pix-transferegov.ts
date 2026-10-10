import { appendFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SourceRow, TransferegovTables } from '@senadotracker/db';

/**
 * Coleta do Transferegov — Transferências Especiais (PostgREST). Corpus completo por paginação determinística:
 * máximo de 1.000 linhas por requisição, `order=<PK>` e `offset`. A contagem oficial vem de `content-range` (Prefer: count=exact).
 * Não existe campo de alteração confiável: a estratégia é recarga completa + upsert idempotente.
 * O download é gravado em JSONL por tabela com `manifest.json` (checkpoint): uma coleta interrompida retoma tabela a tabela.
 */
export const TRANSFEREGOV_BASE = 'https://api.transferegov.gestao.gov.br/transferenciasespeciais';
export const PAGE_LIMIT = 1000;
export const TRANSFEREGOV_TABLES: ReadonlyArray<{ name: keyof TransferegovTables; order: string }> = [
  { name: 'programa_especial', order: 'id_programa' },
  { name: 'plano_acao_especial', order: 'id_plano_acao' },
  { name: 'empenho_especial', order: 'id_empenho' },
  { name: 'documento_habil_especial', order: 'id_dh' },
  { name: 'ordem_pagamento_ordem_bancaria_especial', order: 'id_op_ob' },
  { name: 'executor_especial', order: 'id_executor' },
  { name: 'plano_trabalho_especial', order: 'id_plano_trabalho' },
  { name: 'finalidade_especial', order: 'id_executor,cd_area_politica_publica_pt' },
  { name: 'relatorio_gestao_novo_especial', order: 'id_relatorio_gestao_novo' },
];

export interface TransferegovApi { count(table: string, order: string): Promise<number>; page(table: string, order: string, offset: number, limit: number): Promise<SourceRow[]> }
export interface HttpApiOptions { fetch?: typeof fetch; sleep?: (ms: number) => Promise<void>; delayMs?: number; maxAttempts?: number; base?: string; onRequest?: () => void }

export function httpTransferegovApi(options: HttpApiOptions = {}): TransferegovApi {
  const doFetch = options.fetch ?? fetch, sleep = options.sleep ?? (ms => new Promise(r => setTimeout(r, ms))), base = options.base ?? TRANSFEREGOV_BASE, attempts = options.maxAttempts ?? 6;
  const headers = { Accept: 'application/json', 'User-Agent': 'Civica/0.1 (official-data-research)' };
  async function request(url: string, extra: Record<string, string> = {}) {
    let last = '';
    for (let attempt = 1; attempt <= attempts; attempt++) {
      await sleep(options.delayMs ?? 200); options.onRequest?.();
      try {
        const response = await doFetch(url, { headers: { ...headers, ...extra }, redirect: 'error' });
        if (response.status === 200 || response.status === 206) return response;
        last = `HTTP ${response.status}`;
      } catch (error) { last = (error as Error).message; }
      await sleep(Math.min(30_000, 1000 * 2 ** attempt));
    }
    throw new Error(`Transferegov indisponível após ${attempts} tentativas: ${url} (${last})`);
  }
  return {
    async count(table, order) {
      const response = await request(`${base}/${table}?select=${order.split(',')[0]}&limit=1`, { Prefer: 'count=exact' });
      await response.arrayBuffer();
      const match = /\/(\d+)$/.exec(response.headers.get('content-range') ?? '');
      if (!match) throw new Error(`content-range ausente em ${table}`);
      return Number(match[1]);
    },
    async page(table, order, offset, limit) {
      const rows = await (await request(`${base}/${table}?order=${order}&limit=${limit}&offset=${offset}`)).json();
      if (!Array.isArray(rows)) throw new Error(`Resposta inesperada em ${table}`);
      return rows as SourceRow[];
    },
  };
}

export interface TableManifest { official: number; fetched: number; completedAt: string; requests: number }
export interface TransferegovManifest { runId: string; startedAt: string; tables: Record<string, TableManifest> }
export interface DownloadOptions { dir: string; runId: string; tables?: ReadonlyArray<{ name: string; order: string }>; pageLimit?: number; progress?: (message: string) => void; now?: () => Date }

const manifestPath = (dir: string) => resolve(dir, 'manifest.json');
export async function readManifest(dir: string): Promise<TransferegovManifest | null> { return existsSync(manifestPath(dir)) ? JSON.parse(await readFile(manifestPath(dir), 'utf8')) : null; }

/** Baixa (ou retoma) todas as tabelas. Confere linhas baixadas × contagem oficial; divergência persistente derruba a tabela. */
export async function downloadTransferegov(api: TransferegovApi, options: DownloadOptions): Promise<TransferegovManifest> {
  await mkdir(options.dir, { recursive: true });
  const now = options.now ?? (() => new Date()), limit = options.pageLimit ?? PAGE_LIMIT;
  let manifest = await readManifest(options.dir);
  if (!manifest || manifest.runId !== options.runId) manifest = { runId: options.runId, startedAt: now().toISOString(), tables: {} };
  for (const { name, order } of options.tables ?? TRANSFEREGOV_TABLES) {
    if (manifest.tables[name]) { options.progress?.(`${name}: já baixada (checkpoint)`); continue; }
    const file = resolve(options.dir, `${name}.jsonl`);
    let official = 0, fetched = 0, requests = 0;
    for (let round = 1; round <= 2; round++) {
      await rm(file, { force: true }); await writeFile(file, ''); fetched = 0; requests = 0;
      official = await api.count(name, order);
      for (let offset = 0; ; offset += limit) {
        const rows = await api.page(name, order, offset, limit); requests++;
        if (rows.length) await appendFile(file, rows.map(r => JSON.stringify(r)).join('\n') + '\n');
        fetched += rows.length;
        if (rows.length < limit) break;
      }
      if (fetched === official) break;
      options.progress?.(`${name}: ${fetched} baixadas × ${official} oficiais (rodada ${round})`);
      if (round === 2) throw new Error(`Divergência persistente em ${name}: baixadas=${fetched} oficiais=${official}`);
    }
    manifest.tables[name] = { official, fetched, completedAt: now().toISOString(), requests };
    await writeFile(manifestPath(options.dir), JSON.stringify(manifest, null, 1));
    options.progress?.(`${name}: ${fetched}/${official}`);
  }
  return manifest;
}

export async function readTransferegovTables(dir: string): Promise<TransferegovTables> {
  const out: Record<string, SourceRow[]> = {};
  for (const { name } of TRANSFEREGOV_TABLES) {
    const text = await readFile(resolve(dir, `${name}.jsonl`), 'utf8');
    out[name] = text ? text.split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
  }
  return out as unknown as TransferegovTables;
}
