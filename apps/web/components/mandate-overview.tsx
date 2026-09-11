import { CalendarDays, Flag } from 'lucide-react';
import type { Profile } from '@senadotracker/domain';
import { PartyLogo } from '@/components/party-logo';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

const format = (value: string | null) => value ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(value.slice(0, 10) + 'T12:00:00Z')) : null;
const today = new Date().toISOString().slice(0, 10);

function displayedParties(profile: Profile) {
  const rows = [...profile.parties].sort((a, b) => a.start.localeCompare(b.start));
  const result: Array<{ party: string; start: string; end: string | null; keys: string[] }> = [];
  for (const row of rows) {
    const prior = result.at(-1);
    const closeEnough = prior?.end && new Date(row.start.slice(0, 10)).getTime() - new Date(prior.end.slice(0, 10)).getTime() <= 3 * 86_400_000;
    if (prior?.party === row.party && (!prior.end || closeEnough)) {
      prior.end = row.end;
      prior.keys.push(row.key);
    } else result.push({ party: row.party, start: row.start, end: row.end, keys: [row.key] });
  }
  return result;
}

export function MandateOverview({ profile }: { profile: Profile }) {
  const memberships = displayedParties(profile);
  return <div className="grid gap-5 lg:grid-cols-2">
    <Card><CardHeader><h3 className="flex items-center gap-2 text-lg font-bold"><CalendarDays size={20}/>Mandatos como parlamentar</h3></CardHeader><CardContent className="space-y-3">{[...profile.mandates].sort((a,b)=>(b.start??'').localeCompare(a.start??'')).map(item => {
      const current = Boolean(item.start && item.start <= today && (!item.end || item.end >= today));
      return <article key={item.key} className="rounded-2xl border bg-secondary/30 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-base">{format(item.start)?.slice(-4)}–{format(item.end)?.slice(-4)}</strong>{current && <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">Mandato atual</span>}</div>
        <p className="mt-1 text-sm font-semibold">{item.role ?? (profile.source === 'camara' ? 'Deputado federal' : 'Senador')} · {item.uf}</p>
        <p className="mt-2 text-sm text-muted-foreground">{format(item.start) ?? 'Início não publicado'} até {format(item.end) ?? (current ? 'o presente' : 'fim não publicado')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{item.legislature}ª Legislatura</p>
      </article>})}</CardContent></Card>
    <Card><CardHeader><h3 className="flex items-center gap-2 text-lg font-bold"><Flag size={20}/>Histórico partidário</h3></CardHeader><CardContent>{memberships.length ? <ol className="relative ml-3 border-l border-border pl-6">{memberships.map(item => <li key={item.keys.join(':')} className="relative pb-6 last:pb-0"><span className="absolute -left-[2.35rem] grid size-8 place-items-center rounded-full border bg-card"><PartyLogo party={item.party} size={22}/></span><strong className="text-base">{item.party}</strong><p className="mt-1 text-sm text-muted-foreground">{format(item.start)} até {item.end ? format(item.end) : 'o presente'}</p></li>)}</ol> : <p className="text-sm text-muted-foreground">Histórico partidário não publicado.</p>}</CardContent></Card>
  </div>;
}
