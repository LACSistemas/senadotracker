import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TerritoryFrame } from '@/components/territory/state-frame';
import { MunicipalFinder, MunicipalMap, THEMES, formatInt, type MapMetric } from '@/components/territory/territory-ui';
import { HealthPanel } from '@/components/territory/health-panel';
import { Suspense } from 'react';
import { SecuritySummary } from '@/components/security/security-summary';
import { findMunicipalities, isUf, loadBenchmarks, loadPanelValues, loadVaccinePanel, loadCoverage, loadGeometry, loadIndicators, loadMapValues, loadMunicipalities, loadState, loadUfStory, ymLabel } from '@/lib/exec-territory';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ uf: string }>; searchParams: Promise<{ mapa?: string; q?: string }> };
export async function generateMetadata({ params }: Props) { const { uf } = await params; const s = isUf(uf) ? await loadState(uf) : null; return { title: s ? `${s.name} · Estados e municípios · Cívica` : 'Estado · Cívica' }; }

const METRICS: Record<string, MapMetric & { code: string | null; short: string }> = {
  populacao: { key: 'populacao', short: 'População', code: null, label: 'população', unit: 'hab.', digits: 0 },
  leitos: { key: 'leitos', short: 'Leitos por mil hab.', code: 'IND-SAU-05', label: 'leitos hospitalares por 1.000 habitantes', unit: 'leitos/1.000 hab.', digits: 2 },
  mortalidade: { key: 'mortalidade', short: 'Mortalidade infantil', code: 'IND-SAU-08', label: 'mortalidade infantil', unit: 'óbitos/1.000 nascidos', digits: 1 },
};

export default async function EstadoPage({ params, searchParams }: Props) {
  const { uf: rawUf } = await params; const sp = await searchParams;
  if (!isUf(rawUf)) notFound();
  const uf = rawUf.toUpperCase();
  const state = await loadState(uf); if (!state) notFound();
  const [munis, geometry, indicators, story, coverage, panelValues, vaccines, bench] = await Promise.all([loadMunicipalities(state.ufCode!), loadGeometry(uf), loadIndicators(state.entityId), loadUfStory(state.ufCode!), loadCoverage(state.ufCode!), loadPanelValues(state.entityId), loadVaccinePanel(state.entityId), loadBenchmarks()]);
  const metric = METRICS[sp.mapa ?? 'populacao'] ?? METRICS.populacao!;
  const raw = metric.code ? await loadMapValues(state.ufCode!, metric.code) : [];
  const values = new Map<number, number>();
  if (metric.code) { for (const r of raw) if (r.value !== null && !(r.flags & (1 | 8 | 64))) values.set(r.entityId, r.value); }
  else for (const m of munis) if (m.population !== null) values.set(m.entityId, m.population);
  const f = story.payload;
  const hasHealth = indicators.length > 0 || f.total > 0;
  const names = new Map(munis.map(m => [m.entityId, m.name]));
  const missing = geometry ? munis.filter(m => !geometry.items.some(i => i.id === m.entityId)).map(m => m.name) : [];
  const results = sp.q ? await findMunicipalities(sp.q, state.ufCode!, 12) : null;
  const lastCnes = coverage.find(c => c.datasetId === 3);
  const bedsInd = indicators.find(i => i.code === 'IND-SAU-05');

  return <TerritoryFrame crumbs={[{ href: '/estados', label: 'Estados' }, { label: state.name }]} kicker={`${state.regionName ?? 'Brasil'} · ${state.uf}`} title={state.name}
    lede={hasHealth
      ? <>{formatInt(munis.length)} municípios e {formatInt(state.population?.value ?? null)} moradores. A rede de saúde cadastrada reúne {formatInt(f.total)} estabelecimentos — {formatInt(f.hospitals)} hospitais e {formatInt(f.ubs)} unidades básicas — com {formatInt(f.beds.existing)} leitos{bedsInd?.value != null ? `, ou ${bedsInd.value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} por mil habitantes` : ''}.</>
      : <>{formatInt(munis.length)} municípios e {formatInt(state.population?.value ?? null)} moradores. Os dados de saúde deste estado ainda não foram coletados: a página mostra o território e a população, e diz o que falta.</>}
    population={state.population?.value ?? null} populationYear={state.population?.year ?? null} base={`/estados/${uf}`} active=""
    actions={<Link href={`/estados/${uf}/representacao`} className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground">Quem representa {state.name}</Link>}>

    <section aria-labelledby="mapa" className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="min-w-0 rounded-3xl border bg-card p-4 sm:p-6">
        <h2 id="mapa" className="font-display text-2xl">Os {munis.length} municípios</h2>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Indicador do mapa">
          {Object.values(METRICS).map(m => <Link key={m.key} href={`/estados/${uf}?mapa=${m.key}`} aria-current={m.key === metric.key ? 'true' : undefined} className={`rounded-full border px-3 py-1 text-xs font-semibold ${m.key === metric.key ? 'border-primary bg-primary text-primary-foreground' : 'hover:border-primary/50'}`}>{m.short}</Link>)}
        </div>
        {values.size === 0 && metric.code ? <p className="mt-6 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Ainda não há {metric.label} publicado para os municípios de {state.name}. O mapa só é colorido com dado oficial coletado.</p>
          : geometry ? <div className="mt-4"><MunicipalMap geometry={geometry} names={names} values={values} metric={metric} missing={missing} hrefFor={id => `/municipios/${id}`} /></div>
          : <p className="mt-6 text-sm text-muted-foreground">Malha municipal indisponível para esta UF.</p>}
        {metric.code === 'IND-SAU-08' && <p className="mt-2 text-xs text-muted-foreground">Municípios com menos de 100 nascidos no ano não são coloridos: a taxa é instável.</p>}
      </div>
      <div className="space-y-5">
        <div><h2 className="font-display text-2xl">Procurar município</h2><div className="mt-3"><MunicipalFinder action={`/estados/${uf}`} defaultValue={sp.q} /></div>
          {results && <ul className="mt-3 divide-y rounded-xl border bg-card">{results.rows.length === 0 ? <li className="p-3 text-sm text-muted-foreground">Nenhum município encontrado.</li> : results.rows.map(r => <li key={r.entityId}><Link href={`/municipios/${r.entityId}`} className="flex justify-between gap-3 p-3 text-sm hover:bg-secondary"><span className="font-semibold">{r.name}</span><span className="text-muted-foreground">{formatInt(r.population)} hab.</span></Link></li>)}</ul>}
        </div>
        <div><h2 className="font-display text-xl">Maiores municípios</h2>
          <ol className="mt-2 divide-y rounded-xl border bg-card">{[...munis].sort((a, b) => (b.population ?? 0) - (a.population ?? 0)).slice(0, 6).map(m => <li key={m.entityId}><Link href={`/municipios/${m.entityId}`} className="flex justify-between p-3 text-sm hover:bg-secondary"><span className="font-semibold">{m.name}</span><span className="text-muted-foreground">{formatInt(m.population)}</span></Link></li>)}</ol>
        </div>
      </div>
    </section>

    {hasHealth && <div><HealthPanel scope={state.name} kind="uf" ufCode={state.ufCode!} ufName={state.name} values={panelValues} vaccines={vaccines} facilities={f.total > 0 ? f : null} bench={bench} cnesLabel={lastCnes ? ymLabel(lastCnes.lastCompetence) : 'sem competência'} compact />
      <p className="mt-3 text-sm"><Link href={`/estados/${uf}/saude`} className="font-semibold text-primary hover:underline">Abrir toda a Saúde de {state.name} →</Link></p></div>}

    <Suspense fallback={null}><SecuritySummary kind="uf" code={uf} /></Suspense>

    <section aria-labelledby="areas">
      <h2 id="areas" className="section-hairline pt-3 font-display text-2xl">Áreas temáticas</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{THEMES.map(t => <li key={t.slug}><Link href={`/estados/${uf}/${t.slug}`} className="card-lift flex h-full flex-col rounded-xl border bg-card p-4"><span className="font-display text-lg">{t.label}</span><span className="mt-1 text-xs text-muted-foreground">{t.ready ? (t.slug !== 'saude' || hasHealth ? 'Dados publicados' : 'Coleta pendente neste estado') : 'Em preparação, sem dados'}</span></Link></li>)}</ul>
    </section>

    <section aria-labelledby="cobertura" className="rounded-xl border bg-card p-5 text-sm">
      <h2 id="cobertura" className="font-display text-xl">Cobertura e atualização</h2>
      {coverage.length === 0 ? <p className="mt-2 text-muted-foreground">Nenhuma base de saúde foi coletada para {state.name}. O território e a população vêm do IBGE.</p>
        : <ul className="mt-2 space-y-1 text-muted-foreground">{coverage.map(c => <li key={c.datasetId}><strong className="text-foreground">{c.label}</strong>: {ymLabel(c.firstCompetence)} a {ymLabel(c.lastCompetence)} ({c.slices} recortes)</li>)}</ul>}
      {lastCnes && <p className="mt-2 text-xs text-muted-foreground">Cadastro de estabelecimentos até {ymLabel(lastCnes.lastCompetence)}. Dados estaduais coletados em piloto; leia a metodologia de cada indicador.</p>}
    </section>
  </TerritoryFrame>;
}
