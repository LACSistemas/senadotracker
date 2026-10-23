import { webPostgresPool } from '@/lib/postgres-pool';

export interface PersonYear{year:number;quotaCents:number|null;quotaMonths:number;proposals:number|null}

// Ano a ano com duas séries que existem para todos os anos publicados: cota gasta (com quantos meses há registro)
// e propostas de autoria apresentadas. Ano sem registro numa série fica `null` ("—"), nunca zero.
export async function personYears(source:'camara'|'senado',id:string):Promise<PersonYear[]|null>{
  try{
    const pool=webPostgresPool();
    const [quota,props]=await Promise.all([
      pool.query(`SELECT e.year::int AS year,sum(e.net_cents-e.refund_cents)::bigint AS cents,count(DISTINCT e.month)::int AS months
        FROM civica.expenses e JOIN civica.active_expense_publications a ON a.source=e.source AND a.batch_id=e.batch_id
        WHERE e.source=$1 AND e.external_id=$2 GROUP BY e.year`,[source,id]),
      pool.query(`SELECT COALESCE(p.presented_year,extract(year from p.presented_at)::int)::int AS year,count(DISTINCT a.proposal_id)::int AS n
        FROM civica_poc.proposal_authors a JOIN civica_poc.active_publications ap ON ap.source=a.source AND ap.batch_id=a.batch_id
        JOIN civica_poc.proposals p ON p.source=a.source AND p.batch_id=a.batch_id AND p.external_id=a.proposal_id
        WHERE a.source=$1 AND a.person_external_id=$2 AND COALESCE(p.functional_group,'')<>'pareceres_relatorios'
        GROUP BY 1`,[source,id]),
    ]);
    const years=new Map<number,PersonYear>();
    const row=(year:number)=>{let r=years.get(year);if(!r){r={year,quotaCents:null,quotaMonths:0,proposals:null};years.set(year,r)}return r};
    for(const r of quota.rows)Object.assign(row(Number(r.year)),{quotaCents:Number(r.cents),quotaMonths:Number(r.months)});
    for(const r of props.rows)if(r.year!=null)row(Number(r.year)).proposals=Number(r.n);
    return [...years.values()].sort((a,b)=>b.year-a.year);
  }catch{return null}
}
