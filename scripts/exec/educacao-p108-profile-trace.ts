import { performance } from 'node:perf_hooks';
import { openPool } from './db.ts';
import { getEducationNationalProfile, getEducationNationalOffer, getEducationNationalInfra, getEducationTerritoryIndicators, getEducationTeachers, getIdebTerritory, getSaebTerritory, getFlowTerritory, getTransitionTerritory, getInseTerritory, getEducationContractSummary, getEducationProgramSummary } from '../../packages/db/src/exec/index.ts';

const p = openPool(8);
try {
  const jobs: Record<string, () => Promise<unknown>> = {
    offer: () => getEducationNationalOffer(p, { year: 2025, series: false }),
    infra: () => getEducationNationalInfra(p, { year: 2025, series: false }),
    indicators: () => getEducationTerritoryIndicators(p, { year: 2025, series: false }),
    teachers: () => getEducationTeachers(p, { year: 2025 }),
    ideb: () => getIdebTerritory(p, {}), saeb: () => getSaebTerritory(p, {}), flow: () => getFlowTerritory(p, { year: 2025 }), transition: () => getTransitionTerritory(p, {}), inse: () => getInseTerritory(p, {}),
    contracts: () => getEducationContractSummary(p, { year: 2025 }), programs: () => getEducationProgramSummary(p, 2025),
  };
  if (process.argv.includes('--sp')) jobs.municipality_sp = () => import('../../packages/db/src/exec/index.ts').then(m => m.getEducationMunicipalityProfile(p, '3550308', { year: 2025, includeSeries: false }));
  const out: Record<string, unknown> = {};
  for (const [name, job] of Object.entries(jobs)) { const t = performance.now(); try { await job(); out[name] = Math.round((performance.now() - t) * 10) / 10; } catch (e) { out[name] = String(e); } }
  const t = performance.now(); const x = await getEducationNationalProfile(p, { year: 2025, includeSeries: false }); out.profile = { ms: Math.round((performance.now() - t) * 10) / 10, ok: x != null }; console.log(JSON.stringify(out, null, 2));
} finally { await p.end(); }
