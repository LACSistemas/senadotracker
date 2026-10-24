'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { OfficialPortrait } from '@/components/app-image';
import { cn } from '@/lib/utils';
import type { SearchHit } from '@/lib/search';

type Status='idle'|'loading'|'done'|'error';

// Paleta de busca (/ ou ⌘K): senadores, deputados e partidos enquanto digita. `<dialog>` nativo dá foco preso e Esc.
export function GlobalSearch({variant='header'}:{variant?:'header'|'hero'}){
  const router=useRouter(),dialog=useRef<HTMLDialogElement>(null),input=useRef<HTMLInputElement>(null),listId=useId();
  const [q,setQ]=useState(''),[hits,setHits]=useState<SearchHit[]>([]),[status,setStatus]=useState<Status>('idle'),[active,setActive]=useState(0);
  const open=useCallback(()=>{dialog.current?.showModal();requestAnimationFrame(()=>input.current?.focus())},[]);
  const close=useCallback(()=>dialog.current?.close(),[]);

  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      const target=event.target as HTMLElement|null,typing=target&&(target.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      if((event.key==='k'&&(event.metaKey||event.ctrlKey))||(event.key==='/'&&!typing&&!event.metaKey&&!event.ctrlKey)){event.preventDefault();open()}
    };
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  },[open]);

  useEffect(()=>{
    const term=q.trim();
    if(term.length<2){setHits([]);setStatus('idle');return}
    setStatus('loading');
    const controller=new AbortController(),timer=setTimeout(async()=>{
      try{
        const response=await fetch(`/api/busca?q=${encodeURIComponent(term)}`,{signal:controller.signal});
        if(!response.ok)throw new Error('http');
        const body=await response.json() as {hits:SearchHit[]};
        setHits(body.hits);setActive(0);setStatus('done');
      }catch(error){if((error as Error).name!=='AbortError')setStatus('error')}
    },120);
    return()=>{clearTimeout(timer);controller.abort()};
  },[q]);

  const go=(hit:SearchHit|undefined)=>{if(!hit)return;close();router.push(hit.href)};
  const onKeyDown=(event:React.KeyboardEvent)=>{
    if(event.key==='ArrowDown'){event.preventDefault();setActive(index=>Math.min(index+1,hits.length-1))}
    else if(event.key==='ArrowUp'){event.preventDefault();setActive(index=>Math.max(index-1,0))}
    else if(event.key==='Enter'){event.preventDefault();go(hits[active])}
  };
  const optionId=(index:number)=>`${listId}-o${index}`;

  const trigger=variant==='hero'
    ?<button type="button" onClick={open} className="focus-ring card-elevated flex min-h-14 w-full max-w-2xl items-center gap-3 rounded-full border bg-card px-5 text-left text-base text-muted-foreground"><Search size={20} aria-hidden="true"/><span className="flex-1">Digite um nome, partido ou estado</span><kbd className="hidden rounded-md border px-2 py-0.5 text-xs sm:inline">/</kbd></button>
    :<button type="button" onClick={open} aria-label="Buscar parlamentar ou partido (atalho: barra /)" className="focus-ring flex min-h-11 items-center gap-2 rounded-full border bg-background px-3 text-sm text-muted-foreground md:min-w-56"><Search size={17} aria-hidden="true"/><span className="hidden flex-1 text-left md:inline">Buscar parlamentar…</span><kbd className="hidden rounded-md border px-1.5 text-xs md:inline">/</kbd></button>;

  return <>
    {trigger}
    <dialog ref={dialog} aria-label="Busca" onClose={()=>{setQ('');setHits([]);setStatus('idle')}} onClick={event=>{if(event.target===dialog.current)close()}} className="m-0 mx-auto mt-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-black/50 sm:mt-[10vh] sm:h-auto sm:max-w-xl">
      <div className="flex h-full flex-col bg-card text-foreground sm:max-h-[75vh] sm:rounded-2xl sm:border sm:shadow-2xl">
        <div className="flex items-center gap-2 border-b p-3">
          <Search size={18} aria-hidden="true" className="ml-1 text-muted-foreground"/>
          <input ref={input} value={q} onChange={event=>setQ(event.target.value)} onKeyDown={onKeyDown} role="combobox" aria-expanded={hits.length>0} aria-controls={listId} aria-activedescendant={hits.length?optionId(active):undefined} aria-autocomplete="list" autoComplete="off" spellCheck={false} placeholder="Digite um nome, partido ou estado" aria-label="Buscar parlamentar ou partido" className="min-h-11 flex-1 bg-transparent text-base outline-none"/>
          <button type="button" onClick={close} className="focus-ring grid size-11 place-items-center rounded-full hover:bg-muted" aria-label="Fechar busca (Esc)"><X size={18} aria-hidden="true"/></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2" aria-live="polite">
          {status==='idle'&&<p className="p-4 text-sm text-muted-foreground">Digite um nome, partido ou estado. Use ↑ ↓ para escolher e Enter para abrir.</p>}
          {status==='loading'&&!hits.length&&<div aria-hidden="true" className="space-y-2 p-2">{[0,1,2].map(i=><div key={i} className="h-12 animate-pulse rounded-xl bg-muted"/>)}</div>}
          {status==='loading'&&<span className="sr-only">Buscando…</span>}
          {status==='error'&&<p className="p-4 text-sm text-muted-foreground">A busca está indisponível agora. Tente de novo em instantes ou use a lista de <a className="font-bold text-primary underline" href="/legislativo">Legislativo</a>.</p>}
          {status==='done'&&!hits.length&&<p className="p-4 text-sm text-muted-foreground">Nada encontrado para “{q.trim()}”. Tente só o sobrenome ou a sigla do partido.</p>}
          <ul id={listId} role="listbox" aria-label="Resultados">{hits.map((hit,index)=>
            <li key={hit.id} id={optionId(index)} role="option" aria-selected={index===active} onMouseEnter={()=>setActive(index)} onClick={()=>go(hit)} className={cn('flex min-h-14 cursor-pointer items-center gap-3 rounded-xl px-3 py-2',index===active&&'bg-secondary')}>
              <span className="relative size-10 shrink-0 overflow-hidden rounded-full border bg-muted">{hit.kind==='pessoa'?<OfficialPortrait src={hit.photoUrl} name={hit.title} sizes="40px"/>:<span className="grid size-full place-items-center text-xs font-bold">{hit.title.slice(0,3)}</span>}</span>
              <span className="min-w-0"><strong className="block truncate">{hit.title}</strong><small className="block truncate text-muted-foreground">{hit.subtitle}</small></span>
            </li>)}</ul>
        </div>
      </div>
    </dialog>
  </>;
}
