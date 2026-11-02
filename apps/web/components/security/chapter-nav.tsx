'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MapRampName } from '@/lib/scale';

export interface NavItem { id: string; label: string; available: boolean }

/** Cor de assinatura por tema (P6.2): mesma família de rampa já validada (skill `dataviz`) e já usada
 * no Atlas Vivo (P3) para os indicadores de cada domínio — `teal` é a rampa institucional (= `--primary`),
 * usada como padrão para não mudar nada em quem ainda não passa `accent`. */
/** `blue`/`amber`/`cyan` usam o degrau -5 (mais escuro), não -4: aqui a cor pinta texto real (link ativo
 * da navegação, inclusive branco sobre o preenchimento no modo pílula) — o -4 dessas 3 famílias mede
 * abaixo de 4.5:1 de contraste (confirmado por cálculo WCAG real). `rose`/`violet` já passam no -4 (os
 * únicos degraus usados também como decoração em `ChapterShell`, que não tem esse requisito de texto). */
const ACCENT_VAR: Record<MapRampName, string> = {
  teal: 'var(--primary)', blue: 'var(--map-blue-5)', amber: 'var(--map-amber-5)',
  rose: 'var(--map-rose-4)', violet: 'var(--map-violet-4)', cyan: 'var(--map-cyan-5)',
};

function useActiveChapter(items: NavItem[]): string {
  const [active, setActive] = useState(items[0]?.id ?? '');
  useEffect(() => {
    const els = items.map(i => document.getElementById(i.id)).filter((e): e is HTMLElement => !!e); if (!els.length || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(entries => { const vis = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]; if (vis) setActive(vis.target.id); }, { rootMargin: '-20% 0px -65% 0px', threshold: 0 });
    els.forEach(e => io.observe(e)); return () => io.disconnect();
  }, [items]);
  return active;
}

function pillList(items: NavItem[], active: string, accentVar: string) {
  return (
    <ol className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
      {items.map((i, n) => <li key={i.id} className="shrink-0"><a href={`#${i.id}`} aria-current={active === i.id ? 'true' : undefined} style={active === i.id ? { borderColor: accentVar, backgroundColor: accentVar } : undefined} className={cn('focus-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors', active === i.id ? 'text-white' : 'bg-white hover:border-[#115b45]/50', !i.available && active !== i.id && 'text-muted-foreground')}><span className="tnum">{n + 1}</span>{i.label}</a></li>)}
    </ol>
  );
}

/** P8.7 (mandato §5): seletor compacto "Capítulo atual ▾" para `layout="sidebar"` abaixo de 1024px —
 * substitui a faixa horizontal de pílulas, que exigia rolagem lateral para alcançar capítulos distantes
 * (Educação tem 13 itens). `<details>`/`<summary>` nativo, mesmo padrão já usado pelo menu mobile do
 * header (`app-header.tsx`) — acessível por teclado e leitor de tela sem JS adicional para abrir/fechar;
 * só o fechar-ao-clicar-num-item, fechar-ao-clicar-fora e fechar com Escape precisam de JS (nenhum dos 3
 * é nativo em `<details>`). Não prende o scroll da página (sem `overflow:hidden` no body) e não cria um
 * segundo menu permanente: substitui a faixa de pílulas no lugar dela, nunca convive com ela. */
function MobileChapterSelect({ items, active, accentVar }: { items: NavItem[]; active: string; accentVar: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  const activeItem = items.find(i => i.id === active) ?? items[0];
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); ref.current?.removeAttribute('open'); } };
    const onClickOutside = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); ref.current.removeAttribute('open'); } };
    document.addEventListener('keydown', onKey); document.addEventListener('click', onClickOutside);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('click', onClickOutside); };
  }, [open]);
  return (
    <details ref={ref} className="relative" onToggle={e => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl border bg-card px-4 py-2.5 text-sm font-semibold">
        <span className="min-w-0 truncate"><span className="text-muted-foreground">Capítulo atual: </span>{activeItem?.label}</span>
        <ChevronDown size={16} aria-hidden className={cn('shrink-0 transition-transform', open && 'rotate-180')} />
      </summary>
      <ol onClick={() => { setOpen(false); ref.current?.removeAttribute('open'); }} className="absolute inset-x-0 z-30 mt-1.5 max-h-[60vh] space-y-0.5 overflow-y-auto rounded-xl border bg-card p-1.5 shadow-xl">
        {items.map((i, n) => (
          <li key={i.id}>
            <a href={`#${i.id}`} aria-current={active === i.id ? 'true' : undefined} style={active === i.id ? { color: accentVar } : undefined}
              className={cn('flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold', active === i.id ? 'bg-secondary' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground')}>
              <span className="tnum">{n + 1}</span>{i.label}
            </a>
          </li>
        ))}
      </ol>
    </details>
  );
}

/** Navegação contextual por capítulo. `layout="inline"` (padrão, inalterado): pílulas fixas no topo
    ao rolar, em todas as larguras — é o que as 4 páginas de tema já usam hoje. `layout="sidebar"`
    (P1, Parte IV.8.3 do mandato): no desktop (≥1024px) troca para uma coluna lateral persistente;
    abaixo disso, P8.7 troca a faixa de pílulas pelo seletor `MobileChapterSelect`. */
export function ChapterNav({ items, layout = 'inline', accent }: { items: NavItem[]; layout?: 'inline' | 'sidebar'; accent?: MapRampName }) {
  const active = useActiveChapter(items);
  const accentVar = ACCENT_VAR[accent ?? 'teal'];
  if (layout === 'inline') {
    return <nav aria-label="Capítulos desta página" className="sticky top-0 z-20 -mx-1 bg-background/90 px-1 py-2 backdrop-blur">{pillList(items, active, accentVar)}</nav>;
  }
  return (
    <>
      <nav aria-label="Capítulos desta página" className="sticky top-0 z-20 bg-background/90 py-2 backdrop-blur lg:hidden"><MobileChapterSelect items={items} active={active} accentVar={accentVar} /></nav>
      <nav aria-label="Capítulos desta página" className="sticky top-24 hidden max-h-[calc(100vh-7rem)] overflow-y-auto lg:block">
        <ol className="space-y-1 border-l pl-3">
          {items.map((i, n) => (
            <li key={i.id}>
              {/* P8.7: `opacity-70` somado a `text-muted-foreground` reduzia o contraste do item de capítulo
                  indisponível para 2.88:1 (achado real do axe-core, abaixo do mínimo de 4.5:1) — a versão
                  em pílula (mobile) já usava só `text-muted-foreground`, sem opacidade extra, e nunca teve
                  esse problema; removida a opacidade para igualar o mesmo tratamento, já validado. */}
              <a href={`#${i.id}`} aria-current={active === i.id ? 'true' : undefined} style={active === i.id ? { borderColor: accentVar, color: accentVar } : undefined} className={cn('focus-ring -ml-3 flex items-center gap-2 border-l-2 py-1.5 pl-3 text-sm font-semibold transition-colors', active === i.id ? '' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                <span className="tnum">{n + 1}</span>{i.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
