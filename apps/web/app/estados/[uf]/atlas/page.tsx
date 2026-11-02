import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TerritoryFrame } from '@/components/territory/state-frame';
import { MunicipalFinder, formatInt } from '@/components/territory/territory-ui';
import { AtlasVivo } from '@/components/territory/atlas-vivo';
import { MapTable } from '@/components/territory/map-table';
import { mapRamps } from '@/lib/scale';
import { MAP_METRICS, mapMetricFor, buildMapValueMaps } from '@/lib/territory-map-metrics';
import { findMunicipalities, isUf, loadGeometry, loadMapValues, loadMunicipalities, loadState } from '@/lib/exec-territory';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ uf: string }>; searchParams: Promise<{ mapa?: string; q?: string; view?: string; municipio?: string; zoom?: string; x?: string; y?: string }> };
export async function generateMetadata({ params }: Props) { const { uf } = await params; const s = isUf(uf) ? await loadState(uf) : null; return { title: s ? `Atlas Vivo de ${s.name} · Cívica` : 'Atlas Vivo · Cívica' }; }

/** P3 — exploração geográfica expandida (Parte VI.11.2 do mandato): mesmos dados do mapa contextual de
 * `/estados/[uf]` (nenhuma consulta nova — reusa `loadMapValues`/`MAP_METRICS` de P3), com o mapa como
 * elemento único e protagonista da tela, zoom/pan, pré-visualização por município e uma tabela íntegra
 * como alternativa de acessibilidade (nunca o mapa como único jeito de acessar o dado). */
export default async function AtlasPage({ params, searchParams }: Props) {
  const { uf: rawUf } = await params; const sp = await searchParams;
  if (!isUf(rawUf)) notFound();
  const uf = rawUf.toUpperCase();
  const state = await loadState(uf); if (!state) notFound();
  const [munis, geometry] = await Promise.all([loadMunicipalities(state.ufCode!), loadGeometry(uf)]);
  const metric = mapMetricFor(sp.mapa);
  const raw = metric.code ? await loadMapValues(state.ufCode!, metric.code) : [];
  const { values, flags, year } = buildMapValueMaps(metric, munis, raw);
  const names = new Map(munis.map(m => [m.entityId, m.name]));
  const missing = geometry ? munis.filter(m => !geometry.items.some(i => i.id === m.entityId)).map(m => m.name) : [];
  const results = sp.q ? await findMunicipalities(sp.q, state.ufCode!, 12) : null;
  const selected = sp.municipio && /^\d+$/.test(sp.municipio) ? Number(sp.municipio) : null;
  const view = sp.view === 'tabela' ? 'tabela' : 'mapa';
  // P6.2 — zoom/pan compartilháveis por URL (Parte VI.11.2 do mandato; P3 deixou isso documentado como
  // pendência). Só usado quando os 3 parâmetros são números finitos; senão o Atlas Vivo abre no padrão.
  const num = (v: string | undefined) => { const n = v ? Number(v) : NaN; return Number.isFinite(n) ? n : undefined; };
  const z = num(sp.zoom), x = num(sp.x), y = num(sp.y);
  const viewProps = z !== undefined && x !== undefined && y !== undefined ? { initialScale: z, initialTx: x, initialTy: y } : {};
  const qs = (extra: string) => `/estados/${uf}/atlas?mapa=${metric.key}${view === 'tabela' ? '&view=tabela' : ''}${extra}`;

  return <TerritoryFrame crumbs={[{ href: '/estados', label: 'Estados' }, { href: `/estados/${uf}`, label: state.name }, { label: 'Atlas Vivo' }]}
    kicker={`${state.regionName ?? 'Brasil'} · ${state.uf} · Atlas Vivo`} title={`Atlas Vivo de ${state.name}`}
    lede={<>Explore os {munis.length} municípios de {state.name} por {metric.label}. Troque o indicador, busque um município ou alterne para a tabela — a mesma base de dados, em três formas de ler.</>}
    population={state.population?.value ?? null} populationYear={state.population?.year ?? null} base={`/estados/${uf}`} active=""
    actions={<Link href={`/estados/${uf}`} className="rounded-full border px-5 py-3 text-sm font-bold hover:border-primary/50">← Voltar à visão geral</Link>}>

    <section aria-labelledby="atlas-indicador" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Indicador do Atlas Vivo" className="flex flex-wrap gap-2">
          {Object.values(MAP_METRICS).map(m => <Link key={m.key} href={`/estados/${uf}/atlas?mapa=${m.key}${view === 'tabela' ? '&view=tabela' : ''}`} aria-current={m.key === metric.key ? 'true' : undefined} title={m.domain} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${m.key === metric.key ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/50'}`}>{m.short}</Link>)}
        </div>
        <div role="group" aria-label="Formato" className="flex gap-1 rounded-full border bg-card p-1 text-xs font-semibold">
          <Link href={`/estados/${uf}/atlas?mapa=${metric.key}`} aria-current={view === 'mapa' ? 'true' : undefined} className={`rounded-full px-3 py-1.5 ${view === 'mapa' ? 'bg-primary text-primary-foreground' : ''}`}>Mapa</Link>
          <Link href={`/estados/${uf}/atlas?mapa=${metric.key}&view=tabela`} aria-current={view === 'tabela' ? 'true' : undefined} className={`rounded-full px-3 py-1.5 ${view === 'tabela' ? 'bg-primary text-primary-foreground' : ''}`}>Tabela</Link>
        </div>
      </div>

      {(() => {
        const search = <div>
          <h2 className="font-display text-lg">Procurar município</h2>
          <div className="mt-2"><MunicipalFinder action={`/estados/${uf}/atlas`} defaultValue={sp.q} /></div>
          {results && <ul className="mt-3 divide-y rounded-xl border">{results.rows.length === 0 ? <li className="p-3 text-sm text-muted-foreground">Nenhum município encontrado.</li>
            : results.rows.map(r => <li key={r.entityId}><Link href={qs(`&municipio=${r.entityId}`)} className="flex justify-between gap-3 p-3 text-sm hover:bg-secondary"><span className="font-semibold">{r.name}</span><span className="text-muted-foreground">{formatInt(r.population)} hab.</span></Link></li>)}</ul>}
        </div>;

        if (values.size === 0 && metric.code) return <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Ainda não há {metric.label} publicado para os municípios de {state.name}. O mapa só é colorido com dado oficial coletado.</p>;
        if (!geometry) return <p className="text-sm text-muted-foreground">Malha municipal indisponível para esta UF.</p>;
        if (view === 'tabela') return <>
          {/* P8.5: na tabela não há aside para a busca integrar — fica como card próprio, igual a antes. */}
          <div className="rounded-2xl border bg-card p-4">{search}</div>
          <MapTable names={names} values={values} flags={flags} metric={metric} />
        </>;
        // P8.5 (mandato §7): busca movida para dentro da aside do Atlas Vivo — a cartografia, não um
        // card cheio de busca, agora é o primeiro elemento visual real da seção (achado de P8.0: até
        // no Atlas Vivo o mapa só aparecia depois de rolar). P8.7: passada como `children` (não um prop
        // nomeado) — ver o comentário em `atlas-vivo.tsx` sobre o aviso de "key" que a versão anterior
        // disparava na serialização Server→Client.
        return <AtlasVivo geometry={geometry} names={names} values={values} flags={flags} metric={metric} ramp={mapRamps[metric.ramp]} missing={missing} initialSelected={selected} stateName={state.name} year={year ?? (state.population?.year ? String(state.population.year) : '—')} {...viewProps}>{search}</AtlasVivo>;
      })()}

      {metric.code === 'IND-SAU-08' && <p className="text-xs text-muted-foreground">Municípios com menos de 100 nascidos no ano não são coloridos: a taxa é instável.</p>}
      <p className="text-xs text-muted-foreground">{metric.domain} · fonte, metodologia e ressalvas completas em <Link href={`/estados/${uf}`} className="font-semibold text-primary hover:underline">{state.name} → áreas temáticas</Link>.</p>
    </section>
  </TerritoryFrame>;
}
