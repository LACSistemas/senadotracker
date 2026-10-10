import { proposalFunctionalGroup, type Proposal } from '@senadotracker/domain';
import type { JsonResponse } from './http.ts';

export type Json=Record<string,unknown>;
export type Theme={code:string;label:string;relevance:string|null;rawId:string};
export type Resolved={proposal:Proposal;themes:Theme[]};
export const text=(value:unknown)=>value===null||value===undefined||String(value).trim()===''?null:String(value).trim();
export const idFromUri=(value:unknown)=>/\/(\d+)\/?$/.exec(String(value??''))?.[1]??null;
export const items=(value:unknown):Json[]=>Array.isArray(value)?value.filter((item):item is Json=>Boolean(item)&&typeof item==='object'):[];

/** Parser puro do detalhe + temas de uma matéria-pai; compartilhado pelo caminho SQLite legado e pelo PostgreSQL. */
export function parsePrincipalProposal(detailResponse:JsonResponse,themesResponse:JsonResponse,discoveredByProposalId:string):Resolved{
  const root=detailResponse.data as Json,detail=(root.dados??{}) as Json,id=String(detail.id??'');
  if(!/^\d+$/.test(id))throw new Error('Detalhe da proposição-pai sem ID oficial');
  const type=text(detail.siglaTipo)??text(detail.descricaoTipo)??'Proposição',number=text(detail.numero),year=Number(detail.ano)||null,principalProposalId=idFromUri(detail.uriPropPrincipal);
  const proposal:Proposal={source:'camara',externalId:id,type,functionalGroup:proposalFunctionalGroup(type),number,year,label:[type,number].filter(Boolean).join(' ')+(year?`/${year}`:''),summary:text(detail.ementa),presentedAt:text(detail.dataApresentacao),status:text((detail.statusProposicao as Json|undefined)?.descricaoSituacao)??text(detail.descricaoSituacao),officialUrl:`https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${id}`,rawId:detailResponse.rawId,principalProposalId,previousProposalId:idFromUri(detail.uriPropAnterior),nextProposalId:idFromUri(detail.uriPropPosterior),relationshipEvidence:principalProposalId||detail.uriPropAnterior||detail.uriPropPosterior?'official_uri':null,catalogRole:'relationship_support',discoveredByProposalId};
  const themes=items((themesResponse.data as Json).dados).map((item,index)=>({code:text(item.codTema)??String(index),label:text(item.tema)??`Tema ${index+1}`,relevance:text(item.relevancia),rawId:themesResponse.rawId}));
  return{proposal,themes};
}
