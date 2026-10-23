import { notFound } from 'next/navigation';
import { SecurityPage } from '@/components/security/security-page';
import { TerritoryFrame } from '@/components/territory/state-frame';
import { isUf } from '@/lib/exec-territory';
import { loadSecurityPage, scopeOf } from '@/lib/security/load';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ uf: string }> };
export async function generateMetadata({ params }: Props) { const { uf } = await params; const s = isUf(uf) ? await scopeOf('uf', uf) : null; return { title: s ? `Segurança Pública em ${s.name} · Cívica` : 'Segurança · Cívica' }; }

export default async function EstadoSegurancaPage({ params }: Props) {
  const { uf: raw } = await params; if (!isUf(raw)) notFound();
  const scope = await scopeOf('uf', raw.toUpperCase()); if (!scope) notFound();
  const data = await loadSecurityPage(scope);
  return <TerritoryFrame crumbs={[{ href: '/estados', label: 'Estados' }, { href: `/estados/${scope.uf}`, label: scope.name }, { label: 'Segurança' }]} kicker={`${scope.name} · Segurança Pública`} title={`Segurança Pública em ${scope.name}`}
    lede="Registros oficiais, comparações válidas e o que as fontes não permitem concluir."
    population={scope.population?.value ?? null} populationYear={scope.population?.year ?? null} base={`/estados/${scope.uf}`} active="seguranca"><SecurityPage data={data} /></TerritoryFrame>;
}
