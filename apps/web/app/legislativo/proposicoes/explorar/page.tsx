import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Compass, Filter, Search, Users } from 'lucide-react';
import type { Source } from '@senadotracker/domain';
import { propositionListing, propositionResultComposition, roster } from '@/lib/data';
import { GROUPS, groupMeta, houseShort, nf, pf } from '@/lib/proposicoes/taxonomy';
import { OTHER_KEY, composeEntries } from '@/lib/proposicoes/composition';
import { LegislativeSubnav } from '@/components/legislative-subnav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { EmptyState } from '@/components/empty-state';
import { ResultsComposition } from '@/components/proposicoes/results-composition';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Explorar proposições', description: 'Pesquise proposições por número, ementa, tema, tipo ou autoria, usando somente registros oficiais publicados.' };

type Params = Record<string, string | string[] | undefined>;
const scalar = (value: string | string[] | undefined) => (typeof value === 'string' ? value : undefined);
const date = (value: string | null) => (value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(value)) : 'Data não publicada');
const detailHref = (source: Source, id: string) => `/legislativo/proposicoes/${source}/${encodeURIComponent(id)}`;
const EXPLORE = '/legislativo/proposicoes/explorar';

export default async function ExplorePage({ searchParams }: { searchParams: Promise<Params> }) {
  const q = await searchParams;
  const search = scalar(q.q)?.trim() || undefined, sourceValue = scalar(q.casa), source: Source | undefined = sourceValue === 'camara' || sourceValue === 'senado' ? sourceValue : undefined;
  const type = scalar(q.tipo) || undefined, group = scalar(q.grupo) || undefined, theme = scalar(q.tema)?.trim() || undefined, author = scalar(q.autor)?.trim() || undefined;
  const year = Number(scalar(q.ano)), validYear = Number.isInteger(year) && year > 0 ? year : undefined, page = Math.max(1, Number(scalar(q.pagina) ?? 1));
  const filters = { ...(search ? { search } : {}), ...(source ? { source } : {}), ...(type ? { type } : {}), ...(theme ? { theme } : {}), ...(author ? { author } : {}), ...(validYear ? { year: validYear } : {}) };
  const response = await propositionListing({ page, pageSize: 12, ...filters, ...(group ? { group } : {}) });
  if (response.status === 'unavailable') return <><LegislativeSubnav /><main className="page-shell py-12"><EmptyState title="Exploração indisponível" description={response.message} /></main></>;
  const { result } = response.data;
  const composition = await propositionResultComposition(filters);
  const entries = composition.status === 'available' ? composeEntries(composition.data.groups.map(item => ({ ...item, topTypes: [] })), composition.data.total) : [];
  const params: Record<string, string | undefined> = { q: search, casa: source, tipo: type, grupo: group, ano: validYear ? String(validYear) : undefined, tema: theme, autor: author };
  const hrefWith = (overrides: Record<string, string | undefined>, pageNumber = 1) => {
    const next = new URLSearchParams();
    Object.entries({ ...params, ...overrides }).forEach(([key, value]) => { if (value) next.set(key, value); });
    if (pageNumber > 1) next.set('pagina', String(pageNumber));
    const text = next.toString();
    return text ? `${EXPLORE}?${text}` : EXPLORE;
  };
  const groupHrefs = Object.fromEntries(GROUPS.map(meta => [meta.key, hrefWith({ grupo: group === meta.key ? undefined : meta.key })]));
  const selectedKey = group ? (groupMeta(group).tail ? OTHER_KEY : group) : null;
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const people = author ? null : await roster({ search: search ?? '', page: 1, pageSize: 5, ...(source ? { source } : {}) });
  const filtered = Boolean(search || author || theme || source || type || group || validYear);
  return <>
    <LegislativeSubnav />
    <main id="conteudo" className="hero-wash" tabIndex={-1}>
      <div className="page-shell py-12 sm:py-16">
        <header className="max-w-3xl">
          <p className="eyebrow">Busca legislativa</p>
          <h1 className="prop-thesis mt-4 text-[clamp(2.3rem,5vw,4rem)]">Encontre uma <em>matéria</em>.</h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">Pesquise por número, ementa, tema, tipo ou autoria. A busca usa somente registros oficiais publicados.</p>
        </header>
        <form className="card-elevated mt-9 rounded-3xl border bg-card p-5 sm:p-6" role="search" action={EXPLORE}>
          <div className="flex flex-col gap-3 sm:flex-row"><Input name="q" defaultValue={search ?? ''} placeholder="Ex.: PL 179/2026, saúde, educação básica ou nome de parlamentar" aria-label="Buscar proposições" autoComplete="off" /><Button className="sm:w-auto"><Search size={16} aria-hidden="true" />Buscar</Button></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <NativeSelect name="casa" defaultValue={source ?? ''} aria-label="Casa"><option value="">Todas as Casas</option><option value="camara">Câmara</option><option value="senado">Senado</option></NativeSelect>
            <NativeSelect name="grupo" defaultValue={group ?? ''} aria-label="Função"><option value="">Todas as funções</option>{GROUPS.map(meta => <option key={meta.key} value={meta.key}>{meta.verb} ({meta.label})</option>)}</NativeSelect>
            <Input name="autor" defaultValue={author ?? ''} placeholder="Autor parlamentar" aria-label="Autor parlamentar" /><Input name="tema" defaultValue={theme ?? ''} placeholder="Tema direto publicado" aria-label="Tema" />
          </div>
          <details className="mt-4"><summary className="focus-ring flex w-fit cursor-pointer items-center gap-2 text-sm font-bold"><Filter size={16} aria-hidden="true" />Filtros avançados</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2"><NativeSelect name="tipo" defaultValue={type ?? ''} aria-label="Tipo"><option value="">Todos os tipos</option>{result.facets.types.map(value => <option key={value}>{value}</option>)}</NativeSelect><Input name="ano" inputMode="numeric" defaultValue={validYear ?? ''} placeholder="Ano" aria-label="Ano" /></div></details>
        </form>
        {!filtered ? <section className="mt-8 grid gap-4 md:grid-cols-3" aria-label="Por onde começar">
          <Discovery title="Por assunto" text="Proposições com tema Saúde na cobertura disponível" href={hrefWith({ tema: 'Saúde' })} />
          <Discovery title="Por tipo de atividade" text="Requerimentos, emendas e pareceres" href={hrefWith({ grupo: 'requerimentos' })} />
          <Discovery title="Câmara e Senado" text="Escolha a Casa para começar sua exploração" href={hrefWith({ casa: 'camara' })} />
        </section> : null}
        {author && people?.status === 'available' ? <section className="mt-6 rounded-2xl border bg-card p-4"><h2 className="flex items-center gap-2 font-bold"><Users size={17} aria-hidden="true" />Parlamentares encontrados</h2>
          <div className="mt-3 flex flex-wrap gap-2">{people.data.result.items.slice(0, 5).map((person: any) => <Link key={person.externalId} className="focus-ring rounded-full border px-3 py-2 text-sm hover:bg-muted" href={hrefWith({ autor: person.name })}>{person.name} · {houseShort(person.source)}{person.party ? ` · ${person.party}` : ''} · Ver proposições deste parlamentar</Link>)}</div></section> : null}

        <section className="mt-12" aria-labelledby="resultados-titulo">
          <div className="flex flex-wrap items-end justify-between gap-4"><div>
            <p className="text-sm text-muted-foreground">{nf.format(result.total)} resultados</p><h2 id="resultados-titulo" className="prop-h2 text-3xl">Resultados da busca</h2>
            {theme ? <p className="mt-1 text-sm text-muted-foreground">Proposições com tema {theme} na cobertura disponível.</p> : null}</div>
            <Link className="focus-ring text-sm font-bold text-primary underline underline-offset-4" href="/legislativo/proposicoes">Ver panorama</Link></div>
          {entries.length ? <div className="mt-6 rounded-3xl border bg-card p-5 sm:p-6">
            <p className="text-sm font-semibold">Como esses resultados se distribuem por função <span className="font-normal text-muted-foreground">· clique para filtrar</span></p>
            <ResultsComposition className="mt-4" entries={entries} hrefs={groupHrefs} clearHref={hrefWith({ grupo: undefined })} selectedKey={selectedKey} total={composition.status === 'available' ? composition.data.total : 0} />
            <nav aria-label="Filtrar por função" className="mt-4"><ul className="flex flex-wrap gap-2">{entries.filter(entry => entry.key !== OTHER_KEY).map(entry => <li key={entry.key}><Link href={groupHrefs[entry.key]!} aria-current={group === entry.key ? 'true' : undefined} className={`focus-ring inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted ${group === entry.key ? 'bg-muted ring-1 ring-primary/40' : ''}`}><i className="size-2.5 rounded-sm" style={{ background: entry.color }} aria-hidden="true" />{entry.verb}<span className="tabular-nums text-muted-foreground">{nf.format(entry.count)} · {pf.format(entry.share)}</span></Link></li>)}</ul></nav>
          </div> : null}
          {result.items.length
            ? <div className="mt-6 grid gap-4">{result.items.map((item: any) => {
              const accessory = Boolean(item.proposal.principalProposalId), meta = groupMeta(item.proposal.functionalGroup);
              return <article key={`${item.proposal.source}:${item.proposal.externalId}`} className={`card-lift rounded-2xl border bg-card ${accessory ? 'p-4' : 'p-5 sm:p-6'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 normal-case tracking-normal text-foreground"><i className="size-2.5 rounded-sm" style={{ background: meta.color }} aria-hidden="true" />{meta.verb}</span>
                    <span>{item.proposal.type} · {houseShort(item.proposal.source)}</span></p>
                  <Link className={`${accessory ? 'text-lg' : 'text-2xl'} focus-ring font-display mt-2 block font-medium text-primary underline decoration-primary/30 underline-offset-4`} href={detailHref(item.proposal.source, item.proposal.externalId)}>{item.proposal.label}</Link></div>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">{date(item.proposal.presentedAt)}</span></div>
                {accessory && item.principalProposal
                  ? <div className="mt-2 text-sm"><span className="font-semibold">Sobre {item.principalProposal.label}</span>{item.principalProposal.summary ? <p className="mt-1 line-clamp-2 text-muted-foreground">{item.principalProposal.summary}</p> : null}<Link className="focus-ring mt-2 inline-block font-bold text-primary underline" href={detailHref(item.proposal.source, item.proposal.principalProposalId)}>Ver matéria principal →</Link></div>
                  : <p className="mt-3 leading-7">{item.proposal.summary ?? 'Ementa não publicada.'}</p>}
                {!accessory ? <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground"><span>Autoria: {item.authors.slice(0, 2).map((a: any) => a.name).join(', ') || 'não publicada'}</span>{item.themes[0] ? <span>Tema: {item.themes[0]}</span> : null}{item.proposal.status ? <span>Situação: {item.proposal.status}</span> : null}</div> : null}
              </article>;
            })}</div>
            : <div className="mt-6"><EmptyState title="Nenhuma correspondência encontrada" description="Remova filtros, busque o termo na ementa ou volte à descoberta. Temas só aparecem quando publicados na cobertura disponível." /></div>}
          {result.total > result.pageSize ? <nav className="mt-8 flex items-center justify-between gap-4" aria-label="Paginação">
            {page > 1 ? <Link className="focus-ring rounded-full border bg-card px-4 py-2 text-sm font-bold text-primary hover:bg-muted" href={hrefWith({}, page - 1)}>← Anterior</Link> : <span className="rounded-full border px-4 py-2 text-sm font-bold text-muted-foreground/60" aria-disabled="true">← Anterior</span>}
            <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
            {page < totalPages ? <Link className="focus-ring rounded-full border bg-card px-4 py-2 text-sm font-bold text-primary hover:bg-muted" href={hrefWith({}, page + 1)}>Próxima →</Link> : <span className="rounded-full border px-4 py-2 text-sm font-bold text-muted-foreground/60" aria-disabled="true">Próxima →</span>}</nav> : null}
        </section>
      </div>
    </main>
  </>;
}

function Discovery({ title, text, href }: { title: string; text: string; href: string }) {
  return <Link href={href} className="card-lift focus-ring group block rounded-2xl border bg-card p-5"><span className="grid size-10 place-items-center rounded-xl bg-secondary text-primary"><Compass size={20} aria-hidden="true" /></span><h2 className="mt-4 font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary">Explorar <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></span></Link>;
}
