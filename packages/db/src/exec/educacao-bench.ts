import type { Pool } from 'pg';

/**
 * Benchmarks de Ensino Superior e CAPES (município × municípios da mesma UF; UF × as 27 UFs), no padrão de `security-bench.ts`:
 * percentil 25/50/75 só quando o grupo tem tamanho mínimo; nunca interpola, nunca mistura indicadores ou anos diferentes.
 * São medidas de PORTE/ESCALA (nº de IES, matrículas, programas), nunca de qualidade: qualidade nunca entra num ranking.
 */
type Q = Pick<Pool, 'query'>;
export const EDU_BENCH_MIN_MUNICIPALITIES = 5;
export const EDU_BENCH_MIN_UFS = 10;

export interface EduBenchPoint { period: string; n: number; universe: number; p25: number; p50: number; p75: number }
const f = (v: unknown): number => Number(v);
const pt = (period: number | string, r: { n: unknown; universe: unknown; p25: unknown; p50: unknown; p75: unknown }): EduBenchPoint => ({ period: String(period), n: f(r.n), universe: f(r.universe), p25: f(r.p25), p50: f(r.p50), p75: f(r.p75) });

const HIGHER_ED_COLUMNS = { ies_count: 'ies_count', enrollments: 'enrollments', vacancies: 'vacancies' } as const;
export type HigherEdBenchMetric = keyof typeof HIGHER_ED_COLUMNS;

/** Município × municípios da mesma UF no Censo da Educação Superior, num indicador de PORTE (nº de IES, matrículas ou vagas). */
export async function higherEdMunicipalBench(q: Q, o: { ufCode: number; year: number; metric: HigherEdBenchMetric }): Promise<EduBenchPoint | null> {
  const col = HIGHER_ED_COLUMNS[o.metric];
  const r = await q.query(`
    SELECT count(*)::int AS n, (SELECT count(*)::int FROM civica_exec.exec_entity WHERE kind = 4 AND uf_code = $2) AS universe,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY t.${col}) AS p25, percentile_cont(0.5) WITHIN GROUP (ORDER BY t.${col}) AS p50, percentile_cont(0.75) WITHIN GROUP (ORDER BY t.${col}) AS p75
    FROM civica_exec.exec_edu_higher_territory_year t JOIN civica_exec.exec_entity e ON e.kind = 4 AND e.ibge7 = t.scope_key::int
    WHERE t.scope = 4 AND t.year = $1 AND e.uf_code = $2 AND t.${col} IS NOT NULL
    HAVING count(*) >= $3`, [o.year, o.ufCode, EDU_BENCH_MIN_MUNICIPALITIES]);
  const row = r.rows[0]; return row ? pt(o.year, row) : null;
}

/**
 * Saeb/Ideb/abandono: município × municípios da mesma UF, ou UF × as 27 UFs, na MESMA célula (disciplina/etapa/rede ou
 * etapa/rede) que o território próprio exibe — nunca mistura redes diferentes no mesmo benchmark. Usa as tabelas
 * territoriais do Censo Escolar (`exec_edu_saeb_terr`/`exec_edu_ideb_terr`/`exec_edu_flow_terr`), que já guardam
 * `entity_id` do próprio território (sem a ambiguidade de sede/oferta do Ensino Superior/CAPES).
 */
export async function saebMunicipalBench(q: Q, o: { ufCode: number; year: number; subj: number; grade: number; dep: number }): Promise<EduBenchPoint | null> {
  const r = await q.query(`
    SELECT count(*)::int AS n, (SELECT count(*)::int FROM civica_exec.exec_entity WHERE kind = 4 AND uf_code = $2) AS universe,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY t.media) AS p25, percentile_cont(0.5) WITHIN GROUP (ORDER BY t.media) AS p50, percentile_cont(0.75) WITHIN GROUP (ORDER BY t.media) AS p75
    FROM civica_exec.exec_edu_saeb_terr t JOIN civica_exec.exec_entity e ON e.entity_id = t.entity_id AND e.kind = 4 AND e.uf_code = $2
    WHERE t.year = $1 AND t.subj = $3 AND t.grade = $4 AND t.dep = $5 AND t.loc = 0 AND t.cap = 0 AND t.media IS NOT NULL
    HAVING count(*) >= $6`, [o.year, o.ufCode, o.subj, o.grade, o.dep, EDU_BENCH_MIN_MUNICIPALITIES]);
  const row = r.rows[0]; return row ? pt(o.year, row) : null;
}
export async function saebUfBench(q: Q, o: { year: number; subj: number; grade: number; dep: number }): Promise<EduBenchPoint | null> {
  const r = await q.query(`
    SELECT count(*)::int AS n, 27 AS universe,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY t.media) AS p25, percentile_cont(0.5) WITHIN GROUP (ORDER BY t.media) AS p50, percentile_cont(0.75) WITHIN GROUP (ORDER BY t.media) AS p75
    FROM civica_exec.exec_edu_saeb_terr t JOIN civica_exec.exec_entity e ON e.entity_id = t.entity_id AND e.kind = 3
    WHERE t.year = $1 AND t.subj = $2 AND t.grade = $3 AND t.dep = $4 AND t.loc = 0 AND t.cap = 0 AND t.media IS NOT NULL
    HAVING count(*) >= $5`, [o.year, o.subj, o.grade, o.dep, EDU_BENCH_MIN_UFS]);
  const row = r.rows[0]; return row ? pt(o.year, row) : null;
}

export async function idebMunicipalBench(q: Q, o: { ufCode: number; year: number; stage: number; dep: number }): Promise<EduBenchPoint | null> {
  const r = await q.query(`
    SELECT count(*)::int AS n, (SELECT count(*)::int FROM civica_exec.exec_entity WHERE kind = 4 AND uf_code = $2) AS universe,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY t.ideb) AS p25, percentile_cont(0.5) WITHIN GROUP (ORDER BY t.ideb) AS p50, percentile_cont(0.75) WITHIN GROUP (ORDER BY t.ideb) AS p75
    FROM civica_exec.exec_edu_ideb_terr t JOIN civica_exec.exec_entity e ON e.entity_id = t.entity_id AND e.kind = 4 AND e.uf_code = $2
    WHERE t.year = $1 AND t.stage = $3 AND t.dep = $4 AND t.ideb IS NOT NULL
    HAVING count(*) >= $5`, [o.year, o.ufCode, o.stage, o.dep, EDU_BENCH_MIN_MUNICIPALITIES]);
  const row = r.rows[0]; return row ? pt(o.year, row) : null;
}
export async function idebUfBench(q: Q, o: { year: number; stage: number; dep: number }): Promise<EduBenchPoint | null> {
  const r = await q.query(`
    SELECT count(*)::int AS n, 27 AS universe,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY t.ideb) AS p25, percentile_cont(0.5) WITHIN GROUP (ORDER BY t.ideb) AS p50, percentile_cont(0.75) WITHIN GROUP (ORDER BY t.ideb) AS p75
    FROM civica_exec.exec_edu_ideb_terr t JOIN civica_exec.exec_entity e ON e.entity_id = t.entity_id AND e.kind = 3
    WHERE t.year = $1 AND t.stage = $2 AND t.dep = $3 AND t.ideb IS NOT NULL
    HAVING count(*) >= $4`, [o.year, o.stage, o.dep, EDU_BENCH_MIN_UFS]);
  const row = r.rows[0]; return row ? pt(o.year, row) : null;
}

/** Abandono do ensino fundamental (`ab_fun`), sempre rede total e localização total (mesma definição usada no KPI do herói). */
export async function flowAbandonoMunicipalBench(q: Q, o: { ufCode: number; year: number }): Promise<EduBenchPoint | null> {
  const r = await q.query(`
    SELECT count(*)::int AS n, (SELECT count(*)::int FROM civica_exec.exec_entity WHERE kind = 4 AND uf_code = $2) AS universe,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY t.ab_fun) AS p25, percentile_cont(0.5) WITHIN GROUP (ORDER BY t.ab_fun) AS p50, percentile_cont(0.75) WITHIN GROUP (ORDER BY t.ab_fun) AS p75
    FROM civica_exec.exec_edu_flow_terr t JOIN civica_exec.exec_entity e ON e.entity_id = t.entity_id AND e.kind = 4 AND e.uf_code = $2
    WHERE t.year = $1 AND t.dep = 0 AND t.loc = 0 AND t.ab_fun IS NOT NULL
    HAVING count(*) >= $3`, [o.year, o.ufCode, EDU_BENCH_MIN_MUNICIPALITIES]);
  const row = r.rows[0]; return row ? pt(o.year, row) : null;
}
export async function flowAbandonoUfBench(q: Q, o: { year: number }): Promise<EduBenchPoint | null> {
  const r = await q.query(`
    SELECT count(*)::int AS n, 27 AS universe,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY t.ab_fun) AS p25, percentile_cont(0.5) WITHIN GROUP (ORDER BY t.ab_fun) AS p50, percentile_cont(0.75) WITHIN GROUP (ORDER BY t.ab_fun) AS p75
    FROM civica_exec.exec_edu_flow_terr t JOIN civica_exec.exec_entity e ON e.entity_id = t.entity_id AND e.kind = 3
    WHERE t.year = $1 AND t.dep = 0 AND t.loc = 0 AND t.ab_fun IS NOT NULL
    HAVING count(*) >= $2`, [o.year, EDU_BENCH_MIN_UFS]);
  const row = r.rows[0]; return row ? pt(o.year, row) : null;
}

/** UF × as 27 UFs no Censo da Educação Superior. */
export async function higherEdUfBench(q: Q, o: { year: number; metric: HigherEdBenchMetric }): Promise<EduBenchPoint | null> {
  const col = HIGHER_ED_COLUMNS[o.metric];
  const r = await q.query(`
    SELECT count(*)::int AS n, 27 AS universe,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY t.${col}) AS p25, percentile_cont(0.5) WITHIN GROUP (ORDER BY t.${col}) AS p50, percentile_cont(0.75) WITHIN GROUP (ORDER BY t.${col}) AS p75
    FROM civica_exec.exec_edu_higher_territory_year t WHERE t.scope = 3 AND t.year = $1 AND t.${col} IS NOT NULL
    HAVING count(*) >= $2`, [o.year, EDU_BENCH_MIN_UFS]);
  const row = r.rows[0]; return row ? pt(o.year, row) : null;
}

/**
 * CAPES: nº de programas por município, agrupado pelo NOME do município publicado pela CAPES (`municipality_name`/`uf`), nunca por
 * `entity_id`. Verificado contra o dado real: em instituições com mais de um campus (ex.: UFES, sede em Vitória e campus em Alegre),
 * `entity_id` em `exec_capes_ppg_year` é a sede cadastral da IES, não o município do programa — programas de Alegre, São Mateus e
 * Serra apareciam sob o `entity_id` de Vitória. O nome do município, em contraste, é source-native e reconcilia corretamente.
 */
export async function capesMunicipalBench(q: Q, o: { uf: string; year: number }): Promise<EduBenchPoint | null> {
  const uf = o.uf.toUpperCase();
  const r = await q.query(`
    WITH per_muni AS (
      SELECT upper(unaccent(y.municipality_name)) AS key, count(*)::int AS programs
      FROM civica_exec.exec_capes_ppg_year y
      WHERE y.reference_year = $1 AND y.uf = $2 AND y.municipality_name <> ''
        AND y.source_run_id = (SELECT source_run_id FROM civica_exec.exec_capes_source_run WHERE family = 'PROGRAM' AND reference_year = $1 AND status = 'published' ORDER BY finished_at DESC NULLS LAST, source_run_id DESC LIMIT 1)
      GROUP BY upper(unaccent(y.municipality_name)))
    SELECT count(*)::int AS n, (SELECT count(*)::int FROM civica_exec.exec_entity WHERE kind = 4 AND uf_code = (SELECT uf_code FROM civica_exec.exec_entity WHERE kind = 3 AND uf = $2 LIMIT 1)) AS universe,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY programs) AS p25, percentile_cont(0.5) WITHIN GROUP (ORDER BY programs) AS p50, percentile_cont(0.75) WITHIN GROUP (ORDER BY programs) AS p75
    FROM per_muni HAVING count(*) >= $3`, [o.year, uf, EDU_BENCH_MIN_MUNICIPALITIES]);
  const row = r.rows[0]; return row ? pt(o.year, row) : null;
}

/** UF × as 27 UFs no número de programas de pós-graduação CAPES. */
export async function capesUfBench(q: Q, o: { year: number }): Promise<EduBenchPoint | null> {
  const r = await q.query(`
    WITH per_uf AS (
      SELECT y.uf, count(*)::int AS programs FROM civica_exec.exec_capes_ppg_year y
      WHERE y.reference_year = $1 AND y.source_run_id = (SELECT source_run_id FROM civica_exec.exec_capes_source_run WHERE family = 'PROGRAM' AND reference_year = $1 AND status = 'published' ORDER BY finished_at DESC NULLS LAST, source_run_id DESC LIMIT 1)
      GROUP BY y.uf)
    SELECT count(*)::int AS n, 27 AS universe,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY programs) AS p25, percentile_cont(0.5) WITHIN GROUP (ORDER BY programs) AS p50, percentile_cont(0.75) WITHIN GROUP (ORDER BY programs) AS p75
    FROM per_uf HAVING count(*) >= $2`, [o.year, EDU_BENCH_MIN_UFS]);
  const row = r.rows[0]; return row ? pt(o.year, row) : null;
}

/**
 * ENEM: município × municípios da mesma UF (ou UF × as 27 UFs) na média de uma disciplina, só rede "todas" (network=0) e só
 * células não suprimidas (`suppressed=false`, corte de n<10). `scope_key` do município é o próprio `CO_MUNICIPIO_ESC` (= ibge7),
 * sem tradução; nunca mistura edições.
 */
export async function enemMunicipalBench(q: Q, o: { ufCode: number; edition: number; subject: string }): Promise<EduBenchPoint | null> {
  const r = await q.query(`
    SELECT count(*)::int AS n, (SELECT count(*)::int FROM civica_exec.exec_entity WHERE kind = 4 AND uf_code = $2) AS universe,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY s.mean) AS p25, percentile_cont(0.5) WITHIN GROUP (ORDER BY s.mean) AS p50, percentile_cont(0.75) WITHIN GROUP (ORDER BY s.mean) AS p75
    FROM civica_exec.exec_enem_subject_year s
      JOIN civica_exec.exec_enem_source_run r ON r.source_run_id = s.source_run_id AND r.status = 'published'
      JOIN civica_exec.exec_entity e ON e.kind = 4 AND e.ibge7 = s.scope_key::int
    WHERE s.scope = 4 AND s.edition = $1 AND s.network = 0 AND s.subject = $3 AND s.suppressed = false AND e.uf_code = $2
    HAVING count(*) >= $4`, [o.edition, o.ufCode, o.subject, EDU_BENCH_MIN_MUNICIPALITIES]);
  const row = r.rows[0]; return row ? pt(o.edition, row) : null;
}

/** ENEM: UF × as 27 UFs na média de uma disciplina, rede "todas" (network=0). */
export async function enemUfBench(q: Q, o: { edition: number; subject: string }): Promise<EduBenchPoint | null> {
  const r = await q.query(`
    SELECT count(*)::int AS n, 27 AS universe,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY s.mean) AS p25, percentile_cont(0.5) WITHIN GROUP (ORDER BY s.mean) AS p50, percentile_cont(0.75) WITHIN GROUP (ORDER BY s.mean) AS p75
    FROM civica_exec.exec_enem_subject_year s JOIN civica_exec.exec_enem_source_run r ON r.source_run_id = s.source_run_id AND r.status = 'published'
    WHERE s.scope = 3 AND s.edition = $1 AND s.network = 0 AND s.subject = $2 AND s.suppressed = false
    HAVING count(*) >= $3`, [o.edition, o.subject, EDU_BENCH_MIN_UFS]);
  const row = r.rows[0]; return row ? pt(o.edition, row) : null;
}
