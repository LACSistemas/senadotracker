import Link from 'next/link';
import { getTopUfs, getTopCities, getDeviceBreakdown } from '@/lib/analytics/data';
import { analyticsPool } from '@/lib/analytics/db';
import { UF_NAMES, int, deviceLabel, parseUf, type SearchParams } from '@/lib/analytics/format';

function pageUrl(uf: string | null) {
  return uf ? `/admin/analytics/audience?uf=${uf}` : '/admin/analytics/audience';
}

export default async function AdminAnalyticsAudiencePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const uf = parseUf(await searchParams);

  const [topUfs, topCities, devices] = await Promise.all([
    getTopUfs(analyticsPool, { days: 30 }, 27),
    getTopCities(analyticsPool, { uf, days: 30 }, 15),
    getDeviceBreakdown(analyticsPool, { uf, days: 30 }),
  ]);
  const deviceTotal = devices.reduce((sum, d) => sum + d.sessions, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="text-lg font-black">Visitantes por UF {uf && <span className="font-normal text-muted-foreground">(clique para trocar)</span>}</h2>
        <p className="mt-1 text-xs text-muted-foreground">Clique numa UF pra ver só o que a galera de lá mais acessa.</p>
        <ol className="mt-3 max-h-96 divide-y overflow-y-auto">
          {topUfs.map((row, i) => (
            <li key={row.uf} className="flex items-center gap-3 py-2 text-sm">
              <span className="w-5 shrink-0 text-right text-xs text-muted-foreground">{i + 1}</span>
              <Link href={pageUrl(row.uf)} className={`min-w-0 flex-1 truncate font-semibold underline-offset-2 hover:underline ${uf === row.uf ? 'text-primary' : ''}`}>
                {UF_NAMES[row.uf] ?? row.uf} <span className="text-xs text-muted-foreground">({row.uf})</span>
              </Link>
              <span className="tabular-nums text-xs text-muted-foreground">{int.format(row.sessions)} sessões</span>
              <strong className="w-14 text-right tabular-nums">{int.format(row.views)}</strong>
            </li>
          ))}
          {!topUfs.length && <li className="py-4 text-sm text-muted-foreground">Sem dados no período.</li>}
        </ol>
      </section>

      <div className="space-y-6">
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="text-lg font-black">Cidades{uf && <span className="font-normal text-muted-foreground"> — em {uf}</span>}</h2>
          <p className="mt-1 text-xs text-muted-foreground">Mesma base GeoIP da UF, num nível mais fino.</p>
          <ol className="mt-3 max-h-80 divide-y overflow-y-auto">
            {topCities.map((row, i) => (
              <li key={`${row.city}-${row.uf}`} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-5 shrink-0 text-right text-xs text-muted-foreground">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{row.city} <span className="text-xs text-muted-foreground">({row.uf})</span></span>
                <span className="tabular-nums text-xs text-muted-foreground">{int.format(row.sessions)} sessões</span>
                <strong className="w-14 text-right tabular-nums">{int.format(row.views)}</strong>
              </li>
            ))}
            {!topCities.length && <li className="py-4 text-sm text-muted-foreground">Sem dados no período.</li>}
          </ol>
        </section>

        <section className="rounded-2xl border bg-card p-5">
          <h2 className="text-lg font-black">Dispositivo</h2>
          <ol className="mt-3 space-y-3">
            {devices.map(row => {
              const share = deviceTotal > 0 ? row.sessions / deviceTotal : 0;
              return (
                <li key={row.device}>
                  <div className="mb-1 flex items-center justify-between text-sm"><span className="font-semibold">{deviceLabel(row.device)}</span><strong className="tabular-nums">{int.format(row.sessions)}</strong></div>
                  <div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-chart-1" style={{ width: `${Math.round(share * 100)}%` }} /></div>
                </li>
              );
            })}
            {!devices.length && <li className="py-4 text-sm text-muted-foreground">Sem dados no período.</li>}
          </ol>
        </section>
      </div>
    </div>
  );
}
