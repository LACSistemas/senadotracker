import Link from 'next/link';
import { DistributionChart, type DistributionPoint, type DistributionScale, type DistributionVis } from './distribution-chart.tsx';
import { ContextPanel, type ContextIndicator, type ContextInspected } from './context-panel.tsx';
import { MesaBar, type MesaBarItem } from './mesa-bar.tsx';
import type { DataCoverage } from '@senadotracker/domain';

export interface RelatedQuestion { label: string; href: string }

/** P14.45/V1.1 — Canvas investigativo (só o modo "indicador ativo" do mandato): Mesa compacta, área
 * analítica (distribuição + perguntas relacionadas) e painel contextual. A experiência de diretório
 * (busca, atalhos, listagem paginada) saiu deste componente na V1.1 — vive em `tribunal-directory.tsx`,
 * renderizada pela `page.tsx` só quando NENHUM indicador está ativo (os 2 modos nunca se misturam,
 * acabando de vez com a duplicação observada entre diretório e distribuição). Server Component puro —
 * toda a interação é `<Link>`/formulário GET real, nenhum `'use client'` aqui. */
export function TribunalExplorerCanvas({
  indicator, distribution, inspected, inspectedValue, formatValue, year,
  mesaItems, mesaHrefOpen, hrefAddToMesa, hrefRemoveFromMesa, hrefProfile, hrefClearInspection, hrefForPoint,
  relatedQuestions, vis, hrefVis, scale, hrefScale,
}: {
  indicator: ContextIndicator | null;
  distribution: { points: DistributionPoint[]; min: number; median: number; max: number; coverage: DataCoverage } | null;
  inspected: Omit<ContextInspected, 'value'> | null;
  inspectedValue: number | null;
  formatValue: (v: number) => string;
  year: number;
  mesaItems: MesaBarItem[];
  mesaHrefOpen: string;
  hrefAddToMesa?: string | undefined;
  hrefRemoveFromMesa?: string | undefined;
  hrefProfile?: string | undefined;
  hrefClearInspection?: string | undefined;
  hrefForPoint: (tribunalId: string) => string;
  relatedQuestions: RelatedQuestion[];
  vis?: DistributionVis | undefined;
  hrefVis?: ((v: DistributionVis) => string) | undefined;
  scale?: DistributionScale | undefined;
  hrefScale?: ((s: DistributionScale) => string) | undefined;
}) {
  return (
    <div className="space-y-5">
      <MesaBar items={mesaItems} hrefOpenMesa={mesaHrefOpen} />

      {distribution && indicator ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0">
            <DistributionChart title={indicator.publicName} points={distribution.points} selectedTribunalId={inspected?.tribunalId} mesaIds={mesaItems.map(m => m.tribunalId)} formatValue={formatValue} hrefForPoint={hrefForPoint} coverage={distribution.coverage} vis={vis} hrefVis={hrefVis} scale={scale} hrefScale={hrefScale} />
            {relatedQuestions.length > 0 && (
              <div className="mt-5">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Perguntas relacionadas</p>
                <ul className="mt-2 flex flex-wrap gap-2">{relatedQuestions.map(q => <li key={q.href}><Link href={q.href} className="focus-ring block rounded-full border px-3 py-1.5 text-xs font-semibold hover:border-primary">{q.label}</Link></li>)}</ul>
              </div>
            )}
          </div>
          <ContextPanel indicator={indicator} distribution={{ points: distribution.points, min: distribution.min, median: distribution.median, max: distribution.max }}
            inspected={inspected ? { ...inspected, value: inspectedValue } : null} formatValue={formatValue} year={year}
            hrefAddToMesa={hrefAddToMesa} hrefRemoveFromMesa={hrefRemoveFromMesa} hrefProfile={hrefProfile} hrefClearInspection={hrefClearInspection} />
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed bg-background p-6 text-center text-sm text-muted-foreground">Escolha um indicador no filtro acima para ver a distribuição real entre os tribunais.</p>
      )}
    </div>
  );
}
