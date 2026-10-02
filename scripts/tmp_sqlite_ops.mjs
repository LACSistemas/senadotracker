import {DatabaseSync} from 'node:sqlite';
const db=new DatabaseSync('data/senadotracker.sqlite',{readOnly:true});
const rows=db.prepare("SELECT c.payload,a.source,a.scope,c.external_key FROM legislative_complements c JOIN active_complement_publications a ON a.batch_id=c.batch_id WHERE a.scope LIKE 'house-operations%' OR c.external_key LIKE 'house-operations:%'").all(); console.log(rows); db.close();
