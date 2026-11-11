import { webPostgresPool } from '@/lib/postgres-pool';
import { loadStates, findMunicipalities } from '@/lib/exec-territory';
import { loadJudiciaryTribunalDirectory } from '@/lib/judiciary';

export interface SearchHit{kind:'pessoa'|'partido'|'estado'|'municipio'|'tribunal';id:string;title:string;subtitle:string;href:string;photoUrl:string|null}

// Mesmo critério de `search_name` das listas: minúsculas, sem acento.
export const normalizeQuery=(q:string)=>q.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim();

const ROLE:Record<string,string>={camara:'Deputado federal',senado:'Senador'};
const ROOT:Record<string,string>={camara:'deputados',senado:'senadores'};

/** Busca federada e leve: cada fonte já tinha sua própria consulta/índice (pessoas, partidos, estados,
 * municípios, tribunais) — isto só os chama em paralelo e junta os resultados num só `SearchHit[]`, sem
 * criar um índice novo. Estado/tribunal filtram em memória/SQL já existentes; município reusa
 * `findMunicipalities` (mesma função de `/municipios`). */
export async function searchAll(raw:string):Promise<SearchHit[]>{
  const q=normalizeQuery(raw).slice(0,60);
  if(q.length<2)return [];
  const pool=webPostgresPool(),like=`%${q.replace(/[\\%_]/g,m=>`\\${m}`)}%`,prefix=`${like.slice(1)}`.replace(/%$/,'');
  const [people,parties,states,municipalities,tribunals]=await Promise.all([
    pool.query(`SELECT source,external_id,name,uf,party,payload->>'photoUrl' AS photo FROM civica_people_poc.profiles WHERE search_name LIKE $1 ORDER BY (search_name LIKE $2) DESC, search_name, external_id LIMIT 6`,[like,`${prefix}%`]),
    pool.query(`SELECT party,count(*)::int AS n FROM civica_people_poc.profiles WHERE party IS NOT NULL AND lower(party) LIKE $1 GROUP BY party ORDER BY (lower(party)=$2) DESC, n DESC LIMIT 2`,[like,q]),
    loadStates(),
    findMunicipalities(q,undefined,5),
    loadJudiciaryTribunalDirectory({search:q,pageSize:4}),
  ]);
  const normalizedStates=states.filter(s=>normalizeQuery(s.name).includes(q)||normalizeQuery(s.uf).includes(q)).slice(0,3);
  return [
    ...normalizedStates.map((s):SearchHit=>({kind:'estado',id:`uf:${s.uf}`,title:s.name,subtitle:`Estado · ${s.uf}`,href:`/estados/${s.uf}`,photoUrl:null})),
    ...municipalities.rows.slice(0,5).map((m):SearchHit=>({kind:'municipio',id:`mun:${m.entityId}`,title:m.name,subtitle:`Município${m.population!=null?` · ${new Intl.NumberFormat('pt-BR').format(m.population)} hab.`:''}`,href:`/municipios/${m.entityId}`,photoUrl:null})),
    ...(tribunals.items as any[]).slice(0,4).map((t):SearchHit=>({kind:'tribunal',id:`trib:${t.tribunal_id}`,title:t.sigla,subtitle:t.official_name===t.branch_name?t.branch_name:`${t.branch_name} · ${t.official_name}`,href:`/judiciario/tribunais/${encodeURIComponent(t.tribunal_id)}`,photoUrl:null})),
    ...parties.rows.map((row):SearchHit=>({kind:'partido',id:`p:${row.party}`,title:String(row.party),subtitle:`Partido · ${row.n} parlamentares`,href:`/legislativo/partidos/${encodeURIComponent(String(row.party))}`,photoUrl:null})),
    ...people.rows.map((row):SearchHit=>({kind:'pessoa',id:`${row.source}:${row.external_id}`,title:String(row.name),subtitle:`${ROLE[row.source]??'Parlamentar'} · ${row.party??'sem partido'} · ${row.uf??'—'}`,href:`/legislativo/${ROOT[row.source]??'deputados'}/${row.external_id}`,photoUrl:row.photo??null})),
  ];
}
