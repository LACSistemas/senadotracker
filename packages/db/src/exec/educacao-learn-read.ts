import type { Pool } from 'pg';
import { FLOW_COLS, FLOW_METRIC_LABEL, FLOW_SCALE, FLOW_SEG_LABEL, INSE_LEVEL_COLS, INSE_MEDIA_SCALE, INSE_REDE_LABEL, INSE_SCALE, LOC_LABEL, TRN_COLS } from './educacao-flow-catalog.ts';
import { IDEB_LABELS, IDEB_MEASURES, IDEB_STAGES, REDE_LABEL, SAEB_GRADE_LABEL, SAEB_LEVEL_COLS, SAEB_SCALE, SAEB_SUBJECT_LABEL } from './educacao-learn-catalog.ts';

/**
 * Leitura dos resultados educacionais OFICIAIS (P10.4): Ideb, Saeb agregado, rendimento, distorção idade-série, transição e INSE. Somente SELECT, parametrizados, sem N+1.
 * O valor devolvido é o publicado pelo INEP (convertido apenas da escala inteira de armazenamento para a unidade original). Nenhuma média, soma ou ranking é calculado aqui:
 * o Ideb de uma rede, município, UF ou Brasil NÃO é a média dos Idebs das escolas; Ideb ≠ Saeb; etapas e escalas diferentes não se comparam.
 */
type Q = Pick<Pool, 'query'>;
export const LEARN_RESTRICTIONS = [
  'Todos os valores são os publicados pelo INEP. O Cívica não os recalcula: o Ideb de uma rede, município, UF ou Brasil não é a média dos Idebs das escolas, e o resultado de um município não é a média das escolas dele.',
  'Ideb = N × P (nota padronizada do Saeb × indicador de rendimento). A proficiência do Saeb (escala 0–500) e a nota padronizada N (0–10) não são o Ideb. Anos iniciais, anos finais e ensino médio são etapas distintas e não se somam.',
  'Célula sem valor = o INEP publicou "-"/"--" ou suprimiu ("***", sigilo estatístico): não se aplica, não foi divulgado ou foi protegido. Não é zero e não é reconstruído.',
  'A meta do Ideb existe só até a edição de 2021 (ciclo de metas de 2007). As edições de 2023 e 2025 não têm meta, mas são comparáveis às anteriores segundo a Nota Informativa do Ideb 2025.',
  'Alfabetização do 2º ano em 2023 é uma estimativa amostral do Saeb (margem de erro de 2,8 pontos percentuais no Brasil a 21,5 nas UFs, Nota Técnica do Saeb 2023): não serve para comparar UFs. O INEP a descreve como base para estudos analíticos.',
  'Saeb: médias de edições, séries e disciplinas diferentes estão em escalas próprias. Não compare valores entre escalas diferentes; a escala do 2º ano (alfabetização) mudou entre 2021 e 2023.',
  'Rendimento (aprovação + reprovação + abandono) e transição (promoção + repetência + evasão + migração para a EJA) são medidas diferentes: a transição usa a matrícula do ano seguinte. Distorção idade-série não é rendimento.',
  'INSE: a escala de 2019 e a de 2021/2023 não são comparáveis. É um indicador agregado de contexto socioeconômico; não mede a qualidade da escola e não prova causalidade com o desempenho.',
  'Município pequeno ou rede com poucas escolas: o INEP não divulga resultados com participação insuficiente. A ausência de valor não significa resultado baixo.',
];
export const LEARN_SOURCES = {
  ideb: { name: 'INEP, Ideb 2005–2025 (divulgação 2025)', url: 'https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/ideb/resultados' },
  saeb: { name: 'INEP, Saeb: resultados agregados 2017–2025 (sem microdados)', url: 'https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/saeb/resultados' },
  fluxo: { name: 'INEP, Indicadores Educacionais: taxas de rendimento, distorção idade-série e transição', url: 'https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/indicadores-educacionais' },
  inse: { name: 'INEP, Indicador de Nível Socioeconômico (Inse) do Saeb', url: 'https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/indicadores-educacionais/nivel-socioeconomico' },
};

export type LearnScope = { kind: 'brasil' | 'regiao' | 'uf' | 'municipio' | 'escola'; entityId: number | null; name: string; ibge7: string | null; inep: number | null };
export interface LearnTerritoryKey { ufCode?: number; ibge7?: string }
async function resolveEntity(q: Q, o: LearnTerritoryKey): Promise<{ entity_id: number; name: string; kind: number } | undefined> {
  if (o.ibge7 != null) { if (!/^\d{7}$/.test(o.ibge7)) return undefined; return (await q.query(`SELECT entity_id, name, kind FROM civica_exec.exec_entity WHERE kind = 4 AND ibge7 = $1`, [Number(o.ibge7)])).rows[0]; }
  if (o.ufCode != null) return (await q.query(`SELECT entity_id, name, kind FROM civica_exec.exec_entity WHERE kind = 3 AND uf_code = $1`, [o.ufCode])).rows[0];
  return (await q.query(`SELECT entity_id, name, kind FROM civica_exec.exec_entity WHERE kind = 1`)).rows[0];
}
const scopeOf = (e: { entity_id: number; name: string; kind: number }, o: LearnTerritoryKey): LearnScope => ({ kind: e.kind === 1 ? 'brasil' : e.kind === 2 ? 'regiao' : e.kind === 3 ? 'uf' : 'municipio', entityId: Number(e.entity_id), name: String(e.name), ibge7: o.ibge7 ?? null, inep: null });
const schoolName = async (q: Q, inep: number): Promise<string | null> => Number.isInteger(inep) && inep >= 10_000_000 ? (await q.query(`SELECT name FROM civica_exec.exec_edu_school_year WHERE inep = $1 ORDER BY year DESC LIMIT 1`, [inep])).rows[0]?.name ?? null : null;
const div = (v: unknown, s: number): number | null => v == null ? null : Math.round(Number(v) / s * 10000) / 10000;
const dbl = (v: unknown): number | null => v == null ? null : Number(v);

// ======================================================================= Ideb
export interface IdebReadRow { year: number; stage: number; stageLabel: string; dep: number; depLabel: string; values: Record<string, number | null> }
export interface IdebResult { scope: LearnScope; editions: number[]; rows: IdebReadRow[]; labels: Record<string, string>; restrictions: string[]; source: typeof LEARN_SOURCES.ideb }
const idebReadRow = (r: Record<string, unknown>): IdebReadRow => ({ year: Number(r.year), stage: Number(r.stage), stageLabel: IDEB_STAGES[Number(r.stage)] ?? String(r.stage), dep: Number(r.dep), depLabel: REDE_LABEL[Number(r.dep)] ?? String(r.dep), values: Object.fromEntries(IDEB_MEASURES.map(m => [m, dbl(r[m])])) });
/** Brasil, UF ou município: o Ideb publicado para cada edição × etapa × rede, com componentes (aprovação, P, proficiências, N) e meta (até 2021). */
export async function getIdebTerritory(q: Q, o: LearnTerritoryKey & { stage?: number; dep?: number }): Promise<IdebResult | null> {
  const e = await resolveEntity(q, o); if (!e) return null;
  const rows = (await q.query(`SELECT year, stage, dep, ${IDEB_MEASURES.join(', ')} FROM civica_exec.exec_edu_ideb_terr WHERE entity_id = $1 AND ($2::smallint IS NULL OR stage = $2) AND ($3::smallint IS NULL OR dep = $3) ORDER BY year, stage, dep`, [e.entity_id, o.stage ?? null, o.dep ?? null])).rows;
  if (!rows.length) return null;
  return { scope: scopeOf(e, o), editions: [...new Set(rows.map(r => Number(r.year)))], rows: rows.map(idebReadRow), labels: IDEB_LABELS, restrictions: LEARN_RESTRICTIONS, source: LEARN_SOURCES.ideb };
}
/** Escola: o Ideb publicado por edição × etapa. Escola sem Ideb na edição simplesmente não tem linha (não é zero). */
export async function getIdebSchool(q: Q, inep: number): Promise<IdebResult | null> {
  const name = await schoolName(q, inep); if (name == null) return null;
  const rows = (await q.query(`SELECT year, stage, dep, ${IDEB_MEASURES.join(', ')} FROM civica_exec.exec_edu_ideb_school WHERE inep = $1 ORDER BY year, stage`, [inep])).rows;
  return { scope: { kind: 'escola', entityId: null, name, ibge7: null, inep }, editions: [...new Set(rows.map(r => Number(r.year)))], rows: rows.map(idebReadRow), labels: IDEB_LABELS, restrictions: LEARN_RESTRICTIONS, source: LEARN_SOURCES.ideb };
}

// ======================================================================= Saeb
export interface SaebReadRow { year: number; dep: number; depLabel: string; loc: number; locLabel: string; cap: number; grade: number; gradeLabel: string; subj: number; subjLabel: string; media: number | null; alfabetizacao: number | null; niveis: Array<number | null> }
export interface SaebResult { scope: LearnScope; editions: number[]; rows: SaebReadRow[]; restrictions: string[]; source: typeof LEARN_SOURCES.saeb }
const DEP_ALL: Record<number, string> = { ...REDE_LABEL, 6: 'Estadual e municipal' };
/** Resultados agregados do Saeb (média de proficiência e distribuição por nível) do território, por edição × série × disciplina × rede. Sem microdados. */
export async function getSaebTerritory(q: Q, o: LearnTerritoryKey & { grade?: number; subj?: number; dep?: number; loc?: number; cap?: number }): Promise<SaebResult | null> {
  const e = await resolveEntity(q, o); if (!e) return null;
  const rows = (await q.query(`SELECT year, dep, loc, cap, grade, subj, media, tx_alf, ${SAEB_LEVEL_COLS.join(', ')} FROM civica_exec.exec_edu_saeb_terr WHERE entity_id = $1
    AND ($2::smallint IS NULL OR grade = $2) AND ($3::smallint IS NULL OR subj = $3) AND ($4::smallint IS NULL OR dep = $4) AND ($5::smallint IS NULL OR loc = $5) AND ($6::smallint IS NULL OR cap = $6) ORDER BY year, grade, subj, dep, loc, cap`,
    [e.entity_id, o.grade ?? null, o.subj ?? null, o.dep ?? null, o.loc ?? null, o.cap ?? null])).rows;
  if (!rows.length) return null;
  return { scope: scopeOf(e, o), editions: [...new Set(rows.map(r => Number(r.year)))], restrictions: LEARN_RESTRICTIONS, source: LEARN_SOURCES.saeb,
    rows: rows.map(r => ({ year: Number(r.year), dep: Number(r.dep), depLabel: DEP_ALL[Number(r.dep)] ?? String(r.dep), loc: Number(r.loc), locLabel: LOC_LABEL[Number(r.loc)] ?? '', cap: Number(r.cap), grade: Number(r.grade), gradeLabel: SAEB_GRADE_LABEL[Number(r.grade)] ?? String(r.grade),
      subj: Number(r.subj), subjLabel: SAEB_SUBJECT_LABEL[Number(r.subj)] ?? String(r.subj), media: div(r.media, SAEB_SCALE), alfabetizacao: div(r.tx_alf, SAEB_SCALE), niveis: SAEB_LEVEL_COLS.map(c => div(r[c], SAEB_SCALE)) })) };
}

// ======================================================================= rendimento e distorção
export interface FlowValues { code: string; metric: string; metricLabel: string; segment: string; segmentLabel: string; value: number | null }
export interface FlowCut { year: number; dep: number; depLabel: string; loc: number; locLabel: string; values: FlowValues[] }
export interface FlowResult { scope: LearnScope; editions: number[]; cuts: FlowCut[]; series: Array<{ year: number; values: Record<string, number | null> }>; restrictions: string[]; source: typeof LEARN_SOURCES.fluxo }
/** Séries de cabeçalho: aprovação, reprovação, abandono e distorção do ensino fundamental, anos iniciais, anos finais e ensino médio (total). */
export const FLOW_SERIES_CODES = ['ap_fun', 'rp_fun', 'ab_fun', 'td_fun', 'ap_ai', 'ap_af', 'ap_med', 'rp_med', 'ab_med', 'td_ai', 'td_af', 'td_med'];
const flowValues = (r: Record<string, unknown>, cols: string[], scale: number): FlowValues[] => cols.map(c => { const [m, s] = [c.slice(0, c.indexOf('_')), c.slice(c.indexOf('_') + 1)]; return { code: c, metric: m!, metricLabel: FLOW_METRIC_LABEL[m!] ?? m!, segment: s!, segmentLabel: FLOW_SEG_LABEL[s!] ?? s!, value: div(r[c], scale) }; }).filter(v => v.value != null);
/** Território: todos os recortes localização × rede de uma edição (a mais recente por padrão) e a série de cabeçalho no total. */
export async function getFlowTerritory(q: Q, o: LearnTerritoryKey & { year?: number }): Promise<FlowResult | null> {
  const e = await resolveEntity(q, o); if (!e) return null;
  const years = (await q.query(`SELECT DISTINCT year FROM civica_exec.exec_edu_flow_terr WHERE entity_id = $1 ORDER BY year`, [e.entity_id])).rows.map(r => Number(r.year)); if (!years.length) return null;
  const year = o.year ?? years.at(-1)!; if (!years.includes(year)) return null;
  const cuts = (await q.query(`SELECT dep, loc, ${FLOW_COLS.join(', ')} FROM civica_exec.exec_edu_flow_terr WHERE entity_id = $1 AND year = $2 ORDER BY dep, loc`, [e.entity_id, year])).rows;
  const series = (await q.query(`SELECT year, ${FLOW_SERIES_CODES.join(', ')} FROM civica_exec.exec_edu_flow_terr WHERE entity_id = $1 AND dep = 0 AND loc = 0 ORDER BY year`, [e.entity_id])).rows;
  return { scope: scopeOf(e, o), editions: years, restrictions: LEARN_RESTRICTIONS, source: LEARN_SOURCES.fluxo,
    cuts: cuts.map(r => ({ year, dep: Number(r.dep), depLabel: REDE_LABEL[Number(r.dep)] ?? String(r.dep), loc: Number(r.loc), locLabel: LOC_LABEL[Number(r.loc)] ?? '', values: flowValues(r, FLOW_COLS, FLOW_SCALE) })),
    series: series.map(r => ({ year: Number(r.year), values: Object.fromEntries(FLOW_SERIES_CODES.map(c => [c, div(r[c], FLOW_SCALE)])) })) };
}
/** Escola: rendimento e distorção por edição (todas as séries publicadas) — a escola é o próprio registro do INEP, não uma soma. */
export async function getFlowSchool(q: Q, inep: number): Promise<FlowResult | null> {
  const name = await schoolName(q, inep); if (name == null) return null;
  const rows = (await q.query(`SELECT year, dep, loc, ${FLOW_COLS.join(', ')} FROM civica_exec.exec_edu_flow_school WHERE inep = $1 ORDER BY year`, [inep])).rows;
  return { scope: { kind: 'escola', entityId: null, name, ibge7: null, inep }, editions: rows.map(r => Number(r.year)), restrictions: LEARN_RESTRICTIONS, source: LEARN_SOURCES.fluxo,
    cuts: rows.map(r => ({ year: Number(r.year), dep: Number(r.dep), depLabel: REDE_LABEL[Number(r.dep)] ?? String(r.dep), loc: Number(r.loc), locLabel: LOC_LABEL[Number(r.loc)] ?? '', values: flowValues(r, FLOW_COLS, FLOW_SCALE) })),
    series: rows.map(r => ({ year: Number(r.year), values: Object.fromEntries(FLOW_SERIES_CODES.map(c => [c, div(r[c], FLOW_SCALE)])) })) };
}
/** Transição do ano Y para Y+1 (year = Y): promoção, repetência, evasão e migração para a EJA. */
export async function getTransitionTerritory(q: Q, o: LearnTerritoryKey & { year?: number }): Promise<FlowResult | null> {
  const e = await resolveEntity(q, o); if (!e) return null;
  const years = (await q.query(`SELECT DISTINCT year FROM civica_exec.exec_edu_trn_terr WHERE entity_id = $1 ORDER BY year`, [e.entity_id])).rows.map(r => Number(r.year)); if (!years.length) return null;
  const year = o.year ?? years.at(-1)!; if (!years.includes(year)) return null;
  const cuts = (await q.query(`SELECT dep, loc, ${TRN_COLS.join(', ')} FROM civica_exec.exec_edu_trn_terr WHERE entity_id = $1 AND year = $2 ORDER BY dep, loc`, [e.entity_id, year])).rows;
  const hdr = ['pro_fun', 'rep_fun', 'eva_fun', 'mej_fun', 'pro_med', 'rep_med', 'eva_med', 'mej_med'];
  const series = (await q.query(`SELECT year, ${hdr.join(', ')} FROM civica_exec.exec_edu_trn_terr WHERE entity_id = $1 AND dep = 0 AND loc = 0 ORDER BY year`, [e.entity_id])).rows;
  return { scope: scopeOf(e, o), editions: years, restrictions: LEARN_RESTRICTIONS, source: LEARN_SOURCES.fluxo,
    cuts: cuts.map(r => ({ year, dep: Number(r.dep), depLabel: REDE_LABEL[Number(r.dep)] ?? String(r.dep), loc: Number(r.loc), locLabel: LOC_LABEL[Number(r.loc)] ?? '', values: flowValues(r, TRN_COLS, FLOW_SCALE) })),
    series: series.map(r => ({ year: Number(r.year), values: Object.fromEntries(hdr.map(c => [c, div(r[c], FLOW_SCALE)])) })) };
}

// ======================================================================= INSE
export interface InseReadRow { year: number; dep: number; depLabel: string; loc: number; cap: number; alunos: number | null; media: number | null; classe: number | null; niveis: Array<number | null> }
export interface InseResult { scope: LearnScope; editions: number[]; rows: InseReadRow[]; restrictions: string[]; source: typeof LEARN_SOURCES.inse }
const inseReadRow = (r: Record<string, unknown>): InseReadRow => ({ year: Number(r.year), dep: Number(r.dep), depLabel: INSE_REDE_LABEL[Number(r.dep)] ?? DEP_ALL[Number(r.dep)] ?? String(r.dep), loc: Number(r.loc), cap: Number(r.cap ?? 0), alunos: r.qtd == null ? null : Number(r.qtd), media: div(r.media, INSE_MEDIA_SCALE), classe: r.cls == null ? null : Number(r.cls), niveis: INSE_LEVEL_COLS.map(c => div(r[c], INSE_SCALE)) });
export async function getInseTerritory(q: Q, o: LearnTerritoryKey): Promise<InseResult | null> {
  const e = await resolveEntity(q, o); if (!e) return null;
  const rows = (await q.query(`SELECT year, dep, loc, cap, qtd, media, ${INSE_LEVEL_COLS.join(', ')} FROM civica_exec.exec_edu_inse_terr WHERE entity_id = $1 ORDER BY year, dep, loc, cap`, [e.entity_id])).rows; if (!rows.length) return null;
  return { scope: scopeOf(e, o), editions: [...new Set(rows.map(r => Number(r.year)))], rows: rows.map(inseReadRow), restrictions: LEARN_RESTRICTIONS, source: LEARN_SOURCES.inse };
}
export async function getInseSchool(q: Q, inep: number): Promise<InseResult | null> {
  const name = await schoolName(q, inep); if (name == null) return null;
  const rows = (await q.query(`SELECT year, dep, loc, qtd, media, cls, ${INSE_LEVEL_COLS.join(', ')} FROM civica_exec.exec_edu_inse_school WHERE inep = $1 ORDER BY year`, [inep])).rows;
  return { scope: { kind: 'escola', entityId: null, name, ibge7: null, inep }, editions: rows.map(r => Number(r.year)), rows: rows.map(inseReadRow), restrictions: LEARN_RESTRICTIONS, source: LEARN_SOURCES.inse };
}

// ======================================================================= cobertura
export interface LearnCoverageRow { family: number; familyLabel: string; year: number; level: 'escola' | 'territorio'; rowsIn: number; valid: number; rejected: number; noIdentity: number; cells: number; cellsSuppressed: number }
const FAMILY_LABEL: Record<number, string> = { 1: 'Ideb', 2: 'Saeb', 3: 'Rendimento', 4: 'Distorção idade-série', 5: 'Transição', 6: 'INSE' };
/** Cobertura publicada por família × edição × nível (linhas lidas, válidas, rejeitadas, escolas sem identidade, células publicadas e suprimidas). */
export async function getLearningCoverage(q: Q, o: { family?: number } = {}): Promise<LearnCoverageRow[]> {
  const rows = (await q.query(`SELECT family, year, lvl, sum(rows_in)::bigint rows_in, sum(valid)::bigint valid, sum(rejected)::bigint rejected, sum(no_identity)::bigint no_identity, sum(cells_num)::bigint cells, sum(cells_supp)::bigint supp FROM (
      SELECT * FROM civica_exec.exec_edu_ideb_cov UNION ALL SELECT * FROM civica_exec.exec_edu_saeb_cov UNION ALL SELECT * FROM civica_exec.exec_edu_flow_cov
      UNION ALL SELECT * FROM civica_exec.exec_edu_trn_cov UNION ALL SELECT * FROM civica_exec.exec_edu_inse_cov) c WHERE ($1::smallint IS NULL OR family = $1) GROUP BY family, year, lvl ORDER BY family, year, lvl`, [o.family ?? null])).rows;
  return rows.map(r => ({ family: Number(r.family), familyLabel: FAMILY_LABEL[Number(r.family)] ?? String(r.family), year: Number(r.year), level: Number(r.lvl) === 1 ? 'escola' : 'territorio', rowsIn: Number(r.rows_in), valid: Number(r.valid), rejected: Number(r.rejected), noIdentity: Number(r.no_identity), cells: Number(r.cells), cellsSuppressed: Number(r.supp) }));
}
