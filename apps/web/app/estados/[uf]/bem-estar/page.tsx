import { notFound } from 'next/navigation';
import { TerritoryFrame } from '@/components/territory/state-frame';
import { WellbeingPage } from '@/components/wellbeing/wellbeing-page';
import { isUf } from '@/lib/exec-territory';
import { loadWellbeingPageCached, scopeOf } from '@/lib/wellbeing/load';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ uf: string }> };

export async function generateMetadata({ params }: Props) {
  const { uf } = await params;
  const scope = isUf(uf) ? await scopeOf('uf', uf.toUpperCase()) : null;
  return { title: scope ? `Bem-estar em ${scope.name} · Cívica` : 'Bem-estar · Cívica', description: scope ? `Renda, trabalho, assistência social, cotidiano digital e ação pública em ${scope.name}.` : 'Bem-estar em perspectiva.' };
}

export default async function EstadoBemEstarPage({ params }: Props) {
  const { uf: raw } = await params;
  if (!isUf(raw)) notFound();
  const scope = await scopeOf('uf', raw.toUpperCase());
  if (!scope) notFound();
  const data = await loadWellbeingPageCached(scope);
  return <TerritoryFrame crumbs={[{ href: '/estados', label: 'Estados' }, { href: `/estados/${scope.uf}`, label: scope.name }, { label: 'Bem-estar' }]} kicker={`${scope.name} · Bem-estar`} title={`Bem-estar em ${scope.name}`} lede="O que se sabe, com fonte e cobertura à vista, sobre renda, trabalho formal, assistência social, serviços digitais declarados e gasto público em assistência social — e o que ainda não se sabe." population={scope.population?.value ?? null} populationYear={scope.population?.year ?? null} base={`/estados/${scope.uf}`} active="bem-estar"><WellbeingPage data={data} /></TerritoryFrame>;
}
