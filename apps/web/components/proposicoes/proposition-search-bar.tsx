'use client';
import { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { GROUPS } from '@/lib/proposicoes/taxonomy';

const EXPLORE = '/legislativo/proposicoes/explorar';

/**
 * Barra de busca compacta, de uma linha, para quem chega procurando uma proposição específica. É um formulário GET
 * simples (funciona sem JavaScript) que leva ao explorador com os filtros mínimos: texto, Casa e função.
 * O atalho "/" foca o campo, como em buscadores.
 */
export function PropositionSearchBar() {
  const input = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      event.preventDefault(); input.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const select = 'focus-ring h-full cursor-pointer appearance-none bg-transparent px-3 text-sm font-semibold text-foreground outline-none';
  return <div className="border-b bg-background">
    <form role="search" action={EXPLORE} method="get" aria-label="Buscar uma proposição" className="page-shell py-3">
      <div className="flex h-12 items-center rounded-full border bg-card pl-4 pr-1.5 shadow-sm transition-shadow focus-within:border-primary/50 focus-within:shadow-[0_0_0_3px_rgba(17,91,69,.14)]">
        <Search size={17} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        <label className="min-w-0 flex-1"><span className="sr-only">Buscar por número, ementa, tema ou autor</span>
          <input ref={input} name="q" type="search" autoComplete="off" placeholder="Buscar uma proposição: PL 179/2026, saúde, nome de parlamentar…" className="h-12 w-full min-w-0 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden" /></label>
        <kbd aria-hidden="true" className="mr-2 hidden rounded-md border bg-background px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground lg:block">/</kbd>
        <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden="true" />
        <label className="hidden h-full sm:block"><span className="sr-only">Casa</span>
          <select name="casa" defaultValue="" className={select}><option value="">Câmara e Senado</option><option value="camara">Câmara</option><option value="senado">Senado</option></select></label>
        <span className="mx-1 hidden h-6 w-px bg-border lg:block" aria-hidden="true" />
        <label className="hidden h-full lg:block"><span className="sr-only">Função</span>
          <select name="grupo" defaultValue="" className={`${select} max-w-[13rem] truncate`}><option value="">Todas as funções</option>{GROUPS.map(group => <option key={group.key} value={group.key}>{group.verb}</option>)}</select></label>
        <button type="submit" className="focus-ring ml-1 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90">Buscar</button>
      </div>
    </form>
  </div>;
}
