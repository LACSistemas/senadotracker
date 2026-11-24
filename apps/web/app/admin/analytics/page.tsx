import Link from 'next/link';
import { getAnalyticsKpis, getTopPaths, getTopUfs, getTopCities, getTopReferrers, getTopParliamentarians, getVoteMatchFunnel } from '../../../../../packages/db/src/postgres-analytics.ts';
import { analyticsPool } from '@/lib/analytics/db';

export const metadata = { title: 'Analytics' };

type Params = Record<string, string | string[] | undefined>;
const UF_NAMES: Record<string, string> = { AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MG: 'Minas Gerais', MS: 'Mato Grosso do Sul', MT: 'Mato Grosso', PA: 'Pará', PB: 'Paraíba', PE: 'Pernambuco', PI: 'Piauí', PR: 'Paraná', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RO: 'Rondônia', RR: 'Roraima', RS: 'Rio Grande do Sul', SC: 'Santa Catarina', SE: 'Sergipe', SP: 'São Paulo', TO: 'Tocantins' };
const int = new Intl.NumberFormat('pt-BR');

function pageUrl(uf: string | null) {
  return uf ? `/admin/analytics?uf=${uf}` : '/admin/analytics';
}

export default async function AdminAnalyticsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const ufRaw = params.uf;
  const uf = typeof ufRaw === 'string' && /^[A-Z]{2}$/.test(ufRaw) ? ufRaw : null;

  const [kpis, topPaths, topUfs, topCities, topReferrers, topParliamentarians, voteMatchFunnel] = await Promise.all([
    getAnalyticsKpis(analyticsPool, { uf, days: 30 }),
    getTopPaths(analyticsPool, { uf, days: 30 }, 15),
    getTopUfs(analyticsPool, { days: 30 }, 27),
    getTopCities(analyticsPool, { uf, days: 30 }, 15),
    getTopReferrers(analyticsPool, { uf, days: 30 }, 10),
    getTopParliamentarians(analyticsPool, { uf, days: 30 }, 15),
    getVoteMatchFunnel(analyticsPool, { uf, days: 30 }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="display-title text-2xl font-black">Visão geral — últimos 30 dias</h1>
        {uf && (
          <p className="mt-1 text-sm text-muted-foreground">
            Filtrado por visitantes de <strong>{UF_NAMES[uf] ?? uf}</strong> ·{' '}
            <Link href={pageUrl(null)} className="font-bold text-primary underline">limpar filtro</Link>
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Pageviews</p>
          <p className="mt-1 text-3xl font-black tabular-nums">{int.format(kpis.pageviews)}</p>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Sessões únicas</p>
          <p className="mt-1 text-3xl font-black tabular-nums">{int.format(kpis.sessions)}</p>
        </div>
      </div>

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
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="text-lg font-black">Cidades{uf && <span className="font-normal text-muted-foreground"> — em {uf}</span>}</h2>
          <p className="mt-1 text-xs text-muted-foreground">Mesma base GeoIP da UF, num nível mais fino.</p>
          <ol className="mt-3 max-h-96 divide-y overflow-y-auto">
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
      </div>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="text-lg font-black">Perfis de parlamentar mais vistos{uf && <span className="font-normal text-muted-foreground"> — visitantes de {uf}</span>}</h2>
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
    </div>
  );
}
