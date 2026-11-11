import { createHash } from 'node:crypto';
import type { Pool } from 'pg';

/**
 * P14.13: IDH Global (PNUD, Human Development Report), via espelho público da Our World in Data —
 * Brasil, média da América do Sul e média mundial, 1990 em diante. Confirmado ao vivo: a OWID já calcula
 * "South America"/"World" como entidades próprias, sem precisar aproximar com "América Latina e Caribe"
 * nem recalcular médias aqui. PARALELO ao IDHM nacional (civica_exec.exec_idhm_territory, PNUD/IPEA/FJP,
 * decenal 1991/2000/2010) — metodologia diferente, nunca tratar como a mesma série.
 */
const HDI_URL = 'https://ourworldindata.org/grapher/human-development-index.csv';
const USER_AGENT = 'Civica/0.1 (official-data-research; hdi-global)';
const ENTITY_MAP: Record<string, 'BRASIL' | 'AMERICA_DO_SUL' | 'MUNDO'> = { Brazil: 'BRASIL', 'South America': 'AMERICA_DO_SUL', World: 'MUNDO' };

export interface HdiGlobalPoint { entity: 'BRASIL' | 'AMERICA_DO_SUL' | 'MUNDO'; year: number; hdi: number; sourceHash: Buffer }

/** Busca e filtra o CSV da OWID — só as 3 entidades que importam (Brasil, América do Sul, Mundo); o CSV
 * completo tem ~6.000 linhas (todos os países do mundo), descartadas aqui, nunca gravadas no Postgres. */
export async function fetchHdiGlobal(url = HDI_URL): Promise<HdiGlobalPoint[]> {
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ao buscar ${url}`);
  const lines = (await res.text()).trim().split('\n').map(l => l.split(','));
  const header = lines[0];
  if (!header) throw new Error(`CSV de HDI vazio: ${url}`);
  const entityIdx = header.indexOf('Entity'), yearIdx = header.indexOf('Year'), hdiIdx = header.indexOf('Human Development Index');
  if (entityIdx < 0 || yearIdx < 0 || hdiIdx < 0) throw new Error(`Colunas inesperadas no CSV de HDI: ${header.join(',')}`);
  const out: HdiGlobalPoint[] = [];
  for (const row of lines.slice(1)) {
    const entity = ENTITY_MAP[row[entityIdx] ?? ''];
    if (!entity) continue;
    const year = Number(row[yearIdx]), hdi = Number(row[hdiIdx]);
    if (!Number.isFinite(year) || !Number.isFinite(hdi)) continue;
    out.push({ entity, year, hdi, sourceHash: createHash('sha256').update(row.join(',')).digest() });
  }
  return out;
}

export async function writeHdiGlobal(pool: Pick<Pool, 'query'>, points: HdiGlobalPoint[]): Promise<void> {
  for (const p of points) {
    await pool.query(
      `INSERT INTO civica_exec.exec_hdi_global (entity, year, hdi, source_hash) VALUES ($1,$2,$3,$4)
       ON CONFLICT (entity, year) DO UPDATE SET hdi = excluded.hdi, source_hash = excluded.source_hash, collected_at = now()`,
      [p.entity, p.year, p.hdi, p.sourceHash],
    );
  }
}
