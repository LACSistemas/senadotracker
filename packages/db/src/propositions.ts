import type { DatabaseSync } from 'node:sqlite';
import { searchText, type DataCoverage, type Deliberation, type LegislativeComplement, type LegislativeVote, type Profile, type Proposal, type ProposalAuthor, type Source } from '@senadotracker/domain';
import { groupRecordedPartyVotes } from './parties.ts';

export interface PropositionQuery { source?:Source; type?:string; year?:number; search?:string; author?:string; theme?:string; page?:number; pageSize?:number }
interface ProposalRow { batch_id:unknown; payload:unknown; scope:unknown; published_at:unknown; url:unknown; fetched_at:unknown; sha256:unknown }
interface ComplementRow { payload:unknown; batch_id:unknown; published_at:unknown }
const key=(batchId:string,proposalId:string)=>`${batchId}\u0000${proposalId}`;

function activeProposalRows(db:DatabaseSync,query:Pick<PropositionQuery,'source'|'type'|'year'>){
  const where:string[]=[],params:Array<string|number>=[];
  if(query.source){where.push('a.source=?');params.push(query.source)}
  if(query.type){where.push(`json_extract(p.payload,'$.type')=?`);params.push(query.type)}
  if(query.year!==undefined){where.push(`CAST(json_extract(p.payload,'$.year') AS INTEGER)=?`);params.push(query.year)}
  return db.prepare(`SELECT p.batch_id,p.payload,b.scope,b.published_at,r.url,r.fetched_at,r.sha256 FROM proposals p JOIN active_activity_publications a ON a.batch_id=p.batch_id JOIN activity_batches b ON b.id=p.batch_id JOIN raw_objects r ON r.id=p.raw_id ${where.length?`WHERE ${where.join(' AND ')}`:''}`).all(...params) as unknown as ProposalRow[];
}

function activeComplements(db:DatabaseSync,source:Source){
  return (db.prepare(`SELECT c.payload,b.id batch_id,b.published_at FROM legislative_complements c JOIN active_complement_publications a ON a.batch_id=c.batch_id JOIN complement_batches b ON b.id=c.batch_id WHERE a.source=?`).all(source) as unknown as ComplementRow[]).map(row=>({item:JSON.parse(String(row.payload)) as LegislativeComplement,batchId:String(row.batch_id),publishedAt:String(row.published_at)}));
}

function hydrateProposals(db:DatabaseSync,rows:ProposalRow[]){
  const parsed=rows.map(row=>({row,proposal:JSON.parse(String(row.payload)) as Proposal,batchId:String(row.batch_id)}));
  const wanted=new Set(parsed.map(value=>key(value.batchId,value.proposal.externalId)));
  const batchIds=[...new Set(parsed.map(value=>value.batchId))];
  const authorMap=new Map<string,ProposalAuthor[]>();
  if(batchIds.length){
    const placeholders=batchIds.map(()=>'?').join(',');
    for(const value of db.prepare(`SELECT batch_id,proposal_id,payload FROM proposal_authors WHERE batch_id IN (${placeholders}) ORDER BY batch_id,proposal_id,json_extract(payload,'$.order'),author_key`).all(...batchIds)){
      const mapKey=key(String(value.batch_id),String(value.proposal_id));if(!wanted.has(mapKey))continue;
      const list=authorMap.get(mapKey)??[];list.push(JSON.parse(String(value.payload)) as ProposalAuthor);authorMap.set(mapKey,list);
    }
  }
  const complementMap=new Map<string,LegislativeComplement[]>();
  for(const source of [...new Set(parsed.map(value=>value.proposal.source))])for(const value of activeComplements(db,source)){
    if(!value.item.proposalId)continue;
    const list=complementMap.get(`${source}\u0000${value.item.proposalId}`)??[];list.push(value.item);complementMap.set(`${source}\u0000${value.item.proposalId}`,list);
  }
  return parsed.map(({row,proposal,batchId})=>{
    const authors=authorMap.get(key(batchId,proposal.externalId))??[];
    const themes=(complementMap.get(`${proposal.source}\u0000${proposal.externalId}`)??[]).filter(item=>item.kind==='theme').map(item=>item.value??item.label);
    return {proposal,authors,themes,scope:String(row.scope),publishedAt:String(row.published_at),origin:{url:String(row.url),fetchedAt:String(row.fetched_at),sha256:String(row.sha256),batchId},search:[proposal.type,proposal.number,proposal.year,proposal.label,proposal.summary,proposal.status,...authors.map(author=>author.name),...themes].filter(Boolean).map(String).join(' ')};
  });
}

export function publishedPropositionCoverage(db:DatabaseSync){return(['senado','camara'] as Source[]).map(source=>{const batches=db.prepare(`SELECT b.id,b.scope,b.published_at,b.proposal_count,b.author_count FROM activity_batches b JOIN active_activity_publications a ON a.batch_id=b.id WHERE a.source=? ORDER BY b.published_at DESC`).all(source);const legislative=db.prepare(`SELECT b.id,b.year,b.published_at,b.deliberation_count,b.vote_count FROM legislative_batches b JOIN active_legislative_publications a ON a.batch_id=b.id WHERE a.source=? ORDER BY b.year DESC`).all(source);const extra=activeComplements(db,source);return{source,activityBatches:batches.map(row=>({batchId:String(row.id),scope:String(row.scope),publishedAt:String(row.published_at),proposals:Number(row.proposal_count),authors:Number(row.author_count)})),legislativeBatches:legislative.map(row=>({batchId:String(row.id),year:Number(row.year),publishedAt:String(row.published_at),deliberations:Number(row.deliberation_count),votes:Number(row.vote_count)})),complementKinds:[...new Set(extra.map(row=>row.item.kind))].sort()}})}

export function publishedPropositions(db:DatabaseSync,query:PropositionQuery={}){
  const page=query.page??1,pageSize=query.pageSize??20;if(!Number.isSafeInteger(page)||page<1||!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>100)throw new Error('Paginação inválida');if(query.year!==undefined&&(!Number.isInteger(query.year)||query.year<1800||query.year>2100))throw new Error('Ano inválido');
  const rows=hydrateProposals(db,activeProposalRows(db,query)).filter(row=>(!query.search||searchText(row.search).includes(searchText(query.search)))&&(!query.author||row.authors.some(author=>searchText(author.name).includes(searchText(query.author??''))))&&(!query.theme||row.themes.some(theme=>searchText(theme).includes(searchText(query.theme??''))))).sort((a,b)=>(b.proposal.year??0)-(a.proposal.year??0)||a.proposal.type.localeCompare(b.proposal.type,'pt-BR')||(a.proposal.number??'').localeCompare(b.proposal.number??'','pt-BR',{numeric:true})||a.proposal.source.localeCompare(b.proposal.source)||a.proposal.externalId.localeCompare(b.proposal.externalId));
  const start=(page-1)*pageSize,items=rows.slice(start,start+pageSize),types=[...new Set(rows.map(row=>row.proposal.type))].sort(),years=[...new Set(rows.flatMap(row=>row.proposal.year?[row.proposal.year]:[]))].sort((a,b)=>b-a);const coverage:DataCoverage={availability:rows.length?'available':'unavailable',source:query.source??'multiple',period:{from:years.at(-1)?String(years.at(-1)):null,to:years[0]?String(years[0]):null,grain:'year'},batchId:[...new Set(items.map(row=>row.origin.batchId))].join(',')||null,note:'Proposições dos lotes de atividade ativos; tema, autoria e tramitação só aparecem quando publicados.',sampleSize:rows.length};return{total:rows.length,page,pageSize,items,facets:{types,years},coverage};
}

export function publishedProposition(db:DatabaseSync,source:Source,id:string){
  const row=db.prepare(`SELECT p.batch_id,p.payload,b.scope,b.published_at,r.url,r.fetched_at,r.sha256 FROM proposals p JOIN active_activity_publications a ON a.batch_id=p.batch_id JOIN activity_batches b ON b.id=p.batch_id JOIN raw_objects r ON r.id=p.raw_id WHERE a.source=? AND p.external_id=? ORDER BY b.published_at DESC LIMIT 1`).get(source,id) as ProposalRow|undefined;if(!row)return null;
  const proposal=JSON.parse(String(row.payload)) as Proposal,batchId=String(row.batch_id);const authors=db.prepare(`SELECT payload FROM proposal_authors WHERE batch_id=? AND proposal_id=? ORDER BY json_extract(payload,'$.order'),author_key`).all(batchId,id).map(value=>JSON.parse(String(value.payload)) as ProposalAuthor);const allComplements=(['senado','camara'] as Source[]).flatMap(activeSource=>activeComplements(db,activeSource));const extra=allComplements.filter(value=>value.item.source===source&&value.item.proposalId===id);const themes=extra.filter(value=>value.item.kind==='theme').map(value=>value.item),movements=extra.filter(value=>value.item.kind==='movement'||value.item.kind==='situation').sort((a,b)=>(b.item.occurredAt??'').localeCompare(a.item.occurredAt??'')).map(value=>value.item),details=extra.filter(value=>['proposal_detail','matter_detail','author_detail','rapporteur_detail','amendment'].includes(value.item.kind)).map(value=>value.item);
  const deliberationRows=db.prepare(`SELECT d.source,d.payload,d.batch_id,b.published_at FROM deliberations d JOIN active_legislative_publications a ON a.batch_id=d.batch_id JOIN legislative_batches b ON b.id=d.batch_id WHERE (a.source=? AND json_extract(d.payload,'$.proposalId')=?) OR upper(trim(json_extract(d.payload,'$.proposalLabel')))=upper(trim(?))`).all(source,id,proposal.label);const profiles=new Map<string,Profile>();for(const profileSource of ['senado','camara'] as Source[])for(const value of db.prepare(`SELECT p.external_id,p.payload FROM profiles p JOIN active_publications a ON a.batch_id=p.batch_id WHERE a.source=?`).all(profileSource))profiles.set(`${profileSource}:${String(value.external_id)}`,JSON.parse(String(value.payload)) as Profile);
  const deliberations=deliberationRows.map(value=>{const voteSource=String(value.source) as Source,deliberation=JSON.parse(String(value.payload)) as Deliberation;const votes=db.prepare('SELECT payload FROM legislative_votes WHERE batch_id=? AND deliberation_id=? ORDER BY external_id').all(String(value.batch_id),deliberation.externalId).map(v=>JSON.parse(String(v.payload)) as LegislativeVote);const nominal=votes.map(vote=>({vote,profile:profiles.get(`${voteSource}:${vote.externalId}`)??null}));const counts=new Map<string,number>();for(const vote of votes)counts.set(vote.vote,(counts.get(vote.vote)??0)+1);const general=[...counts].map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value||a.label.localeCompare(b.label));const orientations=allComplements.filter(item=>item.item.source===voteSource&&item.item.deliberationId===deliberation.externalId&&item.item.kind==='orientation').map(item=>item.item);const total=votes.length;return{deliberation,nominal,general,parties:groupRecordedPartyVotes(votes).map(party=>({...party,votes:party.votes.map(vote=>({...vote,percentage:party.total?vote.value/party.total:null}))})),orientations,total,coverage:{availability:total?'available':'unavailable',source:voteSource,period:{from:deliberation.date,to:deliberation.date,grain:'snapshot'},batchId:String(value.batch_id),note:`Votação vinculada por ${voteSource===source?'identificador oficial':'tipo, número e ano coincidentes entre as Casas'}; somente votos individuais registrados.`,sampleSize:total} satisfies DataCoverage}}).sort((a,b)=>b.deliberation.date.localeCompare(a.deliberation.date));
  const coverage:DataCoverage={availability:'available',source,period:{from:proposal.presentedAt,to:proposal.presentedAt,grain:proposal.presentedAt?'snapshot':'unknown'},batchId,note:`Escopo publicado: ${String(row.scope)}. Campos complementares ausentes permanecem indisponíveis.`,sampleSize:1};return{proposal,authors,themes,movements,details,deliberations,coverage,origin:{url:String(row.url),fetchedAt:String(row.fetched_at),sha256:String(row.sha256),publishedAt:String(row.published_at),batchId}};
}
