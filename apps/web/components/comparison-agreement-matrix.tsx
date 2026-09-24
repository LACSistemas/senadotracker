import type { publishedPersonComparisonDashboard } from '@senadotracker/db';
import { CoverageBadge } from '@/components/metrics';
import { PersonSwatch } from '@/components/person-swatch';
import { VoteAuditDetails } from '@/components/vote-audit-details';
import { percent } from '@/lib/format';
import { bandOf, sequentialRamp } from '@/lib/scale';

type Dashboard=ReturnType<typeof publishedPersonComparisonDashboard>;
// Faixas fixas: concordância é percentual com significado absoluto, então quantis sobre 6 pares
// inventariam contraste. Os cortes também aparecem na legenda, para a cor ser conferível.
const edges=[.5,.65,.8,.9] as const;
const bandLabels=['abaixo de 50%','50% a 65%','65% a 80%','80% a 90%','90% ou mais'] as const;
const dark=3;

export function ComparisonAgreementMatrix({data,palette}:{data:Dashboard;palette:string[]}){
  const people=data.people.map((item,index)=>({id:item.profile.externalId,name:item.profile.name,party:item.profile.party,uf:item.profile.uf,color:palette[index]??'#115b45'}));
  const pairs=new Map(data.agreements.flatMap(item=>[[`${item.leftId}:${item.rightId}`,item],[`${item.rightId}:${item.leftId}`,item]] as const));
  const cell=(left:string,right:string)=>pairs.get(`${left}:${right}`)??null;
  return <section aria-label="Matriz de concordância de voto">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-2xl font-bold">Quem vota com quem?</h2>
      <CoverageBadge coverage={data.coverage.votes}/>
    </div>
    <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Percentual de votações nominais de plenário em que ambos registraram a mesma posição, sobre as deliberações em que os dois votaram. {data.coverage.votes.note}</p>
    <div className="mt-5 overflow-x-auto rounded-2xl border bg-card p-4">
      <table className="w-full min-w-[520px] border-separate border-spacing-1 text-sm">
        <caption className="sr-only">Concordância de voto entre os parlamentares comparados, em percentual, com o número de votações comuns</caption>
        <thead><tr><td/>{people.map(person=><th key={person.id} scope="col" className="p-2 text-left align-bottom text-xs font-bold"><PersonSwatch color={person.color} name={person.name}/></th>)}</tr></thead>
        <tbody>{people.map(row=><tr key={row.id}>
          <th scope="row" className="max-w-[10rem] p-2 text-left text-xs font-bold"><PersonSwatch color={row.color} name={row.name}/></th>
          {people.map(column=>{
            if(row.id===column.id)return <td key={column.id} className="rounded-lg bg-muted/40 p-3 text-center text-xs text-muted-foreground">—</td>;
            const pair=cell(row.id,column.id);
            // Sem interseção comparável a célula é cinza e diz por quê: 0% seria uma afirmação falsa.
            if(!pair||pair.ratio===null)return <td key={column.id} className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground" title="Nenhuma votação com posição registrada pelos dois">sem votos comuns</td>;
            const band=bandOf(pair.ratio,edges);
            return <td key={column.id} className="rounded-lg p-3 text-center" style={{background:sequentialRamp[band],color:band>=dark?'#fff':'var(--foreground)'}} title={`${row.name} × ${column.name}: ${percent(pair.ratio)} em ${pair.total} votações comuns`}>
              <strong className="block tabular-nums">{percent(pair.ratio)}</strong>
              <small className="tabular-nums opacity-80">n={pair.total}</small>
            </td>;
          })}
        </tr>)}</tbody>
      </table>
    </div>
    <ul className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">{bandLabels.map((label,index)=><li className="flex items-center gap-2" key={label}><i className="size-3 rounded-sm" style={{background:sequentialRamp[index]}}/>{label}</li>)}</ul>
    <div className="mt-5 grid gap-3 md:grid-cols-2">{data.agreements.map(pair=>{
      const left=people.find(person=>person.id===pair.leftId)!,right=people.find(person=>person.id===pair.rightId)!;
      return <article key={`${pair.leftId}:${pair.rightId}`} className="rounded-2xl border bg-card p-4">
        <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold"><PersonSwatch color={left.color} name={left.name}/><span className="text-muted-foreground">×</span><PersonSwatch color={right.color} name={right.name}/></h3>
        <p className="mt-2 text-xs text-muted-foreground">{pair.ratio===null?'Nenhuma votação com posição registrada pelos dois.':`${pair.equal} concordâncias em n=${pair.total}.`}</p>
        <VoteAuditDetails pair={pair} leftName={left.name} rightName={right.name}/>
      </article>;
    })}</div>
  </section>;
}
