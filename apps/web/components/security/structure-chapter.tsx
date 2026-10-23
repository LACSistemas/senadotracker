import { Building2, Landmark, ShieldCheck } from 'lucide-react';
import type { InstitutionCard, ScopeInfo, StructureChapter } from '@/lib/security/types';
import { fmt } from '@/lib/security/format';
import { EmptyNote } from './security-ui';
import { cn } from '@/lib/utils';

function Token({ card }: { card: InstitutionCard }) {
  const yes = card.value != null && card.value > 0, no = card.value === 0;
  if (card.key === 'delegacia') return <span className={cn('rounded-full px-3 py-1 text-sm font-bold', yes ? 'bg-[#e2f5e8] text-[#0f5a37]' : no ? 'bg-[#eef1f5] text-[#4a5a70]' : 'bg-[#f6f0e3] text-[#7a4606]')}>{yes ? 'Existe' : no ? 'Não declarada' : 'Sem resposta'}</span>;
  return <span className="tnum hero-figure text-3xl text-[#14304f]">{card.value == null ? '—' : card.value === 0 ? 'Não tem' : fmt(card.value)}</span>;
}

function MunicipalCards({ cards, name }: { cards: InstitutionCard[]; name: string }) {
  return (
    <div>
      <p className="eyebrow flex items-center gap-1.5"><Building2 size={14} aria-hidden />Na cidade — declarado pela prefeitura</p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">{cards.map(c => <li key={c.key} className="rounded-2xl border bg-white p-4"><p className="text-sm font-semibold text-[#14304f]">{c.label}</p><div className="mt-2 flex items-baseline gap-2"><Token card={c} /><span className="text-xs text-muted-foreground">{c.unit}</span></div><p className="mt-2 text-xs text-muted-foreground">{c.basis} · {c.source}</p>{c.note && <p className="mt-1 text-[0.7rem] leading-snug text-muted-foreground">{c.note}</p>}</li>)}</ul>
      {cards.length === 0 && <EmptyNote title={`Sem declaração de ${name}`}>A pesquisa MUNIC do IBGE não traz resposta de {name} sobre guarda ou delegacia nas edições coletadas.</EmptyNote>}
    </div>
  );
}

/** Previsto × existente: duas barras com a mesma escala; a ocupação mede o preenchimento de cargos, não a cobertura do policiamento. */
function PlannedBars({ rows, where }: { rows: StructureChapter['plannedVsExisting']; where: string }) {
  if (!rows.length) return null; const max = Math.max(...rows.map(r => Math.max(r.planned ?? 0, r.existing ?? 0)), 1);
  return (
    <div className="rounded-2xl border bg-white p-4 sm:p-5"><p className="text-sm font-semibold text-[#14304f]">Efetivo existente × quadro previsto — estado de {where}</p>
      <ul className="mt-3 space-y-4">{rows.map(r => <li key={r.corporation}>
        <div className="flex flex-wrap items-baseline justify-between gap-2"><span className="text-sm font-semibold">{r.corporation}</span><span className="text-xs text-muted-foreground">{r.occupancyPct != null ? `${fmt(r.occupancyPct, 0)}% do quadro previsto preenchido` : ''}</span></div>
        <div className="mt-1.5 space-y-1" role="img" aria-label={`${r.corporation}: ${fmt(r.existing ?? 0)} existentes de ${fmt(r.planned ?? 0)} previstos`}>
          <div className="flex items-center gap-2"><span className="w-16 shrink-0 text-[0.68rem] text-muted-foreground">Existente</span><div className="h-3 flex-1 rounded-full bg-secondary"><div className="h-3 rounded-full bg-[#115b45]" style={{ width: `${((r.existing ?? 0) / max) * 100}%` }} /></div><span className="tnum w-14 text-right text-xs font-semibold">{fmt(r.existing ?? 0)}</span></div>
          <div className="flex items-center gap-2"><span className="w-16 shrink-0 text-[0.68rem] text-muted-foreground">Previsto</span><div className="h-3 flex-1 rounded-full bg-secondary"><div className="h-3 rounded-full bg-[#14304f]/40" style={{ width: `${((r.planned ?? 0) / max) * 100}%` }} /></div><span className="tnum w-14 text-right text-xs font-semibold">{fmt(r.planned ?? 0)}</span></div>
        </div></li>)}</ul>
      <p className="mt-3 text-[0.7rem] leading-snug text-muted-foreground">Quadro previsto é o número de cargos criados em lei, não uma meta de policiamento nem a necessidade estimada. {rows[0]?.basis}.</p></div>
  );
}

export function StructureChapterBody({ ch, scope }: { ch: StructureChapter; scope: ScopeInfo }) {
  const isMuni = scope.kind === 'municipio'; const estado = ch.state.filter(c => c.scope === 'estado'); const nacional = ch.state.filter(c => c.scope === 'nacional');
  return (
    <>
      {isMuni && <MunicipalCards cards={ch.municipal} name={scope.name} />}
      {estado.length > 0 && (
        <div>
          <p className="eyebrow flex items-center gap-1.5"><Landmark size={14} aria-hidden />{isMuni ? `No estado de ${scope.stateName} — contexto, não é o efetivo da cidade` : `Em ${scope.stateName} — efetivo declarado`}</p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{estado.map(c => <li key={c.key} className={cn('rounded-2xl border p-4', isMuni ? 'border-dashed bg-[#faf9f5]' : 'bg-white')}>
            <p className="text-sm font-semibold text-[#14304f]">{c.label}</p><p className="hero-figure tnum mt-1 text-3xl text-[#14304f]">{c.value == null ? '—' : fmt(c.value)}</p><p className="text-xs text-muted-foreground">{c.unit}</p>
            {isMuni && <p className="mt-2 inline-block rounded-full bg-secondary px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-[#14304f]">Estado inteiro</p>}
            <p className="mt-2 text-[0.7rem] text-muted-foreground">{c.basis}</p></li>)}</ul>
          {isMuni && <p className="mt-2 text-xs text-muted-foreground">Total da UF inteira: não é o efetivo lotado em {scope.name} e não foi dividido por população ou território.</p>}
        </div>
      )}
      <PlannedBars rows={ch.plannedVsExisting} where={scope.stateName} />
      {nacional.length > 0 && <div><p className="eyebrow flex items-center gap-1.5"><ShieldCheck size={14} aria-hidden />Forças federais — Brasil inteiro</p><ul className="mt-3 grid gap-3 sm:grid-cols-2">{nacional.map(c => <li key={c.key} className="rounded-2xl border bg-white p-4"><p className="text-sm font-semibold text-[#14304f]">{c.label}</p><p className="hero-figure tnum mt-1 text-3xl text-[#14304f]">{c.value == null ? '—' : fmt(c.value)}</p><p className="text-xs text-muted-foreground">{c.unit} · {c.basis}</p><p className="mt-1 text-[0.7rem] text-muted-foreground">{c.note}</p></li>)}</ul></div>}
      {ch.editions.length > 0 && <details className="rounded-xl border bg-white p-4 text-sm"><summary className="cursor-pointer py-1.5 font-semibold text-[#14304f]">Pesquisas do IBGE sobre a estrutura local ({ch.editions.length} edições)</summary>
        <div className="mt-3 grid gap-4 md:grid-cols-2">{ch.editions.map(e => <div key={e.label}><p className="font-semibold">{e.label}</p><dl className="mt-1 divide-y text-xs">{e.items.map(i => <div key={i.label} className="flex justify-between gap-3 py-1"><dt className="text-muted-foreground">{i.label}</dt><dd className="text-right font-medium">{i.value}</dd></div>)}</dl></div>)}</div>
        <p className="mt-2 text-[0.7rem] text-muted-foreground">Duas edições são dois retratos (2019 e 2023): a diferença não é variação anual e não prova mudança de funcionamento.</p></details>}
      <div className="rounded-2xl border border-dashed bg-white/60 p-4"><p className="font-display text-lg text-[#14304f]">E o Detran?</p><p className="mt-1 max-w-prose text-sm leading-6 text-muted-foreground">{ch.detran.statement}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">{ch.detran.items.map(i => <li key={i}>{i}</li>)}</ul></div>
    </>
  );
}
