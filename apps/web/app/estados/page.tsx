import Link from 'next/link';
import { mapMarkup } from '@/components/brazil-map-markup';
import { paintStateMap, type StatePaint } from '@/components/state-map-paint';
import { MunicipalFinder, formatInt } from '@/components/territory/territory-ui';
import { loadStates } from '@/lib/exec-territory';
import { sequentialRamp, emptyFill } from '@/lib/scale';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Estados e municípios · Cívica', description: 'Território, saúde e representação política em cada estado e município do Brasil, com a cobertura de dados dita sem rodeios.' };

export default async function EstadosPage() {
  const states = await loadStates();
  const pops = states.map(s => s.population ?? 0).sort((a, b) => a - b);
  const edge = [0.2, 0.4, 0.6, 0.8].map(q => pops[Math.floor(q * pops.length)] ?? 0);
  const paints = new Map<string, StatePaint>(states.map(s => {
    const band = s.population === null ? -1 : edge.filter(e => s.population! >= e).length;
    return [s.uf, { fill: band < 0 ? emptyFill : sequentialRamp[band]!, ...(band >= 3 ? { ink: '#fff' } : {}), href: `/estados/${s.uf}`, title: `${s.name}: ${formatInt(s.population)} habitantes (${s.year ?? 's/d'})`, ariaLabel: `${formatInt(s.population)} habitantes` }];
  }));
  const map = paintStateMap(mapMarkup, paints, { variant: 'territory-map', description: 'Estados coloridos pela população residente estimada; selecione um estado para abrir sua página.', emptyFill, href: uf => `/estados/${uf}` });
  const regions = [...new Set(states.map(s => s.region))];
  return (
    <main className="page-shell py-8 sm:py-12">
      <header className="hero-wash rounded-[1.5rem] border p-6 sm:p-12">
        <p className="eyebrow">Estados e municípios</p>
        <h1 className="display-title text-balance mt-3 max-w-3xl text-4xl sm:text-6xl">O Brasil começa no seu município</h1>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">Escolha um estado ou procure uma cidade para ver como está a rede de saúde, quem representa o território no Legislativo e quais áreas já têm dados publicados.</p>
        <div className="mt-6 max-w-xl"><MunicipalFinder action="/municipios" /></div>
      </header>
      <section className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <figure className="min-w-0 rounded-3xl border bg-card p-4 sm:p-6">
          <div className="mx-auto max-w-[620px]" dangerouslySetInnerHTML={{ __html: map }} />
          <figcaption className="mt-3 text-center text-xs text-muted-foreground">População residente estimada (IBGE). Mais escuro, mais habitantes. Geometria licenciada em <a className="underline" href="/licenses/mapa-brasil-svg.txt">licenses</a>.</figcaption>
        </figure>
        <div className="space-y-6">
          {regions.map(r => <section key={r}><h2 className="section-hairline pt-2 font-display text-xl">{r}</h2>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">{states.filter(s => s.region === r).map(s => <li key={s.uf}><Link href={`/estados/${s.uf}`} className="flex items-baseline justify-between gap-3 rounded-lg px-3 py-2 hover:bg-secondary"><span className="font-semibold">{s.name}</span><span className="text-xs text-muted-foreground">{formatInt(s.population)} hab.</span></Link></li>)}</ul></section>)}
        </div>
      </section>
      <p className="mt-8 text-xs text-muted-foreground">Cobertura de saúde nos 27 estados: cadastro de estabelecimentos, leitos e equipamentos (CNES, 2013 a set/2026), internações do SUS (2013 a jul/2026), nascimentos e óbitos infantis (2013 a 2025, 2025 preliminar) e vacinação. Atenção primária e finanças ainda não foram publicadas; cada página indica competência e fonte.</p>
    </main>
  );
}
