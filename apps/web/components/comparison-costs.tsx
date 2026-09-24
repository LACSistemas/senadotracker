import type {publishedPersonComparisonDashboard} from '@senadotracker/db';
import {BarChart} from '@/components/charts';
import {BenchmarkRuler} from '@/components/benchmark-ruler';
import {CoverageBadge} from '@/components/metrics';

type Dashboard=ReturnType<typeof publishedPersonComparisonDashboard>;
const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const number=new Intl.NumberFormat('pt-BR');
const reais=(cents:number|null)=>cents===null?'Indisponível':currency.format(cents/100);

export function ComparisonCosts({data,palette}:{data:Dashboard;palette:string[]}){
  const names=new Map(data.people.map(item=>[item.profile.externalId,item.profile.name]));
  // Régua só no painel da cota: `benchmarks.expenses` é a distribuição de cota da Casa inteira, mesmo
  // universo de `expenses[].totalCents`. O custo total ao lado tem outra proveniência e fica sem régua.
  const quota=data.benchmarks.expenses,universeLabel=data.source==='senado'?'senadores':'deputados';
  const ruler=(totalCents:number|null)=>({value:totalCents,unit:'cents' as const,direction:'higher-is-worse' as const,median:quota.median,p10:quota.p10,p90:quota.p90,percentile:null,sampleSize:quota.count,availability:data.coverage.expenses.availability,universeLabel,note:`cota anual de ${data.year}`});
  return <section className="grid min-w-0 gap-6 xl:grid-cols-2" aria-label="Comparação dos gastos parlamentares">
    <div className="min-w-0 space-y-3">
      <BarChart title={`Gasto parlamentar total · R$ · ${data.year}`} data={data.costs.map((item,index)=>({label:names.get(item.externalId)??item.externalId,value:item.totalCents===null?null:item.totalCents/100,color:palette[index]??'#115b45'}))} coverage={data.coverage.costs}/>
      <p className="text-xs leading-5 text-muted-foreground">{data.coverage.costs.note}</p>
      <div className="grid gap-2 sm:grid-cols-2">{data.costs.map((item,index)=><dl key={item.externalId} className="rounded-xl border border-l-4 bg-card p-3 text-xs" style={{borderLeftColor:palette[index]}}><dt className="font-bold">{names.get(item.externalId)}</dt><dd className="mt-2">Cota: {reais(item.expenseCents)} · {item.expensePeriod}</dd><dd>Gabinete: {reais(item.cabinetCents)} · {item.cabinetPeriod}</dd><dd>Subsídio normativo: {reais(item.subsidyCents)} · {item.subsidyPeriod}</dd>{!item.comparable&&<dd className="mt-2 font-medium text-amber-800">Parcelas com períodos diferentes</dd>}</dl>)}</div>
    </div>
    <figure className="min-w-0 rounded-2xl border bg-card p-5"><figcaption className="flex flex-wrap items-center justify-between gap-2 font-bold">Composição dos gastos<CoverageBadge coverage={data.coverage.expenses}/></figcaption><p className="mt-2 text-xs leading-5 text-muted-foreground">Lançamentos da cota parlamentar em {data.year}; este recorte pode ser mais amplo que o período comum do custo total. Gabinete e subsídio não entram nas categorias.</p>
      <div className="mt-5 grid gap-3">{data.expenses.map((item,index)=><article key={item.externalId} className="min-w-0 rounded-xl border border-l-4 p-4" style={{borderLeftColor:palette[index]}}><h3 className="font-bold">{names.get(item.externalId)}</h3>{item.totalCents===null?<p className="mt-3 text-sm text-muted-foreground">Nenhum lote de despesa vinculado neste ano.</p>:<><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3"><div><dt className="text-xs text-muted-foreground">Cota identificada</dt><dd className="mt-1 font-bold tabular-nums">{reais(item.totalCents)}</dd></div><div><dt className="text-xs text-muted-foreground">Registros de despesa</dt><dd className="mt-1 font-bold tabular-nums">{number.format(item.recordCount)}</dd></div><div className="min-w-0"><dt className="text-xs text-muted-foreground">Maior categoria da cota</dt><dd className="mt-1 truncate font-bold" title={item.largestCategory?.label}>{item.largestCategory?.label??'Indisponível'}</dd></div><div><dt className="text-xs text-muted-foreground">Valor da maior categoria</dt><dd className="mt-1 font-bold tabular-nums">{reais(item.largestCategory?.valueCents??null)}</dd></div></dl><BenchmarkRuler benchmark={ruler(item.totalCents)}/></>}</article>)}</div>
      {data.expenses.some(item=>item.categories.length>0)&&<details className="mt-5 text-sm"><summary className="focus-ring w-fit cursor-pointer font-bold text-primary">Ver dados do gráfico</summary><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[520px] text-left"><caption className="sr-only">Categorias da cota parlamentar por pessoa, com valores líquidos</caption><thead><tr className="border-b"><th scope="col" className="p-2">Parlamentar</th><th scope="col" className="p-2">Categoria oficial</th><th scope="col" className="p-2 text-right">Valor líquido</th></tr></thead><tbody>{data.expenses.flatMap(item=>item.categories.map(category=><tr key={`${item.externalId}:${category.label}`} className="border-b align-top"><th scope="row" className="p-2 font-medium">{names.get(item.externalId)}</th><td className="max-w-md p-2">{category.label}</td><td className="whitespace-nowrap p-2 text-right tabular-nums">{reais(category.valueCents)}</td></tr>))}</tbody></table></div></details>}
    </figure>
  </section>;
}
