import Link from 'next/link';
import { TerritoryFrame } from '@/components/territory/state-frame';
import { TerritoryHero } from '@/components/territory/territory-hero';
import { PresidentCard } from '@/components/territory/president-card';
import { formatInt } from '@/components/territory/territory-ui';
import { loadStates } from '@/lib/exec-territory';
import { loadHdiComparison } from '@/lib/territory-idhm';
import { loadGdpPerCapita } from '@/lib/territory-executive';
import { loadHdiGlobalComparison } from '@/lib/hdi-global';
import { loadPisaComparison } from '@/lib/pisa';
import { toChartCoverage } from '@/components/judiciary/availability';
import { GroupedBarChart } from '@/components/charts';
import type { PisaSubject } from '@senadotracker/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Governo Federal · Executivo · Cívica', description: 'O presidente, indicadores de referência do Brasil e dois comparadores internacionais — IDH Global e PISA — ao lado dos indicadores nacionais já publicados no Cívica.' };

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const idhmFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/**
 * P14.13 — perfil do governo federal, mesma linguagem visual de `/estados/{uf}` (hero com mapa+executivo,
 * faixa de KPIs). Esta página-mãe é um perfil adicional ("quem governa o Brasil" + comparadores que nenhum
 * estado tem: IDH Global, PISA), não uma reconstrução do hub `/executivo`.
 *
 * P14.14 (feedback real do usuário: "ele não tem a granularidade de saude, educacao... que a do
 * /estados/UF. [...] se temos os dados de todos os estados, a soma deles seria a da união, correto?") —
 * agora SIM usa `TerritoryFrame`/`ThemeTabs` como as páginas de estado, com 5 sub-rotas próprias
 * (`/executivo/federal/{saude,educacao,seguranca,bem-estar,infraestrutura}`) alimentadas pelas funções de
 * leitura já nacionais (`getIdebTerritory({})`, `getOrganizedCrimeNational`, `getWellbeingOverview({entityId:76})`
 * etc. — a maioria já existia, construída em fases anteriores mas nunca exposta numa página própria).
 * Decisão de arquitetura (não widening do `ScopeInfo` compartilhado por 4 domínios ao vivo, ver cada
 * `lib/{tema}/federal.ts`): Infraestrutura reusa literalmente `<InfrastructurePage>` (alargamento local e
 * contido do próprio `InfraScope`); os outros 4 temas têm loader e página federais dedicados, reaproveitando
 * só as peças puras (`ChapterShell`, `TrendChart`, `chart()`/`bars()`/`stat()`), nunca as páginas inteiras
 * de UF (que são fundo-a-fundo acopladas a `scope.kind: 'uf'|'municipio'`).
 */
export default async function ExecutivoFederalPage() {
  const [states, hdiBrasil, gdp, hdiGlobal, pisa] = await Promise.all([
    loadStates(),
    loadHdiComparison({ level: 'BRASIL' }),
    loadGdpPerCapita({ level: 'BRASIL' }),
    loadHdiGlobalComparison(),
    loadPisaComparison(),
  ]);
  const totalPop = states.reduce((s, st) => s + (st.population ?? 0), 0);
  const popYear = Math.max(...states.map(s => s.year ?? 0));
  // `loadHdiComparison({level:'BRASIL'})` devolve o próprio Brasil em `.territory`, não em `.brasil`
  // (que fica null quando o território pedido já é o Brasil — ver territory-idhm.ts; mesmo achado real
  // corrigido em /executivo/page.tsx).
  const idhmBrasil2010 = hdiBrasil.territory?.points.find(p => p.year === 2010)?.idhm ?? null;

  // IDH GLOBAL (PNUD/ONU, via OWID) — Brasil × América do Sul × Mundo, 1990–2023. PARALELO ao IDHM
  // nacional (idhmBrasil2010, PNUD/IPEA/FJP, decenal) — metodologias diferentes, nunca a mesma série.
  // SVG próprio (mesmo motivo do Ideb/tráfico na E7): o MultiLineChart compartilhado desenha TODOS os
  // rótulos do eixo X sem nenhum controle de densidade — com 34 anos, os rótulos se sobrepõem e viram
  // ilegíveis (achado real, confirmado em captura). Também assume comparação "mensal" no texto fixo do
  // componente, que não cabe numa série anual.
  const hdiGlobalYears = [...new Set([...hdiGlobal.brasil, ...hdiGlobal.americaDoSul, ...hdiGlobal.mundo].map(p => p.year))].sort((a, b) => a - b);
  const HDI_SERIES = [
    { key: 'brasil', label: 'Brasil', color: '#115b45', points: hdiGlobal.brasil },
    { key: 'americaDoSul', label: 'América do Sul', color: '#2d7f93', points: hdiGlobal.americaDoSul },
    { key: 'mundo', label: 'Mundo', color: '#9fb8ad', points: hdiGlobal.mundo },
  ] as const;
  const HDI_W = 720, HDI_H = 220, HDI_PAD_B = 28, HDI_PAD_T = 16, HDI_PAD_X = 12;
  const hdiMin = Math.min(...HDI_SERIES.flatMap(s => s.points.map(p => p.hdi))), hdiMax = Math.max(...HDI_SERIES.flatMap(s => s.points.map(p => p.hdi)));
  const hdiX = (i: number) => hdiGlobalYears.length <= 1 ? HDI_W / 2 : HDI_PAD_X + (HDI_W - 2 * HDI_PAD_X) * i / (hdiGlobalYears.length - 1);
  const hdiY = (v: number) => HDI_H - HDI_PAD_B - (HDI_H - HDI_PAD_B - HDI_PAD_T) * (v - hdiMin) / ((hdiMax - hdiMin) || 1);
  const hdiLabelStep = Math.max(1, Math.ceil(hdiGlobalYears.length / 8));
  const hdiGlobalCoverage = `UNDP, Human Development Report, via Our World in Data — ${hdiGlobalYears[0]}–${hdiGlobalYears.at(-1)}`;

  // PISA (OCDE, via OWID) — Brasil × média OCDE × média dos participantes, última edição de cada
  // disciplina. Internacional, só nível-país — nunca na mesma escala do Ideb/Saeb.
  const PISA_SUBJECT_LABEL: Record<PisaSubject, string> = { MATEMATICA: 'Matemática', LEITURA: 'Leitura', CIENCIAS: 'Ciências' };
  const pisaSubjects: PisaSubject[] = ['MATEMATICA', 'LEITURA', 'CIENCIAS'];
  const pisaChartData = pisaSubjects.map(subject => {
    const sub = pisa[subject];
    const latestEdition = Math.max(...sub.brasil.map(p => p.edition), 0);
    return {
      label: PISA_SUBJECT_LABEL[subject],
      values: [
        { label: 'Brasil', value: sub.brasil.find(p => p.edition === latestEdition)?.score ?? null, color: '#115b45' },
        { label: 'Média OCDE', value: sub.mediaOcde.find(p => p.edition === latestEdition)?.score ?? null, color: '#2d7f93' },
        { label: 'Média PISA', value: sub.mediaParticipantes.find(p => p.edition === latestEdition)?.score ?? null, color: '#9fb8ad' },
      ],
      edition: latestEdition,
    };
  });
  const pisaLatestEdition = Math.max(...pisaChartData.map(s => s.edition));
  const pisaCoverage = toChartCoverage('AVAILABLE', `OCDE, PISA Database, via Our World in Data — edição ${pisaLatestEdition}`, { from: `${pisaLatestEdition}-01-01`, to: `${pisaLatestEdition}-12-31`, grain: 'year' });

  return (
    <TerritoryFrame crumbs={[{ href: '/executivo', label: 'Executivo' }, { label: 'Governo Federal' }]} kicker="República Federativa do Brasil" title="Governo Federal"
      lede="O Poder Executivo federal, indicadores de referência do Brasil e dois comparadores que nenhum estado tem: como o IDH e a proficiência escolar do país se posicionam no mundo."
      population={totalPop} populationYear={popYear} base="/executivo/federal" active=""
      heroNode={
        <TerritoryHero context="República Federativa do Brasil" title="Governo Federal" stateName="Brasil" mapMode="estado" geometry={null}
          description="O Poder Executivo federal, indicadores de referência do Brasil e dois comparadores que nenhum estado tem: como o IDH e a proficiência escolar do país se posicionam no mundo."
          population={totalPop} populationYear={popYear}
          executiveSlot={<PresidentCard />}
          actions={<>
            <Link href="/executivo#explorar" className="rounded-full bg-white px-5 py-3 text-sm font-bold text-primary">Explorar o mapa por estado</Link>
            <Link href="/legislativo" className="rounded-full border border-white/40 px-5 py-3 text-sm font-bold text-white hover:bg-white/10">Quem representa o Brasil no Congresso</Link>
          </>} />
      }>
      <div className="page-shell">
        <section aria-labelledby="kpis-federal" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <h2 id="kpis-federal" className="sr-only">Indicadores de referência do Brasil</h2>
          <div className="min-w-0 rounded-2xl border bg-card p-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">PIB per capita</p><p className="hero-figure tnum mt-2 truncate text-3xl text-[#14304f] sm:text-4xl">{gdp ? money.format(gdp.value) : '—'}</p><p className="mt-1 text-xs text-muted-foreground">{gdp ? `${gdp.year} · preços correntes, IBGE/SIDRA` : 'sem dado publicado'}</p></div>
          <div className="min-w-0 rounded-2xl border bg-card p-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">IDHM nacional</p><p className="hero-figure tnum mt-2 truncate text-3xl text-[#14304f] sm:text-4xl">{idhmBrasil2010 != null ? idhmFmt.format(idhmBrasil2010) : '—'}</p><p className="mt-1 text-xs text-muted-foreground">2010 · PNUD/IPEA/FJP, decenal</p></div>
          <div className="min-w-0 rounded-2xl border bg-card p-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">População</p><p className="hero-figure tnum mt-2 truncate text-3xl text-[#14304f] sm:text-4xl">{formatInt(totalPop)}</p><p className="mt-1 text-xs text-muted-foreground">{popYear}, soma das 27 UFs, IBGE</p></div>
          <div className="min-w-0 rounded-2xl border bg-card p-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Municípios e UFs</p><p className="hero-figure tnum mt-2 truncate text-3xl text-[#14304f] sm:text-4xl">5.571</p><p className="mt-1 text-xs text-muted-foreground">27 UFs</p></div>
        </section>
      </div>

      <section className="mt-12 border-t bg-card py-12">
        <div className="page-shell">
          <p className="eyebrow">Como o Brasil se compara ao mundo</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight">Dois comparadores internacionais</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Cada um com sua própria metodologia e fonte — nenhum deles substitui ou se mistura com os indicadores nacionais já publicados no Cívica.</p>
          <div className="mt-8">
            <h3 className="text-lg font-black">IDH Global: Brasil, América do Sul e Mundo</h3>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Índice de Desenvolvimento Humano do PNUD, 1990–2023 — um indicador diferente do IDHM nacional (PNUD/IPEA/FJP, decenal, só 1991/2000/2010, mostrado acima): metodologias distintas, nunca a mesma série nem combinadas.</p>
            <div className="mt-4 rounded-2xl border bg-background p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-sm font-bold">IDH — Brasil, América do Sul e Mundo (1990–2023)</p><span className="text-[0.65rem] text-muted-foreground">{hdiGlobalCoverage}</span></div>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">{HDI_SERIES.map(s => <span key={s.key} className="flex items-center gap-1.5"><i className="size-2.5 rounded-full" style={{ background: s.color }} />{s.label}</span>)}</div>
              <svg viewBox={`0 0 ${HDI_W} ${HDI_H}`} className="mt-3 w-full" role="img" aria-label="IDH, Brasil, América do Sul e Mundo, 1990 a 2023">
                <g stroke="var(--border)" strokeWidth="1"><line x1={HDI_PAD_X} x2={HDI_W - HDI_PAD_X} y1={hdiY(hdiMin)} y2={hdiY(hdiMin)} /><line x1={HDI_PAD_X} x2={HDI_W - HDI_PAD_X} y1={hdiY(hdiMax)} y2={hdiY(hdiMax)} /></g>
                <g fill="var(--muted-foreground)" fontSize="10"><text x={HDI_PAD_X} y={hdiY(hdiMin) - 4}>{hdiMin.toFixed(3)}</text><text x={HDI_PAD_X} y={hdiY(hdiMax) - 4}>{hdiMax.toFixed(3)}</text></g>
                {HDI_SERIES.map(s => (
                  <g key={s.key}>
                    <polyline fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={hdiGlobalYears.map((y, i) => { const p = s.points.find(pt => pt.year === y); return p ? `${hdiX(i)},${hdiY(p.hdi)}` : null; }).filter((x): x is string => x !== null).join(' ')} />
                    {hdiGlobalYears.map((y, i) => { const p = s.points.find(pt => pt.year === y); return p && (i === 0 || i === hdiGlobalYears.length - 1 || i % hdiLabelStep === 0) ? <circle key={y} cx={hdiX(i)} cy={hdiY(p.hdi)} r="2.5" fill={s.color}><title>{`${s.label}, ${y}: ${p.hdi.toFixed(3)}`}</title></circle> : null; })}
                  </g>
                ))}
                <g fill="var(--muted-foreground)" fontSize="10">{hdiGlobalYears.map((y, i) => (i === 0 || i === hdiGlobalYears.length - 1 || i % hdiLabelStep === 0) && <text key={y} x={hdiX(i)} y={HDI_H - 6} textAnchor={i === 0 ? 'start' : i === hdiGlobalYears.length - 1 ? 'end' : 'middle'}>{y}</text>)}</g>
              </svg>
              <details className="mt-3 text-xs"><summary className="focus-ring w-fit cursor-pointer font-bold text-primary">Ver dados do gráfico</summary>
                <table className="mt-2 w-full text-left"><thead><tr><th className="p-1">Ano</th>{HDI_SERIES.map(s => <th key={s.key} className="p-1 text-right">{s.label}</th>)}</tr></thead>
                  <tbody>{hdiGlobalYears.map(y => <tr key={y} className="border-t">
                    <th className="p-1 font-normal">{y}</th>
                    {HDI_SERIES.map(s => <td key={s.key} className="p-1 text-right tabular-nums">{s.points.find(p => p.year === y)?.hdi.toFixed(3) ?? '—'}</td>)}
                  </tr>)}</tbody>
                </table>
              </details>
            </div>
          </div>
          <div className="mt-10">
            <h3 className="text-lg font-black">PISA: Brasil comparado à OCDE e ao mundo</h3>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Proficiência de estudantes de 15 anos em matemática, leitura e ciências, última edição de cada disciplina — comparador internacional, nunca na mesma escala do Ideb/Saeb (INEP).</p>
            <div className="mt-4"><GroupedBarChart title={`PISA — Brasil, média OCDE e média dos participantes (edição mais recente por disciplina)`} data={pisaChartData.map(({ label, values }) => ({ label, values }))} coverage={pisaCoverage} /></div>
          </div>
        </div>
      </section>

      <section className="border-t py-10">
        <div className="page-shell">
          <h2 className="text-xl font-black">Fontes e metodologia</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Presidência: resultado oficial do TSE (foto de candidatura, não de posse). PIB per capita e IDHM nacional: IBGE/SIDRA e PNUD/IPEA/FJP, mesma base usada no restante do Cívica. IDH Global e PISA: UNDP e OCDE, via Our World in Data — indicadores internacionais, paralelos aos nacionais, nunca combinados com eles.</p>
          <Link href="/metodologia" className="mt-4 inline-block text-sm font-bold text-primary underline">Ver metodologia completa</Link>
        </div>
      </section>
    </TerritoryFrame>
  );
}
