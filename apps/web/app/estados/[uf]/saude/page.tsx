import { notFound } from 'next/navigation';
import { TerritoryFrame } from '@/components/territory/state-frame';
import { HealthSection } from '@/components/territory/health-section';
import { loadHealthSections } from '@/lib/health-sections';
import { isUf, loadBenchmarks, loadCoverage, loadIndicators, loadPanelValues, loadState, loadUfStory, loadVaccinePanel, ymLabel } from '@/lib/exec-territory';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ uf: string }> };
export async function generateMetadata({ params }: Props) { const { uf } = await params; const s = isUf(uf) ? await loadState(uf) : null; return { title: s ? `Saúde em ${s.name} · Cívica` : 'Saúde · Cívica' }; }

export default async function EstadoSaudePage({ params }: Props) {
  const { uf: rawUf } = await params;
  if (!isUf(rawUf)) notFound();
  const uf = rawUf.toUpperCase();
  const state = await loadState(uf); if (!state) notFound();
  const [indicators, story, coverage, values, vaccines, bench] = await Promise.all([loadIndicators(state.entityId), loadUfStory(state.ufCode!), loadCoverage(state.ufCode!), loadPanelValues(state.entityId), loadVaccinePanel(state.entityId), loadBenchmarks()]);
  const cnes = coverage.find(c => c.datasetId === 3);
  const sections = await loadHealthSections({ entityId: state.entityId, ufCode: state.ufCode!, ufName: state.name, scope: state.name, kind: 'uf' });
  return <TerritoryFrame crumbs={[{ href: '/estados', label: 'Estados' }, { href: `/estados/${uf}`, label: state.name }, { label: 'Saúde' }]} kicker={`${state.uf} · Saúde`} title={`Saúde em ${state.name}`}
    lede="Rede cadastrada, leitos e indicadores de saúde com a competência, a fonte e as ressalvas de cada número."
    population={state.population?.value ?? null} populationYear={state.population?.year ?? null} base={`/estados/${uf}`} active="saude">
    <HealthSection scope={state.name} kind="uf" ufName={state.name} sections={sections} indicators={indicators} facilities={story.payload.total > 0 ? story.payload : null} coverage={coverage}
      panel={{ scope: state.name, kind: 'uf', ufCode: state.ufCode!, ufName: state.name, values, vaccines, facilities: story.payload.total > 0 ? story.payload : null, bench, cnesLabel: cnes ? ymLabel(cnes.lastCompetence) : 'sem competência' }} />
  </TerritoryFrame>;
}
