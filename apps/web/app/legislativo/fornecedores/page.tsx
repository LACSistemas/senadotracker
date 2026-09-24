import type { ComponentType, ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, Building2, Network, Search, Store, Users, Wallet } from 'lucide-react';
import { congressSupplierOverview } from '@/lib/data';
import { LegislativeSubnav } from '@/components/legislative-subnav';
import { EmptyState } from '@/components/empty-state';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const dynamic='force-dynamic';
type Params=Record<string,string|string[]|undefined>;
type Lens='tudo'|'parlamentar'|'institucional';
const scalar=(v:string|string[]|undefined)=>typeof v==='string'?v:undefined;
const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const pct=(value:number|null)=>value===null?'—':`${(value*100).toFixed(1)}%`;
const months=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const categoryPalette=['bg-chart-1','bg-chart-2','bg-chart-3','bg-chart-4'];
const CAMARA_COLOR='#08783e', SENADO_COLOR='#1554a2';

export default async function CongressSuppliersHub({searchParams}:{searchParams:Promise<Params>}){
  const p=await searchParams;
  const yearInput=Number(scalar(p.ano)??new Date().getFullYear()), year=Number.isInteger(yearInput)?yearInput:new Date().getFullYear();
  const house=scalar(p.casa)==='CAMARA'||scalar(p.casa)==='SENADO'?(scalar(p.casa) as 'CAMARA'|'SENADO'):'all';
  const order=scalar(p.ordem)==='asc'?'asc':'desc';
  const lensValue=scalar(p.lente), lens:Lens=lensValue==='parlamentar'||lensValue==='institucional'?lensValue:'tudo';
  const result=congressSupplierOverview({year,house});
  if(result.status==='unavailable')return <><LegislativeSubnav/><main className="page-shell py-12">{result.message}</main></>;
  const data=result.data;
  const houseLabel=house==='all'?'Senado e Câmara':house==='CAMARA'?'Câmara dos Deputados':'Senado Federal';

  const dimensionValue=(row:{parliamentary:number;institutional:number;total:number})=>lens==='parlamentar'?row.parliamentary:lens==='institucional'?row.institutional:row.total;
  const lensTotalCents=lens==='parlamentar'?data.parliamentaryCents:lens==='institucional'?data.institutionalCents:data.totalObservedCents;
  const lensSuppliers=lens==='parlamentar'?data.suppliersParliamentary:lens==='institucional'?data.suppliersInstitutional:data.suppliersLinked;
  const lensTopSupplier=lens==='parlamentar'?data.topSupplierParliamentary:lens==='institucional'?data.topSupplierInstitutional:data.topSupplier;
  const lensTopFiveCents=lens==='parlamentar'?data.topFiveParliamentaryCents:lens==='institucional'?data.topFiveInstitutionalCents:data.topFiveCents;
  const lensTopFiveShare=lens==='parlamentar'?data.topFiveParliamentaryShare:lens==='institucional'?data.topFiveInstitutionalShare:data.topFiveShare;

  const totalLabel=lens==='parlamentar'?'Total líquido parlamentar observado':lens==='institucional'?'Total institucional efetivamente pago':'Total observado ligado ao Congresso';
  const totalComparison=lens==='parlamentar'?'despesas líquidas de gabinete (CEAP/CEAPS)':lens==='institucional'?'pagamentos institucionais comprovados':'institucional + despesas parlamentares';
  const suppliersLabel=lens==='parlamentar'?'Fornecedores pagos pelos gabinetes':lens==='institucional'?'Fornecedores pagos institucionalmente':'Fornecedores ligados ao Congresso';
  const topSupplierLabel=lens==='tudo'?'Maior fornecedor do Congresso':'Maior fornecedor';
  const noteBase=lens==='parlamentar'?'Despesas líquidas de gabinete (cota parlamentar), com estornos já descontados.':lens==='institucional'?'Pagamentos institucionais comprovados por movimentos financeiros publicados; contrato, empenho e liquidação são dimensões separadas.':'Soma de duas dimensões observadas — institucional (pago) e parlamentar (líquido) — sem reconciliação nem deduplicação por valor entre elas.';
  const coverageNote=`${noteBase} Cobertura observada: ${lensSuppliers.toLocaleString('pt-BR')} fornecedor(es) em ${houseLabel}; ausência de fornecedor não significa ausência de contratação ou de gasto.`;

  const houseTotal=(institution:'CAMARA'|'SENADO')=>{const row=data.houseBreakdown.find(item=>item.institution===institution);const value=row?dimensionValue(row):0;return{value,share:lensTotalCents?value/lensTotalCents:null}};
  const houseRows=(['CAMARA','SENADO'] as const).map(institution=>({institution,...houseTotal(institution)})).sort((a,b)=>order==='asc'?a.value-b.value:b.value-a.value);

  const monthKeys=[...new Set(data.monthly.map(row=>row.month))].sort((a,b)=>a-b);
  const monthlyRows=monthKeys.map(month=>{
    const camara=data.monthly.find(row=>row.institution==='CAMARA'&&row.month===month), senado=data.monthly.find(row=>row.institution==='SENADO'&&row.month===month);
    return{month,camaraValue:camara?dimensionValue(camara):0,senadoValue:senado?dimensionValue(senado):0};
  });

  const categoryLimit=6;
  const topCategories=data.categories.slice(0,categoryLimit).map(row=>({label:row.category,valueCents:row.value}));
  const shownCents=topCategories.reduce((sum,row)=>sum+row.valueCents,0);
  const othersCents=Math.max(0,data.parliamentaryCents-shownCents);
  const categoryRows=othersCents>0?[...topCategories,{label:'Outros',valueCents:othersCents}]:topCategories;

  const withParams=(overrides:Record<string,string|number|undefined>)=>{const merged:Record<string,string|number|undefined>={casa:house==='all'?undefined:house,ano:data.year,ordem:order==='asc'?'asc':undefined,lente:lens==='tudo'?undefined:lens,...overrides};const query=new URLSearchParams();for(const [key,value] of Object.entries(merged))if(value!==undefined&&value!=='')query.set(key,String(value));return `/legislativo/fornecedores?${query}`};

  return <><LegislativeSubnav/><main id="conteudo" tabIndex={-1} className="page-shell py-8">

  <header className="rounded-3xl border bg-card p-7 shadow-sm lg:p-10"><div className="grid gap-8 lg:grid-cols-[1fr_.55fr] lg:items-center"><div><p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Contratações e pagamentos · Congresso Nacional</p><h1 className="mt-3 max-w-2xl text-4xl font-black tracking-tight">Fornecedores do Congresso</h1><p className="mt-4 max-w-xl text-lg leading-8 text-muted-foreground">Veja quem recebe recursos públicos do Senado e da Câmara — em contratos institucionais e em despesas dos gabinetes.</p><form action="/legislativo/fornecedores/explorar" className="mt-7 flex max-w-xl gap-3"><Input name="busca" placeholder="Buscar fornecedor, CNPJ ou nome"/><Button><Search size={16}/>Buscar</Button></form><p className="mt-3 text-xs text-muted-foreground">Congresso Nacional · Brasília · DF</p></div><div className="hidden rounded-3xl bg-primary/5 p-8 lg:block"><Building2 className="text-primary" size={48}/><p className="mt-5 text-xl font-black">Dois universos, um só lugar</p><p className="mt-2 text-sm leading-6 text-muted-foreground">Contratos institucionais e despesas de gabinete têm regras contábeis diferentes; aqui você vê as duas, sem confundir uma com a outra.</p></div></div></header>

  <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{data.year} · {houseLabel}</p><form className="flex flex-wrap gap-2"><select name="casa" defaultValue={house} className="rounded-full border bg-background px-4 py-2 text-sm"><option value="all">Duas Casas</option><option value="CAMARA">Câmara</option><option value="SENADO">Senado</option></select><input name="ano" defaultValue={data.year} className="w-20 rounded-full border bg-background px-3 py-2 text-sm"/><select name="ordem" defaultValue={order} className="rounded-full border bg-background px-4 py-2 text-sm"><option value="desc">Maior pagamento</option><option value="asc">Menor pagamento</option></select><select name="lente" defaultValue={lens} className="rounded-full border bg-background px-4 py-2 text-sm"><option value="tudo">Tudo</option><option value="parlamentar">Parlamentar</option><option value="institucional">Institucional</option></select><button className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Aplicar</button></form></div>

  {lens==='tudo'&&<p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs leading-5 text-amber-950">Somamos duas dimensões observadas do dinheiro público — contratos institucionais das Casas e despesas dos gabinetes. São universos com regras contábeis diferentes; a soma mostra o valor total ligado ao Congresso, não um gasto único consolidado.</p>}

  <section className="mt-6">
    <SectionHeading n={1} title="Visão geral dos pagamentos a fornecedores" subtitle={`Principais números dos pagamentos a fornecedores observados no Senado Federal e na Câmara dos Deputados em ${data.year}.`}/>
    <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-[1fr_1fr_1.3fr_1fr] lg:gap-3">
      <HubKpi label={totalLabel} value={money.format(lensTotalCents/100)} detail={totalComparison} icon={Wallet}/>
      <HubKpi label={suppliersLabel} value={lensSuppliers.toLocaleString('pt-BR')} detail="com pagamento identificado no recorte" icon={Users}/>
      <HubKpi label={topSupplierLabel} value={lensTopSupplier?lensTopSupplier.name:'—'} valueTitle={lensTopSupplier?.name} detail={lensTopSupplier?money.format(dimensionValue(lensTopSupplier)/100):undefined} icon={Building2} nameStyle/>
      <HubKpi label="Top 5 fornecedores" value={pct(lensTopFiveShare)} detail={money.format(lensTopFiveCents/100)} icon={Store}/>
    </div>
    <p className="mt-2.5 text-[11px] leading-snug text-muted-foreground">{coverageNote}</p>
  </section>

  <section className="mt-6 rounded-lg border border-border/70 bg-card p-5">
    <SectionHeading n={2} title="Como os pagamentos se distribuem" subtitle="Distribuição dos valores pagos a fornecedores, segundo as classificações disponíveis de despesa."/>

    {lens==='tudo'&&<div className="mt-4 space-y-2 border-b border-border/60 pb-4">
      <SummaryRow label="Despesas parlamentares (gabinetes)" valueCents={data.parliamentaryCents} share={data.totalObservedCents?data.parliamentaryCents/data.totalObservedCents:null} colorClass="bg-chart-1"/>
      <SummaryRow label="Contratos institucionais" valueCents={data.institutionalCents} share={data.totalObservedCents?data.institutionalCents/data.totalObservedCents:null} colorClass="bg-chart-2"/>
    </div>}

    {lens==='institucional'
      ? <div className="mt-4"><EmptyState title="Categorias institucionais indisponíveis" description="As categorias institucionais dependem de uma classificação orçamentária oficial (natureza/elemento de despesa) que ainda não é publicada com granularidade suficiente na fonte. Quando disponível, seguirá a classificação contábil oficial — não equivalente às categorias de despesa parlamentar."/></div>
      : <div className="mt-4">
          {lens==='tudo'&&<p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Categorias · parcela parlamentar</p>}
          <div className="space-y-1.5">
            {categoryRows.map((row,index)=><CategoryRow key={row.label} label={row.label} valueCents={row.valueCents} totalCents={data.parliamentaryCents} colorClass={row.label==='Outros'?'bg-muted-foreground/40':categoryPalette[index%categoryPalette.length]!}/>)}
          </div>
          {lens==='tudo'&&<p className="mt-3 text-[11px] text-muted-foreground">A parcela institucional ainda não tem abertura por categoria.</p>}
        </div>}

    <p className="mt-4 border-t border-border/60 pt-3 text-[11px] leading-snug text-muted-foreground">As categorias institucionais seguem classificações contábeis oficiais e não são diretamente equivalentes às categorias de despesa parlamentar.</p>
  </section>

  <section className="mt-6 rounded-lg border border-border/70 bg-card p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <SectionHeading n={3} title="Câmara x Senado ao longo do tempo" subtitle="Pagamentos a fornecedores por mês, separados por Casa, no ano selecionado."/>
      {data.years.length>1&&<div className="flex flex-wrap gap-1 pt-0.5" role="group" aria-label="Selecionar ano">{data.years.map(y=><Link key={y} href={withParams({ano:y})} aria-current={y===data.year?'page':undefined} className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold transition',y===data.year?'border-primary bg-primary text-primary-foreground':'text-muted-foreground hover:border-primary hover:text-primary')}>{y}</Link>)}</div>}
    </div>

    <div className="mt-4"><MonthlyStackedChart rows={monthlyRows} year={data.year}/></div>

    <div className="mt-4 grid gap-2.5 sm:grid-cols-2">{houseRows.map(row=><div key={row.institution} className="rounded-md border border-border/70 bg-muted/20 px-4 py-3"><span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Total pago pel{row.institution==='CAMARA'?'a Câmara':'o Senado'}</span><strong className="mt-1 block text-lg font-bold leading-tight">{money.format(row.value/100)}</strong><small className="text-[11px] text-muted-foreground">{pct(row.share)} do total observado</small></div>)}</div>

    <p className="mt-3 text-[11px] leading-snug text-muted-foreground">Meses sem observação permanecem ausentes, nunca zerados.</p>
  </section>

  <section className="mt-8 grid gap-6 lg:grid-cols-2">
    <Link href="/legislativo/fornecedores-parlamentares" className="group flex flex-col justify-between rounded-3xl border bg-primary/5 p-7 transition hover:border-primary"><div><Network className="text-primary" size={32}/><h2 className="mt-4 text-2xl font-black">Com quem seus parlamentares estão gastando?</h2><p className="mt-2 leading-7 text-muted-foreground">Cada gabinete move uma verba pública. Veja o mercado que vive dela — quem recebe, quanto, de quantos parlamentares.</p></div><span className="mt-6 inline-flex items-center gap-2 font-bold text-primary">Explorar o mercado dos gabinetes <ArrowRight size={16} className="transition group-hover:translate-x-1"/></span></Link>
    <Link href="/legislativo/fornecedores/explorar" className="group flex flex-col justify-between rounded-3xl border bg-primary/5 p-7 transition hover:border-primary"><div><Search className="text-primary" size={32}/><h2 className="mt-4 text-2xl font-black">Explore todos os fornecedores do Congresso</h2><p className="mt-2 leading-7 text-muted-foreground">Busque por empresa, CNPJ ou categoria e siga o dinheiro em contratos e despesas — em um só lugar.</p></div><span className="mt-6 inline-flex items-center gap-2 font-bold text-primary">Abrir a base completa <ArrowRight size={16} className="transition group-hover:translate-x-1"/></span></Link>
  </section>

  </main></>;
}

function SectionHeading({n,title,subtitle}:{n:number;title:string;subtitle:string}){
  return <div><div className="flex items-center gap-2"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">{n}</span><h2 className="text-base font-bold tracking-tight">{title}</h2></div><p className="mt-1 text-xs text-muted-foreground">{subtitle}</p></div>;
}

function HubKpi({label,value,detail,icon:Icon,valueTitle,nameStyle}:{label:string;value:ReactNode;detail?:ReactNode;icon:ComponentType<{size?:number}>;valueTitle?:string|undefined;nameStyle?:boolean}){
  return <div className="flex min-h-[112px] flex-col justify-between rounded-md border border-border/70 bg-card p-3.5 sm:p-4">
    <div className="flex items-start justify-between gap-2">
      <span className="text-[12.5px] font-semibold leading-snug text-muted-foreground line-clamp-2">{label}</span>
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-700"><Icon size={16}/></span>
    </div>
    <div className="min-w-0">
      <strong title={valueTitle} className={cn('block font-bold leading-tight tracking-tight',nameStyle?'line-clamp-2 text-[17px] sm:text-[19px]':'truncate text-[22px] sm:text-[24px]')}>{value}</strong>
      {detail&&<p className="mt-1 truncate text-[11px] text-muted-foreground" title={typeof detail==='string'?detail:undefined}>{detail}</p>}
    </div>
  </div>;
}

function SummaryRow({label,valueCents,share,colorClass}:{label:string;valueCents:number;share:number|null;colorClass:string}){
  return <div className="flex items-center gap-3"><span className={cn('size-2 shrink-0 rounded-full',colorClass)}/><span className="w-44 shrink-0 truncate text-sm font-medium">{label}</span><div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full',colorClass)} style={{width:`${share===null?0:Math.min(100,share*100)}%`}}/></div><strong className="w-24 shrink-0 text-right text-sm tabular-nums">{money.format(valueCents/100)}</strong><span className="w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{pct(share)}</span></div>;
}

function CategoryRow({label,valueCents,totalCents,colorClass}:{label:string;valueCents:number;totalCents:number;colorClass:string}){
  const share=totalCents?valueCents/totalCents:null;
  return <div className="flex items-center gap-3" title={label}><span className={cn('size-2 shrink-0 rounded-full',colorClass)}/><span className="w-32 shrink-0 truncate text-sm sm:w-44">{label}</span><div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full',colorClass)} style={{width:`${share===null?0:Math.min(100,share*100)}%`}}/></div><strong className="w-20 shrink-0 text-right text-sm tabular-nums sm:w-24">{money.format(valueCents/100)}</strong><span className="w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{pct(share)}</span></div>;
}

function MonthlyStackedChart({rows,year}:{rows:{month:number;camaraValue:number;senadoValue:number}[];year:number}){
  if(!rows.length)return <p className="text-sm text-muted-foreground">Sem observação mensal publicada neste recorte.</p>;
  const max=Math.max(...rows.map(row=>row.camaraValue+row.senadoValue),1);
  return <div>
    <div className="mb-3 flex flex-wrap gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm" style={{background:CAMARA_COLOR}}/>Câmara</span><span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm" style={{background:SENADO_COLOR}}/>Senado</span></div>
    <div className="flex h-40 items-end gap-1.5 border-b border-border/70 sm:gap-2.5" role="img" aria-label={`Pagamentos mensais a fornecedores em ${year}, por Casa`}>
      {rows.map(row=>{const total=row.camaraValue+row.senadoValue;return <div key={row.month} className="flex h-full min-w-0 flex-1 flex-col justify-end text-center" title={`${months[row.month-1]}/${year} · Câmara: ${money.format(row.camaraValue/100)} · Senado: ${money.format(row.senadoValue/100)}`}>
        <div className="flex w-full flex-col-reverse overflow-hidden rounded-t-sm" style={{height:`${100*total/max}%`}}>
          {row.camaraValue>0&&<div style={{background:CAMARA_COLOR,height:`${total?100*row.camaraValue/total:0}%`}}><span className="sr-only">Câmara: {money.format(row.camaraValue/100)}</span></div>}
          {row.senadoValue>0&&<div style={{background:SENADO_COLOR,height:`${total?100*row.senadoValue/total:0}%`}}><span className="sr-only">Senado: {money.format(row.senadoValue/100)}</span></div>}
        </div>
        <span className="mt-1.5 truncate text-[11px] text-muted-foreground">{months[row.month-1]}</span>
      </div>})}
    </div>
    <details className="mt-3 text-xs"><summary className="focus-ring w-fit cursor-pointer font-bold text-primary">Ver valores por mês</summary><div className="mt-2 overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b"><th className="p-1.5">Mês</th><th className="p-1.5 text-right">Câmara</th><th className="p-1.5 text-right">Senado</th><th className="p-1.5 text-right">Total</th></tr></thead><tbody>{rows.map(row=><tr className="border-b" key={row.month}><th className="p-1.5 font-normal">{months[row.month-1]}/{year}</th><td className="p-1.5 text-right tabular-nums">{money.format(row.camaraValue/100)}</td><td className="p-1.5 text-right tabular-nums">{money.format(row.senadoValue/100)}</td><td className="p-1.5 text-right font-bold tabular-nums">{money.format((row.camaraValue+row.senadoValue)/100)}</td></tr>)}</tbody></table></div></details>
  </div>;
}
