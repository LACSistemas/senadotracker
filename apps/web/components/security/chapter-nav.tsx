'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export interface NavItem { id: string; label: string; available: boolean }
/** Navegação contextual: pílulas fixas no topo ao rolar; destaca o capítulo visível e permite pular direto (teclado e toque). */
export function ChapterNav({ items }: { items: NavItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? '');
  useEffect(() => {
    const els = items.map(i => document.getElementById(i.id)).filter((e): e is HTMLElement => !!e); if (!els.length || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(entries => { const vis = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]; if (vis) setActive(vis.target.id); }, { rootMargin: '-20% 0px -65% 0px', threshold: 0 });
    els.forEach(e => io.observe(e)); return () => io.disconnect();
  }, [items]);
  return (
    <nav aria-label="Capítulos desta página" className="sticky top-0 z-20 -mx-1 bg-background/90 px-1 py-2 backdrop-blur">
      <ol className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {items.map((i, n) => <li key={i.id} className="shrink-0"><a href={`#${i.id}`} aria-current={active === i.id ? 'true' : undefined} className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors', active === i.id ? 'border-[#115b45] bg-[#115b45] text-white' : 'bg-white hover:border-[#115b45]/50', !i.available && active !== i.id && 'text-muted-foreground')}><span className="tnum opacity-70">{n + 1}</span>{i.label}</a></li>)}
      </ol>
    </nav>
  );
}
