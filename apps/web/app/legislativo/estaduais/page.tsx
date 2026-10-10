import { getStateLegislatureOverview, readStateHouseGlances } from '@senadotracker/db';
import { StateLegislatureLanding } from '@/components/state-legislature-landing';
import { webPostgresPool } from '@/lib/postgres-pool';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Deputados estaduais e distritais · Cívica',
  description: 'Explore as Assembleias Legislativas e a Câmara Legislativa do Distrito Federal com dados publicados por cada Casa.',
};

export default async function StateLegislaturePage() {
  const pool = webPostgresPool();
  const [data, glances] = await Promise.all([getStateLegislatureOverview(pool), readStateHouseGlances(pool)]);
  return <StateLegislatureLanding data={data} glances={glances} />;
}
