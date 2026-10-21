import type { Pool } from 'pg';
import { sha256 } from './publication.ts';

type Q = Pick<Pool, 'query'>;
const num = (v: unknown): number | null => v == null ? null : Number(v);
const iso = (v: unknown): string | null => v == null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);

// Evolução, hospitais e residentes: séries do território, distribuições de comparação por ano (pré-calculadas) e consultas únicas.

export const EVOLUTION_CODES = ['IND-SAU-05', 'IND-SAU-05S', 'IND-SAU-08', 'IND-SAU-10', 'IND-SAU-11', 'IND-SAU-12'] as const;
export interface EvolutionPoint { year: number; periodStart: string; value: number | null; numerator: number | null; denominator: number | null; flags: number; partial: boolean }

/**
 * Séries anuais do território numa só consulta: estoque (leitos) = valor de dezembro ou do último mês publicado; indicadores anuais = valor do ano;
 * ICSAP (proporção mensal) = soma anual de numerador e denominador (ano corrente marcado como parcial).
 */
export async function getEvolutionSeries(q: Q, entityId: number): Promise<Record<string, EvolutionPoint[]>> {
  const r = await q.query(`WITH lat AS (SELECT l.indicator_id, max(l.period_start) AS mx FROM civica_exec.exec_ind_latest l JOIN civica_exec.exec_ind_def d USING (indicator_id) WHERE d.code = ANY($2::text[]) GROUP BY 1)
    SELECT d.code, d.grain, v.period_start, v.value, v.numerator, v.denominator, v.flags, v.status, lat.mx
    FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_ind_def d USING (indicator_id) JOIN lat USING (indicator_id)
    WHERE v.entity_id = $1 AND d.code = ANY($2::text[]) AND v.period_start >= DATE '2013-01-01' ORDER BY d.code, v.period_start`, [entityId, [...EVOLUTION_CODES]]);
  const out: Record<string, EvolutionPoint[]> = {};
  const icsap = new Map<number, { n: number; d: number; partial: boolean; last: string }>();
  for (const x of r.rows) {
    const code = String(x.code); const ps = iso(x.period_start)!; const year = Number(ps.slice(0, 4)); const isLast = ps === iso(x.mx);
    if (code === 'IND-SAU-10') {
      const a = icsap.get(year) ?? { n: 0, d: 0, partial: false, last: ps };
      a.n += Number(x.numerator ?? 0); a.d += Number(x.denominator ?? 0); a.partial = a.partial || ps.slice(5, 7) !== '12'; a.last = ps; icsap.set(year, a); continue;
    }
    if (x.grain === 'M' && !(ps.slice(5, 7) === '12' || isLast)) continue;
    const list = out[code] ??= [];
    const point: EvolutionPoint = { year, periodStart: ps, value: num(x.value), numerator: num(x.numerator), denominator: num(x.denominator), flags: Number(x.flags) | (Number(x.status) === 1 ? 2 : 0), partial: x.grain === 'M' && ps.slice(5, 7) !== '12' };
    const prev = list.at(-1);
    if (prev && prev.year === year) list[list.length - 1] = point; else list.push(point);   // dezembro e "último mês" no mesmo ano: fica o mais recente
  }
  out['IND-SAU-10'] = [...icsap].map(([year, a]) => ({ year, periodStart: a.last, value: a.d >= 100 ? a.n / a.d * 100 : null, numerator: a.n, denominator: a.d, flags: a.d >= 100 ? 0 : 1, partial: a.partial }));
  return out;
}

/** Estatística entre territórios do mesmo grupo: [n, p25, p50, p75] por ano e código. SIH-TAXA = internações/1.000 hab.; SIH-NO-MUN = % tratadas no próprio município. */
export type YearStat = [n: number, p25: number, p50: number, p75: number];
export type SeriesBench = Record<string, Record<string, YearStat>>;
export interface BenchSeriesStory { municipalitiesByUf: Record<string, SeriesBench>; brazilMunicipalities: SeriesBench; ufs: SeriesBench }
const PCT3 = [0.25, 0.5, 0.75];
const MIN_GROUP = 10;

async function computeBenchSeries(pool: Pool): Promise<BenchSeriesStory> {
  const out: BenchSeriesStory = { municipalitiesByUf: {}, brazilMunicipalities: {}, ufs: {} };
  const put = (bag: SeriesBench, code: string, year: number, n: number, p: number[]) => { if (n >= MIN_GROUP) (bag[code] ??= {})[String(year)] = [n, p[0]!, p[1]!, p[2]!]; };
  const base = (grp: string) => `WITH mx AS (SELECT indicator_id, max(period_start) p FROM civica_exec.exec_ind_latest GROUP BY 1)
    SELECT d.code, ${grp} AS uf_code, e.kind, extract(year FROM v.period_start)::int AS yr, count(*)::int AS n, percentile_cont($2::float8[]) WITHIN GROUP (ORDER BY v.value) AS pct
    FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_ind_def d USING (indicator_id) JOIN civica_exec.exec_entity e USING (entity_id) JOIN mx USING (indicator_id)
    WHERE d.code = ANY($1::text[]) AND e.kind IN (3, 4) AND v.value IS NOT NULL AND (v.flags & 73) = 0 AND (d.min_denominator IS NULL OR v.denominator >= d.min_denominator)
      AND v.period_start >= DATE '2013-01-01' AND (d.grain = 'A' OR extract(month FROM v.period_start) = 12 OR v.period_start = mx.p)
    GROUP BY 1, 2, 3, 4`;
  const stock = ['IND-SAU-05', 'IND-SAU-05S', 'IND-SAU-08', 'IND-SAU-11', 'IND-SAU-12'];
  const [byUf, br] = await Promise.all([pool.query(base('e.uf_code'), [stock, PCT3]), pool.query(base('NULL::int'), [stock, PCT3])]);
  for (const x of byUf.rows) if (Number(x.kind) === 4) put(out.municipalitiesByUf[String(x.uf_code)] ??= {}, String(x.code), Number(x.yr), Number(x.n), x.pct);
  for (const x of br.rows) { if (Number(x.kind) === 4) put(out.brazilMunicipalities, String(x.code), Number(x.yr), Number(x.n), x.pct); else put(out.ufs, String(x.code), Number(x.yr), Number(x.n), x.pct); }

  // ICSAP: proporção anual (soma de numerador e denominador do ano), com pelo menos 100 AIH no ano
  const ic = await pool.query(`WITH a AS (SELECT e.kind, e.uf_code, extract(year FROM v.period_start)::int yr, sum(v.numerator) n, sum(v.denominator) d
      FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_ind_def d USING (indicator_id) JOIN civica_exec.exec_entity e USING (entity_id)
      WHERE d.code = 'IND-SAU-10' AND e.kind IN (3, 4) AND v.period_start >= DATE '2013-01-01' GROUP BY e.entity_id, 1, 2, 3 HAVING sum(v.denominator) >= 100)
    SELECT kind, uf_code, yr, count(*)::int n, percentile_cont($1::float8[]) WITHIN GROUP (ORDER BY n / d * 100) AS pct FROM a GROUP BY GROUPING SETS ((kind, uf_code, yr), (kind, yr))`, [PCT3]);
  for (const x of ic.rows) {
    if (Number(x.kind) === 4 && x.uf_code != null) put(out.municipalitiesByUf[String(x.uf_code)] ??= {}, 'IND-SAU-10', Number(x.yr), Number(x.n), x.pct);
    else if (Number(x.kind) === 4) put(out.brazilMunicipalities, 'IND-SAU-10', Number(x.yr), Number(x.n), x.pct);
    else if (Number(x.kind) === 3 && x.uf_code == null) put(out.ufs, 'IND-SAU-10', Number(x.yr), Number(x.n), x.pct);
  }

  // SIH: taxa anual por 1.000 hab. e % tratadas no próprio município (município com ≥ 100 AIH no ano e população oficial do ano)
  const sih = await pool.query(`WITH m AS (SELECT s.entity_id, e.uf_code, (s.competence / 100) yr, sum(s.n_aih)::float8 aih, sum(s.n_fora_mun)::float8 fora FROM civica_exec.exec_sau_sih_mun_mes s JOIN civica_exec.exec_entity e USING (entity_id) WHERE e.kind = 4 GROUP BY 1, 2, 3),
    mp AS (SELECT m.*, p.value::float8 pop FROM m JOIN civica_exec.exec_territory_population p ON p.entity_id = m.entity_id AND p.year = m.yr AND p.source = 1 WHERE m.aih >= 100),
    u AS (SELECT uf_code, yr, sum(aih) aih, sum(fora) fora FROM m GROUP BY 1, 2)
    SELECT 'M' lvl, uf_code, yr, count(*)::int n, percentile_cont($1::float8[]) WITHIN GROUP (ORDER BY aih / pop * 1000) rate, percentile_cont($1::float8[]) WITHIN GROUP (ORDER BY (1 - fora / aih) * 100) inmun
    FROM mp GROUP BY GROUPING SETS ((uf_code, yr), (yr))
    UNION ALL
    SELECT 'U', NULL, u.yr, count(*)::int, percentile_cont($1::float8[]) WITHIN GROUP (ORDER BY u.aih / p.value * 1000), percentile_cont($1::float8[]) WITHIN GROUP (ORDER BY (1 - u.fora / u.aih) * 100)
    FROM u JOIN civica_exec.exec_territory_population p ON p.entity_id = u.uf_code AND p.year = u.yr AND p.source = 1 GROUP BY u.yr`, [PCT3]);
  for (const x of sih.rows) {
    const apply = (bag: SeriesBench) => { put(bag, 'SIH-TAXA', Number(x.yr), Number(x.n), x.rate); put(bag, 'SIH-NO-MUN', Number(x.yr), Number(x.n), x.inmun); };
    if (x.lvl === 'U') apply(out.ufs); else if (x.uf_code != null) apply(out.municipalitiesByUf[String(x.uf_code)] ??= {}); else apply(out.brazilMunicipalities);
  }
  return out;
}

/** Comparações por ano reconstruídas só quando os ponteiros de publicação mudam; uma leitura de uma linha por requisição. */
export async function readBenchSeries(pool: Pool): Promise<BenchSeriesStory> {
  const key = sha256(`benchseries-v1:${(await pool.query(`SELECT dataset_id, uf, competence, run_id FROM civica_exec.exec_publication WHERE dataset_id IN (2, 3, 4, 7, 8, 10, 11) ORDER BY 1, 2, 3`)).rows.map(r => `${r.dataset_id}.${r.uf}.${r.competence}.${r.run_id}`).join('|')}`);
  const cur = (await pool.query(`SELECT source_key, payload FROM civica_exec.exec_story WHERE entity_id = 76 AND domain = 1 AND section = 'bench_series_saude'`)).rows[0];
  if (cur && cur.source_key === key) return cur.payload as BenchSeriesStory;
  const payload = await computeBenchSeries(pool);
  await pool.query(`INSERT INTO civica_exec.exec_story (entity_id, domain, section, source_key, built_at, payload) VALUES (76, 1, 'bench_series_saude', $1, now(), $2::jsonb)
    ON CONFLICT (entity_id, domain, section) DO UPDATE SET source_key = EXCLUDED.source_key, built_at = EXCLUDED.built_at, payload = EXCLUDED.payload`, [key, JSON.stringify(payload)]);
  return payload;
}

export interface ResidentMonth { competence: number; aih: number; icsap: number; outside: number; valueCents: number; days: number; deaths: number }
export interface ResidentSummary { months: ResidentMonth[]; population: Record<string, number> }
/** Internações de residentes por mês (município ou UF) e população anual, em duas consultas paralelas. Meses ausentes não são preenchidos. */
export async function getResidentSummary(q: Q, o: { entityId: number; ufCode?: number }): Promise<ResidentSummary> {
  const scope = o.ufCode ? 's.entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE uf_code = $1 AND kind IN (4, 5))' : 's.entity_id = $1';
  const [m, p] = await Promise.all([
    q.query(`SELECT s.competence, sum(s.n_aih)::int aih, sum(s.n_icsap)::int icsap, sum(s.n_fora_mun)::int outside, sum(s.valor_cents)::bigint val, sum(s.dias_perm)::bigint days, sum(s.obitos)::int deaths
      FROM civica_exec.exec_sau_sih_mun_mes s WHERE ${scope} GROUP BY 1 ORDER BY 1`, [o.ufCode ?? o.entityId]),
    q.query(`SELECT year, value FROM civica_exec.exec_territory_population WHERE entity_id = $1 AND source = 1`, [o.entityId]),
  ]);
  return {
    months: m.rows.map(x => ({ competence: Number(x.competence), aih: Number(x.aih), icsap: Number(x.icsap), outside: Number(x.outside), valueCents: Number(x.val), days: Number(x.days), deaths: Number(x.deaths) })),
    population: Object.fromEntries(p.rows.map(x => [String(x.year), Number(x.value)])),
  };
}

export interface HospitalShare { cnes: number; name: string | null; typeLabel: string; sus: boolean; aih: number; valueCents: number; days: number; deaths: number; icsap: number; bedsExisting: number; bedsSus: number }
/** Estabelecimentos que mais atenderam nos últimos 12 meses publicados (município ou UF) e o total de AIH de residentes no mesmo período, em poucas consultas fixas. */
export async function getHospitalShare(q: Q, o: { municipalityId?: number; ufCode?: number }): Promise<{ from: number; to: number; hospitals: HospitalShare[]; hospitalsTotalAih: number; residentsAih: number }> {
  const to = Number((await q.query(`SELECT max(competence)::int m FROM civica_exec.exec_publication WHERE dataset_id = 10`)).rows[0]?.m ?? 0);
  if (!to) return { from: 0, to: 0, hospitals: [], hospitalsTotalAih: 0, residentsAih: 0 };
  const from = to % 100 === 12 ? to - 11 : to - 11 - 88;
  const where = o.municipalityId ? 'c.entity_id = $1' : 'h.uf = $1'; const key = o.municipalityId ?? o.ufCode!;
  const r = await q.query(`WITH h AS (SELECT h.cnes, sum(h.n_aih)::int aih, sum(h.valor_cents)::bigint val, sum(h.dias_perm)::bigint dias, sum(h.obitos)::int ob, sum(h.n_icsap)::int ic
      FROM civica_exec.exec_sau_hosp_mes_subgrupo h JOIN civica_exec.exec_sau_cnes_estab c USING (cnes) WHERE ${where} AND h.competence BETWEEN $2 AND $3 GROUP BY 1),
    tot AS (SELECT coalesce(sum(aih), 0)::bigint t FROM h),
    top AS (SELECT * FROM h ORDER BY aih DESC LIMIT 12)
    SELECT top.*, tot.t, c.name, v.vinc_sus, coalesce(rc.label, v.tp_unid::text) AS tlabel,
      (SELECT coalesce(sum(l.qt_exist) FILTER (WHERE l.tp_leito <> 7), 0)::int FROM civica_exec.exec_sau_cnes_leito_v l WHERE l.cnes = top.cnes AND l.valid_to IS NULL) bex,
      (SELECT coalesce(sum(l.qt_sus) FILTER (WHERE l.tp_leito <> 7), 0)::int FROM civica_exec.exec_sau_cnes_leito_v l WHERE l.cnes = top.cnes AND l.valid_to IS NULL) bsus
    FROM top CROSS JOIN tot JOIN civica_exec.exec_sau_cnes_estab c ON c.cnes = top.cnes LEFT JOIN civica_exec.exec_sau_cnes_estab_v v ON v.cnes = top.cnes AND v.valid_to IS NULL
    LEFT JOIN civica_exec.exec_ref_code rc ON rc.domain = 3 AND rc.code = v.tp_unid::text ORDER BY top.aih DESC`, [key, from, to]);
  const resScope = o.municipalityId ? 's.entity_id = $1' : 's.entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE uf_code = $1 AND kind IN (4, 5))';
  const res = await q.query(`SELECT coalesce(sum(s.n_aih), 0)::bigint t FROM civica_exec.exec_sau_sih_mun_mes s WHERE ${resScope} AND s.competence BETWEEN $2 AND $3`, [key, from, to]);
  return {
    from, to, residentsAih: Number(res.rows[0].t), hospitalsTotalAih: Number(r.rows[0]?.t ?? 0),
    hospitals: r.rows.map(x => ({ cnes: Number(x.cnes), name: x.name ?? null, typeLabel: String(x.tlabel), sus: Boolean(x.vinc_sus), aih: Number(x.aih), valueCents: Number(x.val), days: Number(x.dias), deaths: Number(x.ob), icsap: Number(x.ic), bedsExisting: Number(x.bex), bedsSus: Number(x.bsus) })),
  };
}
