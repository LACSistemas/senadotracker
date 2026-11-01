import type { InfrastructureIndicator, InfrastructureLevel } from '@senadotracker/db';
import type { Narrative, ScopeInfo } from '../security/types.ts';

/**
 * Modelo de visualização de Infraestrutura: tudo DERIVADO dos serviços reais de `infrastructure-read.ts` e já pronto
 * para renderizar. O cliente nunca recebe os 108 indicadores crus de uma vez, só o que cada capítulo mostra.
 */
export type InfraScope = ScopeInfo;
export type { InfrastructureLevel };

export interface StatItem { label: string; value: string; unit?: string; note?: string | null }
export interface BarRow { label: string; value: number; display: string; note?: string | null }
export interface TableRow { label: string; cells: Array<string | null> }
export interface Table { title: string; columns: string[]; rows: TableRow[]; caption?: string }

/** `ComparePoint`/`TerritoryCompare` agora vivem em `lib/comparison/types.ts` (P4) — eram uma cópia
 * byte-idêntica da versão de Bem-estar. Reexportados aqui para não quebrar nenhum import existente. */
import type { ComparePoint, TerritoryCompare } from '@/lib/comparison/types';
export type { ComparePoint, TerritoryCompare };

/** `disclosures`: os indicadores crus que sustentam o capítulo — cada um vira um bloco de fonte/período/universo/
 * cobertura, sem nenhuma consulta extra além do que o capítulo já buscou. */
export interface ChapterBase { id: string; number: number; title: string; narrative: Narrative; available: boolean; emptyReason?: string; limits: string[]; sources: string; disclosures: InfrastructureIndicator[] }

/** Um grupo de indicadores dentro de um capítulo (ex.: dentro de Energia: MMGD / ANEEL / ANP). `note` carrega
 * ressalvas específicas do grupo (cobertura parcial, universo restrito a UF/Brasil etc.). */
export interface IndicatorGroup { label: string; stats: StatItem[]; note?: string | null }

export interface WaterSanitationChapter extends ChapterBase { groups: IndicatorGroup[] }

export interface UrbanEnvironmentChapter extends ChapterBase {
  byUnit: { FACE: BarRow[]; HOUSEHOLD: BarRow[]; RESIDENT: BarRow[] };
  highlightTheme: string | null;
}

export interface HousingChapter extends ChapterBase { groups: IndicatorGroup[] }
export interface EnergyChapter extends ChapterBase { groups: IndicatorGroup[] }
export interface MobilityChapter extends ChapterBase { groups: IndicatorGroup[] }
export interface WaterSecurityChapter extends ChapterBase { groups: IndicatorGroup[] }

export interface WorksOverviewChapter extends ChapterBase {
  totals: { projects: number; singleMunicipality: number; multiTerritory: number; withoutValidLocation: number };
  bySituation: BarRow[];
  financial: Array<{ key: string; label: string; value: number | null; display: string | null }>;
}

export interface HeroKpi { code: string; label: string; value: string; unit?: string; note?: string | null; sourceFamily: string; year: number | null; compare?: TerritoryCompare | null }
export interface HeroData { lede: string; coverageNote: string; kpis: HeroKpi[]; worksChart: BarRow[] | null; worksTotal: number | null }

/** Cobertura por família de fonte (seção 21 do brief: "quais dados não estão disponíveis, de onde veio cada
 * informação") — já agregado pelo backend, zero consulta extra por indicador. */
export interface FamilyCoverage { family: string; dimension: string; indicators: number; observations: number; latestPeriod: string | null }

/** Uma linha do catálogo completo de indicadores (explorador) — inclui os sem valor, para que a ausência também
 * seja explorável, nunca escondida. */
export interface ExplorerRow { code: string; title: string; display: string; unit: string; sourceFamily: string; dimension: string; period: string | null; statusLabel: string }

// ===================================================================== Lista e detalhe de obras
export interface WorksListFilters { page: number; status?: number; category?: number; agency?: string; hasPhysicalMeasurement?: boolean; hasContracts?: boolean; hasPayment?: boolean; territorialScope?: 'SINGLE' | 'MULTI'; periodFrom?: string; periodTo?: string }
export interface WorksListItem {
  projectId: number; sourceProjectId: string; name: string; situationLabel: string | null; categoryLabel: string | null; agencyName: string | null;
  ibge7: number | null; territoryCount: number; multi: boolean;
  plannedValue: number | null; contractedValue: number | null; committedValue: number | null; paidValue: number | null;
  physicalPercent: number | null; contractCount: number; commitmentCount: number;
  periodStart: string | null; periodEnd: string | null;
}
export interface WorksListPageData { total: number; page: number; pageSize: number; items: WorksListItem[]; filters: WorksListFilters }

export interface FinancialStage { key: 'planned' | 'contracted' | 'committed' | 'liquidated' | 'paid'; label: string; value: number | null; display: string | null }
export interface WorkLocation { ibge7: number; uf: string | null; municipality: string | null; precisionCode: number | null }
export interface WorkContract { contractId: number; contractNumber: string | null; supplierName: string | null; supplierCnpj: string | null; amountGlobal: number | null; signed: string | null; vigStart: string | null; vigEnd: string | null; transparencyUrl: string | null }
export interface WorkCommitment { commitmentKey: string; nrEmpenho: string | null; emissionDate: string | null; value: number | null; liquidation: number | null; paid: number | null; source: string | null }
export interface WorkPhysicalMeasurement { percent: number | null; startDate: string | null; endDate: string | null; updatedAt: string | null }
export interface WorkHistoryEvent { statusDate: string | null; statusCode: number | null; justification: string | null }
export interface WorkDetailHeader { projectId: number; sourceProjectId: string; name: string; situationLabel: string | null; categoryLabel: string | null; natureLabel: string | null; agencyName: string | null; systemLabel: string | null; lastUpdated: string | null }
export interface WorkDetailView {
  header: WorkDetailHeader; locations: WorkLocation[]; multi: boolean;
  stages: FinancialStage[]; physical: WorkPhysicalMeasurement[]; history: WorkHistoryEvent[];
  contracts: WorkContract[]; commitments: { total: number; page: number; pageSize: number; rows: WorkCommitment[] };
  pncpStatus: 'AVAILABLE' | 'NOT_REPORTED';
}

export interface InfrastructurePageData {
  scope: InfraScope;
  hero: HeroData;
  waterSanitation: WaterSanitationChapter;
  urbanEnvironment: UrbanEnvironmentChapter;
  housing: HousingChapter;
  energy: EnergyChapter;
  mobility: MobilityChapter;
  waterSecurity: WaterSecurityChapter;
  works: WorksOverviewChapter;
  familyCoverage: FamilyCoverage[];
  explorer: ExplorerRow[];
  sources: Array<{ label: string; period: string }>;
  meta: { sqlStatements: number; dbMs: number; buildMs: number };
}
