import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface TogglePill{value:string;label:string;href:string;disabled?:boolean;reason?:string}

/** Segmented control server-side: o estado vive na URL, é compartilhável e não custa JavaScript.
    Opção desabilitada vira `<span>` com o motivo no `title` — nunca um link que leva a dado estimado. */
export function TogglePills({label,pills,current,className}:{label:string;pills:TogglePill[];current:string;className?:string}){
  return <div className={cn('inline-flex flex-col gap-1.5',className)} role="group" aria-label={label}>
    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
    <div className="inline-flex flex-wrap rounded-xl bg-muted p-1">{pills.map(pill=>{
      const active=pill.value===current,classes='rounded-lg px-3 py-1.5 text-xs font-bold transition';
      if(pill.disabled)return <span key={pill.value} className={cn(classes,'cursor-not-allowed text-muted-foreground/60')} title={pill.reason} aria-disabled="true">{pill.label}</span>;
      return <Link key={pill.value} prefetch={false} href={pill.href} aria-current={active?'page':undefined} className={cn(classes,'focus-ring',active?'bg-primary text-primary-foreground shadow-sm':'text-muted-foreground hover:text-foreground')}>{pill.label}</Link>;
    })}</div>
  </div>;
}
