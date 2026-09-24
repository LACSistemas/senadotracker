import { resolve } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { Source } from '@senadotracker/domain';
import { collectCamaraPropositionDetails } from './camara-proposition-details.ts';
import { collectSenateProcesses } from './senate-processes.ts';

export function prioritizedProposalIds(db:DatabaseSync,source:Source,year:number,limit:number){
  if(!Number.isSafeInteger(limit)||limit<1||limit>500)throw new Error('Limite deve estar entre 1 e 500');
  return db.prepare(`SELECT p.external_id id,
    CASE WHEN EXISTS(SELECT 1 FROM deliberations d JOIN active_legislative_publications al ON al.batch_id=d.batch_id WHERE d.source=p.source AND json_extract(d.payload,CASE WHEN p.source='camara' THEN '$.actualVotedProposalId' ELSE '$.proposalId' END)=p.external_id) THEN 0 ELSE 1 END priority
    FROM proposals p JOIN active_activity_publications a ON a.batch_id=p.batch_id
    WHERE p.source=? AND CAST(json_extract(p.payload,'$.year') AS INTEGER)=?
      AND NOT EXISTS(SELECT 1 FROM active_complement_publications ac WHERE ac.source=p.source AND ac.scope='proposal:'||p.external_id)
    ORDER BY priority,COALESCE(json_extract(p.payload,'$.presentedAt'),'') DESC,p.external_id LIMIT ?`).all(source,year,limit).map(row=>String(row.id));
}

export async function collectPropositionEnrichment(db:DatabaseSync,options:{source:Source|'all';year:number;limit:number;directory:string;progress?:(message:string)=>void}){
  const sources:Source[]=options.source==='all'?['senado','camara']:[options.source],result:Record<string,unknown>={};
  for(const source of sources){const ids=prioritizedProposalIds(db,source,options.year,options.limit);options.progress?.(`${source}: ${ids.length} proposições priorizadas`);if(!ids.length){result[source]={requested:0};continue}if(source==='camara')result[source]=await collectCamaraPropositionDetails(db,{ids,rawDirectory:resolve(options.directory,'raw')});else result[source]=await collectSenateProcesses(db,{year:options.year,ids,rawDirectory:resolve(options.directory,'raw'),cacheDirectory:resolve(options.directory,'cache','senate-processes'),...(options.progress?{progress:options.progress}:{})});}
  return result;
}
