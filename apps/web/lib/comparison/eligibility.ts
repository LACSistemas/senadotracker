import type { ComparabilityMeta } from './types.ts';

/**
 * Contrato de elegibilidade (mandato Parte VII.13.1): "a comparação só pode ser apresentada como direta
 * quando os elementos relevantes forem compatíveis". Aplica a regra de forma única e testável — uma
 * dimensão incompatível basta para bloquear, e o motivo bloqueado é sempre explícito, nunca uma
 * comparação que desaparece silenciosamente nem uma que aparece como válida sem ser.
 */
export function assessComparability(meta: ComparabilityMeta): { eligible: boolean; reason: string | null } {
  const dims: Array<[boolean, string]> = [
    [meta.sameDefinition, 'a definição do indicador diverge entre os dois lados'],
    [meta.sameUnit, 'a unidade de medida diverge'],
    [meta.samePeriod, 'o período de referência diverge'],
    [meta.sameUniverse, 'o universo populacional diverge'],
    [meta.sameMethodology, 'a metodologia de apuração diverge'],
    [meta.sameScope, 'a abrangência territorial diverge'],
    [meta.sameAggregation, 'o critério de agregação diverge'],
  ];
  const failed = dims.find(([ok]) => !ok);
  if (failed) return { eligible: false, reason: `Comparação bloqueada: ${failed[1]}.` };
  if (meta.minCohort != null && (meta.cohortSize ?? 0) < meta.minCohort) {
    return { eligible: false, reason: `Comparação bloqueada: menos de ${meta.minCohort} territórios com dado elegível para formar um grupo de comparação (${meta.cohortSize ?? 0} disponíveis).` };
  }
  return { eligible: true, reason: null };
}
