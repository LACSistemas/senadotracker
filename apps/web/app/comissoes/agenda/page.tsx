import Link from 'next/link';
import { CalendarOff, Clock, Filter, GitCompare } from 'lucide-react';
import { commissionAgenda } from '@/lib/data';
import { HOUSE, houseOf } from '@/lib/house';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { AgendaItems } from '@/components/agenda-items';
import { MeetingCard } from '@/components/commissions/meeting-card';
import { CoverageNote } from '@/components/commissions/coverage-note';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Q = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => typeof v === 'string' ? v : undefined;
const day = (v: string) => v.slice(0, 10);
const fmtDay = (v: string) => new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day(v)}T12:00:00Z`));
const fmtTime = (v: string | null) => v && v.length > 10 ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(v)) : null;
const fmtShort = (v: string) => new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${day(v)}T12:00:00Z`));

function houseOfMeeting(m: any): string {
  const bodies = m.bodies ?? [];
  if (bodies.some((x: any) => String(x.house).toUpperCase() === 'CONGRESSO') || /^CM/i.test(String(m.title || ''))) return 'CONGRESSO';
  if (bodies.some((x: any) => String(x.house).toUpperCase() === 'CAMARA')) return 'CAMARA';
  if (bodies.some((x: any) => String(x.house).toUpperCase() === 'SENADO')) return 'SENADO';
  return m.source === 'camara' ? 'CAMARA' : 'SENADO';
}

function meetingHeading(m: any): string {
  const title = String(m.title || '').trim(), description = String(m.description || '').trim();
  if (!title) return description || 'Tipo de reunião não informado';
  if (!description) return title;
  const suffix = description.includes('-') ? description.split('-').slice(1).join('-').trim() : '';
  if (suffix && !title.toLocaleLowerCase('pt-BR').includes(suffix.toLocaleLowerCase('pt-BR'))) return `${title} · ${suffix}`;
  return title;
}

function bodyTitle(m: any): string {
  const names = (m.bodies ?? []).map((b: any) => b.name || b.sigla).filter(Boolean);
  return names.length ? names.join(' · ') : m.title || m.meeting_type_raw || 'Reunião de comissão';
}

const changeLabel = (c: any) => {
  switch (c.type) {
    case 'agenda_item_removed': return '− Item retirado da pauta';
    case 'agenda_item_restored': return '+ Item restaurado na pauta';
    case 'agenda_item_reordered': return 'Ordem da pauta alterada';
    case 'meeting_time_changed': return `Horário alterado · ${c.previousValue || 'não informado'} → ${c.currentValue || 'não informado'}`;
    case 'meeting_location_changed': return 'Local alterado';
    case 'meeting_status_changed': return 'Situação da reunião alterada';
    default: return 'Metadados da reunião atualizados';
  }
};

export default async function AgendaPage({ searchParams }: { searchParams: Promise<Q> }) {
  const q = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const from = one(q.from) || today, to = one(q.to) || from, house = one(q.house), body = one(q.body);
  const result = commissionAgenda({ from, to, ...(house === 'senado' || house === 'camara' ? { source: house } : {}), ...(body ? { body } : {}) });

  if (result.status === 'unavailable') {
    return <main className="page-shell py-12"><h1 className="text-3xl font-bold">Agenda das comissões</h1><CoverageNote className="mt-4">{result.message}</CoverageNote></main>;
  }

  const rows = JSON.parse(JSON.stringify(result.data)) as any[];
  const camara = rows.filter(r => r.source === 'camara').length, senado = rows.filter(r => r.source === 'senado').length;
  const grouped = new Map<string, any[]>();
  for (const r of rows) { const k = day(String(r.scheduled_date || r.scheduled_start_at || '')) || 'sem-data'; grouped.set(k, [...(grouped.get(k) || []), r]); }

  const href = (overrides: Record<string, string>) => {
    const p = new URLSearchParams({ from, to, ...(house ? { house } : {}), ...(body ? { body } : {}), ...overrides });
    return `/comissoes/agenda?${p}`;
  };
  const isActive = (presetFrom: string, presetTo: string) => from === presetFrom && to === presetTo;
  const period = `${fmtShort(from)}${from !== to ? ` a ${fmtShort(to)}` : ''}`;
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const presets: Array<[string, string, string]> = [
    ['Hoje', today, today],
    ['Amanhã', tomorrow, tomorrow],
    ['Esta semana', today, new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10)],
    ['Próximos 30 dias', today, new Date(Date.now() + 29 * 86400000).toISOString().slice(0, 10)],
  ];

  return (
    <main id="conteudo" tabIndex={-1}>
      <section className="relative overflow-hidden border-b bg-card">
        <div className="surface-grid pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
        <div className="page-shell relative py-10 sm:py-12">
          <p className="eyebrow">Agenda legislativa</p>
          <h1 className="display-title mt-3 text-4xl sm:text-5xl">Agenda das comissões</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">Acompanhe as reuniões e as matérias pautadas nas comissões da Câmara e do Senado.</p>
        </div>
      </section>

      <div className="page-shell py-8">
        <nav aria-label="Período" className="flex flex-wrap gap-2">
          {presets.map(([label, presetFrom, presetTo]) => {
            const active = isActive(presetFrom, presetTo);
            return (
              <Link key={label} href={href({ from: presetFrom, to: presetTo })} aria-current={active ? 'page' : undefined} className={cn(buttonVariants({ variant: active ? 'default' : 'outline', size: 'sm' }), 'rounded-full')}>
                {label}
              </Link>
            );
          })}
        </nav>

        <form action="/comissoes/agenda" className="mt-4">
          <Card>
            <CardContent className="flex flex-wrap items-end gap-4 p-5">
              <div className="hidden items-center gap-1.5 text-sm font-bold text-muted-foreground sm:flex"><Filter size={15} aria-hidden="true" />Filtros</div>
              <label className="text-sm font-semibold">Casa
                <NativeSelect name="house" defaultValue={house || ''} className="mt-1.5 w-36">
                  <option value="">Todas</option>
                  <option value="senado">Senado</option>
                  <option value="camara">Câmara</option>
                </NativeSelect>
              </label>
              <label className="text-sm font-semibold">De
                <Input name="from" type="date" defaultValue={from} className="mt-1.5 w-40" />
              </label>
              <label className="text-sm font-semibold">Até
                <Input name="to" type="date" defaultValue={to} className="mt-1.5 w-40" />
              </label>
              {body && <input type="hidden" name="body" value={body} />}
              <Button type="submit">Aplicar</Button>
            </CardContent>
          </Card>
        </form>

        {rows.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4">
            <p className="text-sm text-muted-foreground"><strong className="text-foreground">{rows.length} {rows.length === 1 ? 'reunião' : 'reuniões'}</strong> entre {period}</p>
            <div className="ml-auto flex flex-wrap gap-2">
              {camara > 0 && <Badge className={cn('border-0', HOUSE.CAMARA.soft, HOUSE.CAMARA.text)}>{camara} Câmara</Badge>}
              {senado > 0 && <Badge className={cn('border-0', HOUSE.SENADO.soft, HOUSE.SENADO.text)}>{senado} Senado</Badge>}
            </div>
          </div>
        )}

        {rows.length === 0 ? (
          <CoverageNote className="mt-8" icon={CalendarOff}>
            Nenhuma reunião oficial encontrada para este período.{' '}
            <Link href={href({ from: today, to: new Date(Date.now() + 29 * 86400000).toISOString().slice(0, 10) })} className="focus-ring rounded-sm font-semibold text-primary hover:underline">Ver próximos 30 dias</Link>
          </CoverageNote>
        ) : (
          <div className="mt-8 space-y-12">
            {[...grouped].map(([d, meetings]) => (
              <section key={d} aria-label={d === 'sem-data' ? 'Data não informada' : fmtDay(d)}>
                <div className="sticky top-[72px] z-10 -mx-1 border-b bg-background/95 px-1 py-3 backdrop-blur">
                  <div className="flex items-baseline gap-3">
                    <h2 className="display-title text-2xl sm:text-3xl">{d === 'sem-data' ? 'Data não informada' : fmtDay(d)}</h2>
                    <Badge className="bg-secondary text-primary">{meetings.length} {meetings.length === 1 ? 'reunião' : 'reuniões'}</Badge>
                  </div>
                </div>
                <div className="relative mt-6 border-l-2 border-border pl-8">
                  <ol className="space-y-6">
                    {meetings.map((m: any) => {
                      const meetingHouse = houseOfMeeting(m);
                      const info = houseOf(meetingHouse);
                      const time = fmtTime(m.scheduled_start_at);
                      return (
                        <li key={m.id} className="relative">
                          <span className={cn('absolute -left-[37px] top-1.5 size-2.5 rounded-full ring-4 ring-background', info.bg)} aria-hidden="true" />
                          <div className="grid gap-2 sm:grid-cols-[92px_1fr] sm:gap-4">
                            <div className={cn('inline-flex items-center gap-1.5 text-sm font-bold tabular-nums sm:pt-4', info.text)}>
                              <Clock size={13} aria-hidden="true" />
                              {time ?? 'Horário não informado'}
                            </div>
                            <MeetingCard
                              house={meetingHouse}
                              title={bodyTitle(m)}
                              titleHref={m.bodies?.[0]?.id ? `/comissoes/${m.bodies[0].externalId}` : undefined}
                              subtitle={meetingHeading(m)}
                              location={m.location}
                              itemCount={m.item_count}
                            >
                              {m.changes?.length ? (
                                <details className="mt-2 border-t border-border/60 pt-3 text-xs">
                                  <summary className="flex cursor-pointer list-none items-center gap-1.5 font-semibold text-warning"><GitCompare size={13} aria-hidden="true" />Pauta atualizada · {m.changes.length} {m.changes.length === 1 ? 'alteração' : 'alterações'}</summary>
                                  <ul className="mt-2 space-y-1 text-muted-foreground">
                                    {m.changes.map((c: any) => <li key={`${c.type}:${c.occurredAt}:${c.itemId || ''}`}>{changeLabel(c)} · {new Date(c.occurredAt).toLocaleString('pt-BR')}</li>)}
                                  </ul>
                                </details>
                              ) : null}
                              <div className="mt-3"><AgendaItems items={m.items} source={m.source} /></div>
                            </MeetingCard>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
