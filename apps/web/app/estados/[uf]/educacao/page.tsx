import { notFound } from 'next/navigation';
import { TerritoryFrame } from '@/components/territory/state-frame';
import { EducationPage } from '@/components/education/education-page';
import { isUf } from '@/lib/exec-territory';
import { loadEducationPageCached, scopeOf } from '@/lib/education/load';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ uf: string }> };

export async function generateMetadata({ params }: Props) {
  const { uf } = await params;
  const scope = isUf(uf) ? await scopeOf('uf', uf.toUpperCase()) : null;
  return { title: scope ? `Educação em ${scope.name} · Cívica` : 'Educação · Cívica', description: scope ? `Escolas, matrículas, aprendizagem, infraestrutura e recursos públicos da educação em ${scope.name}.` : 'Educação pública em perspectiva.' };
}

export default async function EstadoEducacaoPage({ params }: Props) {
  const { uf: raw } = await params;
  if (!isUf(raw)) notFound();
  const scope = await scopeOf('uf', raw.toUpperCase());
  if (!scope) notFound();
  const data = await loadEducationPageCached(scope);
  return <TerritoryFrame crumbs={[{ href: '/estados', label: 'Estados' }, { href: `/estados/${scope.uf}`, label: scope.name }, { label: 'Educação' }]} kicker={`${scope.name} · Educação`} title={`Educação em ${scope.name}`} lede="Quantos estudam, o que aprendem em matemática e português, quantos abandonam ou repetem, como são as escolas e quanto se contrata para elas: respostas diretas, com a fonte e a cobertura à vista." population={scope.population?.value ?? null} populationYear={scope.population?.year ?? null} base={`/estados/${scope.uf}`} active="educacao"><EducationPage data={data} /></TerritoryFrame>;
}
