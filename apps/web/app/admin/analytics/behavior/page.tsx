import Link from 'next/link';
import { getTopPaths, getTopParliamentarians, getAvgTimeOnPage, getNavigationFlow } from '@/lib/analytics/data';
import { analyticsPool } from '@/lib/analytics/db';
import { int, formatDuration, parseUf, type SearchParams } from '@/lib/analytics/format';

export default async function AdminAnalyticsBehaviorPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const uf = parseUf(await searchParams);

  const [topPaths, topParliamentarians, avgTime, flow] = await Promise.all([
    getTopPaths(analyticsPool, { uf, days: 30 }, 15),
    getTopParliamentarians(analyticsPool, { uf, days: 30 }, 15),
    getAvgTimeOnPage(analyticsPool, { uf, days: 30 }, 15),
    getNavigationFlow(analyticsPool, { uf, days: 30 }, 15),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="text-lg font-black">Páginas mais visitadas</h2>
          <ol className="mt-3 divide-y">
            {topPaths.map((row, i) => (
              <li key={row.path} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-5 shrink-0 text-right text-xs text-muted-foreground">{i + 1}</span>
                <Link href={row.path} className="min-w-0 flex-1 truncate font-semibold text-primary underline-offset-2 hover:underline">{row.path}</Link>
                <strong className="tabular-nums">{int.format(row.views)}</strong>
              </li>
            ))}
            {!topPaths.length && <li className="py-4 text-sm text-muted-foreground">Sem dados no período.</li>}
          </ol>
        </section>

        <section className="rounded-2xl border bg-card p-5">
          <h2 className="text-lg font-black">Tempo médio na página</h2>
          <p className="mt-1 text-xs text-muted-foreground">Intervalo até o próximo pageview da mesma sessão — a última página de cada sessão não entra na média.</p>
          <ol className="mt-3 divide-y">
            {avgTime.map((row, i) => (
              <li key={row.path} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-5 shrink-0 text-right text-xs text-muted-foreground">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{row.path}</span>
                <strong className="tabular-nums">{formatDuration(row.avgSeconds)}</strong>
              </li>
            ))}
            {!avgTime.length && <li className="py-4 text-sm text-muted-foreground">Sem dados no período.</li>}
          </ol>
        </section>
      </div>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="text-lg font-black">Fluxo de navegação</h2>
        <p className="mt-1 text-xs text-muted-foreground">Transições mais comuns de uma página pra outra, dentro da mesma sessão.</p>
        <ol className="mt-3 divide-y">
          {flow.map((row, i) => (
            <li key={`${row.fromPath}>${row.toPath}`} className="flex items-center gap-3 py-2 text-sm">
              <span className="w-5 shrink-0 text-right text-xs text-muted-foreground">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate"><span className="font-semibold">{row.fromPath}</span> <span className="text-muted-foreground">→</span> <span className="font-semibold">{row.toPath}</span></span>
              <strong className="tabular-nums">{int.format(row.n)}</strong>
            </li>
          ))}
          {!flow.length && <li className="py-4 text-sm text-muted-foreground">Sem dados no período.</li>}
        </ol>
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="text-lg font-black">Perfis de parlamentar mais vistos</h2>
        <ol className="mt-3 divide-y">
          {topParliamentarians.map((row, i) => (
            <li key={`${row.source}:${row.externalId}`} className="flex items-center gap-3 py-2 text-sm">
              <span className="w-5 shrink-0 text-right text-xs text-muted-foreground">{i + 1}</span>
              <Link href={`/parlamentares/${row.source}/${row.externalId}`} className="min-w-0 flex-1 truncate font-semibold text-primary underline-offset-2 hover:underline">{row.name}</Link>
              <span className="text-xs text-muted-foreground">{row.party}-{row.uf}</span>
              <strong className="w-10 text-right tabular-nums">{int.format(row.views)}</strong>
            </li>
          ))}
          {!topParliamentarians.length && <li className="py-4 text-sm text-muted-foreground">Sem dados no período.</li>}
        </ol>
      </section>
    </div>
  );
}
