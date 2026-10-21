import type { DataCoverage, DataPeriod, Source } from './index.ts';

export type FinancialMeasureId =
  | 'parliamentary_quota'
  | 'cabinet_payroll_gross'
  | 'cabinet_allowances'
  | 'identified_cabinet_payroll'
  | 'normative_subsidy'
  | 'identified_competence_cost'
  | 'identified_window_cost'
  | 'identified_monthly_average';

export type FinancialNature = 'observed' | 'normative';
export type FinancialComparison = 'eligible' | 'ineligible' | 'not_applicable';

export interface FinancialComponentObservation {
  id: FinancialMeasureId;
  valueCents: number | null;
  competencies: string[];
  expectedCompetencies: string[];
  nature: FinancialNature;
  includedInIdentified: boolean;
  note: string;
}

export interface AnnualFinancialSummary {
  year: number;
  identifiedCents: number | null;
  completeComparableCents: number | null;
  competencies: string[];
  expectedCompetencies: string[];
  components: FinancialComponentObservation[];
  missingComponents: FinancialMeasureId[];
  complete: boolean;
  aggregationRule: 'sum_observed_components';
  note: string;
}

/** Canonical description of one monetary measure. Values remain integer cents. */
export interface FinancialMeasure {
  id: FinancialMeasureId;
  valueCents: number | null;
  source: Source | 'multiple';
  publicationId: string | null;
  year: number;
  competencies: string[];
  period: DataPeriod;
  observedMonths: number;
  expectedMonths: number;
  coverage: DataCoverage;
  includedRubrics: string[];
  excludedRubrics: string[];
  nature: FinancialNature;
  comparison: FinancialComparison;
  note: string;
}

export function commonCompetencies(...sets: ReadonlyArray<ReadonlySet<string>>): string[] {
  if (!sets.length) return [];
  return [...sets[0]!].filter(item => sets.every(set => set.has(item))).sort();
}

export function periodForCompetencies(competencies: readonly string[], grain: DataPeriod['grain'] = 'month'): DataPeriod {
  if (!competencies.length) return { from: null, to: null, grain };
  return { from: competencies[0]!, to: competencies.at(-1)!, grain };
}

export function averageObservedCents(totalCents: number | null, competencies: readonly string[]): number | null {
  if (totalCents === null || !competencies.length) return null;
  return Math.round(totalCents / competencies.length);
}

export function sumObservedCents(values: readonly (number | null)[]): number | null {
  const observed = values.filter((value): value is number => value !== null && Number.isSafeInteger(value));
  return observed.length ? observed.reduce((sum, value) => sum + value, 0) : null;
}

export function annualFinancialSummary(
  year: number,
  components: readonly FinancialComponentObservation[],
): AnnualFinancialSummary {
  const expected = [...new Set(components.flatMap(component => component.expectedCompetencies))].sort();
  const observed = [...new Set(components.flatMap(component => component.competencies))].sort();
  const included = components.filter(component => component.includedInIdentified);
  const identifiedCents = sumObservedCents(included.map(component => component.valueCents));
  const missingComponents = included.filter(component => component.valueCents === null).map(component => component.id);
  const complete = expected.length > 0 && included.length > 0 && included.every(component =>
    component.valueCents !== null && component.competencies.length === expected.length &&
    expected.every(competence => component.competencies.includes(competence))
  );
  const completeComparableCents = complete ? sumObservedCents(included.map(component => component.valueCents)) : null;
  return {
    year, identifiedCents, completeComparableCents, competencies: observed,
    expectedCompetencies: expected, components: [...components], missingComponents,
    complete, aggregationRule: 'sum_observed_components',
    note: complete
      ? `Componentes publicados em todas as ${expected.length} competências esperadas.`
      : 'Acumulado identificado por componentes observados; competências ausentes não foram preenchidas nem extrapoladas.',
  };
}
