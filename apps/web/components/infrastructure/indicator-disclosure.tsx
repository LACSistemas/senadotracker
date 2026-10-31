import type { InfrastructureIndicator } from '@senadotracker/db';
import { periodLabel } from '@/lib/security/format';
import { AVAILABILITY_LABEL } from '@/lib/infrastructure/catalog';

/**
 * Abre fonte, período, universo, cobertura e metodologia direto dos campos que o indicador já traz — sem nenhuma
 * consulta extra. `getInfrastructureIndicators` já devolve tudo isto numa única chamada.
 */

export function IndicatorDetails({ ind }: { ind: InfrastructureIndicator }) {
  return (
    <details className="text-xs text-muted-foreground">
      <summary className="cursor-pointer py-1.5 font-semibold text-[#14304f]">Fonte e limites — {ind.title}</summary>
      <dl className="mt-2 grid gap-1.5 sm:grid-cols-2">
        <div><dt className="font-semibold text-foreground/80">Fonte</dt><dd>{ind.sourceFamily}</dd></div>
        <div><dt className="font-semibold text-foreground/80">Período</dt><dd>{ind.period ? periodLabel(ind.period.slice(0, 7)) : '—'}{ind.referenceYear ? ` (${ind.referenceYear})` : ''}</dd></div>
        <div><dt className="font-semibold text-foreground/80">Unidade</dt><dd>{ind.unit || '—'}</dd></div>
        <div><dt className="font-semibold text-foreground/80">Universo</dt><dd>{ind.numerator != null && ind.denominator != null ? `${ind.numerator} de ${ind.denominator}` : 'não detalhado pela fonte'}</dd></div>
        <div><dt className="font-semibold text-foreground/80">Cobertura</dt><dd>{AVAILABILITY_LABEL[ind.valueStatus] ?? ind.valueStatus}</dd></div>
        {ind.publicationRevision != null && <div><dt className="font-semibold text-foreground/80">Revisão</dt><dd>nº {ind.publicationRevision}</dd></div>}
      </dl>
      {!ind.comparisonEligible && <p className="mt-2">A fonte não autoriza agregação/comparação automática para este indicador.</p>}
      {ind.methodology && <p className="mt-2">{ind.methodology}</p>}
    </details>
  );
}
