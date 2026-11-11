import { TerritoryFrame } from '@/components/territory/state-frame';
import { InfrastructurePage } from '@/components/infrastructure/infrastructure-page';
import { loadInfrastructureFederalPageCached } from '@/lib/infrastructure/federal';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Infraestrutura no Brasil · Executivo · Cívica', description: 'Água, ruas, habitação, energia, mobilidade e obras públicas — indicadores nacionais, agregados a partir dos 27 estados.' };

export default async function ExecutivoFederalInfraestruturaPage() {
  const data = await loadInfrastructureFederalPageCached();
  return <TerritoryFrame crumbs={[{ href: '/executivo', label: 'Executivo' }, { href: '/executivo/federal', label: 'Governo Federal' }, { label: 'Infraestrutura' }]} kicker="Brasil · Infraestrutura" title="Infraestrutura no Brasil"
    lede={data.hero.lede} population={data.scope.population?.value ?? null} populationYear={data.scope.population?.year ?? null} base="/executivo/federal" active="infraestrutura">
    <InfrastructurePage data={data} />
  </TerritoryFrame>;
}
