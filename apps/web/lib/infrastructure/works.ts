import {
  getInfrastructureWorkDetail, getInfrastructureWorkFinancialEvidence, getInfrastructureWorksList,
  type InfrastructureTerritory,
} from '@senadotracker/db';
import { webPostgresPool } from '../postgres-pool.ts';
import { instrument } from '../security/load.ts';
import { brlShort, centsToReais } from './format.ts';
import type { FinancialStage, WorkCommitment, WorkContract, WorkDetailView, WorkHistoryEvent, WorkLocation, WorkPhysicalMeasurement, WorksListFilters, WorksListItem, WorksListPageData } from './types.ts';

const num = (v: unknown): number | null => v == null ? null : Number(v);
const str = (v: unknown): string | null => v == null ? null : String(v);
const date = (v: unknown): string | null => v == null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);

/** Lista paginada e filtrável de obras de um território — nunca busca as 155 mil linhas no browser: paginação e
 * filtros são resolvidos no banco (`getInfrastructureWorksList`), preservados na URL pela página que chama isto. */
export async function loadWorksListPage(t: InfrastructureTerritory, filters: WorksListFilters): Promise<WorksListPageData> {
  const pool = webPostgresPool();
  const r = await getInfrastructureWorksList(pool, t, {
    page: filters.page, pageSize: 25,
    ...(filters.status != null ? { status: filters.status } : {}), ...(filters.category != null ? { category: filters.category } : {}),
    ...(filters.agency ? { agency: filters.agency } : {}), ...(filters.hasPhysicalMeasurement != null ? { hasPhysicalMeasurement: filters.hasPhysicalMeasurement } : {}),
    ...(filters.hasContracts != null ? { hasContracts: filters.hasContracts } : {}), ...(filters.hasPayment != null ? { hasPayment: filters.hasPayment } : {}),
    ...(filters.territorialScope ? { territorialScope: filters.territorialScope } : {}), ...(filters.periodFrom ? { periodFrom: filters.periodFrom } : {}),
    ...(filters.periodTo ? { periodTo: filters.periodTo } : {}),
  });
  const items: WorksListItem[] = r.items.map((row: Record<string, unknown>) => ({
    projectId: Number(row.project_id), sourceProjectId: String(row.source_project_id), name: String(row.name),
    situationLabel: str(row.situation_label), categoryLabel: str(row.category_label), agencyName: str(row.agency_name),
    ibge7: num(row.ibge7), territoryCount: Number(row.territory_count), multi: Number(row.territory_count) > 1,
    plannedValue: centsToReais(row.allocated_planned_amount as number | null), contractedValue: centsToReais(row.allocated_contract_amount_global as number | null),
    committedValue: centsToReais(row.allocated_committed_cents as number | null), paidValue: row.allocated_paid != null ? Number(row.allocated_paid) : null,
    physicalPercent: num(row.latest_physical_percent), contractCount: Number(row.contract_count ?? 0), commitmentCount: Number(row.commitment_count ?? 0),
    periodStart: date(row.d_start_prev), periodEnd: date(row.d_end_prev),
  }));
  return { total: r.total, page: r.page, pageSize: r.pageSize, items, filters };
}

const stage = (key: FinancialStage['key'], label: string, value: number | null): FinancialStage => ({ key, label, value, display: value != null ? brlShort(value) : null });

/** Detalhe completo de uma obra: estágios financeiros nunca somados entre si; empenhos paginados pelo banco
 * (`getInfrastructureWorkFinancialEvidence`) porque uma obra pode ter centenas de registros. */
export async function loadWorkDetail(projectId: number, commitmentsPage = 1): Promise<WorkDetailView | null> {
  const pool = webPostgresPool(); const { q } = instrument(pool);
  const [detail, evidence] = await Promise.all([
    getInfrastructureWorkDetail(q, projectId),
    getInfrastructureWorkFinancialEvidence(q, projectId, commitmentsPage, 50),
  ]);
  if (!detail) return null;
  const p = detail.project as Record<string, unknown>;
  const locations: WorkLocation[] = detail.locations.map((l: Record<string, unknown>) => ({ ibge7: Number(l.ibge7), uf: str(l.uf), municipality: str(l.municipality), precisionCode: num(l.precision_code) }));
  const contracts: WorkContract[] = detail.contracts.map((c: Record<string, unknown>) => ({
    contractId: Number(c.contract_id), contractNumber: str(c.contract_number), supplierName: str(c.supplier_name), supplierCnpj: str(c.supplier_cnpj),
    amountGlobal: centsToReais(c.amount_global as number | null), signed: date(c.signed), vigStart: date(c.vig_start), vigEnd: date(c.vig_end), transparencyUrl: str(c.transparency_url),
  }));
  const commitments: WorkCommitment[] = evidence.rows.map((c: Record<string, unknown>) => ({
    commitmentKey: String(c.commitment_key), nrEmpenho: str(c.nr_empenho), emissionDate: date(c.emission_date),
    value: centsToReais(c.value_cents as number | null), liquidation: c.liquidation != null ? Number(c.liquidation) : null, paid: c.paid != null ? Number(c.paid) : null, source: str(c.source),
  }));
  const physical: WorkPhysicalMeasurement[] = detail.physical.map((ph: Record<string, unknown>) => ({ percent: num(ph.percent), startDate: date(ph.start_date), endDate: date(ph.end_date), updatedAt: date(ph.updated_at) }));
  const history: WorkHistoryEvent[] = detail.history.map((h: Record<string, unknown>) => ({ statusDate: date(h.status_date), statusCode: num(h.status_code), justification: str(h.justification) }));
  const stages = [
    stage('planned', 'Previsto', centsToReais(p.planned_amount as number | null)),
    stage('contracted', 'Contratado', centsToReais(p.contract_amount_global as number | null)),
    stage('committed', 'Empenhado', centsToReais(p.committed_cents as number | null)),
    stage('liquidated', 'Liquidado', p.liquidated != null ? Number(p.liquidated) : null),
    stage('paid', 'Pago', p.paid != null ? Number(p.paid) : null),
  ];
  const lastUpdated = [date(p.physical_updated_at), date(p.latest_status_date)].filter((d): d is string => !!d).sort().at(-1) ?? null;
  return {
    header: {
      projectId: Number(p.project_id), sourceProjectId: String(p.source_project_id), name: String(p.name),
      situationLabel: str(p.situation_label), categoryLabel: str(p.category_label), natureLabel: str(p.nature_label),
      agencyName: str(p.agency_name), systemLabel: str(p.system_label), lastUpdated,
    },
    locations, multi: locations.length > 1, stages, physical, history, contracts,
    commitments: { total: evidence.total, page: evidence.page, pageSize: evidence.pageSize, rows: commitments },
    pncpStatus: detail.availability.pncpLinks as 'AVAILABLE' | 'NOT_REPORTED',
  };
}
