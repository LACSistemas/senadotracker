'use client';

import { useEffect, useMemo, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface RaceBar { uf: string; name: string; value: number | null }
export interface RaceEdition { year: number; bars: RaceBar[] }
/** Uma "corrida" é um índice nacional (grupo) numa possível variante (etapa/rede) — ex.: Ideb tem 3
 * variantes (anos iniciais/finais/médio) no mesmo grupo; PIB per capita, Leitos e Agressão têm 1 só.
 * `editions` já vem só com os anos em que ALGUMA UF tem valor real (anos sem nenhuma população
 * oficial de UF — ver cada leitor em `@senadotracker/db` — são excluídos na origem, nunca mostrados
 * como um quadro vazio). */
export interface RaceDataset {
  key: string; group: string; area: string; stageLabel: string | null;
  unit: string; decimals: number; color: string; source: string; restrictions: string[];
  editions: RaceEdition[];
}

const PITCH = 30; // px por linha (27 UFs sempre visíveis, sem scroll horizontal)
const TRANSITION_MS = 650;
const SPEED_MS: Record<0.5 | 1 | 2, number> = { 0.5: 2200, 1: 1300, 2: 750 };

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

type Row = { uf: string; name: string; value: number | null; dimmed: boolean; known: boolean };

/** "Corrida dos Estados": bar chart race genérico — qualquer `RaceDataset` com série por edição e
 * por UF entra aqui do mesmo jeito. Reordenação e variação de largura são só `transform`/`width` com
 * transição CSS (as 27 linhas nunca saem do DOM — sempre as mesmas 27 UFs, só trocam de posição e
 * tamanho), sem FLIP manual nem tween em JS: o React já troca o valor de uma edição real pra outra,
 * e o CSS interpola visualmente entre elas; o rótulo do ano nunca mostra um ano intermediário. */
export function StateRace({ datasets, ufs }: { datasets: RaceDataset[]; ufs: Array<{ uf: string; name: string }> }) {
  const groups = useMemo(() => [...new Set(datasets.map(d => d.group))], [datasets]);
  const [datasetKey, setDatasetKey] = useState(datasets[0]?.key ?? '');
  const dataset = datasets.find(d => d.key === datasetKey) ?? datasets[0]!;
  const stagePills = datasets.filter(d => d.group === dataset.group);
  const lastIdx = Math.max(0, dataset.editions.length - 1);
  const reduced = useReducedMotion();

  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<0.5 | 1 | 2>(1);
  const [highlight, setHighlight] = useState('');

  useEffect(() => { setIdx(reduced ? lastIdx : 0); setPlaying(false); }, [dataset.key, reduced, lastIdx]);

  useEffect(() => {
    if (!playing || reduced) return;
    const t = setInterval(() => setIdx(i => {
      if (i >= lastIdx) { setPlaying(false); return i; }
      return i + 1;
    }), SPEED_MS[speed]);
    return () => clearInterval(t);
  }, [playing, speed, lastIdx, reduced]);

  // Quadro atual por UF: valor real quando existe; senão, a última edição conhecida (atenuada) —
  // nunca zero, nunca inventado. Sem NENHUM valor até aqui: "sem dado" (fica por último, sem cor).
  const filled = useMemo(() => {
    const lastKnown = new Map<string, number>();
    return dataset.editions.map(ed => {
      const real = new Map(ed.bars.map(b => [b.uf, b.value] as const));
      const frame = new Map<string, { value: number; dimmed: boolean }>();
      for (const u of ufs) {
        const v = real.get(u.uf);
        if (v != null) { lastKnown.set(u.uf, v); frame.set(u.uf, { value: v, dimmed: false }); }
        else if (lastKnown.has(u.uf)) frame.set(u.uf, { value: lastKnown.get(u.uf)!, dimmed: true });
      }
      return frame;
    });
  }, [dataset, ufs]);

  const datasetMax = useMemo(() => Math.max(0, ...dataset.editions.flatMap(ed => ed.bars.map(b => b.value ?? 0))), [dataset]);

  const rows: Row[] = useMemo(() => {
    const frame = filled[idx] ?? new Map();
    return ufs.map(u => {
      const f = frame.get(u.uf);
      return f ? { uf: u.uf, name: u.name, value: f.value, dimmed: f.dimmed, known: true } : { uf: u.uf, name: u.name, value: null, dimmed: true, known: false };
    }).sort((a, b) => {
      if (a.known && b.known) return (b.value as number) - (a.value as number);
      if (a.known !== b.known) return a.known ? -1 : 1;
      return a.name.localeCompare(b.name, 'pt-BR');
    });
  }, [filled, idx, ufs]);
  const rankByUf = useMemo(() => new Map(rows.map((r, i) => [r.uf, i])), [rows]);
  const rowByUf = useMemo(() => new Map(rows.map(r => [r.uf, r])), [rows]);

  const fmt = (v: number) => dataset.decimals === 0
    ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v)
    : new Intl.NumberFormat('pt-BR', { minimumFractionDigits: dataset.decimals, maximumFractionDigits: dataset.decimals }).format(v);
  const year = dataset.editions[idx]?.year ?? null;
  const atEnd = idx >= lastIdx;

  const handlePlay = () => { if (atEnd) { setIdx(0); setPlaying(true); } else setPlaying(p => !p); };

  return (
    <div className="min-w-0 rounded-2xl border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Corrida dos Estados</p>
          <h3 className="mt-1 text-xl font-black">As 27 UFs, edição a edição</h3>
        </div>
      </div>

      <div role="group" aria-label="Índice da corrida" className="mt-4 flex flex-wrap gap-2">
        {groups.map(g => {
          const first = datasets.find(d => d.group === g)!;
          const active = dataset.group === g;
          return (
            <button key={g} type="button" onClick={() => setDatasetKey(first.key)} aria-pressed={active}
              className={cn('focus-ring flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold', active ? 'border-transparent text-white' : 'bg-background hover:border-primary/50')}
              style={active ? { background: first.color } : undefined}>
              <span className="size-2 rounded-full" style={{ background: active ? 'currentColor' : first.color }} aria-hidden />
              {g}
            </button>
          );
        })}
      </div>
      {stagePills.length > 1 && (
        <div role="group" aria-label="Etapa" className="mt-2 flex flex-wrap gap-1.5">
          {stagePills.map(d => (
            <button key={d.key} type="button" onClick={() => setDatasetKey(d.key)} aria-pressed={d.key === dataset.key}
              className={d.key === dataset.key ? 'focus-ring rounded-full bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground' : 'focus-ring rounded-full px-3 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground'}>
              {d.stageLabel}
            </button>
          ))}
        </div>
      )}

      <p className="mt-2 text-xs text-muted-foreground">{dataset.area} · {dataset.unit}</p>

      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border bg-background p-3">
        {!reduced && (
          <button type="button" onClick={handlePlay} aria-label={atEnd ? 'Repetir a corrida' : playing ? 'Pausar' : 'Reproduzir'}
            className="focus-ring flex size-9 shrink-0 items-center justify-center rounded-full text-white" style={{ background: dataset.color }}>
            {atEnd ? <RotateCcw size={16} aria-hidden /> : playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
          </button>
        )}
        <div aria-live="polite" aria-atomic="true" className="shrink-0">
          <strong className="display-title tabular-nums" style={{ fontSize: '1.75rem', lineHeight: 1 }}>{year ?? '—'}</strong>
        </div>
        <input type="range" min={0} max={lastIdx} value={idx} disabled={dataset.editions.length < 2}
          aria-label="Escolher edição" onChange={e => { setPlaying(false); setIdx(Number(e.target.value)); }}
          className="focus-ring min-w-[8rem] flex-1 accent-current" style={{ color: dataset.color }} />
        {!reduced && (
          <div role="group" aria-label="Velocidade" className="flex shrink-0 overflow-hidden rounded-full border text-xs">
            {([0.5, 1, 2] as const).map(s => (
              <button key={s} type="button" onClick={() => setSpeed(s)} aria-pressed={speed === s}
                className={speed === s ? 'bg-primary px-2.5 py-1 font-bold text-primary-foreground' : 'px-2.5 py-1 font-semibold text-muted-foreground hover:text-foreground'}>
                {s}×
              </button>
            ))}
          </div>
        )}
        <label className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          Destacar
          <select value={highlight} onChange={e => setHighlight(e.target.value)} className="focus-ring rounded-md border bg-card px-2 py-1 text-foreground">
            <option value="">— nenhum —</option>
            {[...ufs].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map(u => <option key={u.uf} value={u.uf}>{u.name}</option>)}
          </select>
        </label>
        {reduced && <p className="text-xs text-muted-foreground">Movimento reduzido ativado: mostrando a classificação da edição escolhida, sem animação.</p>}
      </div>

      <div role="group" aria-label={`Classificação das 27 UFs em ${dataset.unit}, edição de ${year}`} className="relative mt-5" style={{ height: ufs.length * PITCH }}>
        {ufs.map(u => {
          const r = rowByUf.get(u.uf)!;
          const rank = rankByUf.get(u.uf) ?? 0;
          const isHighlight = highlight === u.uf;
          const widthPct = r.known && r.value != null && datasetMax > 0 ? Math.max(1.5, (r.value / datasetMax) * 100) : 1.5;
          return (
            <div key={u.uf}
              className={cn('absolute inset-x-0 flex items-center gap-2', !reduced && 'transition-transform')}
              style={{ top: 0, height: PITCH - 4, transform: `translateY(${rank * PITCH}px)`, transitionDuration: reduced ? '0ms' : `${TRANSITION_MS}ms` }}
              title={r.known ? `${u.name}: ${fmt(r.value!)}${r.dimmed ? ' (última edição com dado publicado — sem edição nova neste ano)' : ''}` : `${u.name}: sem dado publicado`}>
              <img src={`/flags/${u.uf}.svg`} alt="" aria-hidden className={cn('size-4 shrink-0 rounded-full object-cover ring-1 ring-border', (r.dimmed || !r.known) && 'opacity-50')} />
              <span className={cn('w-8 shrink-0 text-[11px] font-bold tabular-nums', isHighlight && 'text-foreground', !isHighlight && (r.dimmed || !r.known) && 'text-muted-foreground')}>{u.uf}</span>
              <div className="relative h-full min-w-0 flex-1 overflow-hidden rounded-sm bg-muted/50">
                <div className={cn('h-full rounded-sm', !reduced && 'transition-[width]', (r.dimmed || !r.known) && 'opacity-45')}
                  style={{ width: `${widthPct}%`, background: dataset.color, transitionDuration: reduced ? '0ms' : `${TRANSITION_MS}ms`, outline: isHighlight ? '2px solid var(--foreground)' : undefined, outlineOffset: isHighlight ? '-2px' : undefined }} />
              </div>
              <span className="w-16 shrink-0 text-right text-[11px] font-bold tabular-nums">{r.known && r.value != null ? fmt(r.value) : 'sem dado'}</span>
              <span className="sr-only">{rank + 1}º: {u.name}, {r.known && r.value != null ? fmt(r.value) : 'sem dado publicado'}{r.dimmed ? ', edição sem dado novo, mantendo a última publicada' : ''}</span>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs leading-5 text-muted-foreground">{dataset.source}</p>
      {dataset.restrictions.map((r, i) => <p key={i} className="mt-1 text-xs leading-5 text-muted-foreground">{r}</p>)}

      <details className="mt-3 text-sm">
        <summary className="focus-ring w-fit cursor-pointer text-xs font-bold text-primary">Ver dados do gráfico</summary>
        <div className="mt-2 max-h-80 overflow-auto rounded-lg border">
          <table className="w-full min-w-[32rem] text-left text-xs">
            <caption className="sr-only">{dataset.group}{dataset.stageLabel ? `, ${dataset.stageLabel}` : ''} por UF e edição</caption>
            <thead className="sticky top-0 bg-card"><tr className="border-b text-muted-foreground"><th className="p-2 font-semibold">UF</th>{dataset.editions.map(ed => <th key={ed.year} className="p-2 text-right font-semibold">{ed.year}</th>)}</tr></thead>
            <tbody>
              {[...ufs].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map(u => (
                <tr key={u.uf} className="border-b last:border-0">
                  <th className="p-2 font-normal">{u.uf} <span className="text-muted-foreground">{u.name}</span></th>
                  {dataset.editions.map(ed => {
                    const v = ed.bars.find(b => b.uf === u.uf)?.value ?? null;
                    return <td key={ed.year} className="p-2 text-right tabular-nums">{v != null ? fmt(v) : '—'}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
