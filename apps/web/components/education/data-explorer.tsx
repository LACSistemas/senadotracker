'use client';

import { useState, type FormEvent } from 'react';
import { fmt } from '@/lib/security/format';
import { cn } from '@/lib/utils';

export interface ExplorerColumn<T> { key: string; label: string; align?: 'right'; render?: (row: T) => string }

/**
 * Explorador de lista sob demanda: busca paginada contra a API (nunca carregada no SSR da página), com exportação CSV
 * do que já foi carregado. Reaproveitado por Ensino Superior (IES, cursos), Qualidade e Pós-graduação.
 */
export function DataExplorer<T extends Record<string, unknown>>({ title, endpoint, entityId, columns, emptyText, fileSlug, placeholder = 'Procurar…' }: {
  title: string; endpoint: string; entityId: number; columns: ExplorerColumn<T>[]; emptyText: string; fileSlug: string; placeholder?: string;
}) {
  const [q, setQ] = useState(''); const [rows, setRows] = useState<T[]>([]); const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(0); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [opened, setOpened] = useState(false);

  const cell = (row: T, c: ExplorerColumn<T>): string => c.render ? c.render(row) : (row[c.key] == null ? '—' : String(row[c.key]));

  const load = async (nextPage: number, replace: boolean) => {
    setBusy(true); setErr(null);
    try {
      const sp = new URLSearchParams({ entity: String(entityId), page: String(nextPage) }); if (q.trim()) sp.set('q', q.trim());
      const r = await fetch(`${endpoint}?${sp.toString()}`); if (!r.ok) throw new Error();
      const data = (await r.json()) as { total: number; items: T[] };
      setTotal(data.total); setRows(prev => (replace ? data.items : [...prev, ...data.items])); setPage(nextPage);
    } catch { setErr('Não foi possível carregar esta lista agora.'); } finally { setBusy(false); }
  };
  const onToggle = (open: boolean) => { setOpened(open); if (open && rows.length === 0 && total == null) void load(1, true); };
  const onSearch = (e: FormEvent) => { e.preventDefault(); void load(1, true); };
  const exportCsv = () => {
    if (!rows.length) return;
    const head = columns.map(c => c.label).join(',');
    const body = rows.map(r => columns.map(c => `"${cell(r, c).replace(/"/g, '""')}"`).join(','));
    const blob = new Blob([[head, ...body].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `civica-educacao-${fileSlug}-${entityId}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <details className="rounded-2xl border bg-white p-4 sm:p-6" onToggle={e => onToggle((e.target as HTMLDetailsElement).open)}>
      <summary className="flex min-h-6 cursor-pointer flex-wrap items-center justify-between gap-2 py-1.5 font-display text-lg text-[#14304f]">
        <span>{title}</span>
        {total != null && <span className="text-sm font-sans text-muted-foreground">{fmt(total)} registro{total === 1 ? '' : 's'}</span>}
      </summary>
      <div className="mt-4 space-y-3">
        <form onSubmit={onSearch} className="flex flex-wrap gap-2">
          <label htmlFor={`${fileSlug}-q`} className="sr-only">{placeholder}</label>
          <input id={`${fileSlug}-q`} type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder} className="min-w-0 flex-1 rounded-lg border p-2 text-sm" />
          <button type="submit" className="focus-ring rounded-full border border-[#14304f] px-4 py-1.5 text-xs font-semibold text-[#14304f] hover:bg-[#14304f]/5">Buscar</button>
        </form>
        {err && <p role="alert" className="text-sm text-[#a33a3a]">{err}</p>}
        {opened && !busy && !err && rows.length === 0 && <p className="text-sm text-muted-foreground">{emptyText}</p>}
        {rows.length > 0 && (
          <div className="max-h-[28rem] overflow-auto rounded-lg border" aria-live="polite">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="sticky top-0 bg-secondary"><tr>{columns.map(c => <th key={c.key} scope="col" className={cn('p-2', c.align === 'right' && 'text-right')}>{c.label}</th>)}</tr></thead>
              <tbody>{rows.map((r, i) => <tr key={i} className="border-t">{columns.map(c => <td key={c.key} className={cn('p-2', c.align === 'right' && 'tnum text-right')}>{cell(r, c)}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {total != null && rows.length < total ? <button type="button" onClick={() => void load(page + 1, false)} disabled={busy} className="focus-ring rounded-full border px-4 py-1.5 text-xs font-semibold hover:border-[#14304f]/50 disabled:opacity-50">{busy ? 'Carregando…' : `Carregar mais (${fmt(rows.length)} de ${fmt(total)})`}</button> : <span />}
          <button type="button" onClick={exportCsv} disabled={!rows.length} className="focus-ring rounded-full bg-[#115b45] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Exportar CSV do que foi carregado</button>
        </div>
      </div>
    </details>
  );
}
