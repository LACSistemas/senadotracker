import type { Facilities, IndicatorView, PublicationCoverage } from '@senadotracker/db';
import { HealthPanel, type HealthPanelProps } from '@/components/territory/health-panel';
import { EvolutionPanel } from '@/components/territory/evolution-panel';
import { ResidentsPanel } from '@/components/territory/residents-panel';
import { HospitalsPanel } from '@/components/territory/hospitals-panel';
import type { HealthSections } from '@/lib/health-sections';
import { ymLabel } from '@/lib/exec-territory';

/** Seção de Saúde compartilhada por UF e município: painel (7 cards + 3 análises), evolução comparada, moradores e hospitais. Só mostra o que existe; a ausência é explicada. */
export function HealthSection({ scope, kind, ufName, indicators, facilities, coverage, panel, sections }: {
  scope: string; kind: 'uf' | 'municipio'; ufName: string; indicators: IndicatorView[]; facilities: Facilities | null; coverage: PublicationCoverage[]; panel?: HealthPanelProps | undefined; sections: HealthSections;
}) {
  const none = indicators.length === 0 && (!facilities || facilities.total === 0);
  if (none) return <section className="rounded-xl border border-dashed bg-card p-6">
    <p className="eyebrow">Cobertura</p>
    <h2 className="mt-1 font-display text-2xl">Saúde em {scope}: dados ainda não coletados</h2>
    <p className="mt-2 max-w-prose text-sm text-muted-foreground">Não há registro de saúde publicado para este território nas fontes coletadas. Nenhum valor é estimado nem preenchido com zero.</p>
  </section>;
  return <div className="space-y-8">
    {panel && <HealthPanel {...panel} />}
    {sections.tabs.length > 0 && <EvolutionPanel tabs={sections.tabs} scope={scope} />}
    {sections.residents && <ResidentsPanel story={sections.residents} scope={scope} kind={kind} ufName={ufName} />}
    {sections.hospitals && <HospitalsPanel story={sections.hospitals.story} scope={scope} from={sections.hospitals.from} to={sections.hospitals.to} kind={kind} />}
    <section aria-labelledby="fontes" className="rounded-xl border bg-card p-5 text-sm"><h2 id="fontes" className="font-display text-xl">Fontes e competências</h2>
      <ul className="mt-2 space-y-1 text-muted-foreground">{coverage.map(c => <li key={c.datasetId}><strong className="text-foreground">{c.label}</strong>: {ymLabel(c.firstCompetence)} a {ymLabel(c.lastCompetence)}</li>)}</ul>
      <p className="mt-2 text-xs text-muted-foreground">Fontes: DATASUS (CNES, SINASC, SIM, SIH, PNI), IBGE. Ocupação de leitos, resolutividade, satisfação e mortalidade materna não são publicados: ainda não têm metodologia aprovada.</p>
    </section>
  </div>;
}
