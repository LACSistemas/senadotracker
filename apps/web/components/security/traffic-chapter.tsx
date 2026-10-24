'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ChartPoint, ChartView, TrafficChapter } from '@/lib/security/types';
import { fmt } from '@/lib/security/format';
import { TrendChart } from './trend-chart';
import { EmptyNote } from './security-ui';
import { cn } from '@/lib/utils';

const bars = (items: Array<{ label: string; value: number }>, color = '#115b45') => { const max = Math.max(...items.map(i => i.value), 1); return <ul className="space-y-1.5">{items.map(i => <li key={i.label} className="text-xs"><div className="flex justify-between gap-2"><span>{i.label}</span><span className="tnum font-semibold">{fmt(i.value)}</span></div><div className="mt-0.5 h-2 rounded-full bg-secondary"><div className="h-2 rounded-full" style={{ width: `${Math.max(2, (i.value / max) * 100)}%`, background: color }} /></div></li>)}</ul>; };

/** Frota e mortes no mesmo recorte de anos, com os números reais (nunca índice): quanto cada um mudou entre o primeiro e o último ano em comum.
 *  Fontes e universos são diferentes; por isso só mostramos as duas mudanças lado a lado, sem sugerir causa. */
function changeSummary(fleet: ChartView | null, deaths: ChartView | null): { from: string; to: string; fleet: { a: number; b: number }; deaths: { a: number; b: number } } | null {
  if (!fleet || !deaths) return null;
  const f = new Map(fleet.series[0]!.points.filter(p => p.v != null && p.state === 'ok').map(p => [p.t, p.v!]));
  const d = new Map(deaths.series[0]!.points.filter(p => p.v != null && p.state !== 'partial').map(p => [p.t, p.v!]));
  const common = [...f.keys()].filter(t => d.has(t)).sort(); if (common.length < 2) return null;
  const first = common[0]!, last = common.at(-1)!; if (!f.get(first) || !d.get(first)) return null;
  return { from: first, to: last, fleet: { a: f.get(first)!, b: f.get(last)! }, deaths: { a: d.get(first)!, b: d.get(last)! } };
}
const pctChange = (a: number, b: number) => { const v = Math.round((b / a - 1) * 100); return `${v > 0 ? '+' : ''}${v}%`; };

export function TrafficChapterBody({ ch, name }: { ch: TrafficChapter; name: string }) {
  const views = useMemo(() => [ch.deaths.residence && { key: 'res', label: 'Moradores', chart: ch.deaths.residence }, ch.deaths.occurrence && { key: 'oco', label: 'Ocorridas no local', chart: ch.deaths.occurrence }, ch.deaths.rate && { key: 'rate', label: 'Taxa por 100 mil', chart: ch.deaths.rate }].filter(Boolean) as Array<{ key: string; label: string; chart: ChartView }>, [ch]);
  const [v, setV] = useState(views[0]?.key ?? 'res'); const [bench, setBench] = useState<Record<string, ChartView['bench'] | 'loading'>>({});
  const cur = views.find(x => x.key === v) ?? views[0];
  const url = cur?.chart.benchUrl;
  useEffect(() => { if (!url || cur?.chart.bench || bench[url] !== undefined) return; setBench(b => ({ ...b, [url]: 'loading' })); fetch(url).then(r => r.ok ? r.json() : null).then(j => setBench(b => ({ ...b, [url]: j }))).catch(() => setBench(b => ({ ...b, [url]: undefined }))); }, [url, cur, bench]);
  const chart = cur ? { ...cur.chart, bench: cur.chart.bench ?? (url && bench[url] && bench[url] !== 'loading' ? (bench[url] as ChartView['bench']) : undefined) } : null;
  const cmp = useMemo(() => changeSummary(ch.fleet, ch.deaths.residence), [ch.fleet, ch.deaths.residence]);
  return (
    <>
      {chart && (
        <div className="rounded-2xl border bg-white p-3 sm:p-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="font-display text-xl text-[#14304f]">Mortes no trânsito</h3>
            <div role="group" aria-label="Medida de mortes" className="inline-flex overflow-hidden rounded-full border text-xs">{views.map(x => <button key={x.key} type="button" aria-pressed={v === x.key} onClick={() => setV(x.key)} className={cn('px-3 py-1.5 font-semibold', v === x.key ? 'bg-[#115b45] text-white' : 'bg-white hover:bg-secondary')}>{x.label}</button>)}</div></div>
          <TrendChart key={chart.id} chart={chart} title={false} />
          {chart.bench?.status === 'ok' && <p className="mt-3 rounded-lg border bg-[#eef3fa] p-3 text-sm leading-6 text-[#14304f]"><strong>Comparação válida. </strong>{chart.bench.sentence}</p>}
          {chart.bench?.status === 'indisponivel' && <p className="mt-3 rounded-lg border border-dashed p-3 text-sm leading-6 text-muted-foreground"><strong className="text-[#14304f]">Sem comparação válida. </strong>{chart.bench.unavailableReason}</p>}
          {v !== 'rate' && <p className="mt-2 text-xs text-muted-foreground">“Moradores” conta onde a pessoa vivia; “ocorridas no local” conta onde o acidente aconteceu. São medidas diferentes do mesmo fenômeno.</p>}
        </div>
      )}
      {ch.byUser.length > 0 && <div className="rounded-2xl border bg-white p-4 sm:p-5"><h3 className="font-display text-xl text-[#14304f]">Quem morre no trânsito ({ch.byUser[0]!.year})</h3><div className="mt-3">{bars(ch.byUser.map(u => ({ label: u.label, value: u.value })))}</div><p className="mt-2 text-[0.7rem] text-muted-foreground">Mortes de moradores por tipo de usuário da via (SIM). As categorias são exclusivas entre si.</p></div>}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {ch.fleet && <div className="rounded-2xl border bg-white p-3 sm:p-5"><h3 className="font-display text-xl text-[#14304f]">Frota</h3><TrendChart chart={ch.fleet} title={false} /></div>}
        {ch.fleetByType.length > 0 && <div className="rounded-2xl border bg-white p-4 sm:p-5"><h3 className="font-display text-xl text-[#14304f]">Tipos de veículo</h3><p className="text-xs text-muted-foreground">{ch.fleetBasis}</p><div className="mt-3">{bars(ch.fleetByType, '#14304f')}</div></div>}
      </div>
      {cmp && <div className="rounded-2xl border bg-white p-4 sm:p-5"><h3 className="font-display text-xl text-[#14304f]">Frota e mortes: quanto cada uma mudou</h3>
        <p className="mt-1 text-sm text-muted-foreground">De {cmp.from} a {cmp.to} em {name}, com os números reais de cada ano.</p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border p-4"><dt className="text-sm font-semibold text-muted-foreground">Veículos registrados</dt><dd className="mt-1 text-2xl font-bold tabular-nums">{fmt(cmp.fleet.a)} → {fmt(cmp.fleet.b)}</dd><dd className="text-sm text-muted-foreground">{pctChange(cmp.fleet.a, cmp.fleet.b)} no período</dd></div>
          <div className="rounded-xl border p-4"><dt className="text-sm font-semibold text-muted-foreground">Mortes no trânsito (moradores)</dt><dd className="mt-1 text-2xl font-bold tabular-nums">{fmt(cmp.deaths.a)} → {fmt(cmp.deaths.b)}</dd><dd className="text-sm text-muted-foreground">{pctChange(cmp.deaths.a, cmp.deaths.b)} no período</dd></div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">Os gráficos acima mostram cada série ano a ano. Frota (Senatran) e mortes (SIM/DATASUS) são fontes e universos diferentes; a comparação mostra os dois movimentos, não que um cause o outro.</p></div>}
      <div className="grid gap-5 lg:grid-cols-2">
        {ch.prf ? <div className="rounded-2xl border bg-white p-3 sm:p-5"><h3 className="font-display text-xl text-[#14304f]">Rodovias federais (PRF)</h3><TrendChart chart={ch.prf} title={false} /></div> : <EmptyNote title="Rodovias federais">Não há sinistros da PRF registrados neste território na base. A PRF só cobre rodovias federais.</EmptyNote>}
        {ch.renaest ? <div className="rounded-2xl border bg-white p-3 sm:p-5"><h3 className="font-display text-xl text-[#14304f]">Sinistros reportados (RENAEST)</h3><TrendChart chart={ch.renaest} title={false} />{ch.renaestCoverage && <p className="mt-2 text-xs text-muted-foreground">{ch.renaestCoverage}</p>}</div> : <EmptyNote title="Sinistros (RENAEST)">Sem sinistros reportados ao RENAEST neste território. Isso pode ser falta de reporte, não ausência de acidentes.</EmptyNote>}
      </div>
      {ch.infractions && <div className="rounded-2xl border bg-white p-3 sm:p-5"><h3 className="font-display text-xl text-[#14304f]">Infrações de trânsito</h3><TrendChart chart={ch.infractions} title={false} /></div>}
    </>
  );
}
