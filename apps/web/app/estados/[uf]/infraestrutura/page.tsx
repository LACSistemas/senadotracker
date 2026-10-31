import { notFound } from 'next/navigation';
import { TerritoryFrame } from '@/components/territory/state-frame';
import { InfrastructurePage } from '@/components/infrastructure/infrastructure-page';
import { isUf } from '@/lib/exec-territory';
import { loadInfrastructurePageCached, scopeOf } from '@/lib/infrastructure/load';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ uf: string }> };

export async function generateMetadata({ params }: Props) {
  const { uf } = await params;
  const scope = isUf(uf) ? await scopeOf('uf', uf.toUpperCase()) : null;
  return { title: scope ? `Infraestrutura em ${scope.name} · Cívica` : 'Infraestrutura · Cívica', description: scope ? `Água, ruas, habitação, energia, mobilidade e obras públicas em ${scope.name}.` : 'Infraestrutura em perspectiva.' };
}

export default async function EstadoInfraestruturaPage({ params }: Props) {
  const { uf: raw } = await params;
  if (!isUf(raw)) notFound();
  const scope = await scopeOf('uf', raw.toUpperCase());
  if (!scope) notFound();
  const data = await loadInfrastructurePageCached(scope);
  return <TerritoryFrame crumbs={[{ href: '/estados', label: 'Estados' }, { href: `/estados/${scope.uf}`, label: scope.name }, { label: 'Infraestrutura' }]} kicker={`${scope.name} · Infraestrutura`} title={`Infraestrutura em ${scope.name}`} lede="Condições de ruas e entorno, serviços de água e saneamento, energia, mobilidade e obras públicas registradas — com fonte e cobertura à vista, e o que ainda não está publicado." population={scope.population?.value ?? null} populationYear={scope.population?.year ?? null} base={`/estados/${scope.uf}`} active="infraestrutura"><InfrastructurePage data={data} /></TerritoryFrame>;
}
