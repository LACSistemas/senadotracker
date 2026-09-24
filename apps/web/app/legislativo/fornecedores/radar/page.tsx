import Link from 'next/link';
import {Building2,Search,Store,Users} from 'lucide-react';
import type {DataCoverage,Source} from '@senadotracker/domain';
import {supplierRadar} from '@/lib/data';
import {LegislativeSubnav} from '@/components/legislative-subnav';
import {InstitutionHero} from '@/components/heroes';
import {FilterBar} from '@/components/data-controls';
import {DataTable,type DataColumn} from '@/components/data-table';
import {EmptyState} from '@/components/empty-state';
import {CoverageBadge,KpiCard,KpiGrid} from '@/components/metrics';
import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';

export const dynamic='force-dynamic';
type Params=Record<string,string|string[]|undefined>;
const scalar=(value:string|string[]|undefined)=>typeof value==='string'?value:undefined;
const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const doc=(value:string)=>{const digits=value.replace(/\D/g,'');return digits.length===14?digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5'):value};
function href(values:Record<string,string|number|undefined>){const p=new URLSearchParams();for(const [k,v] of Object.entries(values))if(v!==undefined&&v!=='')p.set(k,String(v));return `/legislativo/fornecedores/radar?${p}`}

export default async function SuppliersPage({searchParams}:{searchParams:Promise<Params>}){
  const p=await searchParams,sourceValue=scalar(p.casa),source:Source|undefined=sourceValue==='senado'||sourceValue==='camara'?sourceValue:undefined,requested=Number(scalar(p.ano)),year=Number.isInteger(requested)?requested:undefined,search=scalar(p.busca)?.trim(),rawPage=Number(scalar(p.pagina)??1),page=Number.isSafeInteger(rawPage)&&rawPage>0?rawPage:1;
  const result=supplierRadar({page,pageSize:25,...(source?{source}:{}),...(year?{year}:{}),...(search?{search}:{})});
  if(result.status==='unavailable')return <><LegislativeSubnav/><main className="page-shell py-12"><EmptyState title="Radar indisponível" description={result.message}/></main></>;
  const data=result.data;type Item=(typeof data.items)[number];const columns:DataColumn<Item>[]=[
    {key:'supplier',header:'Fornecedor',render:item=><div><Link className="font-bold text-primary underline" href={`/legislativo/fornecedores/radar/${item.document}?${new URLSearchParams({...(source?{casa:source}:{}),...(data.year?{ano:String(data.year)}:{})})}`}>{item.supplier}</Link><small className="block text-muted-foreground">{doc(item.document)}</small></div>},
    {key:'parliamentarians',header:'Parlamentares',align:'right',render:item=><strong>{item.parliamentarians}</strong>},
    {key:'houses',header:'Casas',align:'right',render:item=>item.houses===2?'Senado e Câmara':source==='senado'?'Senado':source==='camara'?'Câmara':'1 Casa'},
    {key:'records',header:'Lançamentos',align:'right',render:item=>item.records.toLocaleString('pt-BR')},
    {key:'value',header:'Total identificado',align:'right',render:item=><strong>{money.format(item.valueCents/100)}</strong>},
  ];
  const top=data.leader,base={casa:source,ano:data.year??undefined,busca:search};
  return <><LegislativeSubnav/><main id="conteudo" tabIndex={-1}><div className="page-shell py-8"><InstitutionHero context="Despesas parlamentares · cruzamento por documento" title="Radar de fornecedores" description="Veja quantos parlamentares pagaram ao mesmo fornecedor nos lotes de cota. Concentração é uma pista para consulta, não evidência de irregularidade." imageUrl="/congresso.svg" location="Senado Federal e Câmara dos Deputados"/></div><section className="page-shell py-10"><form action="/legislativo/fornecedores/radar" className="mb-5 flex gap-3"><Input name="busca" defaultValue={search??''} placeholder="Nome ou CNPJ" aria-label="Buscar fornecedor"/><Button><Search size={16}/>Buscar</Button></form><FilterBar action="/legislativo/fornecedores/radar" fields={[{name:'casa',label:'Casa',value:source??'',options:[{value:'',label:'Congresso'},{value:'senado',label:'Senado'},{value:'camara',label:'Câmara'}]},{name:'ano',label:'Ano',value:data.year?String(data.year):'',options:data.years.map(value=>({value:String(value),label:String(value)}))}]}>{search?<input type="hidden" name="busca" value={search}/>:null}</FilterBar></section><section className="border-y bg-card"><div className="page-shell py-10"><KpiGrid className="xl:grid-cols-3"><KpiCard label="Fornecedores com documento" value={data.total} coverage={data.coverage} comparison={null} icon={Store}/><KpiCard label="Maior alcance no recorte" value={top?`${top.parliamentarians} parlamentares`:'—'} coverage={data.coverage} comparison={top?.supplier??null} icon={Users}/><KpiCard label="Período" value={data.year??'—'} coverage={data.coverage} comparison={source?source==='senado'?'Senado':'Câmara':'Duas Casas'} icon={Building2}/></KpiGrid><div className="mt-8 flex items-center justify-between gap-4"><div><h2 className="text-2xl font-bold">Fornecedores cruzados</h2><p className="mt-1 text-sm text-muted-foreground">Ordenados pelo número de parlamentares distintos e depois pelo valor identificado.</p></div><CoverageBadge coverage={data.coverage as DataCoverage}/></div>{data.items.length?<div className="mt-5"><DataTable caption="Fornecedores cruzados" rows={data.items} columns={columns} rowKey={item=>item.document} coverage={data.coverage as DataCoverage} page={page} pageCount={Math.max(1,Math.ceil(data.total/data.pageSize))} pageHref={next=>href({...base,pagina:next>1?next:undefined})}/></div>:<div className="mt-5"><EmptyState title="Nenhum fornecedor neste recorte" description={data.coverage.note}/></div>}<p className="mt-5 max-w-4xl text-sm leading-6 text-muted-foreground">{data.coverage.note} Valores são líquidos de estornos registrados. Homônimos sem documento não são cruzados.</p></div></section></main></>;
}
