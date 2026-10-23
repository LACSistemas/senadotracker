'use client';
import { useId, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { GLOSSARIO, type TermoChave } from '@/lib/glossario';
import { cn } from '@/lib/utils';

// Rótulo simples + botão "o que isso quer dizer?" que abre a definição precisa (toque, foco ou Esc para fechar).
export function TermoExplicado({chave,label,className}:{chave:TermoChave;label?:string|undefined;className?:string|undefined}){
  const t=GLOSSARIO[chave],id=useId(),[open,setOpen]=useState(false);
  return <span className={cn('inline-flex flex-wrap items-center gap-1',className)}>
    <span>{label??t.curto}</span>
    <button type="button" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(value=>!value)} onKeyDown={event=>{if(event.key==='Escape')setOpen(false)}} className="focus-ring inline-grid size-6 place-items-center rounded-full text-muted-foreground hover:text-primary">
      <CircleHelp size={15} aria-hidden="true"/><span className="sr-only">O que significa “{t.termo}”?</span>
    </button>
    <span id={id} role="note" hidden={!open} className="mt-1 block w-full rounded-xl border bg-secondary/50 p-3 text-xs font-normal leading-5 text-secondary-foreground">
      <strong className="block">{t.termo}</strong>{t.explicacao}{t.nota&&<span className="mt-1 block text-muted-foreground">{t.nota}</span>}
    </span>
  </span>;
}
