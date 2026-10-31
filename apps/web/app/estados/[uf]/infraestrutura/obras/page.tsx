import { notFound } from 'next/navigation';
import { TerritoryFrame } from '@/components/territory/state-frame';
import { WorksList } from '@/components/infrastructure/works-list';
import { isUf } from '@/lib/exec-territory';
import { scopeOf } from '@/lib/infrastructure/load';
import { loadWorksListPage } from '@/lib/infrastructure/works';
import type { WorksListFilters } from '@/lib/infrastructure/types';

export const dynamic = 'force-dynamic';
type SP = { page?: string; status?: string; category?: string; agency?: string; scope?: string; from?: string; to?: string; hasPhysical?: string; hasContracts?: string; hasPayment?: string };
type Props = { params: Promise<{ uf: string }>; searchParams: Promise<SP> };

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
  const { uf } = await params;
  const scope = isUf(uf) ? await scopeOf('uf', uf.toUpperCase()) : null;
  return { title: scope ? `Obras públicas em ${scope.name} · Cívica` : 'Obras públicas · Cívica' };
}

export default async function EstadoObrasPage({ params, searchParams }: Props) {
  const { uf: raw } = await params; const sp = await searchParams;
  if (!isUf(raw)) notFound();
  const scope = await scopeOf('uf', raw.toUpperCase());
  if (!scope) notFound();
  const filters = parseFilters(sp);
  const data = await loadWorksListPage({ level: 'UF', ufCode: scope.ufCode }, filters);
  return (
    <TerritoryFrame crumbs={[{ href: '/estados', label: 'Estados' }, { href: `/estados/${scope.uf}`, label: scope.name }, { href: `/estados/${scope.uf}/infraestrutura`, label: 'Infraestrutura' }, { label: 'Obras públicas' }]} kicker={`${scope.name} · Obras públicas`} title={`Obras públicas em ${scope.name}`} lede="Lista completa dos projetos do Obrasgov registrados no estado, com filtros reais do backend e paginação no servidor." population={scope.population?.value ?? null} populationYear={scope.population?.year ?? null} base={`/estados/${scope.uf}`} active="infraestrutura">
      <WorksList data={data} basePath={`/estados/${scope.uf}/infraestrutura/obras`} detailBase="/obras" from={`uf:${scope.uf}`} />
    </TerritoryFrame>
  );
}
