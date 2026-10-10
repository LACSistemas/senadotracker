import Link from 'next/link';
import type { DataCoverage } from '@senadotracker/domain';
import { listStateLegislators } from '@/lib/state-product';
import { getStateHouseStory } from '@/lib/state-house-story';
import { stateHouseName } from '@/components/state-profile-ui';
import { StateHouseStoryView } from '@/components/state-house-story';
import { LegislativeSubnav } from '@/components/legislative-subnav';
import { InstitutionHero } from '@/components/heroes';
import { SearchBar, FilterBar } from '@/components/data-controls';
import { DataTable, type DataColumn } from '@/components/data-table';
import { OfficialPortrait } from '@/components/app-image';
import { PartyLogo } from '@/components/party-logo';
import { brl, count } from '@/lib/format';

type Row = Awaited<ReturnType<typeof listStateLegislators>>[number] & { proposals: number | null; spendCents: number | null };
const scalar = (value: string | string[] | undefined) => typeof value === 'string' ? value : undefined;
const coverage: DataCoverage = { availability: 'available', source: 'multiple', period: { from: null, to: null, grain: 'snapshot' }, batchId: null, note: 'Cadastro corrente publicado pela Casa; partido é apresentado como publicado.', sampleSize: null };
const SORTS = { nome: 'Nome', proposicoes: 'Proposições', gasto: 'Gasto publicado' } as const;
type SortKey = keyof typeof SORTS;

export default async function StateHousePage({ house, searchParams }: { house: string; searchParams: Record<string, string | string[] | undefined> }) {
  const normalized = house.toUpperCase();
  const query = scalar(searchParams.busca)?.trim(), party = scalar(searchParams.partido);
  const requestedSort = scalar(searchParams.ordem), sort: SortKey = requestedSort && requestedSort in SORTS ? requestedSort as SortKey : 'nome';
  const parsed = Number(scalar(searchParams.pagina) ?? 1), page = Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1, pageSize = 24;

  const [roster, story] = await Promise.all([listStateLegislators(normalized), getStateHouseStory(normalized)]);
  const proposalsBy = story.proposals?.perMember, spendBy = story.finance && (story.finance.linkedValuePct ?? 0) >= 80 ? story.finance.perMember : null;
  const all: Row[] = roster.map(row => ({ ...row, proposals: proposalsBy ? proposalsBy[row.id] ?? 0 : null, spendCents: spendBy ? spendBy[row.id] ?? null : null }));
  const needle = query?.toLocaleLowerCase('pt-BR');
  const filtered = all.filter(row => (!needle || row.name.toLocaleLowerCase('pt-BR').includes(needle)) && (!party || row.party === party));
  const ordered = sort === 'nome' ? filtered : [...filtered].sort((a, b) => ((sort === 'proposicoes' ? b.proposals : b.spendCents) ?? -1) - ((sort === 'proposicoes' ? a.proposals : a.spendCents) ?? -1) || a.name.localeCompare(b.name, 'pt-BR'));
  const rows = ordered.slice((page - 1) * pageSize, page * pageSize);
  const parties = [...new Set(all.map(row => row.party).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const isDistrict = normalized === 'DF', title = isDistrict ? 'Deputados distritais' : 'Deputados estaduais';
  const noun = isDistrict ? 'deputados distritais' : 'deputados estaduais', singular = isDistrict ? 'um deputado distrital' : 'um deputado estadual';
  const context = isDistrict ? 'Câmara Legislativa do Distrito Federal' : `Assembleia Legislativa · ${normalized}`;
  const base = `/legislativo/estaduais/${normalized}/deputados`;
  const profileHref = (id: string) => `${base}/${encodeURIComponent(id)}`;
  const href = (next: { pagina?: number; ordem?: SortKey }) => {
    const q = new URLSearchParams(); const nextSort = next.ordem ?? sort;
    if (query) q.set('busca', query); if (party) q.set('partido', party); if (nextSort !== 'nome') q.set('ordem', nextSort); if ((next.pagina ?? 1) > 1) q.set('pagina', String(next.pagina));
    const text = q.toString(); return `${base}${text ? `?${text}` : ''}#parlamentares`;
  };

  const columns: DataColumn<Row>[] = [
    { key: 'person', header: 'Parlamentar', render: row => <div className="flex items-center gap-3"><div className="relative size-10 shrink-0 overflow-hidden rounded-full bg-muted"><OfficialPortrait src={row.photoUrl} name={row.name} sizes="40px" /></div><Link prefetch={false} href={profileHref(row.id)} className="font-bold text-primary underline-offset-2 hover:underline">{row.name}</Link></div> },
    { key: 'party', header: 'Partido', render: row => row.party ? <span className="inline-flex items-center gap-2"><PartyLogo party={row.party} size={24} />{row.party}</span> : <span className="text-muted-foreground">Não informado</span> },
    ...(proposalsBy ? [{ key: 'proposals', header: `Proposições ${story.proposals?.year ?? ''}`.trim(), align: 'right' as const, render: (row: Row) => <span className="tabular-nums">{row.proposals === null ? '—' : count(row.proposals)}</span> }] : []),
    ...(spendBy ? [{ key: 'spend', header: 'Gasto publicado', align: 'right' as const, render: (row: Row) => <span className="tabular-nums">{row.spendCents === null ? '—' : brl(row.spendCents)}</span> }] : []),
    { key: 'profile', header: 'Perfil', align: 'right', render: row => <Link prefetch={false} href={profileHref(row.id)} className="inline-flex rounded-full border px-3 py-1.5 text-sm font-bold text-primary hover:bg-primary/5">Ver perfil →</Link> },
  ];
  const sortOptions = (Object.keys(SORTS) as SortKey[]).filter(key => key === 'nome' || (key === 'proposicoes' && proposalsBy) || (key === 'gasto' && spendBy));

  return <><LegislativeSubnav /><main id="conteudo" className="page-shell space-y-12 py-8" data-testid="state-house-page">
    <InstitutionHero context={context} title={`${title} de ${stateHouseName(normalized)}`} description={story.seats ? `${count(story.seats.total)} ${noun} em exercício. Veja como a Casa se divide, o que ela produz e quanto custa, só com o que a própria Assembleia publica.` : 'Explore o cadastro corrente da Casa.'} location={`${normalized} · ${count(filtered.length)} no recorte atual`} actions={<div className="w-full max-w-xl rounded-2xl bg-white/95 p-3 text-foreground"><SearchBar action={base} defaultValue={query ?? ''} placeholder="Buscar parlamentar por nome" /></div>} />

    <StateHouseStoryView house={normalized} story={story} noun={noun} singular={singular} memberHref={profileHref} />

    <section id="parlamentares" className="section-hairline space-y-5 pt-8">
      <header className="max-w-3xl"><p className="eyebrow">Parlamentares</p><h2 className="display-title mt-2 text-3xl sm:text-5xl">{count(filtered.length)} {filtered.length === 1 ? 'parlamentar' : 'parlamentares'}{party ? ` do ${party}` : ''}</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Cadastro corrente publicado pela Casa. Proposições e gastos aparecem quando a Casa os publica e a identidade do parlamentar foi confirmada.</p></header>
      <FilterBar action={base} fields={[{ name: 'partido', label: 'Partido', value: party ?? '', options: [{ value: '', label: 'Todos' }, ...parties.map(value => ({ value, label: value }))] }]}><input type="hidden" name="busca" value={query ?? ''} /><input type="hidden" name="ordem" value={sort} /></FilterBar>
      {sortOptions.length > 1 && <nav aria-label="Ordenar lista" className="flex flex-wrap items-center gap-2 text-sm"><span className="text-muted-foreground">Ordenar por</span>{sortOptions.map(key => <Link key={key} prefetch={false} href={href({ ordem: key })} aria-current={sort === key ? 'true' : undefined} className={`rounded-full border px-3 py-1.5 font-bold ${sort === key ? 'bg-primary text-primary-foreground' : 'text-primary hover:bg-primary/5'}`}>{SORTS[key]}</Link>)}</nav>}
      <DataTable caption={title} columns={columns} rows={rows} rowKey={row => row.id} coverage={coverage} page={page} pageCount={Math.max(1, Math.ceil(filtered.length / pageSize))} pageHref={next => href({ pagina: next })} />
    </section>
  </main></>;
}
