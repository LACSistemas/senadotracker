import type { Pool } from 'pg';
import { collectPaged, type Log, type PagedResult, type PagedSpec } from './raw-paged.ts';
import type { StorageConfig } from './storage.ts';

/**
 * Obrasgov (Cadastro Integrado de Projetos de Investimento, api.obrasgov.gestao.gov.br): coleta RAW de projetos (por UF × situação), execução física (lista nacional) e execução financeira
 * (empenhos, lista nacional). A API é lenta (dezenas de segundos por página) e a paginação de projetos informa total errado: lê-se até a primeira página vazia e as falhas ficam registradas.
 */
export const OBRAS_API = 'https://api.obrasgov.gestao.gov.br/obrasgov/api';
export const OBRAS_DATASET = 'edu_obras';
export const OBRAS_UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];
/** Situações observadas (lista de projetos do ES e da execução física nacional); novas situações encontradas na execução física entram na recoleta. */
export const OBRAS_SITUACOES = ['Cadastrada', 'Em execução', 'Concluída', 'Paralisada', 'Cancelada', 'Inativada'];
const countOf = (b: string): number => { const j = JSON.parse(b) as { content?: unknown[] }; if (!Array.isArray(j.content)) throw new Error('sem content'); return j.content.length; };
const totalOf = (b: string): number | null => { const j = JSON.parse(b) as { totalPages?: number }; return Number.isInteger(j.totalPages) ? j.totalPages! : null; };
export const obrasFisicaSpec = (size = 100): PagedSpec => ({ rel: 'obrasgov/execucao-fisica/nacional.jsonl.gz', sourceUrl: `${OBRAS_API}/execucao-fisica?pagina=<n>&tamanhoDaPagina=${size}`, dataset: OBRAS_DATASET, firstPage: 0, url: p => `${OBRAS_API}/execucao-fisica?pagina=${p}&tamanhoDaPagina=${size}`, count: countOf, total: totalOf });
export const obrasFinanceiraSpec = (size = 25): PagedSpec => ({ rel: 'obrasgov/execucao-financeira/nacional.jsonl.gz', sourceUrl: `${OBRAS_API}/execucao-financeira?pagina=<n>&tamanhoDaPagina=${size}`, dataset: OBRAS_DATASET, firstPage: 0, url: p => `${OBRAS_API}/execucao-financeira?pagina=${p}&tamanhoDaPagina=${size}`, count: countOf, total: totalOf });
export const obrasProjetosSpec = (uf: string, situacao: string, size = 50): PagedSpec => ({
  rel: `obrasgov/projetos/${uf}/${situacao.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_').toLowerCase()}.jsonl.gz`, sourceUrl: `${OBRAS_API}/projeto-investimento?uf=${uf}&situacao=${situacao}&pagina=<n>&tamanhoDaPagina=${size}`, dataset: OBRAS_DATASET, firstPage: 0,
  url: p => `${OBRAS_API}/projeto-investimento?uf=${uf}&situacao=${encodeURIComponent(situacao)}&pagina=${p}&tamanhoDaPagina=${size}`, count: countOf,
});
export async function collectObrasFisica(pool: Pool | null, cfg: StorageConfig, o: { concurrency?: number; log?: Log } = {}): Promise<PagedResult> { return collectPaged(pool, cfg, obrasFisicaSpec(), { concurrency: o.concurrency ?? 3, timeoutMs: 280_000, tries: 8, ...(o.log ? { log: o.log } : {}) }); }
export async function collectObrasFinanceira(pool: Pool | null, cfg: StorageConfig, o: { concurrency?: number; log?: Log } = {}): Promise<PagedResult> { return collectPaged(pool, cfg, obrasFinanceiraSpec(), { concurrency: o.concurrency ?? 3, timeoutMs: 280_000, tries: 8, ...(o.log ? { log: o.log } : {}) }); }
/** Partições UF × situação, `parallel` partições ao mesmo tempo (cada uma lê suas páginas em sequência). */
export async function collectObrasProjetos(pool: Pool | null, cfg: StorageConfig, ufs: string[], situacoes: string[], o: { parallel?: number; log?: Log } = {}): Promise<PagedResult[]> {
  const queue = ufs.flatMap(uf => situacoes.map(s => ({ uf, s }))); const out: PagedResult[] = [];
  const runner = async () => { for (;;) { const x = queue.shift(); if (!x) return; out.push(await collectPaged(pool, cfg, obrasProjetosSpec(x.uf, x.s), { concurrency: 1, timeoutMs: 280_000, tries: 8, ...(o.log ? { log: o.log } : {}) })); } };
  await Promise.all(Array.from({ length: o.parallel ?? 4 }, runner)); return out;
}
