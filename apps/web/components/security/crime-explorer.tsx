'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BenchView, ChartPoint, ChartView, CrimeChapter, ExploreOption } from '@/lib/security/types';
import { GROUP_ORDER } from '@/lib/security/catalog';
import { changeRatio, fmt, signedPct } from '@/lib/security/format';
import { TrendChart } from './trend-chart';
import { cn } from '@/lib/utils';

type Cand = { id: number; name: string; population: number };
const MONTH_NAMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Mudança entre períodos EQUIVALENTES: último ano completo × anterior e, com dado mensal, acumulado do ano corrente × mesmo período do ano passado (só se todos os meses existem nos dois). */
function variations(opt: ExploreOption): Array<{ label: string; value: string; sub: string }> {
  const out: Array<{ label: string; value: string; sub: string }> = []; const count = opt.measures.find(m => m.key === 'count')?.chart; if (!count?.series[0]) return out;
  const ann = count.series[0].points.filter(p => p.v != null && p.state !== 'partial'); const cur = ann.at(-1), prev = ann.at(-2), five = ann.find(p => cur && Number(p.t) === Number(cur.t) - 5);
  if (cur && prev) { const r = changeRatio(prev.v, cur.v); out.push({ label: `${cur.t} × ${prev.t}`, value: r == null ? '—' : signedPct(r), sub: `${fmt(prev.v!)} → ${fmt(cur.v!)}` }); }
  if (cur && five) { const r = changeRatio(five.v, cur.v); out.push({ label: `${cur.t} × ${five.t}`, value: r == null ? '—' : signedPct(r), sub: `${fmt(five.v!)} → ${fmt(cur.v!)}` }); }
  const mo = count.monthly?.[0]?.points ?? [];
  if (mo.length) {
    const last = mo.filter(p => p.v != null).at(-1); if (last) { const y = Number(last.t.slice(0, 4)), m = Number(last.t.slice(5, 7)); const isPartialYear = m < 12;
      if (isPartialYear) { const get = (yy: number) => { let s = 0; for (let k = 1; k <= m; k++) { const p = mo.find(q => q.t === `${yy}-${String(k).padStart(2, '0')}`); if (!p || p.v == null) return null; s += p.v; } return s; };
        const a = get(y), b = get(y - 1); if (a != null && b != null) { const r = changeRatio(b, a); out.push({ label: `Jan–${MONTH_NAMES[m - 1]!.slice(0, 3)} de ${y} × ${y - 1}`, value: r == null ? '—' : signedPct(r), sub: `${fmt(b)} → ${fmt(a)} (mesmos meses)` }); } } }
  }
  return out;
}

export function CrimeExplorer({ chapter, entityId, scopeName, isMunicipality }: { chapter: CrimeChapter; entityId: number; scopeName: string; isMunicipality: boolean }) {
  const [opts, setOpts] = useState<Record<string, ExploreOption>>(() => Object.fromEntries(chapter.options.map(o => [o.id, o])));
  const [sel, setSel] = useState<string | null>(chapter.defaultOptionId); const [measure, setMeasure] = useState<'count' | 'rate'>('count');
  const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);
  const [benchBy, setBenchBy] = useState<Record<string, BenchView | 'loading' | 'error'>>({});
  const [cands, setCands] = useState<Cand[] | null>(null); const [other, setOther] = useState<{ id: number; name: string; points: ChartPoint[]; note: string } | null>(null); const [cmpMsg, setCmpMsg] = useState<string | null>(null); const [cmpQ, setCmpQ] = useState('');
  const option = sel ? opts[sel] : null;

  const choose = useCallback(async (id: string) => {
    setSel(id); setError(null); setMeasure('count'); setCmpMsg(null);
    const o = opts[id]; if (!o || !o.lazy) return; setLoading(true);
    try { const r = await fetch(`/api/seguranca/opcao?entity=${entityId}&opt=${encodeURIComponent(id)}`); if (!r.ok) throw new Error(String(r.status)); const full = await r.json() as ExploreOption; setOpts(p => ({ ...p, [id]: full })); }
    catch { setError('Não foi possível carregar este indicador agora. Tente de novo.'); } finally { setLoading(false); }
  }, [opts, entityId]);

  const measureOf = option?.measures.find(m => m.key === measure) ?? option?.measures[0]; const chart0 = measureOf?.chart;
  const url = chart0?.benchUrl;
  useEffect(() => { if (!url || chart0?.bench || benchBy[url] != null) return; setBenchBy(p => ({ ...p, [url]: 'loading' })); fetch(url).then(r => r.ok ? r.json() : Promise.reject(r.status)).then((b: BenchView) => setBenchBy(p => ({ ...p, [url]: b }))).catch(() => setBenchBy(p => ({ ...p, [url]: 'error' }))); }, [url, chart0?.bench, benchBy]);
  const bench = chart0?.bench ?? (url ? benchBy[url] : undefined);
  useEffect(() => { setOther(null); }, [sel, measure]);
  const chart: ChartView | null = useMemo(() => {
    if (!chart0 || !chart0.series.length) return null; const b = bench && typeof bench === 'object' ? bench : undefined;
    const series = other && measure === 'rate' ? [...chart0.series, { key: 'other', label: other.name, color: 'plum' as const, points: other.points as ChartPoint[] }] : chart0.series;
    return { ...chart0, series, bench: b };
  }, [chart0, bench, other, measure]);
  const vars = useMemo(() => (option && !option.lazy ? variations(option) : []), [option]);

  const openCompare = async () => { if (cands) return; try { const r = await fetch(`/api/seguranca/comparar?entity=${entityId}`); const j = await r.json() as { candidates: Cand[] }; setCands(j.candidates); } catch { setCmpMsg('Não foi possível carregar a lista de municípios.'); } };
  const compareWith = async (id: number) => { if (!option) return; setCmpMsg('Carregando…'); const r = await fetch(`/api/seguranca/comparar?entity=${entityId}&other=${id}&opt=${encodeURIComponent(option.id)}`); const j = await r.json(); if (j.ok) { setOther(j); setCmpMsg(null); } else { setOther(null); setCmpMsg(j.reason as string); } };

  const groups = useMemo(() => { const g = new Map<string, ExploreOption[]>(); for (const o of chapter.options) { const k = o.scope === 'uf' && isMunicipality ? 'Só existe para o estado (contexto)' : o.group; (g.get(k) ?? g.set(k, []).get(k)!).push(o); } return [...g.entries()].sort((a, b) => { const ia = GROUP_ORDER.indexOf(a[0]), ib = GROUP_ORDER.indexOf(b[0]); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); }); }, [chapter.options, isMunicipality]);
  const dist = useMemo(() => { if (!option?.exclusiveGroup) return null; const items = chapter.options.filter(o => o.exclusiveGroup === option.exclusiveGroup && o.peek?.v != null && o.peek.v > 0); const t = option.peek?.t ?? items[0]?.peek?.t; const same = items.filter(o => o.peek!.t === t); return same.length >= 3 ? { t: t!, items: same.sort((a, b) => b.peek!.v! - a.peek!.v!) } : null; }, [option, chapter.options]);

  if (!chapter.options.length) return null;
  const rateAvail = option?.measures.some(m => m.key === 'rate');
  const filtered = cmpQ ? (cands ?? []).filter(c => c.name.toLowerCase().includes(cmpQ.toLowerCase())).slice(0, 8) : (cands ?? []).slice(0, 8);
  return (
    <div className="grid gap-6 lg:grid-cols-[16.5rem_minmax(0,1fr)]">
      <nav aria-label="Tipos de crime" className="lg:sticky lg:top-24 lg:self-start">
        <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:hidden" htmlFor="crime-select">Tipo de registro</label>
        <select id="crime-select" className="mt-1 w-full rounded-lg border bg-white p-2.5 text-sm lg:hidden" value={sel ?? ''} onChange={e => void choose(e.target.value)}>
          {groups.map(([g, list]) => <optgroup key={g} label={g}>{list.map(o => <option key={o.id} value={o.id}>{o.plain}</option>)}</optgroup>)}
        </select>
        <div className="hidden max-h-[34rem] space-y-4 overflow-y-auto pr-1 lg:block">
          {groups.map(([g, list]) => <div key={g}><p className="text-[0.68rem] font-bold uppercase tracking-wide text-muted-foreground">{g}</p>
            <ul className="mt-1.5 space-y-1">{list.map(o => <li key={o.id}><button type="button" aria-pressed={o.id === sel} onClick={() => void choose(o.id)} className={cn('flex w-full items-baseline justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors', o.id === sel ? 'border-[#115b45] bg-[#115b45] text-white' : 'bg-white hover:border-[#115b45]/50')}>
              <span className="font-medium leading-snug">{o.plain}</span>{o.peek?.v != null && <span className={cn('tnum shrink-0 text-xs', o.id === sel ? 'text-white/80' : 'text-muted-foreground')}>{fmt(o.peek.v)} <span className="opacity-70">({o.peek.t})</span></span>}</button></li>)}</ul></div>)}
        </div>
      </nav>
      <div className="min-w-0 space-y-4" aria-live="polite" aria-busy={loading}>
        {option && (
          <>
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div><h3 className="font-display text-2xl text-[#14304f]">{option.plain}</h3><p className="mt-1 text-xs text-muted-foreground">Fonte: {option.source}{option.scope === 'uf' && isMunicipality ? ' · dado do estado, não da cidade' : ''}</p></div>
              {rateAvail && <div role="group" aria-label="Medida" className="inline-flex overflow-hidden rounded-full border text-xs">{option.measures.map(m => <button key={m.key} type="button" aria-pressed={measure === m.key} onClick={() => setMeasure(m.key)} className={cn('px-3 py-1.5 font-semibold', measure === m.key ? 'bg-[#115b45] text-white' : 'bg-white hover:bg-secondary')}>{m.label}</button>)}</div>}
            </header>
            {option.caveat && <p className="rounded-lg border border-[#a65d08]/30 bg-[#fdf3e3] p-3 text-xs leading-5 text-[#7a4606]">{option.caveat}</p>}
            {error && <p role="alert" className="rounded-lg border border-[#a33a3a]/30 bg-[#fbeaea] p-3 text-sm text-[#a33a3a]">{error}</p>}
            <div className="min-h-[20rem] rounded-2xl border bg-white p-3 sm:p-5">
              {chart ? <TrendChart key={`${option.id}-${measure}`} chart={chart} /> : loading ? <p className="grid min-h-64 place-items-center text-sm text-muted-foreground">Carregando a série…</p> : <p className="p-6 text-sm text-muted-foreground">Sem série para exibir.</p>}
            </div>
            {measure === 'rate' && (bench === 'loading' ? <p className="text-xs text-muted-foreground">Calculando a comparação com municípios semelhantes…</p>
              : bench && typeof bench === 'object' ? (bench.status === 'ok' ? <p className="rounded-lg border bg-[#eef3fa] p-3 text-sm leading-6 text-[#14304f]"><strong>Comparação válida. </strong>{bench.sentence}</p> : <p className="rounded-lg border border-dashed p-3 text-sm leading-6 text-muted-foreground"><strong className="text-[#14304f]">Sem comparação válida. </strong>{bench.unavailableReason}</p>)
              : bench === 'error' ? <p className="text-xs text-muted-foreground">Não foi possível calcular a comparação agora.</p> : null)}
            {measure === 'count' && option.measures.some(m => m.key === 'rate') && <p className="text-xs text-muted-foreground">As quantidades dependem do tamanho da população. Para comparar com outros municípios, use <button type="button" onClick={() => setMeasure('rate')} className="font-semibold text-primary underline">por 100 mil habitantes</button>.</p>}
            {vars.length > 0 && <ul className="grid gap-2 sm:grid-cols-3" aria-label="Mudança entre períodos equivalentes">{vars.map(v => <li key={v.label} className="rounded-xl border bg-white p-3"><p className="text-[0.7rem] text-muted-foreground">{v.label}</p><p className="hero-figure tnum text-2xl text-[#14304f]">{v.value}</p><p className="text-xs text-muted-foreground">{v.sub}</p></li>)}</ul>}
            {measure === 'rate' && isMunicipality && option.scope === 'municipio' && (
              <details className="rounded-xl border bg-white p-3 text-sm" onToggle={e => { if ((e.target as HTMLDetailsElement).open) void openCompare(); }}>
                <summary className="cursor-pointer py-1.5 font-semibold text-[#14304f]">Comparar a taxa de {scopeName} com a de outro município do mesmo estado</summary>
                <p className="mt-2 text-xs text-muted-foreground">Só municípios do mesmo estado com 20 mil habitantes ou mais, na mesma fonte e com população do mesmo ano.</p>
                <input type="search" value={cmpQ} onChange={e => setCmpQ(e.target.value)} placeholder="Procurar município" aria-label="Procurar município para comparar" className="mt-2 w-full rounded-lg border p-2 text-sm" />
                <ul className="mt-2 flex flex-wrap gap-1.5">{filtered.map(c => <li key={c.id}><button type="button" onClick={() => void compareWith(c.id)} className={cn('rounded-full border px-3 py-1 text-xs font-semibold', other?.id === c.id ? 'border-[#74478e] bg-[#74478e] text-white' : 'bg-white hover:border-[#74478e]/60')}>{c.name}</button></li>)}</ul>
                {other && <p className="mt-2 text-xs text-muted-foreground">{other.note} <button type="button" onClick={() => setOther(null)} className="font-semibold text-primary underline">Remover comparação</button></p>}
                {cmpMsg && <p className="mt-2 text-xs text-[#7a4606]" role="status">{cmpMsg}</p>}
              </details>)}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">O que este número é</p><p className="mt-1 text-sm leading-6 text-[#14304f]">{option.definition}</p></div>
              {dist && <div className="rounded-xl border bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Como se distribuem os registros em {dist.t}</p>
                <ul className="mt-2 space-y-1.5">{dist.items.slice(0, 7).map(o => { const max = dist.items[0]!.peek!.v!; return <li key={o.id} className="text-xs"><div className="flex justify-between gap-2"><span className={cn(o.id === option.id && 'font-bold')}>{o.plain}</span><span className="tnum">{fmt(o.peek!.v!)}</span></div><div className="mt-0.5 h-1.5 rounded-full bg-secondary"><div className={cn('h-1.5 rounded-full', o.id === option.id ? 'bg-[#115b45]' : 'bg-[#115b45]/45')} style={{ width: `${Math.max(3, (o.peek!.v! / max) * 100)}%` }} /></div></li>; })}</ul>
                <p className="mt-2 text-[0.68rem] text-muted-foreground">Só categorias exclusivas da mesma fonte e unidade; não é o total de crimes do território.</p></div>}
            </div>
            {option.sensitive && <p className="text-xs text-muted-foreground">Por proteção às vítimas, municípios com poucos casos podem aparecer com o valor oculto (×), e isso não é zero.</p>}
          </>
        )}
        {chapter.municipalCoverage && <p className="text-xs text-muted-foreground">{chapter.municipalCoverage}</p>}
      </div>
    </div>
  );
}
