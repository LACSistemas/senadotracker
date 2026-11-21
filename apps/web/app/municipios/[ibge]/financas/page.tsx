import { notFound } from 'next/navigation';
import { TerritoryFrame } from '@/components/territory/state-frame';
import { FinancasTerritoryPage } from '@/components/territory/financas-territory-page';
import { loadMunicipalFinancas, loadMunicipalFinancasHistory } from '@/lib/financas-publicas';
import { loadMunicipality } from '@/lib/exec-territory';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ ibge: string }> };
export async function generateMetadata({ params }: Props) { const { ibge } = await params; const m = await loadMunicipality(ibge); return { title: m ? `Finanças de ${m.name} · Cívica` : 'Finanças · Cívica' }; }

/** P14.5x — mesma leitura/página do governo federal (`FinancasTerritoryPage`), agora para o município: DCA
 * I-C/I-D publicados por município (não só União). Municípios pequenos podem ter lacunas na declaração —
 * o componente já trata ausência como `null`, nunca zero inferido (mesma régua do resto do Cívica). */
export default async function MunicipioFinancasPage({ params }: Props) {
  const { ibge } = await params;
  const m = await loadMunicipality(ibge); if (!m) notFound();
  const base = `/municipios/${m.entityId}`;
  const [financas, financasHistory] = await Promise.all([loadMunicipalFinancas(m.entityId), loadMunicipalFinancasHistory(m.entityId)]);
  return <TerritoryFrame crumbs={[{ href: '/estados', label: 'Estados' }, { href: `/estados/${m.uf}`, label: m.stateName }, { href: base, label: m.name }, { label: 'Finanças' }]} kicker={`Município · ${m.uf}`} title={`Finanças de ${m.name}`}
    lede="De onde vem e para onde vai o dinheiro do município — receita, despesa por função e por categoria econômica, Resultado Primário aproximado e a série histórica completa, com fonte e cobertura declaradas."
    population={m.population?.value ?? null} populationYear={m.population?.year ?? null} base={base} active="financas">
    <FinancasTerritoryPage financas={financas} financasHistory={financasHistory} totalPop={m.population?.value ?? 0} popYear={m.population?.year ?? 0} territory={{ kind: 'municipio', name: m.name }} />
  </TerritoryFrame>;
}
