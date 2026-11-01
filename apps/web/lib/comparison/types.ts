/**
 * Contrato compartilhado de comparação territorial (mandato "Atlas Editorial Investigativo", Parte
 * VII.13). Antes de P4, `ComparePoint`/`TerritoryCompare` existiam como duas cópias byte-idênticas em
 * `lib/wellbeing/types.ts` e `lib/infrastructure/types.ts` (confirmado por diff) — esta é a versão
 * canônica; os dois arquivos de domínio agora reexportam daqui em vez de duplicar.
 */

/** Um ponto de comparação (ex.: o território, a UF ou o Brasil) — `eligible=false` nunca vira um valor
 * fictício, só um motivo em texto (`reason`). Nunca omitir um ponto inelegível: mostrar com a ressalva. */
export interface ComparePoint { label: string; value: number | null; display: string; eligible: boolean; reason: string | null }

/** Comparação de até 3 pontos diretos (território/UF/Brasil). Em página de UF, `state` normalmente vem
 * `null` (seria o mesmo ponto que `own`). */
export interface TerritoryCompare { unit: string; year: string | null; own: ComparePoint; state: ComparePoint | null; brazil: ComparePoint; restrictions: string[] }

/**
 * Checklist de compatibilidade (Parte VII.13.1 do mandato): uma comparação só é direta quando TODAS as
 * dimensões abaixo baterem. Cada campo é uma afirmação já verificada por quem monta a comparação (o
 * backend/adaptador), não um cálculo feito aqui — `assessComparability` só aplica a regra "falhou uma,
 * bloqueia todas", de forma consistente em vez de cada domínio reimplementar o próprio critério.
 */
export interface ComparabilityMeta {
  sameDefinition: boolean;
  sameUnit: boolean;
  samePeriod: boolean;
  sameUniverse: boolean;
  sameMethodology: boolean;
  sameScope: boolean;
  sameAggregation: boolean;
  /** Tamanho mínimo de coorte para uma comparação de distribuição (ex.: pares do mesmo porte) fazer
   * sentido estatístico — comparar contra 2-3 municípios não é uma "distribuição". Omitido quando a
   * comparação não depende de uma coorte (ex.: só território×Brasil). */
  minCohort?: number;
  cohortSize?: number;
}
