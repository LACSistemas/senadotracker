import Link from 'next/link';
import { ArrowRight, Banknote, Building2, FileText, Landmark, Users } from 'lucide-react';
import type { DataCoverage } from '@senadotracker/domain';
import type { StateHouseGlance, StateLegislatureOverview } from '@senadotracker/db';
import { LegislativeSubnav } from '@/components/legislative-subnav';
import { InstitutionHero } from '@/components/heroes';
import { KpiCard, KpiGrid } from '@/components/metrics';
import { PartyHemicycle } from '@/components/party-hemicycle';
import { mapMarkup } from '@/components/brazil-map-markup';
import { paintStateMap, type StatePaint } from '@/components/state-map-paint';
import { emptyFill, sequentialRamp } from '@/lib/scale';
import { partyColor } from '@/lib/party-colors';
import { count, percent } from '@/lib/format';
import { cn } from '@/lib/utils';

const DOMAINS = [
  ['IDENTITY', 'Cadastro'], ['LEGISLATIVE', 'Proposições'], ['FINANCE', 'Gastos'], ['PERSONNEL', 'Gabinete'], ['BUDGET_AMENDMENTS', 'Emendas'],
  ['TIMELINE', 'Tramitação'], ['PARTICIPATION', 'Presença'], ['VOTES', 'Votos'], ['RAPPORTEURSHIP', 'Relatorias'],
] as const;
const OK = new Set(['OPERATIONAL', 'AVAILABLE']);
/** Faixas fixas de dimensões publicadas (0–9): não são quintis, para o mapa não esconder que a maioria das Casas publica pouco. */
const BANDS = [[0, 2], [3, 4], [5, 6], [7, 8], [9, 9]] as const;
const bandOf = (value: number) => Math.max(0, BANDS.findIndex(([from, to]) => value >= from && value <= to));
const cov = (note: string, sampleSize: number | null = null): DataCoverage => ({ availability: 'available', source: 'multiple', period: { from: null, to: null, grain: 'snapshot' }, batchId: null, note, sampleSize });

function StatusCell({ status, label }: { status: string | undefined; label: string }) {
  const [glyph, text, tone] = !status ? ['·', 'sem informação', 'text-muted-foreground'] : OK.has(status) ? ['●', 'publica', 'text-primary'] : status === 'PARTIAL' ? ['◐', 'cobertura parcial', 'text-amber-700'] : status === 'NOT_APPLICABLE' ? ['–', 'não se aplica', 'text-muted-foreground'] : ['○', 'não publica', 'text-muted-foreground/60'];
  return <td className={cn('p-0 text-center align-middle text-lg leading-none', tone)} title={`${label}: ${text}`}><span aria-hidden="true" className="block py-2">{glyph}</span><span className="sr-only">{label}: {text}</span></td>;
}

function Section({ id, eyebrow, title, lede, children }: { id: string; eyebrow: string; title: string; lede?: string; children: React.ReactNode }) {
  return <section id={id} aria-labelledby={`${id}-t`} className="section-hairline space-y-6 pt-8">
    <header className="max-w-3xl"><p className="eyebrow">{eyebrow}</p><h2 id={`${id}-t`} className="display-title mt-2 text-3xl sm:text-5xl">{title}</h2>{lede && <p className="mt-3 text-base leading-7 text-muted-foreground">{lede}</p>}</header>
    {children}
  </section>;
}

export function StateLegislatureLanding({ data, glances }: { data: StateLegislatureOverview; glances: StateHouseGlance[] }) {
  const glanceOf = new Map(glances.map(item => [item.house, item]));
  const statusOf = new Map(data.coverageByHouse.map(item => [`${item.houseId}:${item.domain}`, item.status]));
  const published = (house: string) => DOMAINS.filter(([key]) => OK.has(statusOf.get(`${house}:${key}`) ?? '')).length;
  const houses = data.houses.map(house => ({ ...house, published: published(house.houseId), glance: glanceOf.get(house.houseId) }));
  const district = houses.find(item => item.houseId === 'DF')?.count ?? 0;
  const withFinance = houses.filter(item => OK.has(statusOf.get(`${item.houseId}:FINANCE`) ?? '')).length;
  const withLegislative = houses.filter(item => OK.has(statusOf.get(`${item.houseId}:LEGISLATIVE`) ?? '')).length;
  const names: Record<string, string> = Object.fromEntries(houses.map(item => [item.houseId, item.houseName]));

  const paints = new Map<string, StatePaint>(houses.map(item => {
    const band = bandOf(item.published), text = `${item.houseName}: ${count(item.count)} parlamentares · ${item.published} de ${DOMAINS.length} dimensões publicadas`;
    return [item.houseId, { fill: sequentialRamp[band]!, ...(band >= 3 ? { ink: '#fff' } : {}), href: `/legislativo/estaduais/${item.houseId}/deputados`, title: text, ariaLabel: text } satisfies StatePaint];
  }));
  const mapHtml = paintStateMap(mapMarkup, paints, { variant: 'metric-map', description: 'Cada estado recebe um tom conforme quantas das 9 dimensões a Assembleia publica. Clique para abrir a Casa.', emptyFill, href: uf => `/legislativo/estaduais/${uf}/deputados` });

  const aggregate = data.parties.map(party => ({ party: party.canonicalPartyCode, seats: party.count }));
  const noParty = data.unresolvedPartyCount > 0 ? [{ party: 'Sem partido', seats: data.unresolvedPartyCount }] : [];
  const hemicycle = { total: aggregate.reduce((sum, item) => sum + item.seats, 0) + data.unresolvedPartyCount, parties: [...aggregate, ...noParty] };
  const composition = houses.filter(item => item.glance?.seats?.total).map(item => ({ ...item, parties: item.glance!.seats!.parties, total: item.glance!.seats!.total }));

  return <>
    <LegislativeSubnav />
    <main id="conteudo" className="page-shell space-y-14 py-8" data-testid="state-legislature-landing">
      <InstitutionHero
        context="Legislativos subnacionais"
        title="O Legislativo estadual do Brasil"
        description="27 Casas, 27 realidades. Veja quem ocupa cada Assembleia, o que cada uma publica e onde os dados permitem ir mais longe."
        imageUrl="/congresso.svg"
        location="26 Assembleias Legislativas + Câmara Legislativa do Distrito Federal"
        actions={<div className="flex flex-wrap gap-3"><Link href="/legislativo/parlamentares?nivel=STATE_DEPUTY" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-primary">Explorar deputados <ArrowRight size={16} /></Link><Link href="#mapa" className="inline-flex items-center gap-2 rounded-full border border-white/35 px-5 py-3 text-sm font-bold text-white">Escolher uma Assembleia</Link></div>}
      />

      <KpiGrid>
        <KpiCard label="Parlamentares em exercício" value={count(data.total)} icon={Users} comparison={`${count(data.total - district)} estaduais e ${count(district)} distritais`} coverage={cov('Cadastro corrente publicado por cada Casa.', data.total)} />
        <KpiCard label="Casas legislativas" value="27" icon={Building2} comparison="26 Assembleias + CLDF" coverage={cov('Todas as unidades federativas.', 27)} />
        <KpiCard label="Casas com proposições" value={`${withLegislative} de 27`} icon={FileText} comparison={withLegislative < 27 ? `${27 - withLegislative} ainda sem publicação legível` : null} coverage={cov('Revisão legislativa ativa no Cívica.', 27)} />
        <KpiCard label="Casas com gastos publicados" value={`${withFinance} de 27`} icon={Banknote} comparison="Cada Casa usa regras e rubricas próprias" coverage={cov('Revisão financeira ativa no Cívica.', 27)} />
      </KpiGrid>

      <Section id="mapa" eyebrow="1 · Onde olhar" title="Quanto cada Assembleia permite enxergar" lede="O tom mostra quantas das 9 dimensões (cadastro, proposições, gastos, gabinete, emendas, tramitação, presença, votos e relatorias) a Casa publica. É um mapa de transparência dos dados, não de qualidade do mandato.">
        <figure className="min-w-0 rounded-3xl border bg-card p-4 shadow-sm sm:p-6">
          <figcaption className="sr-only">Mapa do Brasil com o número de dimensões publicadas por Assembleia</figcaption>
          <div className="mx-auto max-w-[620px]" dangerouslySetInnerHTML={{ __html: mapHtml }} />
          <ul className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            {BANDS.map(([from, to], index) => <li key={index} className="flex items-center gap-2"><i className="size-3 rounded-sm" style={{ background: sequentialRamp[index] }} />{from === to ? `${from}` : `${from} a ${to}`} dimensões · {houses.filter(item => bandOf(item.published) === index).length} Casas</li>)}
          </ul>
          <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">Mais dimensões publicadas permitem mais comparações, mas só dentro de cada Casa: as Assembleias não usam os mesmos critérios.</p>
        </figure>
      </Section>

      <Section id="matriz" eyebrow="2 · O que cada Casa publica" title="Nenhuma Assembleia mostra tudo, e nenhuma é igual a outra" lede="● publica · ◐ cobertura parcial · ○ não publica de forma utilizável · – não se aplica. Clique no nome da Casa para abrir a página dela.">
        <div className="relative overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <caption className="sr-only">Dimensões publicadas por Casa legislativa</caption>
            <thead><tr className="border-b text-xs text-muted-foreground"><th scope="col" className="sticky left-0 z-10 bg-card p-3 text-left font-bold">Casa</th>{DOMAINS.map(([key, label]) => <th key={key} scope="col" className="px-1 py-3 text-center font-bold [writing-mode:vertical-rl] sm:[writing-mode:horizontal-tb]">{label}</th>)}<th scope="col" className="p-3 text-right font-bold">Total</th></tr></thead>
            <tbody>{[...houses].sort((a, b) => b.published - a.published || a.houseId.localeCompare(b.houseId)).map(house => <tr key={house.houseId} className="border-b last:border-0 hover:bg-muted/40">
              <th scope="row" className="sticky left-0 z-10 bg-card p-3 text-left"><Link prefetch={false} href={`/legislativo/estaduais/${house.houseId}/deputados`} className="font-bold text-primary underline-offset-2 hover:underline">{house.houseId}</Link><span className="ml-2 hidden text-xs text-muted-foreground sm:inline">{count(house.count)} parlamentares</span></th>
              {DOMAINS.map(([key, label]) => <StatusCell key={key} status={statusOf.get(`${house.houseId}:${key}`)} label={label} />)}
              <td className="p-3 text-right font-bold tabular-nums">{house.published}/{DOMAINS.length}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </Section>

      {composition.length > 0 && <Section id="composicao" eyebrow="3 · Quem ocupa cada Casa" title="A composição política muda de estado para estado" lede="Cada barra é uma Assembleia, dividida em cadeiras por partido. As cores só distinguem partidos: não indicam espectro político, e a ordem segue o tamanho da bancada.">
        <ul className="grid gap-3 md:grid-cols-2" data-testid="state-house-directory">
          {composition.map(house => {
            const top = house.parties.find(party => party.party !== 'Sem partido');
            return <li key={house.houseId}><Link prefetch={false} href={`/legislativo/estaduais/${house.houseId}/deputados`} className="card-lift block rounded-2xl border bg-card p-4">
              <div className="flex items-baseline justify-between gap-3"><strong>{house.houseName}</strong><span className="text-sm tabular-nums text-muted-foreground">{count(house.total)} cadeiras</span></div>
              <div className="mt-3 flex h-4 overflow-hidden rounded-full bg-muted" role="img" aria-label={`Composição: ${house.parties.slice(0, 6).map(party => `${party.party} ${party.seats}`).join(', ')}${house.parties.length > 6 ? ' e outros' : ''}`}>
                {house.parties.map(party => <span key={party.party} title={`${party.party}: ${party.seats}`} style={{ width: `${100 * party.seats / house.total}%`, background: partyColor(party.party) }} />)}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{top ? <>Maior bancada: <strong className="text-foreground">{top.party}</strong> com {top.seats} ({percent(top.seats / house.total)}) · {house.parties.filter(party => party.party !== 'Sem partido').length} partidos</> : 'Partidos não informados no cadastro'}</p>
            </Link></li>;
          })}
        </ul>
      </Section>}

      <Section id="agregado" eyebrow="4 · Todas as Casas juntas" title={`${count(hemicycle.total)} parlamentares, ${aggregate.length} partidos`} lede="A soma abaixo junta Assembleias diferentes. Ela não é uma bancada nacional nem indica que parlamentares do mesmo partido votem juntos.">
        <PartyHemicycle composition={hemicycle} labels={{ noun: 'parlamentares estaduais e distritais', one: 'um parlamentar estadual ou distrital', partyHrefTemplate: '/legislativo/parlamentares?nivel=STATE_DEPUTY&partido={party}' }} />
        {data.unresolvedPartyCount > 0 && <p className="text-xs leading-5 text-muted-foreground">{count(data.unresolvedPartyCount)} parlamentares estão com o partido publicado sem normalização e aparecem como "Sem partido".</p>}
      </Section>

      <Section id="dinheiro" eyebrow="5 · Dinheiro público" title="Gastos e emendas: onde há dados utilizáveis" lede="Cada Assembleia publica gastos e emendas com rubricas próprias. Por isso o Cívica mostra os números dentro de cada Casa, e não um ranking entre estados.">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ['Gastos parlamentares', 'FINANCE', Banknote], ['Gabinete e pessoal', 'PERSONNEL', Users], ['Emendas estaduais', 'BUDGET_AMENDMENTS', Landmark],
          ].map(([label, key, Icon]) => { const total = houses.filter(item => OK.has(statusOf.get(`${item.houseId}:${key as string}`) ?? '')).length, I = Icon as typeof Banknote; return <div key={key as string} className="rounded-2xl border bg-card p-5"><I className="text-primary" size={20} /><strong className="display-title mt-3 block text-4xl">{total}<span className="text-xl text-muted-foreground"> de 27</span></strong><span className="mt-1 block font-bold">{label as string}</span><span className="text-xs text-muted-foreground">Casas com publicação utilizável</span></div>; })}
        </div>
      </Section>

      <section className="border-t pt-10" aria-labelledby="explore-estadual"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">6 · Explore</p><h2 id="explore-estadual" className="display-title mt-2 text-3xl sm:text-4xl">Entre por pessoa ou por estado</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">A listagem nacional permite filtrar por Casa, UF, partido e nome.</p></div><Link href="/legislativo/parlamentares?nivel=STATE_DEPUTY" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground">Explorar deputados <ArrowRight size={16} /></Link></div></section>
    </main>
  </>;
}
