import type { ChartView, Kpi } from '@/lib/security/types';
import { KpiCard } from '@/components/security/security-hero';
import { TrendChart } from '@/components/security/trend-chart';

export interface IndicatorVerification {
  source: string;
  definition?: string;
  coverage?: string;
  caveat?: string | null;
  notes?: string[];
}

export interface IndicatorLiveProps {
  /** Nível 1 — Descobrir. Mesmo `KpiCard` já usado por Segurança e Educação, sem alteração. */
  kpi: Kpi;
  /** Rótulo do referencial de comparação exigido por `KpiCard` (ex. nome da UF ou "Brasil"). */
  who: string;
  lead?: boolean;
  /** Nível 2 — Explorar. Quando presente, abre `TrendChart` (mesmo componente dos capítulos) sob disclosure. */
  chart?: ChartView;
  /** Nível 3 — Verificar. Proveniência do indicador, sob disclosure própria. */
  verify?: IndicatorVerification;
}

/**
 * Indicador Vivo (mandato Parte VII.12): compõe o que já existe — `KpiCard` para Descobrir,
 * `TrendChart` para Explorar — com uma camada de Verificar que hoje só existe por capítulo
 * (`ChapterShell`), não por indicador individual. Não substitui nenhum uso atual de `KpiCard`;
 * é um envelope opcional para quando um indicador precisar das 3 camadas juntas (a partir de P4/P5).
 * Funciona com qualquer `Kpi`/`ChartView` já produzido hoje — sem mudança de contrato de dados.
 */
export function IndicatorLive({ kpi, who, lead = false, chart, verify }: IndicatorLiveProps) {
  return (
    <div className="flex flex-col gap-3">
      <KpiCard k={kpi} lead={lead} who={who} />
      {chart && (
        <details className="rounded-2xl border bg-card p-4 sm:p-5">
          <summary className="focus-ring w-fit cursor-pointer text-sm font-semibold text-primary">Explorar a série completa</summary>
          <div className="mt-4"><TrendChart chart={chart} compact /></div>
        </details>
      )}
      {verify && (
        <details className="rounded-xl border border-dashed bg-white/50 p-4 text-sm">
          <summary className="focus-ring w-fit cursor-pointer font-semibold text-[#14304f]">Verificar fonte e metodologia</summary>
          <dl className="mt-3 grid gap-3 text-muted-foreground sm:grid-cols-2">
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-[#14304f]">Fonte</dt><dd className="mt-0.5">{verify.source}</dd></div>
            {verify.coverage && <div><dt className="text-xs font-semibold uppercase tracking-wide text-[#14304f]">Cobertura</dt><dd className="mt-0.5">{verify.coverage}</dd></div>}
            {verify.definition && <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase tracking-wide text-[#14304f]">Definição</dt><dd className="mt-0.5">{verify.definition}</dd></div>}
            {verify.caveat && <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase tracking-wide text-[#14304f]">Ressalva</dt><dd className="mt-0.5">{verify.caveat}</dd></div>}
          </dl>
          {verify.notes?.length ? <ul className="mt-3 list-disc space-y-1 pl-5">{verify.notes.map(n => <li key={n}>{n}</li>)}</ul> : null}
        </details>
      )}
    </div>
  );
}
