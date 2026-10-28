import type { Pool } from 'pg';

/**
 * Leituras do ENEM (P11.6): participação e desempenho agregados por município-da-escola/UF/Brasil x rede x disciplina.
 * Nunca devolve uma linha suprimida (`suppressed=true`, corte de n<10): o corte é aplicado aqui, não deixado para o produto.
 */
type Q = Pick<Pool, 'query'>;
export type EnemScope = { ibge7?: string; uf?: string };
const scopeOf = (o: EnemScope) => o.ibge7 ? { scope: 4, key: String(Number(o.ibge7)) } : o.uf ? { scope: 3, key: o.uf.toUpperCase() } : { scope: 1, key: 'BR' };
const n = (v: unknown) => v == null ? null : Number(v);

/** Última edição do ENEM publicada (reconciliada contra a Sinopse); nunca assume um ano fixo. */
export async function latestEnemEdition(q: Q): Promise<number | null> {
  const r = await q.query(`SELECT max(edition)::int AS e FROM civica_exec.exec_enem_source_run WHERE status='published'`);
  return r.rows[0]?.e != null ? Number(r.rows[0].e) : null;
}

export interface EnemTerritoryOverview { edition: number; scope: number; scopeKey: string; network: number; registrants: number; allFourPresent: number; essayValid: number }
export async function getEnemTerritoryOverview(q: Q, o: EnemScope, edition: number, network = 0): Promise<EnemTerritoryOverview | null> {
  const s = scopeOf(o);
  const row = (await q.query(`SELECT t.registrants,t.all_four_present,t.essay_valid FROM civica_exec.exec_enem_territory_year t JOIN civica_exec.exec_enem_source_run r ON r.source_run_id=t.source_run_id AND r.status='published' WHERE t.scope=$1 AND t.scope_key=$2 AND t.edition=$3 AND t.network=$4 AND t.suppressed=false`, [s.scope, s.key, edition, network])).rows[0];
  if (!row) return null;
  return { edition, scope: s.scope, scopeKey: s.key, network, registrants: Number(row.registrants), allFourPresent: Number(row.all_four_present), essayValid: Number(row.essay_valid) };
}

export interface EnemSubjectPoint { subject: string; validN: number; mean: number; median: number | null; p25: number | null; p75: number | null }
/** As 5 áreas (CN/CH/LC/MT/ESSAY) de um território/edição/rede, só células não suprimidas. */
export async function getEnemSubjectOverview(q: Q, o: EnemScope, edition: number, network = 0): Promise<EnemSubjectPoint[]> {
  const s = scopeOf(o);
  const rows = (await q.query(`SELECT subject,valid_n,mean,median,p25,p75 FROM civica_exec.exec_enem_subject_year y JOIN civica_exec.exec_enem_source_run r ON r.source_run_id=y.source_run_id AND r.status='published' WHERE y.scope=$1 AND y.scope_key=$2 AND y.edition=$3 AND y.network=$4 AND y.suppressed=false ORDER BY subject`, [s.scope, s.key, edition, network])).rows;
  return rows.map(x => ({ subject: String(x.subject), validN: Number(x.valid_n), mean: Number(x.mean), median: n(x.median), p25: n(x.p25), p75: n(x.p75) }));
}

/** Série histórica (todas as edições publicadas) de uma disciplina, para gráfico de evolução. */
export async function getEnemSeries(q: Q, o: EnemScope, subject: string, network = 0): Promise<Array<{ edition: number; validN: number; mean: number }>> {
  const s = scopeOf(o);
  const rows = (await q.query(`SELECT y.edition,y.valid_n,y.mean FROM civica_exec.exec_enem_subject_year y JOIN civica_exec.exec_enem_source_run r ON r.source_run_id=y.source_run_id AND r.status='published' WHERE y.scope=$1 AND y.scope_key=$2 AND y.subject=$3 AND y.network=$4 AND y.suppressed=false ORDER BY y.edition`, [s.scope, s.key, subject, network])).rows;
  return rows.map(x => ({ edition: Number(x.edition), validN: Number(x.valid_n), mean: Number(x.mean) }));
}

/** Comparação por rede administrativa (federal/estadual/municipal/privada) de uma disciplina, excluindo células suprimidas. */
export async function getEnemNetworkBreakdown(q: Q, o: EnemScope, edition: number, subject: string): Promise<Array<{ network: number; validN: number; mean: number }>> {
  const s = scopeOf(o);
  const rows = (await q.query(`SELECT y.network,y.valid_n,y.mean FROM civica_exec.exec_enem_subject_year y JOIN civica_exec.exec_enem_source_run r ON r.source_run_id=y.source_run_id AND r.status='published' WHERE y.scope=$1 AND y.scope_key=$2 AND y.edition=$3 AND y.subject=$4 AND y.network<>0 AND y.suppressed=false ORDER BY y.network`, [s.scope, s.key, edition, subject])).rows;
  return rows.map(x => ({ network: Number(x.network), validN: Number(x.valid_n), mean: Number(x.mean) }));
}
