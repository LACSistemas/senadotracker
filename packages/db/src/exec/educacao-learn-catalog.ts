/**
 * Catálogo de aprendizagem (P10.4): Ideb (INEP, divulgação 2025, todas as edições 2005–2025) e Saeb (resultados agregados 2017–2025). Módulo sem dependências (usado por specs, DDL, builders e leitura).
 * Regras de significado, vinculantes:
 *  - Ideb = N × P. N = nota padronizada do Saeb (0–10, `nota_media`); P = indicador de rendimento (0–1). As colunas `nota_mt` e `nota_lp` são as proficiências médias do Saeb na escala do Saeb (0–500), NÃO são o Ideb.
 *  - Ideb de rede, município, UF e Brasil é o publicado na própria linha do arquivo: nunca a média dos Idebs das escolas.
 *  - "-" no arquivo = não divulgado / não se aplica = NULL. Nunca zero.
 *  - Meta (`meta`) existe só para as edições 2007–2021 (1º ciclo de metas) e pertence a esse ciclo; não é meta "atual".
 *  - Etapas (anos iniciais, anos finais, ensino médio) não se somam nem se comparam entre si.
 */
export const IDEB_MEASURES = ['ap_tot', 'ap_1', 'ap_2', 'ap_3', 'ap_4', 'ap_5', 'p', 'nota_mt', 'nota_lp', 'nota_media', 'ideb', 'meta'] as const;
export const IDEB_LABELS: Record<string, string> = {
  ap_tot: 'Taxa de aprovação da etapa (%)', ap_1: 'Aprovação, 1ª série da etapa (%)', ap_2: 'Aprovação, 2ª série da etapa (%)', ap_3: 'Aprovação, 3ª série da etapa (%)', ap_4: 'Aprovação, 4ª série da etapa (%)', ap_5: 'Aprovação, 5ª série da etapa (%)',
  p: 'Indicador de rendimento P (0–1)', nota_mt: 'Proficiência média Saeb em Matemática (escala Saeb)', nota_lp: 'Proficiência média Saeb em Língua Portuguesa (escala Saeb)', nota_media: 'Nota padronizada N (0–10)', ideb: 'Ideb observado (N × P)', meta: 'Meta do Ideb (1º ciclo, 2007–2021)',
};
export const IDEB_STAGES: Record<number, string> = { 1: 'Anos iniciais (1º ao 5º ano)', 2: 'Anos finais (6º ao 9º ano)', 3: 'Ensino médio' };
/** Série dentro da etapa: AI 1º–5º ano; AF 6º–9º ano (posições 1–4); EM 1ª–4ª série. */
export const IDEB_FIRST_YEAR = 2005, IDEB_LAST_YEAR = 2025, IDEB_GOALS_FIRST = 2007, IDEB_GOALS_LAST = 2021;
export const IDEB_EDITIONS = [2005, 2007, 2009, 2011, 2013, 2015, 2017, 2019, 2021, 2023, 2025];
export const REDE_CODE: Record<string, number> = { total: 0, federal: 1, estadual: 2, municipal: 3, privada: 4, publica: 5, publico: 5, particular: 4 };
export const REDE_LABEL: Record<number, string> = { 0: 'Total', 1: 'Federal', 2: 'Estadual', 3: 'Municipal', 4: 'Privada', 5: 'Pública (federal, estadual e municipal)', 6: 'Estadual e municipal' };

export const SAEB_SUBJECTS: Record<string, number> = { LP: 1, MT: 2, CH: 3, CN: 4 };
export const SAEB_SUBJECT_LABEL: Record<number, string> = { 1: 'Língua Portuguesa', 2: 'Matemática', 3: 'Ciências Humanas', 4: 'Ciências da Natureza' };
export const SAEB_LEVEL_COLS = Array.from({ length: 11 }, (_, i) => `nv${i}`);
/** Série do Saeb: 2 (2º ano EF), 5 e 9 (EF) e 12, 13, 14 (3ª/4ª série do ensino médio). Dicionário da planilha de 2025: 12 = ensino médio tradicional, 13 = ensino médio integrado, 14 = tradicional ou integrado (total do EM). Nas edições anteriores confira o dicionário do arquivo da edição (CONTRATOS_IDEB_SAEB.md). */
export const SAEB_GRADE_LABEL: Record<number, string> = { 2: '2º ano do ensino fundamental', 5: '5º ano do ensino fundamental', 9: '9º ano do ensino fundamental', 12: 'Ensino médio tradicional (3ª/4ª série)', 13: 'Ensino médio integrado (3ª/4ª série)', 14: 'Ensino médio tradicional ou integrado (3ª/4ª série)' };
export const SAEB_EDITIONS = [2017, 2019, 2021, 2023, 2025];
export const SAEB_SCALE = 100;   // média, níveis e alfabetização gravados ×100 (as planilhas publicam até 2 casas decimais; conferido célula a célula)
