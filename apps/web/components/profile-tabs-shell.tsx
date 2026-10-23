'use client';
import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';

export type ProfileTab='overview'|'costs'|'activity'|'career';
const ITEMS:Array<[ProfileTab,string,string]>=[['overview','Visão geral',''],['costs','Gastos e equipe','/gastos-equipe'],['activity','Atuação parlamentar','/atuacao-parlamentar'],['career','Carreira política','/carreira-politica']];

const tabOfPath=(pathname:string,root:string):ProfileTab|null=>{
  if(pathname===root||pathname===`${root}/`)return 'overview';
  const hit=ITEMS.find(([,,suffix])=>suffix&&pathname===`${root}${suffix}`);
  return hit?hit[0]:null;
};

// Abas do perfil sem recarregar: o servidor renderiza as quatro seções de uma vez (dados unificados) e o CSS
// (`data-profile-section`) mostra só a ativa. Cada aba continua tendo URL própria (history.pushState), então
// o link é compartilhável, o botão Voltar funciona e, sem JavaScript, a rota correspondente abre a aba certa.
export function ProfileTabsShell({initial,root,children}:{initial:ProfileTab;root:string;children:ReactNode}){
  const [active,setActive]=useState<ProfileTab>(initial),content=useRef<HTMLDivElement>(null);
  const reduced=()=>typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const show=useCallback((tab:ProfileTab,url:string|null,hash:string)=>{
    setActive(tab);
    if(url&&`${location.pathname}${location.search}`!==url.split('#')[0])history.pushState(null,'',url);
    requestAnimationFrame(()=>{
      const target=hash?document.getElementById(hash.slice(1)):null,el=target??content.current;
      el?.scrollIntoView({behavior:reduced()?'auto':'smooth',block:'start'});
    });
  },[]);

  useEffect(()=>{
    const onPop=()=>{const tab=tabOfPath(location.pathname,root);if(tab)setActive(tab)};
    window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop);
  },[root]);

  // A pílula "Faltam N dados" fica no topo (fora das abas) e aponta para a Visão geral.
  useEffect(()=>{
    const onClick=(event:globalThis.MouseEvent)=>{
      const anchor=(event.target as HTMLElement|null)?.closest?.('a[href="#faltam-dados"]');
      if(anchor){setActive('overview');requestAnimationFrame(()=>document.getElementById('faltam-dados')?.setAttribute('open',''))}
    };
    document.addEventListener('click',onClick);return()=>document.removeEventListener('click',onClick);
  },[]);

  // Qualquer link interno para outra aba (abas, tiles do crachá) troca a aba em vez de recarregar a página.
  const intercept=(event:MouseEvent<HTMLElement>)=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const anchor=(event.target as HTMLElement).closest('a');
    if(!anchor||anchor.target||anchor.hasAttribute('download'))return;
    const url=new URL(anchor.href,location.href);
    if(url.origin!==location.origin||url.search)return;
    const tab=tabOfPath(url.pathname,root);
    if(!tab)return;
    event.preventDefault();
    show(tab,`${url.pathname}${url.hash}`,url.hash);
  };

  return <div className="page-shell grid gap-8 pb-10 pt-2 lg:grid-cols-[210px_minmax(0,1fr)]" onClick={intercept}>
    <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
      <nav aria-label="Seções do perfil" className="overflow-x-auto rounded-2xl border bg-card p-2">
        <div className="flex min-w-max gap-1 lg:min-w-0 lg:flex-col">{ITEMS.map(([key,label,suffix])=>
          <a key={key} href={`${root}${suffix}`} aria-current={active===key?'page':undefined} className="focus-ring inline-flex min-h-11 items-center rounded-xl px-4 py-3 text-sm font-bold text-muted-foreground no-underline transition hover:bg-muted aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground">{label}</a>)}
        </div>
      </nav>
    </aside>
    <div ref={content} data-profile-section={active} className="profile-section-content min-w-0 scroll-mt-24 space-y-16">{children}</div>
  </div>;
}
