import type { ReactNode } from 'react';
import type { BarRow, DistBar, StatItem, Table } from '@/lib/education/types';
import { cn } from '@/lib/utils';

/** Blocos de leitura da página de Educação (servidor). Cores só por tokens/valores já usados na Segurança. */
export function StatGrid({ items }: { items: StatItem[] }) {
  if (!items.length) return null;
  return <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{items.map(s => (
    <div key={s.label} className="rounded-xl border bg-white p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</dt>
      <dd className="hero-figure tnum mt-1 text-3xl text-[#14304f]">{s.value}{s.unit && <span className="ml-1 text-sm font-normal text-muted-foreground">{s.unit}</span>}</dd>{s.note && <p className="mt-1 text-xs text-muted-foreground">{s.note}</p>}</div>))}</dl>;
}

/** Barras horizontais com o valor escrito ao lado: nada depende só da cor. */
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

/** Histograma da distribuição de alunos por nível, com o Brasil como marca de referência. */
export function Histogram({ title, caption, bars, refLabel }: { title: string; caption: string; bars: DistBar[]; refLabel: string | null }) {
  const top = Math.max(...bars.flatMap(b => [b.value, b.ref ?? 0]), 1);
  return (
    <figure><figcaption className="font-display text-lg text-[#14304f]">{title}</figcaption>
      <div role="img" aria-label={`${title}: ${bars.map(b => `${b.label} ${b.value.toFixed(1)}%`).join('; ')}`} className="mt-3 flex h-44 items-end gap-1.5 sm:gap-2">
        {bars.map(b => (
          <div key={b.label} className="relative flex h-full flex-1 flex-col justify-end"><span className="tnum mb-1 text-center text-[0.65rem] text-muted-foreground">{b.value >= 1 ? Math.round(b.value) : b.value.toFixed(1)}%</span>
            <div className="relative w-full rounded-t bg-[#115b45]" style={{ height: `${Math.max(1, (b.value / top) * 100)}%` }}>{b.ref != null && <span className="absolute left-[-2px] right-[-2px] border-t-2 border-dashed border-[#a77612]" style={{ bottom: `${(b.ref / Math.max(b.value, 0.0001)) * 100}%`, display: b.value > 0 ? undefined : 'none' }} aria-hidden />}</div>
            <span className="mt-1 text-center text-[0.65rem] leading-tight text-muted-foreground">{b.label.replace('Nível ', 'N')}</span></div>))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{caption}{refLabel && <> <span className="inline-block w-4 border-t-2 border-dashed border-[#a77612] align-middle" aria-hidden /> {refLabel}.</>}</p></figure>
  );
}

export function DataTable({ t }: { t: Table }) {
  return (
    <figure className="overflow-x-auto"><figcaption className="font-display text-lg text-[#14304f]">{t.title}</figcaption>
      <table className="mt-2 w-full min-w-[28rem] text-sm"><thead><tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground"><th scope="col" className="py-2 pr-3 font-semibold"><span className="sr-only">Item</span></th>{t.columns.map(c => <th key={c} scope="col" className="px-2 py-2 text-right font-semibold">{c}</th>)}</tr></thead>
        <tbody>{t.rows.map(r => <tr key={r.label} className="border-b last:border-0"><th scope="row" className="max-w-[18rem] py-2 pr-3 text-left font-medium text-[#14304f]">{r.label}</th>{r.cells.map((c, i) => <td key={i} className="tnum px-2 py-2 text-right">{c ?? <span className="text-muted-foreground" title="a fonte não divulgou">—</span>}</td>)}</tr>)}</tbody></table>
      {t.caption && <p className="mt-2 text-xs text-muted-foreground">{t.caption}</p>}</figure>
  );
}

/** Como ler os gráficos desta página. */
export function EducationLegend() {
  const items: Array<[string, string]> = [['Linha verde', 'o território'], ['Linha azul', 'o estado (nos municípios)'], ['Linha cinza tracejada', 'o Brasil'], ['Linha interrompida', 'a fonte não publicou aquele ano: não é zero'], ['Pontos a cada dois anos', 'o Saeb e o Ideb são bienais'], ['Círculo vazado', 'dado preliminar ou ano incompleto']];
  return <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground" aria-label="Como ler os gráficos">{items.map(([k, v]) => <li key={k}><strong className="text-[#14304f]">{k}</strong>: {v}</li>)}</ul>;
}

export function Block({ children, className }: { children: ReactNode; className?: string }) { return <div className={cn('rounded-2xl border bg-white/70 p-4 sm:p-5', className)}>{children}</div>; }
