import type { VoteAxis } from '@senadotracker/db';
import { CoverageBadge } from '@/components/metrics';
import { PersonSwatch } from '@/components/person-swatch';
import { percent } from '@/lib/format';

interface Highlight{externalId:string;name:string;color:string}
// Geometria do gráfico: viewBox fixo como nos demais SVG do repo, com faixa central para a nuvem.
const width=720,height=150,left=24,right=width-24,baseline=96,span=right-left;
const atX=(position:number)=>left+span*(position+1)/2;
// Dispersão vertical determinística: a ordem de entrada decide a faixa, então o desenho não muda entre
// renders. Sem isso, 500 pontos empilhados numa reta viram uma linha sólida ilegível.
const atY=(index:number)=>baseline-28+((index*37)%57);

export function ComparisonVoteAxis({axis,highlights}:{axis:VoteAxis;highlights:Highlight[]}){
  const selected=new Map(highlights.map(item=>[item.externalId,item]));
  const others=axis.points.filter(point=>!selected.has(point.externalId));
  const marked=axis.points.flatMap(point=>{const item=selected.get(point.externalId);return item?[{point,color:item.color}]:[]});
  const houseLabel=axis.source==='senado'?'Senado':'Câmara';
  if(!axis.points.length)return <section className="rounded-2xl border bg-card p-6">
    <h2 className="text-xl font-bold">Eixo das votações</h2>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">{axis.coverage.note}</p>
    <div className="mt-4"><CoverageBadge coverage={axis.coverage}/></div>
  </section>;
  return <section aria-label="Eixo das votações nominais">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-2xl font-bold">O que mais separa a {houseLabel}?</h2>
      <CoverageBadge coverage={axis.coverage}/>
    </div>
    <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
      Cada ponto é um parlamentar, posicionado pelo <strong className="text-foreground">primeiro eixo das votações nominais de plenário</strong> da legislatura{axis.legislature===null?'':` ${axis.legislature}`} — a dimensão que melhor explica as divergências observadas. Não é uma escala de esquerda e direita, nem uma nota: o eixo não tem direção intrínseca, e <strong className="text-foreground">só as distâncias relativas significam algo</strong>. Quem vota junto aparece junto.
    </p>
    <figure className="mt-5 rounded-2xl border bg-card p-5">
      <div className="overflow-x-auto">
        <svg role="img" aria-label={`Posição de ${axis.points.length} parlamentares no primeiro eixo das votações, com ${marked.length} em destaque`} viewBox={`0 0 ${width} ${height}`} className="h-auto min-w-[620px] w-full">
          <line x1={left} x2={right} y1={baseline} y2={baseline} stroke="var(--border)" strokeWidth="2"/>
          {others.map((point,index)=><circle key={point.externalId} cx={atX(point.position)} cy={atY(index)} r="3.5" fill="var(--muted-foreground)" opacity=".38"><title>{point.name} · {point.party}/{point.uf} · {point.votes} votos</title></circle>)}
          {marked.map(({point,color},index)=><g key={point.externalId}>
            <line x1={atX(point.position)} x2={atX(point.position)} y1={baseline-34} y2={baseline+10} stroke={color} strokeWidth="1.5" opacity=".5"/>
            <circle cx={atX(point.position)} cy={baseline} r="8" fill={color} stroke="var(--card)" strokeWidth="2.5"><title>{point.name} · {point.party}/{point.uf} · {point.votes} votos</title></circle>
            <text x={atX(point.position)} y={index%2?baseline+28:baseline-42} textAnchor="middle" fill="var(--foreground)" fontSize="11" fontWeight="700">{point.name.split(' ')[0]}</text>
          </g>)}
          <text x={left} y={height-8} fill="var(--muted-foreground)" fontSize="11">{axis.poles.negative.join(' · ')}</text>
          <text x={right} y={height-8} textAnchor="end" fill="var(--muted-foreground)" fontSize="11">{axis.poles.positive.join(' · ')}</text>
        </svg>
      </div>
      <figcaption className="mt-3 text-xs leading-5 text-muted-foreground">
        Os extremos são descritos pelos partidos que os ocupam, não rotulados ideologicamente. O eixo explica {axis.explained===null?'—':percent(axis.explained,0)} da variância das {axis.deliberations} votações com divergência. {axis.coverage.note}
      </figcaption>
      <details className="mt-4 text-sm"><summary className="focus-ring w-fit cursor-pointer font-bold text-primary">Ver posições</summary>
        <div className="mt-3 overflow-x-auto"><table className="w-full text-left"><caption className="sr-only">Posição de cada parlamentar no primeiro eixo das votações</caption>
          <thead><tr className="border-b"><th className="p-2">Parlamentar</th><th className="p-2">Partido/UF</th><th className="p-2 text-right">Posição</th><th className="p-2 text-right">Votos</th></tr></thead>
          <tbody>{axis.points.map(point=>{const item=selected.get(point.externalId);return <tr className="border-b" key={point.externalId}>
            <th className="p-2 font-normal">{item?<PersonSwatch color={item.color} name={point.name}/>:point.name}</th>
            <td className="p-2">{point.party}/{point.uf}</td>
            <td className="p-2 text-right tabular-nums">{point.position.toFixed(2)}</td>
            <td className="p-2 text-right tabular-nums">{point.votes}</td>
          </tr>})}</tbody>
        </table></div>
      </details>
    </figure>
  </section>;
}
