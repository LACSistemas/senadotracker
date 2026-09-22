import {performance} from 'node:perf_hooks';
import {openDatabase,listPublished,publishedFacets,publishedExpenseYears,publishedParticipationRows,publishedHouseOperations,publishedHouseOperationSummary,publishedPartyPanorama,publishedVoteOptions,publishedPartyVote,publishedOfficialTopics} from '@senadotracker/db';

const db=openDatabase(process.env.SENADOTRACKER_DB_PATH??'data/senadotracker.sqlite',true);
function timed<T>(label:string,fn:()=>T){const start=performance.now(),value=fn();console.log(label,Math.round(performance.now()-start));return value}
try{
  for(const source of ['senado','camara'] as const){
    const year=timed(`${source} expense years`,()=>publishedExpenseYears(db,source))[0]??2026;
    const profiles=timed(`${source} profiles`,()=>db.prepare(`SELECT external_id,payload FROM profiles WHERE batch_id=(SELECT batch_id FROM active_publications WHERE source=?)`).all(source));
    timed(`${source} participation`,()=>publishedParticipationRows(db,source,year,profiles.map(item=>String(item.external_id))));
    timed(`${source} house operations`,()=>publishedHouseOperations(db,source,year));
    timed(`${source} operation summary`,()=>publishedHouseOperationSummary(db,source,year));
  }
  timed('listPublished',()=>listPublished(db,{page:1,pageSize:10}));
  timed('facets',()=>publishedFacets(db));
  const options=timed('vote options',()=>publishedVoteOptions(db,'all'));
  timed('party panorama',()=>publishedPartyPanorama(db,'all',2026));
  if(options[0])timed('party vote',()=>publishedPartyVote(db,options[0]!.key));
  for(const source of ['senado','camara'] as const){timed(`${source} projected authors`,()=>db.prepare(`SELECT x.person_external_id author_id,json_extract(x.payload,'$.party') party,json_extract(p.payload,'$.year') year,json_extract(p.payload,'$.presentedAt') presented_at,json_extract(p.payload,'$.status') status FROM proposal_authors x JOIN proposals p ON p.batch_id=x.batch_id AND p.external_id=x.proposal_id JOIN active_activity_publications a ON a.batch_id=x.batch_id WHERE a.source=?`).all(source))}
  timed('party topics',()=>publishedOfficialTopics(db,'all'));
}finally{db.close()}
