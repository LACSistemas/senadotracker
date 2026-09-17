import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { startRun, failRun, heartbeat, listPublished, publishActivity } from '@senadotracker/db';
import type { LegislativeAppointment, Proposal, ProposalAuthor, Source } from '@senadotracker/domain';
import { saveRaw } from './raw.ts';
import { OfficialHttp } from './http.ts';

const idFromUri=(value:unknown)=>typeof value==='string'?value.split('/').filter(Boolean).at(-1)??null:null;
const text=(v:unknown)=>typeof v==='string'&&v.trim()?v.trim():null;
async function evidence(db:DatabaseSync,run:string,rawDir:string,path:string,url:string){const bytes=await readFile(path);const rawId=await saveRaw(db,run,rawDir,{url,fetchedAt:new Date().toISOString(),status:200,contentType:'application/json',bytes});return{rawId,data:JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,'')) as any}}

export async function collectActivity(db:DatabaseSync,source:Source,dataDir:string,progress:(s:string)=>void=()=>{}){
 const run=startRun(db,source);try{
  const proposals:Proposal[]=[];const authors:ProposalAuthor[]=[];const appointments:LegislativeAppointment[]=[];
  if(source==='camara'){
   const p=await evidence(db,run,resolve(dataDir,'raw'),resolve(dataDir,'research/camara-proposicoes-2026.json'),'https://dadosabertos.camara.leg.br/arquivos/proposicoes/json/proposicoes-2026.json');
   const a=await evidence(db,run,resolve(dataDir,'raw'),resolve(dataDir,'research/camara-autores-2026.json'),'https://dadosabertos.camara.leg.br/arquivos/proposicoesAutores/json/proposicoesAutores-2026.json');
   const o=await evidence(db,run,resolve(dataDir,'raw'),resolve(dataDir,'research/camara-orgaos-membros-L57.json'),'https://dadosabertos.camara.leg.br/arquivos/orgaosDeputados/json/orgaosDeputados-L57.json');
   for(const x of p.data.dados){const status=x.ultimoStatus??{},year=Number(x.ano)||null,number=x.numero==null?null:String(x.numero),type=String(x.siglaTipo??x.descricaoTipo??'');proposals.push({source,externalId:String(x.id),type,number,year,label:[type,number].filter(Boolean).join(' ')+(year?`/${year}`:''),summary:text(x.ementa),presentedAt:text(x.dataApresentacao),status:text(status.descricaoSituacao),officialUrl:`https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${x.id}`,rawId:p.rawId});const relator=idFromUri(status.uriRelator);if(relator)appointments.push({source,externalId:`relator:${x.id}:${relator}:${status.sequencia??''}`,personExternalId:relator,kind:'rapporteurship',bodyId:status.codOrgao==null?null:String(status.codOrgao),bodyLabel:text(status.siglaOrgao),role:'Relator',start:text(status.data)?.slice(0,10)??null,end:null,status:text(status.descricaoSituacao),proposalId:String(x.id),officialUrl:`https://dadosabertos.camara.leg.br/api/v2/proposicoes/${x.id}`,rawId:p.rawId})}
   for(const x of a.data.dados)authors.push({proposalId:String(x.idProposicao),externalId:idFromUri(x.uriAutor),name:String(x.nomeAutor??'Autor não identificado'),party:text(x.siglaPartidoAutor),uf:text(x.siglaUFAutor),kind:String(x.tipoAutor??'não informado'),primary:x.proponente==null?null:String(x.proponente).toLowerCase()==='sim',order:Number.isFinite(Number(x.ordemAssinatura))?Number(x.ordemAssinatura):null,rawId:a.rawId});
   for(const x of o.data.dados){const person=idFromUri(x.uriDeputado);if(person)appointments.push({source,externalId:`orgao:${idFromUri(x.uriOrgao)}:${person}:${x.dataInicio??''}:${x.cargo??''}`,personExternalId:person,kind:String(x.cargo??'').toLowerCase().includes('presidente')?'office':'commission',bodyId:idFromUri(x.uriOrgao),bodyLabel:text(x.siglaOrgao)??text(x.nomeOrgao),role:String(x.cargo??'Membro'),start:text(x.dataInicio),end:text(x.dataFim),status:x.dataFim?'encerrado':'atual',proposalId:null,officialUrl:String(x.uriOrgao??'https://dadosabertos.camara.leg.br/api/v2/orgaos'),rawId:o.rawId})}
  }else{
   const roster=listPublished(db,{source:'senado',page:1,pageSize:100});
   for(let page=2;roster.items.length<roster.total;page++)roster.items.push(...listPublished(db,{source:'senado',page,pageSize:100}).items);
   if(roster.total!==81||roster.items.length!==roster.total)throw new Error(`Cadastro ativo do Senado incompleto: ${roster.items.length}/${roster.total}`);
   const client=new OfficialHttp({source:'senado',save:raw=>saveRaw(db,run,resolve(dataDir,'raw'),raw),timeoutMs:30_000,maxAttempts:3,delayMs:100,onAttempt:()=>heartbeat(db,run,Date.now(),600_000)});
   const proposalMap=new Map<string,Proposal>(),authorMap=new Map<string,ProposalAuthor>(),appointmentKeys=new Set<string>();
   const array=(value:any)=>value==null?[]:Array.isArray(value)?value:[value];
   const addProposal=(matter:any,rawId:string)=>{if(!matter?.Codigo)return null;const id=String(matter.Codigo);if(!proposalMap.has(id))proposalMap.set(id,{source,externalId:id,type:String(matter.Sigla??''),number:text(matter.Numero),year:Number(matter.Ano)||null,label:String(matter.DescricaoIdentificacao??`${matter.Sigla??''} ${matter.Numero??''}/${matter.Ano??''}`.trim()),summary:text(matter.Ementa),presentedAt:text(matter.Data),status:null,officialUrl:`https://www25.senado.leg.br/web/atividade/materias/-/materia/${id}`,rawId});return id};
   for(const [index,profile] of roster.items.entries()){
    const id=profile.externalId,base=`https://legis.senado.leg.br/dadosabertos/senador/${id}`;
    const [au,re,co,ca]=await Promise.all([client.json(`${base}/autorias.json`),client.json(`${base}/relatorias.json`),client.json(`${base}/comissoes.json`),client.json(`${base}/cargos.json`)]);
    for(const row of array((au.data as any)?.MateriasAutoriaParlamentar?.Parlamentar?.Autorias?.Autoria)){const proposalId=addProposal(row?.Materia,au.rawId);if(!proposalId)continue;authorMap.set(`${proposalId}:${id}`,{proposalId,externalId:id,name:profile.name,party:profile.party,uf:profile.uf,kind:'Parlamentar',primary:String(row.IndicadorAutorPrincipal??'').toLowerCase()==='sim',order:null,rawId:au.rawId})}
    for(const row of array((re.data as any)?.MateriasRelatoriaParlamentar?.Parlamentar?.Relatorias?.Relatoria)){const proposalId=addProposal(row?.Materia,re.rawId);if(!proposalId)continue;const key=`relator:${proposalId}:${id}:${row.DataDesignacao??''}:${row.Comissao?.Codigo??''}`;if(appointmentKeys.has(key))continue;appointmentKeys.add(key);appointments.push({source,externalId:key,personExternalId:id,kind:'rapporteurship',bodyId:text(row.Comissao?.Codigo),bodyLabel:text(row.Comissao?.Sigla),role:String(row.DescricaoTipoRelator??'Relator'),start:text(row.DataDesignacao),end:text(row.DataDestituicao),status:text(row.DescricaoMotivoDestituicao),proposalId,officialUrl:`https://www25.senado.leg.br/web/atividade/materias/-/materia/${proposalId}`,rawId:re.rawId})}
    for(const row of array((co.data as any)?.MembroComissaoParlamentar?.Parlamentar?.MembroComissoes?.Comissao)){const info=row?.IdentificacaoComissao??{},key=`comissao:${info.CodigoComissao??''}:${id}:${row.DataInicio??''}:${row.DescricaoParticipacao??''}`;if(appointmentKeys.has(key))continue;appointmentKeys.add(key);appointments.push({source,externalId:key,personExternalId:id,kind:'commission',bodyId:text(info.CodigoComissao),bodyLabel:text(info.SiglaComissao)??text(info.NomeComissao),role:String(row.DescricaoParticipacao??'Membro'),start:text(row.DataInicio),end:text(row.DataFim),status:row.DataFim?'encerrado':'atual',proposalId:null,officialUrl:`${base}/comissoes`,rawId:co.rawId})}
    for(const row of array((ca.data as any)?.CargoParlamentar?.Parlamentar?.Cargos?.Cargo)){const info=row?.IdentificacaoComissao??{},key=`cargo:${info.CodigoComissao??''}:${id}:${row.CodigoCargo??''}:${row.DataInicio??''}`;if(appointmentKeys.has(key))continue;appointmentKeys.add(key);appointments.push({source,externalId:key,personExternalId:id,kind:'office',bodyId:text(info.CodigoComissao),bodyLabel:text(info.SiglaComissao)??text(info.NomeComissao),role:String(row.DescricaoCargo??'Cargo'),start:text(row.DataInicio),end:text(row.DataFim),status:row.DataFim?'encerrado':'atual',proposalId:null,officialUrl:`${base}/cargos`,rawId:ca.rawId})}
    progress(`senado: ${index+1}/${roster.total} parlamentares`);
   }
   proposals.push(...proposalMap.values());authors.push(...authorMap.values());
  }
  const proposalIds=new Set(proposals.map(item=>item.externalId));
  for(let index=authors.length-1;index>=0;index--)if(!proposalIds.has(authors[index]!.proposalId))authors.splice(index,1);
  appointments.forEach((item,index)=>item.externalId=`${item.externalId}:${index}`);
  publishActivity(db,run,source,source==='camara'?'2026-L57':'current-roster-person-activity',proposals,authors,appointments,[]);
  if(source==='senado')db.prepare("DELETE FROM active_activity_publications WHERE source='senado' AND scope LIKE 'amostra-%'").run();
  progress(`${source}: ${proposals.length} proposições, ${authors.length} autorias, ${appointments.length} atuações, 0 vínculos normativos explícitos`);return{runId:run,proposals:proposals.length,authors:authors.length,appointments:appointments.length};
 }catch(e){failRun(db,run,e instanceof Error?e.message:String(e));throw e}
}
