'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChartPoint, ChartView, PointState } from '@/lib/security/types';
import { fmt } from '@/lib/security/format';
import { TrendChart } from './trend-chart';
import { cn } from '@/lib/utils';

interface Idx { id: number; label: string; group: string; source: string; unit: string; grain: string; first: string; last: string; points: number }
interface Ser { indicatorId: number; code: string; label: string; unit: string; grain: string; source: string; group: string; points: Array<{ period: string; value: number | null; numerator: number | null; denominator: number | null; flags: number }> }
const FLAGS: Array<[number, string]> = [[1, 'pequeno número'], [2, 'preliminar'], [4, 'cobertura parcial'], [8, 'suprimido'], [16, 'denominador divergente'], [32, 'acima de 100%'], [64, 'sem denominador'], [128, 'zero ambíguo (zero ou sem relato)']];
const flagNames = (f: number) => FLAGS.filter(([b]) => (f & b) !== 0).map(([, n]) => n);
const stateOf = (value: number | null, f: number): PointState => (f & 8) ? 'suppressed' : value == null ? 'absent' : (f & 2) ? 'prelim' : (f & 4) ? 'partial' : 'ok';

/** Modo especialista: qualquer indicador de Segurança com dado para o território, série exata, metadados e exportação CSV com fonte, competência e supressão. Carregado sob demanda. */
export function ExplorerPanel({ entityId, scopeName, count }: { entityId: number; scopeName: string; count: number }) {
  const [open, setOpen] = useState(false); const [idx, setIdx] = useState<Idx[] | null>(null); const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState(''); const [grp, setGrp] = useState<string>('Todos'); const [ser, setSer] = useState<Ser | null>(null); const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDetailsElement | null>(null);
  useEffect(() => { if (!open || idx) return; fetch(`/api/seguranca/indicadores?entity=${entityId}`).then(r => r.ok ? r.json() : Promise.reject()).then(setIdx).catch(() => setErr('Não foi possível carregar a lista de indicadores.')); }, [open, idx, entityId]);
  const groups = useMemo(() => ['Todos', ...new Set((idx ?? []).map(i => i.group))], [idx]);
  const list = useMemo(() => (idx ?? []).filter(i => (grp === 'Todos' || i.group === grp) && (!q || i.label.toLowerCase().includes(q.toLowerCase()) || i.source.toLowerCase().includes(q.toLowerCase()))), [idx, grp, q]);
  const pick = async (id: number) => { setBusy(true); setErr(null); try { const r = await fetch(`/api/seguranca/serie?entity=${entityId}&ind=${id}`); if (!r.ok) throw new Error(); setSer(await r.json()); } catch { setErr('Não foi possível carregar esta série.'); } finally { setBusy(false); } };
  const chart: ChartView | null = useMemo(() => {
    if (!ser) return null; const grain = ser.grain === 'M' ? 'M' : 'A'; const pts: ChartPoint[] = ser.points.map(p => ({ t: grain === 'A' ? p.period.slice(0, 4) : p.period.slice(0, 7), v: p.value, state: stateOf(p.value, p.flags), n: p.numerator, d: p.denominator }));
    return { id: `x:${ser.indicatorId}`, title: `${ser.label} — ${scopeName}`, unit: ser.unit, digits: /por 100 mil|%|R\$\/hab|\/1\.000/.test(ser.unit) ? 1 : 0, grain, series: [{ key: 's', label: scopeName, color: 'primary', points: pts }], notes: [], source: ser.source, coverage: '' };
  }, [ser, scopeName]);
  const exportCsv = () => {
    if (!ser) return; const head = [`# Cívica — Segurança — exportação de recorte`, `# Território: ${scopeName} (entidade ${entityId})`, `# Indicador: ${ser.label} [${ser.code}, id ${ser.indicatorId}]`, `# Unidade: ${ser.unit}`, `# Fonte: ${ser.source} (${ser.group})`, `# Gerado em: ${new Date().toISOString().slice(0, 10)}`,
      '# Estados: valor vazio = sem dado (NÃO é zero); "suprimido" = valor oculto por privacidade; flags indicam preliminar, cobertura parcial e outros.', 'periodo,valor,numerador,denominador,flags'];
    const rows = ser.points.map(p => [p.period, (p.flags & 8) ? 'suprimido' : p.value ?? '', p.numerator ?? '', p.denominator ?? '', `"${flagNames(p.flags).join('; ')}"`].join(','));
    const blob = new Blob([[...head, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `civica-seguranca-${entityId}-${ser.indicatorId}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <details ref={ref} className="rounded-2xl border bg-white p-4 sm:p-6" onToggle={e => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="flex min-h-6 cursor-pointer py-1.5 flex-wrap items-center justify-between gap-2 font-display text-xl text-[#14304f]"><span>Abrir o modo “Explorar os dados”</span><span className="text-sm font-sans text-muted-foreground">{fmt(count)} indicadores com dado para {scopeName}</span></summary>
      <div className="mt-4 grid gap-5 lg:grid-cols-[19rem_minmax(0,1fr)]">
        <div>
          <label htmlFor="expl-q" className="sr-only">Procurar indicador</label>
          <input id="expl-q" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Procurar indicador ou fonte" className="w-full rounded-lg border p-2 text-sm" />
          <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Domínio">{groups.map(g => <button key={g} type="button" aria-pressed={grp === g} onClick={() => setGrp(g)} className={cn('rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold', grp === g ? 'border-[#14304f] bg-[#14304f] text-white' : 'bg-white hover:border-[#14304f]/50')}>{g}</button>)}</div>
          {err && <p role="alert" className="mt-2 text-sm text-[#a33a3a]">{err}</p>}
          {!idx && !err && <p className="mt-3 text-sm text-muted-foreground">Carregando a lista…</p>}
          <ul className="mt-3 max-h-[26rem] space-y-1 overflow-y-auto pr-1">{list.map(i => <li key={i.id}><button type="button" onClick={() => void pick(i.id)} aria-current={ser?.indicatorId === i.id} className={cn('w-full rounded-lg border px-3 py-2 text-left text-xs', ser?.indicatorId === i.id ? 'border-[#115b45] bg-[#e8f3ee]' : 'bg-white hover:border-[#115b45]/50')}><span className="font-semibold leading-snug">{i.label}</span><span className="mt-0.5 block text-[0.68rem] text-muted-foreground">{i.source} · {i.unit} · {i.first.slice(0, 7)} a {i.last.slice(0, 7)} · {fmt(i.points)} pontos</span></button></li>)}
            {idx && list.length === 0 && <li className="text-sm text-muted-foreground">Nenhum indicador encontrado.</li>}</ul>
        </div>
        <div className="min-w-0" aria-live="polite" aria-busy={busy}>
          {!ser && <p className="grid min-h-48 place-items-center rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Escolha um indicador para ver a série completa, os valores exatos, a fonte e as marcas de preliminar ou supressão.</p>}
          {busy && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {ser && chart && !busy && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-display text-xl text-[#14304f]">{ser.label}</h3><p className="text-xs text-muted-foreground">{ser.source} · {ser.group} · unidade: {ser.unit} · código {ser.code}</p></div><button type="button" onClick={exportCsv} className="rounded-full bg-[#115b45] px-4 py-1.5 text-xs font-semibold text-white">Exportar CSV</button></div>
              <TrendChart chart={chart} title={false} />
              <details className="rounded-lg border text-xs"><summary className="cursor-pointer py-1.5 p-2 font-semibold text-[#14304f]">Valores exatos, numerador, denominador e marcas</summary>
                <div className="max-h-72 overflow-auto"><table className="w-full text-left"><caption className="sr-only">Série completa</caption><thead className="sticky top-0 bg-secondary"><tr><th scope="col" className="p-2">Período</th><th scope="col" className="p-2 text-right">Valor</th><th scope="col" className="p-2 text-right">Numerador</th><th scope="col" className="p-2 text-right">Denominador</th><th scope="col" className="p-2">Marcas</th></tr></thead>
                  <tbody>{[...ser.points].reverse().map(p => <tr key={p.period} className="border-t"><th scope="row" className="p-2 font-normal">{p.period.slice(0, ser.grain === 'M' ? 7 : 4)}</th><td className="tnum p-2 text-right">{(p.flags & 8) ? 'suprimido' : p.value == null ? '—' : fmt(p.value, 2)}</td><td className="tnum p-2 text-right">{p.numerator == null ? '—' : fmt(p.numerator, 0)}</td><td className="tnum p-2 text-right">{p.denominator == null ? '—' : fmt(p.denominator, 0)}</td><td className="p-2 text-muted-foreground">{flagNames(p.flags).join('; ') || '—'}</td></tr>)}</tbody></table></div></details>
              <p className="text-[0.7rem] leading-snug text-muted-foreground">Vazio significa sem dado, não zero. A exportação inclui fonte, território, data de geração e a legenda das marcas. Antes de comparar com outro território, leia a definição e a comparabilidade do indicador nos capítulos.</p>
            </div>)}
        </div>
      </div>
    </details>
  );
}
