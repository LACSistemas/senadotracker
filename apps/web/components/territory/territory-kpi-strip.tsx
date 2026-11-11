import type { HdiTerritory } from '@senadotracker/db';
import { loadGdpPerCapita, loadGdpPerCapitaForState, loadTotalBudget, loadTotalBudgetForState } from '@/lib/territory-executive';
import { loadHdiComparison, loadHdiForState } from '@/lib/territory-idhm';
import { IdhmSummary } from './idhm-summary';
import { formatInt } from './territory-ui';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const moneyCompact = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
const idhmFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

function KpiTile({ id, label, value, unit, meta, annotation }: { id?: string | undefined; label: string; value: string; unit?: string | undefined; meta?: string | undefined; annotation?: string | undefined }) {
  return (
    <div id={id} className="min-w-0 rounded-2xl border bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="hero-figure tnum mt-2 truncate text-3xl text-[#14304f] sm:text-4xl">{value}{unit && <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>}</p>
      {meta && <p className="mt-1 text-xs text-muted-foreground">{meta}</p>}
      {annotation && <p className="mt-3 border-t pt-2 text-sm font-bold text-[#866327]">{annotation}</p>}
    </div>
  );
}

/** Acha a posição do território (município) dentro do ranking da própria UF, ou — na página de estado,
 * onde não há "própria posição" — devolve null para cair no modo "quem é o maior do estado". Nunca ambos
 * ao mesmo tempo: olhar a própria posição faz mais sentido num município (já sei meu valor, quero saber
 * onde fico); olhar o maior faz mais sentido no estado (visão de topo, quero saber quem lidera). */
function ownRank<T>(ranking: T[], selfEntityId: number | undefined, entityIdOf: (r: T) => number, valueOf: (r: T) => number): { rank: number; total: number } | null {
  if (selfEntityId === undefined) return null;
  const self = ranking.find(r => entityIdOf(r) === selfEntityId);
  if (!self) return null;
  const rank = 1 + ranking.filter(r => valueOf(r) > valueOf(self)).length;
  return { rank, total: ranking.length };
}

/**
 * Faixa de KPIs logo antes do mapa (estado) ou logo após o hero (município, que não tem seção de mapa
 * própria): PIB per capita, IDHM, orçamento do ano e população. "Orçamento do ano" é a despesa TOTAL anual
 * empenhada (Siconfi DCA Anexo I-E, já coletada e publicada desde P9.5 — nenhum coletor novo) — não é a
 * dotação/LOA aprovada (o Cívica não coleta essa peça orçamentária), e sim o que o ente efetivamente
 * empenhou no exercício. O card grande do IDHM (gráfico por década) vem logo abaixo, sempre visível.
 *
 * Anotação de comparação: no município, a própria posição no ranking da UF ("21º de 78 em PIB per capita
 * do estado" — faz mais sentido já sabendo meu valor); no estado, quem é o maior município ("Vitória:
 * maior orçamento do estado" — visão de topo, não há "própria posição" para o estado olhar).
 *
 * Desempenho: 7 consultas, todas em paralelo (`Promise.all`) e cacheadas (5min PIB/orçamento, 1h IDHM) —
 * nunca uma consulta por município (N+1). As 3 consultas "de estado" (`loadGdpPerCapitaForState`/
 * `loadHdiForState`/`loadTotalBudgetForState`) trazem TODOS os municípios da UF numa linha cada, de uma vez
 * só; o maior/menor/posição são achados em memória, não no banco. `names` é a lista de municípios que a
 * página já carregou (nenhuma consulta nova só para nomes).
 */
export async function TerritoryKpiStrip({ ufCode, territoryName, population, populationYear, gdpTerritory, hdiTerritory, names }: {
  ufCode: number; territoryName: string; population: number | null; populationYear: number | null;
  gdpTerritory: { level: 'UF'; ufCode: number } | { level: 'MUNICIPIO'; ibge7: string | number };
  hdiTerritory: HdiTerritory; names: Map<number, string>;
}) {
  const selfEntityId = gdpTerritory.level === 'MUNICIPIO' ? Number(gdpTerritory.ibge7) : undefined;
  const [gdp, hdi, budget, gdpRanking, hdiRanking, budgetRanking] = await Promise.all([
    loadGdpPerCapita(gdpTerritory),
    loadHdiComparison(hdiTerritory),
    loadTotalBudget(gdpTerritory),
    loadGdpPerCapitaForState(ufCode),
    loadHdiForState(ufCode),
    loadTotalBudgetForState(ufCode),
  ]);
  const latestHdi = hdi.territory?.points.at(-1) ?? null;
  if (!gdp && !latestHdi && !budget && population === null) return null;

  const gdpRank = ownRank(gdpRanking, selfEntityId, r => r.entityId, r => r.value);
  const gdpMax = gdpRanking.length ? gdpRanking.reduce((a, b) => (b.value > a.value ? b : a)) : null;
  const gdpMaxName = gdpMax ? names.get(gdpMax.entityId) : null;
  const gdpAnnotation = gdpRank ? `${gdpRank.rank}º de ${gdpRank.total} em PIB per capita do estado` : gdpMaxName ? `${gdpMaxName}: maior PIB per capita do estado` : undefined;

  const hdiRank = ownRank(hdiRanking, selfEntityId, r => r.entityId, r => r.idhm);
  const hdiMax = hdiRanking.length ? hdiRanking.reduce((a, b) => (b.idhm > a.idhm ? b : a)) : null;
  const hdiMaxName = hdiMax ? names.get(hdiMax.entityId) : null;
  const hdiAnnotation = hdiRank ? `${hdiRank.rank}º de ${hdiRank.total} em IDHM do estado` : hdiMaxName ? `${hdiMaxName}: maior IDHM do estado` : undefined;

  const budgetRank = ownRank(budgetRanking, selfEntityId, r => r.entityId, r => r.value);
  const budgetMax = budgetRanking.length ? budgetRanking.reduce((a, b) => (b.value > a.value ? b : a)) : null;
  const budgetMaxName = budgetMax ? names.get(budgetMax.entityId) : null;
  const budgetAnnotation = budgetRank ? `${budgetRank.rank}º de ${budgetRank.total} em orçamento do estado` : budgetMaxName ? `${budgetMaxName}: maior orçamento do estado` : undefined;

  return (
    <div className="space-y-4">
      <section aria-labelledby="kpis-territorio" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <h2 id="kpis-territorio" className="sr-only">Indicadores econômicos e sociais</h2>
        <KpiTile id="pib-resumo" label="PIB per capita" value={gdp ? money.format(gdp.value) : '—'} meta={gdp ? `${gdp.year} · preços correntes, IBGE/SIDRA` : 'sem dado publicado'} annotation={gdpAnnotation} />
        <KpiTile id="idhm-kpi" label="IDHM" value={latestHdi ? idhmFmt.format(latestHdi.idhm) : '—'} meta={latestHdi ? `${latestHdi.year} · PNUD/IPEA/FJP` : 'sem dado publicado'} annotation={hdiAnnotation} />
        <KpiTile id="orcamento-resumo" label="Orçamento do ano" value={budget ? moneyCompact.format(budget.value) : '—'} meta={budget ? `${budget.year} · despesa total empenhada, Siconfi/DCA` : 'sem dado publicado'} annotation={budgetAnnotation} />
        <KpiTile id="populacao-resumo" label="População" value={population !== null ? formatInt(population) : '—'} meta={population !== null ? `${populationYear}, estimativa IBGE` : undefined} />
      </section>
      {latestHdi && <IdhmSummary territory={hdiTerritory} territoryName={territoryName} />}
    </div>
  );
}
