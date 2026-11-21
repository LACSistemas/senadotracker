import { notFound } from 'next/navigation';
import { TerritoryFrame } from '@/components/territory/state-frame';
import { FinancasTerritoryPage } from '@/components/territory/financas-territory-page';
import { loadStateFinancas, loadStateFinancasHistory } from '@/lib/financas-publicas';
import { isUf, loadState } from '@/lib/exec-territory';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ uf: string }> };
export async function generateMetadata({ params }: Props) { const { uf } = await params; const s = isUf(uf) ? await loadState(uf) : null; return { title: s ? `Finanças de ${s.name} · Cívica` : 'Finanças · Cívica' }; }

/** P14.5x — mesma leitura/página do governo federal (`FinancasTerritoryPage`), agora para o estado: DCA
 * I-C/I-D publicados por UF (não só União). Sem série de dívida pública estadual nesta fonte — a seção
 * "Juros x Dívida" do componente cai para só "Juros pagos" quando `publicDebt` não é passado (aqui, nunca). */
export default async function EstadoFinancasPage({ params }: Props) {
  const { uf: rawUf } = await params;
  if (!isUf(rawUf)) notFound();
  const uf = rawUf.toUpperCase();
  const state = await loadState(uf); if (!state) notFound();
  const [financas, financasHistory] = await Promise.all([loadStateFinancas(state.ufCode!), loadStateFinancasHistory(state.ufCode!)]);
  return <TerritoryFrame crumbs={[{ href: '/estados', label: 'Estados' }, { href: `/estados/${uf}`, label: state.name }, { label: 'Finanças' }]} kicker={`${state.uf} · Finanças`} title={`Finanças de ${state.name}`}
    lede="De onde vem e para onde vai o dinheiro do estado — receita, despesa por função e por categoria econômica, Resultado Primário aproximado e a série histórica completa, com fonte e cobertura declaradas."
    population={state.population?.value ?? null} populationYear={state.population?.year ?? null} base={`/estados/${uf}`} active="financas">
    <FinancasTerritoryPage financas={financas} financasHistory={financasHistory} totalPop={state.population?.value ?? 0} popYear={state.population?.year ?? 0} territory={{ kind: 'uf', name: state.name }} />
  </TerritoryFrame>;
}
