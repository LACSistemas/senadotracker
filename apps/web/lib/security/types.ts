/**
 * Modelo de visualização da experiência de Segurança (P9.8). Tudo aqui é DERIVADO dos read models reais e já vem pronto para renderizar:
 * o cliente nunca recebe os payloads brutos (centenas de KB), só séries curadas.
 */
export type PointState = 'ok' | 'prelim' | 'partial' | 'zero' | 'suppressed' | 'absent';
export type Grain = 'A' | 'M';

export interface ChartPoint { t: string; v: number | null; state: PointState; n?: number | null; d?: number | null }
export interface ChartSeries { key: string; label: string; color?: 'primary' | 'ink' | 'amber' | 'blue' | 'plum' | 'grey'; dash?: boolean; points: ChartPoint[] }
export interface BenchBandPoint { t: string; p25: number; p50: number; p75: number; n: number; universe: number }
export type BenchStatus = 'ok' | 'indisponivel';
export interface BenchView {
  status: BenchStatus; label: string; cohort: string; basis: string; points: BenchBandPoint[]; unavailableReason?: string;
  /** frase pronta e já validada contra o que os dados permitem dizer */ sentence?: string;
}
export interface ChartMarker { t: string; label: string }
export interface ChartView {
  id: string; title: string; unit: string; digits: number; grain: Grain; series: ChartSeries[]; /** mesma série em meses, quando o gráfico principal é anual */ monthly?: ChartSeries[] | undefined; bench?: BenchView | undefined; /** quando o benchmark é calculado sob demanda */ benchUrl?: string | undefined;
  /** rótulos próprios dos períodos (ex.: semestre 2025/2) */ periodNames?: Record<string, string> | undefined; markers?: ChartMarker[]; /** períodos sem estimativa oficial de população etc. */ gaps?: Array<{ from: string; to: string; label: string }>; notes: string[]; source: string; coverage: string;
}

/** Visão de um indicador com as duas leituras possíveis (quantidade e taxa), para o seletor do capítulo. */
export interface MeasureView { key: 'count' | 'rate'; label: string; chart: ChartView }
export interface ExploreOption {
  id: string; label: string; plain: string; group: string; scope: 'municipio' | 'uf'; /** onde o dado vive: o município ou só o contexto da UF */
  source: string; definition: string; caveat: string | null; unit: string; measures: MeasureView[]; sensitive?: boolean;
  /** séries pesadas só vêm ao selecionar (rota /api/seguranca/opcao) */ lazy?: boolean; peek?: { t: string; v: number | null } | null; /** categorias exclusivas da mesma fonte e unidade: podem ser mostradas como distribuição */ exclusiveGroup?: string;
}

export interface Ruler { own: number; p25: number; p50: number; p75: number; digits: number; unit: string; year: string; cohort: string; n: number; prefix?: string }
export interface Kpi {
  id: string; label: string; plain: string; value: string; unit: string; basis: string; chapter: string;
  delta: { text: string; direction: 'up' | 'down' | 'flat' } | null;
  compare: { text: string; valid: boolean } | null; ruler: Ruler | null;
  spark: number[]; sparkLabel: string; secondary: string | null; caveat: string | null; source: string; state: 'ok' | 'prelim';
}
export interface Hero { kpis: Kpi[]; lede: string; facts: string[]; rejected: Array<{ id: string; reason: string }> }

export interface Narrative { question: string; answer: string; context: string | null; invite: string }

export interface ChapterBase { id: string; number: number; title: string; question: string; narrative: Narrative; available: boolean; emptyReason?: string }
export interface CrimeChapter extends ChapterBase { options: ExploreOption[]; defaultOptionId: string | null; municipalCoverage: string; stateOnly: string[]; sourceNote: string; stateSource: string | null }

export interface InstitutionCard { key: string; label: string; scope: 'estado' | 'municipio' | 'nacional'; value: number | null; unit: string; basis: string; source: string; note: string | null; planned?: number | null; occupancyPct?: number | null }
export interface StructureChapter extends ChapterBase {
  municipal: InstitutionCard[]; state: InstitutionCard[]; plannedVsExisting: Array<{ corporation: string; existing: number | null; planned: number | null; occupancyPct: number | null; basis: string }>;
  editions: Array<{ label: string; items: Array<{ label: string; value: string }> }>; detran: { available: boolean; statement: string; items: string[] }; restrictions: string[];
}

export interface TrafficChapter extends ChapterBase {
  deaths: { residence: ChartView | null; occurrence: ChartView | null; rate: ChartView | null }; byUser: Array<{ label: string; value: number; year: number }>; fleet: ChartView | null; fleetByType: Array<{ label: string; value: number }>; fleetBasis: string | null;
  prf: ChartView | null; renaest: ChartView | null; renaestCoverage: string | null; infractions: ChartView | null; restrictions: string[];
}

export interface PrisonUnitView { name: string; ambito: string; tipo: string; capacity: number | null; population: number | null; occupancyPct: number | null; ref: string; cycles: number; pendingIdentity: number }
export interface PrisonChapter extends ChapterBase {
  scopeKind: 'municipio' | 'uf'; capacityVsPopulation: ChartView | null; occupancy: ChartView | null; units: PrisonUnitView[]; regimes: Array<{ label: string; population: number | null; capacity: number | null }>; regimesRef: string | null;
  stateContext: { occupancy: ChartView | null; label: string } | null; domiciliary: { label: string; value: number | null } | null; restrictions: string[]; observed: string;
}

export interface MoneyStage { key: 'dotacao' | 'empenhada' | 'liquidada' | 'paga'; label: string; hint: string }
export interface FinanceYear { exercicio: number; stages: Partial<Record<MoneyStage['key'], number | null>>; share: number | null; perCapitaPaid: number | null; preliminary: boolean; subfunctions: Array<{ code: string; label: string; empenhada: number | null; paga: number | null }> }
export interface FinanceChapter extends ChapterBase {
  years: FinanceYear[]; stages: MoneyStage[]; stateContext: { label: string; latest: FinanceYear | null } | null; bench: BenchView | null; contractsPreview: ContractPreview | null;
  restrictions: string[]; coverage: string; organsNote: string; detranNote: string | null;
}
export interface ContractPreview { total: number; byYear: Array<{ year: number; contracts: number; valueCents: number }>; entityId: number; partialYear: number | null }

export interface PoliceFamilyView { code: string; label: string; semantics: string; series: Array<{ source: string; abrangencia: string; unit: string; note: string | null; chart: ChartView }> }
export interface PoliceChapter extends ChapterBase { families: PoliceFamilyView[]; notAvailable: string[]; restrictions: string[]; national: Array<{ family: string; label: string; indicatorId: number; abrangencia: string; unit: string; years: Array<{ year: number; value: number; complete: boolean; ufs: number }> }> }

export interface SourceStamp { label: string; period: string; note?: string }
export interface ScopeInfo { kind: 'uf' | 'municipio'; entityId: number; ufCode: number; uf: string; name: string; stateName: string; population: { value: number; year: number } | null }
export interface SecurityPageData {
  scope: ScopeInfo; hero: Hero; crime: CrimeChapter; structure: StructureChapter; traffic: TrafficChapter; prison: PrisonChapter; finance: FinanceChapter; police: PoliceChapter;
  sources: SourceStamp[]; explorerCount: number;
  meta: { sqlStatements: number; dbMs: number; buildMs: number; maxStatementMs?: number; statementMs?: number[] };
}
