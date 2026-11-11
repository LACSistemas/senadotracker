import type { Pool } from 'pg';

/** P14.3 — IDHM (PNUD/IPEA/FJP), só leitura. Decenal por desenho (1991/2000/2010, anos do Censo) —
 * nunca tratar como série anual contínua: os pontos existem só nesses 3 anos, com lacunas reais entre eles. */
type Q = Pick<Pool, 'query'>;
export type HdiLevel = 'BRASIL' | 'UF' | 'MUNICIPIO';
export interface HdiTerritory { level: HdiLevel; ufCode?: number; ibge7?: string | number }
export interface HdiPoint { year: 1991 | 2000 | 2010; idhm: number; idhmRenda: number | null; idhmLongevidade: number | null; idhmEducacao: number | null }
export interface HdiSeries { level: HdiLevel; code: string; points: HdiPoint[] }

function codeOf(t: HdiTerritory): string | null {
  if (t.level === 'BRASIL') return '1';
  if (t.level === 'UF') return t.ufCode != null ? String(t.ufCode) : null;
  const ibge7 = String(t.ibge7 ?? ''); return /^\d{7}$/.test(ibge7) ? ibge7 : null;
}

export async function getHdiSeries(q: Q, t: HdiTerritory): Promise<HdiSeries | null> {
  const code = codeOf(t); if (!code) return null;
  const rows = (await q.query(
    `SELECT year, idhm, idhm_renda, idhm_longevidade, idhm_educacao
     FROM civica_exec.exec_idhm_territory WHERE territory_level = $1 AND territory_code = $2 ORDER BY year`,
    [t.level, code],
  )).rows;
  if (!rows.length) return null;
  const points: HdiPoint[] = rows.map(r => ({
    year: Number(r.year) as 1991 | 2000 | 2010, idhm: Number(r.idhm),
    idhmRenda: r.idhm_renda == null ? null : Number(r.idhm_renda),
    idhmLongevidade: r.idhm_longevidade == null ? null : Number(r.idhm_longevidade),
    idhmEducacao: r.idhm_educacao == null ? null : Number(r.idhm_educacao),
  }));
  return { level: t.level, code, points };
}

export interface HdiRankingRow { entityId: number; idhm: number }
/** IDHM 2010 (o ano mais recente do indicador decenal) de TODOS os municípios de uma UF, numa única
 * consulta — nunca uma consulta por município. Usada só para identificar o maior/menor IDHM do estado; o
 * nome de cada município vem da lista de municípios que a página já carrega, não desta função. */
export async function getHdiForState(q: Q, ufCode: number): Promise<HdiRankingRow[]> {
  const rows = (await q.query(
    `SELECT h.territory_code::int AS entity_id, h.idhm
     FROM civica_exec.exec_idhm_territory h
     JOIN civica_exec.exec_entity e ON e.entity_id = h.territory_code::int AND e.kind = 4 AND e.uf_code = $1
     WHERE h.territory_level = 'MUNICIPIO' AND h.year = 2010`,
    [ufCode],
  )).rows;
  return rows.map(r => ({ entityId: Number(r.entity_id), idhm: Number(r.idhm) }));
}
/** IDHM 2010 das 27 UFs, numa única consulta — base do mapa nacional por indicador de `/executivo`
 * (P-Exec E2). `territory_code` já É o `ufCode` no grão UF (ver `codeOf`), sem precisar de join. */
export async function getHdiForAllStates(q: Q): Promise<HdiRankingRow[]> {
  const rows = (await q.query(
    `SELECT territory_code::int AS entity_id, idhm FROM civica_exec.exec_idhm_territory WHERE territory_level = 'UF' AND year = 2010`,
  )).rows;
  return rows.map(r => ({ entityId: Number(r.entity_id), idhm: Number(r.idhm) }));
}
