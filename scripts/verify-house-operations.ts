import {openDatabase,publishedHouseOperations} from '@senadotracker/db';
import {reportingCutoff} from '../packages/db/src/reporting-period.ts';
const db=openDatabase('data/senadotracker.sqlite',true);
try{
  for(const source of ['senado','camara'] as const){
    for(const year of [2025,2026]){
      const cutoff=reportingCutoff(year);
      const old=Number(db.prepare(source==='senado'?`SELECT count(DISTINCT c.proposal_id) value FROM legislative_complements c JOIN active_complement_publications a ON a.batch_id=c.batch_id WHERE a.source='senado' AND c.kind='resulting_norm' AND substr(COALESCE(c.occurred_at,''),1,10) BETWEEN ? AND ? AND c.proposal_id IS NOT NULL`:`SELECT count(DISTINCT c.proposal_id) value FROM legislative_complements c JOIN active_complement_publications a ON a.batch_id=c.batch_id WHERE a.source='camara' AND c.kind IN ('movement','resulting_norm') AND substr(COALESCE(c.occurred_at,''),1,10) BETWEEN ? AND ? AND c.proposal_id IS NOT NULL AND (c.kind='resulting_norm' OR search_text(json_extract(c.payload,'$.label')) LIKE '%transform%norma%' OR search_text(COALESCE(json_extract(c.payload,'$.value'),'')) LIKE '%transform%norma%' OR search_text(json_extract(c.payload,'$.label')) LIKE '%promulg%' OR search_text(json_extract(c.payload,'$.label')) LIKE '%sancion%')`).get(`${year}-01-01`,cutoff)?.value??0);
      const updated=publishedHouseOperations(db,source,year).stages.norm;
      console.log(source,year,{old,updated,equal:old===updated});
      if(old!==updated)process.exitCode=1;
    }
  }
}finally{db.close()}
