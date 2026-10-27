'use client';

import * as React from 'react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { BenchView, ChartPoint, ChartSeries, ChartView, PointState } from '../../lib/security/types.ts';
import { fmt, periodLabel } from '../../lib/security/format.ts';
import { cn } from '../../lib/utils.ts';

const COLORS: Record<NonNullable<ChartSeries['color']>, string> = { primary: '#115b45', ink: '#14304f', amber: '#a77612', blue: '#3263c3', plum: '#74478e', grey: '#7b8aa0' };
const STATE_LABEL: Record<PointState, string> = { ok: '', prelim: 'preliminar: pode ser revisto', partial: 'ano incompleto', zero: 'zero informado pela fonte', suppressed: 'valor suprimido para proteger as vítimas', absent: 'sem dado' };
const RANGES = [{ key: 'all', label: 'Tudo', years: 0 }, { key: '10', label: '10 anos', years: 10 }, { key: '5', label: '5 anos', years: 5 }, { key: '3', label: '3 anos', years: 3 }] as const;
type RangeKey = (typeof RANGES)[number]['key'];

/** "2025" → 2025; "2025-07" → 2025.5 (meio do mês só para posicionar). */
const tnum = (t: string): number => t.length === 4 ? Number(t) : Number(t.slice(0, 4)) + (Number(t.slice(5, 7)) - 1) / 12;
const niceStep = (raw: number): number => { const p = 10 ** Math.floor(Math.log10(raw || 1)); const f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; };

function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null); const [w, setW] = useState(760);
  useEffect(() => { const el = ref.current; if (!el) return; const ro = new ResizeObserver(([e]) => { const cw = Math.round(e!.contentRect.width); if (cw > 0) setW(cw); }); ro.observe(el); setW(Math.round(el.getBoundingClientRect().width) || 760); return () => ro.disconnect(); }, []);
  return [ref, w];
}

export interface TrendChartProps { chart: ChartView; height?: number; compact?: boolean; hideControls?: boolean; valuePrefix?: string; title?: boolean; className?: string; defaultRange?: RangeKey; footer?: React.ReactNode }

export function TrendChart({ chart, height, compact = false, hideControls = false, valuePrefix = '', title = true, className, defaultRange = 'all', footer }: TrendChartProps) {
  const id = useId(); const [wrapRef, width] = useWidth();
  const [mode, setMode] = useState<'main' | 'monthly'>('main'); const [range, setRange] = useState<RangeKey>(defaultRange); const [hover, setHover] = useState<number | null>(null);
  const hasMonthly = !!chart.monthly?.length && chart.monthly.some(s => s.points.length > 0);
  const base: ChartSeries[] = mode === 'monthly' && hasMonthly ? chart.monthly! : chart.series; const grain = mode === 'monthly' && hasMonthly ? 'M' : chart.grain;
  const bench: BenchView | undefined = mode === 'main' && chart.grain === 'A' && chart.bench?.status === 'ok' ? chart.bench : undefined;

  const allT = useMemo(() => [...new Set(base.flatMap(s => s.points.map(p => p.t)))].sort(), [base]);
  const lastYear = allT.length ? Number(allT.at(-1)!.slice(0, 4)) : 0; const firstYear = allT.length ? Number(allT[0]!.slice(0, 4)) : 0; const span = lastYear - firstYear + 1;
  const years = RANGES.find(r => r.key === range)!.years; const cutoff = years && span > years ? lastYear - years + 1 : 0;
  const times = useMemo(() => allT.filter(t => Number(t.slice(0, 4)) >= cutoff), [allT, cutoff]);
  const series = useMemo(() => base.map(s => ({ ...s, points: s.points.filter(p => Number(p.t.slice(0, 4)) >= cutoff) })), [base, cutoff]);
  const benchBy = useMemo(() => new Map((bench?.points ?? []).filter(b => Number(b.t) >= cutoff).map(b => [b.t, b])), [bench, cutoff]);

  const small = width < 520; const H = height ?? (compact ? 190 : small ? 250 : 300); const L = small ? 38 : 48, R = small ? 10 : 16, T = 14, B = 30; const W = Math.max(width, 280);
  const nums = times.map(tnum); const tMin = Math.min(...nums), tMax = Math.max(...nums); const only = times.length <= 1;
  const stepX = grain === 'A' ? (chart.stepYears ?? 1) : 1 / 12; const pad = only ? 0.5 : stepX * 0.35;
  const x = (t: string) => only ? L + (W - L - R) / 2 : L + ((tnum(t) - tMin + pad) / (tMax - tMin + 2 * pad)) * (W - L - R);
  const vals = [...series.flatMap(s => s.points.map(p => p.v)), ...(bench ? [...benchBy.values()].flatMap(b => [b.p25, b.p75]) : [])].filter((v): v is number => v != null);
  const vMax = vals.length ? Math.max(...vals) : 1; const vMin = vals.length ? Math.min(...vals) : 0; const zoom = !!chart.zoom && vals.length > 1 && vMin > 0; const lo0 = vMin < 0 ? vMin : zoom ? vMin - (vMax - vMin || 1) * 0.35 : 0; const step = niceStep((vMax * 1.08 - lo0) / 4); const lo = zoom ? Math.floor(lo0 / step) * step : lo0; const hi = chart.yMax ?? (Math.ceil((vMax * 1.05) / step) * step || 1);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const ticks = Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + i * step);
  const labelEvery = Math.max(1, Math.ceil(times.length / (small ? 5 : 9))); const xLabels = grain === 'A' ? times.filter((_, i) => i % labelEvery === 0 || i === times.length - 1) : times.filter(t => t.endsWith('-01') && Number(t.slice(0, 4)) % (span > 12 ? 2 : 1) === 0 || t === times.at(-1));
  const digits = chart.digits; const tickFmt = (v: number) => fmt(v, step < 1 ? (step < 0.1 ? 2 : 1) : 0);
  const periodName = (t: string) => chart.periodNames?.[t] ?? periodLabel(t);
  const axisName = (t: string) => chart.periodNames ? t.slice(0, 4) : periodName(t);

  const jump = (a: string, b: string) => tnum(b) - tnum(a) > stepX * 1.5;  // ano/mês ausente entre dois pontos: a linha NÃO atravessa a lacuna
  const pathOf = (pts: ChartPoint[]): string => { let d = '', open = false, prev: string | null = null; for (const p of pts) { if (p.v == null) { open = false; continue; } if (prev && jump(prev, p.t)) open = false; d += `${open ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`; open = true; prev = p.t; } return d; };
  const benchPath = (key: 'p25' | 'p50' | 'p75') => { let d = ''; let open = false; let prev: string | null = null; for (const t of times) { const b = benchBy.get(t); if (!b) { open = false; continue; } if (prev && jump(prev, t)) open = false; d += `${open ? 'L' : 'M'}${x(t).toFixed(1)} ${y(b[key]).toFixed(1)}`; open = true; prev = t; } return d; };
  const bandPath = (() => { const ts = times.filter(t => benchBy.has(t)); const runs: string[][] = []; for (const t of ts) { const last = runs.at(-1); if (last && !jump(last.at(-1)!, t)) last.push(t); else runs.push([t]); } const polys = runs.filter(r => r.length > 1).map(r => `M${r.map(t => `${x(t).toFixed(1)} ${y(benchBy.get(t)!.p75).toFixed(1)}`).join(' L')} L${[...r].reverse().map(t => `${x(t).toFixed(1)} ${y(benchBy.get(t)!.p25).toFixed(1)}`).join(' L')}Z`); return polys.length ? polys.join(' ') : null; })();

  const move = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!times.length) return; const r = e.currentTarget.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; let best = 0, bd = Infinity;
    times.forEach((t, i) => { const d = Math.abs(x(t) - px); if (d < bd) { bd = d; best = i; } }); setHover(best);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [times, W, tMin, tMax, grain, only]);
  const onKey = (e: React.KeyboardEvent) => { if (!times.length) return; if (e.key === 'ArrowRight') { e.preventDefault(); setHover(h => Math.min((h ?? -1) + 1, times.length - 1)); } else if (e.key === 'ArrowLeft') { e.preventDefault(); setHover(h => Math.max((h ?? times.length) - 1, 0)); } else if (e.key === 'Escape' || e.key === 'Home' || e.key === 'End') { e.preventDefault(); setHover(e.key === 'Home' ? 0 : e.key === 'End' ? times.length - 1 : null); } };
  const hv = hover != null ? times[hover] : null;
  const rowAt = (t: string) => series.map(s => ({ s, p: s.points.find(p => p.t === t) }));
  const live = hv ? `${periodName(hv)}: ${rowAt(hv).map(r => `${r.s.label} ${r.p?.v != null ? valuePrefix + fmt(r.p.v, digits) : 'sem dado'}${r.p && STATE_LABEL[r.p.state] ? ` (${STATE_LABEL[r.p.state]})` : ''}`).join('; ')}${benchBy.get(hv) ? `; mediana do grupo ${valuePrefix}${fmt(benchBy.get(hv)!.p50, digits)}` : ''}` : '';
  const gaps = (chart.gaps ?? []).filter(g => times.some(t => t >= g.from && t <= g.to) || (times.length && times[0]! < g.from && times.at(-1)! > g.to));
  const empty = !vals.length;

  return (
    <figure className={cn('min-w-0', className)} aria-labelledby={title ? `${id}-t` : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        {title && <figcaption id={`${id}-t`} className="max-w-[44rem] text-sm font-semibold text-[#14304f]">{chart.title}</figcaption>}
        {!hideControls && !empty && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {hasMonthly && <div role="group" aria-label="Período de agregação" className="inline-flex overflow-hidden rounded-full border">{(['main', 'monthly'] as const).map(m => <button key={m} type="button" aria-pressed={mode === m} onClick={() => { setMode(m); setHover(null); }} className={cn('px-2.5 py-1 font-semibold', mode === m ? 'bg-[#115b45] text-white' : 'bg-white hover:bg-secondary')}>{m === 'main' ? (chart.grain === 'A' ? 'Por ano' : 'Série') : 'Por mês'}</button>)}</div>}
            {span > 3 && <div role="group" aria-label="Janela de tempo" className="inline-flex overflow-hidden rounded-full border">{RANGES.filter(r => r.years === 0 || span > r.years).map(r => <button key={r.key} type="button" aria-pressed={range === r.key} onClick={() => { setRange(r.key); setHover(null); }} className={cn('px-2.5 py-1 font-semibold', range === r.key ? 'bg-[#115b45] text-white' : 'bg-white hover:bg-secondary')}>{r.label}</button>)}</div>}
          </div>
        )}
      </div>
      {!empty && <p className="mt-1 text-[0.68rem] text-muted-foreground">Unidade: {chart.unit}</p>}
      <div ref={wrapRef} className="relative mt-1 w-full">
        {empty ? <p className="grid min-h-40 place-items-center rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Sem valores neste período para o gráfico. Nenhum valor foi estimado.</p> : (
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block max-w-full touch-pan-y select-none outline-none focus-visible:ring-2 focus-visible:ring-[#115b45]/50" role="img" tabIndex={0}
            aria-label={`${chart.title}. ${times.length} períodos, de ${periodName(times[0]!)} a ${periodName(times.at(-1)!)}. Use as setas para percorrer os valores.`} onPointerMove={move} onPointerDown={move} onPointerLeave={() => setHover(null)} onKeyDown={onKey} onBlur={() => setHover(null)}>
            {ticks.map(t => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#e3e8ef" strokeDasharray="3 4" /><text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#5f6f85">{valuePrefix}{tickFmt(t)}</text></g>)}
            {xLabels.filter((t, i, a) => i === 0 || x(t) - x(a[i - 1]!) >= 40).map(t => <text key={t} x={x(t)} y={H - 9} textAnchor="middle" fontSize="11" fill="#5f6f85">{axisName(t)}</text>)}
            {gaps.map(g => { const a = x(times.find(t => t >= g.from) ?? g.from), b = x([...times].reverse().find(t => t <= g.to) ?? g.to); return <g key={g.from}><rect x={Math.min(a, b) - 9} y={T} width={Math.abs(b - a) + 18} height={H - T - B} fill="#eef1f5" /><text x={(a + b) / 2} y={T + 12} textAnchor="middle" fontSize="10" fill="#7b8aa0">{small ? 'sem população' : g.label}</text></g>; })}
            {chart.markers?.filter(m => times.includes(m.t)).map(m => <g key={m.t}><line x1={x(m.t)} x2={x(m.t)} y1={T} y2={H - B} stroke="#a65d08" strokeDasharray="4 3" strokeWidth="1.4" /><text x={x(m.t) + 4} y={T + 22} fontSize="10" fill="#a65d08">{small ? 'quebra' : 'mudança de método'}</text></g>)}
            {bandPath && <path d={bandPath} fill="#14304f" opacity="0.1"><title>Faixa central do grupo de comparação (1º a 3º quartil)</title></path>}
            {bench && <path d={benchPath('p50')} fill="none" stroke="#14304f" strokeWidth="1.8" strokeDasharray="5 4" />}
            {series.map(s => <path key={s.key} d={pathOf(s.points)} fill="none" stroke={COLORS[s.color ?? 'primary']} strokeWidth={s.dash ? 2 : 3} strokeDasharray={s.dash ? '5 4' : undefined} strokeLinejoin="round" strokeLinecap="round" />)}
            {series.map(s => s.points.map(p => {
              if (p.state === 'suppressed') return <text key={`${s.key}${p.t}`} x={x(p.t)} y={H - B - 4} textAnchor="middle" fontSize="12" fill="#a33a3a" aria-hidden>×</text>;
              if (p.v == null) return null; const many = times.length > 48 && hv !== p.t; if (many) return null; const hollow = p.state === 'prelim' || p.state === 'partial'; const c = COLORS[s.color ?? 'primary'];
              return <circle key={`${s.key}${p.t}`} cx={x(p.t)} cy={y(p.v)} r={hv === p.t ? 5.5 : times.length > 48 ? 3 : 3.6} fill={hollow ? '#fff' : c} stroke={c} strokeWidth="2" />;
            }))}
            {hv && <line x1={x(hv)} x2={x(hv)} y1={T} y2={H - B} stroke="#14304f" opacity="0.35" />}
          </svg>
        )}
        {hv && !empty && (() => { const left = Math.min(Math.max(x(hv) / W * 100, 14), 82); return (
          <div className="pointer-events-none absolute top-1 z-10 w-max max-w-[15rem] -translate-x-1/2 rounded-lg border bg-white/95 p-2 text-xs shadow-lg" style={{ left: `${left}%` }}>
            <p className="font-semibold text-[#14304f]">{periodName(hv)}</p>
            {rowAt(hv).map(r => <p key={r.s.key} style={{ color: COLORS[r.s.color ?? 'primary'] }}>{r.s.label}: <strong>{r.p?.v != null ? `${valuePrefix}${fmt(r.p.v, digits)}` : 'sem dado'}</strong>{r.p && STATE_LABEL[r.p.state] ? <span className="text-muted-foreground"> · {STATE_LABEL[r.p.state]}</span> : null}</p>)}
            {benchBy.get(hv) && <p className="text-[#14304f]">Mediana do grupo: <strong>{valuePrefix}{fmt(benchBy.get(hv)!.p50, digits)}</strong> <span className="text-muted-foreground">({fmt(benchBy.get(hv)!.n)} municípios)</span></p>}
          </div>); })()}
      </div>
      <p className="sr-only" aria-live="polite">{live}</p>
      {!empty && (
        <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legenda">
          {series.map(s => <li key={s.key} className="inline-flex items-center gap-1.5"><svg width="22" height="8" aria-hidden><line x1="0" x2="22" y1="4" y2="4" stroke={COLORS[s.color ?? 'primary']} strokeWidth={s.dash ? 2 : 3} strokeDasharray={s.dash ? '4 3' : undefined} /></svg>{s.label}</li>)}
          {bench && <li className="inline-flex items-center gap-1.5"><svg width="22" height="8" aria-hidden><line x1="0" x2="22" y1="4" y2="4" stroke="#14304f" strokeWidth="2" strokeDasharray="4 3" /></svg>Mediana: {bench.cohort}</li>}
          {bench && <li className="inline-flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-sm" style={{ background: 'rgba(20,48,79,.14)' }} aria-hidden />1º a 3º quartil</li>}
          <li className="inline-flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full border-2 border-[#115b45] bg-white" aria-hidden />preliminar ou ano incompleto</li>
        </ul>
      )}
      {chart.notes.length > 0 && !compact && <p className="mt-2 text-[0.7rem] leading-snug text-muted-foreground">{chart.notes.join(' ')}</p>}
      {footer}
      {!empty && !compact && (
        <details className="mt-2 text-xs"><summary className="cursor-pointer py-1.5 font-semibold text-[#14304f]">Ver os valores do gráfico</summary>
          <div className="mt-2 max-h-56 overflow-auto rounded-lg border"><table className="w-full text-left"><caption className="sr-only">{chart.title}</caption><thead className="sticky top-0 bg-secondary"><tr><th scope="col" className="px-2 py-1">Período</th>{series.map(s => <th key={s.key} scope="col" className="px-2 py-1">{s.label}</th>)}{bench && <th scope="col" className="px-2 py-1">Mediana do grupo</th>}</tr></thead>
            <tbody>{[...times].reverse().map(t => <tr key={t} className="border-t"><th scope="row" className="px-2 py-1 font-normal">{periodName(t)}</th>{series.map(s => { const p = s.points.find(q => q.t === t); return <td key={s.key} className="px-2 py-1 tnum">{p?.v != null ? `${valuePrefix}${fmt(p.v, digits)}` : p?.state === 'suppressed' ? 'suprimido' : '—'}{p && STATE_LABEL[p.state] && p.v != null ? ` (${p.state === 'prelim' ? 'prelim.' : p.state === 'partial' ? 'parcial' : 'zero'})` : ''}</td>; })}{bench && <td className="px-2 py-1 tnum">{benchBy.get(t) ? `${valuePrefix}${fmt(benchBy.get(t)!.p50, digits)}` : '—'}</td>}</tr>)}</tbody></table></div></details>
      )}
    </figure>
  );
}
