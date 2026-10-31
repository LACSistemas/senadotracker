'use client';

import { useState } from 'react';
import { ENTORNO_UNIT_LABEL, type EntornoUnit } from '@/lib/infrastructure/catalog';
import type { BarRow } from '@/lib/infrastructure/types';
import { cn } from '@/lib/utils';
import { BarList } from './infrastructure-ui';

const UNIT_CAPTION: Record<EntornoUnit, string> = {
  FACE: 'Percentual das faces de quadra do território com a característica observada pelo recenseador.',
  HOUSEHOLD: 'Percentual de domicílios particulares permanentes cujo entorno tem a característica.',
  RESIDENT: 'Percentual de moradores cujo entorno tem a característica.',
};

/** Alterna entre as três unidades estatísticas do Censo Entorno — nunca mistura FACES, DOMICÍLIOS e MORADORES no
 * mesmo gráfico, porque são denominadores diferentes (seção 10 do brief). Dado já carregado pelo servidor. */
export function EntornoUnitSwitcher({ byUnit }: { byUnit: Record<EntornoUnit, BarRow[]> }) {
  const order: EntornoUnit[] = ['HOUSEHOLD', 'RESIDENT', 'FACE'];
  const available = order.filter(u => byUnit[u].length > 0);
  const [active, setActive] = useState<EntornoUnit>(available[0] ?? 'HOUSEHOLD');
  if (!available.length) return null;
  return (
    <div>
      <div role="tablist" aria-label="Unidade estatística" className="mb-3 flex flex-wrap gap-2">
        {available.map(u => (
          <button key={u} type="button" role="tab" aria-selected={active === u} onClick={() => setActive(u)}
            className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors', active === u ? 'border-[#115b45] bg-[#115b45] text-white' : 'bg-white hover:border-[#115b45]/50')}>
            {ENTORNO_UNIT_LABEL[u]}
          </button>
        ))}
      </div>
      <BarList title={`Características do entorno — por ${ENTORNO_UNIT_LABEL[active].toLowerCase()}`} rows={byUnit[active]} max={100} caption={UNIT_CAPTION[active]} />
    </div>
  );
}
