import type { Pool } from 'pg';
import { EDU_DEP, EDU_LOC } from './educacao-build.ts';
import { INFRA_VARS, infraAvailable, type InfraFamily, type InfraVar } from './educacao-infra-catalog.ts';

/**
 * Contratos de leitura de infraestrutura escolar (P10.3). Somente SELECT, parametrizados, sem N+1: escola (linha + histórico), município (soma das escolas dele pelo índice do cadastro),
 * UF e Brasil (exec_edu_infra_agg). TODAS as respostas são autodeclaradas (existência/uso); nenhuma é nota de qualidade.
 * Percentual = sim ÷ (sim + não) no mesmo grupo e edição; escolas sem resposta aparecem à parte (`semResposta`) e nunca entram como "não".
 */
type Q = Pick<Pool, 'query'>;
export const INFRA_RESTRICTIONS = [
  'Todas as informações são autodeclaradas pela escola no Censo Escolar: dizem que a escola declara ter (ou usar) o item, não que ele funciona, está conservado ou é suficiente. Não há nota de qualidade.',
  'Percentual = escolas que declararam "sim" ÷ escolas que responderam "sim" ou "não" no mesmo grupo e edição. Escolas em branco ou com o código oficial "não informado" aparecem à parte e nunca contam como "não".',
  'O questionário foi reformulado em 2019: água potável × água filtrada, banheiro, salas utilizadas × existentes, recursos de acessibilidade e fontes de energia são perguntas diferentes antes e depois. Comparar só dentro de 2007–2018 ou de 2019–2025, salvo variável marcada como comparável.',
  '"Internet" é o acesso declarado; não mede velocidade nem uso pedagógico. Internet para ensino e aprendizagem é outra pergunta, existente só de 2019.',
  'Escolas em atividade com matrícula básica são só parte do universo: o denominador de cada percentual acompanha a pergunta (todas as escolas em atividade, ou as que oferecem a etapa, conforme o recorte pedido).',
  'Valores marcados pelo INEP como extremos (88888) nas quantidades de equipamentos são tratados como ausentes e não entram em somas.',
  'Variável fora da vigência da edição (ex.: biblioteca antes de 2009) é "fora da edição", não "não".',
];
export const INFRA_SOURCE = { name: 'INEP, Censo Escolar da Educação Básica: Tabela de Escola (microdados abertos, variáveis de infraestrutura)', reference: 'última quarta-feira de maio', url: 'https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/censo-escolar' };
/** Variáveis exibidas por padrão nas séries (comparáveis nas 19 edições ou por era). */
export const INFRA_SERIES_CODES = ['internet', 'banda_larga', 'agua_rede', 'energia_rede', 'esgoto_rede', 'biblioteca_ou_leitura', 'lab_informatica', 'lab_ciencias', 'quadra', 'cozinha', 'refeitorio', 'banheiro_pne', 'computador'];

export type InfraState = 'SIM' | 'NAO' | 'NAO_INFORMADO' | 'FORA_DA_EDICAO';
export interface InfraItem { code: string; label: string; family: InfraFamily; comparability: string; note: string | null; available: boolean; sim: number; nao: number; semResposta: number; pct: number | null }
export interface InfraGroup { key: number; label: string; escolas: number; itens: Array<{ code: string; sim: number; nao: number; pct: number | null }> }
export interface InfraSeriesPoint { year: number; escolas: number; itens: Record<string, { sim: number; nao: number; pct: number | null } | null> }
export interface EducationInfra {
  scope: { kind: 'brasil' | 'uf' | 'municipio'; ufCode: number | null; entityId: number | null; ibge7: string | null; name: string };
  year: number; dataBase: string; stage: string | null; universe: { escolas: number; comResposta: number; semResposta: number };
  itens: InfraItem[]; counts: Array<{ code: string; label: string; escolasComValor: number; soma: number }>; byDependency: InfraGroup[]; byLocation: InfraGroup[]; series: InfraSeriesPoint[];
  coverage: Array<{ year: number; rowsIn: number; active: number; valid: number; rejected: number; answered: number; unanswered: number; extreme: number; codedUnknown: number }>;
  source: typeof INFRA_SOURCE; restrictions: string[]; extensions: Record<string, never>;
}
const n = (v: unknown): number | null => v == null ? null : Number(v);
const pct = (y: number, f: number): number | null => y + f <= 0 ? null : Math.round(y / (y + f) * 1000) / 10;
const FLAGS = INFRA_VARS.filter(x => x.kind === 'flag'); const COUNTS = INFRA_VARS.filter(x => x.kind === 'count');
const itemOf = (x: InfraVar, year: number, sim: number, nao: number, schools: number): InfraItem =>
  ({ code: x.code, label: x.label, family: x.family, comparability: x.comparability, note: x.note ?? null, available: infraAvailable(x.code, year), sim, nao, semResposta: infraAvailable(x.code, year) ? Math.max(0, schools - sim - nao) : 0, pct: pct(sim, nao) });

export async function publishedInfraYears(q: Q): Promise<number[]> { return (await q.query(`SELECT DISTINCT year FROM civica_exec.exec_edu_infra_cov ORDER BY year`)).rows.map(r => Number(r.year)); }
async function coverageOf(q: Q, ufCode: number | null): Promise<EducationInfra['coverage']> {
  const r = await q.query(`SELECT year, sum(rows_in)::int rows_in, sum(active)::int active, sum(valid)::int valid, sum(rejected)::int rejected, sum(answered)::int answered, sum(unanswered)::int unanswered, sum(extreme)::int extreme, sum(coded_unknown)::int coded_unknown FROM civica_exec.exec_edu_infra_cov ${ufCode == null ? '' : 'WHERE uf = $1'} GROUP BY year ORDER BY year`, ufCode == null ? [] : [ufCode]);
  return r.rows.map(x => ({ year: Number(x.year), rowsIn: Number(x.rows_in), active: Number(x.active), valid: Number(x.valid), rejected: Number(x.rejected), answered: Number(x.answered), unanswered: Number(x.unanswered), extreme: Number(x.extreme), codedUnknown: Number(x.coded_unknown) }));
}
const aggSums = (alias = '') => `sum(${alias}schools)::bigint schools, ${FLAGS.map(x => `sum(${alias}${x.code}_t)::bigint ${x.code}_t, sum(${alias}${x.code}_f)::bigint ${x.code}_f`).join(', ')}, ${COUNTS.map(x => `sum(${alias}${x.code}_s)::bigint ${x.code}_s, sum(${alias}${x.code}_n)::bigint ${x.code}_n`).join(', ')}`;
function fromAgg(year: number, r: Record<string, unknown>): { itens: InfraItem[]; counts: EducationInfra['counts']; schools: number } {
  const schools = Number(r.schools ?? 0);
  return {
    schools,
    itens: FLAGS.map(x => itemOf(x, year, Number(r[`${x.code}_t`] ?? 0), Number(r[`${x.code}_f`] ?? 0), schools)),
    counts: COUNTS.filter(x => infraAvailable(x.code, year)).map(x => ({ code: x.code, label: x.label, escolasComValor: Number(r[`${x.code}_n`] ?? 0), soma: Number(r[`${x.code}_s`] ?? 0) })),
  };
}
const groupsOf = (year: number, rows: Array<Record<string, unknown>>, key: 'dep' | 'loc', labels: Record<number, string>): InfraGroup[] =>
  rows.map(r => ({ key: Number(r[key]), label: key === 'loc' && Number(r.loc) === 0 ? 'Não informada' : labels[Number(r[key])] ?? String(r[key]), escolas: Number(r.schools),
    itens: FLAGS.filter(x => infraAvailable(x.code, year)).map(x => ({ code: x.code, sim: Number(r[`${x.code}_t`] ?? 0), nao: Number(r[`${x.code}_f`] ?? 0), pct: pct(Number(r[`${x.code}_t`] ?? 0), Number(r[`${x.code}_f`] ?? 0)) })) }));
const seriesFromRows = (rows: Array<Record<string, unknown>>): InfraSeriesPoint[] =>
  rows.map(r => ({ year: Number(r.year), escolas: Number(r.schools), itens: Object.fromEntries(INFRA_SERIES_CODES.map(c => infraAvailable(c, Number(r.year)) ? [c, { sim: Number(r[`${c}_t`] ?? 0), nao: Number(r[`${c}_f`] ?? 0), pct: pct(Number(r[`${c}_t`] ?? 0), Number(r[`${c}_f`] ?? 0)) }] : [c, null])) }));
const SERIES_AGG = (alias = '') => `${INFRA_SERIES_CODES.map(c => `sum(${alias}${c}_t)::bigint ${c}_t, sum(${alias}${c}_f)::bigint ${c}_f`).join(', ')}`;

/** Brasil (ufCode ausente) ou UF: tudo de exec_edu_infra_agg. */
export async function getEducationNationalInfra(q: Q, o: { year?: number; ufCode?: number; series?: boolean } = {}): Promise<EducationInfra | null> {
  const years = await publishedInfraYears(q); if (!years.length) return null;
  const year = o.year ?? years.at(-1)!; if (!years.includes(year)) return null;
  const uf = o.ufCode ?? null; const w = uf == null ? '' : ' AND uf = $2'; const args = (y: unknown) => uf == null ? [y] : [y, uf];
  let name = 'Brasil';
  if (uf != null) { const e = (await q.query(`SELECT name FROM civica_exec.exec_entity WHERE kind = 3 AND uf_code = $1`, [uf])).rows[0]; if (!e) return null; name = String(e.name); }
  const tot = (await q.query(`SELECT ${aggSums()} FROM civica_exec.exec_edu_infra_agg WHERE year = $1${w}`, args(year))).rows[0] as Record<string, unknown>;
  const { itens, counts, schools } = fromAgg(year, tot);
  const cov = await coverageOf(q, uf); const covY = cov.find(c => c.year === year);
  const dep = (await q.query(`SELECT dep, ${aggSums()} FROM civica_exec.exec_edu_infra_agg WHERE year = $1${w} GROUP BY dep ORDER BY dep`, args(year))).rows;
  const loc = (await q.query(`SELECT loc, ${aggSums()} FROM civica_exec.exec_edu_infra_agg WHERE year = $1${w} GROUP BY loc ORDER BY loc`, args(year))).rows;
  const series = o.series === false ? [] : seriesFromRows((await q.query(`SELECT year, sum(schools)::bigint schools, ${SERIES_AGG()} FROM civica_exec.exec_edu_infra_agg ${uf == null ? '' : 'WHERE uf = $1'} GROUP BY year ORDER BY year`, uf == null ? [] : [uf])).rows);
  return { scope: { kind: uf == null ? 'brasil' : 'uf', ufCode: uf, entityId: uf, ibge7: null, name }, year, dataBase: `${year}-05`, stage: null, universe: { escolas: schools, comResposta: covY?.answered ?? 0, semResposta: covY?.unanswered ?? 0 },
    itens, counts, byDependency: groupsOf(year, dep, 'dep', EDU_DEP), byLocation: groupsOf(year, loc, 'loc', EDU_LOC), series, coverage: cov, source: INFRA_SOURCE, restrictions: INFRA_RESTRICTIONS, extensions: {} };
}

const STAGE_COND: Record<string, string> = {
  INF_CRE: 'o.mat_inf_cre > 0', INF_PRE: 'o.mat_inf_pre > 0', FUND_AI: 'o.mat_fund_ai > 0', FUND_AF: 'o.mat_fund_af > 0', MED: 'o.mat_med > 0', EJA: 'coalesce(o.mat_eja_fund, 0) + coalesce(o.mat_eja_med, 0) > 0',
};
const rowAggSql = (year: number, alias = 'i') => [
  'count(*)::bigint schools',
  ...FLAGS.filter(x => infraAvailable(x.code, year)).flatMap(x => [`count(*) FILTER (WHERE ${alias}.${x.code})::bigint ${x.code}_t`, `count(*) FILTER (WHERE NOT ${alias}.${x.code})::bigint ${x.code}_f`]),
  ...COUNTS.filter(x => infraAvailable(x.code, year)).flatMap(x => [`coalesce(sum(${alias}.${x.code}), 0)::bigint ${x.code}_s`, `count(${alias}.${x.code})::bigint ${x.code}_n`]),
].join(', ');

/** Município: soma das escolas em atividade dele (e, com `stage`, só as que ofereceram a etapa na edição, pela oferta da P10.2). */
export async function getEducationMunicipalityInfra(q: Q, ibge7: string, o: { year?: number; series?: boolean; stage?: keyof typeof STAGE_COND } = {}): Promise<EducationInfra | null> {
  if (!/^\d{7}$/.test(ibge7)) return null;
  const ent = (await q.query(`SELECT entity_id, name, uf_code FROM civica_exec.exec_entity WHERE kind = 4 AND ibge7 = $1`, [Number(ibge7)])).rows[0]; if (!ent) return null;
  const years = await publishedInfraYears(q); if (!years.length) return null;
  const year = o.year ?? years.at(-1)!; if (!years.includes(year)) return null;
  const stage = o.stage && STAGE_COND[o.stage] ? o.stage : null;
  const join = stage ? 'JOIN civica_exec.exec_edu_offer_year o ON o.inep = i.inep AND o.year = i.year' : '';
  const cond = stage ? ` AND ${STAGE_COND[stage]}` : '';
  const base = `FROM civica_exec.exec_edu_infra_year i JOIN civica_exec.exec_edu_school_year y ON y.inep = i.inep AND y.year = i.year ${join} WHERE y.entity_id = $1 AND i.year = $2${cond}`;
  const sel = rowAggSql(year);
  const tot = (await q.query(`SELECT ${sel} ${base}`, [ent.entity_id, year])).rows[0] as Record<string, unknown>;
  const dep = (await q.query(`SELECT y.dep, ${sel} ${base} GROUP BY y.dep ORDER BY y.dep`, [ent.entity_id, year])).rows;
  const loc = (await q.query(`SELECT coalesce(y.loc, 0) AS loc, ${sel} ${base} GROUP BY 1 ORDER BY 1`, [ent.entity_id, year])).rows;
  const { itens, counts, schools } = fromAgg(year, tot);
  const answered = (await q.query(`SELECT count(*) FILTER (WHERE ${FLAGS.filter(x => infraAvailable(x.code, year)).map(x => `i.${x.code} IS NOT NULL`).join(' OR ')})::int a ${base}`, [ent.entity_id, year])).rows[0].a as number;
  const series = o.series === false ? [] : seriesFromRows((await q.query(`SELECT i.year, count(*)::bigint schools, ${INFRA_SERIES_CODES.map(c => `count(*) FILTER (WHERE i.${c})::bigint ${c}_t, count(*) FILTER (WHERE NOT i.${c})::bigint ${c}_f`).join(', ')}
    FROM civica_exec.exec_edu_infra_year i JOIN civica_exec.exec_edu_school_year y ON y.inep = i.inep AND y.year = i.year ${join} WHERE y.entity_id = $1${cond} GROUP BY i.year ORDER BY i.year`, [ent.entity_id])).rows);
  return { scope: { kind: 'municipio', ufCode: Number(ent.uf_code), entityId: Number(ent.entity_id), ibge7, name: String(ent.name) }, year, dataBase: `${year}-05`, stage, universe: { escolas: schools, comResposta: answered, semResposta: schools - answered },
    itens, counts, byDependency: groupsOf(year, dep, 'dep', EDU_DEP), byLocation: groupsOf(year, loc, 'loc', EDU_LOC), series, coverage: [], source: INFRA_SOURCE, restrictions: INFRA_RESTRICTIONS, extensions: {} };
}

export interface SchoolInfraItem { code: string; label: string; family: InfraFamily; kind: 'flag' | 'count'; state: InfraState; value: number | null; comparability: string; note: string | null }
export interface SchoolInfraYear { year: number; itens: SchoolInfraItem[] }
export interface EducationSchoolInfra { inep: number; name: string; latestYear: number; years: SchoolInfraYear[]; restrictions: string[]; source: typeof INFRA_SOURCE }
/** Escola: linha da edição pedida (ou a mais recente com resposta) e as edições anteriores com resposta, com o estado de cada item. */
export async function getEducationSchoolInfra(q: Q, inep: number, o: { years?: number } = {}): Promise<EducationSchoolInfra | null> {
  if (!Number.isInteger(inep) || inep < 10_000_000) return null;
  const s = (await q.query(`SELECT name FROM civica_exec.exec_edu_school_year WHERE inep = $1 ORDER BY year DESC LIMIT 1`, [inep])).rows[0]; if (!s) return null;
  const r = await q.query(`SELECT * FROM civica_exec.exec_edu_infra_year WHERE inep = $1 ORDER BY year DESC LIMIT $2`, [inep, Math.min(Math.max(o.years ?? 19, 1), 19)]);
  if (!r.rows.length) return { inep, name: String(s.name), latestYear: 0, years: [], restrictions: INFRA_RESTRICTIONS, source: INFRA_SOURCE };
  const years: SchoolInfraYear[] = r.rows.map(row => ({
    year: Number(row.year),
    itens: INFRA_VARS.map(x => {
      const v = row[x.code]; const avail = infraAvailable(x.code, Number(row.year));
      const state: InfraState = !avail ? 'FORA_DA_EDICAO' : v == null ? 'NAO_INFORMADO' : x.kind === 'flag' ? (v ? 'SIM' : 'NAO') : 'SIM';
      return { code: x.code, label: x.label, family: x.family, kind: x.kind, state, value: x.kind === 'count' ? n(v) : null, comparability: x.comparability, note: x.note ?? null };
    }),
  }));
  return { inep, name: String(s.name), latestYear: years[0]!.year, years, restrictions: INFRA_RESTRICTIONS, source: INFRA_SOURCE };
}
