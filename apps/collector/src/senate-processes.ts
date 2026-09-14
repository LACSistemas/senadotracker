import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { failRun, publishComplement, startRun } from '@senadotracker/db';
import type { LegislativeComplement } from '@senadotracker/domain';
import { saveRaw } from './raw.ts';

type Json=Record<string,unknown>;
const list=(value:unknown):Json[]=>Array.isArray(value)?value.filter((item):item is Json=>Boolean(item)&&typeof item==='object'):[];
const object=(value:unknown):Json=>value&&typeof value==='object'&&!Array.isArray(value)?value as Json:{};
const text=(value:unknown)=>value===null||value===undefined?'':String(value).trim();
const date=(value:unknown)=>{const valueText=text(value);return /^\d{4}-\d{2}-\d{2}/.test(valueText)?valueText.slice(0,10):null};
const detailUrl=(id:string)=>`https://legis.senado.leg.br/dadosabertos/materia/${id}.json`;
const processUrl=(id:string)=>`https://legis.senado.leg.br/dadosabertos/processo/${id}`;

async function fetchJson(url:string,cacheFile:string){
  try{const bytes=new Uint8Array(await readFile(cacheFile));return{url,bytes,fetchedAt:new Date().toISOString(),status:200,contentType:'application/json',cached:true}}
  catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error}
  let last:unknown;
  for(let attempt=1;attempt<=3;attempt++)try{
    const response=await fetch(url,{signal:AbortSignal.timeout(15_000),headers:{Accept:'application/json','User-Agent':'Civica/0.1 (dados publicos legislativos)'}}),bytes=new Uint8Array(await response.arrayBuffer());
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    JSON.parse(new TextDecoder().decode(bytes));await mkdir(resolve(cacheFile,'..'),{recursive:true});await writeFile(cacheFile,bytes);
    return{url,bytes,fetchedAt:new Date().toISOString(),status:response.status,contentType:response.headers.get('content-type')??'application/json',cached:false};
  }catch(error){last=error;if(attempt<3)await new Promise(done=>setTimeout(done,attempt*500))}
  throw new Error(`${url}: ${last instanceof Error?last.message:String(last)}`);
}

export function senateProcessId(document:unknown){
  const root=object(document),detail=object(root.DetalheMateria),matter=object(detail.Materia),identification=object(matter.IdentificacaoMateria);
  const direct=text(identification.IdentificacaoProcesso||identification.CodigoProcesso||matter.idProcesso);
  if(/^\d+$/.test(direct))return direct;
  const serialized=JSON.stringify(document),match=/"(?:IdentificacaoProcesso|CodigoProcesso|idProcesso)"\s*:\s*"?(\d+)/.exec(serialized);
  return match?.[1]??null;
}

export function parseSenateProcess(document:unknown,rawId:string,proposalId:string):LegislativeComplement[]{
  const process=object(document),officialUrl=`https://www25.senado.leg.br/web/atividade/materias/-/materia/${proposalId}`,records:LegislativeComplement[]=[];
  const add=(record:Omit<LegislativeComplement,'source'|'personExternalId'|'proposalId'|'deliberationId'|'bodyId'|'officialUrl'|'rawId'>)=>records.push({source:'senado',personExternalId:null,proposalId,deliberationId:null,bodyId:null,officialUrl,rawId,...record});
  add({externalKey:`process:${proposalId}`,kind:'matter_detail',occurredAt:date(process.dataInicioEfetivo),label:text(process.identificacao)||`Matéria ${proposalId}`,value:JSON.stringify({processId:process.id,type:text(process.sigla),number:text(process.numero),year:Number(process.ano)||null,summary:text(object(process.conteudo).ementa)||null,presentedAt:date(process.dataInicioEfetivo),status:text(process.situacaoAtual)||null,lastUpdated:process.dthUltimaAtualizacao,law:process.normaGerada??null,officialUrl})});
  const sourceDocument=object(process.documento);
  if(text(sourceDocument.url))add({externalKey:`document:${proposalId}:${text(sourceDocument.id)||'original'}`,kind:'document',occurredAt:date(sourceDocument.dataApresentacao),label:text(sourceDocument.tipo)||'Texto inicial',value:JSON.stringify({code:text(sourceDocument.id),type:text(sourceDocument.siglaTipo),url:text(sourceDocument.url),indexing:text(sourceDocument.indexacao)})});
  for(const [index,author] of list(sourceDocument.autoria).entries())add({externalKey:`author:${proposalId}:${text(author.codigoParlamentar)||text(author.autor)||index}`,kind:'author_detail',occurredAt:null,label:text(author.autor)||'Autor publicado',value:JSON.stringify({personExternalId:text(author.codigoParlamentar)||null,kind:text(author.descricaoTipo),order:author.ordem??index+1,party:text(author.siglaPartido)||null,uf:text(author.uf)||null})});
  for(const classification of list(process.classificacoes)){const code=text(classification.codigo),label=text(classification.descricaoHierarquia)||text(classification.descricao);if(label)add({externalKey:`process-theme:${proposalId}:${code||label}`,kind:'theme',occurredAt:null,label,value:JSON.stringify({code,description:text(classification.descricao)})})}
  for(const relation of list(process.processosApensados)){const relatedId=text(relation.codigoMateria)||text(relation.id),label=text(relation.identificacao)||`Processo ${relatedId}`;if(relatedId)add({externalKey:`relationship:${proposalId}:attached:${relatedId}`,kind:'relationship',occurredAt:date(relation.dataApensamento),label,value:JSON.stringify({relation:'attached',relatedId,detachedAt:date(relation.dataDesapensamento),description:text(relation.tipoApensamento)})})}
  for(const relation of list(process.processosRelacionados)){const relatedId=text(relation.codigoMateria)||text(relation.idOutroProcesso),label=[text(relation.sigla),text(relation.numero),text(relation.ano)].filter(Boolean).join(' ')||`Processo ${relatedId}`;if(relatedId)add({externalKey:`relationship:${proposalId}:${text(relation.tipoRelacao)||'related'}:${relatedId}`,kind:'relationship',occurredAt:null,label,value:JSON.stringify({relation:text(relation.tipoRelacao)||'related',relatedId,house:text(relation.casaIdentificadora)})})}
  for(const [index,number] of list(process.outrosNumeros).entries()){const label=[text(number.sigla),text(number.numero),text(number.ano)].filter(Boolean).join(' ');if(label)add({externalKey:`relationship:${proposalId}:other-number:${text(number.idOutroProcesso)||index}`,kind:'relationship',occurredAt:null,label,value:JSON.stringify({relation:'other_number',relatedId:text(number.codigoMateria)||null,processId:text(number.idOutroProcesso)||null,house:text(number.casaIdentificadora)})})}
  for(const dispatch of list(process.despachos)){for(const action of list(dispatch.providencias)){for(const destination of list(action.unidadesDestinatarias)){const body=object(destination.colegiado),bodyId=text(body.codigo),bodyLabel=text(body.nome)||text(body.sigla);if(bodyLabel)add({externalKey:`body:${proposalId}:${text(dispatch.id)}:${text(action.id)}:${bodyId}`,kind:'body',occurredAt:date(dispatch.data),label:bodyLabel,value:JSON.stringify({code:bodyId,acronym:text(body.sigla),action:text(action.descricao),analysis:text(destination.tipoAnaliseDeliberacao),order:destination.ordem})})}}}
  const norm=object(process.normaGerada);if(Object.keys(norm).length)add({externalKey:`resulting-norm:${proposalId}:${text(norm.id)||text(norm.numero)||'published'}`,kind:'resulting_norm',occurredAt:date(norm.data),label:text(norm.identificacao)||text(norm.descricao)||'Norma gerada',value:JSON.stringify(norm)});
  for(const [autuationIndex,autuation] of list(process.autuacoes).entries()){
    for(const situation of list(autuation.situacoes)){const id=text(situation.idTipo)||text(situation.sigla),label=text(situation.descricao);if(label)add({externalKey:`process-situation:${proposalId}:${autuationIndex}:${id}:${date(situation.inicio)??''}`,kind:'situation',occurredAt:date(situation.inicio),label,value:date(situation.fim)?`até ${date(situation.fim)}`:null})}
    for(const report of list(autuation.informesLegislativos)){const id=text(report.id),label=text(report.descricao);if(label)add({externalKey:`process-report:${proposalId}:${id}`,kind:'movement',occurredAt:date(report.data),label,value:null})}
    for(const movement of list(autuation.movimentacoes)){const id=text(movement.id),origin=object(movement.enteOrigem),destination=object(movement.enteDestino),from=text(origin.nome)||text(origin.sigla),to=text(destination.nome)||text(destination.sigla),label=from&&to?`Enviado de ${from} para ${to}`:to?`Recebido por ${to}`:'Movimentação administrativa';add({externalKey:`process-movement:${proposalId}:${id}`,kind:'movement',occurredAt:date(movement.dataEnvio)||date(movement.dataRecebimento),label,value:null})}
  }
  return [...new Map(records.map(record=>[record.externalKey,record])).values()];
}

export async function collectSenateProcesses(db:DatabaseSync,options:{year:number;rawDirectory:string;cacheDirectory:string;ids?:string[];dryRun?:boolean;progress?:(message:string)=>void}){
  if(!Number.isInteger(options.year)||options.year<2001||options.year>2100)throw new Error('Ano de processos inválido');
  const rows=db.prepare(`SELECT p.external_id id FROM proposals p JOIN active_activity_publications a ON a.batch_id=p.batch_id WHERE a.source='senado' AND CAST(json_extract(p.payload,'$.year') AS INTEGER)=? UNION SELECT json_extract(d.payload,'$.proposalId') id FROM deliberations d JOIN active_legislative_publications a ON a.batch_id=d.batch_id WHERE a.source='senado' AND CAST(strftime('%Y',d.date) AS INTEGER)=? AND json_extract(d.payload,'$.proposalId') IS NOT NULL`).all(options.year,options.year);
  const available=new Set(rows.map(row=>text(row.id)).filter(id=>/^\d+$/.test(id))),requested=options.ids?.length?[...new Set(options.ids)]:[...available];
  if(!requested.length)throw new Error(`Nenhuma matéria do Senado encontrada nas votações de ${options.year}`);for(const id of requested)if(!/^\d+$/.test(id))throw new Error(`Identificador de matéria inválido: ${id}`);
  let runId:string|null=null;const records:LegislativeComplement[]=[],failures:Array<{id:string;error:string}>=[];
  try{
    if(!options.dryRun)runId=startRun(db,'senado');
    for(const [index,id] of requested.entries())try{
      options.progress?.(`Senado processos ${index+1}/${requested.length}: matéria ${id}`);
      const detail=await fetchJson(detailUrl(id),resolve(options.cacheDirectory,String(options.year),`${id}-detail.json`)),detailDocument=JSON.parse(new TextDecoder().decode(detail.bytes)),processId=senateProcessId(detailDocument);
      if(!processId)throw new Error('identificador do processo ausente no detalhe da matéria');
      const process=await fetchJson(processUrl(processId),resolve(options.cacheDirectory,String(options.year),`${id}-process.json`)),processDocument=JSON.parse(new TextDecoder().decode(process.bytes));
      if(!options.dryRun)await saveRaw(db,runId!,options.rawDirectory,detail);
      const rawId=options.dryRun?`dry:senado-process:${id}`:await saveRaw(db,runId!,options.rawDirectory,process);records.push(...parseSenateProcess(processDocument,rawId,id));
    }catch(error){failures.push({id,error:error instanceof Error?error.message:String(error)})}
    const covered=new Set(records.map(record=>record.proposalId)).size,result={year:options.year,requested:requested.length,covered,records:records.length,failures,published:false};
    if(!covered)throw new Error(`Nenhum processo do Senado foi coletado: ${JSON.stringify(failures)}`);
    if(!options.dryRun){publishComplement(db,runId!,'senado',`processes-${options.year}`,records,{year:options.year,requested:requested.length,covered,failures,source:'https://legis.senado.leg.br/dadosabertos/processo/{idProcesso}'});result.published=true}
    return result;
  }catch(error){if(runId)failRun(db,runId,error instanceof Error?error.message:String(error));throw error}
}
