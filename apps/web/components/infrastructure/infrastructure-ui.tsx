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

/** P8.4: lista compacta (rótulo: valor, separada por hairline), não uma grade de cartões — cada capítulo já
 * abre com `IndicatorLive` (o indicador protagonista); os grupos que vêm depois são referência de apoio, e
 * "a apresentação é excessivamente orientada a cartões de métricas" é a crítica nomeada do mandato para
 * este tema (§5.5). `StatGrid` continua existindo para onde ainda funciona como painel de entrada (o
 * panorama do topo, os totais de obras). */
export function StatRows({ items }: { items: StatItem[] }) {
  if (!items.length) return null;
  return <dl className="divide-y">{items.map(s => (
    <div key={s.label} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5 first:pt-0">
      <dt className="min-w-0 flex-1 text-sm text-muted-foreground">{s.label}{s.note && <span className="block text-xs text-muted-foreground">{s.note}</span>}</dt>
      <dd className="hero-figure tnum shrink-0 text-lg text-[#14304f]">{s.value}{s.unit && <span className="ml-1 text-xs font-normal text-muted-foreground">{s.unit}</span>}</dd>
    </div>
  ))}</dl>;
}

/** Um grupo nomeado de indicadores (ex.: "Abastecimento de água" dentro do capítulo de Água e saneamento). */
export function GroupBlock({ group }: { group: IndicatorGroup }) {
  return <div><h3 className="mb-2 font-display text-xl text-[#14304f]">{group.label}</h3><StatRows items={group.stats} />{group.note && <p className="mt-2 text-xs text-muted-foreground">{group.note}</p>}</div>;
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
