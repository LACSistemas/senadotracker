import type { ComparePoint, TerritoryCompare } from '@/lib/comparison/types';

/**
 * Comparador territorial canônico (Parte VII.13 do mandato) — até 3 pontos diretos (território/UF/
 * Brasil), nunca uma faixa de percentil (essa leitura é `BenchRuler`, já reusado à parte por quem tem
 * `Kpi.ruler`/`buildPeerRuler`, ver `lib/comparison/peer-distribution.ts`). Pontos sem valor elegível
 * aparecem como texto com o motivo, nunca como zero nem silenciosamente omitidos.
 *
 * Movido de `components/wellbeing/territory-compare.tsx` nesta fase (P4): era uma cópia byte-idêntica em
 * `components/infrastructure/territory-compare.tsx` (confirmado por diff, só o import de tipo e um
 * comentário divergiam). Os dois arquivos de domínio agora só reexportam este componente — nenhum call
 * site precisou mudar.
 */
export function TerritoryCompareRow({ c }: { c: TerritoryCompare }) {
  const all = [c.own, c.state, c.brazil].filter((p): p is ComparePoint => p != null);
  const points = all.filter((p): p is ComparePoint & { value: number } => p.eligible && p.value != null);
  const lo = points.length ? Math.min(...points.map(p => p.value)) : 0; const hi = points.length ? Math.max(...points.map(p => p.value)) : 1;
  const span = hi - lo || 1; const pos = (v: number) => `${5 + ((v - lo) / span) * 90}%`;
  const label = (p: ComparePoint) => `${p.label}: ${p.eligible ? p.display : `não aplicável (${p.reason})`}`;
  return (
    <div className="rounded-xl border bg-white/80 p-3">
      <p className="text-[0.7rem] font-semibold text-[#14304f]">{c.own.label}{c.year ? ` em ${c.year}` : ''}: {c.own.display}</p>
      {points.length > 1 && (
        <div className="relative mt-3 h-6" role="img" aria-label={`${[c.own, c.state, c.brazil].filter((p): p is ComparePoint => p != null).map(label).join('. ')}.`}>
          <div className="absolute inset-x-[5%] top-1/2 h-px bg-border" />
          {c.brazil.eligible && c.brazil.value != null && <div className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 border-l-2 border-dashed border-[#7b8aa0]" style={{ left: pos(c.brazil.value) }} />}
          {c.state?.eligible && c.state.value != null && <div className="absolute top-1/2 h-5 w-0.5 -translate-y-1/2 bg-[#14304f]" style={{ left: pos(c.state.value) }} />}
          {c.own.eligible && c.own.value != null && <div className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#115b45] shadow" style={{ left: pos(c.own.value) }} />}
        </div>
      )}
      <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[0.68rem] leading-snug text-muted-foreground">
        <li><span className="inline-block size-2 rounded-full bg-[#115b45]" aria-hidden /> {c.own.label}: {c.own.display}</li>
        {c.state && <li><span className="inline-block h-2 w-0.5 bg-[#14304f]" aria-hidden /> {c.state.label}: {c.state.eligible ? c.state.display : 'não aplicável'}</li>}
        <li><span className="inline-block h-2 w-0.5 border-l-2 border-dashed border-[#7b8aa0]" aria-hidden /> Brasil: {c.brazil.eligible ? c.brazil.display : 'não aplicável'}</li>
      </ul>
      {((c.state && !c.state.eligible) || !c.brazil.eligible) && <p className="mt-1 text-[0.65rem] text-muted-foreground">{c.state && !c.state.eligible && c.state.reason}{c.state && !c.state.eligible && !c.brazil.eligible && ' · '}{!c.brazil.eligible && c.brazil.reason}</p>}
      {c.restrictions.length > 0 && <p className="mt-1.5 text-[0.65rem] leading-snug text-muted-foreground">{c.restrictions.join(' ')}</p>}
    </div>
  );
}
