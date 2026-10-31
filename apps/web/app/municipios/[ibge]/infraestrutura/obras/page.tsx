import { notFound } from 'next/navigation';
import { TerritoryFrame } from '@/components/territory/state-frame';
import { WorksList } from '@/components/infrastructure/works-list';
import { scopeOf } from '@/lib/infrastructure/load';
import { loadWorksListPage } from '@/lib/infrastructure/works';
import type { WorksListFilters } from '@/lib/infrastructure/types';

export const dynamic = 'force-dynamic';
type SP = { page?: string; status?: string; category?: string; agency?: string; scope?: string; from?: string; to?: string; hasPhysical?: string; hasContracts?: string; hasPayment?: string };
type Props = { params: Promise<{ ibge: string }>; searchParams: Promise<SP> };

function parseFilters(sp: SP): WorksListFilters {
  return {
    page: Math.max(1, Number(sp.page ?? '1') || 1),
    ...(sp.status ? { status: Number(sp.status) } : {}),
    ...(sp.category ? { category: Number(sp.category) } : {}),
    ...(sp.agency ? { agency: sp.agency } : {}),
    ...(sp.scope === 'SINGLE' || sp.scope === 'MULTI' ? { territorialScope: sp.scope as 'SINGLE' | 'MULTI' } : {}),
    ...(sp.from ? { periodFrom: sp.from } : {}),
    ...(sp.to ? { periodTo: sp.to } : {}),
    ...(sp.hasPhysical === 'true' ? { hasPhysicalMeasurement: true } : {}),
    ...(sp.hasContracts === 'true' ? { hasContracts: true } : {}),
    ...(sp.hasPayment === 'true' ? { hasPayment: true } : {}),
  };
}

export async function generateMetadata({ params }: Props) {
  const { ibge } = await params;
  const scope = await scopeOf('municipio', ibge);
  return { title: scope ? `Obras públicas em ${scope.name} · Cívica` : 'Obras públicas · Cívica' };
}

export default async function MunicipioObrasPage({ params, searchParams }: Props) {
  const { ibge } = await params; const sp = await searchParams;
  const scope = await scopeOf('municipio', ibge);
  if (!scope) notFound();
  const filters = parseFilters(sp);
  const data = await loadWorksListPage({ level: 'MUNICIPIO', ibge7: String(scope.entityId) }, filters);
  return (
    <TerritoryFrame crumbs={[{ href: '/estados', label: 'Estados' }, { href: `/estados/${scope.uf}`, label: scope.stateName }, { href: `/municipios/${scope.entityId}`, label: scope.name }, { href: `/municipios/${scope.entityId}/infraestrutura`, label: 'Infraestrutura' }, { label: 'Obras públicas' }]} kicker={`${scope.name} · Obras públicas`} title={`Obras públicas em ${scope.name}`} lede="Lista completa dos projetos do Obrasgov registrados no município, com filtros reais do backend e paginação no servidor." population={scope.population?.value ?? null} populationYear={scope.population?.year ?? null} base={`/municipios/${scope.entityId}`} active="infraestrutura">
      <WorksList data={data} basePath={`/municipios/${scope.entityId}/infraestrutura/obras`} detailBase="/obras" from={`municipio:${scope.entityId}`} />
    </TerritoryFrame>
  );
}
