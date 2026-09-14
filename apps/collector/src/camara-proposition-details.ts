import type { DatabaseSync } from 'node:sqlite';
import { failRun, publishComplement, startRun } from '@senadotracker/db';
import type { LegislativeComplement } from '@senadotracker/domain';
import { saveRaw } from './raw.ts';

type Json=Record<string,unknown>;
const api='https://dadosabertos.camara.leg.br/api/v2';
const ficha='https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=';
const text=(value:unknown)=>value===null||value===undefined||String(value).trim()===''?null:String(value).trim();
const idFromUri=(value:unknown)=>/\/(\d+)\/?$/.exec(String(value??''))?.[1]??null;
const decoded=<T>(bytes:Uint8Array)=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)) as {dados:T};
const values=(value:unknown):Json[]=>Array.isArray(value)?value.filter((item):item is Json=>Boolean(item)&&typeof item==='object'):[];

async function request(url:string,attempts=3){
  let last:unknown;
  for(let attempt=1;attempt<=attempts;attempt++)try{const response=await fetch(url,{signal:AbortSignal.timeout(8_000),headers:{Accept:'application/json, text/html;q=0.9','User-Agent':'Civica/0.1 (dados públicos legislativos)'}});const bytes=new Uint8Array(await response.arrayBuffer());if(!response.ok)throw new Error(`HTTP ${response.status}: ${url}`);return{url,bytes,fetchedAt:new Date().toISOString(),status:response.status,contentType:response.headers.get('content-type')??'application/octet-stream'}}catch(error){last=error;if(attempt<attempts)await new Promise(done=>setTimeout(done,attempt*300))}
  throw last;
}
type ResponseData=Awaited<ReturnType<typeof request>>;
async function optionalRequest(url:string){try{return await request(url,1)}catch{return null}}
function principalFromHtml(bytes:Uint8Array,id:string){const html=new TextDecoder('iso-8859-1').decode(bytes),block=/<p[^>]+id="colunaPrimeiroAutor"[^>]*>([\s\S]*?)<\/p>/i.exec(html)?.[1]??html,match=/fichadetramitacao\?idProposicao=(\d+)[^>]*>\s*([^<]+)/i.exec(block);if(!match||match[1]===id)return null;return{id:match[1]!,label:match[2]!.replace(/&nbsp;/gi,' ').replace(/&gt;/gi,'>').trim()}}
const complement=(id:string,rawId:string,record:Omit<LegislativeComplement,'source'|'proposalId'|'rawId'>):LegislativeComplement=>({source:'camara',proposalId:id,rawId,...record});

async function collectOne(db:DatabaseSync,id:string,rawDirectory:string){
  const run=startRun(db,'camara');
  try{
    const paths=[`proposicoes/${id}`,`proposicoes/${id}/temas`,`proposicoes/${id}/tramitacoes`,`proposicoes/${id}/relacionadas`,`proposicoes/${id}/autores`,`proposicoes/${id}/votacoes`];
    const responses=await Promise.all(paths.map(path=>optionalRequest(`${api}/${path}`))) as Array<ResponseData|null>;
    if(!responses[0])throw new Error(`Detalhe oficial indisponível para ${id}`);
    const html=await optionalRequest(`${ficha}${id}`),all=[...responses,html],rawIds:Array<string|null>=[];
    for(const response of all)rawIds.push(response?await saveRaw(db,run,rawDirectory,response):null);
    const detail=decoded<Json>(responses[0]!.bytes).dados,themes=responses[1]?decoded<Json[]>(responses[1].bytes).dados??[]:[],moves=responses[2]?decoded<Json[]>(responses[2].bytes).dados??[]:[],related=responses[3]?decoded<Json[]>(responses[3].bytes).dados??[]:[],authors=responses[4]?decoded<Json[]>(responses[4].bytes).dados??[]:[],votes=responses[5]?decoded<Json[]>(responses[5].bytes).dados??[]:[],records:LegislativeComplement[]=[];
    records.push(complement(id,rawIds[0]!,{externalKey:`proposal-detail:${id}`,kind:'proposal_detail',personExternalId:null,deliberationId:null,bodyId:idFromUri(detail.uriOrgaoNumerador),occurredAt:text(detail.dataApresentacao),label:`${text(detail.siglaTipo)??'Proposição'} ${text(detail.numero)??''}`.trim(),value:JSON.stringify(detail),officialUrl:`${api}/proposicoes/${id}`}));
    for(const item of themes)records.push(complement(id,rawIds[1]!,{externalKey:`theme:${id}:${item.codTema}`,kind:'theme',personExternalId:null,deliberationId:null,bodyId:null,occurredAt:null,label:text(item.tema)??`Tema ${item.codTema}`,value:JSON.stringify({code:text(item.codTema),relevance:text(item.relevancia)}),officialUrl:`${api}/proposicoes/${id}/temas`}));
    for(const [index,item] of authors.entries())records.push(complement(id,rawIds[4]!,{externalKey:`author-detail:${id}:${item.codTipo??index}:${item.id??item.nome}`,kind:'author_detail',personExternalId:text(item.id),deliberationId:null,bodyId:null,occurredAt:null,label:text(item.nome)??'Autoria publicada',value:JSON.stringify({code:text(item.codTipo),kind:text(item.tipo),order:index+1,party:text(item.siglaPartido),uf:text(item.siglaUf),uri:text(item.uri)}),officialUrl:`${api}/proposicoes/${id}/autores`}));
    for(const item of moves)records.push(complement(id,rawIds[2]!,{externalKey:`movement:${id}:${item.sequencia}`,kind:'movement',personExternalId:idFromUri(item.uriUltimoRelator),deliberationId:null,bodyId:idFromUri(item.uriOrgao),occurredAt:text(item.dataHora),label:text(item.descricaoTramitacao)??'Movimentação',value:JSON.stringify({code:text(item.codTipoTramitacao),situationCode:text(item.codSituacao),situation:text(item.descricaoSituacao),dispatch:text(item.despacho),body:text(item.siglaOrgao),url:text(item.url)}),officialUrl:text(item.url)??`${api}/proposicoes/${id}/tramitacoes`}));
    const relations=new Map<string,{id:string;label:string;origin:'api'|'official_page';relation:'principal'|'related'}>();
    for(const item of related){const relatedId=String(item.id??idFromUri(item.uri)??'');if(relatedId&&relatedId!==id)relations.set(relatedId,{id:relatedId,label:`${text(item.siglaTipo)??'Proposição'} ${text(item.numero)??''}${Number(item.ano)?`/${item.ano}`:''}`.trim(),origin:'api',relation:'related'})}
    const directPrincipal=idFromUri(detail.uriPropPrincipal);if(directPrincipal)relations.set(directPrincipal,{id:directPrincipal,label:'Proposição principal',origin:'api',relation:'principal'});
    if(html){const principal=principalFromHtml(html.bytes,id);if(principal)relations.set(principal.id,{...principal,origin:'official_page',relation:'principal'})}
    for(const relation of relations.values())records.push(complement(id,relation.origin==='official_page'?rawIds[6]!:rawIds[3]!,{externalKey:`relationship:${id}:${relation.relation}:${relation.id}`,kind:'relationship',personExternalId:null,deliberationId:null,bodyId:null,occurredAt:null,label:relation.label,value:JSON.stringify({relation:relation.relation,relatedId:relation.id,origin:relation.origin}),officialUrl:`${ficha}${relation.id}`}));
    if(text(detail.urlInteiroTeor))records.push(complement(id,rawIds[0]!,{externalKey:`document:${id}:inteiro-teor`,kind:'document',personExternalId:null,deliberationId:null,bodyId:null,occurredAt:null,label:'Inteiro teor',value:JSON.stringify({url:text(detail.urlInteiroTeor),type:'full_text'}),officialUrl:text(detail.urlInteiroTeor)!}));
    if(text(detail.urnFinal))records.push(complement(id,rawIds[0]!,{externalKey:`resulting-norm:${id}:${text(detail.urnFinal)}`,kind:'resulting_norm',personExternalId:null,deliberationId:null,bodyId:null,occurredAt:null,label:'Norma resultante',value:JSON.stringify({code:text(detail.urnFinal)}),officialUrl:text(detail.urlInteiroTeor)??`${api}/proposicoes/${id}`}));
    const voteFailures:string[]=[];
    for(const vote of votes){const voteId=String(vote.id??'');if(!voteId)continue;const voteUrl=`${api}/votacoes/${voteId}`,response=await optionalRequest(voteUrl);if(!response){voteFailures.push(voteId);continue}const rawId=await saveRaw(db,run,rawDirectory,response),voteDetail=decoded<Json>(response.bytes).dados,affected=values(voteDetail.proposicoesAfetadas),possible=values(voteDetail.objetosPossiveis);records.push(complement(id,rawId,{externalKey:`agenda-item:${id}:${voteId}`,kind:'agenda_item',personExternalId:null,deliberationId:voteId,bodyId:idFromUri(voteDetail.uriOrgao),occurredAt:text(voteDetail.dataHoraRegistro)??text(vote.dataHoraRegistro),label:text(voteDetail.descricao)??text(vote.descricao)??`Votação ${voteId}`,value:JSON.stringify({eventId:idFromUri(voteDetail.uriEvento),body:text(voteDetail.siglaOrgao),result:voteDetail.aprovacao,lastPresentation:text(voteDetail.ultimaApresentacaoProposicao)}),officialUrl:voteUrl}));for(const [effect,items] of [['affected',affected],['possible_object',possible]] as const)for(const [index,target] of items.entries())records.push(complement(id,rawId,{externalKey:`vote-effect:${id}:${voteId}:${effect}:${target.id??index}`,kind:'vote_effect',personExternalId:null,deliberationId:voteId,bodyId:null,occurredAt:text(voteDetail.dataHoraRegistro),label:text(target.titulo)??text(target.ementa)??`${effect} ${index+1}`,value:JSON.stringify({effect,relatedId:text(target.id)??idFromUri(target.uri),description:text(target.ementa)}),officialUrl:voteUrl}))}
    const unique=[...new Map(records.map(record=>[record.externalKey,record])).values()],counts=Object.fromEntries([...new Set(unique.map(record=>record.kind))].map(kind=>[kind,unique.filter(record=>record.kind===kind).length]));
    publishComplement(db,run,'camara',`proposal:${id}`,unique,{proposalId:id,counts,voteFailures,endpointFailures:paths.filter((_,index)=>!responses[index]),requests:paths.length+1+votes.length});
    return{id,counts,relationships:[...relations.values()],voteFailures};
  }catch(error){failRun(db,run,error instanceof Error?error.message:String(error));throw error}
}

export async function collectCamaraPropositionDetails(db:DatabaseSync,options:{ids:string[];rawDirectory:string}){const ids=[...new Set(options.ids.filter(id=>/^\d+$/.test(id)))];if(!ids.length)throw new Error('Informe ao menos um ID numérico da Câmara');const results=[];for(const id of ids)results.push(await collectOne(db,id,options.rawDirectory));return results}
