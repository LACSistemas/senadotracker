// Categorias da frequência oficial da Câmara (cada dia de sessão deliberativa tem um status literal).
export type PresenceKind='present'|'present_partial'|'mission'|'leave'|'official'|'absent';
export interface PresenceDay{iso:string;status:string;kind:PresenceKind}
export interface PresenceYear{year:number;present:number|null;total:number|null;justified:number|null;unjustified:number|null;days:PresenceDay[]}

export const kindOf=(status:string):PresenceKind=>{
  const s=status.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
  if(s.startsWith('presenca (~)'))return 'present_partial';
  if(s.startsWith('presenca'))return 'present';
  if(s.startsWith('missao'))return 'mission';
  if(s.startsWith('licenca'))return 'leave';
  if(s.startsWith('ausencia'))return 'absent';
  return 'official';
};
// O texto oficial às vezes duplica o rótulo ("Decisão da Mesa Decisão da Mesa"): só limpamos a repetição.
export const cleanStatus=(status:string)=>{const t=status.trim(),h=t.length/2;return t.length%2===1&&t.slice(0,Math.floor(h)).trim()===t.slice(Math.ceil(h)).trim()?t.slice(0,Math.floor(h)).trim():t};

