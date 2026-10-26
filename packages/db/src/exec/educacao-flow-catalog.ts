/**
 * Catálogo de fluxo escolar (P10.4): rendimento (aprovação, reprovação, abandono), distorção idade-série e transição, a partir dos arquivos oficiais de Indicadores Educacionais do INEP. Sem dependências.
 * Regras de significado, vinculantes:
 *  - Rendimento do ano Y: aprovação + reprovação + abandono ≈ 100% (cada uma arredondada a 1 casa pelo INEP). O desvio acima do arredondamento é contado, não corrigido.
 *  - Distorção idade-série (TDI): % de matrículas com 2 anos ou mais de atraso em relação à idade recomendada da série. Não é rendimento.
 *  - Transição do ano Y para Y+1 (arquivo "Y/Y+1", gravado com year = Y): promoção + repetência + evasão + migração para EJA ≈ 100%. É outra medida que o rendimento (usa a matrícula do ano seguinte) e não se mistura com ele.
 *  - "--" no arquivo = não divulgado/não se aplica = NULL, nunca zero. Rede, localização e série são as do arquivo; rede/município/UF/Brasil nunca são médias de escolas.
 *  - Segmentos: do ensino fundamental de 9 anos (f1 = 1º ano … f9 = 9º ano); nos arquivos de 8 e 9 anos anteriores a 2010 "1ª série/2º Ano" é o f2. fun/ai/af = total do ensino fundamental, anos iniciais, anos finais;
 *    med = total do ensino médio, m1..m4 = 1ª a 4ª série, mns = médio não seriado.
 */
export const FLOW_SCALE = 100;   // percentuais gravados ×100 (smallint; as planilhas publicam 1 casa; conferido célula a célula)
export const FLOW_SEGS = ['fun', 'ai', 'af', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'med', 'm1', 'm2', 'm3', 'm4', 'mns'] as const;
const TDI_SEGS = FLOW_SEGS.filter(s => s !== 'mns');
const TRN_SEGS = FLOW_SEGS.filter(s => s !== 'mns' && s !== 'm4');
export const TXR_METRICS = ['ap', 'rp', 'ab'] as const;
export const TXR_COLS: string[] = TXR_METRICS.flatMap(m => FLOW_SEGS.map(s => `${m}_${s}`));
export const TDI_COLS: string[] = TDI_SEGS.map(s => `td_${s}`);
export const FLOW_COLS: string[] = [...TXR_COLS, ...TDI_COLS];
export const TRN_METRICS = ['pro', 'rep', 'eva', 'mej'] as const;
export const TRN_COLS: string[] = TRN_METRICS.flatMap(m => TRN_SEGS.map(s => `${m}_${s}`));
export const FLOW_METRIC_LABEL: Record<string, string> = { ap: 'Taxa de aprovação (%)', rp: 'Taxa de reprovação (%)', ab: 'Taxa de abandono (%)', td: 'Taxa de distorção idade-série (%)', pro: 'Taxa de promoção (%)', rep: 'Taxa de repetência (%)', eva: 'Taxa de evasão (%)', mej: 'Taxa de migração para a EJA (%)' };
export const FLOW_SEG_LABEL: Record<string, string> = {
  fun: 'Ensino fundamental (total)', ai: 'Anos iniciais (1º ao 5º ano)', af: 'Anos finais (6º ao 9º ano)', f1: '1º ano', f2: '2º ano', f3: '3º ano', f4: '4º ano', f5: '5º ano', f6: '6º ano', f7: '7º ano', f8: '8º ano', f9: '9º ano',
  med: 'Ensino médio (total)', m1: '1ª série do médio', m2: '2ª série do médio', m3: '3ª série do médio', m4: '4ª série do médio', mns: 'Ensino médio não seriado',
};
export const LOC_CODE: Record<string, number> = { total: 0, urbana: 1, rural: 2 };
export const LOC_LABEL: Record<number, string> = { 0: 'Total', 1: 'Urbana', 2: 'Rural' };

/** INSE (nível socioeconômico) do Inep: indicador agregado por escola, município, UF e Brasil, calculado do questionário do Saeb (2019, 2021, 2023). As escalas de 2019 e de 2021/2023 não são comparáveis. */
export const INSE_LEVEL_COLS = Array.from({ length: 8 }, (_, i) => `nv${i + 1}`);
export const INSE_EDITIONS = [2019, 2021, 2023];
export const INSE_SCALE = 100, INSE_MEDIA_SCALE = 10000;   // níveis ×100 (2 casas), média ×10000 (até 4 casas nos municípios)
export const INSE_REDE_LABEL: Record<number, string> = { 0: 'Total (federal, estadual, municipal e privada)', 1: 'Federal', 2: 'Estadual', 3: 'Municipal', 5: 'Federal, estadual e municipal', 6: 'Estadual e municipal' };
