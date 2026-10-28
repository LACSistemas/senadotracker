import type { Pool } from 'pg';
type Q = Pick<Pool, 'query'>;

/**
 * `municipalityName` filtra pelo NOME publicado pela CAPES (`municipality_name`/`uf`), nunca por `entity_id`: em IES com mais de um
 * campus (ex.: UFES, sede em Vitória e campus em Alegre), `entity_id` em `exec_capes_ppg_year` é a sede cadastral da IES, não o
 * município do programa — confirmado contra o dado real (programas de Alegre/São Mateus/Serra apareciam sob o `entity_id` de
 * Vitória). O nome do município é source-native; a comparação é por `upper(unaccent(...))`, sem fuzzy matching.
 */
export interface GraduateFilters { year?: number; uf?: string; municipalityName?: string; text?: string; page?: number; pageSize?: number }

async function latest(pool: Q, family: string, year: number) {
  const r = await pool.query(`SELECT source_run_id FROM civica_exec.exec_capes_source_run WHERE family=$1 AND reference_year=$2 AND status='published' ORDER BY finished_at DESC NULLS LAST, source_run_id DESC LIMIT 1`, [family, year]);
  return r.rows[0]?.source_run_id ? Number(r.rows[0].source_run_id) : null;
}

/** Última edição publicada de uma família CAPES; nunca assume o ano corrente (pode não ter dado publicado ainda). */
export async function latestCapesYear(pool: Q, family = 'PROGRAM'): Promise<number | null> {
  const r = await pool.query(`SELECT max(reference_year)::int AS y FROM civica_exec.exec_capes_source_run WHERE family=$1 AND status='published'`, [family]);
  return r.rows[0]?.y != null ? Number(r.rows[0].y) : null;
}

export async function getGraduateProgramOverview(pool: Q, year: number, uf?: string) {
  const run = await latest(pool, 'PROGRAM', year);
  if (!run) return { year, available: false, programs: [], coverage: null };
  const args: unknown[] = [run, year]; let where = 'WHERE source_run_id=$1 AND reference_year=$2';
  if (uf) { args.push(uf.toUpperCase()); where += ` AND uf=$${args.length}`; }
  const r = await pool.query(`SELECT uf, count(*)::bigint AS programs, count(DISTINCT municipality_name)::bigint AS municipalities, count(*) FILTER (WHERE emec_code IS NOT NULL)::bigint AS emec_linked, count(*) FILTER (WHERE concept IS NOT NULL)::bigint AS with_concept FROM civica_exec.exec_capes_ppg_year ${where} GROUP BY uf ORDER BY uf`, args);
  const c = await pool.query(`SELECT source_rows,valid_rows,linked_rows,unresolved_rows,ppg_count,uf_count FROM civica_exec.exec_capes_coverage WHERE source_run_id=$1`, [run]);
  return { year, available: true, rows: r.rows, coverage: c.rows[0] ?? null };
}

export async function searchGraduatePrograms(pool: Q, filters: GraduateFilters = {}) {
  const year = filters.year ?? (await latestCapesYear(pool)) ?? 0; const run = year ? await latest(pool, 'PROGRAM', year) : null;
  if (!run) return { year, available: false, total: 0, items: [] };
  const args: unknown[] = [run, year]; let where = 'WHERE y.source_run_id=$1 AND y.reference_year=$2';
  if (filters.uf) { args.push(filters.uf.toUpperCase()); where += ` AND y.uf=$${args.length}`; }
  if (filters.municipalityName) { args.push(filters.municipalityName); where += ` AND upper(unaccent(y.municipality_name))=upper(unaccent($${args.length}))`; }
  if (filters.text) { args.push(`%${filters.text}%`); where += ` AND (y.institution_name ILIKE $${args.length} OR p.current_name ILIKE $${args.length} OR y.capes_program_code ILIKE $${args.length})`; }
  const page = Math.max(1, filters.page ?? 1), size = Math.min(100, Math.max(1, filters.pageSize ?? 25));
  const count = await pool.query(`SELECT count(*)::bigint AS n FROM civica_exec.exec_capes_ppg_year y JOIN civica_exec.exec_capes_ppg p ON p.capes_program_code=y.capes_program_code ${where}`, args);
  args.push((page - 1) * size, size);
  const rows = await pool.query(`SELECT y.capes_program_code,p.current_name,y.institution_name,y.institution_sigla,y.uf,y.municipality_name,y.modality,y.degree,y.situation,y.concept,y.entity_id FROM civica_exec.exec_capes_ppg_year y JOIN civica_exec.exec_capes_ppg p ON p.capes_program_code=y.capes_program_code ${where} ORDER BY y.uf,y.institution_name,p.current_name LIMIT $${args.length} OFFSET $${args.length-1}`, args);
  return { year, available: true, total: Number(count.rows[0]?.n ?? 0), page, pageSize: size, items: rows.rows };
}

/** Nº de programas por área de avaliação CAPES no território (top N). */
export async function getGraduateAreaBreakdown(pool: Q, o: { year: number; uf?: string; municipalityName?: string }, limit = 8) {
  const run = await latest(pool, 'PROGRAM', o.year); if (!run) return [];
  const args: unknown[] = [run, o.year]; let where = 'WHERE source_run_id=$1 AND reference_year=$2';
  if (o.uf) { args.push(o.uf.toUpperCase()); where += ` AND uf=$${args.length}`; }
  if (o.municipalityName) { args.push(o.municipalityName); where += ` AND upper(unaccent(municipality_name))=upper(unaccent($${args.length}))`; }
  args.push(limit);
  const r = await pool.query(`SELECT area_evaluation, count(*)::bigint AS n FROM civica_exec.exec_capes_ppg_year ${where} AND area_evaluation<>'' GROUP BY area_evaluation ORDER BY n DESC LIMIT $${args.length}`, args);
  return r.rows.map(x => ({ area: String(x.area_evaluation), programs: Number(x.n) }));
}

/** Distribuição do conceito final do ciclo quadrienal entre os programas do território (join pela chave do programa no mesmo ano). */
export async function getGraduateEvaluationBands(pool: Q, o: { year: number; uf?: string; municipalityName?: string }) {
  const run = await latest(pool, 'PROGRAM', o.year); if (!run) return [];
  const args: unknown[] = [run, o.year]; let where = 'WHERE y.source_run_id=$1 AND y.reference_year=$2 AND e.final_concept<>\'\'';
  if (o.uf) { args.push(o.uf.toUpperCase()); where += ` AND y.uf=$${args.length}`; }
  if (o.municipalityName) { args.push(o.municipalityName); where += ` AND upper(unaccent(y.municipality_name))=upper(unaccent($${args.length}))`; }
  const r = await pool.query(`SELECT e.final_concept, count(DISTINCT e.capes_program_code)::bigint AS n FROM civica_exec.exec_capes_evaluation e JOIN civica_exec.exec_capes_ppg_year y ON y.capes_program_code=e.capes_program_code ${where} GROUP BY e.final_concept ORDER BY e.final_concept`, args);
  return r.rows.map(x => ({ concept: String(x.final_concept), programs: Number(x.n) }));
}

export async function getGraduateProgramDetail(pool: Q, capesProgramCode: string, year: number) {
  const p = await pool.query(`SELECT * FROM civica_exec.exec_capes_ppg WHERE capes_program_code=$1`, [capesProgramCode]);
  const y = await pool.query(`SELECT * FROM civica_exec.exec_capes_ppg_year WHERE capes_program_code=$1 AND reference_year=$2 ORDER BY source_run_id DESC LIMIT 1`, [capesProgramCode, year]);
  const courses = await pool.query(`SELECT * FROM civica_exec.exec_capes_course_year WHERE capes_program_code=$1 AND reference_year=$2 ORDER BY course_name`, [capesProgramCode, year]);
  const students = await pool.query(`SELECT status_bucket,degree,sum(distinct_student_count)::bigint AS distinct_students,sum(entrant_count)::bigint AS entrants,sum(graduated_count)::bigint AS graduated FROM civica_exec.exec_capes_student_aggregate WHERE capes_program_code=$1 AND reference_year=$2 GROUP BY status_bucket,degree ORDER BY status_bucket,degree`, [capesProgramCode, year]);
  const faculty = await pool.query(`SELECT category,employment_link,work_regime,doctorate_flag,sum(faculty_count)::bigint AS faculty_count FROM civica_exec.exec_capes_faculty_aggregate WHERE capes_program_code=$1 AND reference_year=$2 GROUP BY category,employment_link,work_regime,doctorate_flag`, [capesProgramCode, year]);
  const evaluation = await pool.query(`SELECT cycle,area_evaluation,level,initial_concept,reconsideration_concept,final_concept,publication_date FROM civica_exec.exec_capes_evaluation WHERE capes_program_code=$1 ORDER BY cycle DESC`, [capesProgramCode]);
  return { program: p.rows[0] ?? null, year: y.rows[0] ?? null, courses: courses.rows, students: students.rows, faculty: faculty.rows, evaluations: evaluation.rows };
}

export async function getGraduateTerritorySummary(pool: Q, year: number, uf?: string, municipalityName?: string) {
  const program = await getGraduateProgramOverview(pool, year, uf);
  const args: unknown[] = [year]; let where = 'WHERE reference_year=$1';
  if (uf) { args.push(uf.toUpperCase()); where += ` AND uf=$${args.length}`; }
  if (municipalityName) { args.push(municipalityName); where += ` AND upper(unaccent(municipality_name))=upper(unaccent($${args.length}))`; }
  const facultyArgs: unknown[] = [year]; let facultyWhere = 'WHERE f.reference_year=$1';
  if (uf) { facultyArgs.push(uf.toUpperCase()); facultyWhere += ` AND y.uf=$${facultyArgs.length}`; }
  if (municipalityName) { facultyArgs.push(municipalityName); facultyWhere += ` AND upper(unaccent(y.municipality_name))=upper(unaccent($${facultyArgs.length}))`; }
  const [students, faculty] = await Promise.all([
    pool.query(`SELECT status_bucket,sum(distinct_student_count)::bigint AS students,sum(entrant_count)::bigint AS entrants,sum(graduated_count)::bigint AS graduated FROM civica_exec.exec_capes_student_aggregate ${where} GROUP BY status_bucket ORDER BY status_bucket`, args),
    pool.query(`SELECT sum(f.faculty_count)::bigint AS faculty FROM civica_exec.exec_capes_faculty_aggregate f JOIN civica_exec.exec_capes_ppg_year y ON y.capes_program_code=f.capes_program_code AND y.reference_year=f.reference_year ${facultyWhere}`, facultyArgs),
  ]);
  return { year, uf: uf?.toUpperCase() ?? null, municipalityName: municipalityName ?? null, program, students: students.rows, faculty: faculty.rows[0] ?? null, comparability: 'DESCRIPTIVE_ONLY' };
}
