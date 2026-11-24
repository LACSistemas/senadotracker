import { getAnalyticsKpis, getDailyTrend } from '@/lib/analytics/data';
import { analyticsPool } from '@/lib/analytics/db';
import { TrendChart } from '@/components/analytics/trend-chart';
import { int, pct, decimal1, parseUf, type SearchParams } from '@/lib/analytics/format';

export default async function AdminAnalyticsOverviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const uf = parseUf(await searchParams);

  const [kpis, trend] = await Promise.all([
    getAnalyticsKpis(analyticsPool, { uf, days: 30 }),
    getDailyTrend(analyticsPool, { uf, days: 30 }),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Pageviews</p>
          <p className="mt-1 text-3xl font-black tabular-nums">{int.format(kpis.pageviews)}</p>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Sessões únicas</p>
          <p className="mt-1 text-3xl font-black tabular-nums">{int.format(kpis.sessions)}</p>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Taxa de rejeição</p>
          <p className="mt-1 text-3xl font-black tabular-nums">{kpis.bounceRate != null ? pct.format(kpis.bounceRate) : '—'}</p>
          <p className="mt-1 text-xs text-muted-foreground">Sessões com só 1 pageview</p>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Páginas por sessão</p>
          <p className="mt-1 text-3xl font-black tabular-nums">{kpis.pagesPerSession != null ? decimal1.format(kpis.pagesPerSession) : '—'}</p>
        </div>
      </div>

      <TrendChart data={trend} />
    </div>
  );
}
