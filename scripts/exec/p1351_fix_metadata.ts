import {openPool} from './db.ts';
const p=openPool(1); const specs=[[146,9701,9799],[147,9801,9802],[148,9901,9905],[149,9951,9952]] as const;
for(const [dataset,lo,hi] of specs){await p.query(`update civica_exec.exec_publication pub set row_count=x.n from (select case when e.kind=1 then 0 else e.uf_code end uf,count(*)::int n from civica_exec.exec_ind_value v join civica_exec.exec_entity e using(entity_id) where v.indicator_id between $2 and $3 group by 1) x where pub.dataset_id=$1 and pub.uf=x.uf and pub.competence=202610`,[dataset,lo,hi]);}
console.log((await p.query("select dataset_id,uf,row_count from civica_exec.exec_publication where dataset_id between 146 and 149 order by dataset_id,uf")).rows);await p.end();
