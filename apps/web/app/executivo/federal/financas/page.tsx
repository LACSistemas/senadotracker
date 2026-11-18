import { TerritoryFrame } from '@/components/territory/state-frame';
import { FinancasFederalPage } from '@/components/territory/financas-federal-page';
import { FEDERAL_THEMES } from '@/components/territory/territory-ui';
import { loadFederalFinancasDetailed, loadFederalFinancasHistory } from '@/lib/financas-publicas';
import { loadPublicDebtSeries } from '@/lib/public-debt';
import { loadStates } from '@/lib/exec-territory';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Finanças do Governo Federal · Executivo · Cívica', description: 'De onde vem e para onde vai o dinheiro da União — receita, despesa por função e por categoria econômica, Resultado Primário aproximado e a série histórica completa (Siconfi/DCA).' };

export default async function ExecutivoFederalFinancasPage() {
  const [financas, financasHistory, publicDebt, states] = await Promise.all([
    loadFederalFinancasDetailed(),
    loadFederalFinancasHistory(),
    loadPublicDebtSeries(),
    loadStates(),
  ]);
  const totalPop = states.reduce((s, st) => s + (st.population ?? 0), 0);
  const popYear = Math.max(...states.map(s => s.year ?? 0));
  return <TerritoryFrame crumbs={[{ href: '/executivo', label: 'Executivo' }, { href: '/executivo/federal', label: 'Governo Federal' }, { label: 'Finanças' }]}
    kicker="Brasil · Finanças" title="Finanças do Governo Federal"
    lede="De onde vem e para onde vai o dinheiro da União — receita, despesa por função e por categoria econômica, Resultado Primário aproximado e a série histórica completa, com fonte e cobertura declaradas."
    population={totalPop} populationYear={popYear} base="/executivo/federal" active="financas" themes={FEDERAL_THEMES}>
    <FinancasFederalPage financas={financas} financasHistory={financasHistory} publicDebt={publicDebt} totalPop={totalPop} popYear={popYear} />
  </TerritoryFrame>;
}
