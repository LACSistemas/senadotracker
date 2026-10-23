import type { Ruler } from '@/lib/security/types';
import { fmt } from '@/lib/security/format';

/**
 * Régua de comparação: a faixa azul é a faixa central (1º a 3º quartil) do grupo comparável, o traço escuro é a mediana e o ponto verde é o território.
 * Mostra posição relativa, nunca ranking; a legenda diz exatamente qual é o grupo.
 */
export function BenchRuler({ r, who }: { r: Ruler; who: string }) {
  const max = Math.max(r.own, r.p75) * 1.2 || 1; const pos = (v: number) => `${Math.min(99, Math.max(1, (v / max) * 100))}%`; const f = (v: number) => `${r.prefix ?? ''}${fmt(v, r.digits)}`;
  const side = r.own < r.p25 ? 'abaixo da faixa central' : r.own > r.p75 ? 'acima da faixa central' : 'dentro da faixa central';
  return (
    <div className="rounded-xl border bg-white/80 p-3">
      <p className="text-[0.7rem] font-semibold text-[#14304f]">{who} em {r.year}: {f(r.own)} {r.unit} — {side}</p>
      <div className="relative mt-3 h-6" role="img" aria-label={`${who}: ${f(r.own)}. Mediana do grupo ${f(r.p50)}; faixa central de ${f(r.p25)} a ${f(r.p75)}; ${side}.`}>
        <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
        <div className="absolute top-1/2 h-3 -translate-y-1/2 rounded-sm bg-[#14304f]/15" style={{ left: pos(r.p25), width: `calc(${pos(r.p75)} - ${pos(r.p25)})` }} />
        <div className="absolute top-1/2 h-5 w-0.5 -translate-y-1/2 bg-[#14304f]" style={{ left: pos(r.p50) }} />
        <div className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#115b45] shadow" style={{ left: pos(r.own) }} />
      </div>
      <p className="mt-1.5 text-[0.68rem] leading-snug text-muted-foreground">Mediana {f(r.p50)} · faixa central {f(r.p25)}–{f(r.p75)}. Grupo: {fmt(r.n)} {r.cohort}.</p>
    </div>
  );
}
