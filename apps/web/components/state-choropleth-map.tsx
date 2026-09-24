import type { ChoroplethBucket, ChoroplethItem, MetricMeta } from '@senadotracker/db';
import type { DataCoverage } from '@senadotracker/domain';
import { CoverageBadge } from '@/components/metrics';
import { mapMarkup } from '@/components/brazil-map-markup';
import { paintStateMap, type StatePaint } from '@/components/state-map-paint';
import { metricValue } from '@/lib/format';
import { darkFrom, emptyFill, rampIndex, rampTone } from '@/lib/scale';

export interface ChoroplethData{meta:MetricMeta;buckets:ChoroplethBucket[];items:ChoroplethItem[];coverage:DataCoverage}

export function StateChoroplethMap({data,names,href}:{data:ChoroplethData;names:Record<string,string>;href:(uf:string)=>string}){
  const {meta,buckets,items}=data,total=buckets.length;
  const paints=new Map(items.flatMap(item=>{
    if(item.bucket===null||item.value===null)return [];
    const index=rampIndex(item.bucket,total),text=`${names[item.uf]??item.uf}: ${metricValue(item.value,meta.unit)} · n=${item.sampleSize}`;
    return [[item.uf,{fill:rampTone(item.bucket,total),...(index>=darkFrom?{ink:'#fff'}:{}),href:href(item.uf),title:text,ariaLabel:`${metricValue(item.value,meta.unit)}, mediana de ${item.sampleSize} observações`} satisfies StatePaint]];
  }));
  const markup=paintStateMap(mapMarkup,paints,{variant:'metric-map',description:`Cada unidade federativa recebe o tom do seu quintil na mediana de ${meta.label.toLocaleLowerCase('pt-BR')}. Unidades sem universo suficiente ficam em cinza.`,emptyFill,href});
  const missing=items.filter(item=>item.bucket===null);
  return <figure className="min-w-0 rounded-3xl border bg-card p-4 shadow-sm sm:p-6">
    <figcaption className="flex flex-wrap items-center justify-between gap-2 font-bold">{meta.label} · mediana por estado<CoverageBadge coverage={data.coverage}/></figcaption>
    <div className="mx-auto mt-4 max-w-[620px]" dangerouslySetInnerHTML={{__html:markup}}/>
    <ul className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
      {buckets.map(bucket=><li className="flex items-center gap-2" key={bucket.index}><i className="size-3 rounded-sm" style={{background:rampTone(bucket.index,total)}}/>{metricValue(bucket.from,meta.unit)} a {metricValue(bucket.to,meta.unit)} · {bucket.count} UF{bucket.count===1?'':'s'}</li>)}
      {missing.length>0&&<li className="flex items-center gap-2"><i className="size-3 rounded-sm" style={{background:emptyFill}}/>Sem universo suficiente · {missing.length} UF{missing.length===1?'':'s'}</li>}
    </ul>
    <p className="mt-4 text-center text-sm text-muted-foreground">{data.coverage.note} Cinza não significa valor baixo: significa ausência de universo compatível. Geometria licenciada em <a className="underline" href="/licenses/mapa-brasil-svg.txt">MIT</a>.</p>
    <details className="mt-4 text-sm"><summary className="focus-ring w-fit cursor-pointer font-bold text-primary">Ver dados do mapa</summary><div className="mt-3 overflow-x-auto"><table className="w-full text-left"><caption className="sr-only">Mediana de {meta.label} por unidade federativa</caption><thead><tr className="border-b"><th className="p-2">UF</th><th className="p-2 text-right">Mediana</th><th className="p-2 text-right">Observações</th></tr></thead><tbody>{items.map(item=><tr className="border-b" key={item.uf}><th className="p-2 font-normal">{names[item.uf]??item.uf} ({item.uf})</th><td className="p-2 text-right tabular-nums">{item.value===null?'Omitida':metricValue(item.value,meta.unit)}</td><td className="p-2 text-right tabular-nums">{item.sampleSize}</td></tr>)}</tbody></table></div></details>
  </figure>;
}
