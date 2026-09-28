'use client';
import { useState } from 'react';
import type { StageFlow } from '@senadotracker/db';
import { nf, pf } from '@/lib/proposicoes/taxonomy';
import { useInView } from './reveal';

const W = 760, H = 250, M = { l: 48, r: 48, t: 46, b: 62 }, NODE = 26;
const PLOT_H = H - M.t - M.b;

/**
 * "Rio" de tramitação: uma coluna por macroestágio, largura da coluna proporcional ao nº de matérias principais com
 * REGISTRO daquela etapa. Não é um funil (etapas não são aninhadas) e a etapa sem dado publicado aparece tracejada,
 * nunca como zero.
 */
export function StageRiver({ flow }: { flow: StageFlow }) {
  const [ref, inView] = useInView<HTMLDivElement>(0.25);
  const [active, setActive] = useState<number | null>(null);
  const count = flow.stages.length;
  const columns = flow.stages.map((stage, index) => {
    const x = M.l + index * ((W - M.l - M.r - NODE) / (count - 1)), height = stage.available && stage.share !== null ? Math.max(3, PLOT_H * stage.share) : 0;
    return { stage, index, x, height, y: M.t + (PLOT_H - height) / 2 };
  });
  const available = columns.filter(column => column.stage.available);
  const ribbons = available.slice(0, -1).map((from, i) => {
    const to = available[i + 1]!, mid = (from.x + NODE + to.x) / 2, x0 = from.x + NODE;
    return { key: `${from.stage.key}-${to.stage.key}`, d: `M${x0},${from.y} C${mid},${from.y} ${mid},${to.y} ${to.x},${to.y} L${to.x},${to.y + to.height} C${mid},${to.y + to.height} ${mid},${from.y + from.height} ${x0},${from.y + from.height} Z`, skipped: to.index - from.index > 1 };
  });
  const tip = active === null ? null : columns[active]!;
  return <div ref={ref} className="relative">
    <div className="overflow-x-auto"><div className="relative min-w-[660px]">
      {tip ? <div aria-hidden="true" className="pointer-events-none absolute top-0 z-10 w-56 -translate-x-1/2 rounded-xl border bg-card p-3 text-xs shadow-lg" style={{ left: `${Math.max(16, Math.min(84, ((tip.x + NODE / 2) / W) * 100))}%` }}>
        <p className="text-base font-bold leading-none">{tip.stage.count === null ? 'sem dado publicado' : nf.format(tip.stage.count)}{tip.stage.share !== null ? <span className="ml-1.5 text-xs font-semibold text-muted-foreground">· {pf.format(tip.stage.share)}</span> : null}</p>
        <p className="mt-1.5 font-semibold">{tip.stage.label}</p><p className="mt-1 leading-4 text-muted-foreground">{tip.stage.note}</p>
      </div> : null}
      <svg role="img" aria-label={`Rio de tramitação de ${nf.format(flow.universe)} matérias principais apresentadas em ${flow.year}: ${columns.map(column => `${column.stage.label} ${column.stage.count === null ? 'sem dado publicado' : nf.format(column.stage.count)}`).join('; ')}`} viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
        <g style={{ opacity: inView ? 1 : 0, transition: 'opacity 900ms ease 200ms' }}>
          {ribbons.map(ribbon => <path key={ribbon.key} d={ribbon.d} fill="var(--group-1)" fillOpacity={ribbon.skipped ? 0.07 : 0.16} />)}
        </g>
        {columns.map(column => {
          const cx = column.x + NODE / 2, unavailable = !column.stage.available;
          return <g key={column.stage.key} tabIndex={0} role="img" aria-label={`${column.stage.label}: ${column.stage.count === null ? 'sem dado publicado' : `${nf.format(column.stage.count)} matérias`}. ${column.stage.note}`}
            onPointerEnter={() => setActive(column.index)} onPointerLeave={() => setActive(null)} onFocus={() => setActive(column.index)} onBlur={() => setActive(null)} className="focus-ring outline-none">
            <rect x={column.x - 34} y={0} width={NODE + 68} height={H} fill="transparent" />
            <text x={cx} y={M.t - 24} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--foreground)">{column.stage.label}</text>
            {unavailable
              ? <><rect x={column.x} y={M.t + PLOT_H * 0.32} width={NODE} height={PLOT_H * 0.36} rx="4" fill="none" stroke="var(--muted-foreground)" strokeOpacity=".55" strokeDasharray="3 3" />
                <text x={cx} y={H - M.b + 24} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--muted-foreground)">sem dado</text><text x={cx} y={H - M.b + 40} textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">publicado</text></>
              : <><rect x={column.x} y={column.y} width={NODE} height={column.height} rx="3" fill="var(--group-1)" style={{ transformOrigin: `${cx}px ${M.t + PLOT_H / 2}px`, transform: inView ? 'scaleY(1)' : 'scaleY(0.05)', transition: `transform 800ms cubic-bezier(.2,.7,.2,1) ${column.index * 70}ms` }} />
                <text x={cx} y={H - M.b + 26} textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--foreground)">{nf.format(column.stage.count ?? 0)}</text>
                <text x={cx} y={H - M.b + 42} textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">{column.stage.share === null ? '' : pf.format(column.stage.share)}</text></>}
          </g>;
        })}
      </svg>
    </div></div>
    <p className="mt-1 text-xs text-muted-foreground md:hidden">Arraste para o lado para ver o gráfico inteiro.</p>
    <details className="mt-3 text-sm"><summary className="focus-ring w-fit cursor-pointer text-xs font-bold text-primary">Ver dados do gráfico</summary>
      <div className="mt-2 overflow-x-auto"><table className="w-full text-left"><caption className="sr-only">Etapas de tramitação das matérias principais de {flow.year}</caption>
        <thead><tr className="border-b text-xs text-muted-foreground"><th className="p-2 font-semibold">Etapa</th><th className="p-2 text-right font-semibold">Matérias</th><th className="p-2 text-right font-semibold">Do universo</th><th className="p-2 font-semibold">Como é contada</th></tr></thead>
        <tbody>{flow.stages.map(stage => <tr key={stage.key} className="border-b last:border-0"><th className="p-2 font-medium">{stage.label}</th><td className="p-2 text-right tabular-nums">{stage.count === null ? 'sem dado publicado' : nf.format(stage.count)}</td><td className="p-2 text-right tabular-nums">{stage.share === null ? '—' : pf.format(stage.share)}</td><td className="p-2 text-xs text-muted-foreground">{stage.note}</td></tr>)}</tbody>
      </table></div></details>
  </div>;
}
