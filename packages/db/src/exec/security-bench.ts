import type { Pool } from 'pg';
import { FLAG } from './indicator-defs.ts';
import { ORG_KINDS, SEC_THEMES } from './pncp-build.ts';

/**
 * Leituras de apoio à experiência de Segurança (P9.8): benchmarks metodologicamente válidos e exploração sob demanda. Somente SELECT.
 *
 * BENCHMARK VÁLIDO = mesma fonte, mesmo indicador, mesma unidade, mesmo período, denominador oficial do MESMO ano, cobertura suficiente e supressão tratada.
 * Nunca interpola população (2022–2023 não têm estimativa) e nunca compara fontes diferentes.
 */
type Q = Pick<Pool, 'query'>;
const BAD_RATE_FLAGS = FLAG.smallN | FLAG.suppressed | FLAG.noDenominator;
export const BENCH_MIN_MUNICIPALITIES = 5;
export const BENCH_MIN_COVERAGE = 0.8;
export const BENCH_RATE_MIN_POPULATION = 20000;
/** Faixas de porte (habitantes) usadas como critério explícito de "municípios semelhantes": 20–100 mil, 100–500 mil, 500 mil ou mais. Abaixo de 20 mil a taxa é instável e não é comparada. */
export const SIZE_BANDS = [{ key: 'm20_100', label: 'de 20 a 100 mil habitantes', min: 20000, max: 100000 }, { key: 'm100_500', label: 'de 100 a 500 mil habitantes', min: 100000, max: 500000 }, { key: 'm500', label: 'de 500 mil habitantes ou mais', min: 500000, max: 1e12 }] as const;
export type SizeBand = (typeof SIZE_BANDS)[number];
export const sizeBandOf = (population: number | null): SizeBand | null => population == null ? null : (SIZE_BANDS.find(b => population >= b.min && population < b.max) ?? null);

export interface BenchPoint { period: string; n: number; universe: number; p25: number; p50: number; p75: number }
const f = (v: unknown): number => Number(v);
const pt = (r: { p: string; n: unknown; u: unknown; p25: unknown; p50: unknown; p75: unknown }): BenchPoint => ({ period: String(r.p).slice(0, 10), n: f(r.n), universe: f(r.u), p25: f(r.p25), p50: f(r.p50), p75: f(r.p75) });

/**
 * Municípios da UF × um indicador JÁ PUBLICADO COMO TAXA (ex.: SIM 3006, VDE 3201): quartis por período entre municípios com taxa válida (população ≥ 20 mil no ano, sem pequeno número, sem supressão).
 * O território analisado entra no grupo quando também é elegível. `universe` = municípios da UF.
 */
export async function readMunicipalRateBench(q: Q, o: { ufCode: number; indicatorId: number; band?: { min: number; max: number } }): Promise<BenchPoint[]> {
  const r = await q.query(`SELECT v.period_start::text AS p, count(*)::int AS n, (SELECT count(*)::int FROM civica_exec.exec_entity WHERE kind = 4 AND uf_code = $2) AS u,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY v.value) AS p25, percentile_cont(0.5) WITHIN GROUP (ORDER BY v.value) AS p50, percentile_cont(0.75) WITHIN GROUP (ORDER BY v.value) AS p75
    FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e USING (entity_id)
    WHERE v.indicator_id = $1 AND e.kind = 4 AND e.uf_code = $2 AND v.value IS NOT NULL AND (v.flags & $3) = 0 AND ($5::float8 IS NULL OR (v.denominator >= $5 AND v.denominator < $6))
    GROUP BY v.period_start HAVING count(*) >= $4 ORDER BY v.period_start`, [o.indicatorId, o.ufCode, BAD_RATE_FLAGS, BENCH_MIN_MUNICIPALITIES, o.band?.min ?? null, o.band?.max ?? null]);
  return r.rows.map(pt);
}
/** As 27 UFs × um indicador publicado como taxa: quartis por período (mediana das UFs). */
export async function readUfRateBench(q: Q, o: { indicatorId: number }): Promise<BenchPoint[]> {
  const r = await q.query(`SELECT v.period_start::text AS p, count(*)::int AS n, 27 AS u,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY v.value) AS p25, percentile_cont(0.5) WITHIN GROUP (ORDER BY v.value) AS p50, percentile_cont(0.75) WITHIN GROUP (ORDER BY v.value) AS p75
    FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_entity e USING (entity_id)
    WHERE v.indicator_id = $1 AND e.kind = 3 AND v.value IS NOT NULL AND (v.flags & $2) = 0
    GROUP BY v.period_start HAVING count(*) >= $3 ORDER BY v.period_start`, [o.indicatorId, FLAG.suppressed | FLAG.noDenominator, 20]);
  return r.rows.map(pt);
}

export type CrimeBenchStatus = 'ok' | 'sem_populacao_do_ano' | 'ano_incompleto' | 'cobertura_insuficiente' | 'celulas_suprimidas' | 'grupo_pequeno' | 'sem_dados';
export interface CrimeBenchYear { year: number; status: CrimeBenchStatus; n: number; universe: number; p25: number | null; p50: number | null; p75: number | null; own: { total: number; population: number; rate: number } | null }
/**
 * Fonte estadual municipalizada (P9.6): taxa anual por 100 mil = Σ do ano dos indicadores informados ÷ população do MESMO ano × 100 mil, por município.
 * Valida: 12 meses publicados no nível da UF; população oficial do ano (2022–2023 não existem); ≥ 5 municípios com população ≥ 20 mil e ≥ 80% desse universo com registro (fonte de eventos:
 * município sem linha é ausência, nunca zero); nenhuma célula suprimida (valor oculto distorceria o grupo). Os indicadores informados devem ser categorias EXCLUSIVAS da mesma fonte.
 */
export async function readCrimeRateBench(q: Q, o: { ufCode: number; indicatorIds: number[]; entityId?: number; fromYear?: number; band?: { min: number; max: number } }): Promise<CrimeBenchYear[]> {
  const lo = o.band?.min ?? BENCH_RATE_MIN_POPULATION, hi = o.band?.max ?? 1e12;
  const from = o.fromYear ?? 2013;
  const r = await q.query(`
    WITH ents AS MATERIALIZED (SELECT entity_id FROM civica_exec.exec_entity WHERE kind = 4 AND uf_code = $2),
    uf_months AS (SELECT extract(year FROM period_start)::int AS y, count(DISTINCT period_start)::int AS m FROM civica_exec.exec_ind_value WHERE entity_id = $2 AND indicator_id = ($1::smallint[])[1] AND period_start >= make_date($4, 1, 1) GROUP BY 1),
    pops AS MATERIALIZED (SELECT p.entity_id, p.year::int AS y, p.value::float8 AS pop FROM civica_exec.exec_territory_population p WHERE p.source = 1 AND p.entity_id IN (SELECT entity_id FROM ents)),
    sums AS MATERIALIZED (SELECT v.entity_id, extract(year FROM v.period_start)::int AS y, sum(v.value) AS total, count(*) FILTER (WHERE (v.flags & $3) <> 0)::int AS supp
             FROM civica_exec.exec_ind_value v WHERE v.indicator_id = ANY($1::smallint[]) AND v.entity_id IN (SELECT entity_id FROM ents) AND v.period_start >= make_date($4, 1, 1) GROUP BY 1, 2),
    j AS (SELECT p.y, p.entity_id, p.pop, s.total, coalesce(s.supp, 0) AS supp FROM pops p LEFT JOIN sums s ON s.entity_id = p.entity_id AND s.y = p.y WHERE p.y >= $4),
    agg AS (SELECT y, count(*) FILTER (WHERE pop >= $5::float8 AND pop < $7::float8)::int AS universe, count(*) FILTER (WHERE pop >= $5::float8 AND pop < $7::float8 AND total IS NOT NULL)::int AS n,
        coalesce(sum(supp) FILTER (WHERE pop >= $5::float8 AND pop < $7::float8), 0)::int AS suppressed, count(*)::int AS with_pop,
        percentile_cont(0.25) WITHIN GROUP (ORDER BY total / pop * 100000) FILTER (WHERE pop >= $5::float8 AND pop < $7::float8 AND total IS NOT NULL) AS p25,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY total / pop * 100000) FILTER (WHERE pop >= $5::float8 AND pop < $7::float8 AND total IS NOT NULL) AS p50,
        percentile_cont(0.75) WITHIN GROUP (ORDER BY total / pop * 100000) FILTER (WHERE pop >= $5::float8 AND pop < $7::float8 AND total IS NOT NULL) AS p75,
        max(pop) FILTER (WHERE entity_id = $6) AS own_pop, max(total) FILTER (WHERE entity_id = $6) AS own_total
      FROM j GROUP BY y)
    SELECT um.y AS year, um.m AS months, coalesce(a.universe, 0) AS universe, coalesce(a.n, 0) AS n, coalesce(a.suppressed, 0) AS suppressed, a.p25, a.p50, a.p75, a.own_pop, a.own_total, coalesce(a.with_pop, 0) AS with_pop
    FROM uf_months um LEFT JOIN agg a ON a.y = um.y ORDER BY um.y`, [o.indicatorIds, o.ufCode, FLAG.suppressed, from, lo, o.entityId ?? null, hi]);
  return r.rows.map((x): CrimeBenchYear => {
    const n = f(x.n), universe = f(x.universe), months = f(x.months); const own = x.own_pop != null && x.own_total != null ? { total: f(x.own_total), population: f(x.own_pop), rate: f(x.own_total) / f(x.own_pop) * 100000 } : null;
    const base = { year: f(x.year), n, universe, p25: null, p50: null, p75: null, own } as CrimeBenchYear;
    if (f(x.with_pop) === 0) return { ...base, status: 'sem_populacao_do_ano' };
    if (months < 12) return { ...base, status: 'ano_incompleto' };
    if (f(x.suppressed) > 0) return { ...base, status: 'celulas_suprimidas' };
    if (n < BENCH_MIN_MUNICIPALITIES) return { ...base, status: universe < BENCH_MIN_MUNICIPALITIES ? 'grupo_pequeno' : 'cobertura_insuficiente' };
    if (universe > 0 && n / universe < BENCH_MIN_COVERAGE) return { ...base, status: 'cobertura_insuficiente' };
    return { ...base, status: 'ok', p25: f(x.p25), p50: f(x.p50), p75: f(x.p75) };
  });
}

export interface SeriesPoint { period: string; value: number | null; numerator: number | null; denominator: number | null; flags: number }
export interface SeriesRead { indicatorId: number; code: string; label: string; unit: string; grain: string; points: SeriesPoint[] }
/** Série bruta de um indicador para um território (modo "Explorar os dados"): valor, numerador, denominador e flags, na ordem do tempo. */
export async function readIndicatorSeries(q: Q, o: { entityId: number; indicatorId: number; from?: string; to?: string }): Promise<SeriesRead | null> {
  const def = await q.query(`SELECT indicator_id, code, label, unit, grain FROM civica_exec.exec_ind_def WHERE indicator_id = $1::int`, [o.indicatorId]); if (!def.rows[0]) return null;
  const r = await q.query(`SELECT period_start::text AS p, value, numerator, denominator, flags FROM civica_exec.exec_ind_value WHERE entity_id = $1 AND indicator_id = $2::int AND period_start >= coalesce($3::date, '1900-01-01') AND period_start < coalesce($4::date, '2999-01-01') ORDER BY period_start`,
    [o.entityId, o.indicatorId, o.from ?? null, o.to ?? null]);
  const d = def.rows[0];
  return { indicatorId: f(d.indicator_id), code: String(d.code), label: String(d.label), unit: String(d.unit), grain: String(d.grain), points: r.rows.map(x => ({ period: String(x.p).slice(0, 10), value: x.value == null ? null : f(x.value), numerator: x.numerator == null ? null : f(x.numerator), denominator: x.denominator == null ? null : f(x.denominator), flags: f(x.flags) })) };
}

export interface ContractRow { pncpId: string; year: number; signed: string | null; orgKind: string; theme: string | null; link: 'institucional' | 'temático' | 'ambos'; valueCents: string; supplierCnpj: string | null; supplierName: string | null; empenho: string | null; esfera: string }
export interface ContractList { entityId: number; total: number; sumCentsByYear: Array<{ year: number; contracts: number; valueCents: string }>; rows: ContractRow[]; restrictions: string[] }
const THEME_LABEL = new Map<number, string>(SEC_THEMES.map(t => [t.id, t.label]));
/**
 * Contratos do PNCP ligados a segurança para o ENTE (município, UF ou Brasil): só dados de pessoa jurídica (CNPJ e nome do fornecedor), sem objeto, sem pessoa física.
 * Valor = valor global CONTRATADO (não é pago). Tema é classificação derivada por palavras-chave, não função orçamentária 06.
 */
export async function listSecurityContracts(q: Q, o: { entityId: number; year?: number; limit?: number; offset?: number }): Promise<ContractList> {
  const lim = Math.min(Math.max(o.limit ?? 20, 1), 100), off = Math.max(o.offset ?? 0, 0);
  const [tot, by, rows] = await Promise.all([
    q.query(`SELECT count(*)::int AS n FROM civica_exec.exec_fin_contract WHERE entity_id = $1 AND ($2::int IS NULL OR year = $2)`, [o.entityId, o.year ?? null]),
    q.query(`SELECT year, count(*)::int AS n, sum(valor_global)::text AS v FROM civica_exec.exec_fin_contract WHERE entity_id = $1 GROUP BY year ORDER BY year`, [o.entityId]),
    q.query(`SELECT c.pncp_id, c.year, c.signed::text AS signed, c.org_kind, c.theme, c.link, c.valor_global::text AS v, c.supplier::text AS cnpj, s.name AS supplier_name, c.empenho, c.esfera
      FROM civica_exec.exec_fin_contract c LEFT JOIN civica_exec.exec_fin_supplier s ON s.cnpj = c.supplier WHERE c.entity_id = $1 AND ($2::int IS NULL OR c.year = $2) ORDER BY c.valor_global DESC, c.pncp_id LIMIT $3 OFFSET $4`, [o.entityId, o.year ?? null, lim, off]),
  ]);
  return {
    entityId: o.entityId, total: f(tot.rows[0].n), sumCentsByYear: by.rows.map(x => ({ year: f(x.year), contracts: f(x.n), valueCents: String(x.v) })),
    rows: rows.rows.map((x): ContractRow => ({ pncpId: String(x.pncp_id), year: f(x.year), signed: x.signed ?? null, orgKind: ORG_KINDS[f(x.org_kind)] ?? 'não identificado', theme: f(x.theme) === 0 ? null : (THEME_LABEL.get(f(x.theme)) ?? null), link: f(x.link) === 1 ? 'institucional' : f(x.link) === 2 ? 'temático' : 'ambos', valueCents: String(x.v), supplierCnpj: x.cnpj ?? null, supplierName: x.supplier_name ?? null, empenho: x.empenho ?? null, esfera: String(x.esfera) })),
    restrictions: ['Valor global CONTRATADO publicado no PNCP: não é valor pago nem despesa da função 06 (Segurança Pública).', 'A ligação com segurança é inferida pelo órgão e/ou por palavras-chave do objeto (o texto do objeto não é guardado); pode haver falsos positivos e omissões.', 'Só fornecedores pessoa jurídica aparecem; contratos com pessoa física ficam fora.'],
  };
}

/** População oficial por ano (IBGE, SIDRA) de um território: base das taxas calculadas no cliente-servidor. Anos sem estimativa (2022–2023) simplesmente não existem: nada é interpolado. */
export async function readPopulationSeries(q: Q, entityId: number): Promise<Array<{ year: number; population: number }>> {
  const r = await q.query(`SELECT year, value FROM civica_exec.exec_territory_population WHERE entity_id = $1 AND source = 1 ORDER BY year`, [entityId]);
  return r.rows.map(x => ({ year: f(x.year), population: f(x.value) }));
}

export interface ExplorableIndicator { indicatorId: number; code: string; label: string; unit: string; grain: string; points: number; first: string; last: string }
/** Indicadores de Segurança (ids ≥ 3001) que têm ao menos um valor para o território: alimenta o seletor do modo "Explorar os dados". Uma consulta indexada por entidade. */
export async function listExplorableIndicators(q: Q, entityId: number): Promise<ExplorableIndicator[]> {
  const r = await q.query(`SELECT v.indicator_id, d.code, d.label, d.unit, d.grain, count(*)::int AS n, min(v.period_start)::text AS a, max(v.period_start)::text AS b
    FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_ind_def d USING (indicator_id) WHERE v.entity_id = $1 AND v.indicator_id >= 3001 GROUP BY v.indicator_id, d.code, d.label, d.unit, d.grain ORDER BY v.indicator_id`, [entityId]);
  return r.rows.map(x => ({ indicatorId: f(x.indicator_id), code: String(x.code), label: String(x.label), unit: String(x.unit), grain: String(x.grain), points: f(x.n), first: String(x.a).slice(0, 10), last: String(x.b).slice(0, 10) }));
}

/** Primeiro e último mês publicados de cada indicador no nível da UF: define quais anos de um município são COMPLETOS para a fonte (mês sem linha de município não torna o ano parcial). */
export async function readIndicatorBounds(q: Q, o: { entityId: number; indicatorIds: number[] }): Promise<Array<{ indicatorId: number; first: string; last: string }>> {
  const r = await q.query(`SELECT indicator_id, min(period_start)::text AS a, max(period_start)::text AS b FROM civica_exec.exec_ind_value WHERE entity_id = $1 AND indicator_id = ANY($2::smallint[]) GROUP BY indicator_id`, [o.entityId, o.indicatorIds]);
  return r.rows.map(x => ({ indicatorId: f(x.indicator_id), first: String(x.a).slice(0, 7), last: String(x.b).slice(0, 7) }));
}
