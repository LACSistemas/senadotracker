import pg from 'pg'; import {DatabaseSync} from 'node:sqlite';
const p=new pg.Pool({host:'localhost',port:5432,database:'projetoeleitor_db',user:'projetoeleitor_user',password:'projetoeleitorsenha'});
const db=new DatabaseSync('data/senadotracker.sqlite',{readOnly:true});
(async()=>{for(const q of [
`select e.competence,e.nature,e.rubric,count(*)::int n,sum(e.value_cents)::bigint total from civica.expanded_costs e join civica.active_expanded_cost_publications a on a.source=e.source and a.batch_id=e.batch_id where e.source='senado' and left(e.competence,4)::int=2026 group by e.competence,e.nature,e.rubric order by e.competence,e.rubric`,
`select e.competence,json_extract(e.payload,'$.nature') nature,json_extract(e.payload,'$.rubric') rubric,count(*) n,sum(e.value_cents) total from expanded_costs e join active_expanded_cost_publications a on a.batch_id=e.batch_id where e.source='senado' and substr(e.competence,1,4)='2026' group by e.competence,nature,rubric order by e.competence,rubric`
]){console.log(JSON.stringify(q.startsWith('select e.competence,json')?db.prepare(q).all(): (await p.query(q)).rows,null,2))} await p.end()})().catch(e=>{console.error(e);process.exit(1)})
