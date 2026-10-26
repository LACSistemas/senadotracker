'use client';
import { useMemo, useState } from 'react';
import { ExternalLink, Users, Landmark, FileText, Layers, Crown, UserPlus, CalendarRange } from 'lucide-react';
import { rapporteurDateLabel, type Source } from '@senadotracker/domain';
import { StatTile } from '@/components/commissions/stat-tile';
import { nf, pf0, formatDate } from '@/lib/proposicoes/taxonomy';

/**
 * "Onde atua?" — redesenho da seção de comissões, relatorias e cargos do perfil.
 *
 * Opera sobre as designações JÁ carregadas pelo servidor (até 100). O filtro por tipo,
 * a separação entre atuais e encerradas e a mini-linha do tempo são todos client-side:
 * nenhuma consulta nova.
 */

export interface PanelAppointment {
  externalId: string;
  kind: 'rapporteurship' | 'commission' | 'office';
  role: string;
  bodyLabel: string | null;
  start: string | null;
  end: string | null;
  status: string | null;
  statusDate?: string | null;
  dateBasis?: 'designation' | 'latest_status' | 'membership_start' | 'unknown';
  officialUrl: string;
}

type TabKey = 'all' | 'commission' | 'rapporteurship' | 'office';
const TABS: Array<{ key: TabKey; label: string; kind?: PanelAppointment['kind'] }> = [
  { key: 'all', label: 'Tudo' },
  { key: 'commission', label: 'Comissões', kind: 'commission' },
  { key: 'rapporteurship', label: 'Relatorias', kind: 'rapporteurship' },
  { key: 'office', label: 'Cargos', kind: 'office' },
];
const TODAY = new Date().toISOString().slice(0, 10);
const day = (value: string | null) => value?.slice(0, 10) ?? null;
const isCurrent = (a: PanelAppointment) => { const e = day(a.end); return !e || e >= TODAY; };
const ms = (value: string | null) => { const d = day(value); const t = d ? Date.parse(`${d}T00:00:00Z`) : NaN; return Number.isFinite(t) ? t : null; };
const yearOf = (value: string | null) => day(value)?.slice(0, 4) ?? null;
const roleIs = (a: PanelAppointment, re: RegExp) => a.kind === 'commission' && re.test(a.role ?? '');
const kindIcon = { commission: Users, rapporteurship: FileText, office: Landmark } as const;

function TimelineBar({ item, frameStart, frameLen }: { item: PanelAppointment; frameStart: number; frameLen: number }) {
  const start = ms(item.start);
  if (start === null || frameLen <= 0) return null;
  const endMs = ms(item.end) ?? Date.parse(`${TODAY}T00:00:00Z`);
  const left = Math.max(0, Math.min(1, (start - frameStart) / frameLen));
  const right = Math.max(0, Math.min(1, (endMs - frameStart) / frameLen));
  const current = isCurrent(item);
  return (
    <div className="mt-3 h-1.5 w-full rounded-full bg-muted" aria-hidden="true">
      <div className="relative h-full rounded-full"
        style={{ marginLeft: `${left * 100}%`, width: `${Math.max(3, (right - left) * 100)}%`, background: 'var(--primary)' }}>
        <span className={`absolute right-0 top-1/2 size-2.5 -translate-y-1/2 translate-x-1/2 rounded-full border-2 border-card ${current ? 'bg-primary ap-pulse' : 'bg-muted-foreground'}`} />
      </div>
    </div>
  );
}

function AppointmentCard({ item, source, frameStart, frameLen }: { item: PanelAppointment; source: Source; frameStart: number; frameLen: number }) {
  const Icon = kindIcon[item.kind];
  const current = isCurrent(item);
  const titular = roleIs(item, /titular|presid|vice|relator\b/i);
  const dateLabel = rapporteurDateLabel(source, item.kind, item.dateBasis ?? 'unknown', day(item.start), day(item.statusDate ?? null), day(item.end), formatDate);
  return (
    <article className="card-elevated flex flex-col rounded-2xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><Icon size={17} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-bold leading-snug">{item.bodyLabel || item.role || 'Órgão não informado'}</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">{item.role || 'Função não informada'}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${titular ? 'bg-secondary text-primary' : 'border bg-muted text-muted-foreground'}`}>
          {item.role?.match(/titular|suplente|relator|presidente|vice/i)?.[0] ?? (item.kind === 'rapporteurship' ? 'Relatoria' : 'Membro')}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <i className={`size-1.5 rounded-full ${current ? 'bg-primary' : 'bg-muted-foreground'}`} aria-hidden="true" />
          {current ? 'Atual' : 'Encerrada'} · {dateLabel}
        </span>
        <a href={item.officialUrl} className="focus-ring inline-flex shrink-0 items-center gap-1 font-bold text-primary hover:underline">
          Fonte oficial <ExternalLink size={12} aria-hidden="true" /></a>
      </div>
      <TimelineBar item={item} frameStart={frameStart} frameLen={frameLen} />
    </article>
  );
}

export function AppointmentsPanel({ appointments, source }: { appointments: PanelAppointment[]; source: Source }) {
  const [tab, setTab] = useState<TabKey>('all');
  const [showAllHistory, setShowAllHistory] = useState(false);

  const counts = useMemo(() => ({
    commission: appointments.filter(a => a.kind === 'commission').length,
    rapporteurship: appointments.filter(a => a.kind === 'rapporteurship').length,
    office: appointments.filter(a => a.kind === 'office').length,
    titular: appointments.filter(a => roleIs(a, /titular/i)).length,
    suplente: appointments.filter(a => roleIs(a, /suplente/i)).length,
  }), [appointments]);
  const bodiesTotal = counts.commission + counts.office;

  const period = useMemo(() => {
    const startYears = appointments.map(a => yearOf(a.start)).filter(Boolean) as string[];
    if (!startYears.length) return null;
    const from = startYears.reduce((a, b) => (a < b ? a : b));
    const endYears = appointments.map(a => (isCurrent(a) ? null : yearOf(a.end))).filter(Boolean) as string[];
    const openEnded = appointments.some(isCurrent);
    const to = openEnded ? 'atual' : endYears.length ? endYears.reduce((a, b) => (a > b ? a : b)) : from;
    return from === to ? from : `${from}–${to}`;
  }, [appointments]);

  // Moldura compartilhada da mini-linha do tempo (todas as barras no mesmo referencial honesto).
  const [frameStart, frameLen] = useMemo(() => {
    const starts = appointments.map(a => ms(a.start)).filter((v): v is number => v !== null);
    if (!starts.length) return [0, 0] as const;
    const min = Math.min(...starts);
    const ends = appointments.map(a => ms(a.end) ?? Date.parse(`${TODAY}T00:00:00Z`)).filter((v): v is number => v !== null);
    const max = Math.max(...ends, Date.parse(`${TODAY}T00:00:00Z`));
    return [min, Math.max(1, max - min)] as const;
  }, [appointments]);

  const filtered = useMemo(() => {
    const kind = TABS.find(t => t.key === tab)?.kind;
    return kind ? appointments.filter(a => a.kind === kind) : appointments;
  }, [appointments, tab]);
  const current = filtered.filter(isCurrent);
  const history = filtered.filter(a => !isCurrent(a));
  const historyShown = showAllHistory ? history : history.slice(0, 4);

  if (!appointments.length) return (
    <div className="mt-6 rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
      Nenhuma função, comissão ou relatoria vinculada no lote publicado.
    </div>
  );

  return (
    <div className="mt-6 space-y-7">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile icon={Layers} value={nf.format(bodiesTotal)} label="Comissões e cargos"
          action={<span className="text-xs text-muted-foreground">designações no lote publicado</span>} />
        <StatTile icon={Crown} value={nf.format(counts.titular)} label="Titular"
          action={<span className="text-xs text-muted-foreground">{bodiesTotal ? `${pf0.format(counts.titular / bodiesTotal)} das comissões e cargos` : 'sem vínculo'}</span>} />
        <StatTile icon={UserPlus} value={nf.format(counts.suplente)} label="Suplente"
          action={<span className="text-xs text-muted-foreground">{bodiesTotal ? `${pf0.format(counts.suplente / bodiesTotal)} das comissões e cargos` : 'sem vínculo'}</span>} />
        <StatTile icon={FileText} value={nf.format(counts.rapporteurship)} label="Relatorias"
          action={<span className="text-xs text-muted-foreground">pareceres em que foi designado</span>} />
        <StatTile icon={CalendarRange} value={period ?? '—'} valueClassName="text-3xl" label="Período de atuação"
          action={<span className="text-xs text-muted-foreground">{period ? 'das designações publicadas' : 'sem data publicada'}</span>} />
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por tipo de atuação">
        {TABS.map(t => {
          const count = t.key === 'all' ? appointments.length : counts[t.key];
          return (
            <button key={t.key} type="button" aria-pressed={tab === t.key} onClick={() => { setTab(t.key); setShowAllHistory(false); }}
              className={`focus-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${tab === t.key ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted'}`}>
              {t.label} ({nf.format(count)})
            </button>
          );
        })}
      </div>

      {current.length > 0 && (
        <section aria-label="Atuações atuais">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <i className="size-2 rounded-full bg-primary" aria-hidden="true" />Atuais <span className="font-normal text-muted-foreground">({nf.format(current.length)})</span>
          </h3>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {current.map(item => <AppointmentCard key={item.externalId} item={item} source={source} frameStart={frameStart} frameLen={frameLen} />)}
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section aria-label="Atuações encerradas">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <i className="size-2 rounded-full bg-muted-foreground" aria-hidden="true" />Histórico <span className="font-normal text-muted-foreground">({nf.format(history.length)})</span>
          </h3>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {historyShown.map(item => <AppointmentCard key={item.externalId} item={item} source={source} frameStart={frameStart} frameLen={frameLen} />)}
          </div>
          {history.length > 4 && (
            <button type="button" onClick={() => setShowAllHistory(v => !v)}
              className="focus-ring mt-4 w-full rounded-xl border bg-card py-2.5 text-sm font-bold text-primary transition hover:bg-muted">
              {showAllHistory ? 'Ver menos' : `Ver histórico completo (${nf.format(history.length - 4)} a mais)`}
            </button>
          )}
        </section>
      )}

      {current.length === 0 && history.length === 0 && (
        <p className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">Nenhuma atuação deste tipo no lote publicado.</p>
      )}
    </div>
  );
}
