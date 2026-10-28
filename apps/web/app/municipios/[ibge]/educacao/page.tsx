import { notFound } from 'next/navigation';
import { TerritoryFrame } from '@/components/territory/state-frame';
import { EducationPage } from '@/components/education/education-page';
import { loadEducationPageCached, scopeOf } from '@/lib/education/load';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ ibge: string }> };

export async function generateMetadata({ params }: Props) {
  const { ibge } = await params;
  const scope = await scopeOf('municipio', ibge);
  return { title: scope ? `Educação em ${scope.name} (${scope.uf}) · Cívica` : 'Educação · Cívica', description: scope ? `Como estão escolas, matrículas, aprendizagem e recursos públicos em ${scope.name}.` : 'Educação pública em perspectiva.' };
}

export default async function MunicipioEducacaoPage({ params }: Props) {
  const { ibge } = await params;
  const scope = await scopeOf('municipio', ibge);
  if (!scope) notFound();
  const data = await loadEducationPageCached(scope);
  return <TerritoryFrame crumbs={[{ href: '/estados', label: 'Estados' }, { href: `/estados/${scope.uf}`, label: scope.stateName }, { href: `/municipios/${scope.entityId}`, label: scope.name }, { label: 'Educação' }]} kicker={`${scope.name} · Educação`} title={`Educação em ${scope.name}`} lede="Quantos estudam, o que aprendem em matemática e português, quantos abandonam ou repetem, como são as escolas e quanto se contrata para elas: respostas diretas, com a fonte e a cobertura à vista." population={scope.population?.value ?? null} populationYear={scope.population?.year ?? null} base={`/municipios/${scope.entityId}`} active="educacao"><EducationPage data={data} /></TerritoryFrame>;
}
