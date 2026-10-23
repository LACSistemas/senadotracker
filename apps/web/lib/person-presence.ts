import { webPostgresPool } from '@/lib/postgres-pool';

import { cleanStatus, kindOf, type PresenceDay, type PresenceYear } from './presence-kinds.ts';
export type { PresenceDay, PresenceKind, PresenceYear } from './presence-kinds.ts';

const toIso=(br:string)=>{const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br);return m?`${m[3]}-${m[2]}-${m[1]}`:null};

export async function personPresenceYears(id:string):Promise<PresenceYear[]|null>{
  try{
    const {rows}=await webPostgresPool().query(`SELECT year,days_present,days_total,days_justified,days_unjustified,days_json FROM civica_votes_presence_poc.official_presence WHERE external_id=$1 ORDER BY year DESC`,[id]);
    return rows.map(row=>{
      let raw:Array<{date?:string;status?:string}>=[];
      try{const parsed=JSON.parse(String(row.days_json??'[]'));if(Array.isArray(parsed))raw=parsed}catch{}
      const days=raw.flatMap(item=>{const iso=item.date?toIso(item.date):null;if(!iso||!item.status)return [];const status=cleanStatus(item.status);return [{iso,status,kind:kindOf(status)}]}).sort((a,b)=>a.iso.localeCompare(b.iso));
      const n=(v:unknown)=>v==null?null:Number(v);
      return {year:Number(row.year),present:n(row.days_present),total:n(row.days_total),justified:n(row.days_justified),unjustified:n(row.days_unjustified),days};
    });
  }catch{return null}
}
