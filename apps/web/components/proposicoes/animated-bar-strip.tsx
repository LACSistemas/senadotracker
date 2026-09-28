'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { inkOn, nf, pf, pf0 } from '@/lib/proposicoes/taxonomy';
import { useInView } from './reveal';

export interface StripSegment { key: string; label: string; value: number; share: number; color: string; note?: string }

const HEIGHT = { lg: 40, md: 28, sm: 16 } as const;

/**
 * Faixa horizontal 100% empilhada: cada segmento é um alvo de foco e de ponteiro, com tooltip acessível (valor em
 * destaque, nome em segundo plano), rótulo interno só quando cabe, intervalo de 2 px entre fills e tabela de dados
 * equivalente. A faixa "cresce" ao entrar na tela e respeita prefers-reduced-motion.
 * Os segmentos chegam na ordem taxonômica fixa; esta faixa não reordena por tamanho.
 */
export function AnimatedBarStrip({ segments, ariaLabel, size = 'md', selectedKey = null, onSelect, tableCaption, valueHeader = 'Quantidade', formatValue = value => nf.format(value), showTable = true, inlineLabels = true, className = '', below }: {
  segments: StripSegment[]; ariaLabel: string; size?: keyof typeof HEIGHT; selectedKey?: string | null; onSelect?: (key: string | null) => void;
  tableCaption: string; valueHeader?: string; formatValue?: (value: number) => string; showTable?: boolean; inlineLabels?: boolean; className?: string; below?: ReactNode;
}) {
  const [viewRef, inView] = useInView<HTMLDivElement>(0.3);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [tip, setTip] = useState<{ key: string; x: number } | null>(null);
  useEffect(() => {
    const node = boxRef.current;
    if (!node) return;
    const update = () => setWidth(node.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const active = tip ? segments.find(segment => segment.key === tip.key) : null;
  const place = (key: string, x: number) => setTip({ key, x: Math.max(80, Math.min(width - 80, x)) });
  const label = (segment: StripSegment) => `${segment.label}: ${formatValue(segment.value)} (${pf.format(segment.share)})${segment.note ? `. ${segment.note}` : ''}`;
  return <div ref={viewRef} className={`relative ${className}`}>
    {active && tip ? <div role="presentation" aria-hidden="true" style={{ left: tip.x }} className="pointer-events-none absolute bottom-full z-20 mb-2 w-max max-w-[16rem] -translate-x-1/2 rounded-xl border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="text-base font-bold leading-none text-foreground">{formatValue(active.value)} <span className="text-xs font-semibold text-muted-foreground">· {pf.format(active.share)}</span></p>
      <p className="mt-1.5 flex items-center gap-1.5 text-muted-foreground"><i className="h-1 w-3 rounded-full" style={{ background: active.color }} />{active.label}</p>
      {active.note ? <p className="mt-1 leading-4 text-muted-foreground">{active.note}</p> : null}
    </div> : null}
    <div ref={boxRef} role="group" aria-label={ariaLabel} data-in={inView ? 'true' : 'false'} style={{ height: HEIGHT[size], ['--wipe-r' as string]: '4px' }}
      className={`prop-wipe flex gap-[2px] overflow-hidden rounded-[4px] bg-[var(--surface-strip)] ${selectedKey ? 'strip-dim' : ''}`}>
      {segments.map(segment => {
        const px = width * segment.share, showLabel = inlineLabels && px >= 46 && size !== 'sm';
        const common = {
          'aria-label': label(segment), 'data-active': selectedKey === segment.key ? 'true' : 'false',
          style: { flexGrow: Math.max(segment.share, 0.0005), flexBasis: 0, minWidth: 3, background: segment.color, color: inkOn(segment.color) },
          className: 'strip-seg focus-ring relative grid min-w-[3px] place-items-center overflow-hidden text-xs font-bold',
          onPointerMove: (event: React.PointerEvent<HTMLElement>) => place(segment.key, event.clientX - (boxRef.current?.getBoundingClientRect().left ?? 0)),
          onPointerLeave: () => setTip(null),
          onFocus: (event: React.FocusEvent<HTMLElement>) => place(segment.key, event.currentTarget.offsetLeft + event.currentTarget.offsetWidth / 2),
          onBlur: () => setTip(null),
        };
        return onSelect
          ? <button key={segment.key} type="button" aria-pressed={selectedKey === segment.key} onClick={() => onSelect(selectedKey === segment.key ? null : segment.key)} {...common}>{showLabel ? <span aria-hidden="true">{pf0.format(segment.share)}</span> : null}</button>
          : <div key={segment.key} tabIndex={0} role="img" {...common}>{showLabel ? <span aria-hidden="true">{pf0.format(segment.share)}</span> : null}</div>;
      })}
    </div>
    {below}
    {showTable ? <details className="mt-3 text-sm">
      <summary className="focus-ring w-fit cursor-pointer text-xs font-bold text-primary">Ver dados do gráfico</summary>
      <div className="mt-2 overflow-x-auto"><table className="w-full text-left"><caption className="sr-only">{tableCaption}</caption>
        <thead><tr className="border-b text-xs text-muted-foreground"><th className="p-2 font-semibold">Categoria</th><th className="p-2 text-right font-semibold">{valueHeader}</th><th className="p-2 text-right font-semibold">Participação</th></tr></thead>
        <tbody>{segments.map(segment => <tr key={segment.key} className="border-b last:border-0"><th className="p-2 font-normal"><span className="inline-flex items-center gap-2"><i className="size-2.5 rounded-sm" style={{ background: segment.color }} />{segment.label}</span></th><td className="p-2 text-right tabular-nums">{formatValue(segment.value)}</td><td className="p-2 text-right tabular-nums">{pf.format(segment.share)}</td></tr>)}
          <tr><th className="p-2 text-xs font-semibold text-muted-foreground">Total</th><td className="p-2 text-right text-xs font-semibold tabular-nums">{formatValue(total)}</td><td className="p-2" /></tr></tbody>
      </table></div>
    </details> : null}
  </div>;
}
