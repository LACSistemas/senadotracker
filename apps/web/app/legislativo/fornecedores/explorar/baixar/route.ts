import { supplierExplorer } from '@/lib/data';
import type { SupplierExplorerQuery } from '@senadotracker/db';

export const dynamic='force-dynamic';
const safe=(value:unknown)=>{let text=String(value??'');if(/^[=+\-@\t\r]/.test(text))text=`'${text}`;return `"${text.replaceAll('"','""')}"`};
const parse=(request:Request):SupplierExplorerQuery=>{const p=new URL(request.url).searchParams,year=Number(p.get('ano')??new Date().getFullYear()),activity=p.get('tipo'),house=p.get('casa'),sort=p.get('ordem'),direction=p.get('direcao');return{year:Number.isSafeInteger(year)?year:new Date().getFullYear(),search:p.get('busca')?.trim()??'',activity:activity==='institutional'||activity==='parliamentary'||activity==='both'?activity:'all',house:house==='CAMARA'||house==='SENADO'?house:'all',sort:sort==='name'||sort==='institutional_paid'||sort==='reach'?sort:'parliamentary_value',direction:direction==='asc'?'asc':'desc',pageSize:100}};

export async function GET(request:Request){
  const query=parse(request),encoder=new TextEncoder();let page=1,done=false;
  const stream=new ReadableStream<Uint8Array>({pull(controller){if(done)return controller.close();const result=supplierExplorer({...query,page});if(result.status==='unavailable'){controller.error(new Error(result.message));return}const rows=result.data.items.map(item=>[item.name,item.publicDocument??'',item.activity,item.houses.join('|'),item.parliamentary?.netCents??'',item.parliamentary?.parliamentarians??'',item.institutional?.paidCents??'',item.institutional?.contracts??'',result.data.year,result.data.revisionPublishedAt??''].map(safe).join(';'));const prefix=page===1?'nome;cnpj;tipo;casas;despesa_parlamentar_centavos;parlamentares;pagamento_institucional_centavos;contratos;ano;atualizacao\r\n':'';controller.enqueue(encoder.encode(prefix+rows.join('\r\n')+(rows.length?'\r\n':'')));if(page*result.data.pageSize>=result.data.total)done=true;else page++}});
  return new Response(stream,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="fornecedores-${query.year}.csv"`,'Cache-Control':'private, no-store'}});
}
