import {openPool} from './db.ts';
const p=openPool(1);
console.log((await p.query("select d.code,e.name,v.value,v.numerator,v.denominator from civica_exec.exec_ind_value v join civica_exec.exec_ind_def d using(indicator_id) join civica_exec.exec_entity e using(entity_id) where d.indicator_id in(9702,9732,9762,9801,9802,9901,9902,9903,9904,9905,9951,9952) and e.kind=1 order by d.indicator_id")).rows);
console.log((await p.query("select d.indicator_id,count(*)::int rows,count(*) filter(where v.value is null)::int nulls from civica_exec.exec_ind_def d left join civica_exec.exec_ind_value v using(indicator_id) where d.indicator_id between 9701 and 9952 group by d.indicator_id order by d.indicator_id")).rows);
await p.end();
