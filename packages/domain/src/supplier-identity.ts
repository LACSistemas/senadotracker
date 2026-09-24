export const supplierIdentifierTypes = ['cnpj','cpf','foreign_tax_id','other'] as const;
export type SupplierIdentifierType = typeof supplierIdentifierTypes[number];
export type SupplierIdentifierValidation = 'valid'|'invalid'|'masked'|'not_validated'|'sentinel';

export interface NormalizedSupplierIdentifier {
  type: SupplierIdentifierType;
  rawValue: string;
  normalizedValue: string;
  countryCode: string|null;
  isMasked: boolean;
  validationStatus: SupplierIdentifierValidation;
  normalizationVersion: 'supplier-id-v1';
}

const SENTINEL_CNPJ = new Set(['00000000000000','00000000000001','00000000000002','00000000000006','00000000000010']);
const punctuation=/[.\/\-\s]/g;

/** Preserva letras: desde julho de 2026 as 12 primeiras posições do CNPJ podem ser alfanuméricas. */
export function compactSupplierIdentifier(value:string):string {
  return value.trim().toLocaleUpperCase('pt-BR').replace(punctuation,'');
}

function checkDigit(base:string,weights:readonly number[]):number {
  const sum=[...base].reduce((total,char,index)=>total+(char.charCodeAt(0)-48)*weights[index]!,0);
  const remainder=sum%11;
  return remainder<2?0:11-remainder;
}

export function validCnpj(value:string):boolean {
  const normalized=compactSupplierIdentifier(value);
  if(!/^[A-Z0-9]{12}\d{2}$/.test(normalized)||SENTINEL_CNPJ.has(normalized)||/^(\d)\1{13}$/.test(normalized))return false;
  return checkDigit(normalized.slice(0,12),[5,4,3,2,9,8,7,6,5,4,3,2])===Number(normalized[12])
    &&checkDigit(normalized.slice(0,13),[6,5,4,3,2,9,8,7,6,5,4,3,2])===Number(normalized[13]);
}

export function validCpf(value:string):boolean {
  const normalized=compactSupplierIdentifier(value);
  if(!/^\d{11}$/.test(normalized)||/^(\d)\1{10}$/.test(normalized))return false;
  const digit=(length:number)=>{const sum=[...normalized.slice(0,length)].reduce((total,char,index)=>total+Number(char)*(length+1-index),0),remainder=(sum*10)%11;return remainder===10?0:remainder};
  return digit(9)===Number(normalized[9])&&digit(10)===Number(normalized[10]);
}

export function normalizeSupplierIdentifier(rawValue:string,typeHint?:SupplierIdentifierType,countryHint='BR'):NormalizedSupplierIdentifier {
  const raw=String(rawValue??''),normalized=compactSupplierIdentifier(raw),isMasked=/[*•]/.test(raw);
  const inferred:SupplierIdentifierType=typeHint??(/^[A-Z0-9]{14}$/.test(normalized)?'cnpj':/^\d{11}$/.test(normalized)?'cpf':'other');
  const countryCode=inferred==='cnpj'||inferred==='cpf'?countryHint:typeHint==='foreign_tax_id'?countryHint:null;
  let validationStatus:SupplierIdentifierValidation='not_validated';
  if(isMasked)validationStatus='masked';
  else if(inferred==='cnpj')validationStatus=SENTINEL_CNPJ.has(normalized)?'sentinel':validCnpj(normalized)?'valid':'invalid';
  else if(inferred==='cpf')validationStatus=validCpf(normalized)?'valid':'invalid';
  else if(!normalized)validationStatus='invalid';
  return{type:inferred,rawValue:raw,normalizedValue:normalized,countryCode,isMasked,validationStatus,normalizationVersion:'supplier-id-v1'};
}

export function canStrongMatchSupplierIdentifier(value:NormalizedSupplierIdentifier):boolean {
  return !value.isMasked&&value.validationStatus==='valid'&&(value.type==='cnpj'||value.type==='cpf'||value.type==='foreign_tax_id');
}
