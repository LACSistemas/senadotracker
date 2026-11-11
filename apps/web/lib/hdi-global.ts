import { getHdiGlobalComparison, type HdiGlobalComparison } from '@senadotracker/db';
import { webPostgresPool } from './postgres-pool.ts';
import { memo } from './security/load.ts';

/** IDH Global (PNUD/ONU, via OWID): Brasil, América do Sul e Mundo, 1990 em diante — cacheado 1h (dado
 * anual publicado uma vez por ano pelo PNUD). PARALELO ao IDHM nacional (territory-idhm.ts,
 * PNUD/IPEA/FJP, decenal) — nunca a mesma série, nunca combinados num só gráfico. P14.13. */
export async function loadHdiGlobalComparison(): Promise<HdiGlobalComparison> {
  return memo('hdi-global', () => getHdiGlobalComparison(webPostgresPool()), 60 * 60_000);
}
