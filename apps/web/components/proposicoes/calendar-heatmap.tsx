'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { ActivityCalendar, CalendarDay } from '@senadotracker/db';
import { formatDate, nf } from '@/lib/proposicoes/taxonomy';

const CELL = 12, STEP = 15, LEFT = 30, TOP = 20;
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const KIND: Record<string, string> = { movement: 'Movimentação', situation: 'Situação', agenda_item: 'Item de pauta', vote_effect: 'Efeito de votação', resulting_norm: 'Norma resultante', body: 'Órgão' };
const iso = (date: Date) => date.toISOString().slice(0, 10);

/** Degrau da rampa sequencial (um matiz): 1 = sem registro dentro da cobertura, 5 = o dia mais movimentado. */
const step = (count: number, max: number) => count <= 0 ? 1 : Math.min(5, 2 + Math.floor(3 * Math.sqrt(count / Math.max(1, max)) * 0.999));

/**
 * Calendário anual (uma célula por dia, semanas em colunas). Três estados, nunca confundidos: fora da cobertura
 * publicada (sem dado), dentro da cobertura sem registro, e a rampa de intensidade. Clicar em um dia, ou escolhê-lo no
 * campo de data, revela o que foi registrado nele.
 */
export function CalendarHeatmap({ calendar }: { calendar: ActivityCalendar }) {
  const [selected, setSelected] = useState<string | null>(calendar.days.at(-1)?.date ?? null);
  const [hover, setHover] = useState<string | null>(null);
  const byDate = useMemo(() => new Map(calendar.days.map(day => [day.date, day])), [calendar.days]);
  const cells = useMemo(() => {
    const first = new Date(Date.UTC(calendar.year, 0, 1)), out: Array<{ date: string; week: number; weekday: number }> = [];
    for (let time = first.getTime(), index = 0; index < 372; time += 86_400_000, index++) {
      const date = new Date(time);
      if (date.getUTCFullYear() !== calendar.year) break;
      out.push({ date: iso(date), week: Math.floor((index + first.getUTCDay()) / 7), weekday: date.getUTCDay() });
    }
    return out;
  }, [calendar.year]);
  const weeks = (cells.at(-1)?.week ?? 52) + 1, W = LEFT + weeks * STEP + 6, H = TOP + 7 * STEP + 6;
  const from = calendar.coverageFrom, to = calendar.coverageTo;
  if (!calendar.days.length || !from || !to) return <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">{calendar.coverage.note}</p>;
  const day: CalendarDay | undefined = selected ? byDate.get(selected) : undefined;
  const hovered = hover ? { date: hover, count: byDate.get(hover)?.count ?? 0, covered: hover >= from && hover <= to } : null;
  const monthStarts = cells.filter(cell => cell.date.endsWith('-01') || cell.date === `${calendar.year}-01-01`).map(cell => ({ ...cell, month: Number(cell.date.slice(5, 7)) - 1 }));
  return <div>
    <div className="overflow-x-auto"><div className="relative min-w-[720px]">
      {hovered ? <p aria-hidden="true" className="pointer-events-none absolute right-0 top-0 rounded-lg border bg-card px-2.5 py-1 text-xs shadow"><b className="tabular-nums">{hovered.covered ? nf.format(hovered.count) : 'sem dado'}</b> <span className="text-muted-foreground">· {formatDate(hovered.date)}</span></p> : null}
      <svg role="img" aria-label={`Calendário de ${calendar.year}: registros de tramitação por dia, de ${formatDate(from)} a ${formatDate(to)}. O campo de data abaixo permite consultar qualquer dia.`} viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
        {monthStarts.map(cell => <text key={cell.date} x={LEFT + cell.week * STEP} y={12} fontSize="10" fill="var(--muted-foreground)">{MONTHS[cell.month]}</text>)}
        {[1, 3, 5].map(weekday => <text key={weekday} x={LEFT - 6} y={TOP + weekday * STEP + 10} textAnchor="end" fontSize="10" fill="var(--muted-foreground)">{['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][weekday]}</text>)}
        {cells.map(cell => {
          const covered = cell.date >= from && cell.date <= to, entry = byDate.get(cell.date);
          const fill = !covered ? 'var(--muted)' : `var(--map-${step(entry?.count ?? 0, calendar.max)})`;
          return <rect key={cell.date} x={LEFT + cell.week * STEP} y={TOP + cell.weekday * STEP} width={CELL} height={CELL} rx="2.5" fill={fill} fillOpacity={covered ? 1 : 0.4}
            stroke={selected === cell.date ? 'var(--foreground)' : 'transparent'} strokeWidth="1.6" onPointerEnter={() => setHover(cell.date)} onPointerLeave={() => setHover(null)} onClick={() => setSelected(cell.date)} className="cursor-pointer" />;
        })}
      </svg>
    </div></div>
    <p className="mt-1 text-xs text-muted-foreground md:hidden">Arraste para o lado para ver o gráfico inteiro.</p>
    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5"><i className="size-3 rounded-[3px] bg-[var(--muted)] opacity-50" />Sem cobertura publicada</span>
      <span className="flex items-center gap-1.5">Menos<span className="flex gap-[2px]">{[1, 2, 3, 4, 5].map(level => <i key={level} className="size-3 rounded-[3px]" style={{ background: `var(--map-${level})` }} />)}</span>Mais registros no dia</span>
      <label className="ml-auto flex items-center gap-2 font-semibold">Ver um dia <input type="date" min={from} max={to} value={selected ?? ''} onChange={event => setSelected(event.target.value || null)} className="focus-ring rounded-lg border bg-background px-2 py-1 text-xs font-normal text-foreground" /></label>
    </div>
    <div className="prop-fade-in mt-4 rounded-2xl border bg-background p-5" aria-live="polite" key={selected ?? 'none'}>
      {selected ? <>
        <p className="text-xs font-bold uppercase tracking-[.14em] text-muted-foreground">{formatDate(selected)}</p>
        {selected < from || selected > to
          ? <p className="mt-1 text-sm text-muted-foreground">Sem cobertura publicada para este dia (a cobertura vai de {formatDate(from)} a {formatDate(to)}).</p>
          : day
            ? <><p className="mt-1 text-lg font-bold"><span className="hero-figure text-3xl">{nf.format(day.count)}</span> <span className="text-sm font-normal text-muted-foreground">registros de tramitação</span></p>
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">{Object.entries(day.byKind).map(([kind, count]) => <span key={kind}>{KIND[kind] ?? kind}: <b className="tabular-nums text-foreground">{nf.format(count)}</b></span>)}</p>
              <ul className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">{day.examples.map(example => <li key={example.proposalId} className="text-sm"><Link className="font-semibold text-primary underline" href={`/legislativo/proposicoes/${calendar.source}/${encodeURIComponent(example.proposalId)}`}>{example.label}</Link> <span className="text-xs text-muted-foreground">· {KIND[example.kind] ?? example.kind}</span></li>)}</ul>
              {day.count > day.examples.length ? <p className="mt-2 text-xs text-muted-foreground">Mostrando {day.examples.length} de {nf.format(day.count)} registros do dia.</p> : null}</>
            : <p className="mt-1 text-sm text-muted-foreground">Nenhum registro de tramitação neste dia, dentro da cobertura publicada.</p>}
      </> : <p className="text-sm text-muted-foreground">Clique em um dia do calendário para ver o que foi registrado.</p>}
    </div>
    <p className="mt-3 text-xs leading-5 text-muted-foreground">{calendar.coverage.note}</p>
  </div>;
}
