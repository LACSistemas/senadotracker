import { getVoteMatchFunnel } from '@/lib/analytics/data';
import { analyticsPool } from '@/lib/analytics/db';
import { int, parseUf, type SearchParams } from '@/lib/analytics/format';

export default async function AdminAnalyticsProductPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const uf = parseUf(await searchParams);
  const voteMatchFunnel = await getVoteMatchFunnel(analyticsPool, { uf, days: 30 });

  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="text-lg font-black">Funil — &ldquo;Qual parlamentar vota como você?&rdquo;</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {(['senado', 'camara'] as const).map(house => {
          const f = voteMatchFunnel[house];
          const rate = f.started > 0 ? Math.round((f.completed / f.started) * 100) : null;
          return (
            <div key={house} className="rounded-xl border p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{house === 'senado' ? 'Senado Federal' : 'Câmara dos Deputados'}</p>
              <div className="mt-2 flex items-baseline gap-4">
                <div><p className="text-2xl font-black tabular-nums">{int.format(f.started)}</p><p className="text-xs text-muted-foreground">começaram</p></div>
                <div><p className="text-2xl font-black tabular-nums">{int.format(f.completed)}</p><p className="text-xs text-muted-foreground">concluíram</p></div>
                <div><p className="text-2xl font-black tabular-nums">{rate != null ? `${rate}%` : '—'}</p><p className="text-xs text-muted-foreground">taxa de conclusão</p></div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
