import { webPostgresPool } from '@/lib/postgres-pool';

export interface SearchHit{kind:'pessoa'|'partido';id:string;title:string;subtitle:string;href:string;photoUrl:string|null}

// Mesmo critério de `search_name` das listas: minúsculas, sem acento.
export const normalizeQuery=(q:string)=>q.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim();

const ROLE:Record<string,string>={camara:'Deputado federal',senado:'Senador'};
const ROOT:Record<string,string>={camara:'deputados',senado:'senadores'};

// Consulta leve (2 SELECTs com LIMIT) feita a cada tecla: nada de facetas nem payload completo.
export async function searchAll(raw:string):Promise<SearchHit[]>{
  const q=normalizeQuery(raw).slice(0,60);
  if(q.length<2)return [];
  const pool=webPostgresPool(),like=`%${q.replace(/[\\%_]/g,m=>`\\${m}`)}%`,prefix=`${like.slice(1)}`.replace(/%$/,'');
  const [people,parties]=await Promise.all([
    pool.query(`SELECT source,external_id,name,uf,party,payload->>'photoUrl' AS photo FROM civica_people_poc.profiles WHERE search_name LIKE $1 ORDER BY (search_name LIKE $2) DESC, search_name, external_id LIMIT 8`,[like,`${prefix}%`]),
    pool.query(`SELECT party,count(*)::int AS n FROM civica_people_poc.profiles WHERE party IS NOT NULL AND lower(party) LIKE $1 GROUP BY party ORDER BY (lower(party)=$2) DESC, n DESC LIMIT 3`,[like,q]),
  ]);
  return [
    ...parties.rows.map((row):SearchHit=>({kind:'partido',id:`p:${row.party}`,title:String(row.party),subtitle:`Partido · ${row.n} parlamentares`,href:`/legislativo/partidos/${encodeURIComponent(String(row.party))}`,photoUrl:null})),
    ...people.rows.map((row):SearchHit=>({kind:'pessoa',id:`${row.source}:${row.external_id}`,title:String(row.name),subtitle:`${ROLE[row.source]??'Parlamentar'} · ${row.party??'sem partido'} · ${row.uf??'—'}`,href:`/legislativo/${ROOT[row.source]??'deputados'}/${row.external_id}`,photoUrl:row.photo??null})),
  ];
}
