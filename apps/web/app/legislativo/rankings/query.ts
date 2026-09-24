import type { DashboardQuery, DashboardSort } from '@senadotracker/db';
import type { Source } from '@senadotracker/domain';

/** Leitura da URL e escrita dos links num só lugar: a página, o CSV e os testes liam `ordem` de três
    listas copiadas, que já divergiam entre si. Módulo puro — sem JSX e sem `@/`, para rodar sob tsx. */
export type Params=Record<string,string|string[]|undefined>;
export const scalar=(value:string|string[]|undefined)=>typeof value==='string'?value:undefined;
export const dashboardSorts=['name','name_desc','participation_desc','participation_asc','proposals_desc','proposals_asc','cost_desc','cost_asc','staff_desc','staff_asc'] as const satisfies readonly DashboardSort[];
const validSort=new Set<string>(dashboardSorts);
export const parseSort=(value:string|undefined):DashboardSort=>value&&validSort.has(value)?value as DashboardSort:'name';

/** O sujeito do ranking é visão, não filtro: fica fora de `DashboardQuery` porque não estreita universo
    algum — troca o que cada linha representa. */
export type RankingMode='parlamentares'|'partidos'|'estados';
export const rankingModes=['parlamentares','partidos','estados'] as const satisfies readonly RankingMode[];
export const parseMode=(value:string|undefined):RankingMode=>rankingModes.includes(value as RankingMode)?value as RankingMode:'parlamentares';
/** Sem Casa definida não há mediana comparável (cota de senador e de deputado não são a mesma régua),
    então o modo agregado assume a Câmara — universo de 513, o maior dos dois. */
export const groupHouse=(source:Source|undefined):Source=>source??'camara';

export function dashboardQuery(params:Params):DashboardQuery{
  const casa=scalar(params.casa),page=Number(scalar(params.pagina)??1),year=Number(scalar(params.ano));
  return{source:casa==='senado'||casa==='camara'?casa:undefined,role:scalar(params.cargo)||undefined,uf:scalar(params.uf)||undefined,party:scalar(params.partido)||undefined,
    search:scalar(params.busca)?.trim()||undefined,year:Number.isInteger(year)&&year>=2000?year:undefined,sort:parseSort(scalar(params.ordem)),
    page:Number.isSafeInteger(page)&&page>0?page:1,pageSize:10};
}

/** `mode` é posicional e obrigatório de propósito: com valor padrão, cada link de ordenação, de página e o
    botão de CSV voltavam em silêncio para Parlamentares. Quem monta links usa um `href` já ligado ao modo. */
export function queryHref(query:DashboardQuery,mode:RankingMode,change:Partial<DashboardQuery>={},path='/legislativo/rankings'){
  const q={...query,...change},params=new URLSearchParams();
  if(mode!=='parlamentares')params.set('modo',mode);
  if(q.source)params.set('casa',q.source);
  if(q.role)params.set('cargo',q.role);
  if(q.uf)params.set('uf',q.uf);
  if(q.party)params.set('partido',q.party);
  if(q.search)params.set('busca',q.search);
  if(q.year)params.set('ano',String(q.year));
  if(q.sort&&q.sort!=='name')params.set('ordem',q.sort);
  if(q.page&&q.page>1)params.set('pagina',String(q.page));
  return `${path}${params.size?`?${params}`:''}`;
}

/** Trocar de sujeito descarta o que não se aplica: UF, partido e busca são filtros de pessoa, e no modo
    agregado seriam filtro e agrupamento pela mesma chave ao mesmo tempo. Casa, ano e ordem sobrevivem. */
export const queryFor=(query:DashboardQuery,mode:RankingMode):DashboardQuery=>
  mode==='parlamentares'?query:{...query,role:undefined,uf:undefined,party:undefined,search:undefined,page:1};
export const modeHref=(query:DashboardQuery,mode:RankingMode)=>queryHref(queryFor(query,mode),mode,mode==='parlamentares'?{}:{source:groupHouse(query.source)});
