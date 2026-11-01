import type { ReactNode } from 'react';
import { CircleDashed, EyeOff, Minus } from 'lucide-react';
import type { PointState } from '@/lib/security/types';
import { STATE_LABEL } from '@/components/security/trend-chart';
import { EmptyNote } from '@/components/security/security-ui';
import { cn } from '@/lib/utils';

/**
 * Capítulo sem dado publicado. Promovido de 4 cópias idênticas (Educação/Infraestrutura/Bem-estar
 * tinham a mesma; Segurança tinha uma variante com `EmptyNote`) para um único local compartilhado.
 * Não substitui as cópias existentes — elas continuam funcionando; é a versão a adotar a partir de P5.
 * `tone="note"` reproduz a variante de Segurança (motivo dentro de um `EmptyNote` destacado);
 * o padrão (`"plain"`) reproduz a variante dos outros 3 temas (parágrafo simples).
 */
export function ChapterPending({ id, number, title, reason, tone = 'plain' }: { id: string; number: number; title: string; reason: string; tone?: 'plain' | 'note' }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-28">
      <div className="rounded-3xl border border-dashed bg-card p-5 sm:p-6">
        <p className="eyebrow">Capítulo {number}</p>
        <h2 id={`${id}-h`} className="font-display text-2xl text-[#14304f]">{title}</h2>
        {tone === 'note'
          ? <div className="mt-3"><EmptyNote title="Sem dados publicados aqui">{reason}</EmptyNote></div>
          : <p className="mt-2 max-w-prose text-sm text-muted-foreground">{reason} Nenhum valor é estimado nem preenchido com zero.</p>}
      </div>
    </section>
  );
}

const STATE_ICON: Record<PointState, ReactNode> = {
  ok: null,
  prelim: <CircleDashed size={13} aria-hidden />,
  partial: <CircleDashed size={13} aria-hidden />,
  zero: <Minus size={13} aria-hidden />,
  suppressed: <EyeOff size={13} aria-hidden />,
  absent: <Minus size={13} aria-hidden />,
};

/**
 * Selo de estado de UM ponto/valor (não do capítulo inteiro — para isso já existe `CoverageBadge`
 * em `components/metrics.tsx`, outro contrato, outra granularidade). Reaproveita a mesma legenda de
 * `TrendChart`/`DataStatesLegend` (`STATE_LABEL`) em vez de inventar uma segunda redação. Útil fora
 * do gráfico: células de tabela, KPIs individuais, qualquer lugar que precise marcar um valor como
 * preliminar/suprimido/ausente sem repetir a legenda inteira.
 */
export function StateBadge({ state }: { state: PointState }) {
  if (state === 'ok') return null;
  const label = STATE_LABEL[state];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold text-muted-foreground', state === 'suppressed' && 'border-[#a33a3a]/35 bg-[#a33a3a]/10 text-[#a33a3a]', (state === 'prelim' || state === 'partial') && 'border-[#a65d08]/35 bg-[#a65d08]/10 text-[#a65d08]')} title={label}>
      {STATE_ICON[state]}{label}
    </span>
  );
}
