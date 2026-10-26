/**
 * Catálogo dos Indicadores Educacionais oficiais do INEP usados na P10.3 (condições de ensino): ATU, HAD, DSU, AFD, IED, IRD e ICG.
 * O Cívica LÊ o valor publicado pelo INEP (escola, município, UF, região, Brasil); nunca recalcula nem faz média de percentuais. Cada medida guarda o valor ×10 em smallint (ird_media ×1000; icg_nivel inteiro) (NULL = a célula
 * oficial vem vazia, suprimida ou "--" = a etapa não se aplica; 0 é um zero publicado).
 *  - ATU: média de alunos por turma (alunos ÷ turmas do Censo, metodologia do INEP; difere da razão derivada do Cívica na P10.2).
 *  - HAD: média de horas-aula diárias (série com ajuste de metodologia: ver nota na matriz).
 *  - DSU: % de FUNÇÕES docentes com curso superior (a unidade é a função docente, não o professor distinto).
 *  - AFD: % de docentes por grupo de adequação da formação à disciplina (grupo 1 = formação adequada; 5 = sem formação superior).
 *  - IED: % de docentes por nível de esforço docente (1 = menor esforço; 6 = maior).
 *  - IRD: escola = média do indicador de regularidade (1 a 5); território = % de escolas por faixa (0–2, 2–3, 3–4, 4–5).
 *  - ICG: escola = nível de complexidade de gestão (1 a 6); território = % de escolas por nível.
 */
export type IndFamily = 'ATU' | 'HAD' | 'DSU' | 'AFD' | 'IED' | 'IRD' | 'ICG';
export type IndLevel = 'school' | 'terr' | 'both';
export interface IndMeasure { code: string; family: IndFamily; stage: string; group: number | null; label: string; unit: string; scale: number; level: IndLevel; from: number }
export const IND_SCALE = 10;   // os arquivos oficiais publicam 1 casa decimal (conferido: 0 células perdem precisão em ×10; ird_media tem 6 casas e usa ×1000)

export const IND_STAGES: Record<string, string> = {
  inf: 'Educação infantil', cre: 'Creche', pre: 'Pré-escola', fun: 'Ensino fundamental', ai: 'Anos iniciais', af: 'Anos finais', med: 'Ensino médio',
  eja: 'EJA', eja_fun: 'EJA fundamental', eja_med: 'EJA médio', bas: 'Educação básica',
};
const m = (code: string, family: IndFamily, stage: string, group: number | null, label: string, unit: string, level: IndLevel, from: number, scale = IND_SCALE): IndMeasure => ({ code, family, stage, group, label, unit, scale, level, from });
const stg = (s: string) => IND_STAGES[s]!;
const out: IndMeasure[] = [];
for (const s of ['inf', 'cre', 'pre', 'fun', 'ai', 'af', 'med']) out.push(m(`atu_${s}`, 'ATU', s, null, `Média de alunos por turma — ${stg(s)}`, 'alunos/turma', 'both', 2007));
for (const s of ['inf', 'cre', 'pre', 'fun', 'ai', 'af', 'med']) out.push(m(`had_${s}`, 'HAD', s, null, `Horas-aula diárias — ${stg(s)}`, 'horas', 'both', 2010));
for (const s of ['inf', 'cre', 'pre', 'fun', 'ai', 'af', 'med', 'eja', 'eja_fun', 'eja_med', 'bas']) out.push(m(`dsu_${s}`, 'DSU', s, null, `Funções docentes com curso superior — ${stg(s)}`, '% das funções docentes', 'both', 2011));
for (const s of ['inf', 'fun', 'ai', 'af', 'med', 'eja_fun', 'eja_med']) for (let g = 1; g <= 5; g++) out.push(m(`afd_${s}${g}`, 'AFD', s, g, `Docentes no grupo ${g} de adequação da formação — ${stg(s)}`, '% dos docentes', 'both', 2013));
for (const s of ['fun', 'ai', 'af', 'med']) for (let g = 1; g <= 6; g++) out.push(m(`ied_${s}${g}`, 'IED', s, g, `Docentes no nível ${g} de esforço — ${stg(s)}`, '% dos docentes', 'both', 2013));
out.push(m('ird_media', 'IRD', 'bas', null, 'Regularidade do corpo docente (média da escola, 1 a 5)', 'índice 1–5', 'school', 2013, 1000));
const IRD_BANDS = ['0 a 2 (baixa)', '2 a 3 (média-baixa)', '3 a 4 (média-alta)', '4 a 5 (alta)'];
IRD_BANDS.forEach((b, i) => out.push(m(`ird_b${i + 1}`, 'IRD', 'bas', i + 1, `Escolas na faixa de regularidade docente ${b}`, '% das escolas', 'terr', 2013)));
out.push(m('icg_nivel', 'ICG', 'bas', null, 'Nível de complexidade de gestão da escola (1 a 6)', 'nível 1–6', 'school', 2013, 1));
for (let g = 1; g <= 6; g++) out.push(m(`icg_n${g}`, 'ICG', 'bas', g, `Escolas no nível ${g} de complexidade de gestão`, '% das escolas', 'terr', 2013));

export const IND_MEASURES: IndMeasure[] = out;
export const IND_BY_CODE = new Map(IND_MEASURES.map(x => [x.code, x]));
export const IND_SCHOOL_COLS = IND_MEASURES.filter(x => x.level !== 'terr').map(x => x.code);
export const IND_TERR_COLS = IND_MEASURES.filter(x => x.level !== 'school').map(x => x.code);
/** Famílias com a primeira edição publicada por nível (escola/município/UF) segundo o inventário do INEP (inep_indicadores_arquivos.csv). */
export const IND_FIRST_YEAR: Record<IndFamily, { school: number; terr: number }> = {
  ATU: { school: 2007, terr: 2007 }, HAD: { school: 2010, terr: 2010 }, DSU: { school: 2011, terr: 2011 }, AFD: { school: 2013, terr: 2013 }, IED: { school: 2013, terr: 2013 }, IRD: { school: 2013, terr: 2013 }, ICG: { school: 2013, terr: 2016 },
};
export const IND_LAST_YEAR = 2025;
/** Dependência/localização dos arquivos territoriais → códigos da tabela exec_edu_ind_terr (0 = total). */
export const IND_DEP: Record<string, number> = { total: 0, federal: 1, estadual: 2, municipal: 3, privada: 4, publica: 5, publico: 5 };
export const IND_LOC: Record<string, number> = { total: 0, urbana: 1, rural: 2 };
