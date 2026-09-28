import type { ReactNode } from 'react';
import { CountUp, type CountKind } from './reveal';

/**
 * Número editorial grande, com base de cobertura. Nunca fabrica zero: sem valor publicado mostra "sem dado publicado".
 * O número usa a sans do site com figuras proporcionais (skill dataviz: sem serifa nem tabular em número grande).
 */
export function StatFigure({ label, value, kind = 'int', note, unavailable = 'sem dado publicado', size = 'lg', tone = 'ink', className = '' }: {
  label: string; value: number | null; kind?: CountKind; note?: ReactNode; unavailable?: string; size?: 'md' | 'lg' | 'xl'; tone?: 'ink' | 'light'; className?: string;
}) {
  const sizes = { md: 'text-3xl sm:text-4xl', lg: 'text-4xl sm:text-5xl', xl: 'text-5xl sm:text-6xl' } as const;
  const ink = tone === 'light' ? 'text-white' : 'text-foreground', soft = tone === 'light' ? 'text-emerald-100/75' : 'text-muted-foreground';
  return <div className={`min-w-0 ${className}`}>
    <p className={`text-xs font-bold uppercase tracking-[.14em] ${soft}`}>{label}</p>
    {value === null
      ? <p className={`mt-2 text-base font-semibold ${soft}`}>{unavailable}</p>
      : <p className={`hero-figure mt-2 ${sizes[size]} ${ink}`}><CountUp value={value} kind={kind} /></p>}
    {note ? <p className={`mt-2 text-sm leading-5 ${soft}`}>{note}</p> : null}
  </div>;
}
