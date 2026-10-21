import Link from 'next/link';
import { TerritoryFrame } from '@/components/territory/state-frame';
import { HealthPanel } from '@/components/territory/health-panel';
import { THEMES, formatInt } from '@/components/territory/territory-ui';
import { loadMunicipalityPage } from '@/components/territory/municipality-loader';
import { loadMunicipality, ymLabel } from '@/lib/exec-territory';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ ibge: string }> };
export async function generateMetadata({ params }: Props) { const { ibge } = await params; const m = await loadMunicipality(ibge); return { title: m ? `${m.name} (${m.uf}) · Municípios · Cívica` : 'Município · Cívica' }; }

export default async function MunicipioPage({ params }: Props) {
  const { ibge } = await params;
  const { m, indicators, coverage, values, vaccines, bench } = await loadMunicipalityPage(ibge, false);
  const base = `/municipios/${m.entityId}`;
  const hasHealth = indicators.length > 0;
  const beds = indicators.find(i => i.code === 'IND-SAU-05');
  return <TerritoryFrame crumbs={[{ href: '/estados', label: 'Estados' }, { href: `/estados/${m.uf}`, label: m.stateName }, { label: m.name }]} kicker={`Município · ${m.uf}`} title={m.name}
    lede={hasHealth ? <>{m.name} fica em {m.stateName}.{beds?.value != null ? ` O município tem ${beds.value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} leitos hospitalares por mil habitantes no cadastro.` : ''} Abaixo, o que já foi coletado e conferido; o que ainda não existe aparece como lacuna.</> : <>{m.name} fica em {m.stateName}. Os dados de saúde deste município ainda não foram coletados; a página mostra o território e diz o que falta.</>}
    population={m.population?.value ?? null} populationYear={m.population?.year ?? null} base={base} active=""
    actions={<><Link href={`/estados/${m.uf}`} className="rounded-full border bg-card px-4 py-1.5 text-sm font-semibold hover:border-primary/50">Mapa de {m.stateName}</Link>
      <Link href={`/estados/${m.uf}/representacao`} className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground">Quem representa {m.stateName}</Link></>}>
    {hasHealth && <div><HealthPanel scope={m.name} kind="municipio" ufCode={m.ufCode!} ufName={m.stateName} values={values} vaccines={vaccines} facilities={null} bench={bench} cnesLabel="" compact />
      <p className="mt-3 text-sm"><Link href={`${base}/saude`} className="font-semibold text-primary hover:underline">Rede, hospitais, leitos, vacinas e séries históricas →</Link></p></div>}
    <section aria-labelledby="areas"><h2 id="areas" className="section-hairline pt-3 font-display text-2xl">Áreas temáticas</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{THEMES.map(t => <li key={t.slug}><Link href={`${base}/${t.slug}`} className="card-lift flex h-full flex-col rounded-xl border bg-card p-4"><span className="font-display text-lg">{t.label}</span><span className="mt-1 text-xs text-muted-foreground">{t.ready ? (hasHealth ? 'Dados publicados' : 'Coleta pendente neste município') : 'Em preparação, sem dados'}</span></Link></li>)}</ul></section>
    <section className="rounded-xl border bg-card p-5 text-sm"><h2 className="font-display text-xl">Território</h2>
      <dl className="mt-2 grid gap-2 sm:grid-cols-3"><div><dt className="text-xs text-muted-foreground">Código IBGE</dt><dd className="font-semibold">{m.entityId}</dd></div><div><dt className="text-xs text-muted-foreground">Estado</dt><dd className="font-semibold">{m.stateName}</dd></div><div><dt className="text-xs text-muted-foreground">População</dt><dd className="font-semibold">{formatInt(m.population?.value ?? null)} ({m.population?.year ?? 's/d'})</dd></div></dl>
      {!m.installationDateProven && <p className="mt-2 text-xs text-muted-foreground">A data de instalação do município não foi comprovada em fonte; por isso não é exibida.</p>}
      <p className="mt-2 text-xs text-muted-foreground">Dados de saúde: {coverage.length ? coverage.map(c => `${c.label} até ${ymLabel(c.lastCompetence)}`).join('; ') : 'nenhuma base coletada para este estado'}.</p></section>
  </TerritoryFrame>;
}
