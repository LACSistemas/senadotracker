import { getTerritoryLegislativeComposition, type TerritoryLegislativeComposition } from '@senadotracker/db';
import { webPostgresPool } from './postgres-pool.ts';
import { memo } from './security/load.ts';

/** Composição legislativa de uma UF (Senado + Câmara + Assembleia/CLDF), cacheada 5min — a competência muda raramente. */
export async function loadTerritoryLegislativeComposition(uf: string): Promise<TerritoryLegislativeComposition> {
  return memo(`territory-legislative:${uf.toUpperCase()}`, () => getTerritoryLegislativeComposition(webPostgresPool(), uf), 5 * 60_000);
}
