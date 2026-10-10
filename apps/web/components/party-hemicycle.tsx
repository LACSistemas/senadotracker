'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { PartyLogo } from '@/components/party-logo';
import { layoutHemicycle, type PartyComposition } from '@/lib/hemicycle';
import { NEUTRAL_PARTY_COLOR, partyColor } from '@/lib/party-colors';

const int = new Intl.NumberFormat('pt-BR');
const pct = (part: number, whole: number) => whole ? `${(100 * part / whole).toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%` : '—';

/**
 * Hemiciclo de composição partidária: cada círculo é uma cadeira ocupada por um parlamentar em exercício, em fileiras
 * concêntricas, agrupado por partido em fatias contínuas. A posição do círculo é ilustrativa (não é o mapa real do plenário)
 * e a ordem das fatias é por tamanho da bancada, nunca por espectro político.
 * Passar o mouse (ou focar) um partido na legenda ou numa cadeira destaca a bancada e troca o número central.
 */
export interface HemicycleLabels { /** plural: "deputados estaduais" */ noun: string; /** singular com artigo: "um deputado estadual" */ one: string; /** molde de URL com `{party}` (serializável: este componente é de cliente); omitido, a legenda não vira link */ partyHrefTemplate?: string }
const HOUSE_LABELS = { senado: { noun: 'senadores', one: 'um senador' }, camara: { noun: 'deputados', one: 'um deputado' } } as const;
export function PartyHemicycle({ composition, house, labels }: { composition: PartyComposition; house?: 'camara' | 'senado'; labels?: HemicycleLabels }) {
  const [active, setActive] = useState<string | null>(null);
  const { parties, total } = composition;
  const layout = useMemo(() => layoutHemicycle(parties.map(p => p.seats)), [parties]);
  const pad = layout.dotRadius + 2;
  const focus = active ? parties.find(p => p.party === active) ?? null : null;
  const base = labels ?? HOUSE_LABELS[house ?? 'camara'], noun = base.noun, partyHref = (party: string): string | null => labels ? (labels.partyHrefTemplate && party !== 'Sem partido' ? labels.partyHrefTemplate.replace('{party}', encodeURIComponent(party)) : null) : `/legislativo/partidos/${encodeURIComponent(party)}`;
  const label = `Composição partidária: ${parties.slice(0, 12).map(p => `${p.party} ${p.seats}`).join(', ')}${parties.length > 12 ? ` e mais ${parties.length - 12} partidos` : ''}. Total de ${total} cadeiras.`;
  const chips: Array<[string, string, string]> = [
    [String(parties.length), parties.length === 1 ? 'partido com cadeira' : 'partidos com cadeira', 'no cadastro em exercício'],
    [parties[0] ? int.format(parties[0].seats) : '—', 'maior bancada', parties[0] ? `${parties[0].party} · ${pct(parties[0].seats, total)}` : ''],
    [int.format(Math.floor(total / 2) + 1), 'maioria absoluta', `de ${int.format(total)} cadeiras`],
  ];

  return <figure className="rounded-3xl border bg-card p-5 shadow-sm sm:p-7">
    <figcaption className="sr-only">{label}</figcaption>
    <div className="relative mx-auto w-full max-w-3xl">
      <svg viewBox={`${-layout.outer - pad} ${-layout.outer - pad} ${2 * (layout.outer + pad)} ${layout.outer + 2 * pad}`} role="img" aria-label={label} className="block h-auto w-full overflow-visible" onMouseLeave={() => setActive(null)}>
        {parties.map((party, partyIndex) => <g key={party.party} className="hemi-party cursor-pointer" fill={partyColor(party.party)} style={{ ['--d' as string]: `${partyIndex * 55}ms`, opacity: active && active !== party.party ? 0.16 : 1 }}
          onMouseEnter={() => setActive(party.party)} onClick={() => setActive(current => current === party.party ? null : party.party)}>
          {layout.seats.filter(seat => seat.party === partyIndex).map((seat, index) => <circle key={index} cx={seat.x.toFixed(1)} cy={seat.y.toFixed(1)} r={layout.dotRadius.toFixed(2)}/>)}
        </g>)}
      </svg>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto flex w-[34%] flex-col items-center text-center" aria-live="polite">
        <strong className="display-title block text-4xl sm:text-6xl" style={focus ? { color: partyColor(focus.party) } : undefined}>{int.format(focus ? focus.seats : total)}</strong>
        <span className="eyebrow mt-1 max-w-full truncate text-[.62rem] sm:text-[.72rem]">{focus ? `${focus.party} · ${pct(focus.seats, total)}` : 'cadeiras'}</span>
      </div>
    </div>

    <dl className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">{chips.map(([value, name, note]) => <div key={name} className="rounded-2xl bg-secondary p-3 text-secondary-foreground sm:p-4"><dt className="sr-only">{name}</dt><dd><strong className="display-title block text-2xl sm:text-3xl">{value}</strong><span className="mt-1 block text-[11px] font-bold leading-4 sm:text-xs">{name}</span><span className="block text-[11px] leading-4 opacity-75 sm:text-xs">{note}</span></dd></div>)}</dl>

    <ul className="mt-6 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3" aria-label={`Partidos e cadeiras ocupadas por ${noun}`}>
      {parties.map(p => <li key={p.party}>
        <Link prefetch={false} href={partyHref(p.party) ?? '#'} aria-disabled={partyHref(p.party) === null} onMouseEnter={() => setActive(p.party)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(p.party)} onBlur={() => setActive(null)}
          className="focus-ring grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm transition hover:bg-muted data-[on=true]:bg-muted" data-on={active === p.party}>
          <i aria-hidden="true" className="size-3 rounded-full ring-2 ring-card" style={{ background: p.party === 'Sem partido' ? NEUTRAL_PARTY_COLOR : partyColor(p.party) }}/>
          <PartyLogo party={p.party} size={26}/>
          <span className="truncate font-bold">{p.party}</span>
          <span className="whitespace-nowrap text-right tabular-nums"><strong>{int.format(p.seats)}</strong><small className="ml-1.5 text-xs text-muted-foreground">{pct(p.seats, total)}</small></span>
        </Link>
      </li>)}
    </ul>
    <p className="mt-5 text-xs leading-5 text-muted-foreground">Cada círculo é uma cadeira ocupada por {base.one} em exercício no cadastro publicado. A ordem das fatias segue o tamanho da bancada, do maior para o menor; a posição de cada círculo é ilustrativa e a cor apenas distingue partidos, sem indicar espectro político.</p>
  </figure>;
}
