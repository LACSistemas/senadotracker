import Link from 'next/link';
import type {ReactNode} from 'react';
import {Download,FileText,Gem,Info,Search,UserMinus,Users} from 'lucide-react';
import {quantile,type Source} from '@senadotracker/domain';
import {houseMetrics,type DashboardQuery,type DashboardRow,type DashboardSort,type HouseMetricKey,type HouseMetricSummary} from '@senadotracker/db';
import {houseMetricSummary,rankingsDashboard} from '@/lib/data';
import {groupRankings,type GroupRow} from '@/lib/group-rankings';
import {LegislativeSubnav} from '@/components/legislative-subnav';
import {InstitutionHero} from '@/components/heroes';
import {EmptyState} from '@/components/empty-state';
import {PartyLogo} from '@/components/party-logo';
import {OfficialPortrait} from '@/components/app-image';
import {CellBar} from '@/components/cell-bar';
import {HighlightCard} from '@/components/highlight-card';
import {RankingsGroups} from '@/components/rankings-groups';
import {StickyTable,type StickyColumn} from '@/components/sticky-table';
import {TogglePills} from '@/components/toggle-pills';
import {evalTone,type EvalTone} from '@/lib/eval-color';
import {cn} from '@/lib/utils';
import {dashboardQuery,groupHouse,modeHref,parseMode,queryHref,rankingModes,type Params,type RankingMode} from './query';

export const dynamic='force-dynamic';
const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
const number=new Intl.NumberFormat('pt-BR');
const percent=new Intl.NumberFormat('pt-BR',{style:'percent',maximumFractionDigits:1});
const profile=(row:DashboardRow)=>`/legislativo/${row.source==='senado'?'senadores':'deputados'}/${row.externalId}`;
const value=(v:number|null,kind:'money'|'percent'|'number'='number')=>v===null?'—':kind==='money'?money.format(v/100):kind==='percent'?percent.format(v):number.format(v);
const modeLabels:Record<RankingMode,string>={parlamentares:'Parlamentares',partidos:'Partidos',estados:'Estados'};
// Largura das colunas fixas em px; o deslocamento de cada uma sai da MESMA fonte, senão o `left` não bate
// com o tamanho real e a coluna fixa cobre a seguinte pela metade.
const stickyWidths=[48,208,104] as const;
const person=(row:DashboardRow|null)=>row?{name:row.name,uf:row.uf,party:row.party,photoUrl:row.photoUrl,href:profile(row),source:row.source}:null;
const houseBadge=(row:DashboardRow)=><span className={`rounded-full px-2 py-1 font-semibold ${row.source==='senado'?'bg-sky-100 text-sky-900':'bg-emerald-100 text-emerald-900'}`}>{row.source==='senado'?'Senado':'Câmara'}</span>;
function SortHead({label,field,sort,href}:{label:string;field:string;sort:DashboardSort;href:(change:Partial<DashboardQuery>)=>string}){
  const next=sort===`${field}_desc`?`${field}_asc`:field==='name'?sort==='name'?'name_desc':'name':`${field}_desc`;
  return <Link className="inline-flex items-center gap-1 hover:text-emerald-700" href={href({sort:next as DashboardSort,page:1})}>{label}<span aria-hidden="true" className="text-slate-400">{sort===field||sort.startsWith(`${field}_`)?sort.endsWith('_desc')?'↓':'↑':'↕'}</span></Link>;
}

export default async function RankingsPage({searchParams}:{searchParams:Promise<Params>}){
  const params=await searchParams,mode=parseMode(typeof params.modo==='string'?params.modo:undefined),query=dashboardQuery(params),sort=query.sort??'name';
  // O modo é a única coisa que todo link precisa carregar: sem ele, ordenar, paginar ou baixar o CSV
  // devolvia o visitante a Parlamentares em silêncio.
  const href=(change:Partial<DashboardQuery>={})=>queryHref(query,mode,change);
  const shell=(meta:ReactNode,body:ReactNode)=><><LegislativeSubnav/><main id="conteudo" tabIndex={-1} className="pb-16">
    <div className="page-shell py-8"><InstitutionHero context="Dados públicos do Congresso" title="Rankings parlamentares" description="Compare parlamentares, bancadas e unidades federativas nos mesmos indicadores, com período e cobertura declarados em cada dimensão." imageUrl="/congresso.svg" location="Senado Federal e Câmara dos Deputados"/></div>
    {meta}
    <div className="page-shell pt-6"><TogglePills label="Ranking de" current={mode} pills={rankingModes.map(item=>({value:item,label:modeLabels[item],href:modeHref(query,item)}))}/></div>
    {body}
  </main></>;
  const unavailable=(message:string)=>shell(null,<div className="page-shell py-12"><EmptyState title="Rankings indisponíveis" description={message}/></div>);
  const updated=(at:string|null,year:number)=>{const date=at&&Number.isFinite(Date.parse(at))?new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(at)):null;
    return <div className="mt-6 border-y bg-white"><div className="page-shell py-3 text-right text-xs text-slate-500">{date?`Dados atualizados em ${date}.`:'Data de atualização não disponível.'} <span className="ml-2">Período de gastos: {year}.</span></div></div>};

  if(mode!=='parlamentares'){
    const result=groupRankings(mode,groupHouse(query.source),query.year);
    if(result.status==='unavailable')return unavailable(result.message);
    const data=result.data,isParty=mode==='partidos';
    // Cada grupo abre a lista de gente por trás da mediana: o clique cai no modo Parlamentares já filtrado,
    // e não numa página que atribui partido por outro critério.
    const groupHref=(row:GroupRow)=>queryHref({...query,source:data.house,uf:isParty?undefined:row.key,party:isParty?row.key:undefined,page:1},'parlamentares');
    return shell(updated(data.updatedAt??null,data.year),<div className="page-shell"><section className="mt-6 rounded-3xl border bg-white p-5 shadow-sm md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-slate-900">{isParty?'Bancadas do Congresso':'Unidades federativas'}</h2>
          <p className="mt-1 text-sm text-slate-600">Medianas por {isParty?'bancada':'UF'} dentro de uma Casa — cota de senador e de deputado não são a mesma régua, e somá-las criaria um número que não existe.</p>
        </div>
        <Link className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-800 underline" href="/metodologia"><Info size={16}/>Como os indicadores são calculados?</Link>
      </div>
      <RankingsGroups data={data} groupHref={groupHref} houseHref={source=>queryHref({...query,source},mode)}/>
      <div className="mt-6 text-right"><Link href={queryHref({...query,source:data.house},mode,{},'/legislativo/rankings/baixar')} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold hover:border-emerald-700"><Download size={16}/>Baixar dados (CSV)</Link></div>
    </section></div>);
  }

  const result=rankingsDashboard(query);
  if(result.status==='unavailable')return unavailable(result.message);
  const data=result.data,from=(data.page-1)*data.pageSize+1,to=Math.min(data.page*data.pageSize,data.total),pages=Math.max(1,Math.ceil(data.total/data.pageSize)),pageNumbers=[...new Set([1,data.page-1,data.page,data.page+1,pages].filter(x=>x>=1&&x<=pages))].sort((a,b)=>a-b);
  // Escala da Casa inteira, nunca do recorte filtrado: "cota alta para a Câmara", não "alta entre os 8
  // do Acre". Filtrar não muda barra nem cor, e o piso de amostra nunca colapsa. Cota de senador e de
  // deputado não são comparáveis, então cada Casa tem a sua — uma escala única achataria a outra.
  const houses=[...new Set(data.allItems.map(row=>row.source))];
  const scales=Object.fromEntries(houses.flatMap(house=>{const summary=houseMetricSummary(house,data.year);return summary.status==='available'?[[house,summary.data.metrics] as const]:[]})) as Partial<Record<Source,HouseMetricSummary['metrics']>>;
  const cell=(row:DashboardRow,key:HouseMetricKey)=>{
    const metric=scales[row.source]?.[key],value=row[key];
    if(!metric||typeof value!=='number')return{tone:'unknown' as EvalTone,max:0,outlier:false};
    const {distribution:d,meta,coverage}=metric;
    const tone=evalTone(value,{median:d.median,p10:d.p10,p90:d.p90,direction:meta.direction,availability:coverage.availability,sampleSize:d.count,minSample:meta.houseMinSample});
    // Outlier é o decil extremo de verdade (p5/p95), não a cauda de 10% que já colore o tom.
    const low=quantile(metric.values,.05),high=quantile(metric.values,.95);
    return{tone,max:d.max??0,outlier:tone!=='unknown'&&low!==null&&high!==null&&(value<=low||value>=high)};
  };
  // Pódio: 1º/2º/3º da MESMA métrica, onde posição significa algo. Segue a ordenação da tabela quando
  // ela é por métrica; sem ordenação, usa custo mensal — valor contínuo, sem empate no topo. Métricas
  // com muitos empates (presença bate 100% em dezenas) nunca entram aqui: 1º lugar seria arbitrário.
  const sortField=sort.replace(/_(asc|desc)$/,'');
  const sorted:HouseMetricKey|null=sortField==='cost'?'totalCostCents':sortField==='proposals'?'proposals':sortField==='staff'?'staff':null;
  const podiumKey=sorted??'monthlyCostCents',podiumMeta=houseMetrics[podiumKey],ascending=Boolean(sorted)&&sort.endsWith('_asc');
  const podium=[...data.allItems].filter(row=>typeof row[podiumKey]==='number')
    .sort((a,b)=>((a[podiumKey] as number)-(b[podiumKey] as number))*(ascending?1:-1)).slice(0,3);
  const podiumFormat=podiumMeta.unit==='cents'?'money':podiumMeta.unit==='ratio'?'percent':'number';
  const sortable=(label:string,field:string)=>({header:<SortHead label={label} field={field} sort={sort} href={href}/>});
  // Coluna numérica: barra atrás do número, tom da Casa, e filete lateral quando o valor é outlier.
  const metricColumn=(key:HouseMetricKey,label:string,format:'money'|'percent'|'number',extra:Partial<StickyColumn<DashboardRow>>={}):StickyColumn<DashboardRow>=>({key,label,...extra,
    render:row=>{const {tone,max,outlier}=cell(row,key),raw=row[key] as number|null;
      return <CellBar value={raw} max={max} tone={tone} className={cn(outlier&&'border-l-2 pl-2 font-bold')}>{value(raw,format)}</CellBar>}});
  const columns:StickyColumn<DashboardRow>[]=[
    {key:'rank',label:'#',sticky:0,render:(_row,index)=><span className="text-slate-500">{(data.page-1)*data.pageSize+index+1}</span>},
    {key:'name',label:'Nome',sticky:1,...sortable('Nome','name'),render:row=><Link href={profile(row)} className="flex items-center gap-2 font-semibold text-slate-900 hover:underline"><span className="relative size-8 shrink-0 overflow-hidden rounded-full bg-muted"><OfficialPortrait src={row.photoUrl} name={row.name} sizes="32px"/></span><span className="truncate">{row.name}</span></Link>},
    {key:'party',label:'Partido',sticky:2,render:row=><span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1"><PartyLogo party={row.party} size={16}/>{row.party}</span>},
    // `Cargo` saiu: repetia `Casa` ("Senador(a)" ↔ Senado) e era a primeira a ser comprimida ao lado das
    // três colunas fixas. O CSV segue exportando o campo, porque lá não há disputa de largura.
    {key:'house',label:'Casa',render:houseBadge},
    {key:'uf',label:'UF',render:row=>row.uf},
    {key:'situation',label:'Situação',render:row=>row.situation},
    metricColumn('participation','Participação nominal','percent',sortable('Participação nominal','participation')),
    metricColumn('proposals','Proposições','number',sortable('Proposições','proposals')),
    metricColumn('rapporteurships','Relatorias','number'),
    metricColumn('totalCostCents','Gasto total','money',sortable('Gasto total','cost')),
    metricColumn('monthlyCostCents','Gasto mensal','money',{title:row=>row.costMonths?`${row.costMonths} competências identificadas`:undefined}),
    metricColumn('staff','Gabinete','number',sortable('Gabinete','staff')),
    {key:'assets',label:'Patrimônio declarado',title:row=>row.assetYear?`Pleito de ${row.assetYear}`:undefined,render:row=><>{value(row.assetsCents,'money')}{row.assetYear?<small className="block text-slate-500">{row.assetYear}</small>:null}</>},
    {key:'mandates',label:'Mandatos',render:row=>value(row.mandates)},
    {key:'link',label:'Perfil',render:row=><Link className="whitespace-nowrap font-semibold text-emerald-800 hover:underline" href={profile(row)}>Ver perfil →</Link>},
  ];
  return shell(updated(data.updatedAt??null,data.year),<div className="page-shell"><form action="/legislativo/rankings" className="grid gap-3 py-6 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(100px,1fr))_minmax(180px,2fr)_auto] xl:items-end"><label className="text-xs font-semibold text-slate-600">Casa<select name="casa" defaultValue={query.source??''} className="mt-1 block h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"><option value="">Todas</option><option value="senado">Senado</option><option value="camara">Câmara</option></select></label><label className="text-xs font-semibold text-slate-600">Cargo<select name="cargo" defaultValue={query.role??''} className="mt-1 block h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"><option value="">Todos</option><option value="senado">Senador(a)</option><option value="camara">Deputado(a) federal</option></select></label><label className="text-xs font-semibold text-slate-600">UF<select name="uf" defaultValue={query.uf??''} className="mt-1 block h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"><option value="">Todas</option>{data.facets.ufs.map(uf=><option key={uf} value={uf}>{uf}</option>)}</select></label><label className="text-xs font-semibold text-slate-600">Partido<select name="partido" defaultValue={query.party??''} className="mt-1 block h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"><option value="">Todos</option>{data.facets.parties.map(party=><option key={party} value={party}>{party}</option>)}</select></label><label className="text-xs font-semibold text-slate-600">Buscar parlamentar<span className="relative mt-1 block"><Search size={16} className="absolute left-3 top-3.5 text-slate-400"/><input name="busca" defaultValue={query.search??''} placeholder="Nome, partido ou UF…" className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm"/></span></label><button className="h-11 rounded-xl bg-emerald-800 px-5 text-sm font-semibold text-white hover:bg-emerald-900">Aplicar filtros</button>{/* Sem estes, aplicar um filtro derrubava ordenação, ano e o próprio sujeito do ranking. */}{sort!=='name'&&<input type="hidden" name="ordem" value={sort}/>}{query.year&&<input type="hidden" name="ano" value={String(query.year)}/>}<input type="hidden" name="modo" value={mode}/></form>
  <div className="mb-4 text-right"><Link className="text-sm font-semibold text-emerald-800 underline" href="/legislativo/rankings/dimensoes">Ver rankings por dimensão: cota, faltas, propostas e relatorias →</Link></div><section className="rounded-3xl border bg-white p-5 shadow-sm md:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-bold text-slate-900">Principais indicadores do Congresso</h2><p className="mt-1 text-sm text-slate-600">Extremos observados no recorte filtrado; cada indicador tem cobertura própria.</p></div><Link className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-800 underline" href="/metodologia"><Info size={16}/>Como os indicadores são calculados?</Link></div><div className="mt-6 space-y-5">{podium.length>0&&<div><p className="text-sm font-semibold text-muted-foreground">Pódio · {podiumMeta.label.toLocaleLowerCase('pt-BR')} · {ascending?'menores':'maiores'} do recorte</p><div className="mt-3 grid gap-3 lg:grid-cols-3 lg:items-start">{podium.map((row,index)=><HighlightCard key={`${row.source}:${row.externalId}`} rank={index+1} size={index===0?'large':'small'} label={podiumMeta.label} value={value(row[podiumKey] as number|null,podiumFormat)} person={person(row)} sample={data.total} note={podiumMeta.note}/>)}</div></div>}<div><p className="text-sm font-semibold text-muted-foreground">Extremos por dimensão</p><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><HighlightCard label="Menor presença em Plenário" value={data.highlights.presence?value(data.highlights.presence.presence,'percent'):'—'} person={person(data.highlights.presence)} sample={data.coverage.presence} icon={UserMinus} note="Presença oficial; não é voto nominal."/><HighlightCard label="Maior autoria + relatorias" value={data.highlights.activity?`${value((data.highlights.activity.proposals??0)+(data.highlights.activity.rapporteurships??0))} registros`:'—'} person={person(data.highlights.activity)} sample={data.coverage.activity} icon={FileText} note="Duas contagens distintas, somadas só neste destaque."/><HighlightCard label="Maior gabinete" value={data.highlights.staff?`${value(data.highlights.staff.staff)} vínculos`:'—'} person={person(data.highlights.staff)} sample={data.coverage.staff} icon={Users} note="Vínculos no cadastro publicado."/><HighlightCard label="Maior patrimônio declarado" value={data.highlights.assets?value(data.highlights.assets.assetsCents,'money'):'—'} person={person(data.highlights.assets)} sample={data.coverage.assets} icon={Gem} note={`Declaração eleitoral${data.highlights.assets?.assetYear?` de ${data.highlights.assets.assetYear}`:''}; não é patrimônio atual.`}/></div></div></div></section>
  <section className="mt-6 rounded-3xl border bg-white p-5 shadow-sm md:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-bold text-slate-900">Todos os parlamentares</h2><p className="mt-1 text-sm text-slate-600">Veja deputados federais e senadores com os principais indicadores disponíveis.</p></div><Link href={queryHref(query,mode,{},'/legislativo/rankings/baixar')} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold hover:border-emerald-700"><Download size={16}/>Baixar dados (CSV)</Link></div><p className="mt-3 text-xs text-slate-500">Participação nominal: n={data.coverage.participation}. Custos completos: n={data.coverage.cost}. Patrimônio declarado: n={data.coverage.assets}. Travessão indica dado não comparável.</p>
  <StickyTable caption="Parlamentares filtrados e seus indicadores" columns={columns} rows={data.items} rowKey={row=>`${row.source}:${row.externalId}`} widths={stickyWidths} minWidth={1400}/>{!data.items.length?<p className="py-10 text-center text-sm text-slate-500">Nenhum parlamentar encontrado para estes filtros.</p>:null}
  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600"><span>{data.total?`Mostrando ${Math.min(from,data.total)} a ${to} de ${data.total} parlamentares`:'Nenhum parlamentar encontrado'}</span><nav aria-label="Paginação dos parlamentares" className="flex items-center gap-1"><Link aria-disabled={data.page<=1} className="rounded-lg border px-3 py-2 aria-disabled:pointer-events-none aria-disabled:opacity-40" href={href({page:data.page-1})}>‹</Link>{pageNumbers.map((page,index)=><span key={page} className="flex items-center gap-1">{index>0&&page-pageNumbers[index-1]!>1?<span className="px-1">…</span>:null}<Link aria-current={page===data.page?'page':undefined} className={`rounded-lg border px-3 py-2 ${page===data.page?'border-emerald-800 bg-emerald-800 text-white':''}`} href={href({page})}>{page}</Link></span>)}<Link aria-disabled={data.page>=pages} className="rounded-lg border px-3 py-2 aria-disabled:pointer-events-none aria-disabled:opacity-40" href={href({page:data.page+1})}>›</Link></nav></div></section></div>);
}
