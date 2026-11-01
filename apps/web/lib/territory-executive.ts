import { getCurrentExecutive, getCurrentMayor, getGdpPerCapita, type CurrentExecutive, type CurrentMayor } from '@senadotracker/db';
import { webPostgresPool } from './postgres-pool.ts';
import { memo } from './security/load.ts';

/** Governador/vice-governador eleito (TSE) + PIB per capita (IBGE/SIDRA) de uma UF, cacheados 5min. */
export async function loadCurrentExecutive(uf: string): Promise<CurrentExecutive | null> {
  return memo(`territory-executive:${uf.toUpperCase()}`, () => getCurrentExecutive(webPostgresPool(), uf), 5 * 60_000);
}

/** Prefeito/vice-prefeito eleito (TSE, ciclo 2024) de um município pelo entity_id (IBGE7), cacheado 5min.
 * Alguns municípios não têm prefeito resolvido (DF, Fernando de Noronha, eleições anuladas sem
 * suplementar realizada ainda) — devolve null nesses casos. */
export async function loadCurrentMayor(entityId: number): Promise<CurrentMayor | null> {
  return memo(`territory-mayor:${entityId}`, () => getCurrentMayor(webPostgresPool(), entityId), 5 * 60_000);
}

export interface GdpPerCapitaPoint { year: number; value: number }
export async function loadGdpPerCapita(territory: { level: 'UF'; ufCode: number } | { level: 'MUNICIPIO'; ibge7: string | number }): Promise<GdpPerCapitaPoint | null> {
  const key = territory.level === 'UF' ? `uf:${territory.ufCode}` : `mun:${territory.ibge7}`;
  return memo(`territory-gdp-per-capita:${key}`, async () => {
    const r = await getGdpPerCapita(webPostgresPool(), territory);
    return r ? { year: r.year, value: r.value } : null;
  }, 5 * 60_000);
}
