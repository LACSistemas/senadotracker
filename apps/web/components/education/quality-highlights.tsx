import type { SuperlativeHighlight } from '@/lib/education/types';

/**
 * Destaques de qualidade do ensino superior: cada card é UM indicador + UM ciclo + UMA área, nunca uma combinação.
 * Nunca diz "melhor do Brasil" nem cria índice único — a frase sempre nomeia o grupo comparável e a fonte.
 */
export function QualityHighlights({ items }: { items: SuperlativeHighlight[] }) {
  if (!items.length) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((h, i) => (
        <article key={`${h.label}-${i}`} className="rounded-2xl border bg-white/70 p-4">
          <p className="eyebrow">{h.label}</p>
          <p className="hero-figure tnum mt-1 text-3xl text-[#14304f]">{h.value}<span className="ml-1 text-sm font-normal text-muted-foreground">{h.unit}</span></p>
          <p className="mt-1 text-sm text-muted-foreground">{h.detail}</p>
          <p className="mt-2 text-xs text-muted-foreground">{h.basis}</p>
          {h.caveat && <p className="mt-1 text-[0.7rem] leading-snug text-muted-foreground">{h.caveat}</p>}
        </article>
      ))}
    </div>
  );
}
