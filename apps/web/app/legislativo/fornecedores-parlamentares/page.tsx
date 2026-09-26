import Link from 'next/link';
import { ArrowLeft, CalendarDays, Network, RefreshCw, Sparkles, TrendingUp, Users, Wallet } from 'lucide-react';
import type { DataCoverage } from '@senadotracker/domain';
import { supplierMarket } from '@/lib/data';
import { LegislativeSubnav } from '@/components/legislative-subnav';
import { KpiCard, KpiGrid } from '@/components/metrics';
import { AreaTrend, ConcentrationCurve, ReachMatrix, RankedBars } from '@/components/charts';
import { InsightStrip } from '@/components/insight-strip';
import { SupplierMarketScatter } from '@/components/supplier-market-scatter';

export const dynamic='force-dynamic';
type Params=Record<string,string|string[]|undefined>;
const scalar=(v:string|string[]|undefined)=>typeof v==='string'?v:undefined;
const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',notation:'compact',maximumFractionDigits:1});
const fullMoney=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const months=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

export default async function ParliamentarySupplierMarket({searchParams}:{searchParams:Promise<Params>}){
  const p=await searchParams,year=Number(scalar(p.ano)??new Date().getFullYear()),house:'all'|'CAMARA'|'SENADO'=scalar(p.casa)==='CAMARA'||scalar(p.casa)==='SENADO'?(scalar(p.casa) as 'CAMARA'|'SENADO'):'all',search=scalar(p.busca)?.trim()??'',category=scalar(p.categoria)?.trim()??'',result=supplierMarket({year:Number.isInteger(year)?year:new Date().getFullYear(),house,search,category,limit:1000});
  if(result.status==='unavailable')return <><LegislativeSubnav/><main className="page-shell py-12">{result.message}</main></>;
  const data=result.data;
  const houseLabel=house==='CAMARA'?'Câmara':house==='SENADO'?'Senado':'Congresso';
  const baseCoverage=(sampleSize:number,note:string):DataCoverage=>({availability:'available',source:'multiple',period:{from:`${data.year}-01-01`,to:null,grain:'year'},batchId:null,sampleSize,note});

  const c=data.concentration,buckets=[
    {label:'Maior fornecedor',value:c.topOneCents/100},
    {label:'2º a 5º',value:Math.max(0,c.topFiveCents-c.topOneCents)/100},
    {label:'6º a 20º',value:Math.max(0,c.topTwentyCents-c.topFiveCents)/100},
    {label:'Demais',value:c.remainingCents/100},
  ];
  const concentrationNote=`Os 5 maiores fornecedores concentram ${c.topFiveShare===null?'—':`${(c.topFiveShare*100).toFixed(1)}%`} do total observado; os 20 maiores, ${c.topTwentyShare===null?'—':`${(c.topTwentyShare*100).toFixed(1)}%`}.`;

  const areaData=data.monthly.map(row=>({label:`${months[Number(row.month)-1]}/${String(row.year).slice(2)}`,value:Number(row.value)/100}));
  const growthBadge=data.growth?`${data.growth.rate===null?'sem base anterior':`${data.growth.rate>=0?'+':''}${(data.growth.rate*100).toFixed(1)}%`} vs. ano anterior`:undefined;

  const topCategories=data.categories.slice(0,8),shownCents=topCategories.reduce((sum,row)=>sum+Number(row.value),0),othersCents=Math.max(0,data.totalNetCents-shownCents);
  const categoryItems=[...topCategories.map(row=>({key:String(row.category),label:String(row.category),value:Number(row.value)/100})),...(othersCents>0?[{key:'outras',label:'Outras',value:othersCents/100}]:[])];
  const supplierItems=data.points.slice(0,20).map(row=>({key:String(row.supplier_id),label:String(row.name??'Fornecedor sem nome'),value:Number(row.net)/100,href:`/legislativo/fornecedores/${row.supplier_id}`,meta:`${Number(row.parliamentarians)} parlamentares · ${Number(row.records)} lançamentos`,chip:<Link className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold text-primary" href={`/legislativo/fornecedores-parlamentares/rede?fornecedor=${row.supplier_id}&ano=${data.year}&casa=${house}`}><Network size={11}/>rede</Link>}));

  const recurrenceStats=[
    {icon:Users,label:'Compartilhados por 5+ parlamentares',value:data.sharedFive,note:'mesmo fornecedor pago por 5 ou mais parlamentares'},
    {icon:Sparkles,label:'Novos no recorte',value:data.newObserved,note:'primeiro ano observado na série coberta'},
    {icon:RefreshCw,label:'Ativos em 3+ anos',value:Number(data.recurrence.three_plus??0),note:'presentes em três ou mais anos da série'},
    {icon:CalendarDays,label:'Ativos em um ano',value:Number(data.recurrence.one_year??0),note:'observados em apenas um ano da série'},
  ];

  return <><LegislativeSubnav/><main id="conteudo" tabIndex={-1} className="page-shell py-10">

  <Link className="focus-ring inline-flex items-center gap-2 text-sm font-bold text-primary" href="/legislativo/fornecedores"><ArrowLeft size={16}/>Voltar a fornecedores</Link>

  <header className="card-elevated surface-grid rounded-3xl border bg-card p-7 lg:p-10 mt-6"><p className="eyebrow">Mercado parlamentar · {houseLabel} · {data.year}</p><h1 className="display-title mt-3 max-w-3xl text-[clamp(2.5rem,5vw,4.25rem)]">O mercado por trás dos gabinetes</h1><p className="text-balance mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">Veja como os pagamentos líquidos de cota se distribuem entre fornecedores, parlamentares, Casas e categorias. Alcance financeiro observado não é evidência de influência ou irregularidade.</p><form className="mt-7 flex flex-wrap items-end gap-3 border-t pt-5"><label className="sr-only" htmlFor="casa">Casa</label><select id="casa" name="casa" defaultValue={house} aria-label="Casa" className="focus-ring rounded-full border bg-background px-4 py-2"><option value="all">Congresso</option><option value="CAMARA">Câmara</option><option value="SENADO">Senado</option></select><label className="sr-only" htmlFor="ano">Ano</label><input id="ano" name="ano" defaultValue={data.year} aria-label="Ano" className="focus-ring w-24 rounded-full border bg-background px-4 py-2"/><label className="sr-only" htmlFor="busca">Fornecedor ou CNPJ</label><input id="busca" name="busca" defaultValue={search} placeholder="Fornecedor ou CNPJ" aria-label="Fornecedor ou CNPJ" className="focus-ring min-w-52 rounded-full border bg-background px-4 py-2"/><label className="sr-only" htmlFor="categoria">Categoria</label><input id="categoria" name="categoria" defaultValue={category} placeholder="Categoria" aria-label="Categoria" className="focus-ring min-w-52 rounded-full border bg-background px-4 py-2"/><button className="focus-ring rounded-full bg-primary px-5 py-2 font-bold text-primary-foreground transition hover:opacity-90">Aplicar</button></form></header>

  {data.feed.length>0&&<section className="mt-10"><h2 className="text-xl font-black">O que está acontecendo neste mercado?</h2><div className="mt-4"><InsightStrip items={data.feed.map(item=>({key:`${item.kind}-${item.name}`,title:item.title,supplierId:item.supplierId,name:item.name,value:item.value}))} valueFormat={value=>`${(value*100).toFixed(1)}%`}/></div><p className="mt-3 text-xs text-muted-foreground">Destaques descritivos calculados a partir dos pagamentos observados; não indicam irregularidade.</p></section>}

  <section className="mt-10"><KpiGrid className="lg:grid-cols-4"><KpiCard label="Total líquido observado" value={fullMoney.format(data.totalNetCents/100)} comparison={`${data.coverage.records.toLocaleString('pt-BR')} lançamentos`} icon={Wallet} coverage={baseCoverage(data.coverage.records,'Despesas parlamentares publicadas, líquidas de estornos.')}/><KpiCard label="Fornecedores observados" value={data.coverage.suppliers.toLocaleString('pt-BR')} comparison="com registro no recorte" icon={Users} coverage={baseCoverage(data.coverage.suppliers,'Identidades com vínculo forte publicado.')}/><KpiCard label="Parlamentares com despesas no recorte" value={data.coverage.parliamentarians.toLocaleString('pt-BR')} comparison="pessoas distintas" icon={TrendingUp} coverage={baseCoverage(data.coverage.parliamentarians,'Parlamentares distintos com pelo menos uma despesa vinculada a fornecedor.')}/><KpiCard label="Top 5 do total" value={data.topFiveShare===null?'—':`${(data.topFiveShare*100).toFixed(1)}%`} comparison={money.format(data.topFiveCents/100)} icon={Network} coverage={baseCoverage(5,'Participação descritiva dos cinco maiores valores — veja a concentração completa logo abaixo.')}/></KpiGrid></section>

  <section className="mt-14 card-elevated rounded-3xl border bg-card p-6 lg:p-7"><h2 className="text-xl font-black">Quão concentrado é este mercado?</h2><p className="mt-1 text-sm text-muted-foreground">Participação de cada faixa de fornecedores no total líquido observado, e o maior cliente de cada um dos mais dependentes.</p><div className="mt-5 grid gap-6 lg:grid-cols-[1.2fr_.8fr]"><ConcentrationCurve title="Composição do total por faixa (R$)" buckets={buckets} coverage={baseCoverage(data.coverage.suppliers,concentrationNote)} note={concentrationNote}/><div><h3 className="text-sm font-bold text-muted-foreground">Mais dependentes de um único parlamentar</h3><div className="mt-3 space-y-3">{data.highlights.length?data.highlights.map(item=><div key={item.supplierId}><div className="flex items-center justify-between gap-3 text-sm"><Link className="min-w-0 truncate font-bold text-primary underline-offset-2 hover:underline" href={`/legislativo/fornecedores/${item.supplierId}`}>{item.name}</Link><strong className="shrink-0 tabular-nums">{(item.value*100).toFixed(1)}%</strong></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{width:`${Math.min(100,item.value*100)}%`,background:'var(--map-5)'}}/></div></div>):<p className="text-sm text-muted-foreground">Sem cobertura suficiente para calcular dependência.</p>}</div></div></div></section>

  <div className="mt-14"><SupplierMarketScatter points={data.points.map(row=>({...row}))}/></div>

  <section className="mt-14"><AreaTrend title="Evolução mensal observada (R$)" data={areaData} coverage={baseCoverage(areaData.length,'Pagamentos líquidos publicados; meses sem observação permanecem ausentes, nunca zerados.')} badge={growthBadge}/></section>

  <section className="mt-10 grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
    <ReachMatrix title="Até onde chegam os fornecedores?" data={data.reachSummary.map(row=>({ufs:Number(row.ufs),parties:Number(row.parties),suppliers:Number(row.suppliers)}))} coverage={baseCoverage(data.reachSummary.length,'Distribuição observada por quantidade de UFs e partidos dos parlamentares pagadores.')}/>
    <div className="card-elevated rounded-3xl border bg-card p-6"><h2 className="text-xl font-black">Recorrência</h2><p className="mt-1 text-sm text-muted-foreground">Contagens descritivas na série histórica disponível.</p><div className="mt-5 grid grid-cols-2 gap-3">{recurrenceStats.map(stat=><div key={stat.label} className="rounded-2xl bg-secondary p-4 text-secondary-foreground"><stat.icon size={18}/><strong className="display-title mt-2 block text-3xl">{stat.value.toLocaleString('pt-BR')}</strong><span className="mt-1 block text-xs font-semibold leading-4">{stat.label}</span><small className="mt-1 block text-[11px] opacity-80">{stat.note}</small></div>)}</div></div>
  </section>

  <section className="mt-10 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
    <RankedBars title="Maiores fornecedores no recorte (R$)" items={supplierItems} coverage={baseCoverage(supplierItems.length,'Valor líquido, alcance de parlamentares e diversidade observada.')} formatValue={money.format}/>
    <div><RankedBars title="Categorias mais frequentes (R$)" items={categoryItems} coverage={baseCoverage(categoryItems.length,'Categorias originais da despesa parlamentar; não são equivalentes a categorias institucionais.')} formatValue={money.format}/><p className="mt-3 text-xs leading-5 text-muted-foreground">Abertura empresarial e novidade histórica só serão exibidas quando a cobertura permitir. Este painel usa pagamentos parlamentares observados, não contratos.</p></div>
  </section>

  <section className="mt-10 card-elevated rounded-3xl border bg-card p-6"><h2 className="text-xl font-black">Velocidade observada</h2><p className="mt-1 text-sm text-muted-foreground">Primeiro mês publicado e marcos cumulativos entre os maiores fornecedores do recorte.</p><p className="mt-2 text-xs text-muted-foreground"><span className="font-semibold" style={{color:'var(--success)'}}>Verde</span> = ganhou parlamentares desde o ano anterior · <span className="font-semibold" style={{color:'var(--danger)'}}>vermelho</span> = perdeu.</p><div className="mt-4 overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm"><thead className="bg-secondary text-secondary-foreground"><tr><th className="px-3 py-2.5 font-bold">Fornecedor</th><th className="px-3 py-2.5 font-bold">Primeiro pagamento</th><th className="px-3 py-2.5 font-bold">R$ 100 mil</th><th className="px-3 py-2.5 font-bold">R$ 500 mil</th><th className="px-3 py-2.5 text-right font-bold">Parlamentares</th></tr></thead><tbody>{data.velocity.slice(0,10).map((item,index)=><tr className={index%2?'bg-muted/25':''} key={item.supplierId}><td className="px-3 py-2.5 font-bold"><Link className="text-primary underline-offset-2 hover:underline" href={`/legislativo/fornecedores/${item.supplierId}`}>{item.name}</Link></td><td className="px-3 py-2.5 tabular-nums">{item.first??'—'}</td><td className="px-3 py-2.5 tabular-nums">{item.hundredThousand??'—'}</td><td className="px-3 py-2.5 tabular-nums">{item.fiveHundredThousand??'—'}</td><td className="px-3 py-2.5 text-right tabular-nums">{item.clients.delta===null?'—':<span style={{color:item.clients.delta>=0?'var(--success)':'var(--danger)'}}>{item.clients.current} ({item.clients.delta>=0?'+':''}{item.clients.delta})</span>}</td></tr>)}</tbody></table></div></section>

  </main></>;
}
