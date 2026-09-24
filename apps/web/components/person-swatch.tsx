import { cn } from '@/lib/utils';

/** Cor de identidade e nome viajam sempre juntos. Sem isso a paleta da barra fixa não se reconecta
    aos painéis seguintes, e o leitor tem que casar pessoa e cor de cabeça. */
export function PersonSwatch({color,name,className}:{color:string;name:string;className?:string}){
  return <span className={cn('inline-flex min-w-0 items-center gap-2',className)}><i className="size-2.5 shrink-0 rounded-full" style={{background:color}} aria-hidden="true"/><span className="truncate">{name}</span></span>;
}
