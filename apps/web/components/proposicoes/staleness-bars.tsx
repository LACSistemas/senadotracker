'use client';
import type { PrincipalStaleness } from '@senadotracker/db';
import { formatDate, nf, pf } from '@/lib/proposicoes/taxonomy';
import { useInView } from './reveal';

const RAMP = ['var(--stale-1)', 'var(--stale-2)', 'var(--stale-3)', 'var(--stale-4)', 'var(--stale-5)'];

/**
 * Há quanto tempo cada matéria principal está sem movimentação OBSERVADA (até o último registro publicado).
 * É uma escala ordinal (posição na sequência), então usa um único matiz em luminosidade monótona; o comprimento da
 * barra carrega a quantidade. O texto descreve o que a base publicou; não afirma abandono.
 */
export function StalenessBars({ staleness }: { staleness: PrincipalStaleness }) {
  const [ref, inView] = useInView<HTMLDivElement>(0.3);
  const observed = staleness.buckets.reduce((sum, bucket) => sum + bucket.count, 0), max = Math.max(1, ...staleness.buckets.map(bucket => bucket.count));
  const older = staleness.buckets.filter(bucket => bucket.min >= 90).reduce((sum, bucket) => sum + bucket.count, 0);
  if (!observed) return <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">{staleness.coverage.note}</p>;
  return <div ref={ref}>
    <p className="text-base leading-7"><strong className="hero-figure text-3xl">{pf.format(older / observed)}</strong> <span className="text-muted-foreground">das {nf.format(observed)} matérias com histórico observado estão <b className="text-foreground">sem movimentação observada há mais de 90 dias</b>.</span></p>
    <ul className="mt-5 space-y-3" aria-label="Matérias principais por tempo desde a última movimentação observada">
      {staleness.buckets.map((bucket, index) => <li key={bucket.key} className="grid grid-cols-[8.5rem_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[9.5rem_minmax(0,1fr)]" title={`${bucket.label}: ${nf.format(bucket.count)} matérias (${pf.format(bucket.share)})`}>
        <span className="text-sm text-muted-foreground">{bucket.label}</span>
        <div className="flex items-center gap-3">
          <div className="h-5 rounded-r-[4px] transition-[width] duration-[900ms] ease-out" style={{ width: inView ? `${Math.max(bucket.count ? 1.5 : 0, (bucket.count / max) * 100)}%` : '0%', background: RAMP[index], maxWidth: 'calc(100% - 5.5rem)', transitionDelay: `${index * 80}ms` }} role="img" aria-label={`${bucket.label}: ${nf.format(bucket.count)} matérias`} />
          <span className="shrink-0 text-sm font-bold tabular-nums">{nf.format(bucket.count)} <span className="text-xs font-normal text-muted-foreground">{pf.format(bucket.share)}</span></span>
        </div>
      </li>)}
    </ul>
    <p className="mt-5 text-xs leading-5 text-muted-foreground">Contado até {formatDate(staleness.asOf)}, o último registro publicado. {nf.format(staleness.withHistory)} de {nf.format(staleness.universe)} matérias principais têm evento datado publicado; {nf.format(staleness.withoutHistory)} não têm e ficam fora. {staleness.closed ? `${nf.format(staleness.closed)} já encerradas por situação oficial também ficam fora. ` : ''}A ausência de movimento observado não indica, por si só, que a matéria esteja parada.</p>
  </div>;
}
