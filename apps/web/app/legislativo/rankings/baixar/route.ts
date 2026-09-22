import {rankingsDashboard} from '@/lib/data';
import type {DashboardQuery} from '@senadotracker/db';

export const dynamic='force-dynamic';
const safe=(value:unknown)=>{const text=String(value??'');const neutral=/^[\s]*[=+\-@\t\r]/.test(text)?`'${text}`:text;return `"${neutral.replaceAll('"','""')}"`};
export async function GET(request:Request){
  const params=new URL(request.url).searchParams,source=params.get('casa'),sort=params.get('ordem'),year=Number(params.get('ano'));
  const query:DashboardQuery={source:source==='senado'||source==='camara'?source:undefined,role:params.get('cargo')||undefined,uf:params.get('uf')||undefined,party:params.get('partido')||undefined,search:params.get('busca')||undefined,year:Number.isInteger(year)&&year>=2000?year:undefined,sort:sort&&['name','name_desc','participation_desc','participation_asc','proposals_desc','proposals_asc','cost_desc','cost_asc','staff_desc','staff_asc'].includes(sort)?sort as DashboardQuery['sort']:undefined,page:1,pageSize:10};
  const result=rankingsDashboard(query);if(result.status==='unavailable')return new Response(result.message,{status:503});
  const {allItems,year:publishedYear}=result.data;
  const headers=['posicao','nome','cargo','casa','uf','partido','situacao','participacao_nominal_pct','proposicoes_autoria','relatorias','custo_total_centavos','gasto_mensal_centavos','meses_custo','periodo_custo','ano_custo','gabinete_vinculos','patrimonio_declarado_centavos','ano_pleito','mandatos','perfil'];
  const lines=[headers.map(safe).join(';'),...allItems.map((item,index)=>[index+1,item.name,item.role,item.source,item.uf,item.party,item.situation,item.participation===null?'':(item.participation*100).toFixed(2),item.proposals,item.rapporteurships,item.totalCostCents,item.monthlyCostCents===null?null:Math.round(item.monthlyCostCents),item.costMonths,item.costPeriod,publishedYear,item.staff,item.assetsCents,item.assetYear,item.mandates,`/legislativo/${item.source==='senado'?'senadores':'deputados'}/${item.externalId}`].map(safe).join(';'))];
  return new Response('\uFEFF'+lines.join('\r\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="rankings-parlamentares-${publishedYear}.csv"`,'Cache-Control':'private, no-store'}});
}
