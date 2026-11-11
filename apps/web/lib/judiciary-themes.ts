import {
  getJudiciaryThemesCatalog, getJudiciaryThemeOverview, getJudiciaryThemeIndicators, getJudiciaryThemeHistoricalSeries,
  getJudiciaryThemeByTribunal, getJudiciaryThemeComparators, getJudiciaryThemeSources, getJudiciaryStjPrecedentsByTheme,
  type JudiciaryThemeId, type ThemeFilters,
} from '@senadotracker/db';
import { webPostgresPool } from './postgres-pool.ts';
import { memo } from './security/load.ts';

/** P14.8 — wrappers finos sobre `postgres-judiciary-themes.ts` (P14.7-R), mesmo padrão de `judiciary.ts`.
 * O serving já resolve `canonical_theme` por `semanticTheme`/provenance — nunca por prefixo do ID — então
 * esta camada nunca precisa (e nunca deve) reclassificar nada; só repassa e cacheia. */
const TTL = 5 * 60_000;

export async function loadJudiciaryThemesCatalog() {
  return memo('jud-themes-catalog', () => getJudiciaryThemesCatalog(webPostgresPool()), TTL);
}
export async function loadJudiciaryThemeOverview(themeId: JudiciaryThemeId, filters: ThemeFilters = {}) {
  return memo(`jud-theme-overview:${themeId}:${JSON.stringify(filters)}`, () => getJudiciaryThemeOverview(webPostgresPool(), themeId, filters), TTL);
}
export async function loadJudiciaryThemeIndicators(themeId: JudiciaryThemeId, filters: ThemeFilters = {}) {
  return memo(`jud-theme-indicators:${themeId}:${JSON.stringify(filters)}`, () => getJudiciaryThemeIndicators(webPostgresPool(), themeId, filters), TTL);
}
export async function loadJudiciaryThemeByTribunal(themeId: JudiciaryThemeId, tribunalId: string, year = 2025) {
  return memo(`jud-theme-by-tribunal:${themeId}:${tribunalId}:${year}`, () => getJudiciaryThemeByTribunal(webPostgresPool(), themeId, tribunalId, year), TTL);
}
export async function loadJudiciaryThemeHistoricalSeries(themeId: JudiciaryThemeId, indicatorId: string, tribunalId?: string) {
  return memo(`jud-theme-series:${themeId}:${indicatorId}:${tribunalId ?? 'all'}`, () => getJudiciaryThemeHistoricalSeries(webPostgresPool(), themeId, indicatorId, tribunalId), TTL);
}
export async function loadJudiciaryThemeComparators(themeId: JudiciaryThemeId, indicatorId: string, year: number, tribunalIds: string[] = []) {
  return memo(`jud-theme-comparators:${themeId}:${indicatorId}:${year}:${[...tribunalIds].sort().join(',')}`, () => getJudiciaryThemeComparators(webPostgresPool(), themeId, indicatorId, year, tribunalIds), TTL);
}
export async function loadJudiciaryThemeSources(themeId?: JudiciaryThemeId) {
  return memo(`jud-theme-sources:${themeId ?? 'all'}`, () => getJudiciaryThemeSources(webPostgresPool(), themeId), TTL);
}
export async function loadJudiciaryStjPrecedentsByTheme(themeId: JudiciaryThemeId, filters: { status?: string; type?: string; year?: number; page?: number; pageSize?: number } = {}) {
  return memo(`jud-theme-stj:${themeId}:${JSON.stringify(filters)}`, () => getJudiciaryStjPrecedentsByTheme(webPostgresPool(), themeId, filters), TTL);
}
export type { JudiciaryThemeId };
