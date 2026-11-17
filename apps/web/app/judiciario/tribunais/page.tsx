import type { ReactNode } from 'react';
import Link from 'next/link';
import { BarChart3, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { toChartCoverage } from '@/components/judiciary/availability';
import { loadJudiciaryTribunalDirectory, loadJudiciaryIndicatorDistribution, loadJudiciaryComparison, loadJudiciaryTribunalSeries, loadJudiciaryMethodology } from '@/lib/judiciary';
import { TribunalExplorerCanvas } from '@/components/judiciary/tribunal-explorer-canvas.tsx';
import { MesaWorkspace, type MesaComparisonItem, type MesaHistoryLine } from '@/components/judiciary/mesa-workspace.tsx';
import { MesaBar } from '@/components/judiciary/mesa-bar.tsx';
import { AutoSubmitSelect } from '@/components/judiciary/auto-submit-select.tsx';
import { TribunalDirectory, type DirectoryRow, type QuickAccessItem } from '@/components/judiciary/tribunal-directory.tsx';
import type { IndicatorMethodology } from '@/components/judiciary/methodology-panel.tsx';
import type { DistributionScale, DistributionVis } from '@/components/judiciary/distribution-chart.tsx';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tribunais · Judiciário · Cívica', description: 'Explorador analítico dos tribunais do Poder Judiciário brasileiro: encontre uma instituição ou investigue um indicador, veja a distribuição real entre tribunais e compare até 3 lado a lado.' };

type Params = Record<string, string | string[] | undefined>;
const scalar = (v: string | string[] | undefined) => typeof v === 'string' ? v : undefined;

// Mesmos códigos reais de `jud_branch.code` já confirmados em P14.1/J3.
const BRANCHES = [['ESTADUAL', 'Justiça Estadual'], ['FEDERAL', 'Justiça Federal'], ['TRABALHO', 'Justiça do Trabalho'], ['ELEITORAL', 'Justiça Eleitoral'], ['MILITAR', 'Justiça Militar Estadual'], ['SUPERIOR', 'Tribunais Superiores'], ['STF', 'STF'], ['CNJ', 'CNJ']] as const;
const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const YEARS = [2025, 2024, 2023, 2022, 2021, 2020];
const DIRECTORY_PAGE_SIZE = 12;

// V1.1 (mandato §2.3) — curadoria editorial explícita, não um ranking de popularidade sem evidência
// de acessos. Siglas confirmadas ao vivo contra `jud_tribunal` antes de fixar esta lista (nenhum slug
// inventado); se uma deixar de existir no catálogo, `resolveTribunalBasics` devolve `null` e o chip
// correspondente simplesmente não aparece — nunca um link quebrado.
const QUICK_ACCESS_SIGLAS = ['STF', 'STJ', 'TJSP', 'TJES', 'TJRJ'] as const;

// P14.45 — taxonomia estática das 4 abas da Mesa (mandato §12), validada ao vivo contra
// `jud_jn_indicator` antes de fixar esta lista: todos comparison_eligible=true, todos com dado real
// publicado em 2025 (26 a 91 tribunais, a cobertura varia por indicador — nunca os 93 juntos, STF/CNJ
// não entram no Justiça em Números). Reaproveitada tanto pelo seletor de indicador da Distribuição
// quanto pelas abas da Mesa — mesmo vocabulário nos 2 modos.
const TRIBUNAL_TABS = {
  movimento: { label: 'Movimento processual', indicators: [
    { id: 'JN_CASES_NEW_G1', label: 'Casos novos — 1º grau' },
    { id: 'JN_CASES_NEW_G2', label: 'Casos novos — 2º grau' },
    { id: 'JN_DISPOSED', label: 'Processos baixados' },
    { id: 'JN_CASES_PENDING', label: 'Processos pendentes' },
    { id: 'JN_CLEARANCE_INDEX', label: 'Índice de atendimento à demanda' },
  ] },
  tempo: { label: 'Tempo e congestionamento', indicators: [
    { id: 'JN_CONGESTION_RATE', label: 'Taxa de congestionamento' },
    { id: 'JN_TIME_DISPOSED_MEAN', label: 'Tempo médio dos baixados' },
  ] },
  pessoal: { label: 'Pessoas e estrutura', indicators: [
    { id: 'JN_ACTIVE_MAGISTRATES', label: 'Magistrados atuantes' },
    { id: 'JN_EFFECTIVE_STAFF', label: 'Pessoal efetivo' },
    { id: 'JN_MAGISTRATES_PER_100K', label: 'Magistrados por 100 mil habitantes' },
    { id: 'JN_STAFF_PER_100K', label: 'Servidores por 100 mil habitantes' },
  ] },
  financas: { label: 'Despesas e recursos', indicators: [
    { id: 'JN_EXPENSE_TOTAL', label: 'Despesa total' },
    { id: 'JN_EXPENSE_PER_CAPITA', label: 'Despesa total por habitante' },
    { id: 'JN_EXPENSE_PER_MAGISTRATE', label: 'Despesa média por magistrado' },
    { id: 'JN_EXPENSE_SERVERS', label: 'Despesa com servidores' },
    { id: 'JN_EXPENSE_BENEFITS', label: 'Despesas com benefícios' },
    { id: 'JN_EXPENSE_MAGISTRATES', label: 'Despesa com magistrados' },
    { id: 'JN_REVENUE_TOTAL', label: 'Receita total' },
  ] },
} as const;
type TabId = keyof typeof TRIBUNAL_TABS;
const TAB_IDS = Object.keys(TRIBUNAL_TABS) as TabId[];
const ALL_INDICATORS = TAB_IDS.flatMap(tab => TRIBUNAL_TABS[tab].indicators.map(i => ({ ...i, tab })));
const indicatorMeta = (id: string) => ALL_INDICATORS.find(i => i.id === id) ?? null;

// Perguntas investigativas de abertura (mandato §15) — cada uma mapeia pra 1 indicador real já
// validado acima, nunca uma pergunta cuja resposta dependa de dado não integrado.
const OPENING_QUESTIONS: Array<{ label: string; indicatorId: string }> = [
  { label: 'Como varia o congestionamento entre tribunais?', indicatorId: 'JN_CONGESTION_RATE' },
  { label: 'Como variam os processos baixados entre tribunais?', indicatorId: 'JN_DISPOSED' },
  { label: 'Como variam os tempos processuais?', indicatorId: 'JN_TIME_DISPOSED_MEAN' },
  { label: 'Como se distribuem as despesas entre os tribunais?', indicatorId: 'JN_EXPENSE_TOTAL' },
  { label: 'Qual é a estrutura de pessoal das instituições?', indicatorId: 'JN_ACTIVE_MAGISTRATES' },
];
const DEFAULT_INDICATOR = OPENING_QUESTIONS[0]!.indicatorId;

const UNIT_LABEL: Record<string, string> = { proportion: '%', processos: 'processos', people: 'pessoas', days: 'dias', ratio: 'índice', per_100k_inhabitants: 'por 100 mil hab.', BRL_nominal: 'R$', BRL_per_capita: 'R$' };
function formatterFor(unit: string): (v: number) => string {
  // Achado real: `.toFixed(1)` monta o "%" manualmente com ponto decimal (ex. "6.4%"), nunca vírgula
  // pt-BR — ficou visível ao criar a coluna "Congestionamento" do diretório, mas afetava qualquer
  // leitura em proporção no Canvas (eixo, narrativa, tabela). `Intl.NumberFormat('pt-BR', {style:
  // 'percent'})` já faz a conta certa (×100 embutido) com separador correto.
  if (unit === 'proportion') return v => new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 }).format(v);
  if (unit === 'BRL_nominal' || unit === 'BRL_per_capita') return v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: Math.abs(v) >= 1_000_000 ? 'compact' : 'standard', maximumFractionDigits: Math.abs(v) >= 1_000_000 ? 1 : 0 }).format(v);
  if (unit === 'days') return v => `${Math.round(v)} dias`;
  if (unit === 'per_100k_inhabitants') return v => `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(v)}/100 mil hab.`;
  if (unit === 'ratio') return v => v.toFixed(3);
  return v => new Intl.NumberFormat('pt-BR').format(Math.round(v));
}

function median(values: number[]): number { const s = [...values].sort((a, b) => a - b); const n = s.length; if (!n) return NaN; const mid = Math.floor(n / 2); return n % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2; }

/** Deriva a UF a partir da SIGLA (nunca de `seat_uf`, que fica ausente pra quase todo o catálogo —
 * gap de dado já documentado, nunca inferido na coluna de texto "Jurisdição") — só pros 3 ramos cuja
 * sigla mapeia 1:1 pra 1 único estado, confirmado ao vivo contra `jud_tribunal`: Estadual ("TJ"+UF,
 * "TJDFT"→DF), Eleitoral ("TRE-"+UF, "TRE-DFT"→DF, "TSE" sem UF) e Militar ("TJM"+UF, só MG/RS/SP têm
 * TJM). Federal (TRF1-6), Trabalho (TRT1-24), Superiores/STF/CNJ nunca têm 1 única UF — `null`, nunca
 * uma UF chutada. Mesma ideia já usada no swarm de congestionamento de `/judiciario`, generalizada
 * pros outros 2 ramos com sigla igualmente inequívoca. */
function ufFromSigla(sigla: string, branchCode: string): string | null {
  if (branchCode === 'ESTADUAL') return sigla === 'TJDFT' ? 'DF' : sigla.replace(/^TJ/, '') || null;
  if (branchCode === 'ELEITORAL') { if (sigla === 'TRE-DFT') return 'DF'; const m = /^TRE-([A-Z]{2})$/.exec(sigla); return m ? m[1]! : null; }
  if (branchCode === 'MILITAR') { const m = /^TJM([A-Z]{2})$/.exec(sigla); return m ? m[1]! : null; }
  return null;
}

type DirItem = { tribunal_id: string; sigla: string; official_name: string; branch_code: string; branch_name: string; seat_uf: string | null; institutional_level: string; casos_novos?: string | number | null; taxa_congestionamento?: string | number | null; magistrados?: string | number | null };

/** `tribunal_id` é sempre `JUD:TRIBUNAL:<sigla>` (confirmado ao vivo, inclusive siglas com hífen como
 * TRE-BA) — por isso dá pra resolver nome/ramo de QUALQUER id, mesmo fora da distribuição atual, só
 * reaproveitando a busca do diretório pela própria sigla, sem precisar de uma função nova de "buscar
 * por id". */
async function resolveTribunalBasics(tribunalId: string): Promise<DirItem | null> {
  const sigla = tribunalId.replace('JUD:TRIBUNAL:', '');
  const dir = await loadJudiciaryTribunalDirectory({ search: sigla, pageSize: 15 });
  return (dir.items as DirItem[]).find(i => i.tribunal_id === tribunalId) ?? null;
}

/** Monta a URL desta mesma rota a partir do estado atual + overrides; `null`/`undefined` no override
 * remove a chave. Centraliza a "camada 1" de estado (mandato §19) — toda ação do Canvas é um
 * `<Link>`/formulário GET pra uma URL construída aqui, nunca um `useSearchParams` no cliente. */
function buildHref(current: Record<string, string | undefined>, overrides: Record<string, string | undefined | null>) {
  const merged: Record<string, string | undefined | null> = { ...current, ...overrides };
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
  const qs = q.toString();
  return `/judiciario/tribunais${qs ? `?${qs}` : ''}`;
}

export default async function TribunalExplorerPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const busca = scalar(params.busca)?.trim() || undefined;
  const indicadorParam = scalar(params.indicador) || undefined;
  const branchCode = scalar(params.ramo) || undefined;
  const uf = scalar(params.uf)?.toUpperCase() || undefined;
  const anoRaw = Number(scalar(params.ano));
  const year = Number.isInteger(anoRaw) && YEARS.includes(anoRaw) ? anoRaw : 2025;
  const inspecionar = scalar(params.inspecionar) || undefined;
  const mesaRaw = scalar(params.mesa) ?? '';
  const mesaIds = [...new Set(mesaRaw.split(',').map(s => s.trim()).filter(Boolean))].slice(0, 3);
  const abaRaw = scalar(params.aba);
  const aba: TabId = (abaRaw && TAB_IDS.includes(abaRaw as TabId)) ? (abaRaw as TabId) : 'movimento';
  const modo = scalar(params.modo) === 'mesa' && mesaIds.length >= 2 ? 'mesa' as const : 'padrao' as const;
  const vis: DistributionVis = scalar(params.vis) === 'tabela' ? 'tabela' : 'pontos';
  const escalaRaw = scalar(params.escala) === 'log' ? 'log' as const : undefined;
  const paginaRaw = Number(scalar(params.pagina));
  const pagina = Number.isInteger(paginaRaw) && paginaRaw > 1 ? paginaRaw : 1;

  const current: Record<string, string | undefined> = { busca, indicador: indicadorParam, ramo: branchCode, uf, ano: year !== 2025 ? String(year) : undefined, mesa: mesaIds.length ? mesaIds.join(',') : undefined, modo: scalar(params.modo), aba: abaRaw, mesa_indicador: scalar(params.mesa_indicador), inspecionar, vis: vis !== 'pontos' ? vis : undefined, escala: escalaRaw, pagina: pagina > 1 ? String(pagina) : undefined };

  const methodologyAll = await loadJudiciaryMethodology();
  const methodologyRows: IndicatorMethodology[] = methodologyAll.availability === 'AVAILABLE' ? (methodologyAll.data as { indicators: IndicatorMethodology[] }).indicators : [];
  const methodologyMap = new Map(methodologyRows.map(r => [r.indicator_id, r]));

  const mesaHrefOpen = buildHref(current, { modo: 'mesa', aba, inspecionar: null });
  const mesaBasics = await Promise.all(mesaIds.map(resolveTribunalBasics));
  const mesaItemsForBar = mesaIds.map((id, i) => ({ tribunalId: id, sigla: mesaBasics[i]?.sigla ?? id, hrefRemove: buildHref(current, { mesa: mesaIds.filter(x => x !== id).join(',') || null, modo: mesaIds.length - 1 < 2 ? null : undefined }) }));

  // ---------------------------------------------------------------- Modo Mesa (comparação expandida)
  if (modo === 'mesa') {
    const tabDef = TRIBUNAL_TABS[aba];
    const mesaIndicadorRaw = scalar(params.mesa_indicador);
    const mesaIndicador = tabDef.indicators.find(i => i.id === mesaIndicadorRaw)?.id ?? tabDef.indicators[0]!.id;
    const meta = indicatorMeta(mesaIndicador)!;
    const [cmp, ...seriesList] = await Promise.all([
      loadJudiciaryComparison(mesaIndicador, mesaIds, year),
      ...mesaIds.map(id => loadJudiciaryTribunalSeries(id, mesaIndicador)),
    ]);
    const cmpItems = (cmp.availability === 'AVAILABLE' || cmp.availability === 'NOT_REPORTED') ? (cmp.data as any).items as Array<{ canonical_tribunal_id: string; sigla: string; official_name: string; value_numeric: string | null; unit: string }> : [];
    const comparisonItems: MesaComparisonItem[] = cmpItems.map(i => ({ tribunalId: i.canonical_tribunal_id, sigla: i.sigla, officialName: i.official_name, value: i.value_numeric != null ? Number(i.value_numeric) : null }));
    const realUnit = cmpItems[0]?.unit ?? 'processos';
    const formatValue = formatterFor(realUnit);
    const history: MesaHistoryLine[] = seriesList.map((s, i) => ({
      tribunalId: mesaIds[i]!, sigla: mesaBasics[i]?.sigla ?? mesaIds[i]!,
      points: (s.availability === 'AVAILABLE' ? (s.data as any).items as Array<{ reference_year: number; value_numeric: string | null }> : []).map(r => ({ year: r.reference_year, value: r.value_numeric != null ? Number(r.value_numeric) : null })),
    }));

    return (
      <main id="conteudo" tabIndex={-1} className="scroll-mt-20">
        <div className="page-shell py-6">
          <nav aria-label="Trilha" className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Link href="/judiciario" className="hover:text-primary">Judiciário</Link><span aria-hidden>/</span><Link href="/judiciario/tribunais" className="hover:text-primary">Tribunais</Link><span aria-hidden>/</span><span className="text-foreground">Mesa</span></nav>
          <div className="mt-4">
            <MesaWorkspace
              tribunals={mesaIds.map((id, i) => ({ tribunalId: id, sigla: mesaBasics[i]?.sigla ?? id, officialName: mesaBasics[i]?.official_name ?? '', branchName: mesaBasics[i]?.branch_name ?? '', hrefProfile: `/judiciario/tribunais/${encodeURIComponent(id)}`, hrefRemove: buildHref(current, { mesa: mesaIds.filter(x => x !== id).join(',') || null, modo: mesaIds.length - 1 < 2 ? null : undefined }) }))}
              tabs={TAB_IDS.map(id => ({ id, label: TRIBUNAL_TABS[id].label, href: buildHref(current, { aba: id, mesa_indicador: null }), active: id === aba }))}
              activeTabLabel={tabDef.label}
              indicatorOptions={tabDef.indicators.map(i => ({ id: i.id, label: i.label, href: buildHref(current, { mesa_indicador: i.id }), active: i.id === mesaIndicador }))}
              activeIndicatorLabel={meta?.label ?? mesaIndicador}
              activeIndicatorUnit={UNIT_LABEL[realUnit] ?? realUnit}
              methodology={methodologyMap.get(mesaIndicador) ?? null}
              comparisonItems={comparisonItems}
              comparisonAvailability={cmp.availability as any}
              comparisonCoverage={toChartCoverage(cmp.availability, 'CNJ Justiça em Números, ano-base ' + year, { from: `${year}-01-01`, to: `${year}-12-31`, grain: 'year' })}
              formatValue={formatValue}
              history={history}
              year={year}
              hrefBackToDistribution={buildHref(current, { modo: null, indicador: mesaIndicador })}
              hrefAddTribunal={mesaIds.length < 3 ? buildHref(current, { modo: null }) : undefined}
              historyScale={realUnit === 'proportion' ? 100 : 1}
            />
          </div>
        </div>
      </main>
    );
  }

  // A partir daqui, nunca é Mesa: ou há um indicador em investigação (Canvas analítico) ou estamos no
  // diretório (V1.1, mandato "Diretório Imediato") — os 2 nunca aparecem juntos na mesma tela. Isso
  // elimina por construção a duplicação observada na V1 (lista de tribunais + gráfico ao mesmo tempo):
  // cada modo mostra só o que faz sentido pra ele.
  const catalogAll = await loadJudiciaryTribunalDirectory({ pageSize: 1 });
  const catalogTotal = catalogAll.total as number;

  let mainContent: ReactNode;

  if (indicadorParam) {
    // -------------------------------------------------------- Canvas analítico (indicador em foco)
    const dist = await loadJudiciaryIndicatorDistribution(indicadorParam, year, branchCode ? { branchCode } : {});
    const meta = indicatorMeta(indicadorParam);
    const distPoints = (dist.availability === 'AVAILABLE') ? (dist.data as any).points as Array<{ tribunal_id: string; sigla: string; official_name: string; branch_code: string; branch_name: string; value: string }> : [];
    const points = distPoints.map(p => ({ tribunalId: p.tribunal_id, sigla: p.sigla, officialName: p.official_name, branchCode: p.branch_code, branchName: p.branch_name, value: Number(p.value), uf: ufFromSigla(p.sigla, p.branch_code) }));
    const values = points.map(p => p.value);
    const unit = (dist.data as any)?.indicator?.unit ?? 'processos';
    const formatValue = formatterFor(unit);

    let inspected = null as null | { tribunalId: string; sigla: string; officialName: string; branchName: string; seatUf: string | null };
    let inspectedValue: number | null = null;
    if (inspecionar) {
      const fromPoints = points.find(p => p.tribunalId === inspecionar);
      if (fromPoints) { inspected = { tribunalId: fromPoints.tribunalId, sigla: fromPoints.sigla, officialName: fromPoints.officialName, branchName: fromPoints.branchName, seatUf: null }; inspectedValue = fromPoints.value; }
      else {
        const basics = await resolveTribunalBasics(inspecionar);
        if (basics) inspected = { tribunalId: basics.tribunal_id, sigla: basics.sigla, officialName: basics.official_name, branchName: basics.branch_name, seatUf: basics.seat_uf };
      }
    }

    const relatedQuestions = (() => {
      const tab = indicatorMeta(indicadorParam)?.tab;
      if (!tab) return [];
      const sameTab = TRIBUNAL_TABS[tab].indicators.filter(i => i.id !== indicadorParam).slice(0, 2);
      const otherTab = TAB_IDS.find(t => t !== tab);
      const cross = otherTab ? [TRIBUNAL_TABS[otherTab].indicators[0]!] : [];
      return [...sameTab, ...cross].slice(0, 3).map(i => ({ label: i.label, href: buildHref(current, { indicador: i.id, inspecionar: null }) }));
    })();

    // V1.1 (mandato §7.2) — escala logarítmica só quando matematicamente adequada (todos os valores
    // positivos); nunca forçada, sempre uma leitura alternativa explícita escolhida pelo usuário.
    const canLog = values.length > 0 && values.every(v => v > 0);
    const escalaEff: DistributionScale = canLog && escalaRaw === 'log' ? 'log' : 'linear';

    mainContent = (
      <div className="space-y-5">
        <form action="/judiciario/tribunais" className="rounded-2xl border bg-card p-4 sm:p-5">
          <input type="hidden" name="busca" value={busca ?? ''} />
          {mesaIds.length > 0 && <input type="hidden" name="mesa" value={mesaIds.join(',')} />}
          {inspecionar && <input type="hidden" name="inspecionar" value={inspecionar} />}
          {vis !== 'pontos' && <input type="hidden" name="vis" value={vis} />}
          {escalaRaw && <input type="hidden" name="escala" value={escalaRaw} />}
          <Link href={buildHref(current, { indicador: null, inspecionar: null, mesa_indicador: null, aba: null, vis: null, escala: null })} className="focus-ring mb-3 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-primary"><ChevronLeft size={14} aria-hidden /> Diretório de tribunais</Link>
          <label className="block">
            <span className="eyebrow">Pergunta investigativa</span>
            <div className="relative mt-1.5 max-w-md">
              <AutoSubmitSelect name="indicador" defaultValue={indicadorParam} className="h-auto w-full appearance-none rounded-none border-0 border-b bg-transparent p-0 pb-2 pr-7 text-lg font-black focus-visible:ring-0">
                {TAB_IDS.map(tab => (
                  <optgroup key={tab} label={TRIBUNAL_TABS[tab].label}>
                    {TRIBUNAL_TABS[tab].indicators.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}
                  </optgroup>
                ))}
              </AutoSubmitSelect>
              <ChevronDown className="pointer-events-none absolute bottom-2 right-0 text-muted-foreground" size={18} aria-hidden />
            </div>
          </label>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <label className="text-xs font-bold text-muted-foreground">Ramo da Justiça
              <AutoSubmitSelect name="ramo" defaultValue={branchCode ?? ''} className="mt-1 w-40">
                <option value="">Todos</option>
                {BRANCHES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </AutoSubmitSelect>
            </label>
            <label className="text-xs font-bold text-muted-foreground">Período
              <AutoSubmitSelect name="ano" defaultValue={String(year)} className="mt-1 w-24">
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </AutoSubmitSelect>
            </label>
            <details className="pb-2.5">
              <summary className="focus-ring cursor-pointer list-none text-xs font-bold text-primary underline-offset-2 hover:underline">Filtros avançados</summary>
              <label className="mt-2 block text-xs font-bold text-muted-foreground">UF / Jurisdição
                <AutoSubmitSelect name="uf" defaultValue={uf ?? ''} className="mt-1 w-24">
                  <option value="">Todas</option>
                  {UFS.map(u => <option key={u} value={u}>{u}</option>)}
                </AutoSubmitSelect>
              </label>
            </details>
          </div>
        </form>

        <TribunalExplorerCanvas
          indicator={meta ? { id: meta.id, publicName: meta.label, officialName: (dist.data as any)?.indicator?.official_name ?? meta.label, unit: UNIT_LABEL[unit] ?? unit, limitations: (dist.provenance as any)?.limitations, methodology: methodologyMap.get(meta.id) ?? null } : null}
          distribution={{ points, min: values.length ? Math.min(...values) : 0, median: median(values), max: values.length ? Math.max(...values) : 0, coverage: toChartCoverage(dist.availability, (dist.provenance as any)?.limitations?.[0] ?? 'CNJ Justiça em Números', { from: `${year}-01-01`, to: `${year}-12-31`, grain: 'year' }) }}
          inspected={inspected}
          inspectedValue={inspectedValue}
          formatValue={formatValue}
          year={year}
          mesaItems={mesaItemsForBar}
          mesaHrefOpen={mesaHrefOpen}
          hrefAddToMesa={inspected && !mesaIds.includes(inspected.tribunalId) && mesaIds.length < 3 ? buildHref(current, { mesa: [...mesaIds, inspected.tribunalId].join(',') }) : undefined}
          hrefRemoveFromMesa={inspected && mesaIds.includes(inspected.tribunalId) ? buildHref(current, { mesa: mesaIds.filter(x => x !== inspected!.tribunalId).join(',') || null }) : undefined}
          hrefProfile={inspected ? `/judiciario/tribunais/${encodeURIComponent(inspected.tribunalId)}` : undefined}
          hrefClearInspection={buildHref(current, { inspecionar: null })}
          hrefForPoint={id => buildHref(current, { inspecionar: id })}
          relatedQuestions={relatedQuestions}
          vis={vis}
          hrefVis={v => buildHref(current, { vis: v === 'pontos' ? null : v })}
          scale={escalaEff}
          hrefScale={canLog ? (s => buildHref(current, { escala: s === 'log' ? 'log' : null })) : undefined}
        />
      </div>
    );
  } else {
    // ------------------------------------------------------------------------- Diretório (V1.1 §2–3)
    const [dirResults, quickAccessBasics] = await Promise.all([
      loadJudiciaryTribunalDirectory({ ...(busca ? { search: busca } : {}), ...(branchCode ? { branchCode } : {}), ...(uf ? { uf } : {}), page: pagina, pageSize: DIRECTORY_PAGE_SIZE, year }),
      Promise.all(QUICK_ACCESS_SIGLAS.map(s => resolveTribunalBasics(`JUD:TRIBUNAL:${s}`))),
    ]);
    const quickAccess: QuickAccessItem[] = quickAccessBasics.filter((b): b is DirItem => !!b).map(b => ({ sigla: b.sigla, officialName: b.official_name, href: `/judiciario/tribunais/${encodeURIComponent(b.tribunal_id)}` }));
    // Formatadores já existentes (mesmos usados no Canvas), reaproveitados pras 3 colunas novas do
    // diretório — nunca um número bruto sem unidade.
    const congestionFmt = formatterFor('proportion');
    const countFmt = formatterFor('processos');
    const rows: DirectoryRow[] = (dirResults.items as DirItem[]).map(it => ({
      tribunalId: it.tribunal_id, sigla: it.sigla, officialName: it.official_name, branchName: it.branch_name, seatUf: it.seat_uf, institutionalLevel: it.institutional_level,
      uf: ufFromSigla(it.sigla, it.branch_code),
      congestionamento: it.taxa_congestionamento != null ? congestionFmt(Number(it.taxa_congestionamento)) : null,
      processosNovos: it.casos_novos != null ? countFmt(Number(it.casos_novos)) : null,
      magistrados: it.magistrados != null ? countFmt(Number(it.magistrados)) : null,
      hrefProfile: `/judiciario/tribunais/${encodeURIComponent(it.tribunal_id)}`,
      // mandato §4.3: "Inspecionar" sempre estabelece um indicador válido (o já ativo, ou um padrão) —
      // nunca abre o Canvas sem indicador, nem adiciona à Mesa automaticamente.
      hrefInspect: buildHref(current, { inspecionar: it.tribunal_id, indicador: DEFAULT_INDICATOR }),
    }));
    const pageCount = Math.max(1, Math.ceil(dirResults.total / DIRECTORY_PAGE_SIZE));
    // A nota só descreve ausência quando a página REALMENTE está vazia — `CoverageBadge` usa esta
    // mesma string como tooltip/aria-label mesmo com resultados, então nunca pode insinuar "nenhum
    // tribunal encontrado" quando a tabela abaixo já mostra tribunais de verdade.
    const coverage = toChartCoverage('AVAILABLE', rows.length === 0
      ? (busca || branchCode || uf ? 'Nenhum tribunal encontrado com estes filtros. Tente outro termo, sigla ou nome.' : 'Nenhum tribunal catalogado.')
      : 'Cadastro institucional civica_jud — tribunais e órgãos de controle do Judiciário brasileiro.', {});

    mainContent = (
      <div className="space-y-6">
        <TribunalDirectory
          searchTerm={busca ?? null}
          branchCode={branchCode}
          uf={uf}
          branches={BRANCHES}
          ufs={UFS}
          quickAccess={quickAccess}
          rows={rows}
          coverage={coverage}
          page={pagina}
          pageCount={pageCount}
          pageHref={p => buildHref(current, { pagina: p > 1 ? String(p) : null })}
          totalCatalog={catalogTotal}
          filteredCount={dirResults.total}
        />

        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><BarChart3 size={18} aria-hidden /></span>
              <div><p className="text-sm font-black">Investigar um indicador</p><p className="text-xs text-muted-foreground">Veja a distribuição real entre os tribunais e compare até 3 lado a lado.</p></div>
            </div>
            <Link href={buildHref(current, { indicador: DEFAULT_INDICATOR })} className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90">Começar <ChevronRight size={14} aria-hidden /></Link>
          </div>
          <ul aria-label="Perguntas em destaque" className="mt-3 flex flex-wrap gap-2">
            {OPENING_QUESTIONS.map(q => (
              <li key={q.indicatorId}><Link href={buildHref(current, { indicador: q.indicatorId })} className="focus-ring block rounded-full border bg-card px-3 py-1.5 text-xs font-semibold hover:border-primary">{q.label}</Link></li>
            ))}
          </ul>
        </div>

        <MesaBar items={mesaItemsForBar} hrefOpenMesa={mesaHrefOpen} />
      </div>
    );
  }

  return (
    <main id="conteudo" tabIndex={-1} className="scroll-mt-20">
      <section className="page-shell pt-6 pb-4">
        <div className="rounded-[1.5rem] bg-primary px-6 py-6 text-primary-foreground sm:px-9 sm:py-7">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-white/75">Instituições da Justiça</p>
          <h1 className="display-title mt-1.5 max-w-2xl text-2xl sm:text-4xl">Explorador de tribunais.</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/80">Encontre um tribunal ou investigue um indicador — veja como ele varia entre as instituições e compare até 3 lado a lado.</p>
          <p className="mt-3 text-xs font-semibold text-white/70">{catalogTotal} instituições catalogadas</p>
        </div>
      </section>

      <section className="page-shell pb-3">
        <nav aria-label="Modo de exploração" className="flex gap-2 border-b">
          <span className="border-b-2 border-primary px-4 py-2.5 text-sm font-bold text-primary">Explorador</span>
          <Link href="/judiciario/comparar" className="px-4 py-2.5 text-sm font-bold text-muted-foreground hover:text-primary">Comparador clássico</Link>
        </nav>
      </section>

      <section className="page-shell pb-14">
        {mainContent}
      </section>
    </main>
  );
}
