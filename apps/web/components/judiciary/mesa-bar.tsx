import Link from 'next/link';
import { Scale, X } from 'lucide-react';

export interface MesaBarItem { tribunalId: string; sigla: string; hrefRemove: string }

/** P14.45 — "Mesa compacta" (mandato §11.2): discreta durante a Distribuição — contagem, siglas,
 * remoção individual, acesso à Mesa expandida quando elegível (≥2). Único dono do resumo agregado da
 * seleção (o painel contextual só trata do tribunal inspecionado, nunca duplica esta contagem).
 * Ajuste visual (mock do usuário): a faixa fica sempre visível, mesmo vazia — vira um convite
 * permanente ("Inspecione um tribunal e adicione..."), não um elemento que só aparece depois de uma
 * ação. */
export function MesaBar({ items, hrefOpenMesa, max = 3 }: { items: MesaBarItem[]; hrefOpenMesa: string; max?: number }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-primary/5 px-4 py-3">
      <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-bold"><Scale size={15} className="text-primary" aria-hidden /> Mesa de investigação <span className="font-normal text-muted-foreground">({items.length}/{max})</span></span>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Inspecione um tribunal e adicione à Mesa para analisar lado a lado.</p>
      ) : (
        <>
          <ul className="flex flex-wrap items-center gap-1.5">
            {items.map(it => (
              <li key={it.tribunalId} className="inline-flex items-center gap-1 rounded-full bg-card py-1 pl-3 pr-1 text-xs font-bold shadow-sm">
                {it.sigla}
                <Link replace scroll={false} href={it.hrefRemove} aria-label={`Remover ${it.sigla} da mesa`} className="focus-ring grid size-5 place-items-center rounded-full hover:bg-secondary"><X size={12} /></Link>
              </li>
            ))}
          </ul>
          {items.length >= 2 ? (
            <Link href={hrefOpenMesa} className="ml-auto shrink-0 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90">Comparar na Mesa</Link>
          ) : (
            <span className="ml-auto text-xs font-semibold text-muted-foreground">Adicione mais {2 - items.length} para comparar</span>
          )}
        </>
      )}
    </div>
  );
}
