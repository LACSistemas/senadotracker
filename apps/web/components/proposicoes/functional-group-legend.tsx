'use client';
import { nf, pf, typeName } from '@/lib/proposicoes/taxonomy';
import type { CompositionEntry } from '@/lib/proposicoes/composition';

function TypeList({ entry }: { entry: CompositionEntry }) {
  if (!entry.topTypes.length) return <p className="mt-2 text-xs text-muted-foreground">Sem siglas publicadas para este grupo.</p>;
  return <ul className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">{entry.topTypes.map(type => <li key={type.type} className="flex items-baseline justify-between gap-3 text-sm">
    <span className="min-w-0"><b className="font-bold">{type.type}</b> <span className="text-muted-foreground">{typeName(type.type) ?? 'sigla publicada'}</span></span>
    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{nf.format(type.count)} · {pf.format(type.share)}</span>
  </li>)}</ul>;
}

/** Painel que explica o grupo em palavras e revela as siglas mais frequentes dentro dele. */
export function GroupDetail({ entry }: { entry: CompositionEntry }) {
  return <div className="prop-fade-in mt-4 rounded-2xl border bg-card p-5" style={{ borderLeft: `4px solid ${entry.color}` }}>
    <p className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">{entry.children ? 'O que esta faixa reúne' : 'Siglas neste grupo'}</p>
    <h4 className="mt-1 text-lg font-bold">{entry.label}</h4>
    <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{entry.description}</p>
    {entry.children
      ? <div className="mt-4 space-y-4">{entry.children.map(child => <div key={child.key} className="border-t pt-3 first:border-0 first:pt-0">
        <p className="flex items-baseline justify-between gap-3 text-sm font-semibold"><span>{child.verb} <span className="font-normal text-muted-foreground">· {child.label}</span></span><span className="text-xs font-normal tabular-nums text-muted-foreground">{nf.format(child.count)} · {pf.format(child.share)} do total</span></p>
        <TypeList entry={child} />
      </div>)}</div>
      : <TypeList entry={entry} />}
  </div>;
}

/** Legenda sempre presente (identidade nunca só por cor), clicável: selecionar um grupo isola o segmento e mostra as siglas. */
export function FunctionalGroupLegend({ entries, selectedKey, onSelect, compact = false }: { entries: CompositionEntry[]; selectedKey: string | null; onSelect: (key: string | null) => void; compact?: boolean }) {
  const selected = entries.find(entry => entry.key === selectedKey) ?? null;
  return <div>
    <ul className={`grid gap-x-8 gap-y-0.5 ${compact ? '' : 'sm:grid-cols-2'}`}>
      {entries.map(entry => <li key={entry.key}>
        <button type="button" aria-pressed={selectedKey === entry.key} onClick={() => onSelect(selectedKey === entry.key ? null : entry.key)}
          className={`focus-ring flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-muted/70 ${selectedKey === entry.key ? 'bg-muted' : ''}`}>
          <i className="size-3 shrink-0 rounded-sm" style={{ background: entry.color }} aria-hidden="true" />
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold leading-tight">{entry.verb}</span><span className="block text-xs leading-tight text-muted-foreground">{entry.label}</span></span>
          <span className="shrink-0 text-right"><strong className="block text-sm tabular-nums">{pf.format(entry.share)}</strong><span className="block text-xs tabular-nums text-muted-foreground">{nf.format(entry.count)}</span></span>
        </button>
      </li>)}
    </ul>
    {selected ? <GroupDetail entry={selected} /> : <p className="mt-3 px-2.5 text-xs text-muted-foreground">Clique em um grupo para ver as siglas que ele reúne.</p>}
  </div>;
}
