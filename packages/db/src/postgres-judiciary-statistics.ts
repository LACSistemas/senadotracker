import type { Pool } from 'pg';
import { JUDICIARY_SCHEMA } from './postgres-judiciary.ts';

export const JUDICIARY_STATISTICS_SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS ${JUDICIARY_SCHEMA}.jud_jn_indicator (
    indicator_id text PRIMARY KEY, official_name text NOT NULL, public_name text NOT NULL, description text NOT NULL,
    source_variable text NOT NULL, source_formula text, numerator text, denominator text, unit text NOT NULL,
    statistical_universe text NOT NULL, institutional_grain text NOT NULL, time_grain text NOT NULL,
    available_years text NOT NULL, aggregation_allowed text NOT NULL, comparison_eligible boolean NOT NULL,
    source_edition integer NOT NULL, method_breaks text, publication_status text NOT NULL,
    missing_data_rule text NOT NULL, methodology_reference text NOT NULL, provenance jsonb NOT NULL DEFAULT '{}'::jsonb
  )`,
  `CREATE TABLE IF NOT EXISTS ${JUDICIARY_SCHEMA}.jud_jn_crosswalk (
    crosswalk_id text PRIMARY KEY, jn_identifier text NOT NULL, canonical_tribunal_id text REFERENCES ${JUDICIARY_SCHEMA}.jud_tribunal(tribunal_id),
    raw_name text, canonical_sigla text, match_status text NOT NULL CHECK (match_status IN ('EXACT_OFFICIAL','OFFICIAL_CROSS_REFERENCE','DOCUMENT_VERIFIED','NOT_APPLICABLE','UNRESOLVED','AMBIGUOUS')),
    evidence text NOT NULL, source_edition integer NOT NULL, valid_from integer, valid_to integer, provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE(jn_identifier, source_edition)
  )`,
  `CREATE INDEX IF NOT EXISTS jud_jn_crosswalk_tribunal_idx ON ${JUDICIARY_SCHEMA}.jud_jn_crosswalk(canonical_tribunal_id, match_status)`,
  `CREATE TABLE IF NOT EXISTS ${JUDICIARY_SCHEMA}.jud_jn_observation (
    observation_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, indicator_id text NOT NULL REFERENCES ${JUDICIARY_SCHEMA}.jud_jn_indicator(indicator_id),
    canonical_tribunal_id text NOT NULL REFERENCES ${JUDICIARY_SCHEMA}.jud_tribunal(tribunal_id), jn_identifier text NOT NULL,
    reference_year integer NOT NULL, report_edition integer NOT NULL, degree_code text, value_numeric numeric, numerator numeric, denominator numeric,
    unit text NOT NULL, coverage_status text NOT NULL, method_version text NOT NULL, comparability text NOT NULL, source_snapshot_id text NOT NULL REFERENCES ${JUDICIARY_SCHEMA}.jud_source_snapshot(snapshot_id),
    publication_revision_id text NOT NULL, raw_row_hash text NOT NULL, provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE(indicator_id, canonical_tribunal_id, reference_year, degree_code, publication_revision_id)
  )`,
  `CREATE INDEX IF NOT EXISTS jud_jn_observation_lookup_idx ON ${JUDICIARY_SCHEMA}.jud_jn_observation(indicator_id, reference_year, canonical_tribunal_id)`,
  `CREATE TABLE IF NOT EXISTS ${JUDICIARY_SCHEMA}.jud_jn_parity_check (
    parity_id text PRIMARY KEY, indicator_id text NOT NULL, canonical_tribunal_id text, reference_year integer, source_value numeric,
    persisted_value numeric, absolute_difference numeric, relative_difference numeric, match_status text NOT NULL, explanation text NOT NULL,
    revision_id text NOT NULL, provenance jsonb NOT NULL DEFAULT '{}'::jsonb
  )`,
];

export async function ensureJudiciaryStatisticsSchema(pool: Pool): Promise<void> {
  for (const sql of JUDICIARY_STATISTICS_SCHEMA_SQL) await pool.query(sql);
}

export async function getJudiciaryStatisticsOverview(pool: Pool, year?: number) {
  const params: unknown[] = []; const where = year === undefined ? '' : `WHERE o.reference_year=$1`;
  if (year !== undefined) params.push(year);
  return (await pool.query(`SELECT i.indicator_id,i.public_name,i.unit,o.reference_year,count(*)::int AS observations,
      count(*) FILTER (WHERE o.value_numeric IS NOT NULL)::int AS values,
      count(DISTINCT o.canonical_tribunal_id)::int AS tribunals
    FROM ${JUDICIARY_SCHEMA}.jud_jn_observation o JOIN ${JUDICIARY_SCHEMA}.jud_jn_indicator i ON i.indicator_id=o.indicator_id
    ${where} GROUP BY i.indicator_id,i.public_name,i.unit,o.reference_year ORDER BY i.indicator_id,o.reference_year`, params)).rows;
}

export async function getJudiciaryIndicatorCatalog(pool: Pool) {
  return (await pool.query(`SELECT * FROM ${JUDICIARY_SCHEMA}.jud_jn_indicator ORDER BY indicator_id`)).rows;
}

export async function getJudiciaryTribunalStatistics(pool: Pool, tribunalId: string, year: number) {
  return (await pool.query(`SELECT o.*,i.public_name,i.description FROM ${JUDICIARY_SCHEMA}.jud_jn_observation o JOIN ${JUDICIARY_SCHEMA}.jud_jn_indicator i ON i.indicator_id=o.indicator_id WHERE o.canonical_tribunal_id=$1 AND o.reference_year=$2 ORDER BY i.indicator_id`, [tribunalId, year])).rows;
}

export async function getJudiciaryTribunalHistoricalSeries(pool: Pool, tribunalId: string, indicatorId: string) {
  return (await pool.query(`SELECT o.reference_year,o.value_numeric,o.numerator,o.denominator,o.unit,o.coverage_status,o.comparability,o.report_edition FROM ${JUDICIARY_SCHEMA}.jud_jn_observation o WHERE o.canonical_tribunal_id=$1 AND o.indicator_id=$2 ORDER BY o.reference_year`, [tribunalId, indicatorId])).rows;
}

export async function getJudiciaryBranchStatistics(pool: Pool, branchCode: string, year: number) {
  return (await pool.query(`SELECT i.indicator_id,i.public_name,i.unit,count(*)::int AS observations,count(*) FILTER (WHERE o.value_numeric IS NOT NULL)::int AS values,
      sum(o.value_numeric) FILTER (WHERE i.aggregation_allowed='SUM') AS additive_total,
      avg(o.value_numeric) FILTER (WHERE i.aggregation_allowed='MEAN_ONLY') AS descriptive_mean
    FROM ${JUDICIARY_SCHEMA}.jud_jn_observation o JOIN ${JUDICIARY_SCHEMA}.jud_jn_indicator i ON i.indicator_id=o.indicator_id
    JOIN ${JUDICIARY_SCHEMA}.jud_tribunal t ON t.tribunal_id=o.canonical_tribunal_id JOIN ${JUDICIARY_SCHEMA}.jud_branch b ON b.branch_id=t.branch_id
    WHERE b.code=$1 AND o.reference_year=$2 GROUP BY i.indicator_id,i.public_name,i.unit,i.aggregation_allowed ORDER BY i.indicator_id`, [branchCode, year])).rows;
}

export async function getJudiciaryIndicatorComparison(pool: Pool, indicatorId: string, tribunalIds: string[], year: number) {
  return (await pool.query(`SELECT o.canonical_tribunal_id,t.sigla,t.official_name,o.reference_year,o.value_numeric,o.unit,o.coverage_status,o.comparability FROM ${JUDICIARY_SCHEMA}.jud_jn_observation o JOIN ${JUDICIARY_SCHEMA}.jud_tribunal t ON t.tribunal_id=o.canonical_tribunal_id WHERE o.indicator_id=$1 AND o.reference_year=$2 AND o.canonical_tribunal_id=ANY($3::text[]) ORDER BY t.sigla`, [indicatorId, year, tribunalIds])).rows;
}

export async function getJudiciaryStatisticalCoverage(pool: Pool) {
  return (await pool.query(`SELECT i.indicator_id,i.public_name,o.reference_year,count(DISTINCT o.canonical_tribunal_id)::int AS tribunals,count(*)::int AS facts,
      count(*) FILTER (WHERE o.value_numeric IS NULL)::int AS missing
    FROM ${JUDICIARY_SCHEMA}.jud_jn_indicator i LEFT JOIN ${JUDICIARY_SCHEMA}.jud_jn_observation o ON o.indicator_id=i.indicator_id
    GROUP BY i.indicator_id,i.public_name,o.reference_year ORDER BY i.indicator_id,o.reference_year`)).rows;
}

export async function getJudiciaryIndicatorMethodology(pool: Pool, indicatorId: string) {
  return (await pool.query(`SELECT * FROM ${JUDICIARY_SCHEMA}.jud_jn_indicator WHERE indicator_id=$1`, [indicatorId])).rows[0] ?? null;
}

/** Média simples dos OUTROS tribunais do mesmo ramo (`branchCode`), excluindo o próprio `excludeTribunalId` —
 * usada só como um comparador de leitura rápida ("como este tribunal está perto da média dos pares"), nunca
 * como substituto do comparador completo (`/judiciario/comparar`). Esta é uma operação DIFERENTE do que
 * `aggregation_allowed` governa em `jud_jn_indicator` (que decide se um valor pode virar um TOTAL NACIONAL
 * somado) — uma média de pares é sempre uma leitura válida, mesmo pra indicadores marcados 'SUM' (ex. Despesa
 * Total: nunca somamos tribunais pra virar um total nacional por engano, mas a MÉDIA de quanto um tribunal
 * típico gasta é uma pergunta diferente e legítima). */
export async function getJudiciaryIndicatorPeerAverage(pool: Pool, indicatorId: string, year: number, branchCode: string, excludeTribunalId: string) {
  const r = (await pool.query(`SELECT avg(o.value_numeric)::numeric AS avg_value, count(*)::int AS tribunal_count
    FROM ${JUDICIARY_SCHEMA}.jud_jn_observation o JOIN ${JUDICIARY_SCHEMA}.jud_tribunal t ON t.tribunal_id=o.canonical_tribunal_id JOIN ${JUDICIARY_SCHEMA}.jud_branch b ON b.branch_id=t.branch_id
    WHERE o.indicator_id=$1 AND o.reference_year=$2 AND b.code=$3 AND o.canonical_tribunal_id<>$4 AND o.value_numeric IS NOT NULL`,
    [indicatorId, year, branchCode, excludeTribunalId])).rows[0];
  return { avgValue: r?.avg_value != null ? Number(r.avg_value) : null, tribunalCount: Number(r?.tribunal_count ?? 0) };
}
