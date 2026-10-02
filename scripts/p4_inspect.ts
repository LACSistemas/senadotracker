import {DatabaseSync} from 'node:sqlite';
const d=new DatabaseSync('artifacts/postgres-parity/senadotracker-parity.sqlite',{readOnly:true});
for(const t of ['deliberations','legislative_votes','legislative_sessions','attendance','nominal_deliberations','presence_batches','active_presence_publications']){
 console.log('\\n'+t);
 for(const q of ['select source,count(*) n from '+t+' group by source order by source','select * from '+t+' limit 1']){try{console.log(JSON.stringify(d.prepare(q).all()));}catch(e){console.log(String(e));}}
}
