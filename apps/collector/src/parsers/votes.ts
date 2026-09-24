import type {Deliberation,LegislativeVote} from '@senadotracker/domain';

const arr=<T>(x:T|T[]|undefined):T[]=>x===undefined?[]:Array.isArray(x)?x:[x];
const idFromUri=(value:unknown)=>/\/(\d+)\/?$/.exec(String(value??''))?.[1]??null;
const fold=(value:unknown)=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const proposition=(row:any)=>row?.proposicao_??row;
const propositionId=(row:any)=>String(proposition(row)?.id??idFromUri(proposition(row)?.uri)??'')||null;

export function chamberProposalIdFromVoteId(value:unknown){return /^(\d+)-/.exec(String(value??''))?.[1]??null}

function exactDescriptionMatch(description:string,item:any){
  const row=proposition(item),type=fold(row?.siglaTipo),number=String(row?.numero??''),year=Number(row?.ano)||null,text=fold(description);
  if(!type||!number)return false;
  const aliases:Record<string,string>={PEC:'(?:PEC|PROPOSTA\\s+DE\\s+EMENDA\\s+A\\s+CONSTITUICAO)',REQ:'(?:REQ|REQUERIMENTO)',PLP:'(?:PLP|PROJETO\\s+DE\\s+LEI\\s+COMPLEMENTAR)',PL:'(?:PL|PROJETO\\s+DE\\s+LEI)',PDL:'(?:PDL|PROJETO\\s+DE\\s+DECRETO\\s+LEGISLATIVO)',MPV:'(?:MPV|MEDIDA\\s+PROVISORIA)'};
  const typePattern=aliases[type]??type,numberPattern=number.split('').join('[.\\s]?');
  if(!new RegExp(`(^|[^A-Z0-9])${typePattern}\\s*(?:N[^0-9A-Z]*)?${numberPattern}(?=$|[^0-9])`,'i').test(text))return false;
  return !year||new RegExp(`(?:/|,?\\s+DE\\s+)${year}(?=$|[^0-9])`,'i').test(text);
}

export function parseSenateVoteBatch(root:any,rawId:string,validIds:Set<string>,year:number){const deliberations:Deliberation[]=[];const votes:LegislativeVote[]=[];for(const row of arr(root?.ListaVotacoes?.Votacoes?.Votacao)){const id=String(row.CodigoSessaoVotacao);const date=String(row.DataSessao);if(!/^\d+$/.test(id)||!date.startsWith(String(year)))throw new Error('Votação Senado inválida');deliberations.push({source:'senado',externalId:id,year,date,recordedAt:row.HoraInicio?`${date}T${row.HoraInicio}:00`:null,chamberBody:'PLEN',description:String(row.DescricaoVotacao),result:row.Resultado?String(row.Resultado):null,approved:row.Resultado==='A'?true:row.Resultado?false:null,secret:row.Secreta==='S',proposalId:row.CodigoMateria?String(row.CodigoMateria):null,proposalLabel:row.DescricaoIdentificacaoMateria?String(row.DescricaoIdentificacaoMateria):null,proposalSummary:null,officialUrl:`https://legis.senado.leg.br/dadosabertos/materia/${row.CodigoMateria}`,rawId});for(const vote of arr(row.Votos?.VotoParlamentar)){const externalId=String(vote.CodigoParlamentar);if(!validIds.has(externalId)||row.Secreta==='S')continue;votes.push({source:'senado',deliberationId:id,externalId,vote:String(vote.Voto),description:vote.DescricaoVoto?String(vote.DescricaoVoto):null,party:vote.SiglaPartido?String(vote.SiglaPartido):null,uf:vote.SiglaUF?String(vote.SiglaUF):null,recordedAt:null,rawId})}}return{deliberations,votes}}

export function parseChamberVoteBatch(delibRoot:any,delibRawId:string,voteRoot:any,voteRawId:string,validIds:Set<string>,year:number,proposalLabels:ReadonlyMap<string,string>=new Map(),objectRoot:any={dados:[]},affectedRoot:any={dados:[]}){
  const objects=new Map<string,any[]>(),affected=new Map<string,any[]>();
  for(const row of arr(objectRoot?.dados)){const id=String((row as any).idVotacao??'');if(id)objects.set(id,[...(objects.get(id)??[]),proposition(row)])}
  for(const row of arr(affectedRoot?.dados)){const id=String((row as any).idVotacao??'');if(id)affected.set(id,[...(affected.get(id)??[]),proposition(row)])}
  const deliberations:Deliberation[]=arr(delibRoot?.dados).map((r:any)=>{
    const externalId=String(r.id),anchorProposalId=chamberProposalIdFromVoteId(externalId),last=r.ultimaApresentacaoProposicao,lastPresentationProposalId=last?.idProposicao?String(last.idProposicao):idFromUri(last?.uriProposicaoCitada),possibleRows=objects.get(externalId)??[],affectedRows=affected.get(externalId)??[],possibleObjectIds=[...new Set(possibleRows.map(propositionId).filter((id):id is string=>Boolean(id)))],affectedProposalIds=[...new Set(affectedRows.map(propositionId).filter((id):id is string=>Boolean(id)))],description=String(r.descricao??''),candidates=new Map<string,any>();
    for(const row of [...possibleRows,...affectedRows]){const id=propositionId(row);if(id)candidates.set(id,row)}
    if(anchorProposalId&&proposalLabels.has(anchorProposalId)){const match=/^([A-ZÀ-Ü-]+)\s+(\d+)(?:\/(\d{4}))?/.exec(proposalLabels.get(anchorProposalId)!);if(match)candidates.set(anchorProposalId,{id:anchorProposalId,siglaTipo:match[1],numero:match[2],ano:match[3]??0})}
    const exactPossible=[...new Map(possibleRows.flatMap(row=>{const id=propositionId(row);return id?[[id,row] as const]:[]})).entries()].filter(([,row])=>exactDescriptionMatch(description,row)).map(([id])=>id),fallbackCandidates=[...candidates].filter(([id])=>!possibleObjectIds.includes(id)),exactFallback=fallbackCandidates.filter(([,row])=>exactDescriptionMatch(description,row)).map(([id])=>id),actualVotedProposalId=exactPossible.length===1?exactPossible[0]!:exactPossible.length===0&&exactFallback.length===1?exactFallback[0]!:null,associationStatus=actualVotedProposalId?'actual_object_identified':possibleObjectIds.length?'candidates_only':affectedProposalIds.length?'affected_only':anchorProposalId?'anchor_only':'undetermined';
    return{source:'camara',externalId,year,date:String(r.data),recordedAt:r.dataHoraRegistro?String(r.dataHoraRegistro):null,chamberBody:String(r.siglaOrgao??''),description,result:r.aprovacao===1?'Aprovada':r.aprovacao===0?'Não aprovada':null,approved:r.aprovacao===1?true:r.aprovacao===0?false:null,secret:false,proposalId:null,proposalLabel:null,proposalSummary:null,officialUrl:String(r.uri),rawId:delibRawId,anchorProposalId,anchorProposalLabel:anchorProposalId?proposalLabels.get(anchorProposalId)??null:null,possibleObjectIds,affectedProposalIds,lastPresentationProposalId,lastPresentationLabel:last?.descricao?String(last.descricao):null,actualVotedProposalId,actualObjectEvidence:actualVotedProposalId?'official_description_exact':null,actualObjectConfidence:actualVotedProposalId?'high':'undetermined',associationStatus};
  });
  const ids=new Set(deliberations.map(d=>d.externalId)),singleId=deliberations.length===1?deliberations[0]!.externalId:null,votes:LegislativeVote[]=[];
  for(const r of arr(voteRoot?.dados) as any[]){const externalId=String(r.deputado_?.id??''),deliberationId=r.idVotacao?String(r.idVotacao):singleId;if(!deliberationId||!ids.has(deliberationId)||!validIds.has(externalId))continue;votes.push({source:'camara',deliberationId,externalId,vote:String(r.voto??r.tipoVoto),description:null,party:r.deputado_?.siglaPartido?String(r.deputado_.siglaPartido):null,uf:r.deputado_?.siglaUf?String(r.deputado_.siglaUf):null,recordedAt:r.dataHoraVoto?String(r.dataHoraVoto):r.dataRegistroVoto?String(r.dataRegistroVoto):null,rawId:voteRawId})}
  if(deliberations.some(d=>!d.date.startsWith(String(year))))throw new Error('Período Câmara inválido');
  return{deliberations,votes};
}
