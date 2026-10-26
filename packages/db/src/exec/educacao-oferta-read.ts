import type { Pool } from 'pg';
import { EDU_OFFER_COLS } from './specs.ts';
import { EDU_DEP, EDU_LOC } from './educacao-build.ts';
import { OFFER_MEASURES } from './educacao-oferta-catalog.ts';

/**
 * Contratos de leitura de matrículas, turmas e oferta (P10.2). Somente SELECT, parametrizados, sem N+1: escola (série de uma escola), município (soma das escolas dele, pelo índice (year, entity_id) do cadastro),
 * UF e Brasil (a partir de exec_edu_offer_agg, 211 linhas por edição). Pontos de extensão: `extensions` (P10.3 infraestrutura e docentes; P10.4 Ideb/Saeb).
 * REGRAS (em `restrictions`): matrícula ≠ aluno único; etapas somam o total, modalidades transversais não; turma é unidade do Censo; rede ≠ localização; tamanho de turma aqui é derivado (Σ matrículas ÷ Σ turmas do MESMO recorte) e não substitui o indicador oficial do INEP.
 */
type Q = Pick<Pool, 'query'>;
export const OFFER_RESTRICTIONS = [
  'Matrícula é um vínculo aluno–turma na data do Censo, não um aluno: o mesmo aluno pode ter mais de uma matrícula. Contagens de escolas, matrículas e turmas são grandezas diferentes e nunca se trocam.',
  'As etapas (creche, pré-escola, anos iniciais, anos finais, ensino médio, EJA e educação profissional não integrada) formam uma partição da matrícula da educação básica e somam o total. Educação profissional (total), educação especial, tempo integral e turno são recortes transversais: nunca se somam às etapas.',
  'Turma é a unidade do Censo (exclui atividade complementar e AEE). Turma que atende mais de uma etapa conta em cada uma; por isso as turmas por etapa podem somar mais que o total, nunca menos.',
  '"Rede municipal" são as escolas mantidas pela prefeitura, onde quer que estejam; "escolas no município" são todas as localizadas nele (estaduais, federais e privadas incluídas). A dependência é a registrada NA edição.',
  'Matrículas por turma = Σ matrículas ÷ Σ turmas do mesmo recorte (razão de somas, nunca média de médias). É um número derivado e não substitui o indicador oficial de alunos por turma do INEP (P10.3).',
  'Valor ausente (NULL) significa que a edição não tem a informação (turno antes de 2014; tempo integral de turmas antes de 2023); zero é zero declarado. Tempo integral tem série descontínua entre 2007 e 2016: comparar só de 2016 em diante.',
  'Escola do cadastro sem linha de oferta não tem matrícula nem turma no arquivo da edição (escola paralisada, extinta ou ativa sem matrícula básica).',
];
export const OFFER_SOURCE = { name: 'INEP, Censo Escolar da Educação Básica: matrículas e turmas por escola (microdados abertos agregados)', reference: 'última quarta-feira de maio', url: 'https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/censo-escolar' } as const;

export interface OfferStage { code: string; label: string; matriculas: number | null; turmas: number | null; matPorTurma: number | null; escolas: number | null }
export interface OfferGroup { key: number; label: string; escolas: number; matriculas: number; turmas: number; matPorTurma: number | null }
export interface OfferTotals { matriculas: number; turmas: number; escolas: number; matPorTurma: number | null }
export interface OfferSpecial { educacaoEspecial: { classesComuns: number | null; classesExclusivas: number | null; total: number | null }; educacaoProfissionalTotal: number | null; tempoIntegral: { infantil: number | null; fundamental: number | null; medio: number | null; total: number | null }; noturno: number | null; ead: number | null }
export interface OfferSeriesPoint { year: number; matriculas: number; turmas: number; escolas: number; etapas: Record<string, number | null> }
export interface EducationOffer {
  scope: { kind: 'brasil' | 'uf' | 'municipio'; ufCode: number | null; entityId: number | null; ibge7: string | null; name: string };
  year: number; dataBase: string; totals: OfferTotals; stages: OfferStage[]; byDependency: OfferGroup[]; byLocation: OfferGroup[]; special: OfferSpecial; series: OfferSeriesPoint[];
  coverage: Array<{ year: number; layout: number; rowsIn: number; valid: number; rejected: number }>; availability: Record<string, { fromYear: number; nullBefore: boolean }>;
  source: typeof OFFER_SOURCE; restrictions: string[]; extensions: Record<string, never>;
}
const n = (v: unknown): number | null => v == null ? null : Number(v);
const sum = (...a: Array<number | null>): number | null => a.some(x => x == null) ? null : a.reduce<number>((s, x) => s + (x as number), 0);
const ratio = (m: number | null, t: number | null): number | null => m == null || t == null || t <= 0 ? null : Math.round(m / t * 100) / 100;
const AVAIL = Object.fromEntries(OFFER_MEASURES.filter(m => m.validFrom > 2007).map(m => [m.code, { fromYear: m.validFrom, nullBefore: true }]));
const SUMS = EDU_OFFER_COLS.map(c => `sum(${c})::bigint ${c}`).join(', ');
/** A série municipal só precisa do total e das etapas de matrícula (menos colunas somadas por linha lida). */
const SER_COLS = ['mat_bas', 'mat_inf_cre', 'mat_inf_pre', 'mat_fund_ai', 'mat_fund_af', 'mat_med', 'mat_eja_fund', 'mat_eja_med', 'tur_bas'];
const SER_SUMS = SER_COLS.map(c => `sum(o.${c})::bigint ${c}`).join(', ');

function stagesOf(s: Record<string, number | null>, schools: Record<string, number | null> | null): OfferStage[] {
  const g = (k: string) => n(s[k]);
  const stagesMat = sum(g('mat_inf_cre'), g('mat_inf_pre'), g('mat_fund_ai'), g('mat_fund_af'), g('mat_med'), g('mat_eja_fund'), g('mat_eja_med'));
  const stagesTur = sum(g('tur_inf_cre'), g('tur_inf_pre'), g('tur_fund_ai'), g('tur_fund_af'), g('tur_med'), g('tur_eja'));
  const defs: Array<[string, string, number | null, number | null, string | null]> = [
    ['INF_CRE', 'Creche', g('mat_inf_cre'), g('tur_inf_cre'), 'mat_inf_cre'], ['INF_PRE', 'Pré-escola', g('mat_inf_pre'), g('tur_inf_pre'), 'mat_inf_pre'],
    ['FUND_AI', 'Ensino fundamental – anos iniciais', g('mat_fund_ai'), g('tur_fund_ai'), 'mat_fund_ai'], ['FUND_AF', 'Ensino fundamental – anos finais', g('mat_fund_af'), g('tur_fund_af'), 'mat_fund_af'],
    ['MED', 'Ensino médio', g('mat_med'), g('tur_med'), 'mat_med'], ['EJA', 'Educação de Jovens e Adultos', sum(g('mat_eja_fund'), g('mat_eja_med')), g('tur_eja'), 'mat_eja'],
    ['PROF_NI', 'Educação profissional não integrada (derivada)', g('mat_bas') == null || stagesMat == null ? null : g('mat_bas')! - stagesMat, g('tur_bas') == null || stagesTur == null ? null : g('tur_bas')! - stagesTur, null],
  ];
  return defs.map(([code, label, mat, tur, key]) => ({ code, label, matriculas: mat, turmas: tur, matPorTurma: ratio(mat, tur), escolas: schools && key ? n(schools[key]) : null }));
}
function specialOf(s: Record<string, number | null>): OfferSpecial {
  const g = (k: string) => n(s[k]);
  return { educacaoEspecial: { classesComuns: g('mat_esp_cc'), classesExclusivas: g('mat_esp_ce'), total: sum(g('mat_esp_cc'), g('mat_esp_ce')) }, educacaoProfissionalTotal: g('mat_prof'),
    tempoIntegral: { infantil: g('mat_int_inf'), fundamental: g('mat_int_fund'), medio: g('mat_int_med'), total: sum(g('mat_int_inf'), g('mat_int_fund'), g('mat_int_med')) }, noturno: g('mat_noturno'), ead: g('mat_ead') };
}
const seriesPoint = (year: number, s: Record<string, number | null>, schools: number): OfferSeriesPoint => {
  const st = stagesOf(s, null);
  return { year, matriculas: Number(s.mat_bas ?? 0), turmas: Number(s.tur_bas ?? 0), escolas: schools, etapas: Object.fromEntries(st.map(x => [x.code, x.matriculas])) };
};
const groupsOf = (rows: Array<Record<string, unknown>>, key: 'dep' | 'loc', labels: Record<number, string>): OfferGroup[] =>
  rows.map(r => ({ key: Number(r[key]), label: key === 'loc' && Number(r.loc) === 0 ? 'Não informada' : labels[Number(r[key])] ?? String(r[key]), escolas: Number(r.schools), matriculas: Number(r.mat_bas ?? 0), turmas: Number(r.tur_bas ?? 0), matPorTurma: ratio(n(r.mat_bas), n(r.tur_bas)) }));

export async function publishedOfferYears(q: Q): Promise<number[]> { return (await q.query(`SELECT DISTINCT year FROM civica_exec.exec_edu_offer_cov ORDER BY year`)).rows.map(r => Number(r.year)); }
async function coverageOf(q: Q, ufCode: number | null): Promise<EducationOffer['coverage']> {
  const r = await q.query(`SELECT year, max(layout)::int layout, sum(rows_in)::int rows_in, sum(valid)::int valid, sum(rejected)::int rejected FROM civica_exec.exec_edu_offer_cov ${ufCode == null ? '' : 'WHERE uf = $1'} GROUP BY year ORDER BY year`, ufCode == null ? [] : [ufCode]);
  return r.rows.map(x => ({ year: Number(x.year), layout: Number(x.layout), rowsIn: Number(x.rows_in), valid: Number(x.valid), rejected: Number(x.rejected) }));
}

/** Brasil (ufCode ausente) ou UF: tudo de exec_edu_offer_agg. */
export async function getEducationNationalOffer(q: Q, o: { year?: number; ufCode?: number } = {}): Promise<EducationOffer | null> {
  const years = await publishedOfferYears(q); if (!years.length) return null;
  const year = o.year ?? years.at(-1)!; if (!years.includes(year)) return null;
  const uf = o.ufCode ?? null; const w = uf == null ? '' : ' AND uf = $2'; const args = (y: unknown) => uf == null ? [y] : [y, uf];
  let name = 'Brasil';
  if (uf != null) { const e = (await q.query(`SELECT name FROM civica_exec.exec_entity WHERE kind = 3 AND uf_code = $1`, [uf])).rows[0]; if (!e) return null; name = String(e.name); }
  const sums = (await q.query(`SELECT sum(schools)::bigint schools, ${EDU_OFFER_COLS.map(c => `sum(${c})::bigint ${c}`).join(', ')} FROM civica_exec.exec_edu_offer_agg WHERE year = $1${w}`, args(year))).rows[0] as Record<string, number | null>;
  const dep = (await q.query(`SELECT dep, sum(schools)::bigint schools, sum(mat_bas)::bigint mat_bas, sum(tur_bas)::bigint tur_bas FROM civica_exec.exec_edu_offer_agg WHERE year = $1${w} GROUP BY dep ORDER BY dep`, args(year))).rows;
  const loc = (await q.query(`SELECT loc, sum(schools)::bigint schools, sum(mat_bas)::bigint mat_bas, sum(tur_bas)::bigint tur_bas FROM civica_exec.exec_edu_offer_agg WHERE year = $1${w} GROUP BY loc ORDER BY loc`, args(year))).rows;
  const ser = (await q.query(`SELECT year, sum(schools)::bigint schools, ${EDU_OFFER_COLS.map(c => `sum(${c})::bigint ${c}`).join(', ')} FROM civica_exec.exec_edu_offer_agg WHERE year = ANY($1::smallint[])${uf == null ? '' : ' AND uf = $2'} GROUP BY year ORDER BY year`, uf == null ? [years] : [years, uf])).rows;
  if (!ser.length) return null;
  const totals: OfferTotals = { matriculas: Number(sums.mat_bas ?? 0), turmas: Number(sums.tur_bas ?? 0), escolas: Number(sums.schools ?? 0), matPorTurma: ratio(n(sums.mat_bas), n(sums.tur_bas)) };
  return { scope: { kind: uf == null ? 'brasil' : 'uf', ufCode: uf, entityId: null, ibge7: null, name }, year, dataBase: `${year}-05`, totals, stages: stagesOf(sums, null), byDependency: groupsOf(dep, 'dep', EDU_DEP), byLocation: groupsOf(loc, 'loc', EDU_LOC),
    special: specialOf(sums), series: ser.map(r => seriesPoint(Number(r.year), r as Record<string, number | null>, Number(r.schools))), coverage: await coverageOf(q, uf), availability: AVAIL, source: OFFER_SOURCE, restrictions: OFFER_RESTRICTIONS, extensions: {} };
}
export const getEducationStateOffer = (q: Q, ufCode: number, o: { year?: number } = {}) => Number.isInteger(ufCode) ? getEducationNationalOffer(q, { ...o, ufCode }) : Promise.resolve(null);

/** Município: soma das escolas registradas nele na edição (rede, localização e etapa), com `escolas` ofertantes por etapa. */
export async function getEducationMunicipalityOffer(q: Q, ibge7: string, o: { year?: number; series?: boolean } = {}): Promise<EducationOffer | null> {
  if (!/^\d{7}$/.test(ibge7)) return null;
  const e = (await q.query(`SELECT entity_id, name, uf_code FROM civica_exec.exec_entity WHERE kind = 4 AND ibge7 = $1::int`, [ibge7])).rows[0]; if (!e) return null;
  const years = await publishedOfferYears(q); if (!years.length) return null;
  const year = o.year ?? years.at(-1)!; if (!years.includes(year)) return null; const id = Number(e.entity_id);
  const J = `FROM civica_exec.exec_edu_offer_year o JOIN civica_exec.exec_edu_school_year y ON y.inep = o.inep AND y.year = o.year`;
  const offerCount = (c: string, alias: string) => `count(*) FILTER (WHERE o.${c} > 0)::bigint ${alias}`;
  const [snap, dep, loc, ser] = await Promise.all([
    q.query(`SELECT count(*)::bigint schools, ${SUMS.replace(/sum\((\w+)\)/g, 'sum(o.$1)')}, ${offerCount('mat_inf_cre', 's_mat_inf_cre')}, ${offerCount('mat_inf_pre', 's_mat_inf_pre')}, ${offerCount('mat_fund_ai', 's_mat_fund_ai')}, ${offerCount('mat_fund_af', 's_mat_fund_af')}, ${offerCount('mat_med', 's_mat_med')},
      count(*) FILTER (WHERE coalesce(o.mat_eja_fund, 0) + coalesce(o.mat_eja_med, 0) > 0)::bigint s_mat_eja ${J} WHERE y.year = $1 AND y.entity_id = $2`, [year, id]),
    q.query(`SELECT y.dep, count(*)::bigint schools, sum(o.mat_bas)::bigint mat_bas, sum(o.tur_bas)::bigint tur_bas ${J} WHERE y.year = $1 AND y.entity_id = $2 GROUP BY y.dep ORDER BY y.dep`, [year, id]),
    q.query(`SELECT coalesce(y.loc, 0) loc, count(*)::bigint schools, sum(o.mat_bas)::bigint mat_bas, sum(o.tur_bas)::bigint tur_bas ${J} WHERE y.year = $1 AND y.entity_id = $2 GROUP BY coalesce(y.loc, 0) ORDER BY 1`, [year, id]),
    o.series === false ? Promise.resolve({ rows: [] as Array<Record<string, unknown>> }) : q.query(`SELECT y.year, count(*)::bigint schools, ${SER_SUMS} ${J} WHERE y.year = ANY($1::smallint[]) AND y.entity_id = $2 GROUP BY y.year ORDER BY y.year`, [years, id]),
  ]);
  const s = snap.rows[0] as Record<string, number | null>; const sch = Object.fromEntries(Object.entries(s).filter(([k]) => k.startsWith('s_')).map(([k, v]) => [k.slice(2), n(v)]));
  const totals: OfferTotals = { matriculas: Number(s.mat_bas ?? 0), turmas: Number(s.tur_bas ?? 0), escolas: Number(s.schools ?? 0), matPorTurma: ratio(n(s.mat_bas), n(s.tur_bas)) };
  return { scope: { kind: 'municipio', ufCode: Number(e.uf_code), entityId: id, ibge7, name: String(e.name) }, year, dataBase: `${year}-05`, totals, stages: stagesOf(s, sch), byDependency: groupsOf(dep.rows, 'dep', EDU_DEP), byLocation: groupsOf(loc.rows, 'loc', EDU_LOC),
    special: specialOf(s), series: ser.rows.map(r => seriesPoint(Number(r.year), r as Record<string, number | null>, Number(r.schools))), coverage: await coverageOf(q, Number(e.uf_code)), availability: AVAIL, source: OFFER_SOURCE, restrictions: OFFER_RESTRICTIONS, extensions: {} };
}

export interface SchoolOfferYear { year: number; matriculas: number; turmas: number; matPorTurma: number | null; stages: OfferStage[]; special: OfferSpecial; dependency: { code: number; label: string }; municipalityEntityId: number }
export interface SchoolOffer { inep: number; years: SchoolOfferYear[]; firstYear: number | null; lastYear: number | null; hasOffer: boolean; source: typeof OFFER_SOURCE; restrictions: string[]; extensions: Record<string, never> }
/** Série de matrícula/turma/oferta de UMA escola (índice da PK (inep, year)); escola sem linha de oferta devolve `hasOffer: false` (sem matrícula ou turma em nenhuma edição). */
export async function getEducationSchoolOffer(q: Q, inep: number): Promise<SchoolOffer | null> {
  if (!Number.isInteger(inep)) return null;
  const known = (await q.query(`SELECT 1 FROM civica_exec.exec_edu_school WHERE inep = $1`, [inep])).rowCount; if (!known) return null;
  const r = (await q.query(`SELECT o.*, y.dep, y.entity_id FROM civica_exec.exec_edu_offer_year o JOIN civica_exec.exec_edu_school_year y ON y.inep = o.inep AND y.year = o.year WHERE o.inep = $1 ORDER BY o.year`, [inep])).rows;
  const years: SchoolOfferYear[] = r.map(x => ({ year: Number(x.year), matriculas: Number(x.mat_bas ?? 0), turmas: Number(x.tur_bas ?? 0), matPorTurma: ratio(n(x.mat_bas), n(x.tur_bas)), stages: stagesOf(x as Record<string, number | null>, null), special: specialOf(x as Record<string, number | null>), dependency: { code: Number(x.dep), label: EDU_DEP[Number(x.dep)] ?? String(x.dep) }, municipalityEntityId: Number(x.entity_id) }));
  return { inep, years, firstYear: years[0]?.year ?? null, lastYear: years.at(-1)?.year ?? null, hasOffer: years.length > 0, source: OFFER_SOURCE, restrictions: OFFER_RESTRICTIONS, extensions: {} };
}
