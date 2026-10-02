import {DatabaseSync} from 'node:sqlite';
const d=new DatabaseSync('artifacts/postgres-parity/senadotracker-parity.sqlite',{readOnly:true});
const a:any[]=d.prepare("select name from sqlite_master where type='table' and (lower(name) like '%vote%' or lower(name) like '%attend%' or lower(name) like '%session%' or lower(name) like '%presence%' or lower(name) like '%deliber%') order by name").all();
for(const x of a){const c:any[]=d.prepare('pragma table_info('+x.name+')').all();const n:any=d.prepare('select count(*) n from '+x.name).get();console.log(JSON.stringify({table:x.name,rows:n.n,columns:c.map(y=>y.name)}));}
