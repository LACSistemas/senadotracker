'use client';

import { useState } from 'react';
import { PartyHemicycle } from '@/components/party-hemicycle';
import type { PartyComposition } from '@/lib/hemicycle';
import { cn } from '@/lib/utils';

export interface HouseOption { key: string; label: string; composition: PartyComposition; house?: 'camara' | 'senado' | undefined; noun: string; one: string; partyHrefTemplate: string }

/** Alterna entre Senado/Câmara dos Deputados/Assembleia (ou Câmara Distrital), cada um com o próprio
 * hemiciclo — em vez de uma única visualização com as 3 Casas misturadas, que fazia parecer uma bancada
 * só (P8.7 anterior já notou isso: "não é uma bancada única"). Dado 100% já calculado no servidor
 * (`getTerritoryLegislativeComposition` já separa por `houseId`); este componente só troca qual
 * `PartyComposition` pré-pronta é exibida — nenhuma consulta nova ao trocar de aba. */
export function LegislativeHouseToggle({ options }: { options: HouseOption[] }) {
  const [active, setActive] = useState(options[0]?.key ?? '');
  const current = options.find(o => o.key === active) ?? options[0];
  if (!current) return null;
  return (
    <div>
      <div role="group" aria-label="Casa legislativa" className="flex flex-wrap gap-2">
        {options.map(o => (
          <button key={o.key} type="button" onClick={() => setActive(o.key)} aria-pressed={active === o.key}
            className={cn('focus-ring rounded-full border px-4 py-1.5 text-sm font-semibold', active === o.key ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/50')}>
            {o.label} <span className="tnum">({o.composition.total})</span>
          </button>
        ))}
      </div>
      <div className="mt-5"><PartyHemicycle composition={current.composition} house={current.house} labels={{ noun: current.noun, one: current.one, partyHrefTemplate: current.partyHrefTemplate }} /></div>
    </div>
  );
}
