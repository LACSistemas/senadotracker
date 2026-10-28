import type { ChartView, Kpi, Narrative, Ruler, ScopeInfo } from '../security/types.ts';

/**
 * Modelo de visualização da página de Educação: tudo DERIVADO dos read models e já pronto para renderizar.
 * O cliente só recebe séries curadas e textos, nunca os payloads brutos.
 */
export type EduScope = ScopeInfo;

/** Uma dimensão de escolha do explorador (ex.: disciplina, etapa, rede). */
export interface ExplorerDim { id: string; label: string; options: Array<{ value: string; label: string }> }
/** Barra de distribuição (ex.: % de alunos por nível do Saeb), com referência opcional (Brasil) para comparar. */
export interface DistBar { label: string; value: number; ref?: number | null }
export interface ExplorerView {
  chart: ChartView | null;
  /** frase curta com o número mais recente e a comparação */
  headline: string | null;
  /** nota específica desta combinação (ex.: escala própria da série) */
  note: string | null;
  dist?: { title: string; caption: string; bars: DistBar[]; refLabel: string | null } | undefined;
}
export interface Explorer {
  id: string;
  dims: ExplorerDim[];
  defaults: Record<string, string>;
  /** chave = valores das dimensões, na ordem de `dims`, separados por "|" */
  views: Record<string, ExplorerView>;
  emptyText: string;
}

export interface StatItem { label: string; value: string; unit?: string; note?: string | null }
export interface BarRow { label: string; value: number; display: string; note?: string | null }
export interface TableRow { label: string; cells: Array<string | null> }
export interface Table { title: string; columns: string[]; rows: TableRow[]; caption?: string }

export interface ChapterBase { id: string; number: number; title: string; narrative: Narrative; available: boolean; emptyReason?: string; limits: string[]; sources: string }

export interface NetworkChapter extends ChapterBase {
  stats: StatItem[]; enrollment: ChartView | null; stages: BarRow[]; dependency: BarRow[]; special: StatItem[];
}
export interface LearningChapter extends ChapterBase {
  explorer: Explorer | null; ideb: Explorer | null; secondary: Table | null;
}
export interface TrajectoryChapter extends ChapterBase {
  explorer: Explorer | null; breakdown: Table | null; transition: StatItem[]; transitionYear: number | null;
}
export interface ContextChapter extends ChapterBase { inse: ChartView | null; stats: StatItem[]; classes: BarRow[] }
export interface StructureChapter extends ChapterBase { explorer: Explorer | null; items: BarRow[]; universe: string | null; stats: StatItem[] }
export interface TeachersChapter extends ChapterBase { stats: StatItem[]; docentes: ChartView | null; formation: BarRow[]; table: Table | null }
export interface MoneyChapter extends ChapterBase {
  contractsChart: ChartView | null; contractStats: StatItem[]; categories: BarRow[]; suppliers: Table | null; works: Table | null; worksNote: string | null;
  programs: Table | null; finance: Table | null;
}

/** Destaque descritivo de qualidade: sempre UM indicador + UM ciclo + UMA área por vez. Nunca combina IGC/CPC/Enade/IDD, nunca diz "melhor do Brasil". */
export interface SuperlativeHighlight { label: string; value: string; unit: string; basis: string; detail: string; caveat: string | null }

export interface EnemSubjectTab { id: string; label: string; headline: string; byNetwork: BarRow[] }
export interface EnemChapter extends ChapterBase {
  stats: StatItem[]; bench: Ruler | null; bySubject: BarRow[]; tabs: EnemSubjectTab[];
}

export interface HigherEdChapter extends ChapterBase {
  stats: StatItem[]; seatStats: StatItem[]; byNetwork: BarRow[]; byModality: BarRow[]; coursesTable: Table | null; bench: Ruler | null;
}
export interface QualityChapter extends ChapterBase {
  igcBands: BarRow[]; courseHighlights: SuperlativeHighlight[]; stats: StatItem[];
}
export interface GraduateChapter extends ChapterBase {
  stats: StatItem[]; byArea: BarRow[]; programsTable: Table | null; evaluationBands: BarRow[]; bench: Ruler | null;
}

export interface EducationPageData {
  scope: EduScope;
  year: number;
  hero: { lede: string; kpis: Kpi[] };
  network: NetworkChapter; learning: LearningChapter; trajectory: TrajectoryChapter; context: ContextChapter;
  structure: StructureChapter; teachers: TeachersChapter; money: MoneyChapter; enem: EnemChapter;
  higherEd: HigherEdChapter; quality: QualityChapter; graduate: GraduateChapter;
  sources: Array<{ label: string; period: string }>;
  meta: { sqlStatements: number; dbMs: number; buildMs: number };
}
