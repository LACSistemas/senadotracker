'use client';
import { useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Mesma interação de `ComparisonMultiSelect` (busca + chips + toggle), mas para tribunais: a lista existente
 * só sabe renderizar partido/estado (logo de partido ou sigla de UF em círculo), e um `tribunal_id` como
 * "JUD:TRIBUNAL:TJES" não é nenhum dos dois — por isso este componente próprio, com {value, sigla, name}. */
export interface TribunalOption { value: string; sigla: string; name: string }
export function TribunalMultiSelect({ name, label, options, initialValues, max = 10 }: { name: string; label: string; options: TribunalOption[]; initialValues: string[]; max?: number }) {
  const byValue = useMemo(() => new Map(options.map(o => [o.value, o])), [options]);
  const [selected, setSelected] = useState(() => initialValues.filter(v => byValue.has(v)).slice(0, max));
  const [search, setSearch] = useState('');
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const filtered = useMemo(() => { const term = norm(search.trim()); return options.filter(o => !term || norm(o.sigla).includes(term) || norm(o.name).includes(term)); }, [search, options]);
  const toggle = (value: string) => setSelected(cur => cur.includes(value) ? cur.filter(v => v !== value) : cur.length < max ? [...cur, value] : cur);
  return (
    <fieldset className="lg:col-span-3">
      <legend className="text-sm font-bold">{label}</legend>
      {selected.map(v => <input key={v} type="hidden" name={name} value={v} />)}
      <div className="mt-2 rounded-2xl border bg-background p-4">
        <div className="flex min-h-11 flex-wrap items-center gap-2">
          {selected.length ? selected.map(v => (
            <span key={v} className="inline-flex items-center gap-2 rounded-full border bg-secondary py-1.5 pl-3 pr-1.5 text-sm font-bold">{byValue.get(v)?.sigla ?? v}<button type="button" onClick={() => toggle(v)} className="focus-ring grid size-7 place-items-center rounded-full hover:bg-background" aria-label={`Remover ${byValue.get(v)?.sigla ?? v}`}><X size={14} /></button></span>
          )) : <span className="text-sm text-muted-foreground">Selecione pelo menos dois tribunais.</span>}
        </div>
        <div className="relative mt-4"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 text-muted-foreground" size={17} /><Input value={search} onChange={e => setSearch(e.target.value)} className="pl-10" placeholder="Buscar tribunal por sigla ou nome…" aria-label={`Buscar em ${label.toLowerCase()}`} /></div>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground"><span>{selected.length} selecionado{selected.length === 1 ? '' : 's'}</span><span>Máximo de {max}</span></div>
        <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(o => { const active = selected.includes(o.value); const disabled = !active && selected.length >= max; return (
            <button key={o.value} type="button" aria-pressed={active} disabled={disabled} onClick={() => toggle(o.value)} className={cn('focus-ring flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors', active ? 'border-primary bg-primary/10 font-bold' : 'hover:bg-muted', disabled && 'cursor-not-allowed opacity-40')}>
              <span className="min-w-0 flex-1"><span className="block font-bold">{o.sigla}</span><span className="block truncate text-xs text-muted-foreground">{o.name}</span></span>{active && <Check className="shrink-0 text-primary" size={17} />}
            </button>
          ); })}
          {!filtered.length && <p className="col-span-full py-6 text-center text-sm text-muted-foreground">Nenhum tribunal encontrado.</p>}
        </div>
      </div>
    </fieldset>
  );
}
