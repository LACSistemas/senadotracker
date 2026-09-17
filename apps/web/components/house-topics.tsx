import type { HouseTopicDistribution } from '@senadotracker/db';
import type { Source } from '@senadotracker/domain';
import { CoverageBadge } from '@/components/metrics';

const integer=new Intl.NumberFormat('pt-BR');
const percent=new Intl.NumberFormat('pt-BR',{style:'percent',maximumFractionDigits:1});
const tones=['bg-[#1554a2]','bg-[#08783e]','bg-[#8b5cf6]','bg-[#e07819]','bg-[#c43d4d]','bg-[#64748b]','bg-[#b8c2cc]'];

export function HouseTopics({source,data}:{source:Source;data:HouseTopicDistribution}){
  return <section className="mt-8 rounded-3xl border bg-card p-6 shadow-sm lg:p-8">
    <div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/10 text-lg font-black text-primary ring-1 ring-primary/20">3</span><div><h2 className="text-2xl font-black tracking-tight">Sobre o que {source==='senado'?'o Senado':'a Câmara'} legisla?</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Distribuição das proposições apresentadas em {data.year} pelos temas oficiais publicados.</p></div></div>
    {data.total===0?<div className="mt-7 rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Ainda não há proposições classificáveis neste período.</div>:<>
      <div className="mt-7 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl bg-primary p-5 text-primary-foreground"><p className="text-sm font-bold">Proposições no período</p><strong className="mt-2 block text-3xl">{integer.format(data.total)}</strong><small className="mt-2 block opacity-80">01/01/{data.year} até a data publicada mais recente</small></div><div className="rounded-2xl border bg-background p-5"><p className="text-sm font-bold text-muted-foreground">Tema com maior participação</p><strong className="mt-2 block text-xl">{data.leading?.label??'Tema oficial indisponível'}</strong><small className="mt-2 block text-muted-foreground">{data.leading?`${integer.format(data.leading.count)} proposições · ${percent.format(data.leading.share)}`:`${integer.format(data.classified)} de ${integer.format(data.total)} proposições têm tema oficial`}</small></div></div>
      <div className="mt-6 flex h-11 overflow-hidden rounded-xl bg-muted" aria-label="Distribuição temática das proposições">{data.items.map((item,index)=><span key={item.label} className={tones[index%tones.length]} style={{width:`${item.share*100}%`}} title={`${item.label} | ${integer.format(item.count)} proposições | ${percent.format(item.share)}`} aria-label={`${item.label}: ${integer.format(item.count)} proposições, ${percent.format(item.share)}`}/>)}</div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.items.map((item,index)=><div key={item.label} className="flex items-start gap-3 rounded-xl border bg-background p-4"><span className={`mt-1 size-3 shrink-0 rounded-full ${tones[index%tones.length]}`}/><div><strong className="block text-sm">{item.label}</strong><small className="mt-1 block text-muted-foreground">{integer.format(item.count)} proposições · {percent.format(item.share)}</small></div></div>)}</div>
    </>}
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><span>Universo: proposições apresentadas em {data.year}; cada proposição entra uma vez na distribuição.</span><CoverageBadge coverage={data.coverage}/></div>
  </section>;
}
