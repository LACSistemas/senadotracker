/** P11.2 source contract shared by the operational Censo Superior loader. */
export const INEP_HIGHER_YEARS = [2022, 2023, 2024] as const;
export const inepHigherZipUrl = (year: number) => `https://download.inep.gov.br/microdados/microdados_censo_da_educacao_superior_${year}.zip`;
export const inepHigherSinopseUrl = (year: number) => `https://download.inep.gov.br/informacoes_estatisticas/sinopses_estatisticas/sinopses_educacao_superior/sinopse_educacao_superior_${year}.zip`;

export interface HigherOfferIdentity {
  year: number; coIes: number; coCurso: number; coMunicipio: number;
  tpModalidade: number; tpDimensao: number;
}

/** Chave source-native: TP_DIMENSAO é obrigatória e não pode ser descartada. */
export const higherOfferNaturalKey = (r: HigherOfferIdentity): string => [r.year, r.coIes, r.coCurso, r.coMunicipio || 0, r.tpModalidade, r.tpDimensao].join(':');

/** TP_DIMENSAO 3/4 é nacional/exterior e não recebe município/UF inventado. */
export const higherOfferHasTerritory = (tpDimensao: number, coMunicipio: number | null | undefined): boolean => [1, 2].includes(tpDimensao) && Number(coMunicipio ?? 0) > 0;
