import type { Pool } from 'pg';

/** Dívida pública — Dívida Bruta do Governo Geral (DBGG, % PIB), Banco Central SGS série 13762,
 * mensal desde dez/2006, somente leitura. */
type Q = Pick<Pool, 'query'>;
export type PublicDebtMetric = 'DBGG_PCT_GDP';
export interface PublicDebtPointRow { periodStart: string; value: number }
export interface PublicDebtSeries { metric: PublicDebtMetric; points: PublicDebtPointRow[]; latest: PublicDebtPointRow | null }

export async function getPublicDebtSeries(q: Q, metric: PublicDebtMetric = 'DBGG_PCT_GDP'): Promise<PublicDebtSeries> {
  // Achado real: `period_start` é `date` — o driver `pg` devolve `date` como objeto `Date` (não string)
  // por padrão, diferente de todo o resto do schema exec (que usa `year smallint`). `::text` garante
  // "YYYY-MM-DD" de verdade, sem depender de parser de tipo nenhum.
  const rows = (await q.query<{ period_start: string; value: string }>(
    `SELECT period_start::text, value FROM civica_exec.exec_public_debt WHERE metric = $1 ORDER BY period_start`,
    [metric],
  )).rows;
  const points = rows.map(r => ({ periodStart: r.period_start, value: Number(r.value) }));
  return { metric, points, latest: points.at(-1) ?? null };
}
