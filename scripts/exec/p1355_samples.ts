import {openPool} from './db.ts'; const p=openPool(1);
console.log('WORK PROJECT', (await p.query('select * from civica_exec.exec_work_c_project limit 2')).rows);
console.log('WORK CONTRACT', (await p.query('select * from civica_exec.exec_work_c_contract limit 3')).rows);
console.log('PNCP', (await p.query('select * from civica_exec.exec_fin_contract limit 3')).rows);
console.log('PHYSICAL', (await p.query('select * from civica_exec.exec_work_c_physical limit 3')).rows);
await p.end();
