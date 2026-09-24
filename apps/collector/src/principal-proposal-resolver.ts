import type { DatabaseSync } from 'node:sqlite';
import { failRun, heartbeat, startRun, transaction } from '@senadotracker/db';
import { proposalFunctionalGroup, type Proposal } from '@senadotracker/domain';
import { OfficialHttp, type JsonResponse } from './http.ts';
import { saveRaw } from './raw.ts';

type Json=Record<string,unknown>;
type Theme={code:string;label:string;relevance:string|null;rawId:string};
type Resolved={proposal:Proposal;themes:Theme[]};
const api='https://dadosabertos.camara.leg.br/api/v2';
const text=(value:unknown)=>value===null||value===undefined||String(value).trim()===''?null:String(value).trim();
const idFromUri=(value:unknown)=>/\/(\d+)\/?$/.exec(String(value??''))?.[1]??null;
const items=(value:unknown):Json[]=>Array.isArray(value)?value.filter((item):item is Json=>Boolean(item)&&typeof item==='object'):[];

export function parsePrincipalProposal(detailResponse:JsonResponse,themesResponse:JsonResponse,discoveredByProposalId:string):Resolved{
  const root=detailResponse.data as Json,detail=(root.dados??{}) as Json,id=String(detail.id??'');
  if(!/^\d+$/.test(id))throw new Error('Detalhe da proposição-pai sem ID oficial');
  const type=text(detail.siglaTipo)??text(detail.descricaoTipo)??'Proposição',number=text(detail.numero),year=Number(detail.ano)||null,principalProposalId=idFromUri(detail.uriPropPrincipal);
  const proposal:Proposal={source:'camara',externalId:id,type,functionalGroup:proposalFunctionalGroup(type),number,year,label:[type,number].filter(Boolean).join(' ')+(year?`/${year}`:''),summary:text(detail.ementa),presentedAt:text(detail.dataApresentacao),status:text((detail.statusProposicao as Json|undefined)?.descricaoSituacao)??text(detail.descricaoSituacao),officialUrl:`https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${id}`,rawId:detailResponse.rawId,principalProposalId,previousProposalId:idFromUri(detail.uriPropAnterior),nextProposalId:idFromUri(detail.uriPropPosterior),relationshipEvidence:principalProposalId||detail.uriPropAnterior||detail.uriPropPosterior?'official_uri':null,catalogRole:'relationship_support',discoveredByProposalId};
  const themes=items((themesResponse.data as Json).dados).map((item,index)=>({code:text(item.codTema)??String(index),label:text(item.tema)??`Tema ${index+1}`,relevance:text(item.relevancia),rawId:themesResponse.rawId}));
  return{proposal,themes};
}

export interface PrincipalResolutionOptions{children:Proposal[];rawDirectory:string;maxDepth?:number;concurrency?:number;clientFactory?:(runId:string)=>{json:(url:string)=>Promise<JsonResponse>};progress?:(message:string)=>void}
export interface PrincipalResolutionResult{dependencies:number;missingBefore:number;resolved:number;reused:number;failed:number;requests:number;remaining:number;maxDepth:number}

export async function resolveCamaraPrincipalProposals(db:DatabaseSync,options:PrincipalResolutionOptions):Promise<PrincipalResolutionResult>{
  const maxDepth=Math.max(1,Math.min(5,options.maxDepth??3)),concurrency=Math.max(1,Math.min(8,options.concurrency??6)),now=new Date().toISOString();
  const register=(childId:string,parentId:string,depth:number)=>db.prepare(`INSERT INTO principal_proposal_dependencies(source,child_id,parent_id,state,depth,attempts,last_error,discovered_at,updated_at) VALUES ('camara',?,?,'pending',?,0,NULL,?,?) ON CONFLICT(source,child_id,parent_id) DO UPDATE SET depth=min(depth,excluded.depth),updated_at=excluded.updated_at`).run(childId,parentId,depth,now,now);
  transaction(db,()=>{for(const child of options.children)if(child.principalProposalId&&child.principalProposalId!==child.externalId)register(child.externalId,child.principalProposalId,1)});
  const local=new Set<string>(db.prepare(`SELECT DISTINCT p.external_id FROM proposals p JOIN active_activity_publications a ON a.batch_id=p.batch_id WHERE p.source='camara' UNION SELECT external_id FROM principal_proposal_support WHERE source='camara'`).all().map(row=>String(row.external_id)));
  let reused=0;
  transaction(db,()=>{for(const row of db.prepare(`SELECT child_id,parent_id FROM principal_proposal_dependencies WHERE source='camara' AND state<>'resolved'`).all())if(local.has(String(row.parent_id))){db.prepare(`UPDATE principal_proposal_dependencies SET state='resolved',last_error=NULL,updated_at=? WHERE source='camara' AND child_id=? AND parent_id=?`).run(now,String(row.child_id),String(row.parent_id));reused++}});
  const pending=db.prepare(`SELECT parent_id,min(depth) depth,min(child_id) child_id FROM principal_proposal_dependencies WHERE source='camara' AND state<>'resolved' AND attempts<5 AND depth<=? GROUP BY parent_id ORDER BY depth,parent_id`).all(maxDepth).map(row=>({parentId:String(row.parent_id),depth:Number(row.depth),childId:String(row.child_id)})),visited=new Set(pending.map(item=>item.parentId));
  const missingBefore=pending.length;if(!pending.length)return{dependencies:Number(db.prepare(`SELECT count(*) n FROM principal_proposal_dependencies WHERE source='camara'`).get()!.n),missingBefore:0,resolved:0,reused,failed:0,requests:0,remaining:Number(db.prepare(`SELECT count(DISTINCT parent_id) n FROM principal_proposal_dependencies WHERE source='camara' AND state<>'resolved'`).get()!.n),maxDepth};
  const run=startRun(db,'camara',Date.now(),600_000),client=options.clientFactory?.(run)??new OfficialHttp({source:'camara',save:raw=>saveRaw(db,run,options.rawDirectory,raw),timeoutMs:20_000,maxAttempts:3,delayMs:100,onAttempt:()=>heartbeat(db,run,Date.now(),600_000)});
  let cursor=0,resolved=0,failed=0,requests=0;
  try{
    const worker=async()=>{while(cursor<pending.length){const target=pending[cursor++]!;let result:Resolved|undefined;try{requests+=2;const [detail,themes]=await Promise.all([client.json(`${api}/proposicoes/${target.parentId}`),client.json(`${api}/proposicoes/${target.parentId}/temas`)]);result=parsePrincipalProposal(detail,themes,target.childId);if(result.proposal.externalId!==target.parentId)throw new Error(`ID retornado diverge de ${target.parentId}`);const nested=result.proposal.principalProposalId;transaction(db,()=>{db.prepare(`INSERT INTO principal_proposal_support(source,external_id,raw_id,payload,resolved_at) VALUES ('camara',?,?,?,?) ON CONFLICT(source,external_id) DO UPDATE SET raw_id=excluded.raw_id,payload=excluded.payload,resolved_at=excluded.resolved_at`).run(target.parentId,result!.proposal.rawId,JSON.stringify(result!.proposal),new Date().toISOString());db.prepare(`DELETE FROM principal_proposal_support_themes WHERE source='camara' AND proposal_id=?`).run(target.parentId);const insert=db.prepare(`INSERT INTO principal_proposal_support_themes(source,proposal_id,theme_key,raw_id,payload) VALUES ('camara',?,?,?,?)`);for(const theme of result!.themes)insert.run(target.parentId,theme.code,theme.rawId,JSON.stringify(theme));db.prepare(`UPDATE principal_proposal_dependencies SET state='resolved',attempts=attempts+1,last_error=NULL,updated_at=? WHERE source='camara' AND parent_id=?`).run(new Date().toISOString(),target.parentId);if(nested&&nested!==target.parentId&&target.depth<maxDepth)register(target.parentId,nested,target.depth+1)});local.add(target.parentId);if(nested&&nested!==target.parentId&&target.depth<maxDepth){if(local.has(nested))transaction(db,()=>db.prepare(`UPDATE principal_proposal_dependencies SET state='resolved',last_error=NULL,updated_at=? WHERE source='camara' AND child_id=? AND parent_id=?`).run(new Date().toISOString(),target.parentId,nested));else if(!visited.has(nested)){visited.add(nested);pending.push({parentId:nested,depth:target.depth+1,childId:target.parentId})}}resolved++}catch(error){failed++;transaction(db,()=>db.prepare(`UPDATE principal_proposal_dependencies SET state='failed',attempts=attempts+1,last_error=?,updated_at=? WHERE source='camara' AND parent_id=?`).run(error instanceof Error?error.message:String(error),new Date().toISOString(),target.parentId));}options.progress?.(`pais da Câmara: ${resolved+failed}/${pending.length}`)}};
    await Promise.all(Array.from({length:Math.min(concurrency,pending.length)},worker));
    transaction(db,()=>{const finished=new Date().toISOString();db.prepare(`UPDATE ingestion_runs SET status='published',finished_at=?,expected_count=?,roster_complete=1,reconciliation_json=? WHERE id=?`).run(finished,resolved,JSON.stringify({scope:'principal-proposal-support',missingBefore,resolved,failed,requests,maxDepth}),run);db.prepare('DELETE FROM job_locks WHERE run_id=?').run(run)});
  }catch(error){failRun(db,run,error instanceof Error?error.message:String(error));throw error}
  const remaining=Number(db.prepare(`SELECT count(DISTINCT parent_id) n FROM principal_proposal_dependencies WHERE source='camara' AND state<>'resolved'`).get()!.n);
  return{dependencies:Number(db.prepare(`SELECT count(*) n FROM principal_proposal_dependencies WHERE source='camara'`).get()!.n),missingBefore,resolved,reused,failed,requests,remaining,maxDepth};
}
