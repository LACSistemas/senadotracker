import { evalVar, type EvalTone } from '@/lib/eval-color';
import { absent } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Micro-barra atrás do número, dentro da célula. Cria o próprio contexto de posicionamento em vez de
    exigir `relative` no `td`, para funcionar também dentro de `DataColumn.render` e do card mobile do
    `DataTable`. Valor ausente não desenha barra nem entra em cálculo de escala. */
export function CellBar({value,max,tone,children,className}:{value:number|null;max:number;tone:EvalTone;children?:React.ReactNode;className?:string}){
  if(value===null)return <span className="text-muted-foreground">{absent}</span>;
  const width=max>0?Math.max(2,Math.min(100,100*value/max)):0;
  return <span className={cn('relative block min-w-16',className)}>
    <span aria-hidden="true" className="absolute inset-y-0 left-0 rounded-sm opacity-[.22]" style={{width:`${width}%`,background:evalVar(tone)}}/>
    <span className="relative tabular-nums">{children}</span>
  </span>;
}
