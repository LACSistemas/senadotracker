// Agregação da cota parlamentar para o explorador mês a mês. Só soma o que foi publicado:
// mês sem nenhum registro vira `null` (sem registro), nunca zero.
export interface ExpenseLike{year:number;month:number;category:string;supplier:string|null;documentUrl:string|null;issuedAt:string|null;netCents:number;refundCents:number}
export interface CategoryTotal{label:string;cents:number}
export interface MonthItem{supplier:string;cents:number;date:string|null;url:string|null}
export interface MonthDetail{cents:number;records:number;categories:CategoryTotal[];items:MonthItem[]}
export interface YearQuota{year:number;months:Array<MonthDetail|null>;totalCents:number;categories:CategoryTotal[]}
export interface QuotaExplorerData{years:YearQuota[]}

// Categorias vêm em CAIXA ALTA e com ponto final; só a apresentação muda, o texto oficial é o mesmo.
export const prettyCategory=(label:string)=>{const t=label.trim().replace(/\.$/,'');return t===t.toUpperCase()?t.charAt(0)+t.slice(1).toLowerCase():t};
const net=(e:ExpenseLike)=>e.netCents-e.refundCents;
const rank=(map:Map<string,number>):CategoryTotal[]=>[...map].map(([label,cents])=>({label,cents})).filter(item=>item.cents>0).sort((a,b)=>b.cents-a.cents||a.label.localeCompare(b.label,'pt-BR'));
const add=(map:Map<string,number>,key:string,cents:number)=>map.set(key,(map.get(key)??0)+cents);

export function buildQuotaExplorer(expenses:ExpenseLike[],topItems=8):QuotaExplorerData{
  const years=[...new Set(expenses.map(item=>item.year))].sort((a,b)=>b-a);
  return {years:years.map(year=>{
    const rows=expenses.filter(item=>item.year===year),yearCats=new Map<string,number>();
    const months=Array.from({length:12},(_,index)=>{
      const monthRows=rows.filter(item=>item.month===index+1);
      if(!monthRows.length)return null;
      const cats=new Map<string,number>();
      for(const row of monthRows){
        const label=prettyCategory(row.category||'Categoria não informada');
        add(cats,label,net(row));add(yearCats,label,net(row));
      }
      const items=monthRows.map(row=>({supplier:row.supplier??'Fornecedor não informado',cents:net(row),date:row.issuedAt,url:row.documentUrl})).filter(item=>item.cents>0).sort((a,b)=>b.cents-a.cents).slice(0,topItems);
      return {cents:monthRows.reduce((sum,row)=>sum+net(row),0),records:monthRows.length,categories:rank(cats),items} satisfies MonthDetail;
    });
    return {year,months,totalCents:rows.reduce((sum,row)=>sum+net(row),0),categories:rank(yearCats)};
  })};
}
