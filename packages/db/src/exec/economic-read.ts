import type { Pool } from 'pg';

/** P14.2 — PIB a preços correntes (IBGE/SIDRA), somente leitura. Per capita é calculado aqui, juntando
 * `exec_gdp_territory` (bruto, Mil Reais) com `exec_territory_population` (já existente) do MESMO ano — nunca
 * um ano de PIB com população de outro ano. Quando o ano não tem população correspondente, não há per capita
 * (nunca aproxima com outro ano). */
type Q = Pick<Pool, 'query'>;
export type GdpLevel = 'BRASIL' | 'UF' | 'MUNICIPIO';
export interface GdpTerritory { level: GdpLevel; ufCode?: number; ibge7?: string | number }
export interface GdpYearPoint { year: number; gdpThousandReais: number; population: number | null; gdpPerCapitaReais: number | null }
export interface GdpSeries { level: GdpLevel; code: string; name: string; points: GdpYearPoint[]; latest: GdpYearPoint | null }

function codeOf(t: GdpTerritory): { level: string; code: string } | null {
  if (t.level === 'BRASIL') return { level: 'BRASIL', code: '1' };
  if (t.level === 'UF') return t.ufCode != null ? { level: 'UF', code: String(t.ufCode) } : null;
  const ibge7 = String(t.ibge7 ?? ''); return /^\d{7}$/.test(ibge7) ? { level: 'MUNICIPIO', code: ibge7 } : null;
}
/** `exec_entity.entity_id` que casa com cada nível, para juntar com `exec_territory_population` (que é indexada
 * por entity_id, não pelo código bruto do IBGE/SIDRA — Brasil=76, UF=uf_code, município=ibge7). */
function entityIdOf(t: GdpTerritory): number | null {
  if (t.level === 'BRASIL') return 76;
  if (t.level === 'UF') return t.ufCode ?? null;
  const ibge7 = String(t.ibge7 ?? ''); return /^\d{7}$/.test(ibge7) ? Number(ibge7) : null;
}

/** Série completa de PIB (todos os anos coletados, 2002–2023) de um território, com per capita calculado ano a
 * ano contra a população publicada do mesmo ano. */
export async function getGdpSeries(q: Q, t: GdpTerritory): Promise<GdpSeries | null> {
  const scope = codeOf(t); const entityId = entityIdOf(t);
  if (!scope || entityId == null) return null;
  const rows = (await q.query(
    `SELECT g.territory_name, g.year, g.gdp_thousand_reais, p.value AS population
     FROM civica_exec.exec_gdp_territory g
     LEFT JOIN civica_exec.exec_territory_population p ON p.entity_id = $1 AND p.year = g.year AND p.source = 1
     WHERE g.territory_level = $2 AND g.territory_code = $3
     ORDER BY g.year`,
    [entityId, scope.level, scope.code],
  )).rows;
  if (!rows.length) return null;
  const points: GdpYearPoint[] = rows.map(r => {
    const gdpThousandReais = Number(r.gdp_thousand_reais);
    const population = r.population == null ? null : Number(r.population);
    const gdpPerCapitaReais = population ? (gdpThousandReais * 1000) / population : null;
    return { year: Number(r.year), gdpThousandReais, population, gdpPerCapitaReais };
  });
  return { level: t.level, code: scope.code, name: String(rows[0].territory_name), points, latest: points.at(-1) ?? null };
}

/** Atalho: PIB per capita do ano mais recente em que PIB *e* população existem juntos — nunca o último ano de
 * PIB sem mais (população publicada tem lacunas próprias: ex. Vitória não tem população para 2022/2023, mas
 * tem PIB; usar o último ano com os dois é mais correto que mostrar "sem dado" quando um ano anterior serve). */
export async function getGdpPerCapita(q: Q, t: GdpTerritory): Promise<{ year: number; value: number; gdpThousandReais: number } | null> {
  const series = await getGdpSeries(q, t); if (!series) return null;
  const point = [...series.points].reverse().find(p => p.gdpPerCapitaReais != null);
  return point ? { year: point.year, value: point.gdpPerCapitaReais!, gdpThousandReais: point.gdpThousandReais } : null;
}

export interface GdpRankingRow { entityId: number; year: number; value: number }
/** PIB per capita do ano mais recente (com população do mesmo ano) de TODOS os municípios de uma UF, numa
 * única consulta — nunca uma consulta por município (N+1). Usada só para identificar o maior/menor PIB per
 * capita do estado; o nome de cada município vem da lista de municípios que a página já carrega, não desta
 * função (ela nunca junta `exec_entity.name` para não duplicar o que o chamador já tem). */
export async function getGdpPerCapitaForState(q: Q, ufCode: number): Promise<GdpRankingRow[]> {
  const rows = (await q.query(
    `SELECT DISTINCT ON (g.territory_code) g.territory_code::int AS entity_id, g.year, g.gdp_thousand_reais, p.value AS population
     FROM civica_exec.exec_gdp_territory g
     JOIN civica_exec.exec_entity e ON e.entity_id = g.territory_code::int AND e.kind = 4 AND e.uf_code = $1
     LEFT JOIN civica_exec.exec_territory_population p ON p.entity_id = e.entity_id AND p.year = g.year AND p.source = 1
     WHERE g.territory_level = 'MUNICIPIO' AND p.value IS NOT NULL
     ORDER BY g.territory_code, g.year DESC`,
    [ufCode],
  )).rows;
  return rows.map(r => ({ entityId: Number(r.entity_id), year: Number(r.year), value: (Number(r.gdp_thousand_reais) * 1000) / Number(r.population) }));
}
