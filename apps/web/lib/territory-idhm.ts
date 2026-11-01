import { getHdiSeries, type HdiSeries, type HdiTerritory } from '@senadotracker/db';
import { webPostgresPool } from './postgres-pool.ts';
import { memo } from './security/load.ts';

/** IDHM (PNUD/IPEA/FJP) de um território + de Brasil, para comparação — cacheado 1h (dado decenal,
 * nunca muda entre deploys). Só 1991/2000/2010: nunca tratar como série anual. */
export async function loadHdiComparison(territory: HdiTerritory): Promise<{ territory: HdiSeries | null; brasil: HdiSeries | null }> {
  const key = territory.level === 'BRASIL' ? 'BRASIL' : territory.level === 'UF' ? `uf:${territory.ufCode}` : `mun:${territory.ibge7}`;
  return memo(`territory-idhm:${key}`, async () => {
    const pool = webPostgresPool();
    const [territoryPoints, brasil] = await Promise.all([
      getHdiSeries(pool, territory),
      territory.level === 'BRASIL' ? Promise.resolve(null) : getHdiSeries(pool, { level: 'BRASIL' }),
    ]);
    return { territory: territoryPoints, brasil };
  }, 60 * 60_000);
}
