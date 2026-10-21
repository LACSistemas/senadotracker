import { notFound } from 'next/navigation';
import { TerritoryFrame } from '@/components/territory/state-frame';
import { ThemePlaceholder, THEMES } from '@/components/territory/territory-ui';
import { loadMunicipality } from '@/lib/exec-territory';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ ibge: string; tema: string }> };

export default async function MunicipioTemaPage({ params }: Props) {
  const { ibge, tema } = await params;
  if (!THEMES.some(t => t.slug === tema && !t.ready)) notFound();
  const m = await loadMunicipality(ibge); if (!m) notFound();
  const label = THEMES.find(t => t.slug === tema)!.label;
  return <TerritoryFrame crumbs={[{ href: '/estados', label: 'Estados' }, { href: `/estados/${m.uf}`, label: m.stateName }, { href: `/municipios/${m.entityId}`, label: m.name }, { label }]} kicker={`${m.name} · ${label}`} title={`${label} em ${m.name}`}
    lede="Esta área ainda não tem dados publicados. A página existe para dizer o que virá e de onde, sem preencher o vazio com números."
    population={m.population?.value ?? null} populationYear={m.population?.year ?? null} base={`/municipios/${m.entityId}`} active={tema}>
    <ThemePlaceholder slug={tema} scope={m.name} />
  </TerritoryFrame>;
}
