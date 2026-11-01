import { notFound } from 'next/navigation';
import { TerritoryFrame } from '@/components/territory/state-frame';
import { WellbeingPage } from '@/components/wellbeing/wellbeing-page';
import { loadWellbeingPageCached, scopeOf } from '@/lib/wellbeing/load';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ ibge: string }> };

export async function generateMetadata({ params }: Props) {
  const { ibge } = await params;
  const scope = await scopeOf('municipio', ibge);
  return { title: scope ? `Bem-estar em ${scope.name} (${scope.uf}) · Cívica` : 'Bem-estar · Cívica', description: scope ? `Renda, trabalho, assistência social, cotidiano digital e ação pública em ${scope.name}.` : 'Bem-estar em perspectiva.' };
}

export default async function MunicipioBemEstarPage({ params }: Props) {
  const { ibge } = await params;
  const scope = await scopeOf('municipio', ibge);
  if (!scope) notFound();
  const data = await loadWellbeingPageCached(scope);
  return <TerritoryFrame crumbs={[{ href: '/estados', label: 'Estados' }, { href: `/estados/${scope.uf}`, label: scope.stateName }, { href: `/municipios/${scope.entityId}`, label: scope.name }, { label: 'Bem-estar' }]} kicker={`${scope.name} · Bem-estar`} title={`Bem-estar em ${scope.name}`} lede={data.portrait.lede} population={scope.population?.value ?? null} populationYear={scope.population?.year ?? null} base={`/municipios/${scope.entityId}`} active="bem-estar"><WellbeingPage data={data} hideLede /></TerritoryFrame>;
}
