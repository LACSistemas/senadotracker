import { webPostgresPool } from '@/lib/postgres-pool';

export interface PersonThemes{
  year:number;proposals:number;withTheme:number;
  themes:Array<{label:string;count:number}>;
  /** Temas mais comuns da Casa em que a pessoa não tem nenhuma proposta no ano. */
  absent:string[];
}

const ACTIVE='JOIN civica_poc.active_publications ap ON ap.source=$1 AND ap.batch_id=';

// Temas das proposições de autoria da pessoa no ano. Os temas são os que a própria Casa atribui (nem toda
// proposição tem tema), então devolvemos também quantas têm — a interface mostra essa cobertura.
export async function personThemes(source:'camara'|'senado',id:string,year:number):Promise<PersonThemes|null>{
  try{
    const pool=webPostgresPool();
    const mine=`SELECT DISTINCT a.proposal_id FROM civica_poc.proposal_authors a ${ACTIVE}a.batch_id
      JOIN civica_poc.proposals p ON p.source=a.source AND p.batch_id=a.batch_id AND p.external_id=a.proposal_id
      WHERE a.source=$1 AND a.person_external_id=$2 AND COALESCE(p.functional_group,'')<>'pareceres_relatorios'
        AND (p.presented_year=$3 OR (p.presented_year IS NULL AND extract(year from p.presented_at)::int=$3))`;
    const [byTheme,totals,universe]=await Promise.all([
      pool.query(`WITH mine AS (${mine}) SELECT t.label,count(DISTINCT t.proposal_id)::int AS n FROM mine m
        JOIN civica_poc.proposal_themes t ON t.source=$1 AND t.proposal_id=m.proposal_id
        JOIN civica_poc.active_publications tp ON tp.source=t.source AND tp.batch_id=t.batch_id
        GROUP BY t.label ORDER BY n DESC,t.label`,[source,id,year]),
      pool.query(`WITH mine AS (${mine}) SELECT (SELECT count(*) FROM mine)::int AS total,
        (SELECT count(DISTINCT t.proposal_id) FROM mine m JOIN civica_poc.proposal_themes t ON t.source=$1 AND t.proposal_id=m.proposal_id
          JOIN civica_poc.active_publications tp ON tp.source=t.source AND tp.batch_id=t.batch_id)::int AS themed`,[source,id,year]),
      pool.query(`SELECT t.label FROM civica_poc.proposal_themes t JOIN civica_poc.active_publications tp ON tp.source=t.source AND tp.batch_id=t.batch_id
        WHERE t.source=$1 GROUP BY t.label ORDER BY count(*) DESC,t.label LIMIT 12`,[source]),
    ]);
    const themes=byTheme.rows.map(row=>({label:String(row.label),count:Number(row.n)})),has=new Set(themes.map(item=>item.label));
    return {year,proposals:Number(totals.rows[0]?.total??0),withTheme:Number(totals.rows[0]?.themed??0),themes,absent:universe.rows.map(row=>String(row.label)).filter(label=>!has.has(label))};
  }catch{return null}
}
