import { getTopReferrers, getEntryExitPages } from '@/lib/analytics/data';
import { analyticsPool } from '@/lib/analytics/db';
import { int, parseUf, type SearchParams } from '@/lib/analytics/format';

export default async function AdminAnalyticsAcquisitionPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const uf = parseUf(await searchParams);

  const [topReferrers, entryExit] = await Promise.all([
    getTopReferrers(analyticsPool, { uf, days: 30 }, 10),
    getEntryExitPages(analyticsPool, { uf, days: 30 }, 10),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="text-lg font-black">De onde vem o tráfego</h2>
        <p className="mt-1 text-xs text-muted-foreground">Por sessão (origem não muda em navegação interna pelo site).</p>
        <ol className="mt-3 divide-y">
          {topReferrers.map((row, i) => (
            <li key={row.referrerDomain} className="flex items-center gap-3 py-2 text-sm">
              <span className="w-5 shrink-0 text-right text-xs text-muted-foreground">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{row.referrerDomain}</span>
              <strong className="tabular-nums">{int.format(row.sessions)}</strong>
            </li>
          ))}
          {!topReferrers.length && <li className="py-4 text-sm text-muted-foreground">Sem dados no período.</li>}
        </ol>
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="text-lg font-black">Páginas de entrada</h2>
        <p className="mt-1 text-xs text-muted-foreground">Primeira página vista em cada sessão.</p>
        <ol className="mt-3 divide-y">
          {entryExit.entry.map((row, i) => (
            <li key={row.path} className="flex items-center gap-3 py-2 text-sm">
              <span className="w-5 shrink-0 text-right text-xs text-muted-foreground">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{row.path}</span>
              <strong className="tabular-nums">{int.format(row.sessions)}</strong>
            </li>
          ))}
          {!entryExit.entry.length && <li className="py-4 text-sm text-muted-foreground">Sem dados no período.</li>}
        </ol>
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="text-lg font-black">Páginas de saída</h2>
        <p className="mt-1 text-xs text-muted-foreground">Última página vista em cada sessão.</p>
        <ol className="mt-3 divide-y">
          {entryExit.exit.map((row, i) => (
            <li key={row.path} className="flex items-center gap-3 py-2 text-sm">
              <span className="w-5 shrink-0 text-right text-xs text-muted-foreground">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{row.path}</span>
              <strong className="tabular-nums">{int.format(row.sessions)}</strong>
            </li>
          ))}
          {!entryExit.exit.length && <li className="py-4 text-sm text-muted-foreground">Sem dados no período.</li>}
        </ol>
      </section>
    </div>
  );
}
