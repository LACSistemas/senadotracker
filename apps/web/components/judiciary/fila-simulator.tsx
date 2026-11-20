'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { JudiciaryAvailabilityNote } from './availability';
import { cn } from '@/lib/utils';

export interface FilaTribunal {
  tribunal_id: string; sigla: string; official_name: string; branch_code: string; branch_name: string;
  uf: string | null; timeDays: number | null; congestion: number | null;
}

const LAST_KEY = 'civica:fila-simulador:ultimo';
const ENTRY_MS = 700;
const COUNT_MS = 900;
const BRANCH_ORDER = ['ESTADUAL', 'FEDERAL', 'TRABALHO', 'ELEITORAL', 'MILITAR', 'SUPERIOR'];

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

function useCountUp(target: number | null, durationMs: number, reduced: boolean, tick: number): number | null {
  const [value, setValue] = useState<number | null>(target);
  useEffect(() => {
    if (target == null) { setValue(null); return; }
    if (reduced) { setValue(target); return; }
    const goal = target;
    let raf = 0; const start = performance.now(); setValue(0);
    function step(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      setValue(goal * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, reduced, tick]);
  return value;
}

function loadLast(): { branch: string; tribunalId: string } | null {
  try { const raw = localStorage.getItem(LAST_KEY); return raw ? JSON.parse(raw) as { branch: string; tribunalId: string } : null; } catch { return null; }
}
function saveLast(v: { branch: string; tribunalId: string }) {
  try { localStorage.setItem(LAST_KEY, JSON.stringify(v)); } catch { /* sem localStorage — funciona sem lembrar a última escolha */ }
}

function formatDaysLong(days: number): string {
  const totalMonths = days / 30.44;
  let years = Math.floor(totalMonths / 12); let months = Math.round(totalMonths % 12);
  if (months === 12) { years += 1; months = 0; }
  if (years === 0 && months === 0) return 'menos de 1 mês';
  if (years === 0) return `≈ ${months} ${months === 1 ? 'mês' : 'meses'}`;
  if (months === 0) return `≈ ${years} ${years === 1 ? 'ano' : 'anos'}`;
  return `≈ ${years} ${years === 1 ? 'ano' : 'anos'} e ${months} ${months === 1 ? 'mês' : 'meses'}`;
}

function percentileRank(value: number, sorted: number[]): number {
  const idx = sorted.indexOf(value);
  return sorted.length > 1 && idx >= 0 ? idx / (sorted.length - 1) : 0.5;
}
function tierNote(kind: 'time' | 'congestion', value: number, sorted: number[], branchName: string): string | null {
  if (sorted.length < 3) return null;
  const pct = percentileRank(value, sorted);
  if (pct <= 1 / 3) return kind === 'time' ? `Dentro da ${branchName}, este tribunal tem um dos tempos médios de baixa mais curtos.` : `Dentro da ${branchName}, este tribunal está entre os que menos represam processos.`;
  if (pct >= 2 / 3) return kind === 'time' ? `Dentro da ${branchName}, este tribunal tem um dos tempos médios de baixa mais longos.` : `Dentro da ${branchName}, este tribunal está entre os que mais represam processos.`;
  return null;
}

/** P14.52 — "Um processo que entra hoje": simulador de fila pessoal para a seção de congestionamento.
 * Autossuficiente — recebe a lista já cruzada (tempo médio × congestionamento) por tribunal e cuida de
 * toda a seleção/animação/persistência no cliente. A "fila" desenhada é só ilustração de progresso visual
 * (nunca um número real de processos à frente — isso não existe na fonte), deixado explícito na legenda. */
export function FilaSimulator({ tribunals, year }: { tribunals: FilaTribunal[]; year: number }) {
  const reduced = useReducedMotion();
  const branches = useMemo(() => {
    const map = new Map<string, { code: string; name: string; count: number }>();
    for (const t of tribunals) { const e = map.get(t.branch_code) ?? { code: t.branch_code, name: t.branch_name, count: 0 }; e.count += 1; map.set(t.branch_code, e); }
    return [...map.values()].sort((a, b) => { const ia = BRANCH_ORDER.indexOf(a.code), ib = BRANCH_ORDER.indexOf(b.code); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
  }, [tribunals]);

  const [branch, setBranch] = useState('');
  const [tribunalId, setTribunalId] = useState('');
  const [entering, setEntering] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [tick, setTick] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const last = loadLast();
    if (last && tribunals.some(t => t.tribunal_id === last.tribunalId && t.branch_code === last.branch)) { setBranch(last.branch); setTribunalId(last.tribunalId); setRevealed(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const tribunalsInBranch = useMemo(() => tribunals.filter(t => t.branch_code === branch).sort((a, b) => a.sigla.localeCompare(b.sigla, 'pt-BR')), [tribunals, branch]);
  const current = tribunals.find(t => t.tribunal_id === tribunalId) ?? null;

  function pickBranch(code: string) { setBranch(code); setTribunalId(''); setRevealed(false); setEntering(false); clearTimeout(timeoutRef.current); }
  function pickTribunal(id: string) {
    setTribunalId(id); setRevealed(false); if (id) saveLast({ branch, tribunalId: id });
    clearTimeout(timeoutRef.current);
    if (!id) return;
    if (reduced) { setRevealed(true); setTick(t => t + 1); return; }
    setEntering(true);
    timeoutRef.current = setTimeout(() => { setEntering(false); setRevealed(true); setTick(t => t + 1); }, ENTRY_MS);
  }
  function reset() { setBranch(''); setTribunalId(''); setRevealed(false); setEntering(false); clearTimeout(timeoutRef.current); }

  const timeValue = useCountUp(revealed ? current?.timeDays ?? null : null, COUNT_MS, reduced, tick);
  const congestionValue = useCountUp(revealed ? (current?.congestion != null ? current.congestion * 100 : null) : null, COUNT_MS, reduced, tick);

  const timeSorted = useMemo(() => tribunals.filter(t => t.branch_code === branch && t.timeDays != null).map(t => t.timeDays!).sort((a, b) => a - b), [tribunals, branch]);
  const congSorted = useMemo(() => tribunals.filter(t => t.branch_code === branch && t.congestion != null).map(t => t.congestion!).sort((a, b) => a - b), [tribunals, branch]);
  const timeNote = current?.timeDays != null ? tierNote('time', current.timeDays, timeSorted, current.branch_name) : null;
  const congNote = current?.congestion != null ? tierNote('congestion', current.congestion, congSorted, current.branch_name) : null;

  const allSorted = useMemo(() => [...tribunals].sort((a, b) => a.branch_name.localeCompare(b.branch_name, 'pt-BR') || a.sigla.localeCompare(b.sigla, 'pt-BR')), [tribunals]);

  return (
    <div className="rounded-2xl border bg-card p-5 sm:p-6">
      <p className="eyebrow">Simulador</p>
      <h3 className="display-title mt-1 text-xl sm:text-2xl">Um processo que entra hoje</h3>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Escolha um tribunal e veja, com os números reais dele, o que significa hoje entrar na fila.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-bold">Tipo de Justiça
          <select value={branch} onChange={e => pickBranch(e.target.value)} className="focus-ring mt-1 w-full rounded-xl border bg-background p-2.5 text-sm font-normal">
            <option value="">Escolha…</option>
            {branches.map(b => <option key={b.code} value={b.code}>{b.name} ({b.count})</option>)}
          </select>
        </label>
        <label className="text-sm font-bold">Tribunal
          <select value={tribunalId} onChange={e => pickTribunal(e.target.value)} disabled={!branch} className="focus-ring mt-1 w-full rounded-xl border bg-background p-2.5 text-sm font-normal disabled:opacity-50">
            <option value="">{branch ? 'Escolha…' : 'Escolha o tipo de Justiça primeiro'}</option>
            {tribunalsInBranch.map(t => <option key={t.tribunal_id} value={t.tribunal_id}>{t.sigla} — {t.official_name}</option>)}
          </select>
        </label>
      </div>

      {current && (
        <div className="mt-6">
          <div className="flex items-center gap-3">
            {current.uf && <img src={`/flags/${current.uf}.svg`} alt="" aria-hidden className="h-9 w-9 shrink-0 rounded-full border object-cover" />}
            <p className="text-sm font-bold">{current.sigla} <span className="font-normal text-muted-foreground">— {current.official_name}</span></p>
          </div>

          <div aria-hidden className="mt-4 flex items-center gap-1.5 overflow-hidden rounded-xl border border-dashed bg-background p-3">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-6 w-6 shrink-0 rounded-md bg-muted" />)}
            <div className="relative h-6 w-10 shrink-0 overflow-hidden">
              <div className={cn('absolute left-0 top-0 h-6 w-6 rounded-md bg-primary', !reduced && 'transition-transform duration-700 ease-out')} style={{ transform: entering ? 'translateX(160%)' : 'translateX(0%)' }} />
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Ilustração do processo entrando na fila — não representa a posição ou a quantidade real de processos à frente.</p>

          <div aria-live="polite" className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border bg-background p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Tempo médio até a baixa</p>
              <p className="hero-figure tabular-nums text-3xl">{timeValue != null ? Math.round(timeValue).toLocaleString('pt-BR') : '—'} <span className="text-base font-normal text-muted-foreground">dias</span></p>
              {current.timeDays != null && <p className="text-sm text-muted-foreground">{formatDaysLong(current.timeDays)}</p>}
              {current.timeDays == null && <p className="text-sm text-muted-foreground">Sem dado publicado para este tribunal.</p>}
              {timeNote && <p className="mt-2 text-sm font-semibold text-foreground">{timeNote}</p>}
            </div>
            <div className="rounded-xl border bg-background p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Taxa de congestionamento</p>
              <p className="hero-figure tabular-nums text-3xl">{congestionValue != null ? congestionValue.toFixed(1).replace('.', ',') : '—'}<span className="text-base font-normal text-muted-foreground">%</span></p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-2 rounded-full bg-[#d39a3c]" style={{ width: `${Math.min(100, congestionValue ?? 0)}%` }} /></div>
              {current.congestion == null && <p className="mt-1 text-sm text-muted-foreground">Sem dado publicado para este tribunal.</p>}
              {congNote && <p className="mt-2 text-sm font-semibold text-foreground">{congNote}</p>}
            </div>
          </div>

          <div className="mt-4">
            <JudiciaryAvailabilityNote availability="AVAILABLE" source={`CNJ Justiça em Números · ano-base ${year}`} limitations={[
              'O tempo médio é uma referência histórica dos processos JÁ baixados por este tribunal — não é uma previsão de duração para um processo novo que entra hoje.',
              'A taxa de congestionamento é medida por tribunal, não existe uma taxa nacional única: acervos e universos diferem entre instituições.',
            ]} />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={reset} className="focus-ring inline-flex h-10 items-center rounded-full border px-4 text-sm font-bold hover:border-primary">Testar outro tribunal</button>
          </div>
        </div>
      )}

      <details className="mt-5 text-sm">
        <summary className="focus-ring w-fit cursor-pointer font-bold text-primary">Ver os valores de todos os tribunais</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Tempo médio até a baixa e taxa de congestionamento por tribunal</caption>
            <thead><tr className="border-b"><th className="p-2">Ramo</th><th className="p-2">Tribunal</th><th className="p-2 text-right">Tempo médio (dias)</th><th className="p-2 text-right">Congestionamento</th></tr></thead>
            <tbody>{allSorted.map(t => (
              <tr className="border-b" key={t.tribunal_id}><td className="p-2 text-muted-foreground">{t.branch_name}</td><th className="p-2 font-normal">{t.sigla} — {t.official_name}</th>
                <td className="p-2 text-right tabular-nums">{t.timeDays != null ? Math.round(t.timeDays).toLocaleString('pt-BR') : '—'}</td>
                <td className="p-2 text-right tabular-nums">{t.congestion != null ? `${(t.congestion * 100).toFixed(1).replace('.', ',')}%` : '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
