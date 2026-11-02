import type { ReactNode } from 'react';
import { Sparkline, DeltaChip } from '@/components/security/security-ui';

/**
 * P8 (reconstrução estrutural) — substitui o padrão "card dentro de card" (`rounded-2xl border bg-white`
 * repetido em grade 2x2) que P8.0 quantificou em 68-70% de aninhamento nas 2 visões gerais e em
 * Educação/Segurança. Duas peças, sem moldura própria (a seção-pai já tem uma): `KpiHeadline` — 1 número
 * protagonista, maior, com tendência; `KpiRow` — lista compacta separada por hairline, não por caixa.
 * Mandato §8.1: "remover molduras desnecessárias" antes de "criar outro card".
 */
export function KpiHeadline({ eyebrow, value, unit, caption, delta, spark, sparkLabel }: {
  eyebrow: string; value: string; unit?: string | undefined; caption?: ReactNode; delta?: { text: string; direction: 'up' | 'down' | 'flat' } | null | undefined; spark?: number[] | undefined; sparkLabel?: string | undefined;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{eyebrow}</p>
        <p className="hero-figure tnum mt-1 text-5xl text-[#14304f] sm:text-6xl">{value}{unit && <span className="ml-1.5 text-base font-normal text-muted-foreground">{unit}</span>}</p>
        {caption && <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">{caption}</p>}
        {delta && <div className="mt-2"><DeltaChip delta={delta} /></div>}
      </div>
      {spark && spark.length > 1 && <Sparkline values={spark} label={sparkLabel ?? eyebrow} width={168} height={52} />}
    </div>
  );
}

export function KpiRow({ label, value, unit, meta, delta }: { label: ReactNode; value: string; unit?: string | undefined; meta?: ReactNode; delta?: { text: string; direction: 'up' | 'down' | 'flat' } | null | undefined }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t py-3 first:border-t-0 first:pt-0">
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold leading-snug">{label}</p>{meta && <p className="mt-0.5 text-xs text-muted-foreground">{meta}</p>}</div>
      <div className="flex min-w-0 flex-wrap items-baseline gap-2">
        <p className="hero-figure tnum text-xl text-[#14304f]">{value}{unit && <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>}</p>
        {delta && <DeltaChip delta={delta} />}
      </div>
    </li>
  );
}

export function KpiRowList({ children }: { children: ReactNode }) {
  return <ul className="mt-4">{children}</ul>;
}

/** Faixa horizontal de estatísticas de apoio ao lado de um gráfico protagonista — separadores verticais, não
 * caixas (Segurança: "um gráfico... não quatro mini-KPIs comprimidos", mandato §5.3). Distinto de `KpiRowList`
 * (lista vertical, uma por linha — Educação: a jornada, passo a passo) pelo mesmo motivo que os dois temas
 * pedem leituras diferentes: progressão sequencial vs. estatísticas que acompanham uma tendência. */
export function KpiStatStrip({ children }: { children: ReactNode }) {
  return <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-3 border-t pt-4">{children}</dl>;
}
export function KpiStat({ label, value, unit }: { label: ReactNode; value: string; unit?: string }) {
  return <div><dt className="text-xs font-semibold text-muted-foreground">{label}</dt><dd className="hero-figure tnum mt-0.5 text-lg text-[#14304f]">{value}{unit && <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>}</dd></div>;
}
