import Link from 'next/link';
import { TerritoryFrame } from '@/components/territory/state-frame';
import { TerritoryHero } from '@/components/territory/territory-hero';
import { HealthPanel } from '@/components/territory/health-panel';
import { Suspense } from 'react';
import { SecuritySummary } from '@/components/security/security-summary';
import { EducationSummary } from '@/components/education/education-summary';
import { WellbeingSummary } from '@/components/wellbeing/wellbeing-summary';
import { InfrastructureSummary } from '@/components/infrastructure/infrastructure-summary';
import { TerritoryLegislativeSummary } from '@/components/territory/legislative-summary';
import { ExecutiveSummary } from '@/components/territory/executive-summary';
import { IdhmSummary } from '@/components/territory/idhm-summary';
import { DiscoveryPanel } from '@/components/territory/discovery-panel';
import { THEMES, formatInt } from '@/components/territory/territory-ui';
import { loadMunicipalityPage } from '@/components/territory/municipality-loader';
import { loadGeometry, loadMunicipalities, loadMunicipality, ymLabel } from '@/lib/exec-territory';
import { loadMunicipalityDiscoveries } from '@/lib/territory-discoveries';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ ibge: string }> };
export async function generateMetadata({ params }: Props) { const { ibge } = await params; const m = await loadMunicipality(ibge); return { title: m ? `${m.name} (${m.uf}) · Municípios · Cívica` : 'Município · Cívica' }; }

export default async function MunicipioPage({ params }: Props) {
  const { ibge } = await params;
  const { m, indicators, coverage, values, vaccines, bench } = await loadMunicipalityPage(ibge, false);
  const base = `/municipios/${m.entityId}`;
  const hasHealth = indicators.length > 0;
  const beds = indicators.find(i => i.code === 'IND-SAU-05');
  const [geometry, siblings, discoveries] = m.uf ? await Promise.all([loadGeometry(m.uf), loadMunicipalities(m.ufCode!), loadMunicipalityDiscoveries(ibge, m.entityId, m.stateName)]) : [null, [], { headline: null, supporting: [] }];
  const heroDiscovery = discoveries.headline ? { themeLabel: discoveries.headline.themeLabel, value: discoveries.headline.value, unit: discoveries.headline.unit, sentence: discoveries.headline.sentence, href: discoveries.headline.href } : null;
  return <TerritoryFrame crumbs={[{ href: '/estados', label: 'Estados' }, { href: `/estados/${m.uf}`, label: m.stateName }, { label: m.name }]} kicker={`Município · ${m.uf}`} title={m.name}
    lede={hasHealth ? <>{m.name} fica em {m.stateName}.{beds?.value != null ? ` O município tem ${beds.value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} leitos hospitalares por mil habitantes no cadastro.` : ''} Abaixo, o que já foi coletado e conferido; o que ainda não existe aparece como lacuna.</> : <>{m.name} fica em {m.stateName}. Os dados de saúde deste município ainda não foram coletados; a página mostra o território e diz o que falta.</>}
    population={m.population?.value ?? null} populationYear={m.population?.year ?? null} base={base} active=""
    heroNode={<TerritoryHero context={`Município · ${m.uf}`} title={m.name} stateName={m.stateName} mapMode="municipio" geometry={geometry} selectedId={m.entityId}
      discovery={heroDiscovery}
      description={<>{m.name} é um dos {formatInt(siblings.length)} municípios de {m.stateName}.{beds?.value != null ? ` ${beds.value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} leitos hospitalares por mil habitantes no cadastro.` : ' Dados de saúde ainda não coletados aqui.'}</>}
      population={m.population?.value ?? null} populationYear={m.population?.year ?? null}
      actions={<><Link href={`/estados/${m.uf}`} className="rounded-full border border-white/35 px-5 py-3 text-sm font-bold text-white">Mapa de {m.stateName}</Link>
        <Link href={`/estados/${m.uf}/representacao`} className="rounded-full bg-white px-5 py-3 text-sm font-bold text-primary">Quem representa {m.stateName}</Link></>} />}>
    {!m.installationDateProven && <p className="-mt-4 text-xs text-muted-foreground">A data de instalação do município não foi comprovada em fonte; por isso não é exibida.</p>}
    <DiscoveryPanel scopeName={m.name} result={discoveries} headlineInHero={!!heroDiscovery} />
    {hasHealth && <div><HealthPanel scope={m.name} kind="municipio" ufCode={m.ufCode!} ufName={m.stateName} values={values} vaccines={vaccines} facilities={null} bench={bench} cnesLabel="" compact />
      <p className="mt-3 text-sm"><Link href={`${base}/saude`} className="font-semibold text-primary hover:underline">Rede, hospitais, leitos, vacinas e séries históricas →</Link></p>
      <p className="mt-1 text-xs text-muted-foreground">Dados de saúde até {coverage.length ? ymLabel(coverage[0]!.lastCompetence) : 'data indisponível'}.</p></div>}
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="min-w-0"><Suspense fallback={null}><EducationSummary kind="municipio" code={String(m.entityId)} /></Suspense></div>
      <div className="min-w-0"><Suspense fallback={null}><SecuritySummary kind="municipio" code={String(m.entityId)} /></Suspense></div>
    </div>
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="min-w-0"><Suspense fallback={null}><WellbeingSummary kind="municipio" code={String(m.entityId)} /></Suspense></div>
      <div className="min-w-0"><Suspense fallback={null}><InfrastructureSummary kind="municipio" code={String(m.entityId)} /></Suspense></div>
    </div>
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="min-w-0"><Suspense fallback={null}><ExecutiveSummary uf={m.uf ?? ''} stateName={m.stateName} gdpTerritory={{ level: 'MUNICIPIO', ibge7: m.entityId }} municipio={{ entityId: m.entityId, name: m.name }} /></Suspense></div>
      <div className="min-w-0"><Suspense fallback={null}><IdhmSummary territory={{ level: 'MUNICIPIO', ibge7: m.entityId }} territoryName={m.name} /></Suspense></div>
    </div>
    <Suspense fallback={null}><TerritoryLegislativeSummary uf={m.uf ?? ''} stateName={m.stateName} municipioName={m.name} /></Suspense>
    <section aria-labelledby="areas"><h2 id="areas" className="section-hairline pt-3 font-display text-2xl">Áreas temáticas</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{THEMES.map(t => <li key={t.slug}><Link href={`${base}/${t.slug}`} className="card-lift flex h-full flex-col rounded-xl border bg-card p-4"><span className="font-display text-lg">{t.label}</span><span className="mt-1 text-xs text-muted-foreground">{t.ready ? (t.slug !== 'saude' || hasHealth ? 'Dados publicados' : 'Coleta pendente neste município') : 'Em preparação, sem dados'}</span></Link></li>)}</ul></section>
  </TerritoryFrame>;
}
