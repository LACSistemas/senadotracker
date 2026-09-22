import type {publishedPersonComparisonDashboard} from '@senadotracker/db';

type Dashboard=ReturnType<typeof publishedPersonComparisonDashboard>;
const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});

export function ComparisonPatrimony({data,palette}:{data:Dashboard;palette:string[]}){
  return <section aria-labelledby="patrimonio-comparacao">
    <h2 id="patrimonio-comparacao" className="text-2xl font-bold">Patrimônio declarado</h2>
    <p className="mt-2 text-sm text-muted-foreground">Bens declarados ao TSE na eleição indicada. Não representam patrimônio atual.</p>
    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{data.people.map((item,index)=>{
      const election=item.electoral.elections.find(value=>value.assets.length>0&&value.assetVersionConflicts===0);
      const change=election?item.electoral.changes.find(value=>value.toYear===election.candidacy.year):null;
      return <article key={item.profile.externalId} className="min-w-0 rounded-2xl border border-t-4 bg-card p-5" style={{borderTopColor:palette[index]??'#115b45'}}>
        <h3 className="font-bold">{item.profile.name}</h3>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bens declarados</p>
        <p className="mt-1 break-words text-2xl font-black tabular-nums">{election?money.format(election.assetTotalCents/100):'Indisponível'}</p>
        <p className="mt-2 text-sm text-muted-foreground">{election?`${election.candidacy.year} · ${election.candidacy.office} · ${election.assets.length} ${election.assets.length===1?'bem declarado':'bens declarados'}`:item.electoral.coverage.note}</p>
        {change&&<p className="mt-3 border-t pt-3 text-xs text-muted-foreground">Variação declarada desde {change.fromYear}: {money.format(change.changeCents/100)}. Não mede enriquecimento.</p>}
      </article>;
    })}</div>
  </section>;
}
