import Link from 'next/link';
export interface InsightItem { key:string; title:string; supplierId:string|null; name:string; value:number|null }
export function InsightStrip({items,valueFormat}:{items:InsightItem[];valueFormat:(value:number)=>string}){
  return <div className="grid gap-3 md:grid-cols-3">{items.map(item=><div key={item.key} className="rounded-r-xl border-l-4 border-primary bg-card py-3 pl-4 pr-4 card-elevated"><span className="eyebrow">{item.title}</span><p className="mt-2 min-w-0 text-sm font-semibold leading-5">{item.supplierId?<Link className="text-primary underline-offset-2 hover:underline" href={`/legislativo/fornecedores/${item.supplierId}`}>{item.name}</Link>:item.name}</p>{item.value!==null&&<strong className="display-title mt-1 block text-3xl">{valueFormat(item.value)}</strong>}</div>)}</div>;
}
