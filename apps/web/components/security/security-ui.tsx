import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Info } from 'lucide-react';
import type { Narrative } from '@/lib/security/types';
import { cn } from '@/lib/utils';

/** Sparkline em SVG puro (servidor): tendência recente sem eixos; serve de contexto, os valores exatos estão no gráfico do capítulo. */
export function Sparkline({ values, label, width = 112, height = 34 }: { values: number[]; label: string; width?: number; height?: number }) {
  if (values.length < 2) return null; const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => [2 + (i / (values.length - 1)) * (width - 4), 3 + (1 - (v - min) / span) * (height - 6)] as const);
  const d = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(''); const last = pts.at(-1)!;
  return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Tendência recente (${label}): de ${values[0]} a ${values.at(-1)}`} className="shrink-0"><path d={d} fill="none" stroke="#115b45" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /><circle cx={last[0]} cy={last[1]} r="3" fill="#115b45" /></svg>;
}

/** Variação sem julgamento de bom/ruim: a seta mostra a direção; a cor é sempre neutra (uma queda de apreensões não é "boa" nem "ruim" por si). */
export function DeltaChip({ delta }: { delta: { text: string; direction: 'up' | 'down' | 'flat' } | null }) {
  if (!delta) return null; const Icon = delta.direction === 'up' ? ArrowUpRight : delta.direction === 'down' ? ArrowDownRight : ArrowRight;
  return <span className="inline-flex items-start gap-1 rounded-full border bg-card px-2.5 py-1 text-xs font-semibold text-[#14304f]"><Icon size={14} className="mt-px shrink-0" aria-hidden /><span><span className="sr-only">{delta.direction === 'up' ? 'Aumento: ' : delta.direction === 'down' ? 'Redução: ' : 'Estável: '}</span>{delta.text}</span></span>;
}

export function Eyebrow({ children }: { children: ReactNode }) { return <p className="eyebrow">{children}</p>; }

/** Moldura de um capítulo: pergunta → resposta → evidência → convite, mais "fontes e limites" sempre à mão. */
export function ChapterShell({ id, number, title, narrative, tone = 'plain', limits, sources, children }: { id: string; number: number; title: string; narrative: Narrative; tone?: 'plain' | 'strip'; limits: string[]; sources?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={cn('scroll-mt-28 rounded-3xl border p-5 sm:p-8', tone === 'strip' ? 'bg-[var(--surface-strip,#faf9f5)]' : 'bg-card')}>
      <header className="section-hairline pt-4">
        <Eyebrow>Capítulo {number}</Eyebrow>
        <h2 id={`${id}-h`} className="display-title mt-1 text-3xl sm:text-4xl">{title}</h2>
        <p className="mt-2 font-display text-lg italic text-muted-foreground sm:text-xl">{narrative.question}</p>
      </header>
      <div className="mt-5 max-w-3xl">
        {narrative.answer && <p className="font-display text-xl leading-snug text-[#14304f] sm:text-2xl">{narrative.answer}</p>}
        {narrative.context && <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">{narrative.context}</p>}
      </div>
      <div className="mt-6 space-y-8">{children}</div>
      <details className="mt-8 rounded-xl border bg-white/60 p-4 text-sm"><summary className="flex min-h-6 cursor-pointer py-1.5 items-center gap-2 font-semibold text-[#14304f]"><Info size={16} aria-hidden />Fontes e limites deste capítulo</summary>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted-foreground">{limits.map(l => <li key={l}>{l}</li>)}</ul>{sources && <p className="mt-3 text-xs text-muted-foreground">{sources}</p>}</details>
      {narrative.invite && <p className="mt-4 text-sm font-semibold text-primary">{narrative.invite}</p>}
    </section>
  );
}

/** Estado vazio informativo: diz o que falta e por quê, nunca cria bloco em branco nem zero artificial. */
export function EmptyNote({ title, children }: { title: string; children: ReactNode }) {
  return <div className="rounded-xl border border-dashed bg-white/50 p-5"><p className="font-display text-lg text-[#14304f]">{title}</p><p className="mt-1 max-w-prose text-sm leading-6 text-muted-foreground">{children}</p></div>;
}

export function Stat({ label, value, unit, note, accent }: { label: string; value: ReactNode; unit?: string; note?: ReactNode; accent?: boolean }) {
  return <div className={cn('rounded-xl border p-4', accent ? 'bg-[#e8f3ee]' : 'bg-white')}><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="hero-figure tnum mt-1 text-3xl text-[#14304f]">{value}</p>{unit && <p className="text-xs text-muted-foreground">{unit}</p>}{note && <p className="mt-2 text-xs leading-5 text-muted-foreground">{note}</p>}</div>;
}

/** Legenda dos estados de dado: aparece uma vez na página, para o leigo entender os símbolos dos gráficos sem abrir metodologia. */
export function DataStatesLegend() {
  const items: Array<[string, string]> = [['Círculo vazado', 'preliminar ou ano incompleto: pode mudar'], ['Linha interrompida', 'a fonte não informou: não é zero'], ['×', 'valor oculto por privacidade'], ['Faixa cinza', 'período sem estimativa oficial de população'], ['Faixa azul', 'faixa central dos municípios comparáveis']];
  return <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground" aria-label="Como ler os gráficos">{items.map(([k, v]) => <li key={k}><strong className="text-[#14304f]">{k}</strong>: {v}</li>)}</ul>;
}
