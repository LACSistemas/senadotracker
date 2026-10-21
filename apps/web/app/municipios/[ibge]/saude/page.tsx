import { TerritoryFrame } from '@/components/territory/state-frame';
import { HealthSection } from '@/components/territory/health-section';
import { loadMunicipalityPage } from '@/components/territory/municipality-loader';
import { loadMunicipality, ymLabel } from '@/lib/exec-territory';
import { loadHealthSections } from '@/lib/health-sections';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ ibge: string }> };
export async function generateMetadata({ params }: Props) { const { ibge } = await params; const m = await loadMunicipality(ibge); return { title: m ? `Saúde em ${m.name} (${m.uf}) · Cívica` : 'Saúde · Cívica' }; }

export default async function MunicipioSaudePage({ params }: Props) {
  const { ibge } = await params;
  const d = await loadMunicipalityPage(ibge, true);
  const { m } = d;
  const sections = await loadHealthSections({ entityId: m.entityId, ufCode: m.ufCode!, ufName: m.stateName, scope: m.name, kind: 'municipio' });
  return <TerritoryFrame crumbs={[{ href: '/estados', label: 'Estados' }, { href: `/estados/${m.uf}`, label: m.stateName }, { href: `/municipios/${m.entityId}`, label: m.name }, { label: 'Saúde' }]} kicker={`${m.name} · Saúde`} title={`Saúde em ${m.name}`}
    lede="Rede cadastrada, hospitais, internações de residentes e indicadores, cada um com competência, fonte e ressalvas."
    population={m.population?.value ?? null} populationYear={m.population?.year ?? null} base={`/municipios/${m.entityId}`} active="saude">
    <HealthSection scope={m.name} kind="municipio" ufName={m.stateName} sections={sections} indicators={d.indicators} facilities={d.facilities ?? null} coverage={d.coverage}
      panel={{ scope: m.name, kind: 'municipio', ufCode: m.ufCode!, ufName: m.stateName, values: d.values, vaccines: d.vaccines, facilities: d.facilities ?? null, bench: d.bench, cnesLabel: (() => { const c = d.coverage.find(x => x.datasetId === 3); return c ? ymLabel(c.lastCompetence) : 'sem competência'; })() }} />
  </TerritoryFrame>;
}
