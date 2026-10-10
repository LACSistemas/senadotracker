import {writeFileSync} from 'node:fs';
import {runAlepaDevexpress} from '../apps/collector/src/state/providers/alepa-devexpress/index.ts';
const first=await runAlepaDevexpress({limit:10,pages:[0,1],year:2026});
const count=first.pages[0]?.pageCount??0;
if(!count||count<2) throw new Error('PA pageCount not proven');
const pages=Array.from({length:count},(_,i)=>i);
const run=await runAlepaDevexpress({limit:10,pages,year:2026});
const proposals=run.proposals.map(p=>({externalId:String(p.proposal.key.externalId),proposal:p.proposal,authors:p.authors,movements:p.movements,rawIds:p.raw.map(x=>x.envelope.rawId)}));
const ids=proposals.map(x=>x.externalId); const dup=ids.filter((x,i)=>ids.indexOf(x)!==i);
const out={house:'PA',provider:'alepa_devexpress',year:2026,contract:'https://www.alepa.pa.gov.br/Legislativo/Proposicoes -> /Legislativo/CallbackPanelProposicoes/CardViewProposicoes',pageCount:count,pagesFetched:run.pages.length,sourceRows:proposals.length,distinctIds:new Set(ids).size,duplicateIds:[...new Set(dup)],authorshipRows:proposals.reduce((n,x)=>n+x.authors.length,0),linkedPersonAuthors:0,institutionalAuthors:proposals.reduce((n,x)=>n+x.authors.filter(a=>a.actorType==='institution').length,0),proposals,raw:run.raw,collectedAt:new Date().toISOString(),metrics:run.metrics,participationEvidence:run.participationEvidence};
writeFileSync('artifacts/P20_7A_PA_corpus.json',JSON.stringify(out));writeFileSync('artifacts/P20_7A_PA_pages.json',JSON.stringify(run.pages));
console.log(JSON.stringify({...out,proposals:undefined,raw:undefined},null,2));

