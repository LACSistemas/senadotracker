import type { ChartView, Narrative, ScopeInfo } from '../security/types.ts';
import type { WellbeingObservation } from '@senadotracker/db';

/**
 * Modelo de visualização da página de Bem-estar: tudo DERIVADO do read model (`getWellbeingOverview` e companhia) e já
 * pronto para renderizar. O cliente nunca recebe os 27 indicadores crus, só o que cada capítulo decidiu mostrar.
 */
export type WbScope = ScopeInfo;

export interface StatItem { label: string; value: string; unit?: string; note?: string | null }
export interface BarRow { label: string; value: number; display: string; note?: string | null }
export interface TableRow { label: string; cells: Array<string | null> }
export interface Table { title: string; columns: string[]; rows: TableRow[]; caption?: string }

/** `disclosures`: as observações cruas que sustentam o capítulo — cada uma vira um `<IndicatorDetails>` (fonte, período,
 * unidade, universo, cobertura, revisão, link oficial), sem nenhuma consulta extra além do que o capítulo já buscou. */
export interface ChapterBase { id: string; number: number; title: string; narrative: Narrative; available: boolean; emptyReason?: string; limits: string[]; sources: string; disclosures: WellbeingObservation[] }

/** Um dos três pontos de comparação (território/UF/Brasil): nunca uma faixa de percentil, porque o read model de
 * Bem-estar não calcula distribuição entre municípios-pares — só os três valores diretos. */
export interface ComparePoint { label: string; value: number | null; display: string; eligible: boolean; reason: string | null }
export interface TerritoryCompare { unit: string; year: string | null; own: ComparePoint; state: ComparePoint | null; brazil: ComparePoint; restrictions: string[] }

export interface ConditionsChapter extends ChapterBase {
  incomeBars: BarRow[]; incomeCompare: TerritoryCompare | null;
  housing: BarRow[]; gini: StatItem | null;
}
export interface WorkChapter extends ChapterBase {
  stats: StatItem[]; raisChart: ChartView | null; cagedChart: ChartView | null; remuneration: StatItem | null;
}
export interface SocialChapter extends ChapterBase {
  cras: StatItem[]; crasCapacity: BarRow[]; creas: StatItem | null; creasNote: string | null; indices: StatItem[];
}
/** O read model não preserva, por município, qual categoria original (recusa/não informou/não aplicável) gerou um
 * valor nulo — só o agregado por UF distingue "válidas" de "não válidas". Por isso o status por município é só
 * sim/não/sem resposta válida; a repartição de motivos só existe no nível agregado (`distribution`). */
export interface DigitalItem { code: string; label: string; status: 'sim' | 'nao' | 'sem_resposta_valida'; detail: string | null }
export interface DigitalChapter extends ChapterBase {
  items: DigitalItem[]; distribution: BarRow[];
}
export interface ActionChapter extends ChapterBase {
  stats: StatItem[]; table: Table | null;
}
export interface EvolutionSeries { title: string; chart: ChartView }
export interface EvolutionChapter extends ChapterBase {
  series: EvolutionSeries[];
}

/** Fatos selecionados para o panorama: nunca os 27 indicadores, nunca Gini/remuneração UF como se fossem do município. */
export interface PortraitFact { label: string; value: string; unit: string; period: string; source: string }

export interface WellbeingPageData {
  scope: WbScope;
  portrait: { lede: string; facts: PortraitFact[] };
  conditions: ConditionsChapter; work: WorkChapter; social: SocialChapter; digital: DigitalChapter; action: ActionChapter; evolution: EvolutionChapter;
  sources: Array<{ label: string; period: string }>;
  meta: { sqlStatements: number; dbMs: number; buildMs: number };
}
