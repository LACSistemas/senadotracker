import {openPool} from './db.ts';const p=openPool(1);console.log((await p.query('select indicator_id,code from civica_exec.exec_ind_def where domain=5 order by indicator_id')).rows);await p.end();
