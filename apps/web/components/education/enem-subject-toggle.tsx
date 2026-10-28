'use client';

import { useState } from 'react';
import type { EnemSubjectTab } from '@/lib/education/types';
import { BarList } from './education-ui';
import { cn } from '@/lib/utils';

/** Alterna entre as 5 áreas do Enem; tudo já vem calculado do servidor, só troca a vista. */
export function EnemSubjectToggle({ tabs }: { tabs: EnemSubjectTab[] }) {
  const [sel, setSel] = useState(tabs[0]?.id ?? '');
  const cur = tabs.find(t => t.id === sel) ?? tabs[0];
  if (!cur) return null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Escolha a área">
        {tabs.map(t => { const on = t.id === sel; return <button key={t.id} type="button" role="radio" aria-checked={on} onClick={() => setSel(t.id)}
          className={cn('focus-ring min-h-9 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors', on ? 'border-[#115b45] bg-[#115b45] text-white' : 'bg-white text-[#14304f] hover:bg-[#e8f3ee]')}>{t.label}</button>; })}
      </div>
      <div aria-live="polite" className="space-y-3">
        <p className="max-w-3xl font-display text-lg leading-snug text-[#14304f] sm:text-xl">{cur.headline}</p>
        {cur.byNetwork.length > 0 && <BarList title={`Nota média por rede — ${cur.label}`} rows={cur.byNetwork} caption="Rede com menos de 10 participantes não é mostrada." />}
      </div>
    </div>
  );
}
