import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TerritoryFrame } from '@/components/territory/state-frame';
import { isUf, loadState } from '@/lib/exec-territory';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ uf: string }> };

/** Porta de entrada da representação política do estado: leva à leitura existente, sem duplicar consultas pesadas nem alterar as páginas legislativas. */
export default async function EstadoRepresentacaoPage({ params }: Props) {
  const { uf: rawUf } = await params;
  if (!isUf(rawUf)) notFound();
  const uf = rawUf.toUpperCase();
  const state = await loadState(uf); if (!state) notFound();
  const cards = [
    { href: `/quem-me-representa?uf=${uf}&casa=camara`, title: 'Deputados federais', text: `A bancada de ${state.name} na Câmara, com partidos, gastos e presença.` },
    { href: `/quem-me-representa?uf=${uf}&casa=senado`, title: 'Senadores', text: `Os três senadores de ${state.name} e seus números.` },
    { href: `/legislativo/estaduais/${uf}/deputados`, title: 'Assembleia Legislativa', text: `Os deputados estaduais de ${state.name}, conforme o que a Casa publica.` },
  ];
  return <TerritoryFrame crumbs={[{ href: '/estados', label: 'Estados' }, { href: `/estados/${uf}`, label: state.name }, { label: 'Representação' }]} kicker={`${state.uf} · Representação`} title={`Quem representa ${state.name}`}
    lede="Os mandatos que decidem sobre o estado, em três níveis do Legislativo. Cada link abre a leitura completa já existente."
    population={state.population?.value ?? null} populationYear={state.population?.year ?? null} base={`/estados/${uf}`} active="">
    <ul className="grid gap-4 md:grid-cols-3">{cards.map(c => <li key={c.href}><Link href={c.href} className="card-lift flex h-full flex-col rounded-xl border bg-card p-6"><span className="font-display text-2xl">{c.title}</span><span className="mt-2 text-sm text-muted-foreground">{c.text}</span><span className="mt-auto pt-4 text-sm font-semibold text-primary">Abrir →</span></Link></li>)}</ul>
  </TerritoryFrame>;
}
