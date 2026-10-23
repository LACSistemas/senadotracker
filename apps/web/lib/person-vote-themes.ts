import { webPostgresPool } from '@/lib/postgres-pool';

export interface VoteThemes{totalVotes:number;themedVotes:number;themes:Array<{label:string;count:number}>}

const PROPOSAL=`COALESCE(v.payload->>'proposalId',d.payload->>'proposalId',d.payload->>'actualVotedProposalId',d.payload->>'anchorProposalId')`;
const BASE=`FROM civica_votes_presence_poc.votes v
  JOIN civica_votes_presence_poc.deliberations d ON d.source=v.source AND d.batch_id=v.batch_id AND d.external_id=v.deliberation_id
  JOIN civica_votes_presence_poc.active_legislative al ON al.source=v.source AND al.batch_id=v.batch_id`;

// Temas (atribuídos pela Casa à proposição votada) das votações nominais da pessoa, com quantas votações cada tema tem.
// A cobertura é parcial por natureza: só votações cuja proposição tem tema no catálogo entram — devolvemos os totais para dizer isso.
export async function personVoteThemes(source:'camara'|'senado',id:string,untilYear:number):Promise<VoteThemes|null>{
  try{
    const pool=webPostgresPool(),args=[source,id,untilYear];
    const where=`WHERE v.source=$1 AND v.external_id=$2 AND d.date::date <= make_date($3,12,31)`;
    const [themes,totals]=await Promise.all([
      pool.query(`SELECT t.label,count(DISTINCT v.deliberation_id)::int AS n ${BASE}
        JOIN civica_poc.proposal_themes t ON t.source=v.source AND t.proposal_id=${PROPOSAL}
        JOIN civica_poc.active_publications tp ON tp.source=t.source AND tp.batch_id=t.batch_id
        ${where} GROUP BY t.label ORDER BY n DESC,t.label`,args),
      pool.query(`SELECT count(*)::int AS total,
        count(*) FILTER (WHERE EXISTS (SELECT 1 FROM civica_poc.proposal_themes t JOIN civica_poc.active_publications tp ON tp.source=t.source AND tp.batch_id=t.batch_id WHERE t.source=v.source AND t.proposal_id=${PROPOSAL}))::int AS themed
        ${BASE} ${where}`,args),
    ]);
    return {totalVotes:Number(totals.rows[0]?.total??0),themedVotes:Number(totals.rows[0]?.themed??0),themes:themes.rows.map(row=>({label:String(row.label),count:Number(row.n)}))};
  }catch{return null}
}
