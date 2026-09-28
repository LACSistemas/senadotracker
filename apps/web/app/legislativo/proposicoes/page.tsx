import type { Metadata } from 'next';
import { propositionOperationalBundle } from '@/lib/data';
import { MPV_CASE } from '@/lib/proposicoes/compose';
import type { ScopeKey } from '@/lib/proposicoes/taxonomy';
import { LegislativeSubnav } from '@/components/legislative-subnav';
import { EmptyState } from '@/components/empty-state';
import { CaseSection } from '@/components/proposicoes/case-section';
import { CompositionSection } from '@/components/proposicoes/composition-section';
import { DnaSection } from '@/components/proposicoes/dna-section';
import { ExploreCta } from '@/components/proposicoes/explore-cta';
import { Hero } from '@/components/proposicoes/hero';
import { PropositionSearchBar } from '@/components/proposicoes/proposition-search-bar';
import { RecentSection } from '@/components/proposicoes/recent-section';
import { RhythmSection } from '@/components/proposicoes/rhythm-section';
import { ScopeProvider } from '@/components/proposicoes/scope-toggle';
import { StageSection } from '@/components/proposicoes/stage-section';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Proposições',
  description: 'O que o Congresso registra além dos projetos de lei: composição por função, tramitação das matérias principais, ritmo e eventos recentes, com cobertura declarada.',
};

type Params = Record<string, string | string[] | undefined>;
const scalar = (value: string | string[] | undefined) => (typeof value === 'string' ? value : undefined);

/**
 * Casca fina da página: o servidor calcula o pacote das três visões (Congresso, Câmara, Senado) para o ano escolhido e
 * o provedor de escopo alterna entre elas no cliente, sem recarregar. Só o ano vai pela URL (?ano=), porque muda os dados.
 */
export default async function PropositionsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const query = await searchParams, yearValue = Number(scalar(query.ano));
  const year = Number.isInteger(yearValue) && yearValue >= 1900 && yearValue <= 2100 ? yearValue : undefined;
  const casa = scalar(query.casa), initialScope: ScopeKey = casa === 'camara' || casa === 'senado' ? casa : 'congresso';
  const result = propositionOperationalBundle(year);
  if (result.status === 'unavailable') return <><LegislativeSubnav /><main id="conteudo" tabIndex={-1} className="page-shell py-16"><EmptyState title="Proposições indisponíveis" description={result.message} /></main></>;
  const bundle = result.data;
  return <>
    <LegislativeSubnav />
    <main id="conteudo" tabIndex={-1}>
      <PropositionSearchBar />
      <ScopeProvider initialScope={initialScope} year={bundle.year} comparable={bundle.overview.congress.comparable} years={bundle.years.map(item => item.year)} updatedThrough={bundle.updatedThrough}>
        <Hero facts={bundle.facts} overview={bundle.overview} />
        <CompositionSection overview={bundle.overview} facts={bundle.facts} />
        <StageSection flow={bundle.flow} staleness={bundle.staleness} facts={bundle.facts} />
        <DnaSection party={bundle.dna.party} member={bundle.dna.member} />
        <RhythmSection rhythm={bundle.rhythm} calendar={bundle.calendar} />
        <RecentSection recent={bundle.recent} />
        <CaseSection relation={bundle.relation} href={`/legislativo/proposicoes/${MPV_CASE.source}/${MPV_CASE.id}`} />
        <ExploreCta />
      </ScopeProvider>
    </main>
  </>;
}
