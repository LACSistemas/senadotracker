import Link from 'next/link';
import { ArrowRight, Building2, ExternalLink, Info, Layers, Plus, ShieldCheck, Target } from 'lucide-react';
import type { DistributionPoint } from './distribution-chart.tsx';
import { MethodologyPanel, type IndicatorMethodology } from './methodology-panel.tsx';

export interface ContextIndicator { id: string; publicName: string; officialName: string; unit: string; methodologyNote?: string | null | undefined; limitations?: string[] | undefined; methodology?: IndicatorMethodology | null | undefined }
export interface ContextInspected { tribunalId: string; sigla: string; officialName: string; branchName: string; seatUf: string | null; value: number | null }

/** P14.45 — painel contextual adaptativo (mandato §8). 3 estados próprios (A: conjunto, nada
 * inspecionado; B: tribunal inspecionado, com dado; C: tribunal inspecionado, sem dado neste
 * recorte) — o 4º estado do mandato (D, "Mesa") não duplica aqui: fica só em `mesa-bar.tsx`/
 * `mesa-workspace.tsx`. Narrativas em "O que aparece nos dados" são determinísticas: só aritmética
 * sobre os pontos já carregados (posição vs. mediana, contagem, mín/máx) — nunca causalidade, nunca
 * "qualidade institucional". */
function narrativeFor(points: DistributionPoint[], min: number, median: number, max: number, formatValue: (v: number) => string, inspectedValue?: number | null): { overview: string; position?: string; rank?: string } {
  // Achado real (V1.1, mandato §7.1): esta linha usava `.toFixed(3)` no valor bruto, ignorando
  // `formatValue` — pra indicadores em R$ isso imprimia reais crus sem separador de milhar nem
  // abreviação ("variando de 1234567.891 a ..."), em vez de "R$ 1,2 mi". `formatValue` já resolve a
  // unidade certa (mesma função usada no eixo do gráfico e no valor em destaque).
  const overview = `${points.length} tribunais têm dado elegível neste recorte, variando de ${formatValue(min)} a ${formatValue(max)} (mediana ${formatValue(median)}).`;
  if (inspectedValue == null || median === 0) return { overview };
  const diffPct = ((inspectedValue - median) / Math.abs(median)) * 100;
  const dir = diffPct >= 0 ? 'acima' : 'abaixo';
  const rank = points.filter(p => p.value <= (inspectedValue as number)).length;
  return { overview, position: `${Math.abs(diffPct).toFixed(0)}% ${dir} da mediana do conjunto`, rank: `Posição ${rank} de ${points.length} (do menor para o maior valor).` };
}

export function ContextPanel({
  indicator, distribution, inspected, formatValue, year, hrefAddToMesa, hrefRemoveFromMesa, hrefProfile, hrefClearInspection,
}: {
  indicator: ContextIndicator | null;
  distribution: { points: DistributionPoint[]; min: number; median: number; max: number } | null;
  inspected: ContextInspected | null;
  formatValue: (v: number) => string;
  year: number;
  hrefAddToMesa?: string | undefined;
  hrefRemoveFromMesa?: string | undefined;
  hrefProfile?: string | undefined;
  hrefClearInspection?: string | undefined;
}) {
  const hasValueForInspected = inspected && inspected.value != null;
  const narrative = distribution ? narrativeFor(distribution.points, distribution.min, distribution.median, distribution.max, formatValue, inspected?.value) : null;

  return (
    <aside className="flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-5" aria-label="Painel contextual da investigação">
      {/* Estado C: tribunal inspecionado, sem dado neste indicador/recorte */}
      {inspected && !hasValueForInspected && (
        <div>
          <p className="eyebrow">Tribunal inspecionado</p>
          <div className="mt-2 flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground"><Building2 size={20} aria-hidden /></span>
            <div className="min-w-0"><h2 className="text-xl font-black leading-tight">{inspected.sigla}</h2><p className="text-xs text-muted-foreground">{inspected.officialName}</p></div>
          </div>
          <div className="mt-4 rounded-xl border border-dashed bg-background p-4">
            <p className="text-sm leading-5 text-muted-foreground">Este tribunal não tem dado publicado para {indicator?.publicName.toLowerCase() ?? 'este indicador'} em {year} — não é um valor zero, é ausência de publicação. Escolha outro indicador ou outro ano para ver o que este tribunal publica.</p>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            {hrefProfile && <Link href={hrefProfile} className="focus-ring inline-flex items-center justify-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-bold hover:border-primary">Abrir perfil do tribunal <ExternalLink size={14} aria-hidden /></Link>}
            {hrefClearInspection && <Link replace scroll={false} href={hrefClearInspection} className="focus-ring text-center text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline">Voltar à distribuição</Link>}
          </div>
        </div>
      )}

      {/* Estado B: tribunal inspecionado, com dado real */}
      {inspected && hasValueForInspected && (
        <div>
          <p className="eyebrow">Tribunal inspecionado</p>
          <div className="mt-2 flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><Building2 size={20} aria-hidden /></span>
            <div className="min-w-0">
              <h2 className="text-xl font-black leading-tight">{inspected.sigla}</h2>
              <p className="text-xs text-muted-foreground">{inspected.officialName}</p>
              <p className="mt-0.5 text-xs font-semibold text-muted-foreground">{inspected.branchName}{inspected.seatUf ? ` · ${inspected.seatUf}` : ''}</p>
            </div>
          </div>

          <div className="mt-4 border-t pt-4">
            <p className="eyebrow">Indicador em foco</p>
            <p className="mt-1 text-sm font-bold">{indicator?.publicName}</p>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-3xl font-black tabular-nums">{formatValue(inspected.value as number)}</span>
              <span className="text-xs text-muted-foreground">Período: {year}</span>
            </div>
            {distribution && (
              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary" role="img" aria-label={`Posição dentro da faixa observada, de ${formatValue(distribution.min)} a ${formatValue(distribution.max)}`}>
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(3, Math.min(100, ((inspected.value as number) - distribution.min) / ((distribution.max - distribution.min) || 1) * 100))}%` }} />
              </div>
            )}
            {narrative?.position && <p className="mt-3 text-sm leading-5 text-muted-foreground">{inspected.sigla} está {narrative.position}. {narrative.rank}</p>}
          </div>

          <div className="mt-2 flex items-start gap-2 rounded-xl bg-secondary/50 p-3">
            <Info size={15} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
            <div><p className="text-xs font-bold">O que significa?</p><p className="mt-0.5 text-xs leading-5 text-muted-foreground">{indicator?.methodology?.description ?? `Indica ${indicator?.publicName.toLowerCase()}, medido pelo CNJ no ano-base ${year}.`}</p></div>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {hrefAddToMesa && <Link replace scroll={false} href={hrefAddToMesa} className="focus-ring inline-flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"><Plus size={15} aria-hidden /> Adicionar à Mesa</Link>}
            {hrefRemoveFromMesa && <Link replace scroll={false} href={hrefRemoveFromMesa} className="focus-ring inline-flex items-center justify-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-bold text-muted-foreground hover:border-primary hover:text-primary">Remover da Mesa</Link>}
            {hrefProfile && <Link href={hrefProfile} className="focus-ring inline-flex items-center justify-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-bold hover:border-primary">Abrir perfil do tribunal <ExternalLink size={14} aria-hidden /></Link>}
          </div>

          {indicator?.methodology && <div className="mt-1"><MethodologyPanel indicator={indicator.methodology} summary="Sobre o indicador" /></div>}
        </div>
      )}

      {/* Estado A: resumo descritivo do conjunto, sem nada inspecionado ainda */}
      {!inspected && (
        <div>
          <p className="text-base font-black leading-snug">O que os dados mostram</p>
          {narrative ? (
            <>
              <p className="mt-1.5 text-sm leading-5 text-muted-foreground">{narrative.overview}</p>
              <ul className="mt-4 space-y-3 text-sm">
                <li className="flex items-start gap-2.5"><Layers size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden /><span><span className="font-bold">Visão do conjunto.</span> <span className="text-muted-foreground">Distribuição, faixa de valores e mediana entre os tribunais elegíveis.</span></span></li>
                <li className="flex items-start gap-2.5"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden /><span><span className="font-bold">Cobertura.</span> <span className="text-muted-foreground">Só tribunais com dado publicado neste recorte entram no gráfico — ausência nunca vira zero.</span></span></li>
                <li className="flex items-start gap-2.5"><Target size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden /><span><span className="font-bold">Interpretação.</span> <span className="text-muted-foreground">Compare a posição de cada ponto em relação à mediana — isso não indica causa, só diferença observada.</span></span></li>
              </ul>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Escolha um indicador ou busque um tribunal para começar.</p>
          )}
          <p className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">Clique ou toque num ponto do gráfico (ou numa linha da tabela) para inspecionar um tribunal. <ArrowRight size={12} aria-hidden /></p>
          {indicator?.methodology && <div className="mt-3"><MethodologyPanel indicator={indicator.methodology} summary="Sobre o indicador" /></div>}
        </div>
      )}
    </aside>
  );
}
