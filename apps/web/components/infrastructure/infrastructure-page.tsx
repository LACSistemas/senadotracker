import type { ReactNode } from 'react';
import Link from 'next/link';
import type { InfrastructureIndicator } from '@senadotracker/db';
import type { InfrastructurePageData } from '@/lib/infrastructure/types';
import { ChapterNav } from '@/components/security/chapter-nav';
import { ChapterShell, EmptyNote } from '@/components/security/security-ui';
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
 * mobilidade e logística → segurança hídrica → obras públicas; mesmo desenho para estado e município. */
export function InfrastructurePage({ data }: { data: InfrastructurePageData }) {
  const { scope, hero, waterSanitation, urbanEnvironment, housing, energy, mobility, waterSecurity, works } = data; const where = scope.name;
  const worksListHref = scope.kind === 'uf' ? `/estados/${scope.uf}/infraestrutura/obras` : `/municipios/${scope.entityId}/infraestrutura/obras`;
  const nav = [
    { id: 'panorama', label: 'Panorama', available: hero.kpis.length > 0 }, { id: 'agua-saneamento', label: 'Água e saneamento', available: waterSanitation.available },
    { id: 'ruas-entorno', label: 'Ruas e entorno', available: urbanEnvironment.available }, { id: 'habitacao', label: 'Habitação', available: housing.available },
    { id: 'energia', label: 'Energia', available: energy.available }, { id: 'mobilidade', label: 'Mobilidade e logística', available: mobility.available },
    { id: 'seguranca-hidrica', label: 'Segurança hídrica', available: waterSecurity.available }, { id: 'obras', label: 'Obras públicas', available: works.available },
    { id: 'fontes', label: 'Fontes', available: true },
  ];
  const chapter = (ok: boolean, c: { id: string; number: number; title: string; emptyReason?: string }, node: ReactNode) => ok ? node : <Pending id={c.id} number={c.number} title={c.title} reason={c.emptyReason ?? 'Sem dados publicados.'} />;

  return (
    <div className="space-y-10">
      <section id="panorama" aria-labelledby="panorama-h" className="scroll-mt-28 space-y-5">
        <header><p className="eyebrow">Infraestrutura</p><h2 id="panorama-h" className="display-title mt-1 text-2xl sm:text-4xl">O que existe e está registrado {scope.kind === 'uf' ? `no estado de ${where}` : `em ${where}`}?</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">{hero.lede}</p></header>
        {hero.kpis.length > 0 ? (
          <StatGrid items={hero.kpis.map(k => ({ label: k.label, value: k.value, ...(k.unit ? { unit: k.unit } : {}), note: k.note ?? null }))} />
        ) : <EmptyNote title="Sem indicadores para o panorama">Ainda não há indicadores de infraestrutura publicados para este território.</EmptyNote>}
        {hero.worksChart && <Block><BarList title="Obras públicas por situação oficial" rows={hero.worksChart} caption="Distribuição dos projetos do Obrasgov registrados neste território, por situação declarada na fonte." /></Block>}
        {hero.kpis.some(k => k.compare) && (
          <Block>
            <h3 className="mb-3 font-display text-xl text-[#14304f]">Comparação com o estado e o Brasil</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{hero.kpis.filter(k => k.compare).map(k => <div key={k.code}><p className="mb-1 text-xs font-semibold text-muted-foreground">{k.label}</p><TerritoryCompareRow c={k.compare!} /></div>)}</div>
          </Block>
        )}
        <p className="text-xs text-muted-foreground">{hero.coverageNote}</p>
      </section>
      <ChapterNav items={nav} />
      <InfrastructureLegend />

      {chapter(waterSanitation.available, waterSanitation, <ChapterShell id="agua-saneamento" number={1} title={waterSanitation.title} narrative={waterSanitation.narrative} limits={waterSanitation.limits} sources={waterSanitation.sources}>
        {waterSanitation.groups.map(g => <GroupBlock key={g.label} group={g} />)}
        <Disclosures items={waterSanitation.disclosures} />
      </ChapterShell>)}

      {chapter(urbanEnvironment.available, urbanEnvironment, <ChapterShell id="ruas-entorno" number={2} title={urbanEnvironment.title} narrative={urbanEnvironment.narrative} tone="strip" limits={urbanEnvironment.limits} sources={urbanEnvironment.sources}>
        <EntornoUnitSwitcher byUnit={urbanEnvironment.byUnit} />
        <Disclosures items={urbanEnvironment.disclosures} />
      </ChapterShell>)}

      {chapter(housing.available, housing, <ChapterShell id="habitacao" number={3} title={housing.title} narrative={housing.narrative} limits={housing.limits} sources={housing.sources}>
        {housing.groups.map(g => <GroupBlock key={g.label} group={g} />)}
        <Disclosures items={housing.disclosures} />
      </ChapterShell>)}

      {chapter(energy.available, energy, <ChapterShell id="energia" number={4} title={energy.title} narrative={energy.narrative} tone="strip" limits={energy.limits} sources={energy.sources}>
        {energy.groups.map(g => <GroupBlock key={g.label} group={g} />)}
        <Disclosures items={energy.disclosures} />
      </ChapterShell>)}

      {chapter(mobility.available, mobility, <ChapterShell id="mobilidade" number={5} title={mobility.title} narrative={mobility.narrative} limits={mobility.limits} sources={mobility.sources}>
        {mobility.groups.map(g => <GroupBlock key={g.label} group={g} />)}
        <Disclosures items={mobility.disclosures} />
      </ChapterShell>)}

      {chapter(waterSecurity.available, waterSecurity, <ChapterShell id="seguranca-hidrica" number={6} title={waterSecurity.title} narrative={waterSecurity.narrative} tone="strip" limits={waterSecurity.limits} sources={waterSecurity.sources}>
        {waterSecurity.groups.map(g => <GroupBlock key={g.label} group={g} />)}
        <Disclosures items={waterSecurity.disclosures} />
      </ChapterShell>)}

      {chapter(works.available, works, <ChapterShell id="obras" number={7} title={works.title} narrative={works.narrative} limits={works.limits} sources={works.sources}>
        <Link href={worksListHref} className="inline-flex items-center gap-1.5 rounded-full border border-[#115b45] px-4 py-1.5 text-sm font-semibold text-[#115b45] hover:bg-[#e8f3ee]">Explorar lista completa de obras →</Link>
        <StatGrid items={[
          { label: 'Projetos registrados', value: String(works.totals.projects) },
          { label: 'Com um único município', value: String(works.totals.singleMunicipality) },
          { label: 'Multimunicipais', value: String(works.totals.multiTerritory) },
          { label: 'Sem localização válida', value: String(works.totals.withoutValidLocation) },
        ]} />
        {works.bySituation.length > 0 && <BarList title="Projetos por situação oficial" rows={works.bySituation} />}
        {works.financial.some(f => f.value != null) && (
          <Block>
            <h3 className="mb-3 font-display text-xl text-[#14304f]">Valores — projetos de um único município</h3>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {works.financial.map(f => (
                <div key={f.key} className="rounded-xl border bg-white p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{f.label}</dt>
                  <dd className="hero-figure tnum mt-1 text-xl text-[#14304f] sm:text-2xl">{f.display ?? 'Não há informação publicada para esta etapa.'}</dd></div>
              ))}
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">Estágios diferentes da mesma obra — nunca somados entre si.</p>
          </Block>
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
  );
}
