import { notFound } from 'next/navigation';
import { TerritoryFrame } from '@/components/territory/state-frame';
import { InfrastructurePage } from '@/components/infrastructure/infrastructure-page';
import { loadInfrastructurePageCached, scopeOf } from '@/lib/infrastructure/load';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ ibge: string }> };

export async function generateMetadata({ params }: Props) {
  const { ibge } = await params;
  const scope = await scopeOf('municipio', ibge);
  return { title: scope ? `Infraestrutura em ${scope.name} (${scope.uf}) · Cívica` : 'Infraestrutura · Cívica', description: scope ? `Água, ruas, habitação, energia, mobilidade e obras públicas em ${scope.name}.` : 'Infraestrutura em perspectiva.' };
}

export default async function MunicipioInfraestruturaPage({ params }: Props) {
  const { ibge } = await params;
  const scope = await scopeOf('municipio', ibge);
  if (!scope) notFound();
  const data = await loadInfrastructurePageCached(scope);
  return <TerritoryFrame crumbs={[{ href: '/estados', label: 'Estados' }, { href: `/estados/${scope.uf}`, label: scope.stateName }, { href: `/municipios/${scope.entityId}`, label: scope.name }, { label: 'Infraestrutura' }]} kicker={`${scope.name} · Infraestrutura`} title={`Infraestrutura em ${scope.name}`} lede={data.hero.lede} population={scope.population?.value ?? null} populationYear={scope.population?.year ?? null} base={`/municipios/${scope.entityId}`} active="infraestrutura"><InfrastructurePage data={data} hideLede /></TerritoryFrame>;
}
