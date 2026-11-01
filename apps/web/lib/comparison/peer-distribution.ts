import type { Ruler } from '@/lib/security/types.ts';
import { assessComparability } from './eligibility.ts';

export interface PeerRulerOptions { unit: string; digits: number; cohort: string; year: string; minCohort?: number }
export type PeerRulerResult = { ruler: Ruler; reason: null } | { ruler: null; reason: string };

/**
 * Constrói uma régua de comparação (mesmo tipo `Ruler` que `BenchRuler`/`Kpi.ruler` já usam em Segurança/
 * Educação — nenhum componente visual novo) a partir de um mapa de valores JÁ CARREGADO pela página (ex.:
 * o valor de todos os municípios de uma UF para um indicador do Atlas Vivo) — nenhuma consulta nova ao
 * banco. Território×distribuição de pares (Parte VII.13 do mandato), aplicado aqui pela primeira vez.
 *
 * As 7 dimensões de `assessComparability` vêm todas fixas em `true`: por construção, esta função só
 * compara UM indicador contra o próprio mapa de valores de onde ele veio (mesma definição, unidade,
 * período, universo, metodologia, abrangência e agregação já garantidos por ser a mesma consulta) — o
 * único eixo que pode reprovar de verdade aqui é o tamanho da coorte (`minCohort`), daí o check explícito.
 */
export function buildPeerRuler(ownId: number, values: ReadonlyMap<number, number>, opts: PeerRulerOptions): PeerRulerResult {
  const own = values.get(ownId);
  if (own === undefined) return { ruler: null, reason: 'Território sem valor elegível para este indicador.' };
  const cohortSize = values.size;
  const { eligible, reason } = assessComparability({
    sameDefinition: true, sameUnit: true, samePeriod: true, sameUniverse: true, sameMethodology: true, sameScope: true, sameAggregation: true,
    minCohort: opts.minCohort ?? 5, cohortSize,
  });
  if (!eligible) return { ruler: null, reason: reason! };
  const sorted = [...values.values()].sort((a, b) => a - b);
  const quantile = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
  return {
    ruler: { own, p25: quantile(0.25), p50: quantile(0.5), p75: quantile(0.75), digits: opts.digits, unit: opts.unit, year: opts.year, cohort: opts.cohort, n: cohortSize },
    reason: null,
  };
}
