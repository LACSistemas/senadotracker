import {rankingsDashboard} from '@/lib/data';
import {groupRankings} from '@/lib/group-rankings';
import {dashboardQuery,groupHouse,parseMode} from '../query';

export const dynamic='force-dynamic';
// Uma célula que começa com `=`, `+`, `-` ou `@` é fórmula para o Excel: o apóstrofo a neutraliza sem
// alterar o texto que a pessoa lê.
const safe=(value:unknown)=>{const text=String(value??'');const neutral=/^[\s]*[=+\-@\t\r]/.test(text)?`'${text}`:text;return `"${neutral.replaceAll('"','""')}"`};
const csv=(rows:unknown[][],filename:string)=>new Response('﻿'+rows.map(row=>row.map(safe).join(';')).join('\r\n'),
  {headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${filename}"`,'Cache-Control':'private, no-store'}});
const pct=(value:number|null)=>value===null?'':(value*100).toFixed(2);

export async function GET(request:Request){
  const params=new URL(request.url).searchParams;
  // Mesma leitura de URL da página: o CSV respeita modo, Casa, ano e ordenação em vez de reinterpretá-los.
  const mode=parseMode(params.get('modo')??undefined),query=dashboardQuery(Object.fromEntries(params));
  if(mode!=='parlamentares'){
    const result=groupRankings(mode,groupHouse(query.source),query.year);
    if(result.status==='unavailable')return new Response(result.message,{status:503});
    const {rows,house,year}=result.data,isParty=mode==='partidos';
    const headers=['posicao',isParty?'partido':'uf','cadeiras_congresso','senadores','deputados',...(isParty?[]:['partidos_na_bancada','concentracao_hhi_pct']),
      'parlamentares_observados','casa_das_medianas','proposicoes_mediana','custo_mensal_mediano_centavos','gabinete_vinculos_mediana','presenca_mediana_pct','ano'];
    return csv([headers,...rows.map((row,index)=>[index+1,row.label,row.seats,row.senators,row.deputies,...(isParty?[]:[row.parties,pct(row.concentration)]),
      row.observed,house,row.values.proposals,row.values.monthlyCostCents===null?'':Math.round(row.values.monthlyCostCents),row.values.staff,pct(row.values.presence),year])],
      `rankings-${mode}-${house}-${year}.csv`);
  }
  const result=rankingsDashboard({...query,page:1});
  if(result.status==='unavailable')return new Response(result.message,{status:503});
  const {allItems,year:publishedYear}=result.data;
  const headers=['posicao','nome','cargo','casa','uf','partido','situacao','participacao_nominal_pct','proposicoes_autoria','relatorias','custo_total_centavos','gasto_mensal_centavos','meses_custo','periodo_custo','ano_custo','gabinete_vinculos','patrimonio_declarado_centavos','ano_pleito','mandatos','perfil'];
  return csv([headers,...allItems.map((item,index)=>[index+1,item.name,item.role,item.source,item.uf,item.party,item.situation,pct(item.participation),item.proposals,item.rapporteurships,
    item.totalCostCents,item.monthlyCostCents===null?'':Math.round(item.monthlyCostCents),item.costMonths,item.costPeriod,publishedYear,item.staff,item.assetsCents,item.assetYear,item.mandates,
    `/legislativo/${item.source==='senado'?'senadores':'deputados'}/${item.externalId}`])],`rankings-parlamentares-${publishedYear}.csv`);
}
