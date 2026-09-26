import Link from 'next/link';
import { commissionDirectory, commissionOverview } from '@/lib/data';

export const dynamic = 'force-dynamic';
const houses = ['SENADO', 'CAMARA', 'CONGRESSO'] as const;
const institution = (house: string) => house === 'CAMARA' ? 'Câmara dos Deputados' : house === 'SENADO' ? 'Senado Federal' : 'Congresso Nacional';
const dateLabel = (date: string) => new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date.slice(0, 10)}T12:00:00Z`));
const timeLabel = (date: string | null) => date ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(/(?:Z|[+-]\d{2}:?\d{2})$/.test(date) ? date : `${date}-03:00`)) : null;
type Directory = Extract<ReturnType<typeof commissionDirectory>, { status: 'available' }>['data'];
function CommissionCard({ item }: { item: Directory['items'][number] }) {
  return <article className="group flex flex-col rounded-xl border border-border/70 bg-card/40 p-5 transition-colors hover:border-primary/40 hover:bg-card">
    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{institution(item.body.house)}</p>
    <Link href={item.publicUrl} className="mt-2 flex items-start justify-between gap-4 font-bold leading-snug hover:text-primary"><span className="line-clamp-2" title={item.body.name}>{item.body.name}</span><span aria-hidden="true" className="text-primary transition-transform group-hover:translate-x-1">↗</span></Link>
    <p className="mt-1 text-xs font-semibold text-primary">{item.body.sigla}</p>
    <div className="mt-auto pt-4">{item.metadata.map((m, index) => <div key={m.label} className={index ? 'mt-2 text-xs text-muted-foreground' : 'text-sm'}>{index === 0 && <p className="mb-1 text-xs text-muted-foreground">{m.label}</p>}<p className={index === 0 ? 'font-medium' : ''}>{m.date ? `${dateLabel(m.date)}${m.startAt ? ` · ${timeLabel(m.startAt)}` : ''}` : m.value}</p></div>)}</div>
  </article>;
}

export default async function CommissionsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams ?? {};
  const scalar = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? '' : value ?? '';
  const query = scalar(params.q ?? params.busca).trim(), houseParam = scalar(params.house ?? params.casa).toUpperCase();
  const house = houses.find(h => h === houseParam) ?? 'ALL';
  const result = commissionDirectory({ house, query, page: Number(scalar(params.page)) || 1, pageSize: 24 });
  const overview = commissionOverview(3);
  if (result.status === 'unavailable') return <main className="page-shell py-12"><h1 className="text-3xl font-bold">Comissões</h1><p className="mt-4">Não foi possível carregar as comissões. Tente novamente em instantes.</p></main>;
  const dir = result.data;
  const href = (selected: string, term = query, page = 1) => { const p = new URLSearchParams(); if (selected !== 'ALL') p.set('house', selected.toLowerCase()); if (term) p.set('q', term); if (page > 1) p.set('page', String(page)); return `/comissoes${p.size ? `?${p}` : ''}#explorar`; };
  return <main className="page-shell mx-auto !max-w-[1200px] space-y-8 py-8">
    <header>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Comissões</p>
      <h1 className="mt-2 max-w-3xl text-3xl font-black tracking-tight md:text-4xl">Onde o trabalho legislativo ganha forma</h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground md:text-base">Explore os colegiados da Câmara e do Senado e veja reuniões publicadas, matérias em pauta, composição e relatorias identificadas.</p>
      <p className="mt-5 text-sm"><strong>{dir.counts.total} colegiados</strong> na cobertura atual</p>
      <div className="mt-3 grid grid-cols-2 divide-x border-y py-4">
        {houses.filter(h => dir.counts[h] > 0).map((h, i) => <Link href={href(h, '')} key={h} className={`group flex flex-wrap items-center gap-x-5 gap-y-1 ${i ? 'pl-5 md:pl-8' : 'pr-5'}`}><span className="text-4xl font-light tracking-tight md:text-5xl">{dir.counts[h]}</span><span><span className="block text-sm font-semibold">{institution(h)}</span><span className="mt-1 block text-xs text-primary group-hover:underline">Explorar {h === 'CAMARA' ? 'Câmara' : h === 'SENADO' ? 'Senado' : 'Congresso'} →</span></span></Link>)}
      </div>
    </header>
    <section aria-labelledby="activity-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id="activity-title" className="text-xl font-bold">{overview.status === 'available' && overview.data.future ? 'Próximas reuniões' : 'Atividade recente'}</h2><span className="text-xs text-muted-foreground">Reuniões publicadas na cobertura atual</span></div>
      {overview.status === 'available' && overview.data.items.length > 0 ? <div className="mt-4 grid gap-4 md:grid-cols-3">{overview.data.items.map(m => <article key={m.id} className="rounded-xl border bg-muted/20 p-4"><p className="text-sm font-bold text-primary">{dateLabel(m.date)}<span className="ml-2 font-normal text-muted-foreground">{timeLabel(m.startAt) ?? 'Horário não informado'}</span></p><Link href={`/comissoes/${encodeURIComponent(m.body.id)}`} className="mt-3 block text-sm font-bold leading-snug hover:text-primary">{m.body.name}</Link><p className="mt-1 text-[11px] text-muted-foreground">{m.body.sigla} · {institution(m.body.house)}</p>{m.title && <p className="mt-3 line-clamp-1 text-xs" title={m.title}>{m.title}</p>}<p className="mt-1 text-xs text-muted-foreground">{m.itemCount} {m.itemCount === 1 ? 'item' : 'itens'} em pauta</p></article>)}</div> : <p className="mt-3 text-sm text-muted-foreground">{overview.status === 'unavailable' ? 'Não foi possível carregar as reuniões neste momento.' : 'Nenhuma reunião publicada na cobertura atual.'}</p>}
      <Link href="/comissoes/agenda" className="mt-3 inline-block text-xs font-semibold text-primary hover:underline">Ver agenda completa →</Link>
    </section>
    <section id="explorar" className="scroll-mt-6">
      <h2 className="text-2xl font-bold">Explorar comissões</h2>
      <form action="/comissoes#explorar" className="mt-4"><label htmlFor="commission-search" className="sr-only">Buscar comissão por nome ou sigla</label><input id="commission-search" name="q" defaultValue={query} placeholder="Buscar comissão por nome ou sigla" className="w-full rounded-xl border bg-card px-4 py-3 text-sm focus-visible:outline-2 focus-visible:outline-primary"/>{house !== 'ALL' && <input type="hidden" name="house" value={house.toLowerCase()}/>}</form>
      <nav aria-label="Filtrar por Casa" className="mt-3 flex flex-wrap gap-2">{(['ALL', 'CAMARA', 'SENADO', ...(dir.counts.CONGRESSO ? ['CONGRESSO'] : [])] as const).map(h => <Link key={h} href={href(h)} aria-current={house === h ? 'page' : undefined} className={`rounded-full border px-4 py-2 text-xs font-semibold ${house === h ? 'border-primary bg-primary text-primary-foreground' : 'hover:border-primary/50'}`}>{h === 'ALL' ? 'Todas' : h === 'CAMARA' ? 'Câmara' : h === 'SENADO' ? 'Senado' : 'Congresso'} <span className="ml-2 opacity-75">{h === 'ALL' ? dir.counts.total : dir.counts[h as typeof houses[number]]}</span></Link>)}</nav>
      <p className="mt-4 text-xs text-muted-foreground">{dir.total} {query ? 'colegiados encontrados' : 'colegiados disponíveis na cobertura atual'}</p>
      {dir.grouped ? <div className="mt-6 grid gap-8 lg:grid-cols-2">{houses.filter(h => dir.counts[h]).map(h => <section key={h} aria-label={institution(h)}><div className="mb-4 border-b pb-3"><h3 className="text-sm font-bold uppercase tracking-wider">{institution(h)}</h3><p className="mt-1 text-xs text-muted-foreground">{dir.counts[h]} colegiados na cobertura atual</p></div><div className="grid gap-3">{dir.items.filter(item => item.body.house === h).map(item => <CommissionCard key={item.body.id} item={item}/>)}</div><Link href={href(h, '')} className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">Ver todos os {dir.counts[h]} →</Link></section>)}</div> : <><div className="mt-5 grid gap-4 md:grid-cols-2">{dir.items.map(item => <CommissionCard key={item.body.id} item={item}/>)}</div>{dir.items.length === 0 && <p className="py-8 text-sm text-muted-foreground">Nenhuma comissão encontrada. Tente outro nome ou sigla.</p>}{dir.pageCount > 1 && <nav aria-label="Paginação" className="mt-5 flex flex-wrap gap-2">{Array.from({ length: dir.pageCount }, (_, i) => <Link key={i} href={href(house, query, i + 1)} aria-current={dir.page === i + 1 ? 'page' : undefined} className={`rounded-lg border px-3 py-2 text-sm ${dir.page === i + 1 ? 'bg-primary text-primary-foreground' : ''}`}>{i + 1}</Link>)}</nav>}</>}
    </section>
    <section className="border-t pt-7 pb-4"><h2 className="text-2xl font-bold">O que acontece dentro de uma comissão?</h2><div className="mt-5 grid gap-5 md:grid-cols-3">{[['Relatoria', 'Um parlamentar pode ser designado para relatar uma matéria.'], ['Pauta', 'Indica os itens publicados para uma reunião; estar em pauta não prova votação.'], ['Reunião', 'Encontro do colegiado em que os itens publicados podem ser tratados.']].map(([title, description]) => <div key={title}><h3 className="text-xs font-bold uppercase tracking-widest text-primary">{title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p></div>)}</div><div className="mt-5 flex gap-5 text-sm font-semibold text-primary"><Link href="/legislativo/proposicoes">Explorar proposições →</Link><Link href="/comissoes/agenda">Ver agenda →</Link></div></section>
  </main>;
}
