import {DatabaseSync} from 'node:sqlite';
const d=new DatabaseSync('artifacts/postgres-parity/senadotracker-parity.sqlite',{readOnly:true});
for(const [t,col] of [['legislative_votes','external_id'],['attendance','external_id']]){
 const rows:any[]=d.prepare('select source,'+col+' id,count(*) n from '+t+' group by source,'+col+' order by n desc limit 10').all(); console.log(t,rows);
}
const joins=[
 ['vote_to_people',`select count(*) n from legislative_votes v join people p on p.external_id=v.external_id and p.source=v.source`],
 ['attendance_to_people',`select count(*) n from attendance a join people p on p.external_id=a.external_id and p.source=a.source`],
 ['attendance_to_sessions',`select count(*) n from attendance a join legislative_sessions s on s.external_id=a.session_id and s.source=a.source`],
 ['nominal_deliberations',`select count(*) n from nominal_deliberations`]
]; for(const [name,q] of joins){try{console.log(name,d.prepare(q).get())}catch(e){console.log(name,String(e))}}
