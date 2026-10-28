import type { Pool } from 'pg';

type Q = Pick<Pool, 'query'>;
export type HigherScope = { ibge7?: string; uf?: string; year?: number };
const scopeOf = (o: HigherScope) => o.ibge7 ? { scope: 4, key: String(Number(o.ibge7)) } : o.uf ? { scope: 3, key: o.uf.toUpperCase() } : { scope: 1, key: 'BR' };
const n = (v: unknown) => v == null ? null : Number(v);

/** Última edição publicada do Censo da Educação Superior; nunca assume um ano fixo. */
export async function latestHigherEdYear(q: Q): Promise<number | null> {
  const r = await q.query(`SELECT max(year)::int AS y FROM civica_exec.exec_edu_higher_coverage WHERE status='published'`);
  return r.rows[0]?.y != null ? Number(r.rows[0].y) : null;
}

export async function getHigherEducationTerritoryOverview(q: Q, o: HigherScope = {}, year = 2024) {
  const s = scopeOf(o);
  const row = (await q.query(`SELECT scope,scope_key,year,ies_count,course_count,offer_count,municipalities_count,public_ies_count,private_ies_count,in_person_offer_count,distance_offer_count,vacancies,applicants,entrants,enrollments,graduates,source_run_id,refreshed_at FROM civica_exec.exec_edu_higher_territory_year WHERE scope=$1 AND scope_key=$2 AND year=$3`, [s.scope, s.key, year])).rows[0];
  if (!row) return null;
  return { scope: Number(row.scope), scopeKey: String(row.scope_key), year: Number(row.year), ies: Number(row.ies_count), courses: Number(row.course_count), offers: Number(row.offer_count), municipalities: Number(row.municipalities_count), publicIes: n(row.public_ies_count), privateIes: n(row.private_ies_count), inPersonOffers: Number(row.in_person_offer_count), distanceOffers: Number(row.distance_offer_count), vacancies: n(row.vacancies), applicants: n(row.applicants), entrants: n(row.entrants), enrollments: n(row.enrollments), graduates: n(row.graduates), sourceRunId: Number(row.source_run_id), refreshedAt: new Date(row.refreshed_at).toISOString() };
}

export async function getHigherEducationSeries(q: Q, o: HigherScope = {}, from = 2022, to = 2024) {
  const s = scopeOf(o);
  return (await q.query(`SELECT year,ies_count ies,course_count courses,offer_count offers,municipalities_count municipalities,vacancies,applicants,entrants,enrollments,graduates FROM civica_exec.exec_edu_higher_territory_year WHERE scope=$1 AND scope_key=$2 AND year BETWEEN $3 AND $4 ORDER BY year`, [s.scope, s.key, from, to])).rows.map(r => Object.fromEntries(Object.entries(r).map(([k,v]) => [k, ['year','ies','courses','offers','municipalities'].includes(k) ? Number(v) : n(v)])));
}

/**
 * Filtra por município/UF da OFERTA (`exec_edu_higher_offer_year`), nunca pela sede da IES (`y.entity_id`/`y.uf`): uma IES com
 * sede em outro território pode ofertar aqui (ex.: polo de EAD) — mesmo padrão de bug já corrigido no CAPES (ver
 * `educacao-capes-read.ts`), confirmado contra o dado real (3 IES com polo em Águia Branca/ES, nenhuma com sede lá).
 */
export async function searchHigherEducationIes(q: Q, o: { text?: string; uf?: string; ibge7?: string; year?: number; page?: number; pageSize?: number } = {}) {
  const year = o.year ?? 2024, pageSize = Math.min(Math.max(o.pageSize ?? 25, 1), 100), page = Math.max(o.page ?? 1, 1);
  const args: unknown[] = [year], where = ['y.year=$1'];
  if (o.ibge7) { args.push(Number(o.ibge7)); where.push(`y.co_ies IN (SELECT DISTINCT co_ies FROM civica_exec.exec_edu_higher_offer_year WHERE year=$1 AND entity_id=$${args.length})`); }
  else if (o.uf) { args.push(o.uf.toUpperCase()); where.push(`y.co_ies IN (SELECT DISTINCT co_ies FROM civica_exec.exec_edu_higher_offer_year WHERE year=$1 AND uf=$${args.length})`); }
  if (o.text?.trim()) { args.push(`%${o.text.trim()}%`); where.push(`(y.name ILIKE $${args.length} OR y.mantenedora ILIKE $${args.length})`); }
  const count = await q.query(`SELECT count(*)::bigint AS n FROM civica_exec.exec_edu_higher_ies_year y WHERE ${where.join(' AND ')}`, args);
  args.push(pageSize, (page - 1) * pageSize);
  const rows = (await q.query(`SELECT y.co_ies,y.name,y.sigla,y.uf,y.entity_id,y.tp_rede,y.tp_categoria_administrativa,y.qt_doc_total FROM civica_exec.exec_edu_higher_ies_year y WHERE ${where.join(' AND ')} ORDER BY y.name,y.co_ies LIMIT $${args.length - 1} OFFSET $${args.length}`, args)).rows;
  return { total: Number(count.rows[0]?.n ?? 0), page, pageSize, items: rows };
}

export async function searchHigherEducationCourses(q: Q, o: { text?: string; coIes?: number; ibge7?: string; uf?: string; year?: number; page?: number; pageSize?: number } = {}) {
  const year = o.year ?? 2024, pageSize = Math.min(Math.max(o.pageSize ?? 25, 1), 100), page = Math.max(o.page ?? 1, 1);
  const args: unknown[] = [year], where = ['o.year=$1'];
  if (o.coIes != null) { args.push(o.coIes); where.push(`o.co_ies=$${args.length}`); }
  if (o.ibge7) { args.push(Number(o.ibge7)); where.push(`o.entity_id=(SELECT entity_id FROM civica_exec.exec_entity WHERE kind=4 AND ibge7=$${args.length})`); }
  else if (o.uf) { args.push(o.uf.toUpperCase()); where.push(`o.uf=$${args.length}`); }
  if (o.text?.trim()) { args.push(`%${o.text.trim()}%`); where.push(`o.nome_curso ILIKE $${args.length}`); }
  const count = await q.query(`SELECT count(*)::bigint AS n FROM civica_exec.exec_edu_higher_offer_year o WHERE ${where.join(' AND ')}`, args);
  args.push(pageSize, (page - 1) * pageSize);
  const rows = (await q.query(`SELECT o.year,o.co_ies,o.co_curso,NULLIF(o.co_municipio,0) co_municipio,o.entity_id,o.uf,o.tp_modalidade,o.tp_dimensao,o.nome_curso,o.qt_vg_total vacancies,o.qt_inscrito_total applicants,o.qt_ing entrants,o.qt_mat enrollments,o.qt_conc graduates FROM civica_exec.exec_edu_higher_offer_year o WHERE ${where.join(' AND ')} ORDER BY o.nome_curso,o.co_ies,o.co_curso LIMIT $${args.length - 1} OFFSET $${args.length}`, args)).rows;
  return { total: Number(count.rows[0]?.n ?? 0), page, pageSize, items: rows };
}

/** Maiores cursos por matrícula no território (destaque por TAMANHO, nunca por qualidade). */
export async function getTopHigherEducationCourses(q: Q, o: HigherScope = {}, year = 2024, limit = 5) {
  const args: unknown[] = [year]; const where = ['o.year=$1', 'o.qt_mat IS NOT NULL'];
  if (o.ibge7) { args.push(Number(o.ibge7)); where.push(`o.entity_id=(SELECT entity_id FROM civica_exec.exec_entity WHERE kind=4 AND ibge7=$${args.length})`); }
  else if (o.uf) { args.push(o.uf.toUpperCase()); where.push(`o.uf=$${args.length}`); }
  args.push(limit);
  const r = await q.query(`SELECT o.nome_curso,o.tp_modalidade,o.qt_mat enrollments,o.co_ies,o.co_curso FROM civica_exec.exec_edu_higher_offer_year o WHERE ${where.join(' AND ')} ORDER BY o.qt_mat DESC LIMIT $${args.length}`, args);
  return r.rows.map(x => ({ courseName: String(x.nome_curso), modality: Number(x.tp_modalidade), enrollments: Number(x.enrollments), coIes: Number(x.co_ies), coCurso: Number(x.co_curso) }));
}

export async function getHigherEducationComparison(q: Q, ibge7: string, year = 2024) {
  const municipality = await getHigherEducationTerritoryOverview(q, { ibge7 }, year); if (!municipality) return null;
  const ufRow = (await q.query(`SELECT uf FROM civica_exec.exec_entity WHERE kind=4 AND ibge7=$1::int`, [ibge7])).rows[0];
  const uf = ufRow?.uf ? String(ufRow.uf).trim() : null;
  if (!uf) return { year, municipality, state: null, brazil: await getHigherEducationTerritoryOverview(q, {}, year), descriptiveOnly: true, caveats: ['UF não resolvida no cadastro territorial; não inferir comparação estadual.'] };
  const [state, brazil] = await Promise.all([getHigherEducationTerritoryOverview(q, { uf }, year), getHigherEducationTerritoryOverview(q, {}, year)]);
  return { year, municipality, state, brazil, descriptiveOnly: true, caveats: ['Oferta EAD sem dimensão territorial não é atribuída a município/UF.', 'Comparação é descritiva; ausência de registro não é zero.'] };
}
