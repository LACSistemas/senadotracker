import type { HouseTopicDistribution } from '@senadotracker/db';
import type { Source } from '@senadotracker/domain';
import { CoverageBadge } from '@/components/metrics';

const integer=new Intl.NumberFormat('pt-BR');
const percent=new Intl.NumberFormat('pt-BR',{style:'percent',maximumFractionDigits:1});

export function HouseTopics({source,data}:{source:Source;data:HouseTopicDistribution}){
  const senate=source==='senado',maximum=Math.max(...data.items.map(item=>item.count),1);
  return <section className="mt-8 rounded-3xl border bg-card p-5 shadow-sm sm:p-6 lg:p-8">
    <div className="flex items-start gap-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-lg font-black text-primary ring-1 ring-primary/20 sm:size-12">3</span>
      <div><h2 className="text-2xl font-black tracking-tight">Sobre o que {senate?'o Senado':'a Câmara'} legisla?</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{senate?'Veja como as matérias apresentadas ou deliberadas no período se distribuem entre os principais temas.':`Veja como as proposições do ano legislativo ${data.year} se distribuem entre os principais temas.`}</p></div>
    </div>

    {data.total===0?<div className="mt-7 rounded-2xl bg-muted/40 p-8 text-center text-sm text-muted-foreground">Ainda não há proposições classificáveis neste período.</div>:<div className="mt-8 grid gap-8 lg:grid-cols-[minmax(240px,.72fr)_minmax(0,1.55fr)] lg:gap-10">
      <div>
        <h3 className="text-sm font-black uppercase tracking-[.12em] text-muted-foreground">Leitura rápida</h3>
        <div className="mt-3 overflow-hidden rounded-2xl bg-muted/35 ring-1 ring-border/70">
          <QuickMetric label="Total / classificadas" value={`${integer.format(data.total)} / ${integer.format(data.classified)}`} detail={`${percent.format(data.total?data.classified/data.total:0)} do universo com tema oficial`}/>
          <QuickMetric label="Tema com mais proposições" value={data.leading?.label??'Indisponível'} detail={data.leading?`${percent.format(data.leading.share)} · ${integer.format(data.leading.count)} proposições`:'Nenhum tema publicado'}/>
          <QuickMetric label="Tema com menos proposições" value={data.least?.label??'Indisponível'} detail={data.least?`${percent.format(data.least.share)} · ${integer.format(data.least.count)} proposições`:'Nenhum tema publicado'} last/>
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-2"><div><h3 className="text-lg font-black tracking-tight">Como as proposições se distribuem</h3><p className="mt-1 text-xs text-muted-foreground">Principais temas e agrupamento das demais categorias.</p></div><small className="text-xs text-muted-foreground">Barras em escala relativa ao maior grupo</small></div>
        {data.classified?<div className="mt-6 space-y-5">{data.items.map((item,index)=><div key={item.label} className="grid gap-2 sm:grid-cols-[minmax(150px,230px)_minmax(120px,1fr)_auto] sm:items-center sm:gap-4" title={`${item.label} | ${integer.format(item.count)} proposições | ${percent.format(item.share)} das classificadas`}>
          <span className="text-sm font-bold leading-5">{item.label}</span>
          <div className="h-3 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700/70"><span className="block h-full min-w-1 rounded-full bg-emerald-700 transition-[width]" style={{width:`${item.count/maximum*100}%`,opacity:Math.max(.62,.96-index*.055)}}/></div>
          <span className="whitespace-nowrap text-sm text-muted-foreground sm:min-w-32 sm:text-right"><strong className="text-base text-foreground">{percent.format(item.share)}</strong> · {integer.format(item.count)} prop.</span>
        </div>)}</div>:<p className="mt-6 rounded-2xl bg-muted/40 p-6 text-sm text-muted-foreground">A fonte ainda não publicou temas para este universo.</p>}
      </div>
    </div>}

    <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-xs leading-5 text-muted-foreground"><span>{senate?`Universo: matérias apresentadas ou deliberadas em ${data.year}.`:`Universo: proposições com ano legislativo ${data.year}; documentos acessórios sem ano próprio ficam fora.`} Matérias sem classificação publicada ficam fora da distribuição.</span><CoverageBadge coverage={data.coverage}/></footer>
  </section>;
}

function QuickMetric({label,value,detail,last=false}:{label:string;value:string;detail:string;last?:boolean}){
  return <div className={`p-4 sm:p-5 ${last?'':'border-b'}`}><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p><strong className="mt-1.5 block text-xl leading-6 tracking-tight text-foreground">{value}</strong><small className="mt-1.5 block leading-5 text-muted-foreground">{detail}</small></div>;
}
