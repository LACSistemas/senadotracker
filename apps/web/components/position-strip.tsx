import type { DataCoverage } from '@senadotracker/domain';
import { CoverageBadge } from '@/components/metrics';

/** Onde este parlamentar está entre os colegas da Casa: cada ponto cinza é um colega, o verde é ele, a linha é a mediana. Eixo desde zero. */
export function PositionStrip({ title, peers, value, median, format, coverage, caption }: { title: string; peers: number[]; value: number | null; median: number | null; format: (value: number) => string; coverage: DataCoverage; caption: string }) {
  const max = Math.max(...peers, value ?? 0, 1), W = 720, left = 24, right = 24, x = (v: number) => left + (W - left - right) * v / max;
  const sorted = [...peers].sort((a, b) => a - b);
  // Pontos próximos sobem uma linha para não se sobrepor.
  const placed = sorted.map((v, i) => { let level = 0; for (let j = i - 1; j >= 0 && x(v) - x(sorted[j]!) < 9; j--) level++; return { v, level: level % 5 }; });
  const label = value === null ? `${title}: sem valor publicado para este parlamentar.` : `${title}: ${format(value)}; mediana da Casa ${median === null ? 'indisponível' : format(median)}; ${peers.length} parlamentares comparados.`;
  return <figure className="min-w-0 rounded-2xl border bg-card p-5">
    <figcaption className="flex flex-wrap items-center justify-between gap-2 font-bold">{title}<CoverageBadge coverage={coverage} /></figcaption>
    <svg role="img" aria-label={label} viewBox={`0 0 ${W} 120`} className="mt-4 h-auto w-full">
      <line x1={left} x2={W - right} y1="86" y2="86" stroke="var(--border)" strokeWidth="2" />
      {placed.map((p, index) => <circle key={index} cx={x(p.v)} cy={74 - p.level * 9} r="4" fill="var(--muted-foreground)" opacity=".38" />)}
      {median !== null && <g><line x1={x(median)} x2={x(median)} y1="22" y2="92" stroke="var(--foreground)" strokeWidth="1.5" strokeDasharray="3 3" /><text x={x(median)} y="14" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">{`mediana ${format(median)}`}</text></g>}
      {value !== null && <g><circle cx={x(value)} cy="74" r="9" fill="var(--primary)" stroke="var(--card)" strokeWidth="3" /><text x={Math.min(Math.max(x(value), 60), W - 60)} y="112" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--primary)">{format(value)}</text></g>}
      <text x={left} y="112" fontSize="11" fill="var(--muted-foreground)">{format(0)}</text>
      {(value === null || x(value) < W - right - 110) && <text x={W - right} y="112" textAnchor="end" fontSize="11" fill="var(--muted-foreground)">{format(max)}</text>}
    </svg>
    <p className="mt-2 text-xs leading-5 text-muted-foreground">{caption}</p>
  </figure>;
}
