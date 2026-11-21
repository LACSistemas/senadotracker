import { TerritoryFrame } from '@/components/territory/state-frame';
import { EducationFederalPage } from '@/components/education/education-federal-page';
import { loadEducationFederalPageCached } from '@/lib/education/federal';
import { loadStates } from '@/lib/exec-territory';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Educação no Brasil · Executivo · Cívica', description: 'Matrículas, aprendizagem (Saeb e Ideb), trajetória escolar, infraestrutura e professores — números oficiais do INEP para o Brasil.' };

export default async function ExecutivoFederalEducacaoPage() {
  const [data, states] = await Promise.all([loadEducationFederalPageCached(), loadStates()]);
  const totalPop = states.reduce((s, st) => s + (st.population ?? 0), 0);
  const popYear = Math.max(...states.map(s => s.year ?? 0));
  return <TerritoryFrame crumbs={[{ href: '/executivo', label: 'Executivo' }, { href: '/executivo/federal', label: 'Governo Federal' }, { label: 'Educação' }]} kicker="Brasil · Educação" title="Educação no Brasil"
    lede={data.network.narrative.answer || 'Quantos estudam, o que aprendem em matemática e português, quantos abandonam ou repetem, como são as escolas e quem leciona: respostas diretas, com a fonte e a cobertura à vista.'}
    population={totalPop} populationYear={popYear} base="/executivo/federal" active="educacao">
    <EducationFederalPage data={data} />
  </TerritoryFrame>;
}
