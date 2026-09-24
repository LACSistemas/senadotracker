import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Coluna genérica na linha, e não presa a um tipo de dado: a mesma tabela serve parlamentar, bancada e
    unidade federativa. Antes o mapeamento coluna→ordenação era por índice posicional, o que travava
    qualquer reordenação; agora largura, fixação e ordenação viajam com a coluna. */
export interface StickyColumn<Row>{key:string;label:string;sticky?:0|1|2;header?:ReactNode;title?:(row:Row)=>string|undefined;render:(row:Row,index:number)=>ReactNode}

/** Larguras das colunas fixas em px, e o deslocamento de cada uma derivado da MESMA fonte. Com largura
    automática o `left` não bate com o tamanho real e a coluna fixa cobre a seguinte pela metade. */
export const stickyStyle=(widths:readonly number[],index:number)=>
  ({left:widths.slice(0,index).reduce((sum,width)=>sum+width,0),width:widths[index],minWidth:widths[index],maxWidth:widths[index]});

export function StickyTable<Row>({caption,columns,rows,rowKey,widths,minWidth}:{
  caption:string;columns:StickyColumn<Row>[];rows:Row[];rowKey:(row:Row)=>string;widths:readonly number[];minWidth:number}){
  const fixed=(column:StickyColumn<Row>)=>column.sticky!==undefined?stickyStyle(widths,column.sticky):undefined;
  const edge=widths.length-1;
  return <div className="mt-5 overflow-x-auto"><table className="w-full border-separate border-spacing-0 text-left text-xs" style={{minWidth}}>
    <caption className="sr-only">{caption}</caption>
    <thead className="bg-slate-100 text-slate-700"><tr>{columns.map(column=>
      <th scope="col" key={column.key} style={fixed(column)}
        className={cn('whitespace-nowrap border-b px-3 py-3 font-semibold',column.sticky!==undefined&&'sticky z-20 bg-slate-100',column.sticky===edge&&'after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-slate-300')}>
        {column.header??column.label}</th>)}</tr></thead>
    <tbody>{rows.map((row,index)=><tr key={rowKey(row)} className="group hover:bg-slate-50">{columns.map(column=>
      <td key={column.key} style={fixed(column)} {...(column.title?.(row)?{title:column.title(row)}:{})}
        className={cn('border-b px-3 py-3',column.sticky!==undefined&&'sticky z-10 bg-white group-hover:bg-slate-50',column.sticky===edge&&'after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-slate-200')}>
        {column.render(row,index)}</td>)}</tr>)}</tbody>
  </table></div>;
}
