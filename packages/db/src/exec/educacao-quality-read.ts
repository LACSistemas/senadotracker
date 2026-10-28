import type { Pool } from 'pg';

type Q = Pick<Pool, 'query'>;
const num = (v: unknown) => v == null ? null : Number(v);

/** Último ciclo publicado de um indicador de qualidade (IGC/CPC/ENADE/IDD); nunca assume um ano fixo. */
export async function latestQualityYear(q: Q, indicator: 'IGC' | 'CPC' | 'ENADE' | 'IDD'): Promise<number | null> {
  const r = await q.query(`SELECT max(reference_year)::int AS y FROM civica_exec.exec_edu_quality_coverage WHERE indicator=$1`, [indicator]);
  return r.rows[0]?.y != null ? Number(r.rows[0].y) : null;
}

export async function getInstitutionQualityOverview(q: Q, coIes: number) {
  const latest = (await q.query(`SELECT DISTINCT ON (co_ies) reference_year,co_ies,uf,name,academic_organization,administrative_category,igc_continuous,igc_band,courses_with_cpc,source_run_id FROM civica_exec.exec_edu_quality_ies WHERE co_ies=$1 ORDER BY co_ies,reference_year DESC`, [coIes])).rows[0];
  if (!latest) return null;
  return { ...latest, referenceYear: Number(latest.reference_year), coIes: Number(latest.co_ies), igcContinuous: num(latest.igc_continuous), igcBand: num(latest.igc_band), coursesWithCpc: num(latest.courses_with_cpc), sourceRunId: Number(latest.source_run_id) };
}

export async function getInstitutionQualitySeries(q: Q, coIes: number) {
  return (await q.query(`SELECT reference_year,igc_continuous,igc_band,courses_with_cpc,source_run_id FROM civica_exec.exec_edu_quality_ies WHERE co_ies=$1 ORDER BY reference_year`, [coIes])).rows.map(r => ({ year: Number(r.reference_year), igcContinuous: num(r.igc_continuous), igcBand: num(r.igc_band), coursesWithCpc: num(r.courses_with_cpc), sourceRunId: Number(r.source_run_id) }));
}

export async function getCourseQualityOverview(q: Q, coCurso: number) {
  return (await q.query(`SELECT DISTINCT ON (co_curso,indicator) indicator,reference_year,co_ies,co_curso,co_municipio,uf,area_code,area_name,degree,modality,course_name,continuous_value,band,crosswalk_status,source_run_id FROM civica_exec.exec_edu_quality_course WHERE co_curso=$1 ORDER BY co_curso,indicator,reference_year DESC`, [coCurso])).rows.map(r => ({ ...r, year: Number(r.reference_year), coIes: num(r.co_ies), coCurso: Number(r.co_curso), municipality: num(r.co_municipio), continuousValue: num(r.continuous_value), band: num(r.band), sourceRunId: Number(r.source_run_id) }));
}

export async function getCourseQualitySeries(q: Q, coCurso: number, indicator?: 'CPC'|'ENADE'|'IDD') {
  const args: unknown[] = [coCurso]; let where = 'co_curso=$1';
  if (indicator) { args.push(indicator); where += ' AND indicator=$2'; }
  return (await q.query(`SELECT indicator,reference_year,continuous_value,band,area_code,area_name,source_run_id,crosswalk_status FROM civica_exec.exec_edu_quality_course WHERE ${where} ORDER BY indicator,reference_year`, args)).rows.map(r => ({ indicator: r.indicator, year: Number(r.reference_year), continuousValue: num(r.continuous_value), band: num(r.band), areaCode: r.area_code, areaName: r.area_name, sourceRunId: Number(r.source_run_id), crosswalkStatus: r.crosswalk_status }));
}

export async function getTerritorialQualityOverview(q: Q, o: { ibge7?: string; uf?: string; indicator?: string; year?: number } = {}) {
  const scope = o.ibge7 ? 4 : o.uf ? 3 : 1; const key = o.ibge7 ? String(Number(o.ibge7)) : o.uf ? o.uf.toUpperCase() : 'BR';
  const args: unknown[] = [scope, key]; let where = 'scope=$1 AND scope_key=$2';
  if (o.indicator) { args.push(o.indicator); where += ` AND indicator=$${args.length}`; }
  if (o.year) { args.push(o.year); where += ` AND reference_year=$${args.length}`; }
  const rows = (await q.query(`SELECT indicator,reference_year,scope,scope_key,evaluated_ies,evaluated_courses,published_rows,band_distribution,source_run_id,refreshed_at FROM civica_exec.exec_edu_quality_territory_year WHERE ${where} ORDER BY indicator,reference_year`, args)).rows;
  return rows.map(r => ({ indicator: r.indicator, year: Number(r.reference_year), scope: Number(r.scope), scopeKey: r.scope_key, evaluatedIes: Number(r.evaluated_ies), evaluatedCourses: Number(r.evaluated_courses), publishedRows: Number(r.published_rows), bandDistribution: r.band_distribution, sourceRunId: Number(r.source_run_id), refreshedAt: new Date(r.refreshed_at).toISOString() }));
}

/**
 * Distribuição do IGC por faixa, só em nível de UF: `exec_edu_quality_territory_year` não tem linhas de IGC em escopo 3/4 (só
 * Brasil) e `exec_edu_quality_ies` não guarda município — o IGC é um índice por IES (sede), não por município, e o universo de
 * IES por município costuma ser pequeno demais para uma distribuição. Em nível de município, use `getQualityHighlights`.
 */
export async function getIgcBandDistribution(q: Q, uf: string, year: number) {
  const r = await q.query(`SELECT igc_band, count(*)::bigint AS n FROM civica_exec.exec_edu_quality_ies WHERE uf=$1 AND reference_year=$2 AND igc_band IS NOT NULL GROUP BY igc_band ORDER BY igc_band`, [uf.toUpperCase(), year]);
  return r.rows.map(x => ({ band: Number(x.igc_band), n: Number(x.n) }));
}

export interface QualityHighlight { indicator: 'CPC' | 'ENADE' | 'IDD'; year: number; courseName: string; areaName: string; institutionName: string | null; band: number }
/** Destaques descritivos: cursos no topo da faixa oficial (um indicador + um ciclo + uma área por vez, nunca combinado). */
export async function getQualityHighlights(q: Q, o: { ibge7?: string; uf?: string; indicator: 'CPC' | 'ENADE' | 'IDD'; year: number; band?: number }, limit = 4): Promise<QualityHighlight[]> {
  const band = o.band ?? 5; const args: unknown[] = [o.indicator, o.year, band]; const where = ['c.indicator=$1', 'c.reference_year=$2', 'c.band=$3', `c.crosswalk_status='OFFICIAL_LINK'`];
  if (o.ibge7) { args.push(Number(o.ibge7)); where.push(`c.co_municipio=$${args.length}`); } else if (o.uf) { args.push(o.uf.toUpperCase()); where.push(`c.uf=$${args.length}`); }
  args.push(limit);
  const r = await q.query(`SELECT c.course_name,c.area_name,c.band,i.canonical_name AS institution_name FROM civica_exec.exec_edu_quality_course c LEFT JOIN civica_exec.exec_edu_higher_ies i ON i.co_ies=c.co_ies WHERE ${where.join(' AND ')} ORDER BY c.course_name LIMIT $${args.length}`, args);
  return r.rows.map(x => ({ indicator: o.indicator, year: o.year, courseName: String(x.course_name), areaName: String(x.area_name), institutionName: x.institution_name ?? null, band: Number(x.band) }));
}

export async function searchQuality(q: Q, o: { text?: string; uf?: string; ibge7?: string; indicator?: string; year?: number; page?: number; pageSize?: number } = {}) {
  const page = Math.max(o.page ?? 1, 1), size = Math.min(Math.max(o.pageSize ?? 25, 1), 100); const args: unknown[] = []; const where: string[] = [];
  if (o.indicator) { args.push(o.indicator); where.push(`indicator=$${args.length}`); }
  if (o.year) { args.push(o.year); where.push(`reference_year=$${args.length}`); }
  if (o.uf) { args.push(o.uf.toUpperCase()); where.push(`uf=$${args.length}`); }
  if (o.ibge7) { args.push(Number(o.ibge7)); where.push(`co_municipio=$${args.length}`); }
  if (o.text?.trim()) { args.push(`%${o.text.trim()}%`); where.push(`(course_name ILIKE $${args.length} OR area_name ILIKE $${args.length})`); }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const count = await q.query(`SELECT count(*)::bigint AS n FROM civica_exec.exec_edu_quality_course ${whereSql}`, args);
  args.push(size, (page - 1) * size);
  const rows = (await q.query(`SELECT indicator,reference_year,co_ies,co_curso,co_municipio,uf,area_name,course_name,continuous_value,band,crosswalk_status FROM civica_exec.exec_edu_quality_course ${whereSql} ORDER BY reference_year DESC,course_name LIMIT $${args.length-1} OFFSET $${args.length}`, args)).rows;
  return { total: Number(count.rows[0]?.n ?? 0), page, pageSize: size, items: rows };
}
