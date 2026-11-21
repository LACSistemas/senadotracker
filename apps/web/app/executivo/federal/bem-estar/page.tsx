import { TerritoryFrame } from '@/components/territory/state-frame';
import { WellbeingFederalPage } from '@/components/wellbeing/wellbeing-federal-page';
import { loadWellbeingFederalPageCached } from '@/lib/wellbeing/federal';
import { loadStates } from '@/lib/exec-territory';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bem-estar no Brasil · Executivo · Cívica', description: 'Renda, trabalho, rede socioassistencial, cotidiano digital e ação pública — números nacionais, somados a partir dos municípios respondentes.' };

export default async function ExecutivoFederalBemEstarPage() {
  const [data, states] = await Promise.all([loadWellbeingFederalPageCached(), loadStates()]);
  const totalPop = states.reduce((s, st) => s + (st.population ?? 0), 0);
  const popYear = Math.max(...states.map(s => s.year ?? 0));
  return <TerritoryFrame crumbs={[{ href: '/executivo', label: 'Executivo' }, { href: '/executivo/federal', label: 'Governo Federal' }, { label: 'Bem-estar' }]} kicker="Brasil · Bem-estar" title="Bem-estar no Brasil"
    lede={data.conditions.narrative.answer || 'Renda, trabalho, rede socioassistencial, cotidiano digital e ação pública — respostas diretas, com a fonte e a cobertura à vista.'}
    population={totalPop} populationYear={popYear} base="/executivo/federal" active="bem-estar">
    <WellbeingFederalPage data={data} />
  </TerritoryFrame>;
}
