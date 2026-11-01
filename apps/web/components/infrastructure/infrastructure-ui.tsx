import type { ReactNode } from 'react';
import type { BarRow, IndicatorGroup, StatItem } from '@/lib/infrastructure/types';
import { cn } from '@/lib/utils';

/** Blocos de leitura da página de Infraestrutura (servidor). Espelha `components/wellbeing/wellbeing-ui.tsx`. */
export function StatGrid({ items }: { items: StatItem[] }) {
  if (!items.length) return null;
  return <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{items.map(s => (
    <div key={s.label} className="min-w-0 rounded-xl border bg-white p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</dt>
      <dd className="hero-figure tnum mt-1 break-all text-3xl text-[#14304f]">{s.value}</dd>{s.unit && <dd className="text-xs text-muted-foreground">{s.unit}</dd>}{s.note && <dd className="mt-1 text-xs text-muted-foreground">{s.note}</dd>}</div>))}</dl>;
}

/** Um grupo nomeado de indicadores (ex.: "Abastecimento de água" dentro do capítulo de Água e saneamento). */
export function GroupBlock({ group }: { group: IndicatorGroup }) {
  return <div><h3 className="mb-3 font-display text-xl text-[#14304f]">{group.label}</h3><StatGrid items={group.stats} />{group.note && <p className="mt-2 text-xs text-muted-foreground">{group.note}</p>}</div>;
}

/** Barras horizontais com o valor escrito ao lado: nada depende só da cor ou da área preenchida. */
export function BarList({ title, rows, max, caption }: { title: string; rows: BarRow[]; max?: number; caption?: string }) {
  if (!rows.length) return null; const top = max ?? Math.max(...rows.map(r => r.value), 1);
  return (
    <figure><figcaption className="font-display text-lg text-[#14304f]">{title}</figcaption>
      <ul className="mt-3 space-y-2">{rows.map(r => (
        <li key={r.label} className="grid grid-cols-[minmax(7rem,12rem)_1fr_auto] items-center gap-3 text-sm"><span className="truncate text-muted-foreground" title={r.label}>{r.label}</span>
          <span className="h-3 overflow-hidden rounded-full bg-[#e8f3ee]" aria-hidden><span className="block h-full rounded-full bg-[#115b45]" style={{ width: `${Math.max(2, Math.min(100, (r.value / top) * 100))}%` }} /></span>
          <span className="tnum min-w-16 text-right font-semibold text-[#14304f]">{r.display}</span></li>))}</ul>
      {caption && <p className="mt-2 text-xs text-muted-foreground">{caption}</p>}</figure>
  );
}

export function InfrastructureLegend() {
  const items: Array<[string, string]> = [['—', 'a fonte não divulgou ou não é aplicável a este território'], ['Nota sob o valor', 'ressalva de cobertura, competência técnica ou comparabilidade']];
  return <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground" aria-label="Como ler os números">{items.map(([k, v]) => <li key={k}><strong className="text-[#14304f]">{k}</strong>: {v}</li>)}</ul>;
}

export function Block({ children, className }: { children: ReactNode; className?: string }) { return <div className={cn('rounded-2xl border bg-white/70 p-4 sm:p-5', className)}>{children}</div>; }
