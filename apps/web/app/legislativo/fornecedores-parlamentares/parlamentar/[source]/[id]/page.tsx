import Link from 'next/link';
import { parliamentarianSupplierNetwork } from '@/lib/data';
import { LegislativeSubnav } from '@/components/legislative-subnav';
import { EmptyState } from '@/components/empty-state';

export const dynamic='force-dynamic';
const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});

export default async function ParliamentarianNetworkPage({params,searchParams}:{params:Promise<{source:string;id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const {source,id}=await params,p=await searchParams,year=Number(typeof p.ano==='string'?p.ano:new Date().getFullYear());
  if(source!=='camara'&&source!=='senado')return <><LegislativeSubnav/><main className="page-shell py-12"><EmptyState title="Casa inválida" description="Use camara ou senado."/></main></>;
  const result=parliamentarianSupplierNetwork(source,id,{year});
  if(result.status==='unavailable')return <><LegislativeSubnav/><main className="page-shell py-12"><EmptyState title="Rede indisponível" description={result.message}/></main></>;
  return <><LegislativeSubnav/><main className="page-shell py-10"><Link className="text-sm font-bold text-primary underline" href="/legislativo/fornecedores-parlamentares">← Voltar ao mercado</Link><header className="mt-6 rounded-3xl border bg-card p-7"><p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Rede de fornecedores observados · {result.data.year}</p><h1 className="mt-2 text-3xl font-black">Fornecedores pagos pelo parlamentar</h1><p className="mt-3 text-sm text-muted-foreground">Casa: {source==='camara'?'Câmara dos Deputados':'Senado Federal'} · identificador {id}</p></header><section className="mt-6 rounded-3xl border bg-card p-6"><h2 className="text-xl font-black">Quem recebeu pagamentos?</h2><div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b"><tr><th className="py-3 pr-4">Fornecedor</th><th className="py-3 pr-4">Lançamentos</th><th className="py-3 text-right">Valor líquido</th></tr></thead><tbody>{result.data.suppliers.map(row=><tr className="border-b last:border-0" key={row.id}><td className="py-3 pr-4"><Link className="font-bold text-primary underline" href={`/legislativo/fornecedores/${row.id}`}>{row.name}</Link></td><td className="py-3 pr-4">{row.records}</td><td className="py-3 text-right">{money.format(row.valueCents/100)}</td></tr>)}</tbody></table></div></section></main></>;
}
