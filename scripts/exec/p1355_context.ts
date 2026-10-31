import {openPool} from './db.ts'; const p=openPool(1);
console.log((await p.query("select funcao,count(1)::int rows,min(exercicio)::int min_year,max(exercicio)::int max_year from civica_exec.exec_fin_exec where funcao in (15,16,17,25,26) group by funcao order by funcao")).rows);
console.log((await p.query("select count(distinct entity_id)::int entities from civica_exec.exec_fin_exec where funcao in (15,16,17,25,26)")).rows);
console.log((await p.query("select min(entity_id),max(entity_id),count(*) from civica_exec.exec_entity where kind=4")).rows);
await p.end();
