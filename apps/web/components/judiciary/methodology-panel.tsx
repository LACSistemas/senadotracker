/** P14.8 — painel de metodologia reaproveitado no Capítulo G do perfil de tribunal e na seção "fonte e
 * metodologia" de cada tema: fórmula, numerador, denominador, universo, grau, anos, edição, regra de
 * ausência e referência — o padrão "investigação progressiva" do brief (descoberta → exploração →
 * metodologia), sempre dentro de um `<details>` para não competir com o número no primeiro olhar. */
export interface IndicatorMethodology {
  indicator_id?: string; public_name?: string; official_name?: string; description?: string | null;
  source_variable?: string | null; source_formula?: string | null; numerator?: string | null; denominator?: string | null;
  unit?: string; statistical_universe?: string; institutional_grain?: string; time_grain?: string;
  available_years?: string; aggregation_allowed?: string; comparison_eligible?: boolean;
  source_edition?: number; method_breaks?: string | null; publication_status?: string;
  missing_data_rule?: string; methodology_reference?: string;
}

const ROWS: Array<[keyof IndicatorMethodology, string]> = [
  ['official_name', 'Nome oficial (CNJ)'], ['description', 'Descrição'], ['source_formula', 'Fórmula'],
  ['numerator', 'Numerador'], ['denominator', 'Denominador'], ['statistical_universe', 'Universo estatístico'],
  ['institutional_grain', 'Grão institucional'], ['time_grain', 'Grão temporal'], ['available_years', 'Anos disponíveis'],
  ['aggregation_allowed', 'Agregação permitida'], ['method_breaks', 'Quebras metodológicas'],
  ['missing_data_rule', 'Regra para dado ausente'], ['methodology_reference', 'Referência metodológica'],
];

export function MethodologyPanel({ indicator, summary = 'Ver metodologia completa' }: { indicator: IndicatorMethodology; summary?: string }) {
  const rows = ROWS.filter(([key]) => indicator[key] != null && indicator[key] !== '');
  if (!rows.length) return null;
  return (
    <details className="group rounded-xl border bg-card/50 p-3 text-sm">
      <summary className="focus-ring cursor-pointer list-none font-semibold text-primary">
        <span className="inline-flex items-center gap-1">{summary} <span className="transition group-open:rotate-90">→</span></span>
      </summary>
      <dl className="mt-3 grid gap-x-6 gap-y-2 border-t pt-3 sm:grid-cols-2">
        {rows.map(([key, label]) => (
          <div key={key}><dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-0.5 text-sm leading-5">{String(indicator[key])}</dd></div>
        ))}
        {indicator.comparison_eligible !== undefined && (
          <div><dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Comparável entre tribunais</dt><dd className="mt-0.5 text-sm leading-5">{indicator.comparison_eligible ? 'Sim' : 'Não'}</dd></div>
        )}
        {indicator.source_edition !== undefined && (
          <div><dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Edição da fonte</dt><dd className="mt-0.5 text-sm leading-5">CNJ Justiça em Números {indicator.source_edition}</dd></div>
        )}
      </dl>
    </details>
  );
}
