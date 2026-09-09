'use client';
import Image from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export function InstitutionalImage({src,priority=false,className}:{src:string;priority?:boolean;className?:string}){
  const [failed,setFailed]=useState(false);
  if(failed)return <div aria-hidden="true" className={cn('absolute inset-0 bg-primary',className)}/>;
  return <Image src={src} alt="" fill sizes="(max-width: 768px) 100vw, 1200px" priority={priority} className={cn('object-cover',className)} onError={()=>setFailed(true)}/>;
}

export function OfficialPortrait({src,name,sizes='160px',priority=false}:{src:string|null|undefined;name:string;sizes?:string;priority?:boolean}){
  const [failed,setFailed]=useState(false);
  if(!src||failed)return <span className="grid size-full place-items-center bg-muted px-2 text-center text-xs text-muted-foreground">Foto indisponível</span>;
  return <Image src={src} alt={`Foto oficial de ${name}`} fill sizes={sizes} priority={priority} className="object-cover object-top" onError={()=>setFailed(true)}/>;
}
