import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';
import { decimalCents, searchText, type Expense } from '@senadotracker/domain';

const text=(value:unknown)=>value===null||value===undefined||String(value).trim()===''?null:String(value).trim();
const key=(source:string,row:unknown,index:number)=>createHash('sha256').update(`${source}\0${JSON.stringify(row)}\0${index}`).digest('hex');
function csvRows(input:string){const rows:string[][]=[];let row:string[]=[];let field='';let quoted=false;for(let i=0;i<input.length;i++){const c=input[i]!;if(c==='"'){if(quoted&&input[i+1]==='"'){field+='"';i++;}else if(quoted){quoted=false;}else if(field.length===0){quoted=true;}else{field+='"';}}else if(c===';'&&!quoted){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&input[i+1]==='\n')i++;row.push(field);field='';if(row.some(Boolean))rows.push(row);row=[];}else field+=c;}if(field||row.length){row.push(field);rows.push(row);}return rows;}

export function parseSenateExpenses(bytes:Uint8Array,rawId:string,identityByName:Map<string,string>,year:number){
  const rows=csvRows(new TextDecoder('windows-1252').decode(bytes));
  if(rows.length<3||rows[1]?.[0]!=='ANO')throw new Error('Cabeçalho CEAPS inesperado');
  const header=rows[1]!;const result:Expense[]=[];const unmatched=new Set<string>();
  for(let i=2;i<rows.length;i++){const values=rows[i]!;const r=Object.fromEntries(header.map((h,j)=>[h,values[j]??'']));const name=searchText(r.SENADOR??'');const externalId=identityByName.get(name);if(!externalId){unmatched.add(r.SENADOR??'');continue;}const net=decimalCents(r.VALOR_REEMBOLSADO);result.push({source:'senado',externalId,year:Number(r.ANO),month:Number(r.MES),recordKey:key('senado',r,i),categoryCode:r.TIPO_DESPESA!,category:r.TIPO_DESPESA!,supplier:text(r.FORNECEDOR),supplierDocument:text(r.CNPJ_CPF),documentNumber:text(r.DOCUMENTO),documentId:text(r.COD_DOCUMENTO),documentUrl:null,issuedAt:text(r.DATA),grossCents:null,deductionCents:0,netCents:net,refundCents:0,installment:null,detail:text(r.DETALHAMENTO),rawId});}
  if(result.some(e=>e.year!==year||e.month<1||e.month>12))throw new Error('Período CEAPS inválido');
  return {expenses:result,unmatched:[...unmatched].filter(Boolean)};
}

export function parseChamberExpenses(zip:Uint8Array,rawId:string,identityByName:Map<string,string>,year:number){
  const files=unzipSync(zip);const names=Object.keys(files);if(names.length!==1)throw new Error('ZIP CEAP inesperado');
  const decoded=new TextDecoder('utf-8',{fatal:true}).decode(files[names[0]!]!);const root=JSON.parse(decoded) as {dados?:Record<string,unknown>[]};if(!Array.isArray(root.dados))throw new Error('Envelope CEAP inesperado');
  const expenses:Expense[]=[];const ignored=new Set<string>();const validIds=new Set(identityByName.values());
  root.dados.forEach((r,i)=>{const stated=text(r.idDeputado);const externalId=stated&&validIds.has(stated)?stated:identityByName.get(searchText(String(r.nomeParlamentar??'')));if(!externalId){ignored.add(String(r.nomeParlamentar??''));return;}const gross=decimalCents(r.valorDocumento);const deduction=decimalCents(r.valorGlosa??0);const net=decimalCents(r.valorLiquido);const refund=decimalCents(r.restituicao||0);expenses.push({source:'camara',externalId,year:Number(r.ano),month:Number(r.mes),recordKey:key('camara',r,i),categoryCode:String(r.numeroSubCota),category:String(r.descricao),supplier:text(r.fornecedor),supplierDocument:text(r.cnpjCPF),documentNumber:text(r.numero),documentId:text(r.idDocumento),documentUrl:text(r.urlDocumento),issuedAt:text(r.dataEmissao),grossCents:gross,deductionCents:deduction,netCents:net,refundCents:refund,installment:Number(r.parcela)||null,detail:text(r.descricaoEspecificacao),rawId});});
  if(expenses.some(e=>e.year!==year||e.month<1||e.month>12))throw new Error('Período CEAP inválido');
  return {expenses,ignored:[...ignored].filter(Boolean)};
}
