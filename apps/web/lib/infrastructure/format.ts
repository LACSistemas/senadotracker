import type { InfrastructureIndicator, InfrastructureLevel } from '@senadotracker/db';
import { brl, brlShort, compact, fmt } from '../security/format.ts';

export { brl, brlShort, compact, fmt };

/** kW cru do MMGD em unidade legível: "1,2 GW", "340,5 MW", "820 kW" — nunca converte potência em geração de energia. */
export function kwCompact(kw: number): string {
  const abs = Math.abs(kw);
  if (abs >= 1e6) return `${fmt(kw / 1e6, 1)} GW`;
  if (abs >= 1e3) return `${fmt(kw / 1e3, 1)} MW`;
  return `${fmt(kw, 0)} kW`;
}

const PCT_UNITS = new Set(['Percentual', 'percentual', '%']);
const LARGE_COUNT_UNITS = new Set(['faturas', 'solicitações', 'eventos', 'unidades', 'km']);

/** Formata o valor de um indicador pela unidade real que a definição declara — sem arredondar valores financeiros
 * e sem inventar uma unidade que o catálogo não deu. `proporção` é um caso especial: no município é sim/não
 * (0 ou 1); agregado a UF/Brasil é o percentual de municípios respondentes que disseram sim. */
export function formatIndicatorValue(ind: Pick<InfrastructureIndicator, 'value' | 'unit' | 'territory'>): string {
  const v = ind.value;
  if (v == null) return '—';
  if (PCT_UNITS.has(ind.unit)) return `${fmt(v, 1)}%`;
  if (ind.unit === 'kW') return kwCompact(v);
  if (ind.unit === 'BRL') return brlShort(v);
  if (ind.unit === '(sim/não)') return v >= 1 ? 'Sim' : 'Não';
  if (ind.unit === 'proporção') return (ind.territory as InfrastructureLevel) === 'MUNICIPIO' ? (v >= 0.5 ? 'Sim' : 'Não') : `${fmt(v * 100, 0)}%`;
  if (LARGE_COUNT_UNITS.has(ind.unit)) return compact(v);
  return fmt(v, v % 1 ? 1 : 0);
}

/** Obras (Obrasgov): `planned_amount`, `amount_global`/`amount_accumulated` e `value_cents`/`committed_cents` são
 * CENTAVOS (bigint, convenção do Obrasgov); `liquidation`/`paid` (e os agregados `allocated_liquidated`/
 * `allocated_paid`/`stages.liquidated`/`stages.paid`) já vêm em REAIS (numeric). Nunca dividir estes dois últimos
 * por 100 — fariam o valor parecer 100× menor do que é. Usar `centsToReais` só nos três primeiros estágios. */
export const centsToReais = (v: number | string | null | undefined): number | null => v == null ? null : Number(v) / 100;

export function indicatorUnitLabel(unit: string): string {
  if (PCT_UNITS.has(unit)) return '';
  if (unit === '(sim/não)' || unit === 'proporção') return '';
  return unit;
}
