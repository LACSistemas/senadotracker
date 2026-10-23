import { notFound } from 'next/navigation';
import { SecurityPage } from '@/components/security/security-page';
import { TerritoryFrame } from '@/components/territory/state-frame';
import { loadSecurityPage, scopeOf } from '@/lib/security/load';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ ibge: string }> };
export async function generateMetadata({ params }: Props) { const { ibge } = await params; const s = await scopeOf('municipio', ibge); return { title: s ? `Segurança Pública em ${s.name} (${s.uf}) · Cívica` : 'Segurança · Cívica' }; }

export default async function MunicipioSegurancaPage({ params }: Props) {
  const { ibge } = await params; const scope = await scopeOf('municipio', ibge); if (!scope) notFound();
  const data = await loadSecurityPage(scope);
  return <TerritoryFrame crumbs={[{ href: '/estados', label: 'Estados' }, { href: `/estados/${scope.uf}`, label: scope.stateName }, { href: `/municipios/${scope.entityId}`, label: scope.name }, { label: 'Segurança' }]} kicker={`${scope.name} · Segurança Pública`} title={`Segurança Pública em ${scope.name}`}
    lede="Registros oficiais da cidade e do estado, comparações válidas e o que as fontes não permitem concluir."
    population={scope.population?.value ?? null} populationYear={scope.population?.year ?? null} base={`/municipios/${scope.entityId}`} active="seguranca"><SecurityPage data={data} /></TerritoryFrame>;
}
