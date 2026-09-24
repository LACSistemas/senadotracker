import { cn } from '@/lib/utils';
export interface DistributionBarItem { key:string; label:string; valueCents:number }
export function DistributionBars({items,totalCents,formatValue,className}:{items:DistributionBarItem[];totalCents:number;formatValue:(cents:number)=>string;className?:string}){
  return <div className={cn('space-y-4',className)}>{items.map(item=><div key={item.key}><div className="flex justify-between gap-3 text-sm"><span className="truncate">{item.label}</span><strong>{formatValue(item.valueCents)}</strong></div><div className="mt-2 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{width:`${totalCents?Math.min(100,item.valueCents/totalCents*100):0}%`}}/></div></div>)}</div>;
}
