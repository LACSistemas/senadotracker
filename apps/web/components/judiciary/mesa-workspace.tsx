import Link from 'next/link';
import { ArrowLeft, Clock3, Coins, Download, Layers3, Plus, Users, X } from 'lucide-react';
import type { ComponentType } from 'react';
import type { DataCoverage } from '@senadotracker/domain';
import { RankedBars, MultiLineChart, type MultiLineDatum } from '@/components/charts';
import { JudiciaryAvailabilityNote } from '@/components/judiciary/availability';
import { MethodologyPanel, type IndicatorMethodology } from '@/components/judiciary/methodology-panel.tsx';
import { ShareButton } from '@/components/judiciary/share-button.tsx';

const MESA_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)'];
const TAB_ICONS: Record<string, ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>> = { movimento: Layers3, tempo: Clock3, pessoal: Users, financas: Coins };

export interface MesaTribunal { tribunalId: string; sigla: string; officialName: string; branchName: string; hrefProfile: string; hrefRemove: string }
export interface MesaTab { id: string; label: string; href: string; active: boolean }
export interface MesaIndicatorOption { id: string; label: string; href: string; active: boolean }
export interface MesaComparisonItem { tribunalId: string; sigla: string; officialName: string; value: number | null }
export interface MesaHistoryLine { tribunalId: string; sigla: string; points: Array<{ year: number; value: number | null }> }

/** `ChapterNav` não serve aqui: ele faz scrollspy entre âncoras `#id` na MESMA página — as 4 abas da
 * Mesa não são seções empilhadas (carregar as 4 de uma vez contrariaria o mandato §23), são 4 estados
 * de dado diferentes trocados via `?aba=`. Por isso uma barra de abas própria, com `<Link>` real —
 * estilo "pílula" com ícone (ajuste visual pedido pelo usuário, casando com o mock). */
function MesaTabBar({ tabs }: { tabs: MesaTab[] }) {
  return (
    <nav aria-label="Abas analíticas da Mesa" className="flex flex-wrap gap-1.5 [scrollbar-width:thin]">
      {tabs.map(t => {
        const Icon = TAB_ICONS[t.id];
        return (
          <Link key={t.id} replace scroll={false} href={t.href} aria-current={t.active ? 'true' : undefined}
            className={t.active ? 'focus-ring inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-sm font-bold text-primary-foreground' : 'focus-ring inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-bold text-muted-foreground hover:border-primary hover:text-primary'}>
            {Icon && <Icon size={15} aria-hidden />} {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

function csvHref(items: MesaComparisonItem[], label: string, unit: string): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [['Tribunal', 'Nome oficial', `${label} (${unit})`].map(esc).join(',')];
  for (const it of items) lines.push([it.sigla, it.officialName, it.value != null ? String(it.value) : ''].map(esc).join(','));
  return `data:text/csv;charset=utf-8,${encodeURIComponent(lines.join('\n'))}`;
}

/** Deterministico (mandato §17): só aritmética sobre os dados já carregados — nunca causalidade,
 * nunca texto livre de modelo. */
function leituras(items: MesaComparisonItem[], history: MesaHistoryLine[], label: string, formatValue: (v: number) => string): string[] {
  const withData = items.filter((i): i is MesaComparisonItem & { value: number } => i.value != null);
  const out: string[] = [];
  if (withData.length >= 2) {
    const asc = [...withData].sort((a, b) => a.value - b.value);
    const lo = asc[0]!, hi = asc[asc.length - 1]!;
    if (lo.sigla !== hi.sigla) {
      out.push(`${lo.sigla} apresenta ${label.toLowerCase()} menor que ${hi.sigla} (${formatValue(lo.value)} vs. ${formatValue(hi.value)}).`);
      if (lo.value !== 0) out.push(`A diferença entre as instituições selecionadas é de ${Math.abs(((hi.value - lo.value) / Math.abs(lo.value)) * 100).toFixed(0)}% no recorte atual.`);
    }
  }
  for (const h of history) {
    const pts = h.points.filter((p): p is { year: number; value: number } => p.value != null);
    if (pts.length >= 2) {
      const first = pts[0]!, last = pts[pts.length - 1]!;
      if (first.value !== 0) out.push(`${h.sigla} registra ${last.value >= first.value ? 'aumento' : 'redução'} de ${Math.abs(((last.value - first.value) / Math.abs(first.value)) * 100).toFixed(0)}% entre ${first.year} e ${last.year}.`);
    }
  }
  return out.slice(0, 3);
}

/** P14.45 — Mesa de Investigação expandida (mandato §11.3/§12/§14): até 3 tribunais, 4 abas
 * analíticas tradicionais (não uma narrativa por capítulo — decisão explícita do usuário), 1
 * indicador em foco por aba (trocável entre os elegíveis daquela aba), comparação do ano corrente
 * (`RankedBars`) + evolução histórica (`MultiLineChart`) quando ≥2 anos existem, lado a lado (ajuste
 * visual do mock), tabela de valores exatos + download CSV, "Principais leituras" determinísticas e
 * metodologia reaproveitada (`MethodologyPanel`), "Voltar à Distribuição". Nunca mostra uma
 * comparação inválida: quando `comparisonAvailability` não é `AVAILABLE`, mostra a
 * `JudiciaryAvailabilityNote` honesta em vez de um gráfico fabricado. */
export function MesaWorkspace({
  tribunals, tabs, activeTabLabel, indicatorOptions, activeIndicatorLabel, activeIndicatorUnit, methodology,
  comparisonItems, comparisonAvailability, comparisonCoverage, formatValue, history, year, hrefBackToDistribution, hrefAddTribunal, historyScale,
}: {
  tribunals: MesaTribunal[];
  tabs: MesaTab[];
  activeTabLabel: string;
  indicatorOptions: MesaIndicatorOption[];
  activeIndicatorLabel: string;
  activeIndicatorUnit: string;
  methodology?: IndicatorMethodology | null | undefined;
  comparisonItems: MesaComparisonItem[];
  comparisonAvailability: 'AVAILABLE' | 'NOT_REPORTED' | 'METHOD_INCOMPATIBLE' | 'SOURCE_UNAVAILABLE';
  comparisonCoverage: DataCoverage;
  formatValue: (v: number) => string;
  history: MesaHistoryLine[];
  year: number;
  hrefBackToDistribution: string;
  hrefAddTribunal?: string | undefined;
  historyScale?: number | undefined;
}) {
  const withData = comparisonItems.filter(i => i.value != null);
  const withoutData = comparisonItems.filter(i => i.value == null);
  const historyYears = [...new Set(history.flatMap(h => h.points.map(p => p.year)))].sort((a, b) => a - b);
  // `MultiLineChart` (componente compartilhado, usado por outras páginas) não tem um `formatValue`/
  // `suffix` próprio — mostra o número bruto. Pra indicadores em proporção (0-1), isso rendia um
  // eixo "1 / 0,5 / 0" sem contexto; `historyScale` (passado como 100 só pra indicadores de
  // proporção) ajusta a escala sem precisar mexer no componente compartilhado.
  const scale = historyScale ?? 1;
  const multiLineData: MultiLineDatum[] = historyYears.map(yr => ({
    label: String(yr),
    values: history.map((h, i) => { const v = h.points.find(p => p.year === yr)?.value ?? null; return { label: h.sigla, value: v != null ? v * scale : null, color: MESA_COLORS[i % MESA_COLORS.length]! }; }),
  }));
  const insights = comparisonAvailability === 'AVAILABLE' ? leituras(comparisonItems, history, activeIndicatorLabel, formatValue) : [];

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Mesa de investigação</p>
          <h1 className="mt-1 text-2xl font-black sm:text-3xl">Comparação entre tribunais</h1>
          <p className="mt-1 text-sm text-muted-foreground">Analise indicadores, evolução e diferenças entre as instituições selecionadas.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link replace scroll={false} href={hrefBackToDistribution} className="focus-ring inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-bold hover:border-primary"><ArrowLeft size={15} aria-hidden /> Voltar à distribuição</Link>
          <ShareButton className="focus-ring inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-bold hover:border-primary" />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-4">
        <span className="text-xs font-bold text-muted-foreground">Tribunais na comparação ({tribunals.length} de 3)</span>
        <ul className="flex flex-wrap items-center gap-2">
          {tribunals.map((t, i) => (
            <li key={t.tribunalId} className="inline-flex items-center gap-2 rounded-full border py-1 pl-3 pr-1.5 text-sm font-bold" style={{ borderColor: MESA_COLORS[i % MESA_COLORS.length] }}>
              <span className="size-2 rounded-full" style={{ background: MESA_COLORS[i % MESA_COLORS.length] }} aria-hidden />
              <Link href={t.hrefProfile} className="hover:underline">{t.sigla}</Link>
              <span className="hidden font-normal text-muted-foreground sm:inline">{t.officialName}</span>
              <Link replace scroll={false} href={t.hrefRemove} aria-label={`Remover ${t.sigla}`} className="focus-ring grid size-6 place-items-center rounded-full hover:bg-secondary"><X size={13} /></Link>
            </li>
          ))}
        </ul>
        {hrefAddTribunal && tribunals.length < 3 && <Link href={hrefAddTribunal} className="focus-ring ml-auto inline-flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-xs font-bold text-primary hover:border-primary"><Plus size={14} aria-hidden /> Adicionar tribunal</Link>}
      </div>

      <div className="mt-5"><MesaTabBar tabs={tabs} /></div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 rounded-2xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="eyebrow">Indicador em foco</p><h2 className="text-lg font-black">{activeIndicatorLabel}</h2></div>
            {indicatorOptions.length > 1 && (
              <nav aria-label="Indicador desta aba" className="flex flex-wrap gap-1.5">
                {indicatorOptions.map(opt => (
                  <Link key={opt.id} replace scroll={false} href={opt.href} aria-current={opt.active ? 'true' : undefined}
                    className={opt.active ? 'rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground' : 'rounded-full border px-3 py-1 text-xs font-bold text-muted-foreground hover:border-primary hover:text-primary'}>
                    {opt.label}
                  </Link>
                ))}
              </nav>
            )}
          </div>

          {comparisonAvailability !== 'AVAILABLE' ? (
            <div className="mt-4"><JudiciaryAvailabilityNote availability={comparisonAvailability} source="CNJ Justiça em Números" limitations={comparisonAvailability === 'METHOD_INCOMPATIBLE' ? ['Este indicador é marcado como não comparável entre tribunais — mostrar um gráfico aqui seria enganoso.'] : undefined} /></div>
          ) : (
            <>
              <div className={historyYears.length > 1 ? 'mt-4 grid gap-4 sm:grid-cols-2' : 'mt-4'}>
                <RankedBars title={`${activeIndicatorLabel}, por tribunal`} coverage={comparisonCoverage}
                  items={withData.map((it) => ({ key: it.tribunalId, label: it.sigla, value: it.value as number, meta: it.officialName, chip: <span className="size-2.5 rounded-full" style={{ background: MESA_COLORS[comparisonItems.indexOf(it) % MESA_COLORS.length] }} /> }))}
                  formatValue={formatValue} />
                {historyYears.length > 1 && <MultiLineChart title={`Evolução de ${activeIndicatorLabel.toLowerCase()}`} data={multiLineData} coverage={comparisonCoverage} />}
              </div>
              {withoutData.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{withoutData.map(i => i.sigla).join(', ')} sem dado publicado para {activeIndicatorLabel.toLowerCase()} — não entram no gráfico, não viram zero.</p>}

              <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
                <div><p className="text-sm font-bold">Indicadores selecionados</p><p className="text-xs text-muted-foreground">Ano-base {year}</p></div>
                <a href={csvHref(comparisonItems, activeIndicatorLabel, activeIndicatorUnit)} download={`${activeIndicatorLabel.toLowerCase().replace(/\s+/g, '-')}.csv`} className="focus-ring inline-flex items-center gap-1.5 text-xs font-bold text-primary underline-offset-2 hover:underline"><Download size={13} aria-hidden /> Baixar dados (CSV)</a>
              </div>
              <div tabIndex={0} role="region" aria-label={`Tabela de ${activeIndicatorLabel} por tribunal, com rolagem`} className="mt-2 overflow-x-auto focus-ring">
                <table className="w-full min-w-[26rem] text-left text-sm">
                  <caption className="sr-only">Valores exatos de {activeIndicatorLabel} por tribunal, {comparisonItems.length} tribunais</caption>
                  <thead><tr className="border-b text-xs font-semibold uppercase tracking-wide text-muted-foreground"><th className="py-1.5 pr-3">Tribunal</th><th className="py-1.5 pr-3 text-right">{activeIndicatorLabel} ({activeIndicatorUnit})</th></tr></thead>
                  <tbody>{comparisonItems.map(it => <tr key={it.tribunalId} className="border-b last:border-0"><td className="py-1.5 pr-3 font-bold">{it.sigla} <span className="font-normal text-muted-foreground">{it.officialName}</span></td><td className="py-1.5 pr-3 text-right tabular-nums">{it.value != null ? formatValue(it.value) : '—'}</td></tr>)}</tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-5" aria-label="Contexto da comparação">
          <div><p className="eyebrow">Contexto da comparação</p><h3 className="mt-1 text-lg font-black">{activeTabLabel}</h3><p className="mt-1 text-sm leading-5 text-muted-foreground">Veja como {activeIndicatorLabel.toLowerCase()} se comporta nos tribunais selecionados, no recorte e período escolhidos.</p></div>
          {insights.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Principais leituras</p>
              <ul className="mt-2 space-y-1.5 text-sm leading-5">{insights.map((s, i) => <li key={i} className="flex gap-2"><span aria-hidden>•</span><span>{s}</span></li>)}</ul>
            </div>
          )}
          {methodology && <MethodologyPanel indicator={methodology} summary="Sobre o indicador" />}
        </aside>
      </div>
    </section>
  );
}
