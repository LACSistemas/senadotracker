import Link from 'next/link';
import { ArrowRight, Banknote, Building2, Flag, Gavel, GraduationCap, HeartPulse, Landmark, MapPinned, Route, Scale, Search, Users } from 'lucide-react';
import { GlobalSearch } from '@/components/global-search';
import { mapMarkup } from '@/components/brazil-map-markup';
import { paintStateMap, markupUfs, type StatePaint } from '@/components/state-map-paint';
import { sequentialRamp } from '@/lib/scale';
import { loadStates, loadNationalHealthSummary } from '@/lib/exec-territory';
import { loadHdiAllStates } from '@/lib/territory-idhm';
import { houseListing } from '@/lib/data';
import { loadJudiciaryOverview, loadJudiciaryNationalSeries, loadJudiciaryTribunalDirectory } from '@/lib/judiciary';
import { getIdebTerritory, getInfrastructureEditorialKpis } from '@senadotracker/db';
import { webPostgresPool } from '@/lib/postgres-pool';
import { layoutHemicycle, type PartyComposition } from '@/lib/hemicycle';
import { partyColor, NEUTRAL_PARTY_COLOR } from '@/lib/party-colors';

export const dynamic = 'force-dynamic';

const int = new Intl.NumberFormat('pt-BR');

export default async function HomePage() {
  const [states, hdiStates, camaraListing, judOverview, judSeries, tribunalDir, health, idebBrasil, infraKpis] = await Promise.all([
    loadStates(),
    loadHdiAllStates(),
    houseListing('camara', { page: 1, pageSize: 1 }),
    loadJudiciaryOverview(2025),
    loadJudiciaryNationalSeries(['JN_CASES_NEW_G1', 'JN_CASES_NEW_G2', 'JN_DISPOSED']),
    loadJudiciaryTribunalDirectory({ pageSize: 1 }),
    loadNationalHealthSummary(),
    getIdebTerritory(webPostgresPool(), { stage: 1 }),
    getInfrastructureEditorialKpis(webPostgresPool(), { level: 'BRASIL' }),
  ]);

  const totalPop = states.reduce((s, st) => s + (st.population ?? 0), 0);
  const composition = camaraListing.status === 'available' ? (camaraListing.data as { composition?: PartyComposition }).composition : undefined;
  const totalTribunais = tribunalDir.total;
  const idebYear = idebBrasil ? Math.max(...idebBrasil.editions) : null;
  const idebBrasilRow = (idebBrasil?.rows as any[] | undefined)?.find(r => r.dep === 0 && r.year === idebYear);

  // Mapa do hero: colorido por IDHM 2010 (único ano recente real desta base — o mock mostra "2023", que
  // não existe aqui; ver docs/homepage-v0/H0_AUDITORIA.md §3).
  const ufHdi = new Map(hdiStates.map(h => [h.entityId, h.idhm]));
  const stateByUfCode = new Map(states.map(s => [s.ufCode, s.uf]));
  const idhmByUf = new Map<string, number>();
  for (const [ufCode, idhm] of ufHdi) { const uf = stateByUfCode.get(ufCode); if (uf) idhmByUf.set(uf, idhm); }
  const HDI_EDGES = [0.5, 0.6, 0.65, 0.7, 0.75, 0.8];
  const paints = new Map<string, StatePaint>(markupUfs(mapMarkup).map(uf => {
    const value = idhmByUf.get(uf);
    const band = value == null ? -1 : HDI_EDGES.filter(e => value >= e).length - 2;
    const clamped = Math.max(0, Math.min(sequentialRamp.length - 1, band));
    return [uf, { fill: value == null ? '#e8efe9' : sequentialRamp[clamped]!, ...(clamped >= 3 ? { ink: '#fff' } : {}), href: `/estados/${uf}`, title: `${states.find(s => s.uf === uf)?.name ?? uf}: IDHM ${value != null ? value.toFixed(3) : 's/d'} (2010)`, ariaLabel: value != null ? `IDHM ${value.toFixed(3)}` : 'sem dado' }];
  }));
  const heroMap = paintStateMap(mapMarkup, paints, { variant: 'home-idhm-map', emptyFill: '#e8efe9', description: 'Estados coloridos pelo IDHM 2010; selecione um estado para abrir seu perfil.', href: uf => `/estados/${uf}` });

  const byId = new Map((judOverview.data as any)?.metrics?.map((m: any) => [m.indicator_id, m]) ?? []);
  const disposed = (byId.get('JN_DISPOSED') as any)?.value ?? null;
  const magistrates = ((judOverview.data as any)?.metrics as any[])?.find(m => m.indicator_id === 'JN_ACTIVE_MAGISTRATES')?.value ?? null;

  const seriesItems = (judSeries.data as any).items as Array<{ indicator_id: string; reference_year: number; value: string | number | null }>;
  const years = [...new Set(seriesItems.map(i => i.reference_year))].sort((a, b) => a - b).filter(y => y >= 2016);
  const val = (indicatorId: string, year: number) => { const row = seriesItems.find(i => i.indicator_id === indicatorId && i.reference_year === year); return row?.value != null ? Number(row.value) : null; };
  const justiceChart = years.map(y => ({ label: String(y), values: [
    { label: 'Entradas', value: (val('JN_CASES_NEW_G1', y) ?? 0) + (val('JN_CASES_NEW_G2', y) ?? 0) || null, color: '#115b45' },
    { label: 'Baixas', value: val('JN_DISPOSED', y), color: '#7fb69a' },
  ] }));
  // Gráfico protagonista da história "Justiça": linhas reais num SVG dimensionado para o card, com eixos
  // legíveis — não o `MultiLineChart` compartilhado (min-width 620px com rolagem interna, invisível num
  // card estreito), nem a mini-barra compacta da H6 (insuficiente como protagonista, achado H7 §2.2/§5.4).
  const CHART_W = 560, CHART_H = 220, CHART_PAD_L = 44, CHART_PAD_B = 22, CHART_PAD_T = 10;
  const justiceMaxVal = Math.max(...justiceChart.flatMap(d => d.values.map(v => v.value ?? 0)), 1);
  const jx = (i: number) => CHART_PAD_L + (i * (CHART_W - CHART_PAD_L - 8)) / Math.max(1, years.length - 1);
  const jy = (v: number) => CHART_H - CHART_PAD_B - (v / justiceMaxVal) * (CHART_H - CHART_PAD_B - CHART_PAD_T);
  const entradasPts = years.map((y, i) => ({ x: jx(i), y: jy((val('JN_CASES_NEW_G1', y) ?? 0) + (val('JN_CASES_NEW_G2', y) ?? 0)), year: y, v: (val('JN_CASES_NEW_G1', y) ?? 0) + (val('JN_CASES_NEW_G2', y) ?? 0) }));
  const baixasPts = years.map((y, i) => ({ x: jx(i), y: jy(Number(val('JN_DISPOSED', y) ?? 0)), year: y, v: Number(val('JN_DISPOSED', y) ?? 0) }));

  // Educação (história de dados): o mock pergunta se o aprendizado "evoluiu" — uma fotografia de um ano
  // não demonstra evolução (H7 §5.3). Em vez do mapa de nível único da H6, mapa de VARIAÇÃO do Ideb entre
  // as duas edições mais recentes (2023→2025, ambas publicadas para as 27 UFs e oficialmente comparáveis
  // segundo a Nota Informativa do Ideb 2025 — não são anos de meta, mas o INEP as trata como comparáveis
  // às edições anteriores). Paleta divergente (queda/estável/alta) reaproveitando os tokens de mapa já
  // validados do design system (--map-rose-*/--map-blue-*), não uma paleta nova.
  const idebEditions = idebBrasil ? [...idebBrasil.editions].sort((a, b) => a - b) : [];
  const idebYearTo = idebEditions.at(-1) ?? idebYear;
  const idebYearFrom = idebEditions.at(-2) ?? null;
  const idebDeltaByUf = new Map<string, { from: number; to: number } | null>();
  await Promise.all(states.map(async s => {
    const r = await getIdebTerritory(webPostgresPool(), { ufCode: s.ufCode, stage: 1 });
    const rowTo = (r?.rows as any[] | undefined)?.find(x => x.dep === 0 && x.year === idebYearTo);
    const rowFrom = idebYearFrom != null ? (r?.rows as any[] | undefined)?.find(x => x.dep === 0 && x.year === idebYearFrom) : undefined;
    idebDeltaByUf.set(s.uf, rowTo && rowFrom ? { from: rowFrom.values.ideb, to: rowTo.values.ideb } : null);
  }));
  const DIVERGING_DOWN = ['var(--map-rose-4)', 'var(--map-rose-2)'] as const;
  const DIVERGING_FLAT = '#e9e7e0';
  const DIVERGING_UP = ['var(--map-blue-2)', 'var(--map-blue-4)'] as const;
  const idebPaints = new Map<string, StatePaint>(markupUfs(mapMarkup).map(uf => {
    const pair = idebDeltaByUf.get(uf);
    const delta = pair ? Math.round((pair.to - pair.from) * 10) / 10 : null;
    const fill = delta == null ? '#e8efe9' : delta <= -0.3 ? DIVERGING_DOWN[0] : delta < 0 ? DIVERGING_DOWN[1] : delta === 0 ? DIVERGING_FLAT : delta < 0.3 ? DIVERGING_UP[0] : DIVERGING_UP[1];
    const ink = delta != null && (delta <= -0.3 || delta >= 0.3) ? '#fff' : undefined;
    const label = delta == null ? 's/d' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`;
    return [uf, { fill, ...(ink ? { ink } : {}), href: `/estados/${uf}`, title: `${states.find(s => s.uf === uf)?.name ?? uf}: Ideb ${pair ? `${pair.from.toFixed(1)} → ${pair.to.toFixed(1)} (${label})` : 's/d'}`, ariaLabel: delta != null ? `variação ${label}` : 'sem dado' }];
  }));
  const idebMap = paintStateMap(mapMarkup, idebPaints, { variant: 'home-ideb-delta-map', emptyFill: '#e8efe9', description: `Variação do Ideb (anos iniciais) entre ${idebYearFrom ?? '—'} e ${idebYearTo}, por UF.`, href: uf => `/estados/${uf}` });
  const idebImproved = [...idebDeltaByUf.values()].filter(p => p && p.to - p.from > 0).length;
  const idebDeclined = [...idebDeltaByUf.values()].filter(p => p && p.to - p.from < 0).length;

  // Cartão "Executivo" (Três poderes): nada de mapa aqui — o hero e a história de Educação já usam a
  // cartografia nacional para propósitos diferentes (nível de IDHM; variação de Ideb); um 3º mapa repetiria
  // a mesma silhueta sem acrescentar diferenciação (achado do usuário em H7 §2.3/§6.2). "Serviços e
  // condições de vida nos territórios" vira uma pequena composição de 3 dimensões reais e independentes
  // (saúde/educação/infraestrutura urbana), cada uma com sua própria unidade e régua — não um mapa.
  const roadInfra = (infraKpis as any[] | undefined)?.find(k => k.title?.includes('via pavimentada'));
  const bedsPerThousand = health.bedsExisting / totalPop * 1000;
  const serviceMeters = [
    { label: 'Saúde · leitos SUS/mil hab.', value: bedsPerThousand, display: bedsPerThousand.toFixed(2), frac: Math.min(1, bedsPerThousand / 4), source: 'CNES' },
    { label: `Educação · Ideb anos iniciais (${idebYear})`, value: idebBrasilRow ? Number(idebBrasilRow.values.ideb) : null, display: idebBrasilRow ? String(idebBrasilRow.values.ideb) : '—', frac: idebBrasilRow ? Math.min(1, Number(idebBrasilRow.values.ideb) / 10) : 0, source: 'INEP' },
    { label: 'Infraestrutura · via pavimentada no entorno', value: roadInfra?.value ?? null, display: roadInfra ? `${Number(roadInfra.value).toFixed(1)}%` : '—', frac: roadInfra ? Math.min(1, Number(roadInfra.value) / 100) : 0, source: `Censo ${roadInfra?.referenceYear ?? ''} (IBGE)` },
  ];

  // Cartão "Judiciário" (Três poderes): composição por ramo da Justiça (quem baixa mais processos), não a
  // série temporal já usada na história de Justiça (H2) — estrutura, não movimento, para não duplicar o
  // mesmo gráfico duas vezes na página (H7 §6.3). Dado já carregado em `judOverview`, nenhuma consulta nova.
  const BRANCH_LABEL: Record<string, string> = { ESTADUAL: 'Estadual', FEDERAL: 'Federal', TRABALHO: 'Trabalho', ELEITORAL: 'Eleitoral', SUPERIOR: 'Tribunais superiores', MILITAR: 'Militar estadual' };
  const branchDisposed = ((judOverview.data as any)?.branches as any[] | undefined ?? [])
    .map(b => ({ code: String(b.code), name: BRANCH_LABEL[String(b.code)] ?? String(b.name), value: Number((b.metrics as any[] | undefined)?.find(m => m.indicatorId === 'JN_DISPOSED')?.value ?? NaN) }))
    .filter(b => Number.isFinite(b.value) && b.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 4);
  const branchMax = Math.max(...branchDisposed.map(b => b.value), 1);

  // Expense categories (história "Gastos públicos"): as 3 maiores rubricas nominais e mutuamente exclusivas
  // da despesa do Judiciário (magistrados/servidores/benefícios) — validado contra JN_EXPENSE_TOTAL: as 3
  // somam ~R$157,8bi dos R$164,6bi publicados (outras rubricas, ~4%, não nomeadas aqui — por isso o rótulo
  // é "maiores categorias", nunca "composição total"; não inventamos uma 4ª fatia para fechar 100%).
  const expenseCategories = [
    { label: 'Servidores', value: Number((byId.get('JN_EXPENSE_SERVERS') as any)?.value ?? 0) },
    { label: 'Magistrados', value: Number((byId.get('JN_EXPENSE_MAGISTRATES') as any)?.value ?? 0) },
    { label: 'Benefícios', value: Number((byId.get('JN_EXPENSE_BENEFITS') as any)?.value ?? 0) },
  ].filter(c => c.value > 0);
  const expenseTotal = Number((byId.get('JN_EXPENSE_TOTAL') as any)?.value ?? 0);
  const expenseMax = Math.max(...expenseCategories.map(c => c.value), 1);
  const moneyCompact = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });

  // Hemiciclo compacto (cartão "Legislativo", Três poderes): geometria real (`layoutHemicycle`, a mesma
  // usada em /legislativo), não a composição reduzida da H6 — mandato H7 §6.1 pede de volta a identidade
  // parlamentar mais forte. Versão sem a legenda/lista completa do `PartyHemicycle` (componente de página
  // inteira) para caber num cartão compacto, mas com a mesma fatia-por-partido contínua.
  const hemicycle = composition && composition.total > 0 ? layoutHemicycle(composition.parties.map(p => p.seats)) : null;
  const hemicycleTop = composition ? [...composition.parties].sort((a, b) => b.seats - a.seats).slice(0, 4) : [];

  const QUESTIONS = [
    ['Como está minha cidade?', 'Saúde, educação, serviços e comparações', '/estados', MapPinned],
    ['Quem me representa?', 'Parlamentares, mandatos e atuação', '/legislativo', Users],
    ['Como o dinheiro público é utilizado?', 'Despesas, contratos e recursos disponíveis', '/executivo', Banknote],
    ['Como funciona a Justiça?', 'Processos, tribunais e duração', '/judiciario', Scale],
    ['Quais dados sustentam essas informações?', 'Fontes, cobertura e metodologia', '/metodologia', Search],
  ] as const;

  return (
    <main id="conteudo" tabIndex={-1}>
      <section className="page-shell py-6 sm:py-8">
        <div className="relative isolate overflow-hidden rounded-[1.75rem] text-white">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#0a2f26] via-[#0e4939] to-[#123f33]" />
          <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[0.92fr_1.08fr] lg:gap-10 lg:p-14">
            <div className="flex flex-col justify-center">
              <p className="eyebrow text-white/70">Inteligência pública do Brasil</p>
              <h1 className="display-title text-balance mt-4 text-[2.6rem] leading-[1.05] sm:text-7xl lg:text-[3.3rem] lg:leading-[1.08]">Entenda o poder.<br />Descubra o país.</h1>
              <p className="mt-5 max-w-md text-base leading-7 text-white/80 sm:text-lg">Explore os três poderes, as políticas públicas e a Justiça brasileira com dados oficiais, contexto e fontes verificáveis.</p>
              <div className="mt-7 w-full max-w-lg"><GlobalSearch variant="hero" /></div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Link href="/municipios" className="rounded-full border border-white/35 px-3 py-1 text-xs font-bold text-white hover:bg-white/10">Municípios</Link>
                <Link href="/estados" className="rounded-full border border-white/35 px-3 py-1 text-xs font-bold text-white hover:bg-white/10">Estados</Link>
                <Link href="/legislativo" className="rounded-full border border-white/35 px-3 py-1 text-xs font-bold text-white hover:bg-white/10">Parlamentares</Link>
                <Link href="/judiciario/tribunais" className="rounded-full border border-white/35 px-3 py-1 text-xs font-bold text-white hover:bg-white/10">Tribunais</Link>
              </div>
            </div>

            <div className="flex flex-col rounded-2xl bg-white/[0.05] p-5 ring-1 ring-inset ring-white/10 sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-white/60">Brasil em dados</p>
                <p className="text-xs text-white/45">IDHM 2010 · PNUD/IPEA/FJP</p>
              </div>
              <div className="mx-auto mt-2 w-full max-w-[360px]" dangerouslySetInnerHTML={{ __html: heroMap }} />
              <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[0.68rem] text-white/55">
                {sequentialRamp.map((c, i) => <span key={i} className="inline-flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm" style={{ background: c }} /> {['< 0,6', '0,6–0,65', '0,65–0,7', '0,7–0,75', 'maior'][i] ?? ''}</span>)}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-4 border-t border-white/10 pt-5 xl:grid-cols-4">
                <div className="min-w-0"><span className="flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-wide text-white/55"><Users size={12} /> Habitantes</span><strong className="display-title mt-1 block text-[clamp(1.05rem,1.6vw,1.5rem)] leading-none [overflow-wrap:anywhere]">{int.format(totalPop)}</strong><span className="mt-1 block text-[0.65rem] text-white/45">soma das 27 UFs</span></div>
                <div className="min-w-0"><span className="flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-wide text-white/55"><Building2 size={12} /> Municípios</span><strong className="display-title mt-1 block text-[clamp(1.05rem,1.6vw,1.5rem)] leading-none">5.571</strong><span className="mt-1 block text-[0.65rem] text-white/45">inclui Fernando de Noronha</span></div>
                <div className="min-w-0"><span className="flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-wide text-white/55"><Landmark size={12} /> Deputados</span><strong className="display-title mt-1 block text-[clamp(1.05rem,1.6vw,1.5rem)] leading-none">513</strong><span className="mt-1 block text-[0.65rem] text-white/45">em exercício</span></div>
                <div className="min-w-0"><span className="flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-wide text-white/55"><Gavel size={12} /> Tribunais</span><strong className="display-title mt-1 block text-[clamp(1.05rem,1.6vw,1.5rem)] leading-none">{int.format(totalTribunais)}</strong><span className="mt-1 block text-[0.65rem] text-white/45">catálogo CNJ</span></div>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 bg-black/15">
            <div className="flex flex-col divide-y divide-white/10 sm:flex-row sm:divide-x sm:divide-y-0">
              <Link href="/legislativo" className="focus-ring group flex flex-1 items-center gap-3 px-6 py-4 transition hover:bg-white/5 sm:px-8 sm:py-5"><Landmark size={18} className="shrink-0 text-white/70" /><span className="min-w-0"><strong className="block text-sm">Legislativo</strong><span className="block truncate text-xs text-white/60">Representação, decisões e fiscalização</span></span><ArrowRight size={15} className="ml-auto shrink-0 text-white/50 transition group-hover:translate-x-1" /></Link>
              <Link href="/executivo" className="focus-ring group flex flex-1 items-center gap-3 px-6 py-4 transition hover:bg-white/5 sm:px-8 sm:py-5"><Users size={18} className="shrink-0 text-white/70" /><span className="min-w-0"><strong className="block text-sm">Executivo</strong><span className="block truncate text-xs text-white/60">Serviços, políticas públicas e territórios</span></span><ArrowRight size={15} className="ml-auto shrink-0 text-white/50 transition group-hover:translate-x-1" /></Link>
              <Link href="/judiciario" className="focus-ring group flex flex-1 items-center gap-3 px-6 py-4 transition hover:bg-white/5 sm:px-8 sm:py-5"><Scale size={18} className="shrink-0 text-white/70" /><span className="min-w-0"><strong className="block text-sm">Judiciário</strong><span className="block truncate text-xs text-white/60">Processos, tribunais e temas de relevância</span></span><ArrowRight size={15} className="ml-auto shrink-0 text-white/50 transition group-hover:translate-x-1" /></Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t bg-card py-12">
        <div className="page-shell">
          <p className="eyebrow">O Brasil pelos dados</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-3xl font-black tracking-tight">O que os dados revelam sobre o Brasil?</h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Três investigações baseadas em dados oficiais — pergunta, evidência, interpretação e caminho para você se aprofundar.</p>

          {(() => {
            const educacao = <>
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase text-primary"><GraduationCap size={14} /> Educação</p>
              <h3 className="mt-2 text-lg font-black leading-snug">Como o aprendizado mudou entre {idebYearFrom ?? '—'} e {idebYearTo}?</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Variação do Ideb (anos iniciais) por UF: <strong className="text-foreground">{idebImproved} estados melhoraram</strong>, {idebDeclined} pioraram. INEP, edição {idebYearTo}.</p>
              <div className="mx-auto my-auto w-full max-w-[280px] py-2" dangerouslySetInnerHTML={{ __html: idebMap }} />
              <div className="mt-1 flex flex-wrap justify-center gap-x-2 gap-y-1 text-[0.6rem] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm" style={{ background: 'var(--map-rose-4)' }} /> queda forte</span>
                <span className="inline-flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm" style={{ background: '#e9e7e0' }} /> estável</span>
                <span className="inline-flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm" style={{ background: 'var(--map-blue-4)' }} /> alta forte</span>
              </div>
              <Link href="/executivo" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary">Explorar análise <ArrowRight size={13} /></Link>
            </>;
            const justica = <>
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase text-primary"><Scale size={14} /> Justiça</p>
              <h3 className="mt-2 text-xl font-black leading-snug">O que acontece quando entrada e baixa de processos seguem ritmos diferentes?</h3>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">Casos novos e processos baixados no Judiciário brasileiro, soma nacional anual, {years[0]}–{years.at(-1)}. CNJ, Justiça em Números.</p>
              <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="mt-3 h-auto w-full flex-1" role="img" aria-label={`Linha de entradas e linha de baixas por ano, ${years[0]} a ${years.at(-1)}, valor máximo ${int.format(Math.round(justiceMaxVal))}`}>
                <line x1={CHART_PAD_L} y1={CHART_H - CHART_PAD_B} x2={CHART_W - 6} y2={CHART_H - CHART_PAD_B} className="stroke-border" strokeWidth={1} />
                <text x={CHART_PAD_L - 6} y={jy(justiceMaxVal) + 3} textAnchor="end" className="fill-muted-foreground text-[9px]">{int.format(Math.round(justiceMaxVal))}</text>
                <text x={CHART_PAD_L - 6} y={CHART_H - CHART_PAD_B} textAnchor="end" className="fill-muted-foreground text-[9px]">0</text>
                <polyline points={entradasPts.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#115b45" strokeWidth={2.5} />
                <polyline points={baixasPts.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#7fb69a" strokeWidth={2.5} />
                {entradasPts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill="#115b45"><title>{`${p.year}: ${int.format(p.v)} entradas`}</title></circle>)}
                {baixasPts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill="#7fb69a"><title>{`${p.year}: ${int.format(p.v)} baixas`}</title></circle>)}
                {years.map((y, i) => (i === 0 || i === years.length - 1) && <text key={y} x={jx(i)} y={CHART_H - 4} textAnchor={i === 0 ? 'start' : 'end'} className="fill-muted-foreground text-[9px]">{y}</text>)}
              </svg>
              {/* Alternativa textual à série, para leitor de tela (H7 §8.3) — não um <table>: largura
                  preferida de uma tabela com table-layout:auto ignora width:1px do sr-only e extrapola a
                  caixa de layout muito além da viewport mesmo com overflow:hidden (achado real, confirmado
                  isolando o elemento com bisseção de DOM — não é suposição). Lista comum evita o problema. */}
              <ul className="sr-only">
                {years.map(y => <li key={y}>{y}: {int.format(entradasPts.find(p => p.year === y)?.v ?? 0)} entradas, {int.format(baixasPts.find(p => p.year === y)?.v ?? 0)} baixas</li>)}
              </ul>
              <div className="mt-2 flex gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-[#115b45]" /> Entradas</span><span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-[#7fb69a]" /> Baixas</span></div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">Baixas acompanham entradas de perto, mas não as compensam totalmente — o acervo pendente é o estoque publicado pelo CNJ, nunca a diferença entre as duas séries.</p>
              <Link href="/judiciario" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-primary">Explorar análise <ArrowRight size={13} /></Link>
            </>;
            const gastos = <>
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase text-primary"><Banknote size={14} /> Gastos públicos</p>
              <h3 className="mt-2 text-lg font-black leading-snug">O que compõe a despesa do Judiciário?</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">As 3 maiores categorias nominais, soma nacional {judOverview.data && (judOverview.data as any).year}. CNJ, Justiça em Números.</p>
              <div className="my-auto flex flex-1 flex-col justify-center gap-3 py-2">
                {expenseCategories.map(c => (
                  <div key={c.label}>
                    <div className="flex items-baseline justify-between text-xs font-bold"><span>{c.label}</span><span className="tabular-nums">{moneyCompact.format(c.value)}</span></div>
                    <div className="mt-1 h-2.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (c.value / expenseMax) * 100)}%` }} /></div>
                  </div>
                ))}
              </div>
              <p className="text-[0.65rem] leading-4 text-muted-foreground">Juntas, {moneyCompact.format(expenseCategories.reduce((s, c) => s + c.value, 0))} dos {moneyCompact.format(expenseTotal)} de despesa total publicada — o restante está em rubricas não detalhadas aqui (não é uma repartição de 100%).</p>
              <Link href="/judiciario" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-primary">Explorar análise <ArrowRight size={13} /></Link>
            </>;
            const card = (extra: string) => `flex flex-col rounded-2xl border bg-background p-6 ${extra}`;
            return <>
              {/* Desktop/tablet: composição assimétrica — Justiça (a história com a série mais rica) ganha
                  mais largura, em vez dos três cards sempre do mesmo tamanho (achado H7 §4.1/§9.1). */}
              <div className="mt-6 hidden gap-5 lg:grid lg:grid-cols-12">
                <article className={card('lg:col-span-4')}>{educacao}</article>
                <article className={card('lg:col-span-5')}>{justica}</article>
                <article className={card('lg:col-span-3')}>{gastos}</article>
              </div>
              {/* Mobile: uma história por vez, rolagem horizontal com snap nativo (sem autoplay, com a
                  próxima história sempre visível em parte — descobrível por design, não escondida). */}
              <div className="mt-5 lg:hidden">
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Arraste para ver as 3 histórias →</p>
                <div role="region" aria-label="Histórias de dados" tabIndex={0} className="focus-ring -mx-3.5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-3.5 pb-2 sm:-mx-6 sm:px-6">
                  <article className={card('w-[88%] shrink-0 snap-center')}>{educacao}</article>
                  <article className={card('w-[88%] shrink-0 snap-center')}>{justica}</article>
                  <article className={card('w-[88%] shrink-0 snap-center')}>{gastos}</article>
                </div>
              </div>
            </>;
          })()}
        </div>
      </section>

      <section className="py-12">
        <div className="page-shell">
          <h2 className="text-3xl font-black tracking-tight">Três poderes, três perspectivas sobre o Brasil</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Explore cada poder com dados, indicadores e análises próprias.</p>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="flex flex-col rounded-2xl border bg-card p-6">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase text-primary"><Landmark size={14} /> Legislativo</p>
              <h3 className="mt-2 text-xl font-black leading-snug">Quem representa você. E o que faz com esse mandato.</h3>
              <p className="mt-2 text-sm text-muted-foreground">Representação parlamentar: uma cadeira, uma pessoa em exercício.</p>
              {hemicycle && composition && composition.total > 0 && <>
                <svg viewBox={`${-hemicycle.outer - 4} ${-hemicycle.outer - 4} ${2 * (hemicycle.outer + 4)} ${hemicycle.outer + 8}`} role="img" aria-label={`Hemiciclo da Câmara dos Deputados: ${hemicycleTop.map(p => `${p.party} ${p.seats} cadeiras`).join(', ')} e demais partidos, total de ${composition.total} cadeiras`} className="mx-auto mt-3 block h-auto w-full max-w-[260px]">
                  {hemicycle.seats.map((seat, i) => <circle key={i} cx={seat.x} cy={seat.y} r={hemicycle.dotRadius} fill={composition.parties[seat.party]?.party === 'Sem partido' ? NEUTRAL_PARTY_COLOR : partyColor(composition.parties[seat.party]?.party ?? '')} />)}
                </svg>
                <p className="-mt-1 text-center text-sm font-bold text-muted-foreground">{composition.total} deputados federais em exercício</p>
                <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs">
                  {hemicycleTop.map(p => <span key={p.party} className="inline-flex items-center gap-1.5 font-bold"><i className="size-2.5 rounded-full" style={{ background: p.party === 'Sem partido' ? NEUTRAL_PARTY_COLOR : partyColor(p.party) }} />{p.party} <span className="font-normal text-muted-foreground">{p.seats}</span></span>)}
                  {composition.parties.length > 4 && <span className="text-muted-foreground">+{composition.parties.length - 4} partidos</span>}
                </div>
              </>}
              <Link href="/legislativo" className="mt-4 inline-flex w-fit items-center gap-1 rounded-full border px-4 py-2 text-sm font-bold text-primary hover:bg-secondary">Explorar o Legislativo <ArrowRight size={14} /></Link>
            </div>
            <div className="flex flex-col rounded-2xl border bg-card p-6">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase text-primary"><Users size={14} /> Executivo</p>
              <h3 className="mt-2 text-xl font-black leading-snug">O Brasil que você vive, visto pelos dados.</h3>
              <p className="mt-2 text-sm text-muted-foreground">Serviços e condições de vida nos territórios: três dimensões reais, independentes.</p>
              <div className="mt-4 flex flex-1 flex-col justify-center gap-3">
                {serviceMeters.map(m => (
                  <div key={m.label}>
                    <div className="flex items-baseline justify-between text-xs font-bold"><span className="text-muted-foreground">{m.label}</span><span className="tabular-nums text-foreground">{m.display}</span></div>
                    <div className="mt-1 h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, m.frac * 100)}%` }} /></div>
                  </div>
                ))}
              </div>
              <p className="mt-1 text-[0.62rem] leading-4 text-muted-foreground">Cada barra usa sua própria régua (0–4 leitos/mil hab. · 0–10 no Ideb · 0–100% na infraestrutura) — as três não são comparáveis entre si.</p>
              <Link href="/executivo" className="mt-4 inline-flex w-fit items-center gap-1 rounded-full border px-4 py-2 text-sm font-bold text-primary hover:bg-secondary">Explorar o Executivo <ArrowRight size={14} /></Link>
            </div>
            <div className="flex flex-col rounded-2xl border bg-card p-6">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase text-primary"><Scale size={14} /> Judiciário</p>
              <h3 className="mt-2 text-xl font-black leading-snug">O que chega à Justiça. O que é resolvido.</h3>
              <p className="mt-2 text-sm text-muted-foreground">Quem baixa mais processos, por ramo da Justiça — estrutura, não movimento ao longo do tempo.</p>
              <div className="mt-4 flex-1 space-y-2.5">
                {branchDisposed.map(b => (
                  <div key={b.code}>
                    <div className="flex items-baseline justify-between text-xs font-bold"><span>{b.name}</span><span className="tabular-nums">{int.format(b.value)}</span></div>
                    <div className="mt-1 h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-[#115b45]" style={{ width: `${Math.max(4, (b.value / branchMax) * 100)}%` }} /></div>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3">
                <div><p className="text-[0.68rem] font-bold uppercase text-muted-foreground">Magistrados atuantes</p><p className="text-lg font-black">{magistrates != null ? int.format(Number(magistrates)) : '—'}</p></div>
                <div><p className="text-[0.68rem] font-bold uppercase text-muted-foreground">Tribunais</p><p className="text-lg font-black">{int.format(totalTribunais)}</p></div>
              </div>
              <Link href="/judiciario" className="mt-4 inline-flex w-fit items-center gap-1 rounded-full border px-4 py-2 text-sm font-bold text-primary hover:bg-secondary">Explorar o Judiciário <ArrowRight size={14} /></Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t bg-card py-12">
        <div className="page-shell">
          <p className="eyebrow">O Brasil no seu território</p>
          <h2 className="mt-2 text-2xl font-black">Comece pela sua cidade ou estado</h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">Veja indicadores, representantes, políticas e dados da Justiça no seu território.</p>
          <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_auto]">
            <form action="/executivo/buscar" method="get" className="flex max-w-xl flex-col gap-2 sm:flex-row"><label className="sr-only" htmlFor="home-territory-q">Buscar município ou estado</label><input id="home-territory-q" name="q" placeholder="Buscar município ou estado" autoComplete="off" className="h-12 w-full min-w-0 rounded-full border bg-background px-5 text-sm sm:flex-1" /><button type="submit" className="h-12 shrink-0 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground">Buscar</button></form>
            <div className="flex flex-wrap gap-2 text-sm">
              <Link href="/estados" className="focus-ring inline-flex items-center gap-1.5 rounded-full border px-4 py-2 font-bold hover:border-primary"><Flag size={14} /> Atlas dos estados</Link>
              <Link href="/municipios" className="focus-ring inline-flex items-center gap-1.5 rounded-full border px-4 py-2 font-bold hover:border-primary"><Building2 size={14} /> Atlas dos municípios</Link>
              <Link href="/judiciario/comparar" className="focus-ring inline-flex items-center gap-1.5 rounded-full border px-4 py-2 font-bold hover:border-primary"><Scale size={14} /> Comparar tribunais</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell py-12">
        <p className="eyebrow">Comece por uma pergunta</p>
        <h2 className="mt-2 text-2xl font-black">O que você quer entender sobre o Brasil?</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {QUESTIONS.map(([q, hint, href, Icon]) => (
            <Link key={q} href={href} className="focus-ring group flex flex-col rounded-2xl border bg-card p-5 hover:border-primary">
              <div className="flex items-start justify-between"><Icon size={20} className="text-primary" aria-hidden /><ArrowRight size={14} className="text-muted-foreground transition group-hover:translate-x-1" /></div>
              <strong className="mt-3 text-sm leading-snug">{q}</strong>
              <span className="mt-1 text-xs text-muted-foreground">{hint}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-t bg-card py-10">
        <div className="page-shell flex flex-wrap items-center gap-x-10 gap-y-4">
          <div className="flex items-center gap-2 border-r pr-10 text-sm font-bold"><HeartPulse size={16} className="text-primary" /> Dados públicos, com contexto e transparência</div>
          <div><strong className="block text-lg">5.571</strong><span className="text-xs text-muted-foreground">municípios</span></div>
          <div><strong className="block text-lg">27</strong><span className="text-xs text-muted-foreground">estados + DF</span></div>
          <div><strong className="block text-lg">594</strong><span className="text-xs text-muted-foreground">parlamentares federais</span></div>
          <div><strong className="block text-lg">{int.format(totalTribunais)}</strong><span className="text-xs text-muted-foreground">tribunais</span></div>
        </div>
      </section>
    </main>
  );
}
