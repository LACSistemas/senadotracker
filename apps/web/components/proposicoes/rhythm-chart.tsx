'use client';
import { useMemo, useState } from 'react';
import type { HouseRhythm } from '@senadotracker/db';
import { GROUPS, OTHER_COLOR, OTHER_LABEL, nf } from '@/lib/proposicoes/taxonomy';
import { useInView } from './reveal';

const W = 760, H = 310, M = { l: 52, r: 14, t: 26, b: 40 }, PLOT_W = W - M.l - M.r, PLOT_H = H - M.t - M.b, GAP = 2;
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

interface Series { key: string; label: string; color: string }
/** Sete matizes nomeados + "Outras formas" (três grupos menores dobrados), na ordem taxonômica fixa. */
const SERIES: Series[] = [...GROUPS.filter(group => !group.tail).map(group => ({ key: group.key, label: group.verb, color: group.color })), { key: '__other', label: OTHER_LABEL, color: OTHER_COLOR }];
const fold = (counts: number[]) => SERIES.map((_, index) => index < SERIES.length - 1 ? counts[index] ?? 0 : counts.slice(index).reduce((sum, value) => sum + value, 0));
const niceMax = (value: number) => { if (value <= 0) return 1; const magnitude = 10 ** Math.floor(Math.log10(value)), n = value / magnitude; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * magnitude; };

/**
 * Colunas mensais empilhadas por grupo funcional, na ordem fixa dos grupos. Meses sem dado publicado aparecem como
 * lacuna (nunca como coluna zero). A legenda isola uma série ao clique e a tabela de dados é a alternativa acessível.
 */
export function RhythmChart({ rhythm, year, mode }: { rhythm: HouseRhythm; year: number; mode: 'presented' | 'events' }) {
  const [ref, inView] = useInView<HTMLDivElement>(0.25);
  const [isolated, setIsolated] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const byMonth = useMemo(() => new Map(rhythm.months.map(month => [Number(month.month.slice(5, 7)), fold(month.counts)])), [rhythm.months]);
  const last = Math.max(1, ...byMonth.keys());
  const visible = (values: number[]) => isolated === null ? values : values.map((value, index) => SERIES[index]!.key === isolated ? value : 0);
  const totals = [...byMonth.entries()].map(([month, values]) => [month, visible(values).reduce((sum, value) => sum + value, 0)] as const);
  const top = niceMax(Math.max(1, ...totals.map(([, total]) => total))), slot = PLOT_W / last, barW = Math.min(30, slot * 0.62);
  const y = (value: number) => M.t + PLOT_H - (value / top) * PLOT_H;
  const peak = totals.reduce<readonly [number, number] | null>((best, entry) => (best === null || entry[1] > best[1] ? entry : best), null);
  const tip = hover === null ? null : byMonth.get(hover) ? { month: hover, values: byMonth.get(hover)! } : null;
  const unit = mode === 'presented' ? 'proposições' : 'registros de tramitação';
  if (!rhythm.total) return <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">{rhythm.coverage.note}</p>;
  return <div ref={ref}>
    <ul className="flex flex-wrap gap-1.5" aria-label="Legenda: clique para isolar um grupo">
      {SERIES.map(series => <li key={series.key}><button type="button" aria-pressed={isolated === series.key} onClick={() => setIsolated(isolated === series.key ? null : series.key)}
        className={`focus-ring inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${isolated === series.key ? 'bg-muted' : 'hover:bg-muted/60'} ${isolated && isolated !== series.key ? 'opacity-50' : ''}`}><i className="size-2.5 rounded-sm" style={{ background: series.color }} aria-hidden="true" />{series.label}</button></li>)}
    </ul>
    <div className="mt-4 overflow-x-auto"><div className="relative min-w-[600px]">
      {tip ? <div aria-hidden="true" className="pointer-events-none absolute top-0 z-10 w-60 -translate-x-1/2 rounded-xl border bg-card p-3 text-xs shadow-lg" style={{ left: `${Math.max(18, Math.min(82, ((M.l + (tip.month - 0.5) * slot) / W) * 100))}%` }}>
        <p className="text-base font-bold leading-none">{nf.format(visible(tip.values).reduce((a, b) => a + b, 0))} <span className="text-xs font-semibold text-muted-foreground">{unit} em {MONTHS[tip.month - 1]}/{year}</span></p>
        <ul className="mt-2 space-y-1">{SERIES.map((series, index) => visible(tip.values)[index] ? <li key={series.key} className="flex items-center justify-between gap-3 text-muted-foreground"><span className="flex items-center gap-1.5"><i className="h-1 w-3 rounded-full" style={{ background: series.color }} />{series.label}</span><b className="tabular-nums text-foreground">{nf.format(visible(tip.values)[index]!)}</b></li> : null)}</ul>
      </div> : null}
      <svg role="img" aria-label={`Colunas mensais de ${unit} em ${year}, por grupo funcional. A tabela abaixo traz os mesmos dados.`} viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
        {[0, 0.5, 1].map(step => <g key={step}><line x1={M.l} x2={W - M.r} y1={y(top * step)} y2={y(top * step)} stroke="var(--border)" strokeWidth="1" /><text x={M.l - 8} y={y(top * step) + 4} textAnchor="end" fontSize="11" fill="var(--muted-foreground)">{compact.format(top * step)}</text></g>)}
        {Array.from({ length: last }, (_, index) => {
          const month = index + 1, values = byMonth.get(month), cx = M.l + (index + 0.5) * slot;
          let acc = 0;
          return <g key={month} tabIndex={values ? 0 : -1} role={values ? 'img' : undefined} aria-label={values ? `${MONTHS[index]}/${year}: ${nf.format(visible(values).reduce((a, b) => a + b, 0))} ${unit}` : undefined}
            onPointerEnter={() => values && setHover(month)} onPointerLeave={() => setHover(null)} onFocus={() => values && setHover(month)} onBlur={() => setHover(null)} className="focus-ring outline-none">
            <rect x={cx - slot / 2} y={M.t} width={slot} height={PLOT_H + 26} fill="transparent" />
            {values ? visible(values).map((value, seriesIndex) => {
              if (!value) return null;
              const base = acc; acc += value;
              const height = Math.max(1, y(base) - y(acc) - GAP);
              return <rect key={seriesIndex} x={cx - barW / 2} y={y(acc)} width={barW} height={height} fill={SERIES[seriesIndex]!.color} rx={seriesIndex === SERIES.length - 1 || acc === visible(values).reduce((a, b) => a + b, 0) ? 3 : 0}
                style={{ transformOrigin: `${cx}px ${y(0)}px`, transform: inView ? 'scaleY(1)' : 'scaleY(0)', transition: `transform 750ms cubic-bezier(.2,.7,.2,1) ${index * 45}ms` }} />;
            }) : <text x={cx} y={y(0) - 8} textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">sem dado</text>}
            <text x={cx} y={H - M.b + 18} textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">{MONTHS[index]}</text>
          </g>;
        })}
        {peak ? <text x={M.l + (peak[0] - 0.5) * slot} y={y(peak[1]) - 8} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--foreground)">{nf.format(peak[1])}</text> : null}
        <line x1={M.l} x2={W - M.r} y1={y(0)} y2={y(0)} stroke="var(--border)" />
      </svg>
    </div></div>
    <p className="mt-1 text-xs text-muted-foreground md:hidden">Arraste para o lado para ver o gráfico inteiro.</p>
    <details className="mt-3 text-sm"><summary className="focus-ring w-fit cursor-pointer text-xs font-bold text-primary">Ver dados do gráfico</summary>
      <div className="mt-2 overflow-x-auto"><table className="w-full text-left"><caption className="sr-only">{unit} por mês e grupo funcional em {year}</caption>
        <thead><tr className="border-b text-xs text-muted-foreground"><th className="p-2 font-semibold">Mês</th>{SERIES.map(series => <th key={series.key} className="p-2 text-right font-semibold">{series.label}</th>)}<th className="p-2 text-right font-semibold">Total</th></tr></thead>
        <tbody>{rhythm.months.map(month => { const values = fold(month.counts); return <tr key={month.month} className="border-b last:border-0"><th className="p-2 font-medium">{MONTHS[Number(month.month.slice(5, 7)) - 1]}/{year}</th>{values.map((value, index) => <td key={index} className="p-2 text-right tabular-nums">{nf.format(value)}</td>)}<td className="p-2 text-right font-semibold tabular-nums">{nf.format(month.total)}</td></tr>; })}</tbody>
      </table></div></details>
    <p className="mt-3 text-xs leading-5 text-muted-foreground">{rhythm.coverage.note}</p>
  </div>;
}
