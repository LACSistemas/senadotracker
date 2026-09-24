import Link from 'next/link';
import { supplierNetwork } from '@/lib/data';
import { LegislativeSubnav } from '@/components/legislative-subnav';
import { EmptyState } from '@/components/empty-state';

export const dynamic='force-dynamic';
type Params=Record<string,string|string[]|undefined>;
const scalar=(v:string|string[]|undefined)=>typeof v==='string'?v:undefined;
const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});

export default async function SupplierNetworkPage({searchParams}:{searchParams:Promise<Params>}){
  const p=await searchParams,id=scalar(p.fornecedor),year=Number(scalar(p.ano)??new Date().getFullYear()),house=scalar(p.casa)==='CAMARA'||scalar(p.casa)==='SENADO'?(scalar(p.casa) as 'CAMARA'|'SENADO'):'all';
  if(!id)return <><LegislativeSubnav/><main className="page-shell py-12"><EmptyState title="Fornecedor não informado" description="Escolha um fornecedor no mercado parlamentar para abrir a rede observada."/></main></>;
  const loaded=supplierNetwork(id,{year,house,limit:50});
  if(loaded.status==='unavailable')return <><LegislativeSubnav/><main className="page-shell py-12"><EmptyState title="Rede indisponível" description={loaded.message}/></main></>;
  const result=loaded.data;
  if(!result)return <><LegislativeSubnav/><main className="page-shell py-12"><EmptyState title="Fornecedor não encontrado" description="Não há identidade global compatível com este identificador."/></main></>;
  return <><LegislativeSubnav/><main className="page-shell py-10"><Link className="text-sm font-bold text-primary underline" href="/fornecedores-parlamentares">← Voltar ao mercado</Link><header className="mt-6 rounded-3xl border bg-card p-7"><p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Rede de relações financeiras observadas · {result.year}</p><h1 className="mt-2 text-3xl font-black">{result.supplier.name}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Parlamentares com pagamentos líquidos vinculados a este fornecedor no recorte. A conexão financeira observada não implica relação política, favorecimento ou irregularidade.</p></header><section className="mt-6 rounded-3xl border bg-card p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-black">Quem paga este fornecedor?</h2><p className="text-sm text-muted-foreground">{result.parliamentarians.length} maiores parlamentares observados · Casa: {house==='all'?'Congresso':house==='CAMARA'?'Câmara':'Senado'}</p></div><strong className="text-xl">{money.format(result.totalCents/100)}</strong></div><div className="mt-6 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b"><tr><th className="py-3 pr-4">Parlamentar</th><th className="py-3 pr-4">Casa</th><th className="py-3 pr-4">UF</th><th className="py-3 pr-4">Partido</th><th className="py-3 pr-4">Lançamentos</th><th className="py-3 text-right">Valor líquido</th></tr></thead><tbody>{result.parliamentarians.map(row=><tr className="border-b last:border-0" key={`${row.source}-${row.externalId}`}><td className="py-3 pr-4"><Link className="font-bold text-primary underline" href={`/legislativo/${row.source==='camara'?'deputados':'senadores'}/${row.externalId}`}>{row.name}</Link></td><td className="py-3 pr-4">{row.source==='camara'?'Câmara':'Senado'}</td><td className="py-3 pr-4">{row.uf??'—'}</td><td className="py-3 pr-4">{row.party??'—'}</td><td className="py-3 pr-4">{row.records}</td><td className="py-3 text-right">{money.format(row.valueCents/100)}</td></tr>)}</tbody></table></div></section></main></>;
}
