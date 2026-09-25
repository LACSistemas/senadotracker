import Link from 'next/link';
import type { DataCoverage } from '@senadotracker/domain';
import { ArrowLeft, Building2, Landmark, MapPin, TrendingUp, Trophy, Users } from 'lucide-react';
import { supplierGlobalDetail, supplierGlobalStory, supplierNetwork } from '@/lib/data';
import { LegislativeSubnav } from '@/components/legislative-subnav';
import { EmptyState } from '@/components/empty-state';
import { MultiLineChart, RankedBars } from '@/components/charts';
import { BrazilValueMap } from '@/components/brazil-state-map';
import { ContractCard, FinancialLadder, RelationSourceBar, RelationshipFingerprint, TwoRelationsPanel, type ContractCardData, type LadderRung } from '@/components/supplier-dossier';
import { cn } from '@/lib/utils';

export const dynamic='force-dynamic';
const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const pct=(value:number|null)=>value===null?'—':`${(value*100).toFixed(1)}%`;
const months=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
type Params=Record<string,string|string[]|undefined>;
const scalar=(v:string|string[]|undefined)=>typeof v==='string'?v:undefined;
const houseName=(institution:string)=>institution==='CAMARA'?'Câmara dos Deputados':institution==='SENADO'?'Senado Federal':institution;

export default async function GlobalSupplierPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Params>}){
  const {id}=await params,p=await searchParams,data=supplierGlobalDetail(id);
  if(data.status==='unavailable')return <><LegislativeSubnav/><main className="page-shell py-12"><EmptyState title="Fornecedor indisponível" description={data.message}/></main></>;
  if(!data.data)return <><LegislativeSubnav/><main className="page-shell py-12"><EmptyState title="Fornecedor não encontrado" description="Não há uma identidade pública compatível com este identificador."/></main></>;
  const detail=data.data;
  const parliamentaryRows=detail.parliamentary as Array<{year:number;institution:string;net_value_scaled:number|null;records:number;parliamentarians:number;ufs:number;parties:number}>;
  const institutionalRows=detail.institutional as Array<{year:number;institution:string;committed_scaled:number|null;liquidated_scaled:number|null;paid_scaled:number|null}>;
  const contracts=detail.contracts as Array<{id:string;institution:string;contract_number:string|null;contract_year:number|null;object:string|null;signed_at:string|null;original_value_scaled:number|null;current_published_value_scaled:number|null;current_value_semantics:string|null}>;
  const movements=detail.movements as Array<{institution:string;phase:string;amount:number;records:number}>;

  const institutionalRoles=['INSTITUTIONAL_CONTRACT','INSTITUTIONAL_PAYMENT','INSTITUTIONAL_TENDER'];
  const hasParliamentary=detail.roles.some(role=>String(role.role)==='PARLIAMENTARY_EXPENSE');
  const hasChamberInstitutional=detail.roles.some(role=>institutionalRoles.includes(String(role.role))&&String(role.institution)==='CAMARA');
  const hasSenateInstitutional=detail.roles.some(role=>institutionalRoles.includes(String(role.role))&&String(role.institution)==='SENADO');
  const hasInstitutional=hasChamberInstitutional||hasSenateInstitutional;
  const totalParliamentaryCents=parliamentaryRows.reduce((sum,row)=>sum+Number(row.net_value_scaled??0),0);
  const totalPaidCents=institutionalRows.reduce((sum,row)=>sum+Number(row.paid_scaled??0),0);
  const totalContractedCents=contracts.reduce((sum,row)=>sum+Number(row.current_published_value_scaled??row.original_value_scaled??0),0);

  // Frase-regra determinística por combinação de papéis (roles), sem inferência de LLM e sem omitir universos sem cobertura.
  const relationFragments=[hasParliamentary?'recebe pagamentos de gabinetes parlamentares':null,[hasChamberInstitutional&&'pela Câmara dos Deputados',hasSenateInstitutional&&'pelo Senado Federal'].filter(Boolean).length?`é contratada ${[hasChamberInstitutional&&'pela Câmara dos Deputados',hasSenateInstitutional&&'pelo Senado Federal'].filter(Boolean).join(' e ')}`:null].filter((v):v is string=>v!==null);
  const heroSentence=relationFragments.length?`${relationFragments[0]![0]!.toUpperCase()}${relationFragments[0]!.slice(1)}${relationFragments.length>1?` e ${relationFragments[1]}`:''}.`:'Vínculo com o Congresso ainda não classificado por papel.';

  const availableYears=[...new Set([...parliamentaryRows,...institutionalRows].map(row=>Number(row.year)))].sort((a,b)=>b-a);
  const requestedYear=Number(scalar(p.ano));
  const selectedYear=availableYears.includes(requestedYear)?requestedYear:(availableYears[0]??null);
  const yearParlRows=selectedYear===null?[]:parliamentaryRows.filter(row=>Number(row.year)===selectedYear);
  // parlamentares soma entre Casas (pessoas distintas por Casa); UFs/partidos usam o maior valor entre Casas, pois os conjuntos podem se sobrepor (mesmo partido/UF nas duas Casas) e a fonte não permite deduplicar.
  const yearParliamentarians=yearParlRows.reduce((sum,row)=>sum+Number(row.parliamentarians??0),0);
  const yearUfs=Math.max(0,...yearParlRows.map(row=>Number(row.ufs??0)));
  const yearParties=Math.max(0,...yearParlRows.map(row=>Number(row.parties??0)));
  const yearHouses=new Set(yearParlRows.map(row=>String(row.institution)));

  const coverage=(sampleSize:number|null,note:string):DataCoverage=>({availability:'available',source:'multiple',period:{from:null,to:null,grain:'unknown'},batchId:detail.revision?.id??null,sampleSize,note});
  const institutionalCoverage=(institution:string,sampleSize:number|null,note:string):DataCoverage=>institution==='CAMARA'?{availability:'partial',source:'multiple',period:{from:null,to:null,grain:'unknown'},batchId:detail.revision?.id??null,sampleSize,note:`${note} Execução institucional da Câmara está em backfill/reconciliação — não é um total fechado.`}:coverage(sampleSize,note);

  const ladderFor=(institution:'CAMARA'|'SENADO'):LadderRung[]=>{
    const contractedCents=contracts.filter(row=>row.institution===institution).reduce((sum,row)=>sum+Number(row.current_published_value_scaled??row.original_value_scaled??0),0);
    const phase=(name:string)=>movements.find(row=>row.institution===institution&&row.phase===name);
    return [
      {label:'Contratado (atual publicado)',valueCents:contracts.some(row=>row.institution===institution)?contractedCents:null},
      {label:'Empenhado',valueCents:phase('commitment')?Number(phase('commitment')!.amount):null},
      {label:'Liquidado',valueCents:phase('liquidation')?Number(phase('liquidation')!.amount):null},
      {label:'Pago',valueCents:phase('payment')?Number(phase('payment')!.amount):null,primary:true},
    ];
  };

  const contractCards:ContractCardData[]=contracts.map(row=>({id:String(row.id),institution:houseName(String(row.institution)),number:`${row.contract_number??'Nº não publicado'}${row.contract_year?`/${row.contract_year}`:''}`,object:row.object??'',originalCents:row.original_value_scaled,currentCents:row.current_published_value_scaled,semantics:row.current_value_semantics,signedAt:row.signed_at}));

  // Enriquecimento (antes classificado como Tier B): as tabelas abaixo já são chaveadas pelo supplier_id global, sem precisar de bridge por CNPJ+fonte.
  const storyResult=supplierGlobalStory(id,selectedYear);
  const story=storyResult.status==='available'?storyResult.data:null;
  const networkResult=supplierNetwork(id,{...(selectedYear!==null?{year:selectedYear}:{}),house:'all',limit:100});
  const payers=networkResult.status==='available'&&networkResult.data?networkResult.data.parliamentarians:[];
  const payersTotalCents=networkResult.status==='available'&&networkResult.data?networkResult.data.totalCents:0;
  const top1Share=payers.length&&payersTotalCents?payers[0]!.valueCents/payersTotalCents:null;
  const top5Share=payers.length&&payersTotalCents?payers.slice(0,5).reduce((sum,row)=>sum+row.valueCents,0)/payersTotalCents:null;
  const concentrationSentence=top1Share===null?'Sem cobertura suficiente para calcular concentração por parlamentar.':top1Share>.5?`Um único parlamentar responde por ${pct(top1Share)} dos pagamentos observados em ${selectedYear}.`:`Nenhum parlamentar concentra mais de ${pct(top1Share)} dos pagamentos observados em ${selectedYear}.`;

  const sumByMonth=(rows:Array<{year:number;month:number;value:number}>)=>{const map=new Map<string,number>();for(const row of rows){const key=`${row.year}-${String(row.month).padStart(2,'0')}`;map.set(key,(map.get(key)??0)+Number(row.value??0))}return map};
  const parlByMonth=sumByMonth((story?.monthly.parliamentary??[]) as Array<{year:number;month:number;value:number}>);
  const instByMonth=sumByMonth((story?.monthly.institutional??[]) as Array<{year:number;month:number;value:number}>);
  const timelineKeys=[...new Set([...parlByMonth.keys(),...instByMonth.keys()])].sort();
  // Série omitida por completo quando o universo não se aplica a este fornecedor; dentro de um universo aplicável, mês sem linha vira null (lacuna), nunca 0.
  const timelineData=timelineKeys.map(key=>{const [y,m]=key.split('-') as [string,string],values=[];if(hasParliamentary)values.push({label:'Parlamentar',value:parlByMonth.has(key)?parlByMonth.get(key)!/100:null,color:'var(--chart-1)'});if(hasInstitutional)values.push({label:'Institucional',value:instByMonth.has(key)?instByMonth.get(key)!/100:null,color:'var(--chart-2)'});return{label:`${months[Number(m)-1]}/${y.slice(2)}`,values}});

  const ufTotals=new Map<string,number>(),partySet=new Set<string>(),sourceSet=new Set<string>();
  for(const row of payers){if(row.uf)ufTotals.set(row.uf,(ufTotals.get(row.uf)??0)+row.valueCents);if(row.party)partySet.add(row.party);sourceSet.add(row.source)}
  const ufValues=[...ufTotals.entries()].map(([label,valueCents])=>({label,valueCents}));
  const topUf=[...ufTotals.entries()].sort((a,b)=>b[1]-a[1])[0];
  const reachSentence=!ufValues.length?'Sem alcance geográfico observado neste recorte.':ufTotals.size===1?`100% do valor identificado vem de ${topUf![0]}.`:topUf&&payersTotalCents&&topUf[1]/payersTotalCents>.5?`${pct(topUf[1]/payersTotalCents)} do valor identificado vem de ${topUf![0]}.`:`Alcance distribuído entre ${ufTotals.size} UFs, sem concentração dominante em uma única.`;

  const categoriesByHouse=(institution:'CAMARA'|'SENADO')=>((story?.categories??[]) as Array<{institution:string;category:string;value:number;records:number}>).filter(row=>row.institution===institution);

  const proposalRows=(story?.procurement.proposals??[]) as Array<{tender_id:string;supplier_id:string;name:string;value:number|null;status:string|null;submitted_at:string|null}>;
  const awardRows=(story?.procurement.awards??[]) as Array<{tender_id:string;supplier_id:string;value:number|null;awarded_at:string|null}>;
  const wonPairs=new Set(awardRows.map(row=>`${row.tender_id}:${row.supplier_id}`));
  const tenderGroups=new Map<string,typeof proposalRows>();
  for(const row of proposalRows){const list=tenderGroups.get(row.tender_id)??[];list.push(row);tenderGroups.set(row.tender_id,list)}
  const myTenders=[...tenderGroups.entries()].filter(([,rows])=>rows.some(row=>row.supplier_id===id)).sort((a,b)=>(b[1][0]?.submitted_at??'').localeCompare(a[1][0]?.submitted_at??'')).slice(0,5);

  const amendments=(story?.amendments??[]) as Array<{contract_id:string;amendment_number:string|null;kind:string|null;description:string|null;signed_at:string|null;added_value_scaled:number|null;suppressed_value_scaled:number|null;resulting_value_scaled:number|null}>;

  const recentEvents=[
    ...contracts.filter(row=>row.signed_at).map(row=>({date:row.signed_at as string,label:`Contrato assinado · ${houseName(row.institution)}`,detail:row.contract_number??row.id})),
    ...amendments.filter(row=>row.signed_at).map(row=>({date:row.signed_at as string,label:'Aditivo contratual publicado',detail:row.kind??row.description??row.amendment_number??'sem descrição'})),
  ].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);

  const benchmark=story?.benchmark??null;

  return <><LegislativeSubnav/><main id="conteudo" tabIndex={-1} className="page-shell py-10 space-y-10">

  <Link className="focus-ring inline-flex items-center gap-2 text-sm font-bold text-primary" href="/legislativo/fornecedores/explorar"><ArrowLeft size={16}/>Voltar ao explorador</Link>

  <header className="card-elevated surface-grid rounded-3xl border bg-card p-7 lg:p-10"><div className="grid gap-8 lg:grid-cols-[1.3fr_.7fr] lg:items-start">
    <div><p className="eyebrow">Fornecedor · {[hasParliamentary&&'gabinetes',hasChamberInstitutional&&'Câmara',hasSenateInstitutional&&'Senado'].filter(Boolean).join(' · ')||'papel não classificado'}</p><h1 className="display-title mt-3 text-[clamp(2rem,4vw,3.25rem)]">{detail.supplier.name??'Nome não publicado'}</h1>
      <div className="mt-4 flex flex-wrap gap-2">{detail.identifiers.filter(item=>item.type==='cnpj'&&!item.masked&&item.validation==='valid').map(item=><span key={item.value} className="rounded-full border px-3 py-1 text-sm font-semibold">CNPJ {item.value}</span>)}</div>
      {detail.names.length>1&&<p className="mt-3 text-sm text-muted-foreground">Também aparece como: {detail.names.slice(1).map(row=>String(row.name)).join(', ')} <span className="text-xs">(histórico de publicação, não cadastro da Receita)</span></p>}
      <p className="text-balance mt-5 max-w-xl text-lg leading-8 text-muted-foreground">{heroSentence}</p>
    </div>
    <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1"><div><span className="eyebrow">Pago no total observado</span><strong className="display-title mt-1 block text-3xl">{money.format(totalPaidCents/100)}</strong><small className="text-xs text-muted-foreground">contratos institucionais</small></div><div><span className="eyebrow">Relações parlamentares</span><strong className="display-title mt-1 block text-3xl">{yearParliamentarians.toLocaleString('pt-BR')}</strong><small className="text-xs text-muted-foreground">em {selectedYear??'—'}</small></div><div><span className="eyebrow">Contratos institucionais</span><strong className="display-title mt-1 block text-3xl">{contracts.length.toLocaleString('pt-BR')}</strong><small className="text-xs text-muted-foreground">{[hasChamberInstitutional&&'Câmara',hasSenateInstitutional&&'Senado'].filter(Boolean).join(' · ')||'—'}</small></div></div>
  </div></header>

  <RelationSourceBar
    narrative={hasParliamentary&&hasInstitutional?'Este fornecedor atua nos dois mercados observados pelo Cívica: recebe despesas de gabinete e também contratos institucionais.':hasParliamentary?'Este fornecedor aparece apenas nas despesas de gabinete observadas; nenhum contrato institucional foi publicado com o Congresso.':'Este fornecedor aparece apenas em contratos institucionais publicados; nenhuma despesa de gabinete foi observada.'}
    parliamentary={hasParliamentary?{cents:totalParliamentaryCents,label:'Despesa de gabinete (líquida)',sub:`${parliamentaryRows.reduce((sum,row)=>sum+Number(row.records??0),0).toLocaleString('pt-BR')} lançamentos observados`}:null}
    institutional={hasInstitutional?{contracted:{cents:totalContractedCents,label:'Contratado (valor atual publicado)'},paid:{cents:totalPaidCents,label:'Efetivamente pago (fase de pagamento)'},chamberPartial:hasChamberInstitutional}:null}
    coverage={coverage(null,'Universos parlamentar e institucional nunca são somados entre si.')}
  />

  <RelationshipFingerprint
    sentence={yearParliamentarians?`Alcançou ${yearParliamentarians.toLocaleString('pt-BR')} parlamentar(es) distinto(s) em ${selectedYear}.`:'Sem alcance parlamentar observado no ano mais recente coberto.'}
    chips={[{icon:Users,label:'Parlamentares',value:yearParliamentarians},{icon:MapPin,label:'UFs',value:yearUfs},{icon:Landmark,label:'Partidos',value:yearParties},{icon:Building2,label:'Casas',value:yearHouses.size}]}
    coverage={coverage(yearParlRows.length,`Contagens do ano ${selectedYear??'mais recente coberto'}; anos não são somados entre si para evitar dupla contagem de parlamentares.`)}
    concentrationNote={concentrationSentence}
  />

  <section><h2 className="text-xl font-black">Como começou e evoluiu</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Série mensal de valor líquido parlamentar e pago institucional. Meses sem observação permanecem ausentes.</p><div className="mt-5">{timelineData.length?<MultiLineChart title="Evolução mensal observada (R$)" data={timelineData} coverage={coverage(timelineData.length,'Séries mensais nunca são somadas entre si; cada linha é um universo.')}/>:<EmptyState title="Sem série mensal" description="Não há competências mensais publicadas para este fornecedor."/>}</div></section>

  {hasParliamentary&&<section><h2 className="text-xl font-black">Quem paga essa empresa?</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">{concentrationSentence}</p><div className="mt-5">{payers.length?<RankedBars title={`Maiores parlamentares pagadores em ${selectedYear} (R$)`} items={payers.slice(0,15).map(row=>({key:`${row.source}:${row.externalId}`,label:row.name,value:row.valueCents/100,href:`/parlamentares/${row.source}/${row.externalId}`,meta:[row.uf,row.party].filter(Boolean).join(' · ')||'UF/partido não publicados'}))} coverage={coverage(payers.length,`Top 5 concentram ${pct(top5Share)} do valor identificado no ano.`)} formatValue={money.format}/>:<EmptyState title="Sem ranking de pagadores" description="Não há vínculo confirmado por parlamentar publicado para este fornecedor no ano selecionado."/>}</div>{payers.length>15&&<p className="mt-3 text-sm text-muted-foreground">Mostrando os 15 maiores de {payers.length.toLocaleString('pt-BR')} parlamentares observados. <Link className="font-bold text-primary underline-offset-2 hover:underline" href={`/legislativo/fornecedores-parlamentares/rede?fornecedor=${id}&ano=${selectedYear}`}>Ver rede completa →</Link></p>}</section>}

  {hasParliamentary&&<section><h2 className="text-xl font-black">Local ou nacional?</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">{reachSentence} O mapa mostra a UF do parlamentar pagador, não a sede da empresa ou onde o serviço foi prestado.</p><div className="mt-5 flex flex-wrap gap-2">{ufTotals.size>0&&<span className="rounded-full border px-3 py-1 text-xs font-bold">{ufTotals.size===27?'Nacional':`${ufTotals.size} UF(s)`}</span>}{partySet.size>0&&<span className="rounded-full border px-3 py-1 text-xs font-bold">{partySet.size} partido(s)</span>}{sourceSet.size>1&&<span className="rounded-full border px-3 py-1 text-xs font-bold">Bicameral</span>}</div><div className="mt-5">{ufValues.length?<BrazilValueMap values={ufValues}/>:<EmptyState title="Sem alcance geográfico" description="Não há UF publicada para os parlamentares pagadores deste fornecedor."/>}</div></section>}

  {hasParliamentary&&<section><h2 className="text-xl font-black">O que vende aos gabinetes?</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Categorias oficiais da despesa parlamentar; Câmara e Senado nunca são fundidas por nome parecido.</p><div className={cn('mt-5 grid gap-5',categoriesByHouse('CAMARA').length&&categoriesByHouse('SENADO').length?'lg:grid-cols-2':'')}>{(['CAMARA','SENADO'] as const).map(institution=>{const rows=categoriesByHouse(institution);return rows.length?<RankedBars key={institution} title={`${houseName(institution)} (R$)`} items={rows.slice(0,8).map(row=>({key:row.category,label:row.category,value:row.value/100,meta:`${row.records.toLocaleString('pt-BR')} lançamentos`}))} coverage={coverage(rows.length,'Categoria é contexto do lançamento, não CNAE ou ramo da empresa.')} formatValue={money.format}/>:null})}</div>{!categoriesByHouse('CAMARA').length&&!categoriesByHouse('SENADO').length&&<EmptyState title="Sem categorias publicadas" description="Não há categoria de despesa parlamentar associada a este fornecedor."/>}</section>}

  {contracts.length>0&&<section><h2 className="text-xl font-black">Como contrata com o Congresso?</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Contrato, empenho, liquidação e pagamento são fatos distintos. Valor atual publicado não é valor pago.</p><div className="mt-5 grid gap-4 md:grid-cols-2">{contractCards.slice(0,12).map(card=><ContractCard key={card.id} contract={card}/>)}</div>{contracts.length>12&&<p className="mt-4 text-sm text-muted-foreground">Mostrando os 12 contratos mais recentes de {contracts.length.toLocaleString('pt-BR')} publicados para este fornecedor.</p>}</section>}

  {(hasChamberInstitutional||hasSenateInstitutional)&&<section><h2 className="text-xl font-black">Escada financeira por Casa</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Cada degrau é um fato publicado separadamente. Largura decrescente não implica um funil causal comprovado entre os valores.</p><div className={cn('mt-5 grid gap-5',hasChamberInstitutional&&hasSenateInstitutional?'lg:grid-cols-2':'lg:max-w-xl')}>{hasChamberInstitutional&&<FinancialLadder title="Execução na Câmara" institution="Câmara dos Deputados" rungs={ladderFor('CAMARA')} coverage={institutionalCoverage('CAMARA',null,'Empenho, liquidação e pagamento a partir de movimentos financeiros publicados.')} note="Vínculo entre empenho e contrato pode não ser oficial; valores são agregados por Casa, não por contrato individual."/>}{hasSenateInstitutional&&<FinancialLadder title="Execução no Senado" institution="Senado Federal" rungs={ladderFor('SENADO')} coverage={institutionalCoverage('SENADO',null,'Empenho, liquidação e pagamento a partir de movimentos financeiros publicados.')} note="Vínculo entre empenho e contrato pode não ser oficial; valores são agregados por Casa, não por contrato individual."/>}</div></section>}

  <section><h2 className="text-xl font-black">Como ganhou?</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Comparativo de propostas por licitação. Vencedor identificado pela fonte (item adjudicado) — nunca inferido pela menor proposta.</p>{myTenders.length?<div className="mt-5 space-y-4">{myTenders.map(([tenderId,rows])=><div key={tenderId} className="rounded-2xl border bg-card p-5"><span className="eyebrow">Licitação {tenderId.replace('tender_','').slice(0,8)} · {rows[0]?.submitted_at??'data não publicada'}</span><div className="mt-3 space-y-2">{rows.map(row=>{const won=wonPairs.has(`${row.tender_id}:${row.supplier_id}`),mine=row.supplier_id===id;return <div key={`${row.tender_id}-${row.supplier_id}`} className={cn('flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm',mine&&'bg-secondary font-semibold text-secondary-foreground')}><span className="flex min-w-0 items-center gap-2 truncate">{won&&<Trophy size={14} className="shrink-0"/>}{row.name}</span><strong className="shrink-0 tabular-nums">{row.value===null?'—':money.format(row.value/100)}</strong></div>})}</div></div>)}</div>:<div className="mt-5"><EmptyState title="Sem licitação vinculada" description="Os contratos deste fornecedor não têm processo licitatório formal vinculado na fonte (podem ser dispensa/inexigibilidade ou vínculo ainda não publicado)."/></div>}</section>

  <section><h2 className="text-xl font-black">O contrato mudou?</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Aditivos contratuais publicados; direção da mudança só é mostrada quando a fonte a publica explicitamente.</p>{amendments.length?<div className="mt-5 space-y-3">{amendments.map(row=><div key={`${row.contract_id}-${row.amendment_number}`} className="rounded-xl border bg-card p-4 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{contracts.find(c=>c.id===row.contract_id)?.contract_number??row.contract_id}</strong><span className="text-xs text-muted-foreground">{row.signed_at??'data não publicada'}</span></div><p className="mt-1 text-muted-foreground">{row.kind??row.description??'Tipo não publicado'}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">{row.added_value_scaled!==null&&<span>Acrescido: {money.format(row.added_value_scaled/100)}</span>}{row.suppressed_value_scaled!==null&&<span>Suprimido: {money.format(row.suppressed_value_scaled/100)}</span>}{row.resulting_value_scaled!==null&&<span>Valor resultante: {money.format(row.resulting_value_scaled/100)}</span>}</div></div>)}</div>:<div className="mt-5"><EmptyState title="Sem aditivos publicados" description="Não há aditivo contratual publicado para os contratos deste fornecedor."/></div>}</section>

  {hasParliamentary&&hasInstitutional&&<TwoRelationsPanel
    parliamentary={<div className="mt-3 space-y-2">{parliamentaryRows.length?parliamentaryRows.map(row=><div key={`${row.year}-${row.institution}`} className="flex items-center justify-between border-b pb-2 text-sm"><span>{row.year} · {houseName(String(row.institution))}</span><strong className="tabular-nums">{money.format(Number(row.net_value_scaled)/100)}</strong></div>):<p className="text-sm text-muted-foreground">Sem despesa parlamentar publicada.</p>}</div>}
    institutional={<div className="mt-3 space-y-2">{institutionalRows.length?institutionalRows.map(row=><div key={`${row.year}-${row.institution}`} className="border-b pb-2 text-sm"><div className="flex justify-between"><span>{row.year} · {houseName(String(row.institution))}</span><strong className="tabular-nums">{row.paid_scaled===null?'—':money.format(Number(row.paid_scaled)/100)}</strong></div></div>):<p className="text-sm text-muted-foreground">Sem execução institucional publicada.</p>}</div>}
  />}

  <section><h2 className="text-xl font-black">O que mudou recentemente?</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Marcos mais recentes publicados para este fornecedor.</p>{recentEvents.length?<div className="mt-5 space-y-2">{recentEvents.map((event,index)=><div key={index} className="flex items-center justify-between gap-3 border-b pb-2 text-sm last:border-0"><span>{event.label} <span className="text-muted-foreground">· {event.detail}</span></span><span className="shrink-0 text-xs text-muted-foreground">{event.date}</span></div>)}</div>:<div className="mt-5"><EmptyState title="Sem marcos recentes" description="Não há evento datado (contrato ou aditivo) publicado para este fornecedor."/></div>}</section>

  <section><h2 className="text-xl font-black">Compare com o mercado</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Comparação factual com a mediana do universo de fornecedores observado em {benchmark?.year??selectedYear}. Não é nota nem classificação por tier.</p><div className="mt-5 grid gap-3 sm:grid-cols-3">
    <div className="rounded-2xl border bg-card p-4"><span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground"><Users size={14}/>Parlamentares alcançados</span><strong className="display-title mt-2 block text-2xl">{yearParliamentarians.toLocaleString('pt-BR')}</strong><small className="text-muted-foreground">mediana do universo: {benchmark?.medianParliamentarians??'—'}</small></div>
    <div className="rounded-2xl border bg-card p-4"><span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground"><TrendingUp size={14}/>Despesa parlamentar (R$)</span><strong className="display-title mt-2 block text-2xl">{money.format(totalParliamentaryCents/100)}</strong><small className="text-muted-foreground">mediana do universo: {benchmark?.medianParliamentaryCents!=null?money.format(benchmark.medianParliamentaryCents/100):'—'}</small></div>
    <div className="rounded-2xl border bg-card p-4"><span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground"><Landmark size={14}/>Pago institucional (R$)</span><strong className="display-title mt-2 block text-2xl">{money.format(totalPaidCents/100)}</strong><small className="text-muted-foreground">mediana do universo: {benchmark?.medianInstitutionalPaidCents!=null?money.format(benchmark.medianInstitutionalPaidCents/100):'—'}</small></div>
  </div></section>

  <p className="text-xs leading-5 text-muted-foreground">Revisão agregada publicada em {detail.revision?.publishedAt??'data não informada'}. Valores não representam equivalência entre contrato, empenho, liquidação e pagamento.</p>

  </main></>;
}
