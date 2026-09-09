import Image from 'next/image';
import { cn } from '@/lib/utils';

const logos:Record<string,string>={
  AVANTE:'/parties/avante.gif',CIDADANIA:'/parties/cidadania.png',DC:'/parties/dc.png',MDB:'/parties/mdb.svg',MISSÃO:'/parties/missao.png',NOVO:'/parties/novo.svg',PCdoB:'/parties/pcdob.gif',PDT:'/parties/pdt.gif',PL:'/parties/pl.svg',PODE:'/parties/pode.gif',PP:'/parties/pp.gif',PRD:'/parties/prd.png',PSB:'/parties/psb.gif',PSD:'/parties/psd.gif',PSDB:'/parties/psdb.gif',PSOL:'/parties/psol.gif',PT:'/parties/pt.gif',PV:'/parties/pv.gif',REDE:'/parties/rede.gif',REPUBLICANOS:'/parties/republicanos.png',SOLIDARIEDADE:'/parties/solidariedade.png',UNIÃO:'/parties/uniao.svg',
};

export function PartyLogo({party,size=32,className}:{party:string;size?:number;className?:string}){
  const src=logos[party];
  return <span className={cn('inline-grid shrink-0 place-items-center overflow-hidden rounded-md border bg-white p-1',className)} style={{width:size,height:size}}>{src?<Image src={src} alt={`Logo do partido ${party}`} width={size-8} height={size-8} className="max-h-full w-auto object-contain"/>:<span aria-hidden="true" className="text-[9px] font-black text-primary">{party.slice(0,3)}</span>}</span>;
}

export function PartyIdentity({party,className}:{party:string;className?:string}){return <span className={cn('inline-flex items-center gap-2',className)}><PartyLogo party={party}/><strong>{party}</strong></span>}
