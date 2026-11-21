import { TerritoryFrame } from '@/components/territory/state-frame';
import { SecurityFederalPage } from '@/components/security/security-federal-page';
import { loadSecurityFederalPageCached } from '@/lib/security/federal';
import { loadStates } from '@/lib/exec-territory';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Segurança Pública no Brasil · Executivo · Cívica', description: 'Criminalidade organizada (Sinesp VDE), efetivos, sistema prisional e finanças federais de segurança pública — números nacionais, com cobertura e fonte declaradas.' };

export default async function ExecutivoFederalSegurancaPage() {
  const [data, states] = await Promise.all([loadSecurityFederalPageCached(), loadStates()]);
  const totalPop = states.reduce((s, st) => s + (st.population ?? 0), 0);
  const popYear = Math.max(...states.map(s => s.year ?? 0));
  return <TerritoryFrame crumbs={[{ href: '/executivo', label: 'Executivo' }, { href: '/executivo/federal', label: 'Governo Federal' }, { label: 'Segurança' }]} kicker="Brasil · Segurança Pública" title="Segurança Pública no Brasil"
    lede="Criminalidade organizada, efetivos, sistema prisional e finanças federais de segurança — o que é genuinamente nacional nesta base, nunca uma soma aproximada de fontes estaduais incompatíveis entre si."
    population={totalPop} populationYear={popYear} base="/executivo/federal" active="seguranca">
    <SecurityFederalPage data={data} />
  </TerritoryFrame>;
}
