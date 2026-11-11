import {
  getJudiciaryNationalOverview, getJudiciaryNationalSeries, getJudiciaryTribunalDirectory, getJudiciaryTribunalProfile,
  getJudiciaryTribunalSeries, getJudiciaryComparison, getJudiciaryIndicatorDistribution, getJudiciaryStjJurisprudenceOverview, getJudiciaryStjPrecedentExplorer,
  getJudiciaryStjPrecedentProfile, getJudiciaryStfJurisprudenceOverview, getJudiciaryStfTemaExplorer, getJudiciaryStfTemaProfile,
  getJudiciaryStfPayrollSummary, getJudiciaryStfPayrollExplorer, getJudiciaryStfPayrollProfile,
  getJudiciaryStfGeneralJurisprudenceOverview, getJudiciaryStfGeneralJurisprudenceRanking,
  getJudiciaryStfGeneralJurisprudenceExplorer, getJudiciaryStfGeneralJurisprudenceProfile,
  getJudiciaryFinancialProfile, getJudiciaryFinancialHistory, getJudiciaryPersonnelProfile, getJudiciaryTerritorialInstitutions,
  getJudiciarySourceMethodology, type TribunalDirectoryFilters, type JurisprudenciaFilters,
} from '@senadotracker/db';
import { webPostgresPool } from './postgres-pool.ts';
import { memo } from './security/load.ts';

/** P14.8 — wrappers finos sobre o serving do Judiciário (P14.7/P14.7-R), só adicionando cache de 5min
 * (mesma régua de `territory-executive.ts`). Nenhuma lógica nova: o serving já devolve
 * {availability, data, provenance} pronto para a UI — aqui só se injeta o pool e se cacheia a consulta. */
const TTL = 5 * 60_000;

export async function loadJudiciaryOverview(year = 2025) {
  return memo(`jud-overview:${year}`, () => getJudiciaryNationalOverview(webPostgresPool(), year), TTL);
}
export async function loadJudiciaryNationalSeries(indicatorIds: string[]) {
  return memo(`jud-series:${[...indicatorIds].sort().join(',')}`, () => getJudiciaryNationalSeries(webPostgresPool(), indicatorIds), TTL);
}
export async function loadJudiciaryTribunalDirectory(filters: TribunalDirectoryFilters = {}) {
  return memo(`jud-directory:${JSON.stringify(filters)}`, () => getJudiciaryTribunalDirectory(webPostgresPool(), filters), TTL);
}
export async function loadJudiciaryTribunalProfile(tribunalId: string, year = 2025) {
  return memo(`jud-tribunal:${tribunalId}:${year}`, () => getJudiciaryTribunalProfile(webPostgresPool(), tribunalId, year), TTL);
}
export async function loadJudiciaryIndicatorDistribution(indicatorId: string, year = 2025) {
  return memo(`jud-dist:${indicatorId}:${year}`, () => getJudiciaryIndicatorDistribution(webPostgresPool(), indicatorId, year), TTL);
}
export async function loadJudiciaryTribunalSeries(tribunalId: string, indicatorId: string) {
  return memo(`jud-tribunal-series:${tribunalId}:${indicatorId}`, () => getJudiciaryTribunalSeries(webPostgresPool(), tribunalId, indicatorId), TTL);
}
export async function loadJudiciaryComparison(indicatorId: string, tribunalIds: string[], year: number) {
  return memo(`jud-comparison:${indicatorId}:${[...tribunalIds].sort().join(',')}:${year}`, () => getJudiciaryComparison(webPostgresPool(), indicatorId, tribunalIds, year), TTL);
}
export async function loadJudiciaryStjOverview() {
  return memo('jud-stj-overview', () => getJudiciaryStjJurisprudenceOverview(webPostgresPool()), TTL);
}
export async function loadJudiciaryStjPrecedents(filters: { status?: string; type?: string; year?: number; page?: number; pageSize?: number } = {}) {
  return memo(`jud-stj-precedents:${JSON.stringify(filters)}`, () => getJudiciaryStjPrecedentExplorer(webPostgresPool(), filters), TTL);
}
export async function loadJudiciaryStjPrecedentDetail(precedentId: string) {
  return memo(`jud-stj-precedent:${precedentId}`, () => getJudiciaryStjPrecedentProfile(webPostgresPool(), precedentId), TTL);
}
export async function loadJudiciaryStfOverview() {
  return memo('jud-stf-overview', () => getJudiciaryStfJurisprudenceOverview(webPostgresPool()), TTL);
}
export async function loadJudiciaryStfTemas(filters: { situation?: string; hasRepercussion?: boolean; page?: number; pageSize?: number } = {}) {
  return memo(`jud-stf-temas:${JSON.stringify(filters)}`, () => getJudiciaryStfTemaExplorer(webPostgresPool(), filters), TTL);
}
export async function loadJudiciaryStfTemaDetail(temaNumber: string) {
  return memo(`jud-stf-tema:${temaNumber}`, () => getJudiciaryStfTemaProfile(webPostgresPool(), temaNumber), TTL);
}
export async function loadJudiciaryStfPayrollSummary() {
  return memo('jud-stf-payroll-summary', () => getJudiciaryStfPayrollSummary(webPostgresPool()), TTL);
}
export async function loadJudiciaryStfPayrollRoster(filters: { role?: 'MINISTRO' | 'ASSESSOR_MINISTRO' } = {}) {
  return memo(`jud-stf-payroll-roster:${JSON.stringify(filters)}`, () => getJudiciaryStfPayrollExplorer(webPostgresPool(), filters), TTL);
}
export async function loadJudiciaryStfPayrollDetail(matricula: string) {
  return memo(`jud-stf-payroll:${matricula}`, () => getJudiciaryStfPayrollProfile(webPostgresPool(), matricula), TTL);
}
export async function loadJudiciaryStfGeneralJurisprudenceOverview() {
  return memo('jud-stf-juris-overview', () => getJudiciaryStfGeneralJurisprudenceOverview(webPostgresPool()), TTL);
}
export async function loadJudiciaryStfGeneralJurisprudenceRanking(base: 'acordao' | 'decisao' = 'acordao') {
  return memo(`jud-stf-juris-ranking:${base}`, () => getJudiciaryStfGeneralJurisprudenceRanking(webPostgresPool(), base), TTL);
}
export async function loadJudiciaryStfGeneralJurisprudenceExplorer(filters: JurisprudenciaFilters = {}) {
  return memo(`jud-stf-juris-explorer:${JSON.stringify(filters)}`, () => getJudiciaryStfGeneralJurisprudenceExplorer(webPostgresPool(), filters), TTL);
}
export async function loadJudiciaryStfGeneralJurisprudenceDoc(docId: string, base: 'acordao' | 'decisao' = 'acordao') {
  return memo(`jud-stf-juris-doc:${base}:${docId}`, () => getJudiciaryStfGeneralJurisprudenceProfile(webPostgresPool(), docId, base), TTL);
}
export async function loadJudiciaryFinancialProfile(tribunalId: string) {
  return memo(`jud-financial:${tribunalId}`, () => getJudiciaryFinancialProfile(webPostgresPool(), tribunalId), TTL);
}
export async function loadJudiciaryFinancialHistory(tribunalId: string, indicatorId: string) {
  return memo(`jud-financial-history:${tribunalId}:${indicatorId}`, () => getJudiciaryFinancialHistory(webPostgresPool(), tribunalId, indicatorId), TTL);
}
export async function loadJudiciaryPersonnelProfile(tribunalId: string) {
  return memo(`jud-personnel:${tribunalId}`, () => getJudiciaryPersonnelProfile(webPostgresPool(), tribunalId), TTL);
}
export async function loadJudiciaryTerritorialInstitutions(territory: { uf?: string; ibgeCode?: string }) {
  return memo(`jud-territorial:${JSON.stringify(territory)}`, () => getJudiciaryTerritorialInstitutions(webPostgresPool(), territory), TTL);
}
export async function loadJudiciaryMethodology(sourceId?: string) {
  return memo(`jud-methodology:${sourceId ?? 'all'}`, () => getJudiciarySourceMethodology(webPostgresPool(), sourceId), TTL);
}
