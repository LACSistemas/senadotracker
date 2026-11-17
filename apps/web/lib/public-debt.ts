import { getPublicDebtSeries, type PublicDebtSeries } from '@senadotracker/db';
import { webPostgresPool } from './postgres-pool.ts';
import { memo } from './security/load.ts';

/** Dívida pública — Dívida Bruta do Governo Geral (DBGG, % PIB), Banco Central SGS série 13762,
 * mensal — cacheado 1h (mesma régua de `loadHdiGlobalComparison`, dado mensal publicado uma vez). */
export async function loadPublicDebtSeries(): Promise<PublicDebtSeries> {
  return memo('public-debt:DBGG_PCT_GDP', () => getPublicDebtSeries(webPostgresPool()), 60 * 60_000);
}
