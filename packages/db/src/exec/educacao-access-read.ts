import type { Pool } from 'pg';

type Q = Pick<Pool, 'query'>;

export async function getProuniOverview(q: Q, o: { year?: number; municipalityName?: string; uf?: string } = {}) {
  const args: unknown[] = [];
  const where: string[] = ["r.program='PROUNI'", "r.status='published'"];
  if (o.year) { args.push(o.year); where.push(`f.grant_year=$${args.length}`); }
  if (o.uf) { args.push(o.uf.toUpperCase()); where.push(`f.offer_uf=$${args.length}`); }
  if (o.municipalityName) { args.push(o.municipalityName); where.push(`f.offer_municipality_name=$${args.length}`); }
  const sql = `SELECT f.grant_year AS year, sum(f.granted_count)::bigint AS granted, sum(f.granted_count) FILTER (WHERE upper(f.scholarship_type) LIKE '%INTEGRAL%')::bigint AS integral, sum(f.granted_count) FILTER (WHERE upper(f.scholarship_type) LIKE '%PARCIAL%')::bigint AS partial, count(DISTINCT f.co_ies)::bigint AS institutions, count(DISTINCT NULLIF(f.source_course_key,''))::bigint AS courses, count(DISTINCT NULLIF(f.offer_municipality_name,''))::bigint AS municipalities FROM civica_exec.exec_prouni_fact f JOIN civica_exec.exec_access_source_run r ON r.source_run_id=f.source_run_id WHERE ${where.join(' AND ')} GROUP BY f.grant_year ORDER BY f.grant_year DESC`;
  return (await q.query(sql, args)).rows.map(r => ({ year: Number(r.year), granted: r.granted == null ? null : Number(r.granted), integral: r.integral == null ? null : Number(r.integral), partial: r.partial == null ? null : Number(r.partial), institutions: r.institutions == null ? null : Number(r.institutions), courses: r.courses == null ? null : Number(r.courses), municipalities: r.municipalities == null ? null : Number(r.municipalities) }));
}

export async function getProuniSeries(q: Q, o: { uf?: string } = {}) {
  return getProuniOverview(q, o);
}

export async function searchProuniInstitutions(q: Q, o: { year?: number; uf?: string; text?: string; page?: number; pageSize?: number } = {}) {
  const page = Math.max(o.page ?? 1, 1), size = Math.min(Math.max(o.pageSize ?? 25, 1), 100);
  const args: unknown[] = []; const where: string[] = ["r.program='PROUNI'", "r.status='published'"];
  if (o.year) { args.push(o.year); where.push(`f.grant_year=$${args.length}`); }
  if (o.uf) { args.push(o.uf.toUpperCase()); where.push(`f.offer_uf=$${args.length}`); }
  if (o.text?.trim()) { args.push(`%${o.text.trim()}%`); where.push(`(f.source_ies_key ILIKE $${args.length} OR f.source_course_key ILIKE $${args.length})`); }
  args.push(size, (page - 1) * size);
  return (await q.query(`SELECT f.grant_year AS year,f.co_ies,f.source_ies_key,f.source_course_key,f.offer_municipality_name,f.offer_uf,f.scholarship_type,sum(f.granted_count)::bigint AS granted FROM civica_exec.exec_prouni_fact f JOIN civica_exec.exec_access_source_run r ON r.source_run_id=f.source_run_id WHERE ${where.join(' AND ')} GROUP BY f.grant_year,f.co_ies,f.source_ies_key,f.source_course_key,f.offer_municipality_name,f.offer_uf,f.scholarship_type ORDER BY f.grant_year DESC,granted DESC LIMIT $${args.length - 1} OFFSET $${args.length}`, args)).rows;
}

export async function getFiesOverview(q: Q, o: { year?: number; semester?: number; stage?: string; uf?: string } = {}) {
  const args: unknown[] = []; const where: string[] = ["r.program='FIES'", "r.status='published'"];
  if (o.year) { args.push(o.year); where.push(`f.process_year=$${args.length}`); }
  if (o.semester) { args.push(o.semester); where.push(`f.semester=$${args.length}`); }
  if (o.stage) { args.push(o.stage); where.push(`f.stage=$${args.length}`); }
  if (o.uf) { args.push(o.uf.toUpperCase()); where.push(`f.uf=$${args.length}`); }
  return (await q.query(`SELECT f.process_year AS year,f.semester,f.stage,sum(f.record_count)::bigint AS records,count(DISTINCT f.co_ies)::bigint AS institutions,count(DISTINCT NULLIF(f.municipality_name,''))::bigint AS municipalities FROM civica_exec.exec_fies_fact f JOIN civica_exec.exec_access_source_run r ON r.source_run_id=f.source_run_id WHERE ${where.join(' AND ')} GROUP BY f.process_year,f.semester,f.stage ORDER BY f.process_year DESC,f.semester DESC,f.stage`, args)).rows;
}

export async function getFiesSeries(q: Q, o: { stage?: string; uf?: string } = {}) {
  return getFiesOverview(q, o);
}

export async function getAccessProgramComparison(q: Q, o: { program: 'PROUNI'|'FIES'; year: number; semester?: number; stage?: string; scope: 'BR'|'UF'|'MUNICIPALITY'; scopeKey?: string } ) {
  const scope = o.scope === 'BR' ? 1 : o.scope === 'UF' ? 3 : 4;
  const key = o.scope === 'BR' ? 'BR' : String(o.scopeKey ?? '').toUpperCase();
  const args: unknown[] = [o.program, o.year, o.semester ?? 0, o.stage ?? '', scope, key];
  return (await q.query(`SELECT program,period_year AS year,semester,stage,scope,scope_key,granted_or_records,integral_count,partial_count,institution_count,course_count,source_run_id,refreshed_at FROM civica_exec.exec_access_territory_year WHERE program=$1 AND period_year=$2 AND semester=$3 AND stage=$4 AND scope=$5 AND scope_key=$6`, args)).rows[0] ?? null;
}
