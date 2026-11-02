import type { ReactNode } from 'react';
import Link from 'next/link';
import { Droplet, Navigation, Home, Zap, Bus, Waves, HardHat } from 'lucide-react';
import type { InfrastructureIndicator } from '@senadotracker/db';
import type { InfrastructurePageData } from '@/lib/infrastructure/types';
import { ChapterNav } from '@/components/security/chapter-nav';
import { ChapterShell, EmptyNote } from '@/components/security/security-ui';
import { IndicatorLive } from '@/components/indicators/indicator-live';
import { heroKpiToKpi } from '@/lib/comparison/kpi-adapters';
import { Block, BarList, GroupBlock, InfrastructureLegend, StatGrid } from './infrastructure-ui';
import { EntornoUnitSwitcher } from './urban-environment';
import { IndicatorDetails } from './indicator-disclosure';
import { TerritoryCompareRow } from './territory-compare';
import { IndicatorExplorer } from './explorer';

function Disclosures({ items }: { items: InfrastructureIndicator[] }) {
  if (items.length === 0) return null;
  return <div className="mt-2 space-y-1 border-t pt-3">{items.map(i => <IndicatorDetails key={i.code} ind={i} />)}</div>;
}

function Pending({ id, number, title, reason }: { id: string; number: number; title: string; reason: string }) {
  return <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-28"><div className="rounded-3xl border border-dashed bg-card p-5 sm:p-6"><p className="eyebrow">Capítulo {number}</p><h2 id={`${id}-h`} className="font-display text-2xl text-[#14304f]">{title}</h2><p className="mt-2 max-w-prose text-sm text-muted-foreground">{reason} Nenhum valor é estimado nem preenchido com zero.</p></div></section>;
}

/** Página de Infraestrutura: hero seletivo → água e saneamento → ruas e entorno → habitação → energia →
 * mobilidade e logística → segurança hídrica → obras públicas; mesmo desenho para estado e município.
 * Navegação por capítulo em sidebar persistente no desktop (Parte IV.8.3 do mandato, P1/P5) — mesmo
 * `ChapterNav` que os outros temas já usam. Os 7 capítulos numerados abrem com um `IndicatorLive`
 * (Descobrir→Explorar→Verificar) construído a partir do `HeroKpi` real que o panorama já calcula para
 * aquele capítulo (`HERO_KPI_PRIORITY`, 1 indicador por capítulo por desenho) via `heroKpiToKpi` (P4) —
 * zero dado novo, só uma composição que dá a cada capítulo uma assinatura visual própria em vez do bloco
 * "título→grupos→disclosures" repetido 7 vezes. */
export function InfrastructurePage({ data, hideLede = false }: { data: InfrastructurePageData; hideLede?: boolean }) {
  const { scope, hero, waterSanitation, urbanEnvironment, housing, energy, mobility, waterSecurity, works } = data; const where = scope.name;
  const worksListHref = scope.kind === 'uf' ? `/estados/${scope.uf}/infraestrutura/obras` : `/municipios/${scope.entityId}/infraestrutura/obras`;
  const kpiForChapter = (codes: string[], anchor: string) => { const h = hero.kpis.find(k => codes.includes(k.code)); return h ? heroKpiToKpi(h, { chapterAnchor: anchor, territoryName: where }) : null; };
  const aguaKpi = kpiForChapter(['IAG0001', 'IES0001'], 'agua-saneamento');
  const ruasKpi = kpiForChapter(['INF-ENTORNO-HOUSEHOLD-PAVEMENT', 'INF-ENTORNO-HOUSEHOLD-LIGHTING'], 'ruas-entorno');
  const habitacaoKpi = kpiForChapter(['INF-INTERNET-DOMICILIOS'], 'habitacao');
  const energiaKpi = kpiForChapter(['ENERGY-MMGD-INSTALLED-KW'], 'energia');
  const mobilidadeKpi = kpiForChapter(['IND-MOB-PEMOB-SERVICOS-MUNICIPAIS'], 'mobilidade');
  const segurancaHidricaKpi = kpiForChapter(['INF-DAMS-SNISB-TOTAL'], 'seguranca-hidrica');
  const obrasKpi = kpiForChapter(['OBRASGOV-PROJECTS'], 'obras');
  const verifyFor = (k: ReturnType<typeof heroKpiToKpi>) => ({ source: k.source, definition: k.plain, ...(k.secondary ? { notes: [k.secondary] } : {}) });
  const nav = [
    { id: 'panorama', label: 'Panorama', available: hero.kpis.length > 0 }, { id: 'agua-saneamento', label: 'Água e saneamento', available: waterSanitation.available },
    { id: 'ruas-entorno', label: 'Ruas e entorno', available: urbanEnvironment.available }, { id: 'habitacao', label: 'Habitação', available: housing.available },
    { id: 'energia', label: 'Energia', available: energy.available }, { id: 'mobilidade', label: 'Mobilidade e logística', available: mobility.available },
    { id: 'seguranca-hidrica', label: 'Segurança hídrica', available: waterSecurity.available }, { id: 'obras', label: 'Obras públicas', available: works.available },
    { id: 'fontes', label: 'Fontes', available: true },
  ];
  const chapter = (ok: boolean, c: { id: string; number: number; title: string; emptyReason?: string }, node: ReactNode) => ok ? node : <Pending id={c.id} number={c.number} title={c.title} reason={c.emptyReason ?? 'Sem dados publicados.'} />;

  return (
    <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start lg:gap-10">
      <ChapterNav items={nav} layout="sidebar" accent="cyan" />
      <div className="min-w-0 space-y-10">
      <section id="panorama" aria-labelledby="panorama-h" className="scroll-mt-28 space-y-5">
        <header><p className="eyebrow">Infraestrutura</p><h2 id="panorama-h" className="display-title mt-1 text-2xl sm:text-4xl">O que existe e está registrado {scope.kind === 'uf' ? `no estado de ${where}` : `em ${where}`}?</h2>{!hideLede && <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">{hero.lede}</p>}</header>
        {hero.kpis.length > 0 ? (
          <StatGrid items={hero.kpis.map(k => ({ label: k.label, value: k.value, ...(k.unit ? { unit: k.unit } : {}), note: k.note ?? null }))} />
        ) : <EmptyNote title="Sem indicadores para o panorama">Ainda não há indicadores de infraestrutura publicados para este território.</EmptyNote>}
        {hero.worksChart && <Block><BarList title="Obras públicas por situação oficial" rows={hero.worksChart} caption="Distribuição dos projetos do Obrasgov registrados neste território, por situação declarada na fonte." /></Block>}
        {hero.kpis.some(k => k.compare) && (
          <Block>
            <h3 className="mb-3 font-display text-xl text-[#14304f]">Comparação com o estado e o Brasil</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{hero.kpis.filter(k => k.compare).map(k => <div key={k.code} className="min-w-0"><p className="mb-1 text-xs font-semibold text-muted-foreground">{k.label}</p><TerritoryCompareRow c={k.compare!} /></div>)}</div>
          </Block>
        )}
        <p className="text-xs text-muted-foreground">{hero.coverageNote}</p>
      </section>
      <InfrastructureLegend />

      {chapter(waterSanitation.available, waterSanitation, <ChapterShell accent="cyan" icon={Droplet} id="agua-saneamento" number={1} title={waterSanitation.title} narrative={waterSanitation.narrative} limits={waterSanitation.limits} sources={waterSanitation.sources}>
        {aguaKpi && <IndicatorLive kpi={aguaKpi} who={where} lead verify={verifyFor(aguaKpi)} />}
        {waterSanitation.groups.map(g => <GroupBlock key={g.label} group={g} />)}
        <Disclosures items={waterSanitation.disclosures} />
      </ChapterShell>)}

      {chapter(urbanEnvironment.available, urbanEnvironment, <ChapterShell accent="cyan" icon={Navigation} id="ruas-entorno" number={2} title={urbanEnvironment.title} narrative={urbanEnvironment.narrative} tone="strip" limits={urbanEnvironment.limits} sources={urbanEnvironment.sources}>
        {ruasKpi && <IndicatorLive kpi={ruasKpi} who={where} lead verify={verifyFor(ruasKpi)} />}
        <EntornoUnitSwitcher byUnit={urbanEnvironment.byUnit} />
        <Disclosures items={urbanEnvironment.disclosures} />
      </ChapterShell>)}

      {chapter(housing.available, housing, <ChapterShell accent="cyan" icon={Home} id="habitacao" number={3} title={housing.title} narrative={housing.narrative} limits={housing.limits} sources={housing.sources}>
        {habitacaoKpi && <IndicatorLive kpi={habitacaoKpi} who={where} lead verify={verifyFor(habitacaoKpi)} />}
        {housing.groups.map(g => <GroupBlock key={g.label} group={g} />)}
        <Disclosures items={housing.disclosures} />
      </ChapterShell>)}

      {chapter(energy.available, energy, <ChapterShell accent="cyan" icon={Zap} id="energia" number={4} title={energy.title} narrative={energy.narrative} tone="strip" limits={energy.limits} sources={energy.sources}>
        {energiaKpi && <IndicatorLive kpi={energiaKpi} who={where} lead verify={verifyFor(energiaKpi)} />}
        {energy.groups.map(g => <GroupBlock key={g.label} group={g} />)}
        <Disclosures items={energy.disclosures} />
      </ChapterShell>)}

      {chapter(mobility.available, mobility, <ChapterShell accent="cyan" icon={Bus} id="mobilidade" number={5} title={mobility.title} narrative={mobility.narrative} limits={mobility.limits} sources={mobility.sources}>
        {mobilidadeKpi && <IndicatorLive kpi={mobilidadeKpi} who={where} lead verify={verifyFor(mobilidadeKpi)} />}
        {mobility.groups.map(g => <GroupBlock key={g.label} group={g} />)}
        <Disclosures items={mobility.disclosures} />
      </ChapterShell>)}

      {chapter(waterSecurity.available, waterSecurity, <ChapterShell accent="cyan" icon={Waves} id="seguranca-hidrica" number={6} title={waterSecurity.title} narrative={waterSecurity.narrative} tone="strip" limits={waterSecurity.limits} sources={waterSecurity.sources}>
        {segurancaHidricaKpi && <IndicatorLive kpi={segurancaHidricaKpi} who={where} lead verify={verifyFor(segurancaHidricaKpi)} />}
        {waterSecurity.groups.map(g => <GroupBlock key={g.label} group={g} />)}
        <Disclosures items={waterSecurity.disclosures} />
      </ChapterShell>)}

      {chapter(works.available, works, <ChapterShell accent="cyan" icon={HardHat} id="obras" number={7} title={works.title} narrative={works.narrative} limits={works.limits} sources={works.sources}>
        {obrasKpi && <IndicatorLive kpi={obrasKpi} who={where} lead verify={verifyFor(obrasKpi)} />}
        <Link href={worksListHref} className="inline-flex items-center gap-1.5 rounded-full border border-[#115b45] px-4 py-1.5 text-sm font-semibold text-[#115b45] hover:bg-[#e8f3ee]">Explorar lista completa de obras →</Link>
        <StatGrid items={[
          { label: 'Projetos registrados', value: String(works.totals.projects) },
          { label: 'Com um único município', value: String(works.totals.singleMunicipality) },
          { label: 'Multimunicipais', value: String(works.totals.multiTerritory) },
          { label: 'Sem localização válida', value: String(works.totals.withoutValidLocation) },
        ]} />
        {works.bySituation.length > 0 && <BarList title="Projetos por situação oficial" rows={works.bySituation} />}
        {works.financial.some(f => f.value != null) && (
          <div className="rounded-2xl border-l-4 p-5 sm:p-6" style={{ borderLeftColor: 'var(--map-cyan-4)', backgroundColor: '#d6ebf0' }}>
            <p className="eyebrow">Linha do dinheiro</p>
            <h3 className="mb-3 font-display text-xl text-[#14304f]">Valores — projetos de um único município</h3>
            {works.financial.filter(f => f.value != null).length >= 2 && (
              <BarList title="Comparação entre estágios" rows={works.financial.filter((f): f is typeof f & { value: number } => f.value != null).map(f => ({ label: f.label, value: f.value, display: f.display ?? String(f.value) }))} caption="Barras na mesma escala só para comparar a magnitude de cada estágio — não representam uma sequência que se soma." />
            )}
            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {works.financial.map(f => (
                <div key={f.key} className="rounded-xl border bg-white p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{f.label}</dt>
                  <dd className="hero-figure tnum mt-1 text-xl text-[#14304f] sm:text-2xl">{f.display ?? 'Não há informação publicada para esta etapa.'}</dd></div>
              ))}
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">Estágios diferentes da mesma obra — nunca somados entre si.</p>
          </div>
        )}
      </ChapterShell>)}

      <IndicatorExplorer rows={data.explorer} territoryName={where} />

      <section id="fontes" aria-labelledby="fontes-h" className="scroll-mt-28 rounded-2xl border bg-card p-5 text-sm"><h2 id="fontes-h" className="font-display text-xl">Fontes desta página</h2>
        <ul className="mt-2 space-y-1 text-muted-foreground">{data.sources.map(s => <li key={s.label}><strong className="text-foreground">{s.label}</strong>: {s.period}</li>)}</ul>
        <p className="mt-3 text-xs text-muted-foreground">Esta página reúne registros oficiais de fontes e anos diferentes; ela não cria uma nota única de infraestrutura, não classifica o território como bom ou ruim e não atribui causas às variações. Ausência de valor significa que a fonte não publicou, nunca zero.</p>
        <details className="mt-4 text-xs"><summary className="cursor-pointer font-semibold text-[#14304f]">Cobertura nacional por família de fonte</summary>
          <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[32rem] text-xs"><thead><tr className="border-b text-left uppercase tracking-wide text-muted-foreground"><th scope="col" className="py-1.5 pr-3 font-semibold">Família</th><th scope="col" className="py-1.5 pr-3 text-right font-semibold">Indicadores</th><th scope="col" className="py-1.5 pr-3 text-right font-semibold">Observações (Brasil)</th><th scope="col" className="py-1.5 pr-3 font-semibold">Período mais recente</th></tr></thead>
            <tbody>{data.familyCoverage.map(f => <tr key={f.family} className="border-b last:border-0"><td className="py-1.5 pr-3 font-semibold text-[#14304f]">{f.family}</td><td className="tnum py-1.5 pr-3 text-right">{f.indicators}</td><td className="tnum py-1.5 pr-3 text-right">{f.observations.toLocaleString('pt-BR')}</td><td className="py-1.5 pr-3">{f.latestPeriod ?? '—'}</td></tr>)}</tbody></table></div>
          <p className="mt-2 text-muted-foreground">Contagens nacionais de cada fonte (não só deste território) — mostram o alcance geral da família, não quantos indicadores estão publicados aqui.</p>
        </details>
      </section>
      </div>
    </div>
  );
}
