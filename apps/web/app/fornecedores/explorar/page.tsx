import Link from 'next/link';
import { Download, Search } from 'lucide-react';
import type { DataCoverage } from '@senadotracker/domain';
import type { SupplierExplorerQuery } from '@senadotracker/db';
import { supplierExplorer } from '@/lib/data';
import { LegislativeSubnav } from '@/components/legislative-subnav';
import { InstitutionHero } from '@/components/heroes';
import { DataTable, type DataColumn } from '@/components/data-table';
import { EmptyState } from '@/components/empty-state';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export const dynamic='force-dynamic';
type Params=Record<string,string|string[]|undefined>;
const scalar=(value:string|string[]|undefined)=>typeof value==='string'?value:undefined;
const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const formatDocument=(value:string|null)=>value?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5')??'CNPJ não publicado';
const href=(values:Record<string,string|number|undefined>)=>{const query=new URLSearchParams();for(const [key,value]of Object.entries(values))if(value!==undefined&&value!=='')query.set(key,String(value));return `/fornecedores/explorar?${query}`};

export default async function SupplierExplorerPage({searchParams}:{searchParams:Promise<Params>}){
  const params=await searchParams,year=Number(scalar(params.ano)??new Date().getFullYear()),page=Math.max(1,Number(scalar(params.pagina)??1)),search=scalar(params.busca)?.trim()??'',activity=scalar(params.tipo),house=scalar(params.casa),sort=scalar(params.ordem),direction=scalar(params.direcao);
  const query:SupplierExplorerQuery={year:Number.isSafeInteger(year)?year:new Date().getFullYear(),page,pageSize:25,search,activity:activity==='institutional'||activity==='parliamentary'||activity==='both'?activity:'all',house:house==='CAMARA'||house==='SENADO'?house:'all',sort:sort==='name'||sort==='institutional_paid'||sort==='reach'?sort:'parliamentary_value',direction:direction==='asc'?'asc':'desc'};
  const result=supplierExplorer(query);
  if(result.status==='unavailable')return <><LegislativeSubnav/><main className="page-shell py-12"><EmptyState title="Explorador indisponível" description={result.message}/></main></>;
  const data=result.data,typeLabels={institutional:'Institucional',parliamentary:'Parlamentar',both:'Ambos'} as const,coverage:DataCoverage={availability:data.items.length?'available':'partial',source:'multiple',period:{from:`${data.year}-01-01`,to:null,grain:'year'},batchId:null,sampleSize:data.total,note:'Fornecedores com identidade forte e atividade no agregado publicado. Valores institucionais são pagamentos comprovados; valores parlamentares são despesas líquidas CEAP/CEAPS. Eles não são somados.'};
  type Item=(typeof data.items)[number];
  const columns:DataColumn<Item>[]=[
    {key:'name',header:'Fornecedor',render:item=><div><strong>{item.name}</strong><small className="block text-muted-foreground">{formatDocument(item.publicDocument)}</small></div>},
    {key:'type',header:'Tipo',render:item=><span className="rounded-full border px-2 py-1 text-xs font-bold">{typeLabels[item.activity]}</span>},
    {key:'house',header:'Casa',render:item=>item.houses.map(value=>value==='CAMARA'?'Câmara':'Senado').join(' e ')||'—'},
    {key:'parliamentary',header:'Despesa parlamentar',align:'right',render:item=>item.parliamentary?<div><strong>{money.format(item.parliamentary.netCents/100)}</strong><small className="block text-muted-foreground">{item.parliamentary.parliamentarians} parlamentares</small></div>:'—'},
    {key:'institutional',header:'Pagamento institucional',align:'right',render:item=>item.institutional?<div><strong>{money.format(item.institutional.paidCents/100)}</strong><small className="block text-muted-foreground">{item.institutional.contracts} contratos</small></div>:'—'},
    {key:'profile',header:'Perfil',align:'right',render:item=>item.publicDocument?<Link className="font-bold text-primary underline" href={`/fornecedores/${item.id}`}>Ver fornecedor →</Link>:<span className="text-muted-foreground">Identidade restrita</span>},
  ];
  const base={ano:data.year,busca:search||undefined,tipo:query.activity==='all'?undefined:query.activity,casa:query.house==='all'?undefined:query.house,ordem:query.sort,direcao:query.direction};
  return <><LegislativeSubnav/><main id="conteudo" tabIndex={-1}><div className="page-shell py-8"><InstitutionHero context="Congresso Nacional · Brasília · DF" title="Explorar fornecedores" description="Busque empresas e organizações observadas em despesas parlamentares e pagamentos institucionais, sem misturar os dois universos." imageUrl="/congresso.svg" location="Senado Federal e Câmara dos Deputados"/></div><section className="page-shell py-8"><form action="/fornecedores/explorar" className="grid gap-3 rounded-2xl border bg-card p-4 lg:grid-cols-[minmax(260px,1fr)_repeat(4,auto)_auto]"><label className="sr-only" htmlFor="busca">Buscar fornecedor</label><Input id="busca" name="busca" defaultValue={search} placeholder="Buscar por nome ou CNPJ"/><select className="rounded-md border bg-background px-3" name="tipo" defaultValue={query.activity}><option value="all">Todos os tipos</option><option value="institutional">Institucional</option><option value="parliamentary">Parlamentar</option><option value="both">Ambos</option></select><select className="rounded-md border bg-background px-3" name="casa" defaultValue={query.house}><option value="all">Todas as Casas</option><option value="CAMARA">Câmara</option><option value="SENADO">Senado</option></select><Input className="w-28" name="ano" inputMode="numeric" defaultValue={data.year}/><select className="rounded-md border bg-background px-3" name="ordem" defaultValue={query.sort}><option value="parliamentary_value">Despesa parlamentar</option><option value="institutional_paid">Pagamento institucional</option><option value="reach">Alcance</option><option value="name">Nome</option></select><Button><Search size={16}/>Aplicar</Button></form><div className="mt-8"><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-black">Fornecedores encontrados</h1><p className="text-sm text-muted-foreground">{data.total.toLocaleString('pt-BR')} entidades no recorte. Atualização: {data.revisionPublishedAt??'não informada'}.</p></div><Link className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold" href={`/fornecedores/explorar/baixar?${new URLSearchParams(Object.entries(base).filter((entry):entry is [string,string]=>entry[1]!==undefined).map(([key,value])=>[key,String(value)]))}`}><Download size={16}/>Baixar CSV</Link></div><DataTable caption="Fornecedores do Congresso" rows={data.items} columns={columns} rowKey={item=>item.id} coverage={coverage} page={data.page} pageCount={Math.max(1,Math.ceil(data.total/data.pageSize))} pageHref={next=>href({...base,pagina:next>1?next:undefined})}/></div></section></main></>;
}