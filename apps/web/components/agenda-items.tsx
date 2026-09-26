'use client';
import Link from 'next/link';
import { useState } from 'react';

export function AgendaItems({ items, source }: { items: any[]; source: string }) {
  const [expanded, setExpanded] = useState(items.length <= 3);
  const visible = expanded ? items : items.slice(0, 3);
  return <div className="mt-3">
    <ol className="space-y-3">
      {visible.map((item: any, index: number) => {
        const label = item.proposal_label || item.title || `Item ${index + 1}`;
        const summary = item.proposal_summary || item.description;
        return <li key={item.id} className="border-l-2 border-primary/20 pl-3 pb-3">
          <Link className="font-bold text-primary hover:underline" href={item.proposal_id ? `/legislativo/proposicoes/${item.proposal_source || source}/${item.proposal_id}` : '#'}>{label}</Link>
          {summary && summary !== label && <p className="line-clamp-2 text-sm text-muted-foreground">{summary}</p>}
          {item.result_raw && <details className="mt-2 border-t border-border/50 pt-2 text-xs text-muted-foreground"><summary className="cursor-pointer list-none">Situação publicada · <span className="font-normal">{item.result_raw}</span></summary><p className="mt-1 max-w-3xl leading-5">{item.result_raw}</p></details>}
        </li>;
      })}
    </ol>
    {items.length > 3 && <button type="button" className="mt-3 text-sm font-bold text-primary hover:underline" onClick={() => setExpanded((value) => !value)}>{expanded ? 'Recolher pauta' : `Ver mais ${items.length - 3} itens`}</button>}
  </div>;
}
