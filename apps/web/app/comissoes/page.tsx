import Link from 'next/link';
import { ArrowRight, ArrowUpRight, CalendarDays, CircleOff, Gavel, ListChecks, Search } from 'lucide-react';
import { commissionDirectory, commissionOverview } from '@/lib/data';
import { HOUSE, houseOf, type HouseKey } from '@/lib/house';
import { InstitutionHero } from '@/components/heroes';
import { StatTile } from '@/components/commissions/stat-tile';
import { HouseBadge } from '@/components/commissions/house-badge';
import { MeetingCard } from '@/components/commissions/meeting-card';
import { CoverageNote } from '@/components/commissions/coverage-note';
import { ExplainerCard } from '@/components/content-cards';
import { Badge } from '@/components/ui/badge';
import { SearchBar } from '@/components/data-controls';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
const houses = ['SENADO', 'CAMARA', 'CONGRESSO'] as const;
const dateLabel = (date: string) => new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date.slice(0, 10)}T12:00:00Z`));
const timeLabel = (date: string | null) => date ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(/(?:Z|[+-]\d{2}:?\d{2})$/.test(date) ? date : `${date}-03:00`)) : null;

type Directory = Extract<ReturnType<typeof commissionDirectory>, { status: 'available' }>['data'];

function CommissionCard({ item }: { item: Directory['items'][number] }) {
  const info = houseOf(item.body.house);
  const Icon = info.icon;
  return (
    <article className="card-elevated group flex flex-col rounded-2xl border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/40">
      <div className="flex items-center justify-between gap-3">
        <span className={cn('grid size-9 place-items-center rounded-xl', info.soft)}>
          <Icon size={17} className={info.text} aria-hidden="true" />
        </span>
        <ArrowUpRight size={18} className="text-primary opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
      </div>
      <Link href={item.publicUrl} className="focus-ring mt-4 rounded-sm font-bold leading-snug hover:text-primary">
        <span className="line-clamp-2" title={item.body.name}>{item.body.name}</span>
      </Link>
      <div className="mt-2"><Badge className="bg-secondary text-primary">{item.body.sigla}</Badge></div>
      <div className="mt-auto space-y-2 pt-4">
        {item.metadata.map((m, index) => (
          <div key={m.label} className={index ? 'text-xs text-muted-foreground' : 'text-sm'}>
            {index === 0 && <p className="mb-1 text-xs text-muted-foreground">{m.label}</p>}
            <p className={index === 0 ? 'font-medium' : ''}>{m.date ? `${dateLabel(m.date)}${m.startAt ? ` · ${timeLabel(m.startAt)}` : ''}` : m.value}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

export default async function CommissionsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams ?? {};
  const scalar = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? '' : value ?? '';
  const query = scalar(params.q ?? params.busca).trim(), houseParam = scalar(params.house ?? params.casa).toUpperCase();
  const house = houses.find(h => h === houseParam) ?? 'ALL';
  const result = commissionDirectory({ house, query, page: Number(scalar(params.page)) || 1, pageSize: 24 });
  const overview = commissionOverview(3);
  if (result.status === 'unavailable') {
    return (
      <main className="page-shell py-12">
        <h1 className="text-3xl font-bold">Comissões</h1>
        <CoverageNote className="mt-4" icon={CircleOff}>Não foi possível carregar as comissões. Tente novamente em instantes.</CoverageNote>
      </main>
    );
  }
  const dir = result.data;
  const href = (selected: string, term = query, page = 1) => {
    const p = new URLSearchParams();
    if (selected !== 'ALL') p.set('house', selected.toLowerCase());
    if (term) p.set('q', term);
    if (page > 1) p.set('page', String(page));
    return `/comissoes${p.size ? `?${p}` : ''}#explorar`;
  };

  return (
    <main id="conteudo" tabIndex={-1}>
      <div className="page-shell py-8 sm:py-10">
        <InstitutionHero
          context="Comissões"
          title="Onde o trabalho legislativo ganha forma"
          description="Explore os colegiados da Câmara e do Senado e veja reuniões publicadas, matérias em pauta, composição e relatorias identificadas."
          imageUrl="/congresso.svg"
        />
      </div>

      <section className="page-shell pb-4">
        <p className="text-sm"><strong>{dir.counts.total} colegiados</strong> na cobertura atual</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {houses.filter(h => dir.counts[h] > 0).map(h => {
            const info = HOUSE[h as HouseKey];
            return (
              <StatTile
                key={h}
                icon={info.icon}
                iconClassName={cn(info.soft, info.text)}
                value={dir.counts[h]}
                label={info.label}
                action={<Link href={href(h, '')} className="focus-ring inline-flex items-center gap-1.5 rounded-sm text-xs font-bold text-primary hover:underline">Explorar {info.short} <ArrowRight size={13} aria-hidden="true" /></Link>}
              />
            );
          })}
        </div>
      </section>

      <section className="page-shell py-8" aria-labelledby="activity-title">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="activity-title" className="text-2xl font-bold">{overview.status === 'available' && overview.data.future ? 'Próximas reuniões' : 'Atividade recente'}</h2>
          <span className="text-xs text-muted-foreground">Reuniões publicadas na cobertura atual</span>
        </div>
        {overview.status === 'available' && overview.data.items.length > 0 ? (
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {overview.data.items.map(m => (
              <MeetingCard
                key={m.id}
                compact
                date={dateLabel(m.date)}
                time={timeLabel(m.startAt)}
                house={m.body.house}
                title={m.body.name}
                titleHref={`/comissoes/${encodeURIComponent(m.body.id)}`}
                subtitle={m.title ? <span className="line-clamp-1 text-xs font-normal text-muted-foreground" title={m.title}>{m.title}</span> : undefined}
                itemCount={m.itemCount}
              />
            ))}
          </div>
        ) : (
          <CoverageNote className="mt-4" icon={overview.status === 'unavailable' ? CircleOff : CalendarDays}>
            {overview.status === 'unavailable' ? 'Não foi possível carregar as reuniões neste momento.' : 'Nenhuma reunião publicada na cobertura atual.'}
          </CoverageNote>
        )}
        <Link href="/comissoes/agenda" className="focus-ring mt-4 inline-flex items-center gap-1.5 rounded-sm text-sm font-bold text-primary hover:underline">Ver agenda completa <ArrowRight size={14} aria-hidden="true" /></Link>
      </section>

      <section id="explorar" className="page-shell scroll-mt-6 py-8">
        <h2 className="text-2xl font-bold">Explorar comissões</h2>
        <div className="mt-4">
          <SearchBar action="/comissoes#explorar" defaultValue={query} name="q" label="Buscar comissão" placeholder="Buscar comissão por nome ou sigla">
            {house !== 'ALL' && <input type="hidden" name="house" value={house.toLowerCase()} />}
          </SearchBar>
        </div>
        <nav aria-label="Filtrar por Casa" className="mt-4 flex flex-wrap gap-2">
          {(['ALL', 'CAMARA', 'SENADO', ...(dir.counts.CONGRESSO ? ['CONGRESSO'] : [])] as const).map(h => {
            const active = house === h;
            const info = h === 'ALL' ? null : HOUSE[h as HouseKey];
            const Icon = info?.icon ?? Search;
            const count = h === 'ALL' ? dir.counts.total : dir.counts[h as typeof houses[number]];
            return (
              <Link
                key={h}
                href={href(h)}
                aria-current={active ? 'page' : undefined}
                className={cn('focus-ring inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold', active ? 'border-primary bg-primary text-primary-foreground' : 'hover:border-primary/50')}
              >
                {h !== 'ALL' && <Icon size={13} className={active ? 'text-primary-foreground' : info!.text} aria-hidden="true" />}
                {h === 'ALL' ? 'Todas' : info!.short}
                <Badge className={cn('border-0 px-1.5 py-0 text-[10px]', active ? 'bg-white/20 text-primary-foreground' : 'bg-muted')}>{count}</Badge>
              </Link>
            );
          })}
        </nav>
        <p className="mt-4 text-xs text-muted-foreground">{dir.total} {query ? 'colegiados encontrados' : 'colegiados disponíveis na cobertura atual'}</p>
        {dir.grouped ? (
          <div className="mt-6 grid gap-8 lg:grid-cols-2">
            {houses.filter(h => dir.counts[h]).map(h => {
              const info = HOUSE[h as HouseKey];
              return (
                <section key={h} aria-label={info.label}>
                  <div className="mb-4 flex items-center gap-2 border-b pb-3">
                    <HouseBadge house={h} />
                    <p className="text-xs text-muted-foreground">{dir.counts[h]} colegiados na cobertura atual</p>
                  </div>
                  <div className="grid gap-3">{dir.items.filter(item => item.body.house === h).map(item => <CommissionCard key={item.body.id} item={item} />)}</div>
                  <Link href={href(h, '')} className="focus-ring mt-4 inline-block rounded-sm text-sm font-semibold text-primary hover:underline">Ver todos os {dir.counts[h]} →</Link>
                </section>
              );
            })}
          </div>
        ) : (
          <>
            <div className="mt-5 grid gap-4 md:grid-cols-2">{dir.items.map(item => <CommissionCard key={item.body.id} item={item} />)}</div>
            {dir.items.length === 0 && <p className="py-8 text-sm text-muted-foreground">Nenhuma comissão encontrada. Tente outro nome ou sigla.</p>}
            {dir.pageCount > 1 && (
              <nav aria-label="Paginação" className="mt-5 flex flex-wrap gap-2">
                {Array.from({ length: dir.pageCount }, (_, i) => (
                  <Link key={i} href={href(house, query, i + 1)} aria-current={dir.page === i + 1 ? 'page' : undefined} className={cn('focus-ring rounded-lg border px-3 py-2 text-sm', dir.page === i + 1 && 'bg-primary text-primary-foreground')}>{i + 1}</Link>
                ))}
              </nav>
            )}
          </>
        )}
      </section>

      <section className="border-t bg-card">
        <div className="page-shell py-10">
          <h2 className="text-2xl font-bold">O que acontece dentro de uma comissão?</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <ExplainerCard icon={Gavel} title="Relatoria">Um parlamentar pode ser designado para relatar uma matéria.</ExplainerCard>
            <ExplainerCard icon={ListChecks} title="Pauta">Indica os itens publicados para uma reunião; estar em pauta não prova votação.</ExplainerCard>
            <ExplainerCard icon={CalendarDays} title="Reunião">Encontro do colegiado em que os itens publicados podem ser tratados.</ExplainerCard>
          </div>
          <div className="mt-6 flex flex-wrap gap-5 text-sm font-semibold text-primary">
            <Link href="/legislativo/proposicoes" className="focus-ring inline-flex items-center gap-1.5 rounded-sm hover:underline">Explorar proposições <ArrowRight size={14} aria-hidden="true" /></Link>
            <Link href="/comissoes/agenda" className="focus-ring inline-flex items-center gap-1.5 rounded-sm hover:underline">Ver agenda <ArrowRight size={14} aria-hidden="true" /></Link>
          </div>
        </div>
      </section>
    </main>
  );
}
