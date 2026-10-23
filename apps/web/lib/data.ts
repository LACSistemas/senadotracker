import type { Source } from '@senadotracker/domain';
import * as pgData from './data-postgres.ts';
import type * as Legacy from '../../../packages/db/src/web-legacy-contract.ts';

export type DataResult<T> = { status: 'available'; data: T } | { status: 'unavailable'; message: string };
export type DataProfileSection = 'overview' | 'costs' | 'activity' | 'career' | 'all';
export type LegislativeOverviewSort = 'uf_asc' | 'uf_desc' | 'party_asc' | 'party_desc' | 'cost_asc' | 'cost_desc' | 'presence_asc' | 'presence_desc';
export type HouseSort = 'name' | 'expense_desc' | 'expense_asc';
export type PartyHouse = 'all' | 'senado' | 'camara';
export type ComparisonDimension = string;

type Contract<K extends string> = K extends keyof typeof Legacy ? typeof Legacy[K] extends (...args: any[]) => infer R ? R : any : any;
type CompatResult<T = any> = { status: 'available'; data: T } | { status: 'unavailable'; message: string };
type ComparisonSetupCompat = { options: any[]; years: number[] };
type ComparisonCompat = { source: any; year: number; people: any[]; expenses: any[]; rows: any[]; coverage: any; fidelity: any[]; costs: any[]; cabinet: any[]; agreements: any[]; benchmarks: any; [key: string]: any };
type ProfileResult = Contract<'profile'>;
// In-memory TTL cache shared by every data-fetcher below.  The published data
// only changes when a new batch lands, not on every page view, so there is no
// need to recompute these (expensive, multi-query) reads on each request.
// Caches the in-flight promise (not just the resolved value) so concurrent
// requests for the same key dedupe instead of each triggering their own query.
const DATA_CACHE_TTL_MS = Number(process.env.DATA_CACHE_TTL_MS ?? 120_000);
const dataCache = new Map<string, { expires: number; value: Promise<any> }>();
const call = <K extends string>(name: K, ...args: any[]): Promise<Contract<K>> => {
  const key = `${name}:${JSON.stringify(args)}`;
  const now = Date.now();
  const hit = dataCache.get(key);
  if (hit && hit.expires > now) return hit.value as Promise<Contract<K>>;
  const value = Promise.resolve((pgData as any)[name](...args)).catch((err) => { dataCache.delete(key); throw err; });
  if (dataCache.size >= 500) dataCache.delete(dataCache.keys().next().value!);
  dataCache.set(key, { expires: now + DATA_CACHE_TTL_MS, value });
  return value as Promise<Contract<K>>;
};

export const cabinetCompetenceBenchmark = (...args: any[]): Promise<any> => call('cabinetCompetenceBenchmark', ...args) as Promise<any>;
export const commissionAgenda = (...args: any[]): Promise<Contract<'commissionAgenda'>> => call('commissionAgenda', ...args);
export const commissionDetail = (...args: any[]): Promise<Contract<'commissionDetail'>> => call('commissionDetail', ...args);
export const commissionDirectory = (...args: any[]): Promise<Contract<'commissionDirectory'>> => call('commissionDirectory', ...args);
export const commissionOverview = (...args: any[]): Promise<Contract<'commissionOverview'>> => call('commissionOverview', ...args);
export const comparison = (source: any, year: number, filters: any = {}): Promise<Contract<'comparison'>> => call('expenseComparison', source, year, filters);
export const comparisonDashboard = (...args: any[]): Promise<CompatResult<ComparisonCompat>> => call('comparisonDashboard', ...args) as Promise<CompatResult<ComparisonCompat>>;
export const comparisonYears = (source: any): Promise<Contract<'comparisonYears'>> => call('expenseYears', source);
export const congressSupplierCategoryMix = (...args: any[]): Promise<Contract<'congressSupplierCategoryMix'>> => call('congressSupplierCategoryMix', ...args);
export const congressSupplierOverview = (...args: any[]): Promise<Contract<'congressSupplierOverview'>> => call('congressSupplierOverview', ...args);
export const expenseDetail = (...args: any[]): Promise<Contract<'expenseDetail'>> => call('expenseDetail', ...args);
export const homeHighlights = (...args: any[]): Promise<Contract<'homeHighlights'>> => call('homeHighlights', ...args);
export const homeOverview = (...args: any[]): Promise<Contract<'homeOverview'>> => call('homeOverview', ...args);
export const houseListing = (...args: any[]): Promise<Contract<'houseListing'>> => call('houseListing', ...args);
export const houseMetricSummary = (...args: any[]): Promise<Contract<'houseMetricSummary'>> => call('houseMetricSummary', ...args);
export const legislativeOverview = (...args: any[]): Promise<Contract<'legislativeOverview'>> => call('legislativeOverview', ...args);
export const parliamentarianSupplierNetwork = (...args: any[]): Promise<Contract<'parliamentarianSupplierNetwork'>> => call('parliamentarianSupplierNetwork', ...args);
export const parliamentarianPix = (source: 'camara' | 'senado', externalId: string): Promise<import('./pix-profile-model.ts').PixProfileData> => call('parliamentarianPix', source, externalId) as Promise<import('./pix-profile-model.ts').PixProfileData>;
export const parties = (house: any, requestedYear: number | null, search?: string): Promise<Contract<'parties'>> => call('parties', house, requestedYear, search) as unknown as Promise<Contract<'parties'>>;
export const partyComparison = (...args: any[]): Promise<CompatResult<ComparisonCompat>> => call('partyComparison', ...args) as unknown as Promise<CompatResult<ComparisonCompat>>;
export const partyDetail = (...args: any[]): Promise<Contract<'partyDetail'>> => call('partyDetail', ...args);
export const partyLanding = (...args: any[]): Promise<Contract<'partyLanding'>> => call('partyLanding', ...args);
export const patrimonyRanking = (...args: any[]): Promise<Contract<'patrimonyRanking'>> => call('patrimonyRanking', ...args);
export const personComparison = (source: any, year: number, ids: string[], dimension: any): Promise<CompatResult<ComparisonCompat>> => call('comparisonDashboard', source, year, ids, dimension) as unknown as Promise<CompatResult<ComparisonCompat>>;
export const personComparisonSetup = (...args: any[]): Promise<CompatResult<ComparisonSetupCompat>> => call('personComparisonSetup', ...args) as Promise<CompatResult<ComparisonSetupCompat>>;
export async function profile(source: any, externalId: string, _section?: DataProfileSection, _votePage?: number): Promise<ProfileResult> {
  // Profile reads are among the heaviest single-page contracts (especially
  // activity, which spans several published years). Keep them behind the
  // same in-flight/TTL cache used by the other read contracts so a layout,
  // metadata loader and page body cannot issue the same fan-out concurrently.
  return await call('profileFull', source, externalId, _section ?? 'overview', _votePage ?? 1) as ProfileResult;
}
export const profileIdentity = (source: Source, externalId: string): Promise<Contract<'profileIdentity'>> => call('profile', source, externalId) as Promise<Contract<'profileIdentity'>>;
export const propositionDetail = (...args: any[]): Promise<Contract<'propositionDetail'>> => call('propositionDetail', ...args);
export const propositionListing = (...args: any[]): Promise<Contract<'propositionListing'>> => call('propositionListing', ...args);
export const propositionObservedState = (...args: any[]): Promise<Contract<'propositionObservedState'>> => call('propositionObservedState', ...args);
// The operational bundle is a discriminated public result.  Keep the facade
// type explicit because the legacy compose implementation is optional in
// standalone tooling and otherwise TypeScript infers `void` from that module.
export const propositionOperationalBundle = (...args: any[]): Promise<CompatResult<any>> => call('propositionOperationalBundle', ...args) as Promise<CompatResult<any>>;
export const propositionResultComposition = (...args: any[]): Promise<Contract<'propositionResultComposition'>> => call('propositionResultComposition', ...args);
export const rankings = (...args: any[]): Promise<Contract<'rankings'>> => call('rankings', ...args);
export const rankingsDashboard = (...args: any[]): Promise<Contract<'rankingsDashboard'>> => call('rankingsDashboard', ...args);
export const roster = (...args: any[]): Promise<Contract<'roster'>> => call('roster', ...args);
export const stateRepresentation = (...args: any[]): Promise<Contract<'stateRepresentation'>> => call('stateRepresentation', ...args);
export const statesComparison = (...args: any[]): Promise<CompatResult<ComparisonCompat>> => call('statesComparison', ...args) as unknown as Promise<CompatResult<ComparisonCompat>>;
export const supplierDetail = (...args: any[]): Promise<Contract<'supplierDetail'>> => call('supplierDetail', ...args);
export const supplierExplorer = (...args: any[]): Promise<Contract<'supplierExplorer'>> => call('supplierExplorer', ...args);
export const supplierExplorerFacets = (...args: any[]): Promise<Contract<'supplierExplorerFacets'>> => call('supplierExplorerFacets', ...args);
export const supplierGlobalDetail = (...args: any[]): Promise<Contract<'supplierGlobalDetail'>> => call('supplierGlobalDetail', ...args);
export const supplierGlobalStory = (...args: any[]): Promise<Contract<'supplierGlobalStory'>> => call('supplierGlobalStory', ...args);
export const supplierMarket = (...args: any[]): Promise<Contract<'supplierMarket'>> => call('supplierMarket', ...args);
export const supplierNetwork = (...args: any[]): Promise<Contract<'supplierNetwork'>> => call('supplierNetwork', ...args);
export const supplierRadar = (...args: any[]): Promise<Contract<'supplierRadar'>> => call('supplierRadar', ...args);
export const voteAxis = (...args: any[]): Promise<CompatResult<any>> => call('voteAxis', ...args) as Promise<CompatResult<any>>;





