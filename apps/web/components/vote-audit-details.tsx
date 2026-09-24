import type { publishedPersonComparisonDashboard } from '@senadotracker/db';

type Agreement=ReturnType<typeof publishedPersonComparisonDashboard>['agreements'][number];

/** Auditoria dos votos comuns de um par. É o recurso mais valioso da página: qualquer número de
    concordância pode ser conferido voto a voto na fonte oficial. */
export function VoteAuditDetails({pair,leftName,rightName,limit=8}:{pair:Agreement;leftName:string;rightName:string;limit?:number}){
  if(!pair.items.length)return null;
  return <details className="mt-3 text-sm"><summary className="focus-ring w-fit cursor-pointer font-bold text-primary">Auditar votos comuns</summary>
    <ul className="mt-3 space-y-2">{pair.items.slice(0,limit).map(vote=><li key={vote.deliberationId} className="border-t pt-2">
      <a className="font-bold underline" href={vote.deliberation?.officialUrl}>{vote.deliberation?.proposalLabel??vote.deliberation?.description??vote.deliberationId}</a>
      <span className="block text-xs text-muted-foreground">{leftName}: {vote.leftVote} · {rightName}: {vote.rightVote} · {vote.equal?'igual':'divergente'}</span>
    </li>)}</ul>
    {pair.items.length>limit&&<p className="mt-2 text-xs text-muted-foreground">Mostrando {limit} de {pair.total} votos comuns.</p>}
  </details>;
}
