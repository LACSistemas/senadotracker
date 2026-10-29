import { cache } from 'react';
import {
  getWellbeingChapter, getWellbeingComparators, getWellbeingCoverage, getWellbeingFinanceContext, getWellbeingMethodology, getWellbeingOverview, getWellbeingSeries,
  type WellbeingChapter, type WellbeingTerritoryRef,
} from '@senadotracker/db';
import { webPostgresPool } from '@/lib/postgres-pool';

const pool = () => webPostgresPool();
export const loadWellbeingOverview = cache((territory: WellbeingTerritoryRef) => getWellbeingOverview(pool(), territory));
export const loadWellbeingChapter = cache((territory: WellbeingTerritoryRef, chapter: WellbeingChapter) => getWellbeingChapter(pool(), territory, chapter));
export const loadWellbeingSeries = cache((territory: WellbeingTerritoryRef, indicatorCode: string) => getWellbeingSeries(pool(), territory, indicatorCode));
export const loadWellbeingComparators = cache((territory: WellbeingTerritoryRef, indicatorCode: string) => getWellbeingComparators(pool(), territory, indicatorCode));
export const loadWellbeingCoverage = cache((indicatorCode?: string, entityId?: number) => getWellbeingCoverage(pool(), indicatorCode, entityId));
export const loadWellbeingMethodology = cache((indicatorCode: string) => getWellbeingMethodology(pool(), indicatorCode));
export const loadWellbeingFinance = cache((territory: WellbeingTerritoryRef, year?: number) => getWellbeingFinanceContext(pool(), territory, year));
