import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { ArrowRight, CalendarClock, CalendarDays, ExternalLink, FileText, ListChecks } from 'lucide-react';
import { commissionDetail } from '@/lib/data';
import { houseOf } from '@/lib/house';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HouseBadge } from '@/components/commissions/house-badge';
import { StatTile } from '@/components/commissions/stat-tile';
import { MeetingCard } from '@/components/commissions/meeting-card';
import { CoverageNote } from '@/components/commissions/coverage-note';
import { AgendaItems } from '@/components/agenda-items';
import { CommissionComposition } from '@/components/commission-composition';
import { CommissionRapporteurships } from '@/components/commission-rapporteurships';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const dateLabel = (value: string | null | undefined) => value
  ? new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`))
  : null;
const timeLabel = (value: string | null | undefined) => value && value.length > 10
  ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(value))
  : null;
const meetingTitle = (m: any) => m.title || m.description || null;

function SectionEyebrow({ eyebrow, title, description }: { eyebrow: string; title: string; description?: ReactNode }) {
  return (
    <header>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="display-title mt-2 text-2xl sm:text-3xl">{title}</h2>
      {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>}
    </header>
  );
}

function Meeting({ m, highlight, footer }: { m: any; highlight?: boolean; footer?: ReactNode }) {
  return (
    <MeetingCard
      highlight={highlight}
      date={dateLabel(m.scheduled_date)}
      time={timeLabel(m.scheduled_start_at)}
      title={meetingTitle(m) ?? 'Tipo de reunião não informado'}
      location={m.location}
      itemCount={m.item_count}
    >
      <AgendaItems items={m.items.slice(0, 3)} source={m.source} />
      {footer && <div className="mt-4">{footer}</div>}
    </MeetingCard>
  );
}

export default async function CommissionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<Record<string, string | undefined>> }) {
  const route = await params;
  const q = searchParams ? await searchParams : {};
  const year = Number(q.year) || new Date().getFullYear();
  const result = commissionDetail(decodeURIComponent(route.id), year);
  if (result.status === 'unavailable' || !result.data) notFound();
  const data = JSON.parse(JSON.stringify(result.data));
  const b = data.body;
  const next = data.nextMeeting;
  const info = houseOf(b.house);
  const agendaHref = `/comissoes/agenda?body=${encodeURIComponent(b.external_id)}`;

  return (
    <main className="pb-16">
      <section className="relative isolate overflow-hidden border-b bg-primary text-primary-foreground">
        <div className="surface-grid pointer-events-none absolute inset-0 -z-10 opacity-[0.08]" aria-hidden="true" />
        <div className="absolute inset-0 -z-20 bg-gradient-to-br from-primary via-primary/95 to-[#0e4939]" />
        <div className="page-shell py-10 sm:py-14">
          <HouseBadge house={b.house} variant="inverted" />
          <h1 className="display-title mt-4 max-w-3xl text-balance text-4xl sm:text-6xl">{b.name}</h1>
          <p className="mt-3 text-white/80">{b.sigla || 'Sigla não informada'} · {info.label}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href={agendaHref} className={cn(buttonVariants(), 'bg-white text-foreground hover:bg-white/90')}>Ver agenda completa <ArrowRight size={15} /></Link>
            {b.source_url && <a href={b.source_url} className={cn(buttonVariants({ variant: 'outline' }), 'border-white/30 bg-transparent text-white hover:bg-white/10')}>Fonte oficial <ExternalLink size={14} /></a>}
          </div>
        </div>
      </section>

      <div className="page-shell space-y-14 py-10">
        <section aria-labelledby="atividade-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="atividade-title" className="text-2xl font-bold">Atividade em {year}</h2>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <StatTile icon={CalendarDays} value={data.activity.meetings} label="Reuniões" />
            <StatTile icon={ListChecks} value={data.activity.items} label="Itens de pauta" />
            <StatTile icon={FileText} value={data.activity.matters} label="Matérias distintas" />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Contagens de atividade registrada na agenda coletada; não representam produtividade ou eficiência.</p>
        </section>

        {data.agendaCoverage === 'unavailable' ? (
          <CoverageNote>Não há cobertura publicada de reuniões e pautas para este colegiado no período consultado.</CoverageNote>
        ) : (
          <>
            <section aria-labelledby="proxima-reuniao-title">
              <div className="flex items-center gap-2">
                <CalendarClock size={18} className="text-primary" aria-hidden="true" />
                <p id="proxima-reuniao-title" className="eyebrow">Próxima reunião</p>
              </div>
              <div className="mt-4">
                {next
                  ? <Meeting m={next} highlight footer={<Link href={`/comissoes/agenda?body=${encodeURIComponent(b.external_id)}&from=${next.scheduled_date}&to=${next.scheduled_date}`} className="focus-ring inline-flex items-center gap-1.5 rounded-sm text-sm font-bold text-primary hover:underline">Ver pauta completa <ArrowRight size={14} /></Link>} />
                  : <CoverageNote icon={CalendarClock}>Nenhuma próxima reunião publicada na cobertura atual.</CoverageNote>}
              </div>
            </section>

            <section aria-labelledby="ultimas-reunioes-title">
              <SectionEyebrow eyebrow="Histórico" title="Últimas reuniões" />
              {data.recent.length ? (
                <div className="mt-5 space-y-4">{data.recent.slice(0, 2).map((m: any) => <Meeting key={m.id} m={m} />)}</div>
              ) : (
                <CoverageNote className="mt-4">Nenhuma reunião identificada na cobertura atual.</CoverageNote>
              )}
              {data.recent.length > 2 && <Link href={agendaHref} className="focus-ring mt-4 inline-flex items-center gap-1.5 rounded-sm text-sm font-bold text-primary hover:underline">Ver todas as reuniões <ArrowRight size={14} /></Link>}
            </section>
          </>
        )}

        <CommissionComposition data={data} source={b.source} />
        <CommissionRapporteurships data={data} />

        <section aria-labelledby="materias-title">
          <SectionEyebrow eyebrow="Pautas identificadas" title="Matérias pautadas nesta comissão" description="Proposições registradas nas pautas das reuniões identificadas para este órgão." />
          {data.mattersCoverage === 'unavailable' ? (
            <CoverageNote className="mt-5">A cobertura de pautas deste colegiado não está disponível no recorte atual.</CoverageNote>
          ) : data.matters.length ? (
            <ul className="mt-5 space-y-3">
              {data.matters.map((i: any) => (
                <li key={i.proposalId} className="card-elevated flex gap-3 rounded-2xl border bg-card p-4 transition hover:border-primary/30">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-primary"><FileText size={15} /></span>
                  <div className="min-w-0">
                    <Link href={`/legislativo/proposicoes/${i.proposalSource}/${i.proposalId}`} className="focus-ring inline-block rounded-full">
                      <Badge className="border-0 bg-secondary font-mono text-xs normal-case tracking-normal text-primary transition-colors hover:bg-primary hover:text-primary-foreground">{i.proposalLabel || i.proposalId}</Badge>
                    </Link>
                    {i.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{i.description}</p>}
                    <p className="mt-1.5 text-xs text-muted-foreground">{i.appearancesCount} aparições · última em {dateLabel(i.lastAppearance)}</p>
                    {i.latestPublishedResult && <p className="mt-1 text-xs text-muted-foreground">Último resultado registrado em pauta · {i.latestPublishedResult}</p>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <CoverageNote className="mt-5">Nenhuma matéria de pauta identificada.</CoverageNote>
          )}
        </section>
      </div>
    </main>
  );
}
