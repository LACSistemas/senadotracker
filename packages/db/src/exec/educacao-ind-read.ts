import type { Pool } from 'pg';
import { IND_BY_CODE, IND_MEASURES, IND_SCHOOL_COLS, IND_TERR_COLS, IND_FIRST_YEAR, type IndFamily } from './educacao-ind-catalog.ts';

/**
 * Leitura dos Indicadores Educacionais OFICIAIS do INEP (P10.3): escola e território (Brasil, UF, município). Somente SELECT, parametrizados, sem N+1.
 * O valor devolvido é o publicado pelo INEP (nenhum recálculo, soma ou média de percentuais); município/UF/Brasil vêm das planilhas territoriais, nunca das escolas.
 */
type Q = Pick<Pool, 'query'>;
export const IND_RESTRICTIONS = [
  'Todos os valores são os publicados pelo INEP nos Indicadores Educacionais. O Cívica não os recalcula: o valor de um município não é a média das escolas dele, nem o de uma UF a média dos municípios.',
  'Média de alunos por turma (ATU) é o indicador oficial do INEP; a razão matrículas ÷ turmas da P10.2 é outro número, derivado pelo Cívica, e os dois não se substituem (universos e regras de exclusão diferem).',
  'Percentuais de formação (AFD), esforço (IED) e curso superior (DSU) têm por unidade o docente ou a FUNÇÃO docente conforme a família; um docente que atua em mais de uma escola ou etapa conta em cada uma. Não somar docentes entre escolas, etapas ou redes.',
  'Célula sem valor (NULL) = o INEP publicou "--" ou deixou em branco: suprimido ou etapa que não se aplica à escola ou ao território. Zero é zero publicado.',
  'Regularidade (IRD) e complexidade de gestão (ICG): na escola, um índice (1 a 5) e um nível (1 a 6); no território, a distribuição das escolas por faixa ou nível.',
  'Séries históricas de AFD, IED, IRD, DSU e HAD têm quebras metodológicas documentadas pelo INEP em notas técnicas; só compare anos consecutivos dentro da mesma família e confira a nota da edição.',
  'Estes indicadores descrevem condições de ensino. Não são nota de qualidade da escola nem permitem ranquear escolas de etapas diferentes.',
];
export const IND_SOURCE = { name: 'INEP, Indicadores Educacionais (planilhas oficiais por escola, município e UF)', url: 'https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/indicadores-educacionais', reference: 'Censo Escolar da edição' };
const DEP_LABEL: Record<number, string> = { 0: 'Total', 1: 'Federal', 2: 'Estadual', 3: 'Municipal', 4: 'Privada', 5: 'Pública (federal, estadual e municipal)' };
const LOC_LABEL: Record<number, string> = { 0: 'Total', 1: 'Urbana', 2: 'Rural' };
/** Medidas de cabeçalho exibidas nas séries. */
export const IND_SERIES_CODES = ['atu_fun', 'atu_med', 'atu_inf', 'had_fun', 'had_med', 'dsu_fun', 'dsu_med', 'afd_fun1', 'afd_med1', 'ied_fun1', 'ird_b4', 'icg_n6'];

export interface IndValue { code: string; family: IndFamily; label: string; stage: string; group: number | null; unit: string; value: number | null }
export interface IndCut { dep: number; depLabel: string; loc: number; locLabel: string; medidas: IndValue[] }
export interface EducationIndicators {
  scope: { kind: 'brasil' | 'uf' | 'municipio' | 'escola'; entityId: number | null; name: string; ibge7: string | null; inep: number | null };
  year: number; availableYears: number[]; recortes: IndCut[]; series: Array<{ year: number; medidas: Record<string, number | null> }>;
  firstYear: typeof IND_FIRST_YEAR; source: typeof IND_SOURCE; restrictions: string[]; extensions: Record<string, never>;
}
const num = (code: string, v: unknown): number | null => { if (v == null) return null; const s = IND_BY_CODE.get(code)!.scale; return Math.round(Number(v) / s * 1000) / 1000; };
const valuesOf = (row: Record<string, unknown>, cols: string[]): IndValue[] =>
  cols.map(c => { const m = IND_BY_CODE.get(c)!; return { code: c, family: m.family, label: m.label, stage: m.stage, group: m.group, unit: m.unit, value: num(c, row[c]) }; }).filter(x => x.value != null);
const sel = (cols: string[], alias = '') => cols.join(', ').replace(/(^|, )/g, `$1${alias}`);

export async function publishedIndYears(q: Q): Promise<number[]> { return (await q.query(`SELECT DISTINCT year FROM civica_exec.exec_edu_ind_cov ORDER BY year`)).rows.map(r => Number(r.year)); }

/** Brasil, UF ou município: todos os recortes dependência × localização que o INEP publica, e a série dos indicadores de cabeçalho no total. */
export async function getEducationTerritoryIndicators(q: Q, o: { ufCode?: number; ibge7?: string; year?: number; series?: boolean }): Promise<EducationIndicators | null> {
  let ent: { entity_id: number; name: string; kind: number } | undefined;
  if (o.ibge7 != null) { if (!/^\d{7}$/.test(o.ibge7)) return null; ent = (await q.query(`SELECT entity_id, name, kind FROM civica_exec.exec_entity WHERE kind = 4 AND ibge7 = $1`, [Number(o.ibge7)])).rows[0]; }
  else if (o.ufCode != null) ent = (await q.query(`SELECT entity_id, name, kind FROM civica_exec.exec_entity WHERE kind = 3 AND uf_code = $1`, [o.ufCode])).rows[0];
  else ent = (await q.query(`SELECT entity_id, name, kind FROM civica_exec.exec_entity WHERE kind = 1`)).rows[0];
  if (!ent) return null;
  const years = await publishedIndYears(q); if (!years.length) return null;
  const year = o.year ?? years.at(-1)!; if (!years.includes(year)) return null;
  const rows = (await q.query(`SELECT dep, loc, ${sel(IND_TERR_COLS)} FROM civica_exec.exec_edu_ind_terr WHERE entity_id = $1 AND year = $2 ORDER BY dep, loc`, [ent.entity_id, year])).rows;
  const recortes: IndCut[] = rows.map(r => ({ dep: Number(r.dep), depLabel: DEP_LABEL[Number(r.dep)] ?? String(r.dep), loc: Number(r.loc), locLabel: LOC_LABEL[Number(r.loc)] ?? String(r.loc), medidas: valuesOf(r, IND_TERR_COLS) }));
  const codes = IND_SERIES_CODES.filter(c => IND_TERR_COLS.includes(c));
  const series = o.series === false ? [] : (await q.query(`SELECT year, ${sel(codes)} FROM civica_exec.exec_edu_ind_terr WHERE entity_id = $1 AND dep = 0 AND loc = 0 ORDER BY year`, [ent.entity_id])).rows
    .map(r => ({ year: Number(r.year), medidas: Object.fromEntries(codes.map(c => [c, num(c, r[c])])) }));
  return { scope: { kind: ent.kind === 1 ? 'brasil' : ent.kind === 3 ? 'uf' : 'municipio', entityId: Number(ent.entity_id), name: String(ent.name), ibge7: o.ibge7 ?? null, inep: null }, year, availableYears: years, recortes, series, firstYear: IND_FIRST_YEAR, source: IND_SOURCE, restrictions: IND_RESTRICTIONS, extensions: {} };
}

/** Escola: indicadores oficiais da edição (a mais recente com valor, ou a pedida) e a série dos indicadores de cabeçalho. */
export async function getEducationSchoolIndicators(q: Q, inep: number, o: { year?: number } = {}): Promise<EducationIndicators | null> {
  if (!Number.isInteger(inep) || inep < 10_000_000) return null;
  const s = (await q.query(`SELECT name FROM civica_exec.exec_edu_school_year WHERE inep = $1 ORDER BY year DESC LIMIT 1`, [inep])).rows[0]; if (!s) return null;
  const all = (await q.query(`SELECT year, ${sel(IND_SCHOOL_COLS)} FROM civica_exec.exec_edu_ind_school WHERE inep = $1 ORDER BY year DESC`, [inep])).rows;
  const years = all.map(r => Number(r.year));
  const pick = all.find(r => o.year == null || Number(r.year) === o.year);
  const codes = IND_SERIES_CODES.filter(c => IND_SCHOOL_COLS.includes(c));
  const series = [...all].reverse().map(r => ({ year: Number(r.year), medidas: Object.fromEntries(codes.map(c => [c, num(c, r[c])])) }));
  return { scope: { kind: 'escola', entityId: null, name: String(s.name), ibge7: null, inep }, year: pick ? Number(pick.year) : 0, availableYears: years, recortes: pick ? [{ dep: 0, depLabel: 'Escola', loc: 0, locLabel: 'Escola', medidas: valuesOf(pick, IND_SCHOOL_COLS) }] : [], series, firstYear: IND_FIRST_YEAR, source: IND_SOURCE, restrictions: IND_RESTRICTIONS, extensions: {} };
}
void IND_MEASURES;

export interface EducationTeachers {
  scope: { kind: 'brasil' | 'uf' | 'municipio'; entityId: number; name: string };
  year: number; availableYears: number[];
  docentes: Array<{ code: string; label: string; value: number | null }>;
  series: Array<{ year: number; docentes: number | null }>;
  nota: string[]; source: { name: string; url: string };
}
export const TEACHER_NOTES = [
  'Docentes DISTINTOS oficiais da Sinopse Estatística: cada docente é contado uma vez em cada nível de agregação e em cada coluna. O total NÃO é a soma das etapas, das redes nem das escolas.',
  'Quem leciona em duas redes, duas etapas ou duas escolas conta em cada uma. Por isso, por exemplo, a soma das redes pública e privada pode superar o total.',
  'O Cívica não soma a contagem de docentes por escola para obter município, UF ou Brasil (superconta cerca de 22%) e não aplica coeficiente de correção.',
  'Sem lista nominal nem identificador de professor: apenas contagens oficiais agregadas.',
];
/** Docentes distintos oficiais (Sinopse 2.1/2.2) de Brasil, UF ou município, com a série do total. */
export async function getEducationTeachers(q: Q, o: { ufCode?: number; ibge7?: string; year?: number }): Promise<EducationTeachers | null> {
  const { DOC_COLS, DOC_LABELS } = await import('./educacao-doc-catalog.ts');
  let ent: { entity_id: number; name: string; kind: number } | undefined;
  if (o.ibge7 != null) { if (!/^\d{7}$/.test(o.ibge7)) return null; ent = (await q.query(`SELECT entity_id, name, kind FROM civica_exec.exec_entity WHERE kind = 4 AND ibge7 = $1`, [Number(o.ibge7)])).rows[0]; }
  else if (o.ufCode != null) ent = (await q.query(`SELECT entity_id, name, kind FROM civica_exec.exec_entity WHERE kind = 3 AND uf_code = $1`, [o.ufCode])).rows[0];
  else ent = (await q.query(`SELECT entity_id, name, kind FROM civica_exec.exec_entity WHERE kind = 1`)).rows[0];
  if (!ent) return null;
  const all = (await q.query(`SELECT year, ${DOC_COLS.join(', ')} FROM civica_exec.exec_edu_doc_terr WHERE entity_id = $1 ORDER BY year`, [ent.entity_id])).rows;
  if (!all.length) return null;
  const years = all.map(r => Number(r.year)); const year = o.year ?? years.at(-1)!; const row = all.find(r => Number(r.year) === year); if (!row) return null;
  return { scope: { kind: ent.kind === 1 ? 'brasil' : ent.kind === 3 ? 'uf' : 'municipio', entityId: Number(ent.entity_id), name: String(ent.name) }, year, availableYears: years,
    docentes: DOC_COLS.map(c => ({ code: c, label: DOC_LABELS[c]!, value: row[c] == null ? null : Number(row[c]) })), series: all.map(r => ({ year: Number(r.year), docentes: r.doc_total == null ? null : Number(r.doc_total) })),
    nota: TEACHER_NOTES, source: { name: 'INEP, Sinopse Estatística da Educação Básica (tabelas 2.1 e 2.2)', url: 'https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/censo-escolar/resultados' } };
}
