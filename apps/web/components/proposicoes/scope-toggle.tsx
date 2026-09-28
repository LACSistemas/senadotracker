'use client';
import { createContext, useCallback, useContext, useMemo, useRef, useState, useTransition, type KeyboardEvent, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SCOPE_LABEL, formatDate, type ScopeKey } from '@/lib/proposicoes/taxonomy';

interface ScopeState { scope: ScopeKey; setScope: (scope: ScopeKey) => void; year: number; comparable: boolean; pending: boolean }
const ScopeContext = createContext<ScopeState | null>(null);

/** Casa escolhida (Congresso, Câmara ou Senado). Vale para a página inteira e é espelhada em `?casa=` sem recarregar. */
export function useScope(): ScopeState {
  const value = useContext(ScopeContext);
  if (!value) throw new Error('useScope precisa estar dentro de <ScopeProvider>');
  return value;
}

/** As Casas exibidas para o escopo: Congresso só vira um painel único quando os universos são comparáveis. */
export function housesFor(scope: ScopeKey, comparable: boolean): Array<'congresso' | 'camara' | 'senado'> {
  if (scope === 'congresso') return comparable ? ['congresso'] : ['camara', 'senado'];
  return [scope];
}

export function ScopeProvider({ initialScope, year, comparable, years, updatedThrough, children }: {
  initialScope: ScopeKey; year: number; comparable: boolean; years: number[]; updatedThrough: string | null; children: ReactNode;
}) {
  const router = useRouter(), pathname = usePathname();
  const [scope, setScopeState] = useState<ScopeKey>(initialScope);
  const [pending, startTransition] = useTransition();
  const setScope = useCallback((next: ScopeKey) => {
    setScopeState(next);
    const url = new URL(window.location.href);
    if (next === 'congresso') url.searchParams.delete('casa'); else url.searchParams.set('casa', next);
    window.history.replaceState(null, '', url);
  }, []);
  const changeYear = (next: number) => startTransition(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('ano', String(next));
    router.push(`${pathname}?${params}`, { scroll: false });
  });
  const value = useMemo(() => ({ scope, setScope, year, comparable, pending }), [scope, setScope, year, comparable, pending]);
  return <ScopeContext.Provider value={value}>
    <FilterBar scope={scope} setScope={setScope} year={year} years={years} onYear={changeYear} updatedThrough={updatedThrough} pending={pending} />
    <div aria-busy={pending} className={`transition-opacity duration-300 ${pending ? 'pointer-events-none opacity-55' : 'opacity-100'}`}>{children}</div>
  </ScopeContext.Provider>;
}

const OPTIONS: ScopeKey[] = ['congresso', 'camara', 'senado'];

/** Segmented control acessível (radiogroup com tabindex móvel e setas). */
export function HouseScopeToggle({ scope, onChange }: { scope: ScopeKey; onChange: (scope: ScopeKey) => void }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const move = (event: KeyboardEvent, index: number) => {
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + OPTIONS.length) % OPTIONS.length;
    onChange(OPTIONS[next]!); refs.current[next]?.focus();
  };
  return <div role="radiogroup" aria-label="Casa" className="inline-flex rounded-full border bg-card p-1 shadow-sm">
    {OPTIONS.map((option, index) => {
      const active = option === scope;
      return <button key={option} ref={node => { refs.current[index] = node; }} type="button" role="radio" aria-checked={active} tabIndex={active ? 0 : -1} onClick={() => onChange(option)} onKeyDown={event => move(event, index)}
        className={`focus-ring rounded-full px-3 py-1.5 text-sm font-bold transition-colors sm:px-4 ${active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{SCOPE_LABEL[option]}</button>;
    })}
  </div>;
}

function FilterBar({ scope, setScope, year, years, onYear, updatedThrough, pending }: { scope: ScopeKey; setScope: (scope: ScopeKey) => void; year: number; years: number[]; onYear: (year: number) => void; updatedThrough: string | null; pending: boolean }) {
  return <div className="sticky top-[4.5rem] z-30 border-b bg-background/90 backdrop-blur">
    <div className="page-shell flex items-center justify-between gap-x-6 gap-y-2 py-2">
      <div className="flex items-center gap-2 sm:gap-3">
        <HouseScopeToggle scope={scope} onChange={setScope} />
        <label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <span className="sr-only sm:not-sr-only">Ano</span>
          <select value={year} disabled={pending} onChange={event => onYear(Number(event.target.value))} className="focus-ring rounded-full border bg-card px-3 py-1.5 text-sm font-bold text-foreground">
            {years.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      </div>
      <p className="hidden text-xs text-muted-foreground sm:block">{pending ? 'Atualizando…' : updatedThrough ? `Dados publicados até ${formatDate(updatedThrough)}` : 'Data de atualização não publicada'}</p>
    </div>
  </div>;
}
