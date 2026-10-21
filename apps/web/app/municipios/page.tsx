import Link from 'next/link';
import { MunicipalFinder, formatInt } from '@/components/territory/territory-ui';
import { Crumbs } from '@/components/territory/state-frame';
import { findMunicipalities, isUf, loadState, loadStates } from '@/lib/exec-territory';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Municípios · Cívica', description: 'Busque qualquer um dos 5.571 municípios brasileiros.' };
type Props = { searchParams: Promise<{ q?: string; uf?: string }> };

export default async function MunicipiosPage({ searchParams }: Props) {
  const sp = await searchParams;
  const states = await loadStates();
  const uf = sp.uf && isUf(sp.uf) ? sp.uf.toUpperCase() : undefined;
  const ufState = uf ? await loadState(uf) : null;
  const term = sp.q?.trim();
  const res = term ? await findMunicipalities(term, ufState?.ufCode ?? undefined, 40) : null;
  return <main className="page-shell py-6 sm:py-10">
    <Crumbs items={[{ href: '/estados', label: 'Estados' }, { label: 'Municípios' }]} />
    <header className="hero-wash rounded-[1.5rem] border p-6 sm:p-10">
      <p className="eyebrow">Municípios</p>
      <h1 className="display-title text-balance mt-2 text-4xl sm:text-5xl">Encontre o seu município</h1>
      <div className="mt-5 max-w-xl"><MunicipalFinder action="/municipios" defaultValue={term} ufHidden={uf} /></div>
      {ufState && <p className="mt-3 text-sm text-muted-foreground">Busca restrita a {ufState.name}. <Link href="/municipios" className="font-semibold text-primary underline">Buscar no Brasil todo</Link></p>}
    </header>
    {res && <section className="mt-8" aria-live="polite"><h2 className="font-display text-2xl">{res.total} resultado(s) para “{term}”</h2>
      <ul className="mt-3 divide-y rounded-xl border bg-card">{res.rows.map(r => <li key={r.entityId}><Link href={`/municipios/${r.entityId}`} className="flex justify-between gap-3 p-3 hover:bg-secondary"><span className="font-semibold">{r.name} <span className="font-normal text-muted-foreground">· {r.uf}</span></span><span className="text-sm text-muted-foreground">{formatInt(r.population)} hab.</span></Link></li>)}</ul>
      {res.total > res.rows.length && <p className="mt-2 text-xs text-muted-foreground">Mostrando os {res.rows.length} mais populosos. Refine a busca ou escolha o estado.</p>}</section>}
    <section className="mt-10"><h2 className="font-display text-2xl">Ou escolha um estado</h2>
      <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">{states.map(s => <li key={s.uf}><Link href={`/estados/${s.uf}`} className="block rounded-lg border bg-card px-3 py-2 text-center text-sm font-semibold hover:border-primary/50" title={s.name}>{s.uf}</Link></li>)}</ul></section>
  </main>;
}
