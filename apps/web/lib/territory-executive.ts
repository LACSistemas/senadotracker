import { getCurrentExecutive, getCurrentFederalExecutive, getCurrentMayor, getGdpPerCapita, getGdpPerCapitaForState, getTotalBudget, getTotalBudgetForState, type BudgetRankingRow, type CurrentExecutive, type CurrentFederalExecutive, type CurrentMayor, type GdpRankingRow } from '@senadotracker/db';
import { webPostgresPool } from './postgres-pool.ts';
import { memo } from './security/load.ts';

/** Governador/vice-governador eleito (TSE) + PIB per capita (IBGE/SIDRA) de uma UF, cacheados 5min. */
export async function loadCurrentExecutive(uf: string): Promise<CurrentExecutive | null> {
  return memo(`territory-executive:${uf.toUpperCase()}`, () => getCurrentExecutive(webPostgresPool(), uf), 5 * 60_000);
}

/** Presidente/vice-presidente eleito (TSE, uf='BR'), cacheado 5min. P14.13. */
export async function loadFederalExecutive(): Promise<CurrentFederalExecutive | null> {
  return memo('territory-executive:BR', () => getCurrentFederalExecutive(webPostgresPool()), 5 * 60_000);
}

/** Prefeito/vice-prefeito eleito (TSE, ciclo 2024) de um município pelo entity_id (IBGE7), cacheado 5min.
 * Alguns municípios não têm prefeito resolvido (DF, Fernando de Noronha, eleições anuladas sem
 * suplementar realizada ainda) — devolve null nesses casos. */
export async function loadCurrentMayor(entityId: number): Promise<CurrentMayor | null> {
  return memo(`territory-mayor:${entityId}`, () => getCurrentMayor(webPostgresPool(), entityId), 5 * 60_000);
}

export interface GdpPerCapitaPoint { year: number; value: number }
export async function loadGdpPerCapita(territory: { level: 'BRASIL' } | { level: 'UF'; ufCode: number } | { level: 'MUNICIPIO'; ibge7: string | number }): Promise<GdpPerCapitaPoint | null> {
  const key = territory.level === 'BRASIL' ? 'brasil' : territory.level === 'UF' ? `uf:${territory.ufCode}` : `mun:${territory.ibge7}`;
  return memo(`territory-gdp-per-capita:${key}`, async () => {
    const r = await getGdpPerCapita(webPostgresPool(), territory);
    return r ? { year: r.year, value: r.value } : null;
  }, 5 * 60_000);
}

/** PIB per capita de todos os municípios de uma UF numa única consulta (nunca N+1) — cacheado 5min, mesma
 * régua de `loadGdpPerCapita`. Usada só para achar o maior/menor do estado em `lib/territory-ranking.ts`. */
export async function loadGdpPerCapitaForState(ufCode: number): Promise<GdpRankingRow[]> {
  return memo(`territory-gdp-ranking:${ufCode}`, () => getGdpPerCapitaForState(webPostgresPool(), ufCode), 5 * 60_000);
}

export interface BudgetPoint { year: number; value: number }
/** "Orçamento do ano" (despesa total anual empenhada, Siconfi DCA Anexo I-E) de uma UF ou município, cacheado
 * 5min — mesma régua de `loadGdpPerCapita`. */
export async function loadTotalBudget(territory: { level: 'UF'; ufCode: number } | { level: 'MUNICIPIO'; ibge7: string | number }): Promise<BudgetPoint | null> {
  const key = territory.level === 'UF' ? `uf:${territory.ufCode}` : `mun:${territory.ibge7}`;
  return memo(`territory-budget:${key}`, () => getTotalBudget(webPostgresPool(), territory), 5 * 60_000);
}
/** Orçamento (ano mais recente de cada um) de todos os municípios de uma UF numa única consulta (nunca N+1) —
 * só para achar o maior orçamento do estado em `TerritoryKpiStrip`. */
export async function loadTotalBudgetForState(ufCode: number): Promise<BudgetRankingRow[]> {
  return memo(`territory-budget-ranking:${ufCode}`, () => getTotalBudgetForState(webPostgresPool(), ufCode), 5 * 60_000);
}
