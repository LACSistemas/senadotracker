import Link from 'next/link';
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Search } from 'lucide-react';
import type { DataCoverage } from '@senadotracker/domain';
import type { SupplierExplorerQuery, SupplierExplorerSort } from '@senadotracker/db';
import { congressSupplierOverview, supplierExplorer, supplierExplorerFacets } from '@/lib/data';
import { LegislativeSubnav } from '@/components/legislative-subnav';
import { DataTable, type DataColumn } from '@/components/data-table';
import { EmptyState } from '@/components/empty-state';
import { CoverageBadge } from '@/components/metrics';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const dynamic='force-dynamic';
type Params=Record<string,string|string[]|undefined>;
type Activity='all'|'institutional'|'parliamentary'|'both';
const scalar=(value:string|string[]|undefined)=>typeof value==='string'?value:undefined;
const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const formatDocument=(value:string|null)=>value?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5')??'CNPJ não publicado';
const activityLabels={institutional:'Institucional',parliamentary:'Parlamentar',both:'Ambos'} as const;
const activityTone={institutional:'bg-chart-2/15 text-chart-2',parliamentary:'bg-chart-1/15 text-chart-1',both:'bg-secondary text-secondary-foreground'} as const;

export default async function SupplierExplorerPage({searchParams}:{searchParams:Promise<Params>}){
  const params=await searchParams,year=Number(scalar(params.ano)??new Date().getFullYear()),page=Math.max(1,Number(scalar(params.pagina)??1)),search=scalar(params.busca)?.trim()??'',activityParam=scalar(params.tipo),houseParam=scalar(params.casa),sortParam=scalar(params.ordem),directionParam=scalar(params.direcao);
  const activity:Activity=activityParam==='institutional'||activityParam==='parliamentary'||activityParam==='both'?activityParam:'all';
  const house:'all'|'CAMARA'|'SENADO'=houseParam==='CAMARA'||houseParam==='SENADO'?houseParam:'all';
  const sort:SupplierExplorerSort=sortParam==='name'||sortParam==='institutional_paid'||sortParam==='reach'?sortParam:'parliamentary_value';
  const direction:'asc'|'desc'=directionParam==='asc'?'asc':'desc';
  const query:SupplierExplorerQuery={year:Number.isSafeInteger(year)?year:new Date().getFullYear(),page,pageSize:25,search,activity,house,sort,direction};
  const result=supplierExplorer(query);
  if(result.status==='unavailable')return <><LegislativeSubnav/><main className="page-shell py-12"><EmptyState title="Explorador indisponível" description={result.message}/></main></>;
  const data=result.data;

  const overviewResult=congressSupplierOverview({year:data.year,house});
  const overview=overviewResult.status==='available'?overviewResult.data:null;
  const facetsResult=supplierExplorerFacets({year:data.year,house});
  const facets=facetsResult.status==='available'?facetsResult.data:null;

  const base={ano:data.year,busca:search||undefined,tipo:activity==='all'?undefined:activity,casa:house==='all'?undefined:house,ordem:sort,direcao:direction};
  const href=(values:Record<string,string|number|undefined>)=>{const merged={...base,...values},q=new URLSearchParams();for(const [key,value] of Object.entries(merged))if(value!==undefined&&value!=='')q.set(key,String(value));return `/legislativo/fornecedores/explorar?${q}`};

  const coverage:DataCoverage={availability:data.items.length?'available':'partial',source:'multiple',period:{from:`${data.year}-01-01`,to:null,grain:'year'},batchId:null,sampleSize:data.total,note:'Fornecedores com identidade forte e atividade no agregado publicado. Valores institucionais são pagamentos comprovados; valores parlamentares são despesas líquidas CEAP/CEAPS. Eles nunca são somados. Execução institucional da Câmara está em backfill/reconciliação — não é um total fechado.'};
  const universeCoverage:DataCoverage={availability:'available',source:'multiple',period:{from:`${data.year}-01-01`,to:null,grain:'year'},batchId:null,sampleSize:facets?.total??null,note:'Câmara institucional em backfill/reconciliação; universos parlamentar e institucional nunca são somados entre si.'};

  const maxParliamentary=Math.max(...data.items.map(item=>item.parliamentary?.netCents??0),1);
  const maxInstitutional=Math.max(...data.items.map(item=>item.institutional?.paidCents??0),1);

  const sortLink=(label:string,key:SupplierExplorerSort)=>{const active=sort===key,nextDirection:'asc'|'desc'=active&&direction==='desc'?'asc':'desc',Icon=!active?ArrowUpDown:direction==='desc'?ArrowDown:ArrowUp;return <Link prefetch={false} href={href({ordem:key,direcao:nextDirection,pagina:undefined})} className="focus-ring inline-flex items-center gap-1 text-xs font-bold hover:text-primary" aria-current={active?'true':undefined}>{label}<Icon size={11}/></Link>};

  type Item=(typeof data.items)[number];
  const columns:DataColumn<Item>[]=[
    {key:'name',header:sortLink('Fornecedor','name'),render:item=><div className="min-w-0"><strong className="block truncate">{item.name}</strong><small className="block text-muted-foreground">{formatDocument(item.publicDocument)}</small>{item.aliases.length>1&&<small className="mt-0.5 block truncate text-muted-foreground/80">{item.aliases.slice(0,2).join(', ')}</small>}</div>},
    {key:'type',header:'Tipo',render:item=><span className={cn('rounded-full px-2 py-1 text-xs font-bold',activityTone[item.activity])}>{activityLabels[item.activity]}</span>},
    {key:'house',header:'Casa',render:item=>item.houses.map(value=>value==='CAMARA'?'Câmara':'Senado').join(' e ')||'—'},
    {key:'value',header:<div className="flex flex-col items-end gap-1">{sortLink('Parlamentar','parliamentary_value')}{sortLink('Institucional','institutional_paid')}</div>,align:'right',render:item=><div className="space-y-1.5">
      <div className="flex items-center justify-end gap-2"><div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-chart-1" style={{width:item.parliamentary?`${Math.min(100,item.parliamentary.netCents/maxParliamentary*100)}%`:'0%'}}/></div><strong className="w-24 text-right text-sm tabular-nums">{item.parliamentary?money.format(item.parliamentary.netCents/100):'—'}</strong></div>
      <div className="flex items-center justify-end gap-2"><div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-chart-2" style={{width:item.institutional?`${Math.min(100,item.institutional.paidCents/maxInstitutional*100)}%`:'0%'}}/></div><strong className="w-24 text-right text-sm tabular-nums">{item.institutional?money.format(item.institutional.paidCents/100):'—'}</strong></div>
      {item.parliamentary&&<small className="block text-muted-foreground">{sortLink(`${item.parliamentary.parliamentarians} parlamentares · ${item.parliamentary.ufs} UFs · ${item.parliamentary.parties} partidos`,'reach')}</small>}
    </div>},
    {key:'profile',header:'Perfil',align:'right',render:item=>item.publicDocument?<Link className="focus-ring font-bold text-primary underline-offset-2 hover:underline" href={`/legislativo/fornecedores/${item.id}`}>Ver fornecedor →</Link>:<span className="text-muted-foreground">Identidade restrita</span>},
  ];

  const podiumValue=(item:Item)=>sort==='institutional_paid'?item.institutional?.paidCents??null:sort==='reach'?item.parliamentary?.parliamentarians??null:item.parliamentary?.netCents??null;
  const podiumLabel=sort==='institutional_paid'?'pagamento institucional':sort==='reach'?'parlamentares alcançados':'despesa parlamentar';
  const podiumFormat=(value:number)=>sort==='reach'?`${value.toLocaleString('pt-BR')} parlamentares`:money.format(value/100);

  return <><LegislativeSubnav/><main id="conteudo" tabIndex={-1} className="page-shell py-8 space-y-8">

  <header className="rounded-3xl border bg-card p-7 lg:p-10"><p className="eyebrow">Fornecedores · Congresso Nacional</p><h1 className="display-title mt-3 text-[clamp(2rem,4vw,3rem)]">Explorar fornecedores</h1><p className="text-balance mt-3 max-w-2xl text-base leading-7 text-muted-foreground">Busque empresas e organizações observadas em despesas parlamentares e pagamentos institucionais, sem misturar os dois universos.</p><form action="/legislativo/fornecedores/explorar" className="mt-6 flex max-w-xl gap-3"><Input name="busca" defaultValue={search} placeholder="Buscar por nome ou CNPJ" aria-label="Buscar fornecedor"/><Button><Search size={16}/>Buscar</Button></form></header>

  <section className="rounded-3xl border bg-card p-6 lg:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><h2 className="text-lg font-black">Panorama do recorte</h2><CoverageBadge coverage={universeCoverage}/></div><p className="mt-1 text-sm text-muted-foreground">{data.year} · {house==='all'?'Câmara e Senado':house==='CAMARA'?'Câmara dos Deputados':'Senado Federal'}</p>
    <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div><span className="eyebrow">Fornecedores no recorte</span><strong className="display-title mt-1 block text-3xl">{(facets?.total??0).toLocaleString('pt-BR')}</strong></div>
      <div><span className="eyebrow">Despesas parlamentares</span><strong className="display-title mt-1 block text-3xl">{money.format((overview?.parliamentaryCents??0)/100)}</strong></div>
      <div><span className="eyebrow">Pagamentos institucionais</span><strong className="display-title mt-1 block text-3xl">{money.format((overview?.institutionalCents??0)/100)}</strong></div>
      <div><span className="eyebrow">Atuam nos dois mercados</span><strong className="display-title mt-1 block text-3xl">{(facets?.both??0).toLocaleString('pt-BR')}</strong></div>
    </div>
    {!!overview?.suppliersNational&&<p className="mt-4 text-xs text-muted-foreground">{overview.suppliersNational.toLocaleString('pt-BR')} fornecedor(es) com alcance nacional (parlamentares pagadores nas 27 UFs) neste recorte.</p>}
  </section>

  <section className="rounded-2xl border bg-card p-4"><form action="/legislativo/fornecedores/explorar" className="flex flex-col gap-4">
    <input type="hidden" name="busca" value={search}/>
    <div><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Tipo</span><div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por tipo de atividade">{([['all','Todos',facets?.total],['parliamentary','Parlamentar',facets?.parliamentary],['institutional','Institucional',facets?.institutional],['both','Ambos',facets?.both]] as const).map(([value,label,count])=><Link key={value} prefetch={false} href={href({tipo:value==='all'?undefined:value,pagina:undefined})} aria-current={activity===value?'page':undefined} className={cn('focus-ring rounded-full border px-3 py-1.5 text-xs font-bold transition',activity===value?'border-primary bg-primary text-primary-foreground':'text-muted-foreground hover:border-primary hover:text-primary')}>{label}{count!==undefined&&` · ${count.toLocaleString('pt-BR')}`}</Link>)}</div></div>
    <div><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Casa</span><div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por Casa">{([['all','Congresso'],['CAMARA','Câmara'],['SENADO','Senado']] as const).map(([value,label])=><Link key={value} prefetch={false} href={href({casa:value==='all'?undefined:value,pagina:undefined})} aria-current={house===value?'page':undefined} className={cn('focus-ring rounded-full border px-3 py-1.5 text-xs font-bold transition',house===value?'border-primary bg-primary text-primary-foreground':'text-muted-foreground hover:border-primary hover:text-primary')}>{label}</Link>)}</div></div>
    <div className="flex flex-wrap items-end gap-3 border-t pt-3"><div><label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground" htmlFor="ano">Ano</label><Input id="ano" className="w-24" name="ano" inputMode="numeric" defaultValue={data.year}/></div><div><label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground" htmlFor="ordem">Ordenar por</label><select id="ordem" className="h-9 rounded-md border bg-background px-3 text-sm" name="ordem" defaultValue={sort}><option value="parliamentary_value">Despesa parlamentar</option><option value="institutional_paid">Pagamento institucional</option><option value="reach">Alcance</option><option value="name">Nome</option></select></div><div><label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground" htmlFor="direcao">Direção</label><select id="direcao" className="h-9 rounded-md border bg-background px-3 text-sm" name="direcao" defaultValue={direction}><option value="desc">Maior/Z–A primeiro</option><option value="asc">Menor/A–Z primeiro</option></select></div><Button>Aplicar</Button></div>
  </form></section>

  {sort!=='name'&&data.items.length>=3&&<section><h2 className="mb-3 text-lg font-black">Pódio do recorte</h2><div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{data.items.slice(0,3).map((item,index)=>{const value=podiumValue(item);return <div key={item.id} className={cn('min-w-0 rounded-2xl border bg-card p-5',index===0&&'border-primary/40 bg-primary/5')}><span className="eyebrow">{index+1}º lugar</span><p className="display-title mt-2 truncate text-xl" title={item.name}>{item.name}</p><strong className="mt-2 block text-lg tabular-nums">{value!==null?podiumFormat(value):'—'}</strong><small className="mt-1 block text-xs text-muted-foreground">{podiumLabel}{item.parliamentary&&` · ${item.parliamentary.ufs} UFs · ${item.parliamentary.parties} partidos`}</small></div>})}</div></section>}

  <section><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-black">Fornecedores encontrados</h2><p className="text-sm text-muted-foreground">{data.total.toLocaleString('pt-BR')} entidades no recorte. Atualização: {data.revisionPublishedAt??'não informada'}.</p></div><Link className="focus-ring inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold" href={`/legislativo/fornecedores/explorar/baixar?${new URLSearchParams(Object.entries(base).filter((entry):entry is [string,string]=>entry[1]!==undefined).map(([key,value])=>[key,String(value)]))}`}><Download size={16}/>Baixar CSV</Link></div><DataTable caption="Fornecedores do Congresso" rows={data.items} columns={columns} rowKey={item=>item.id} coverage={coverage} page={data.page} pageCount={Math.max(1,Math.ceil(data.total/data.pageSize))} pageHref={next=>href({pagina:next>1?next:undefined})}/></section>

  </main></>;
}
