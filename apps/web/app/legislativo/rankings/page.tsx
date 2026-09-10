import Link from 'next/link';
import {BarChart3,FileText,ReceiptText,UserMinus} from 'lucide-react';
import {ufs,type DataCoverage,type Source} from '@senadotracker/domain';
import type {RankingDimension} from '@senadotracker/db';
import {rankings} from '@/lib/data';
import {LegislativeSubnav} from '@/components/legislative-subnav';
import {InstitutionHero} from '@/components/heroes';
import {FilterBar} from '@/components/data-controls';
import {DataTable,type DataColumn} from '@/components/data-table';
import {CoverageBadge} from '@/components/metrics';
import {EmptyState} from '@/components/empty-state';
import {PartyLogo} from '@/components/party-logo';
import {cn} from '@/lib/utils';

export const dynamic='force-dynamic';
type Params=Record<string,string|string[]|undefined>;
const scalar=(value:string|string[]|undefined)=>typeof value==='string'?value:undefined;
const dimensions:{id:RankingDimension;label:string;description:string;icon:typeof ReceiptText}[]=[
  {id:'expense_desc',label:'Maiores gastos de cota',description:'Maior valor líquido identificado no ano.',icon:ReceiptText},
  {id:'expense_asc',label:'Menores gastos de cota',description:'Menor valor entre quem possui lançamento.',icon:ReceiptText},
  {id:'absences_desc',label:'Mais faltas',description:'Sessões elegíveis sem presença registrada.',icon:UserMinus},
  {id:'proposals_desc',label:'Mais propostas',description:'Proposições com autoria publicada.',icon:FileText},
  {id:'rapporteurships_desc',label:'Mais relatorias',description:'Relatorias explicitamente publicadas.',icon:BarChart3},
];
const validDimensions=new Set(dimensions.map(item=>item.id));
const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});

function href(values:Record<string,string|undefined>,overrides:Record<string,string|number|undefined>={}){const params=new URLSearchParams();for(const [key,value] of Object.entries({...values,...overrides}))if(value!==undefined&&value!=='')params.set(key,String(value));return `/legislativo/rankings?${params}`}

export default async function RankingsPage({searchParams}:{searchParams:Promise<Params>}){
  const params=await searchParams,source:Source=scalar(params.casa)==='camara'?'camara':'senado',candidate=scalar(params.dimensao) as RankingDimension|undefined,dimension=candidate&&validDimensions.has(candidate)?candidate:'expense_desc',ufValue=scalar(params.uf)?.toUpperCase(),uf=ufValue&&ufs.has(ufValue)?ufValue:undefined,party=scalar(params.partido)||undefined,requestedYear=Number(scalar(params.ano)),year=Number.isInteger(requestedYear)?requestedYear:undefined,rawPage=Number(scalar(params.pagina)??1),page=Number.isSafeInteger(rawPage)&&rawPage>0?rawPage:1;
  const result=rankings({source,dimension,page,pageSize:25,...(uf?{uf}:{}),...(party?{party}:{}),...(year?{year}:{})});
  if(result.status==='unavailable')return <><LegislativeSubnav/><main className="page-shell py-12"><EmptyState title="Rankings indisponíveis" description={result.message}/></main></>;
  const data=result.data,selected=dimensions.find(item=>item.id===dimension)!;type Item=(typeof data.items)[number];const isMoney=dimension.startsWith('expense'),metric=dimension==='absences_desc'?'Faltas':dimension==='proposals_desc'?'Propostas':dimension==='rapporteurships_desc'?'Relatorias':'Cota identificada';
  const columns:DataColumn<Item>[]=[{key:'rank',header:'Posição',align:'right',render:item=><strong>{item.rank}º</strong>},{key:'name',header:'Parlamentar',render:item=><div><Link className="font-bold text-primary underline" href={`/parlamentares/${source}/${item.externalId}`}>{item.profile.name}</Link><small className="mt-1 flex items-center gap-1.5 text-muted-foreground"><PartyLogo party={item.profile.party} size={20}/>{item.profile.party}/{item.profile.uf}</small></div>},{key:'value',header:metric,align:'right',render:item=><strong>{isMoney?money.format(item.value/100):item.value.toLocaleString('pt-BR')}</strong>}];
  const values={casa:source,dimensao:dimension,uf,partido:party,ano:data.year?String(data.year):undefined};
  return <><LegislativeSubnav/><main id="conteudo" tabIndex={-1}><div className="page-shell py-8"><InstitutionHero context="Comparação dentro da mesma Casa e cobertura" title="Rankings parlamentares" description="Navegue por gastos, faltas, autoria e relatorias. Cada lista exclui observações indisponíveis em vez de convertê-las em zero." imageUrl="/congresso.svg" location={source==='senado'?'Senado Federal':'Câmara dos Deputados'}/></div><section className="page-shell py-10"><p className="eyebrow">Escolha uma dimensão</p><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{dimensions.map(item=>{const Icon=item.icon;return <Link key={item.id} href={href(values,{dimensao:item.id,pagina:undefined})} aria-current={item.id===dimension?'page':undefined} className={cn('rounded-2xl border bg-card p-4 transition hover:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',item.id===dimension&&'border-primary ring-1 ring-primary')}><Icon size={20} className="text-primary"/><strong className="mt-3 block">{item.label}</strong><small className="mt-1 block leading-5 text-muted-foreground">{item.description}</small></Link>})}</div><div className="mt-8"><FilterBar action="/legislativo/rankings" fields={[{name:'casa',label:'Casa',value:source,options:[{value:'senado',label:'Senado Federal'},{value:'camara',label:'Câmara dos Deputados'}]},{name:'uf',label:'Estado',value:uf??'',options:[{value:'',label:'Todos'},...data.facets.ufs.map(value=>({value,label:value}))]},{name:'partido',label:'Partido',value:party??'',options:[{value:'',label:'Todos'},...data.facets.parties.map(value=>({value,label:value}))]},{name:'ano',label:'Ano',value:data.year?String(data.year):'',options:data.availableYears.length?data.availableYears.map(value=>({value:String(value),label:String(value)})):[{value:'',label:'Todo o lote ativo'}]}]}><input type="hidden" name="dimensao" value={dimension}/></FilterBar></div></section><section className="border-y bg-card"><div className="page-shell py-10"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">{selected.label}</p><h2 className="mt-2 text-3xl font-bold">{data.total} parlamentares no universo observado</h2><p className="mt-2 text-sm text-muted-foreground">Casa: {source==='senado'?'Senado':'Câmara'}{uf?` · ${uf}`:''}{party?` · ${party}`:''}{data.year?` · ${data.year}`:''}. Amostra n={data.coverage.sampleSize??0}.</p></div><CoverageBadge coverage={data.coverage as DataCoverage}/></div>{data.items.length?<div className="mt-6"><DataTable caption={selected.label} columns={columns} rows={data.items} rowKey={item=>`${source}:${item.externalId}`} coverage={data.coverage as DataCoverage} page={page} pageCount={Math.max(1,Math.ceil(data.total/data.pageSize))} pageHref={next=>href(values,{pagina:next>1?next:undefined})}/></div>:<div className="mt-6"><EmptyState title="Sem observações comparáveis" description={data.coverage.note}/></div>}<p className="mt-5 max-w-4xl text-sm leading-6 text-muted-foreground">{data.coverage.note} Empates são ordenados alfabeticamente. A posição é calculada depois dos filtros de Casa, UF e partido.</p></div></section></main></>;
}
