import type { PrisonChapter } from '@/lib/security/types';
import { fmt } from '@/lib/security/format';
import { TrendChart } from './trend-chart';
import { EmptyNote } from './security-ui';
import { cn } from '@/lib/utils';

export function PrisonChapterBody({ ch, name }: { ch: PrisonChapter; name: string }) {
  const isMuni = ch.scopeKind === 'municipio'; const maxReg = Math.max(...ch.regimes.flatMap(r => [r.population ?? 0, r.capacity ?? 0]), 1);
  return (
    <>
      {isMuni && ch.units.length === 0 && <div className={cn('rounded-2xl border p-4 text-sm leading-6', 'border-dashed bg-white/60')}><p className="font-semibold text-[#14304f]">Nenhum estabelecimento identificado nesta base</p><p className="mt-1 text-muted-foreground">{ch.observed}</p></div>}
      {ch.units.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2">{ch.units.map(u => <li key={u.name} className="rounded-2xl border bg-white p-4"><p className="text-sm font-semibold leading-snug text-[#14304f]">{u.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{u.ambito} · {u.tipo} · {u.cycles} ciclos observados · último: {u.ref}</p>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center"><div className="rounded-lg bg-secondary p-2"><dt className="text-[0.65rem] text-muted-foreground">Vagas</dt><dd className="tnum font-bold">{u.capacity == null ? '—' : fmt(u.capacity)}</dd></div><div className="rounded-lg bg-secondary p-2"><dt className="text-[0.65rem] text-muted-foreground">Pessoas</dt><dd className="tnum font-bold">{u.population == null ? '—' : fmt(u.population)}</dd></div><div className="rounded-lg bg-secondary p-2"><dt className="text-[0.65rem] text-muted-foreground">Ocupação</dt><dd className="tnum font-bold">{u.occupancyPct == null ? '—' : `${fmt(u.occupancyPct, 0)}%`}</dd></div></dl>
          {u.pendingIdentity > 0 && <p className="mt-2 text-[0.7rem] text-[#7a4606]">Há {u.pendingIdentity} correspondência(s) histórica(s) pendente(s) de revisão para esta unidade.</p>}</li>)}</ul>
      )}
      {ch.capacityVsPopulation && <div className="rounded-2xl border bg-white p-3 sm:p-5"><h3 className="font-display text-xl text-[#14304f]">{isMuni ? `Vagas e pessoas nas unidades de ${name}` : 'Vagas e pessoas em celas físicas'}</h3><TrendChart chart={ch.capacityVsPopulation} title={false} /></div>}
      {ch.occupancy && <div className="rounded-2xl border bg-white p-3 sm:p-5"><h3 className="font-display text-xl text-[#14304f]">Ocupação das celas</h3><TrendChart chart={ch.occupancy} title={false} /></div>}
      {ch.regimes.length > 0 && (
        <div className="rounded-2xl border bg-white p-4 sm:p-5"><h3 className="font-display text-xl text-[#14304f]">Quem está nas celas, por regime{ch.regimesRef ? ` (${ch.regimesRef})` : ''}</h3>
          <ul className="mt-3 space-y-3">{ch.regimes.map(r => <li key={r.label} className="text-xs"><p className="font-semibold">{r.label}</p>
            <div className="mt-1 space-y-1"><div className="flex items-center gap-2"><span className="w-14 shrink-0 text-muted-foreground">Pessoas</span><div className="h-2.5 flex-1 rounded-full bg-secondary"><div className="h-2.5 rounded-full bg-[#115b45]" style={{ width: `${((r.population ?? 0) / maxReg) * 100}%` }} /></div><span className="tnum w-14 text-right font-semibold">{r.population == null ? '—' : fmt(r.population)}</span></div>
              <div className="flex items-center gap-2"><span className="w-14 shrink-0 text-muted-foreground">Vagas</span><div className="h-2.5 flex-1 rounded-full bg-secondary"><div className="h-2.5 rounded-full bg-[#14304f]/40" style={{ width: `${((r.capacity ?? 0) / maxReg) * 100}%` }} /></div><span className="tnum w-14 text-right font-semibold">{r.capacity == null ? '—' : fmt(r.capacity)}</span></div></div></li>)}</ul>
          <p className="mt-3 text-[0.7rem] leading-snug text-muted-foreground">Os regimes são classificações que se somam ao total apenas dentro do mesmo conceito; não somamos total e componentes. Vagas por regime podem não existir em todas as unidades.</p></div>
      )}
      {isMuni && ch.stateContext?.occupancy && <div className="rounded-2xl border border-dashed bg-[#faf9f5] p-3 sm:p-5"><p className="eyebrow">Contexto do estado</p><h3 className="font-display text-xl text-[#14304f]">{ch.stateContext.label}</h3><TrendChart chart={ch.stateContext.occupancy} title={false} compact /></div>}
      {ch.domiciliary && <p className="rounded-xl border bg-white p-3 text-sm text-muted-foreground"><strong className="text-[#14304f]">Fora da ocupação física: </strong>{ch.domiciliary.label}: {fmt(ch.domiciliary.value ?? 0)}.</p>}
      {!ch.available && <EmptyNote title="Sem dados prisionais">{ch.emptyReason}</EmptyNote>}
    </>
  );
}
