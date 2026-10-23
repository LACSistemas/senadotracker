import Link from 'next/link';
import type { VoteThemes } from '@/lib/person-vote-themes';
import { cn } from '@/lib/utils';

// Filtro de votos por tema: links (funciona sem JavaScript e é compartilhável). Diz quanta das votações tem tema.
export function VoteThemeFilter({data,active,base}:{data:VoteThemes|null;active:string|null;base:string}){
  if(!data||!data.themes.length)return data&&data.totalVotes?<p className="mt-4 text-sm text-muted-foreground">Nenhuma das {data.totalVotes} votações tem tema atribuído no catálogo da Casa, então não há filtro por tema.</p>:null;
  const href=(theme:string|null)=>theme?`${base}?votoTema=${encodeURIComponent(theme)}#votos`:`${base}#votos`;
  return <div className="mt-4 rounded-2xl border bg-card p-4">
    <p className="text-sm font-bold">Filtrar votos por tema</p>
    <ul className="mt-2 flex flex-wrap gap-2">
      <li><Link href={href(null)} aria-current={active===null?'true':undefined} className={cn('focus-ring inline-flex min-h-11 items-center rounded-full border px-3 text-sm font-semibold no-underline','aria-[current=true]:border-primary aria-[current=true]:bg-primary aria-[current=true]:text-primary-foreground')}>Todos os temas</Link></li>
      {data.themes.slice(0,12).map(item=><li key={item.label}><Link href={href(item.label)} aria-current={active===item.label?'true':undefined} className={cn('focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold no-underline','aria-[current=true]:border-primary aria-[current=true]:bg-primary aria-[current=true]:text-primary-foreground')}>{item.label}<span className="text-xs opacity-75">{item.count}</span></Link></li>)}
    </ul>
    <p className="mt-2 text-xs text-muted-foreground">Só {data.themedVotes} das {data.totalVotes} votações têm tema no catálogo da Casa (votações sobre requerimentos e questões de ordem costumam não ter). O tema é o da proposição votada.</p>
  </div>;
}
