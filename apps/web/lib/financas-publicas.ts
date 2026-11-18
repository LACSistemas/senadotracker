import { getFederalFinancas, getFederalFinancasHistory, type FederalFinancas, type FederalFinancasHistory } from '@senadotracker/db';
import { webPostgresPool } from './postgres-pool.ts';
import { memo } from './security/load.ts';

/** "Como estão as contas públicas do Brasil?" (só União, P14.46) — DCA anual: cacheado 1h, mesma
 * régua de `loadPublicDebtSeries`/`loadHdiGlobalComparison`. Top 6 funções + "Outras" (hub /executivo). */
export async function loadFederalFinancas(): Promise<FederalFinancas> {
  return memo('financas-publicas:federal', () => getFederalFinancas(webPostgresPool()), 60 * 60_000);
}
/** Versão "aprofundada" (/executivo/federal): todas as funções orçamentárias elegíveis, não top-6 —
 * cache em chave própria (parâmetro diferente), nunca reaproveita a fatia truncada do hub. */
export async function loadFederalFinancasDetailed(): Promise<FederalFinancas> {
  return memo('financas-publicas:federal-detailed', () => getFederalFinancas(webPostgresPool(), { functionTopN: 30 }), 60 * 60_000);
}
/** P14.48 — série 2014–2026 completa (não só o ano mais recente), com composição de receita e
 * resultado primário aproximado. Só `/executivo/federal` (aprofundamento); o hub continua em
 * `loadFederalFinancas`. Top-8 funções + "Outras" por ano (gráfico de participação, não tabela). */
export async function loadFederalFinancasHistory(): Promise<FederalFinancasHistory> {
  return memo('financas-publicas:federal-history', () => getFederalFinancasHistory(webPostgresPool(), { functionTopN: 8 }), 60 * 60_000);
}
