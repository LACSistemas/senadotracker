import { cache } from 'react';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  getCoverage, getFacilities, getHospitalActivity, getPanelValues, getVaccinePanel, readHealthBenchmarks, getIndicatorSeries, getLatestIndicators, getMapValues, getMunicipality, getResidentFlow,
  getState, listHospitals, listMunicipalities, listStates, readUfHealthStory, resolveMunicipalityId, searchMunicipalities,
} from '@senadotracker/db';
import { webPostgresPool } from '@/lib/postgres-pool';
import { VACCINE_SLUGS } from '@/lib/health-targets';

/** Camada de leitura das páginas territoriais: delega às consultas de civica_exec e memoiza por requisição. */
const pool = () => webPostgresPool();

export const UF_CODES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'] as const;
export const isUf = (value: string): boolean => (UF_CODES as readonly string[]).includes(value.toUpperCase());

export const loadStates = cache(() => listStates(pool()));
export const loadState = cache((uf: string) => getState(pool(), uf));
export const loadMunicipalities = cache((ufCode: number) => listMunicipalities(pool(), ufCode));
export const loadMunicipality = cache(async (code: string) => { const id = await resolveMunicipalityId(pool(), code); return id ? getMunicipality(pool(), id) : null; });
export const loadIndicators = cache((entityId: number) => getLatestIndicators(pool(), entityId, 1));
export const loadSeries = cache((entityId: number, code: string) => getIndicatorSeries(pool(), entityId, code));
export const loadMapValues = cache((ufCode: number, code: string) => getMapValues(pool(), ufCode, code));
export const loadCoverage = cache((ufCode: number) => getCoverage(pool(), ufCode));
export const loadFacilities = cache((o: { municipalityId?: number; ufCode?: number }) => getFacilities(pool(), o));
export const loadUfStory = cache((ufCode: number) => readUfHealthStory(pool(), ufCode));
export const loadPanelValues = cache((entityId: number) => getPanelValues(pool(), entityId));
export const loadVaccinePanel = cache((entityId: number) => getVaccinePanel(pool(), entityId, VACCINE_SLUGS));
export const loadBenchmarks = cache(() => readHealthBenchmarks(pool()));
export const loadHospitals = cache((id: number) => listHospitals(pool(), id));
export const loadHospitalActivity = cache((id: number) => getHospitalActivity(pool(), id));
export const loadResidentFlow = cache((id: number) => getResidentFlow(pool(), id));
export const findMunicipalities = (term: string, ufCode?: number, limit = 24) => searchMunicipalities(pool(), { term, ...(ufCode ? { ufCode } : {}), limit });

export interface UfGeometry { uf: string; viewBox: string; source: string; items: Array<{ id: number; d: string }> }
export const loadGeometry = cache(async (uf: string): Promise<UfGeometry | null> => {
  if (!isUf(uf)) return null;
  try { return JSON.parse(await readFile(path.join(process.cwd(), 'public', 'geo', 'uf', `${uf.toUpperCase()}.json`), 'utf8')) as UfGeometry; }
  catch { return null; }
});

/** Competência yyyymm → "mês/ano" legível. */
export const competenceLabel = (periodStart: string): string => {
  const [y, m] = periodStart.split('-');
  const names = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${names[Number(m) - 1]}/${y}`;
};
export const ymLabel = (c: number): string => competenceLabel(`${Math.floor(c / 100)}-${String(c % 100).padStart(2, '0')}-01`);
