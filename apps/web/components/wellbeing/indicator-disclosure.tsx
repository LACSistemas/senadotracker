import type { WellbeingObservation } from '@senadotracker/db';

/**
 * Abre fonte, período, universo, cobertura e link oficial direto dos campos que a observação já traz — sem
 * nenhuma consulta extra. `getWellbeingOverview` já devolve tudo isto numa única chamada.
 */
const COVERAGE_LABEL: Record<string, string> = {
  PUBLISHED: 'publicado', PARTIAL_COVERAGE: 'publicado com cobertura parcial', PUBLISHED_WITH_CAVEAT: 'publicado, com ressalva de comparação', NOT_APPLICABLE: 'a fonte não publica neste território',
};

export function IndicatorDetails({ o }: { o: WellbeingObservation }) {
  return (
    <details className="text-xs text-muted-foreground">
      <summary className="cursor-pointer py-1.5 font-semibold text-[#14304f]">Fonte e limites — {o.label}</summary>
      <dl className="mt-2 grid gap-1.5 sm:grid-cols-2">
        <div><dt className="font-semibold text-foreground/80">Fonte</dt><dd>{o.source ?? 'não informada'}{o.release ? ` · ${o.release}` : ''}</dd></div>
        <div><dt className="font-semibold text-foreground/80">Período</dt><dd>{o.periodStart ?? '—'}{o.periodEnd && o.periodEnd !== o.periodStart ? ` a ${o.periodEnd}` : ''}</dd></div>
        <div><dt className="font-semibold text-foreground/80">Unidade</dt><dd>{o.unit ?? '—'}</dd></div>
        <div><dt className="font-semibold text-foreground/80">Universo</dt><dd>{o.universe ?? 'não detalhado pela fonte'}</dd></div>
        <div><dt className="font-semibold text-foreground/80">Cobertura</dt><dd>{COVERAGE_LABEL[o.coverageStatus] ?? o.coverageStatus}</dd></div>
        {o.revision != null && <div><dt className="font-semibold text-foreground/80">Revisão</dt><dd>nº {o.revision}</dd></div>}
      </dl>
      {!o.isComparable && o.comparisonRejectionReason && <p className="mt-2">{o.comparisonRejectionReason}</p>}
      {o.sourceUrl && <p className="mt-2"><a href={o.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">Ver recurso oficial →</a></p>}
    </details>
  );
}
