import type { PersonYear } from '@/lib/person-years';

const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});

function Bar({value,max,children}:{value:number|null;max:number;children:string}){
  if(value===null)return <span className="text-muted-foreground" aria-label="não publicado">—</span>;
  return <span className="flex items-center gap-2"><span aria-hidden="true" className="h-2 w-14 shrink-0 overflow-hidden rounded-full bg-muted sm:w-24"><span className="block h-full rounded-full bg-primary" style={{width:`${Math.max(3,value/max*100)}%`}}/></span><span className="tabular-nums">{children}</span></span>;
}

// Ano a ano: cota gasta e propostas apresentadas. Cada coluna é comparável só dentro dela; ano sem dado = "—".
export function YearByYear({years}:{years:PersonYear[]|null}){
  if(!years||!years.length)return null;
  const maxQuota=Math.max(1,...years.map(item=>item.quotaCents??0)),maxProps=Math.max(1,...years.map(item=>item.proposals??0));
  return <div tabIndex={0} role="region" aria-label="Tabela Ano a ano, com rolagem horizontal" className="focus-ring mt-6 overflow-x-auto rounded-2xl border bg-card">
    <table className="w-full min-w-[30rem] text-left text-sm"><caption className="p-4 text-left text-lg font-bold">Ano a ano</caption>
      <thead><tr className="border-y text-xs text-muted-foreground"><th scope="col" className="p-3">Ano</th><th scope="col" className="p-3">Cota gasta</th><th scope="col" className="p-3">Propostas que apresentou</th></tr></thead>
      <tbody>{years.map(item=><tr key={item.year} className="border-b last:border-0">
        <th scope="row" className="p-3 font-bold">{item.year}</th>
        <td className="p-3"><Bar value={item.quotaCents} max={maxQuota}>{item.quotaCents===null?'':money.format(item.quotaCents/100)}</Bar>{item.quotaCents!==null&&item.quotaMonths<12&&<small className="block text-xs text-muted-foreground">{item.quotaMonths} {item.quotaMonths===1?'mês publicado':'meses publicados'}</small>}</td>
        <td className="p-3"><Bar value={item.proposals} max={maxProps}>{String(item.proposals??'')}</Bar></td></tr>)}</tbody></table>
    <p className="p-3 text-xs text-muted-foreground">Valores correntes, sem correção pela inflação. Ano com menos de 12 meses publicados é parcial. Autoria não inclui pareceres. “—” em propostas significa nenhuma registrada nos lotes publicados, o que não prova que não houve.</p>
  </div>;
}
