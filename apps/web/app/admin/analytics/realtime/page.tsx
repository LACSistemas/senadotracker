import { getRealtimeSnapshot } from '@/lib/analytics/data';
import { analyticsPool } from '@/lib/analytics/db';
import { AutoRefresh } from '@/components/analytics/auto-refresh';
import { UF_NAMES, deviceLabel, parseUf, type SearchParams } from '@/lib/analytics/format';

const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export default async function AdminAnalyticsRealtimePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const uf = parseUf(await searchParams);
  const { active, recent } = await getRealtimeSnapshot(analyticsPool, { uf });

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={15_000} />

      <div className="rounded-2xl border bg-card p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Ativos agora</p>
        <p className="mt-1 text-4xl font-black tabular-nums">{active}</p>
        <p className="mt-1 text-xs text-muted-foreground">Sessões com algum evento nos últimos 5 minutos · atualiza a cada 15s</p>
      </div>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="text-lg font-black">Atividade recente</h2>
        <p className="mt-1 text-xs text-muted-foreground">Últimos 30 minutos.</p>
        <ol className="mt-3 max-h-[32rem] divide-y overflow-y-auto">
          {recent.map((row, i) => (
            <li key={i} className="flex items-center gap-3 py-2 text-sm">
              <span className="w-16 shrink-0 text-xs tabular-nums text-muted-foreground">{timeFmt.format(new Date(row.occurred_at))}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{row.event_name === 'pageview' ? row.path : row.event_name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{row.city ? `${row.city}/${row.uf}` : row.uf ? UF_NAMES[row.uf] ?? row.uf : '—'}</span>
              <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">{row.device ? deviceLabel(row.device) : '—'}</span>
            </li>
          ))}
          {!recent.length && <li className="py-4 text-sm text-muted-foreground">Nenhum evento nos últimos 30 minutos.</li>}
        </ol>
      </section>
    </div>
  );
}
