'use client';

import { useId, useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import type { EvoBandPoint, EvoPoint, EvoTab } from '@/lib/health-story';
import { cn } from '@/lib/utils';

const GREEN = '#115b45', NAVY = '#14304f', GREY = '#7b8aa0';
const W = 760, H = 300, L = 46, R = 18, T = 16, B = 30;
const fmt = (d: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

/** Passo "redondo" (1, 2, 2,5, 5 × 10^n) para eixos legíveis. */
function niceStep(raw: number): number { const p = 10 ** Math.floor(Math.log10(raw || 1)); const f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }

/** Caminho com interrupções onde não há valor (nunca liga através de lacunas). */
function pathOf<T extends { year: number }>(pts: T[], val: (p: T) => number | null, x: (y: number) => number, y: (v: number) => number): string {
  let d = '', open = false;
  for (const p of pts) { const v = val(p); if (v === null) { open = false; continue; } d += `${open ? 'L' : 'M'}${x(p.year).toFixed(1)} ${y(v).toFixed(1)}`; open = true; }
  return d;
}

function Chart({ tab, hover, onHover }: { tab: EvoTab; hover: number | null; onHover: (y: number | null) => void }) {
  const years = useMemo<[number, number]>(() => { const ys = [...tab.points.map(p => p.year), ...tab.group.map(g => g.year), ...tab.ref.map(g => g.year)]; return [Math.min(...ys), Math.max(...ys)]; }, [tab]);
  const vals = useMemo(() => [...tab.points.flatMap(p => [p.v, p.raw]), ...(tab.extra?.points.map(p => p.v) ?? []), ...tab.group.flatMap(g => [g.p25, g.p75]), ...tab.ref.map(g => g.p50)].filter((v): v is number => v !== null), [tab]);
  if (!vals.length || years[0] === years[1]) return <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Série insuficiente para o gráfico.</p>;
  const mn = Math.min(...vals), mx = Math.max(...vals), span = mx - mn || 1;
  const rawLo = mn < mx * 0.35 ? 0 : Math.max(0, mn - span * 0.15), rawHi = mx + span * 0.12;
  const step = niceStep((rawHi - rawLo) / 4); const lo = Math.floor(rawLo / step) * step, hi = Math.ceil(rawHi / step) * step;
  const x = (yr: number) => L + (yr - years[0]) / (years[1] - years[0]) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const ticks = Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + i * step);
  const yearTicks = Array.from({ length: years[1] - years[0] + 1 }, (_, i) => years[0] + i).filter((_, i, a) => a.length <= 8 || i % 2 === (a.length - 1) % 2);
  const band = tab.group.length > 1 ? [...tab.group.map(g => `${x(g.year).toFixed(1)} ${y(g.p75).toFixed(1)}`), ...[...tab.group].reverse().map(g => `${x(g.year).toFixed(1)} ${y(g.p25).toFixed(1)}`)].join(' L') : null;
  const gap: [number, number] | null = tab.gapYears.length ? [Math.min(...tab.gapYears), Math.max(...tab.gapYears)] : null;
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width * W;
    const yr = Math.round(years[0] + (px - L) / (W - L - R) * (years[1] - years[0])); onHover(yr < years[0] || yr > years[1] ? null : yr);
  };
  const tp = hover !== null ? tab.points.find(p => p.year === hover) : undefined; const tg = hover !== null ? tab.group.find(p => p.year === hover) : undefined; const tr = hover !== null ? tab.ref.find(p => p.year === hover) : undefined;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full touch-pan-y" role="img" aria-label={`${tab.title}: ${tab.story}`} onPointerMove={move} onPointerLeave={() => onHover(null)}>
        {ticks.map(t => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#e3e8ef" strokeDasharray="3 4" /><text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#5f6f85">{fmt(step < 1 ? (step < 0.1 ? 2 : 1) : 0).format(t)}</text></g>)}
        {yearTicks.map(yr => <text key={yr} x={x(yr)} y={H - 9} fontSize="11" textAnchor="middle" fill="#5f6f85">{yr}</text>)}
        {gap && <g><rect x={x(gap[0]) - 8} y={T} width={x(gap[1]) - x(gap[0]) + 16} height={H - T - B} fill="#eef1f5" /><text x={(x(gap[0]) + x(gap[1])) / 2} y={T + 14} textAnchor="middle" fontSize="10" fill="#7b8aa0">sem estimativa oficial de população</text></g>}
        {band && <path d={`M${band}Z`} fill={NAVY} opacity="0.09"><title>{`Faixa entre o 1º e o 3º quartil dos ${tab.groupLabel}`}</title></path>}
        {tab.ref.length > 1 && <path d={pathOf(tab.ref, p => p.p50, x, y)} fill="none" stroke={GREY} strokeWidth="1.8" strokeDasharray="5 4" />}
        {tab.group.length > 1 && <path d={pathOf(tab.group, p => p.p50, x, y)} fill="none" stroke={NAVY} strokeWidth="2" />}
        {tab.extra && <path d={pathOf(tab.extra.points, p => p.v, x, y)} fill="none" stroke={GREEN} strokeWidth="1.6" strokeDasharray="2 3" opacity="0.8" />}
        {tab.smoothed && tab.points.map(p => p.raw !== null && <circle key={`r${p.year}`} cx={x(p.year)} cy={y(p.raw)} r="2" fill={GREEN} opacity="0.35" />)}
        <path d={pathOf(tab.points, p => p.v, x, y)} fill="none" stroke={GREEN} strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round" />
        {tab.points.map(p => p.v !== null && <circle key={p.year} cx={x(p.year)} cy={y(p.v)} r={hover === p.year ? 5 : 3.2} fill={p.partial || p.prelim ? '#fff' : GREEN} stroke={GREEN} strokeWidth="2" />)}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke={NAVY} strokeWidth="1" opacity="0.35" />}
      </svg>
      {hover !== null && (tp || tg || tr) && <div className="pointer-events-none absolute top-2 rounded-lg border bg-white/95 p-2 text-xs shadow-md" style={{ left: `clamp(4%, ${(x(hover) / W) * 100 + 2}%, 62%)` }}>
        <p className="font-semibold text-[#14304f]">{hover}{tp?.partial ? ' (parcial)' : tp?.prelim ? ' (preliminar)' : ''}</p>
        {tp?.v != null && <p style={{ color: GREEN }}>Território: <strong>{fmt(tab.digits).format(tp.v)}</strong>{tab.smoothed && tp.raw != null ? <span className="text-muted-foreground"> (ano: {fmt(tab.digits).format(tp.raw)})</span> : null}</p>}
        {tg && <p className="text-[#14304f]">Mediana {tab.groupLabel}: <strong>{fmt(tab.digits).format(tg.p50)}</strong></p>}
        {tr && <p className="text-[#5f6f85]">Mediana {tab.refLabel}: <strong>{fmt(tab.digits).format(tr.p50)}</strong></p>}
      </div>}
    </div>
  );
}

function Legend({ tab }: { tab: EvoTab }) {
  const item = (color: string, label: string, dash?: boolean, thick?: boolean) => <span className="inline-flex items-center gap-1.5"><svg width="22" height="8" aria-hidden><line x1="0" x2="22" y1="4" y2="4" stroke={color} strokeWidth={thick ? 3.2 : 2} strokeDasharray={dash ? '4 3' : undefined} /></svg>{label}</span>;
  return <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
    {item(GREEN, 'Este território', false, true)}{tab.group.length > 1 && item(NAVY, `Mediana: ${tab.groupLabel}`)}{tab.ref.length > 1 && item(GREY, `Mediana: ${tab.refLabel}`, true)}
    {tab.extra && item(GREEN, tab.extra.title, true)}{tab.group.length > 1 && <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-sm" style={{ background: 'rgba(20,48,79,.12)' }} aria-hidden />1º a 3º quartil</span>}
  </p>;
}

function DataTable({ tab }: { tab: EvoTab }) {
  const g = new Map(tab.group.map(b => [b.year, b])); const r = new Map(tab.ref.map(b => [b.year, b]));
  return <details className="mt-3 text-xs"><summary className="cursor-pointer font-semibold">Tabela do gráfico</summary>
    <div className="mt-2 max-h-56 overflow-auto"><table className="w-full text-left"><thead><tr><th className="py-1">Ano</th><th>Território</th><th>Mediana {tab.groupLabel}</th><th>Mediana {tab.refLabel}</th></tr></thead>
      <tbody>{tab.points.map(p => <tr key={p.year} className="border-t"><td className="py-1">{p.year}{p.partial ? ' (parcial)' : p.prelim ? ' (prelim.)' : ''}</td><td>{p.v === null ? '—' : fmt(tab.digits).format(p.v)}</td><td>{g.get(p.year) ? fmt(tab.digits).format(g.get(p.year)!.p50) : '—'}</td><td>{r.get(p.year) ? fmt(tab.digits).format(r.get(p.year)!.p50) : '—'}</td></tr>)}</tbody></table></div></details>;
}

/** Evolução: 4 indicadores em abas, sempre com a mediana do grupo (estado/UFs) e do Brasil. Os dados das 4 abas chegam prontos do servidor. */
export function EvolutionPanel({ tabs, scope }: { tabs: EvoTab[]; scope: string }) {
  const [active, setActive] = useState(tabs[0]?.code ?? '');
  const [hover, setHover] = useState<number | null>(null);
  const id = useId();
  const tab = tabs.find(t => t.code === active) ?? tabs[0];
  if (!tab) return null;
  return (
    <section aria-labelledby={`${id}-t`} className="rounded-xl border bg-white p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: '#e2f5e8' }} aria-hidden><TrendingUp size={18} color={GREEN} /></span>
          <div><h2 id={`${id}-t`} className="font-display text-2xl text-[#14304f]">Como {scope} evoluiu</h2><p className="mt-0.5 text-xs text-muted-foreground">Cada linha é comparada com a mediana do grupo e a do Brasil.</p></div></div>
        <div role="tablist" aria-label="Indicador" className="flex flex-wrap gap-1.5">
          {tabs.map(t => <button key={t.code} role="tab" type="button" aria-selected={t.code === tab.code} onClick={() => { setActive(t.code); setHover(null); }}
            className={cn('rounded-full border px-3 py-1 text-xs font-semibold', t.code === tab.code ? 'border-[#115b45] bg-[#115b45] text-white' : 'bg-white hover:border-[#115b45]/50')}>{t.title}</button>)}
        </div>
      </header>
      <p className="mt-4 max-w-4xl text-sm leading-relaxed text-[#14304f]">{tab.story}</p>
      <div className="mt-3"><Chart tab={tab} hover={hover} onHover={setHover} /></div>
      <div className="mt-2"><Legend tab={tab} /></div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3">{tab.chips.map(c => <li key={c.label} className="rounded-lg border bg-[#f7f9fc] px-3 py-2"><p className="text-[0.68rem] text-muted-foreground">{c.label}</p><p className="text-sm font-semibold text-[#14304f]">{c.value}</p></li>)}</ul>
      <p className="mt-3 text-[0.7rem] leading-snug text-muted-foreground">{tab.note} Círculo vazado: ano parcial ou preliminar. Medianas de municípios, não médias ponderadas pela população.</p>
      <DataTable tab={tab} />
    </section>
  );
}
export type { EvoBandPoint, EvoPoint };
