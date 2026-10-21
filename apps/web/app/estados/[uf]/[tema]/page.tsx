import { notFound } from 'next/navigation';
import { TerritoryFrame } from '@/components/territory/state-frame';
import { ThemePlaceholder, THEMES } from '@/components/territory/territory-ui';
import { isUf, loadState } from '@/lib/exec-territory';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ uf: string; tema: string }> };

export default async function EstadoTemaPage({ params }: Props) {
  const { uf: rawUf, tema } = await params;
  if (!isUf(rawUf) || !THEMES.some(t => t.slug === tema && !t.ready)) notFound();
  const uf = rawUf.toUpperCase();
  const state = await loadState(uf); if (!state) notFound();
  const label = THEMES.find(t => t.slug === tema)!.label;
  return <TerritoryFrame crumbs={[{ href: '/estados', label: 'Estados' }, { href: `/estados/${uf}`, label: state.name }, { label }]} kicker={`${state.uf} · ${label}`} title={`${label} em ${state.name}`}
    lede="Esta área ainda não tem dados publicados. A página existe para dizer o que virá e de onde, sem preencher o vazio com números."
    population={state.population?.value ?? null} populationYear={state.population?.year ?? null} base={`/estados/${uf}`} active={tema}>
    <ThemePlaceholder slug={tema} scope={state.name} />
  </TerritoryFrame>;
}
