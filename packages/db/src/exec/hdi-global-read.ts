import type { Pool } from 'pg';

/** P14.13 — IDH Global (PNUD/ONU, via OWID): Brasil, América do Sul e Mundo, 1990 em diante. PARALELO ao
 * IDHM nacional (exec_idhm_territory, PNUD/IPEA/FJP, decenal 1991/2000/2010) — metodologia diferente,
 * nunca a mesma série. */
type Q = Pick<Pool, 'query'>;
export interface HdiGlobalPointRow { year: number; hdi: number }
export interface HdiGlobalComparison { brasil: HdiGlobalPointRow[]; americaDoSul: HdiGlobalPointRow[]; mundo: HdiGlobalPointRow[] }

export async function getHdiGlobalComparison(q: Q): Promise<HdiGlobalComparison> {
  const rows = (await q.query<{ entity: string; year: number; hdi: string }>(
    `SELECT entity, year, hdi FROM civica_exec.exec_hdi_global ORDER BY entity, year`,
  )).rows;
  const by = (entity: string) => rows.filter(r => r.entity === entity).map(r => ({ year: Number(r.year), hdi: Number(r.hdi) }));
  return { brasil: by('BRASIL'), americaDoSul: by('AMERICA_DO_SUL'), mundo: by('MUNDO') };
}
