import { openDatabase, publishedPropositions, publishedProposition } from '@senadotracker/db';
const db=openDatabase('data/senadotracker.sqlite',true);
const types=['PL','PLP','PEC','RIC','REQ','EMC','SBT','PRL','DTQ','RPD','DOC','REC','PPP','PEP'];
for(const type of types){
 const rows=db.prepare("SELECT p.source,p.external_id,json_extract(p.payload,'$.type') type,json_extract(p.payload,'$.label') label,json_extract(p.payload,'$.functionalGroup') functional FROM proposals p JOIN active_activity_publications a ON a.batch_id=p.batch_id WHERE json_extract(p.payload,'$.type')=? ORDER BY p.external_id LIMIT 80").all(type) as any[];
 let chosen:any=null;
 for(const row of rows){const detail=publishedProposition(db,String(row.source),String(row.external_id));if(!detail)continue;const score=detail.movements.length*3+detail.relationships.length*2+detail.deliberations.length*4+detail.documents.length*2+detail.authors.length+detail.amendments.length+detail.resultingNorms.length;if(!chosen||score>chosen.score)chosen={row,score,detail};}
 if(chosen) console.log(JSON.stringify({type,source:chosen.row.source,id:chosen.row.external_id,label:chosen.row.label,group:chosen.detail.proposal.functionalGroup,score:chosen.score,counts:Object.fromEntries(['movements','relationships','deliberations','documents','amendments','resultingNorms','authors'].map(k=>[k,chosen.detail[k].length])),principal:chosen.detail.principal?.id??null}));
}
db.close();
