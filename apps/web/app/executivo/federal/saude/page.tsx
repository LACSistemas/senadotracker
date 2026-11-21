import { TerritoryFrame } from '@/components/territory/state-frame';
import { HealthFederalPage } from '@/components/territory/health-federal-page';
import { loadHealthFederalPageCached } from '@/lib/health-federal';
import { loadStates } from '@/lib/exec-territory';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Saúde no Brasil · Executivo · Cívica', description: 'Estabelecimentos, hospitais e leitos cadastrados no CNES/DataSUS — panorama nacional e distribuição real entre os 27 estados.' };

export default async function ExecutivoFederalSaudePage() {
  const [data, states] = await Promise.all([loadHealthFederalPageCached(), loadStates()]);
  const totalPop = states.reduce((s, st) => s + (st.population ?? 0), 0);
  const popYear = Math.max(...states.map(s => s.year ?? 0));
  return <TerritoryFrame crumbs={[{ href: '/executivo', label: 'Executivo' }, { href: '/executivo/federal', label: 'Governo Federal' }, { label: 'Saúde' }]} kicker="Brasil · Saúde" title="Saúde no Brasil"
    lede="Rede cadastrada e leitos existentes no Brasil, com a competência, a fonte e a distribuição real entre os 27 estados."
    population={totalPop} populationYear={popYear} base="/executivo/federal" active="saude">
    <HealthFederalPage data={data} />
  </TerritoryFrame>;
}
