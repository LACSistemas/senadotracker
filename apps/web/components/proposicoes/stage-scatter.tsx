'use client';
import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { PrincipalStaleness, StageKey } from '@senadotracker/db';
import { STAGES, nf, stageLabel } from '@/lib/proposicoes/taxonomy';

// Linhas do eixo vertical: só etapas em que uma matéria ainda "em curso" pode estar. `outcome` (norma) é encerramento e
// `rite` não tem dado publicado, então nenhum ponto cai neles.
const ROWS: StageKey[] = ['presented', 'instruction', 'agenda', 'deliberation', 'post'];
const W = 760, H = 330, M = { l: 116, r: 22, t: 14, b: 46 };
const PLOT_W = W - M.l - M.r, PLOT_H = H - M.t - M.b, ROW_H = PLOT_H / ROWS.length;
const EDGES = [7, 30, 90, 180];
/** Jitter determinístico (por id) para separar pontos sobrepostos sem esconder nenhum. */
const jitter = (id: string) => { let hash = 0; for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0; return ((Math.abs(hash) % 1000) / 1000 - 0.5) * ROW_H * 0.64; };

/**
 * Cada ponto é uma matéria principal: X = dias desde o último evento observado, Y = estágio mais avançado com evidência
 * estruturada. Hover pelo ponto mais próximo (alvo maior que a marca), clique abre a matéria. A tabela de dados abaixo é a
 * alternativa acessível: o gráfico nunca é a única forma de ler um valor.
 */
export function StageScatter({ staleness }: { staleness: PrincipalStaleness }) {
  const router = useRouter(), svgRef = useRef<SVGSVGElement | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const maxDays = Math.max(200, ...staleness.points.map(point => point.days));
  const x = (days: number) => M.l + (days / maxDays) * PLOT_W;
  const plotted = useMemo(() => staleness.points.flatMap(point => { const row = ROWS.indexOf(point.stage); return row < 0 ? [] : [{ ...point, cx: x(point.days), cy: M.t + row * ROW_H + ROW_H / 2 + jitter(point.id) }]; }), [staleness.points, maxDays]); // eslint-disable-line react-hooks/exhaustive-deps
  const matrix = useMemo(() => ROWS.map(row => ({ row, counts: EDGES.map((edge, index) => plotted.filter(point => point.stage === row && point.days >= (index ? EDGES[index - 1]! : 0) && point.days < edge).length).concat(plotted.filter(point => point.stage === row && point.days >= EDGES[EDGES.length - 1]!).length) })), [plotted]);
  const nearest = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = svgRef.current!.getBoundingClientRect(), px = ((event.clientX - box.left) / box.width) * W, py = ((event.clientY - box.top) / box.height) * H;
    let best = -1, bestDistance = 18 * 18;
    plotted.forEach((point, index) => { const d = (point.cx - px) ** 2 + (point.cy - py) ** 2; if (d < bestDistance) { best = index; bestDistance = d; } });
    setActive(best < 0 ? null : best);
  };
  if (!plotted.length) return <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">Nenhuma matéria principal em curso tem histórico observado neste ano.</p>;
  const tip = active === null ? null : plotted[active]!;
  const href = (id: string) => `/legislativo/proposicoes/${staleness.source}/${encodeURIComponent(id)}`;
  return <div className="relative">
    <div className="overflow-x-auto"><div className="relative min-w-[640px]">
      {tip ? <div aria-hidden="true" className="pointer-events-none absolute z-10 w-56 -translate-x-1/2 -translate-y-full rounded-xl border bg-card p-3 text-xs shadow-lg" style={{ left: `${Math.max(16, Math.min(84, (tip.cx / W) * 100))}%`, top: `${(tip.cy / H) * 100 - 3}%` }}>
        <p className="text-base font-bold leading-none">{nf.format(tip.days)} {tip.days === 1 ? 'dia' : 'dias'}<span className="ml-1.5 text-xs font-semibold text-muted-foreground">sem movimentação observada</span></p>
        <p className="mt-1.5 font-semibold">{tip.label}</p><p className="mt-0.5 text-muted-foreground">Estágio: {stageLabel(tip.stage)}. Clique para abrir.</p>
      </div> : null}
      <svg ref={svgRef} role="img" aria-label={`Dispersão de ${nf.format(plotted.length)} matérias principais: dias desde a última movimentação observada por estágio mais avançado registrado. A tabela abaixo traz os mesmos dados.`} viewBox={`0 0 ${W} ${H}`} className="h-auto w-full cursor-crosshair touch-pan-y"
        onPointerMove={nearest} onPointerLeave={() => setActive(null)} onClick={() => { if (active !== null) router.push(href(plotted[active]!.id)); }}>
        {ROWS.map((row, index) => <g key={row}>
          <rect x={M.l} y={M.t + index * ROW_H} width={PLOT_W} height={ROW_H} fill={index % 2 ? 'transparent' : 'var(--muted)'} fillOpacity=".35" />
          <text x={M.l - 12} y={M.t + index * ROW_H + ROW_H / 2 + 4} textAnchor="end" fontSize="12" fontWeight="600" fill="var(--foreground)">{STAGES.find(stage => stage.key === row)?.label}</text>
        </g>)}
        {EDGES.map(edge => <g key={edge}><line x1={x(edge)} x2={x(edge)} y1={M.t} y2={H - M.b} stroke="var(--border)" strokeWidth="1" /><text x={x(edge)} y={H - M.b + 18} textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">{edge}</text></g>)}
        <line x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} stroke="var(--border)" /><text x={M.l} y={H - M.b + 18} textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">0</text>
        <text x={M.l + PLOT_W / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">Dias desde o último evento observado</text>
        {plotted.map((point, index) => <circle key={point.id} cx={point.cx} cy={point.cy} r={index === active ? 7 : 4.2} fill="var(--group-1)" fillOpacity={index === active ? 1 : 0.72} stroke="var(--card)" strokeWidth="2" />)}
      </svg>
    </div></div>
    <p className="mt-1 text-xs text-muted-foreground md:hidden">Arraste para o lado para ver o gráfico inteiro.</p>
    <details className="mt-3 text-sm"><summary className="focus-ring w-fit cursor-pointer text-xs font-bold text-primary">Ver dados do gráfico</summary>
      <div className="mt-2 overflow-x-auto"><table className="w-full text-left"><caption className="sr-only">Matérias principais por estágio e tempo sem movimentação observada</caption>
        <thead><tr className="border-b text-xs text-muted-foreground"><th className="p-2 font-semibold">Estágio mais avançado</th>{['Menos de 7 dias', '7 a 29', '30 a 89', '90 a 179', '180 ou mais'].map(label => <th key={label} className="p-2 text-right font-semibold">{label}</th>)}</tr></thead>
        <tbody>{matrix.map(line => <tr key={line.row} className="border-b last:border-0"><th className="p-2 font-medium">{stageLabel(line.row)}</th>{line.counts.map((count, index) => <td key={index} className="p-2 text-right tabular-nums">{nf.format(count)}</td>)}</tr>)}</tbody>
      </table></div>
      <p className="mt-3 text-xs font-semibold text-muted-foreground">Movimentação mais recente primeiro (as 12 primeiras):</p>
      <ul className="mt-1.5 grid gap-x-6 gap-y-1 sm:grid-cols-2">{[...plotted].sort((a, b) => a.days - b.days).slice(0, 12).map(point => <li key={point.id} className="flex justify-between gap-3 text-sm"><Link className="text-primary underline" href={href(point.id)}>{point.label}</Link><span className="text-xs tabular-nums text-muted-foreground">{nf.format(point.days)} d · {stageLabel(point.stage)}</span></li>)}</ul>
    </details>
  </div>;
}
