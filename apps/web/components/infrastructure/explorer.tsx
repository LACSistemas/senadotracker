'use client';

import { useMemo, useState } from 'react';
import type { ExplorerRow } from '@/lib/infrastructure/types';

function toCsv(rows: ExplorerRow[]): string {
  const header = ['codigo', 'titulo', 'valor', 'unidade', 'fonte', 'dimensao', 'periodo', 'status'];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = rows.map(r => [r.code, r.title, r.display, r.unit, r.sourceFamily, r.dimension, r.period ?? '', r.statusLabel].map(esc).join(','));
  return [header.join(','), ...lines].join('\n');
}

/** Catálogo completo dos indicadores auditados para este território — inclusive os sem valor, porque ausência
 * também é informação. Fechado por padrão (progressive disclosure); dados já carregados pelo servidor, sem nenhuma
 * consulta extra (108 linhas no máximo, não 155 mil — filtro é feito aqui mesmo, no navegador). */
export function IndicatorExplorer({ rows, territoryName }: { rows: ExplorerRow[]; territoryName: string }) {
  const [q, setQ] = useState(''); const [family, setFamily] = useState('');
  const families = useMemo(() => [...new Set(rows.map(r => r.sourceFamily))].sort(), [rows]);
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter(r => (!family || r.sourceFamily === family) && (!term || r.title.toLowerCase().includes(term) || r.code.toLowerCase().includes(term)));
  }, [rows, q, family]);

  const download = () => {
    const blob = new Blob([toCsv(filtered)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `civica-infraestrutura-${territoryName.toLowerCase().replace(/\s+/g, '-')}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <details className="rounded-2xl border bg-card p-5">
      <summary className="cursor-pointer font-display text-xl text-[#14304f]">Explorar catálogo completo de indicadores ({rows.length})</summary>
      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nome ou código" className="min-w-[14rem] flex-1 rounded-lg border bg-white px-3 py-1.5 text-sm" />
          <select value={family} onChange={e => setFamily(e.target.value)} className="rounded-lg border bg-white px-2 py-1.5 text-sm">
            <option value="">Todas as fontes</option>{families.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <button type="button" onClick={download} className="rounded-full border px-4 py-1.5 text-sm font-semibold hover:border-[#115b45]/50">Exportar CSV</button>
        </div>
        <p className="text-xs text-muted-foreground">{filtered.length} de {rows.length} indicadores.</p>
        <div className="max-h-[32rem] overflow-y-auto overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[42rem] text-sm">
            <thead className="sticky top-0 bg-card"><tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-3 py-2 font-semibold">Indicador</th><th scope="col" className="px-3 py-2 text-right font-semibold">Valor</th>
              <th scope="col" className="px-3 py-2 font-semibold">Fonte</th><th scope="col" className="px-3 py-2 font-semibold">Período</th><th scope="col" className="px-3 py-2 font-semibold">Status</th>
            </tr></thead>
            <tbody>{filtered.map(r => (
              <tr key={r.code} className="border-b last:border-0"><td className="px-3 py-2"><span className="font-semibold text-[#14304f]">{r.title}</span><br /><span className="text-xs text-muted-foreground">{r.code}</span></td>
                <td className="tnum px-3 py-2 text-right">{r.display}{r.unit ? ` ${r.unit}` : ''}</td>
                <td className="px-3 py-2">{r.sourceFamily}</td><td className="px-3 py-2">{r.period ?? '—'}</td><td className="px-3 py-2">{r.statusLabel}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </details>
  );
}
