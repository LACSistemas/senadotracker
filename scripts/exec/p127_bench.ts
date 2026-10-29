import { performance } from 'node:perf_hooks';
import { gzipSync } from 'node:zlib';
import { openPool } from './db.ts';
import { getWellbeingChapter, getWellbeingComparators, getWellbeingCoverage, getWellbeingFinanceContext, getWellbeingMethodology, getWellbeingOverview, getWellbeingSeries } from '../../packages/db/src/exec/wellbeing-read.ts';

const p = openPool(12);
const cases = [
  ['municipality_vitoria', { ibge7: 3205309 }], ['municipality_sao_paulo', { ibge7: 3550308 }], ['municipality_alto_rio_novo', { ibge7: 3200359 }],
  ['municipality_boa_esperanca_norte', { ibge7: 5101837 }], ['municipality_brasilia', { ibge7: 5300108 }], ['uf_es', { ufCode: 32 }], ['uf_sp', { ufCode: 35 }], ['brazil', {}],
];
const quantile = (xs: number[], q: number) => xs[Math.min(xs.length - 1, Math.floor((xs.length - 1) * q))] ?? null;
async function measure(name: string, fn: () => Promise<unknown>, reps = 12) {
  const ms: number[] = []; let sample: unknown;
  for (let i = 0; i < reps; i++) { const t = performance.now(); sample = await fn(); ms.push(performance.now() - t); }
  ms.sort((a, b) => a - b); const payload = Buffer.from(JSON.stringify(sample ?? null));
  return { name, repetitions: reps, p50Ms: Number(quantile(ms, .5).toFixed(3)), p95Ms: Number(quantile(ms, .95).toFixed(3)), p99Ms: Number(quantile(ms, .99).toFixed(3)), maxMs: Number(ms.at(-1)!.toFixed(3)), payloadBytes: payload.byteLength, gzipBytes: gzipSync(payload).byteLength };
}
const out: any = { phase: 'P12.7', database: (await p.query('select current_database()')).rows[0].current_database, repetitions: 12, benchmarks: [] };
for (const [name, ref] of cases) {
  out.benchmarks.push(await measure(`${name}.overview`, () => getWellbeingOverview(p, ref as any)));
  out.benchmarks.push(await measure(`${name}.conditionsChapter`, () => getWellbeingChapter(p, ref as any, 'conditions')));
}
out.benchmarks.push(await measure('vitoria.series_caged_balance', () => getWellbeingSeries(p, { ibge7: 3205309 }, 'WB-LABOR-CAGED-BAL')));
out.benchmarks.push(await measure('vitoria.comparators_munic', () => getWellbeingComparators(p, { ibge7: 3205309 }, 'WB-MUNIC-DIGITAL-SERVICE')));
out.benchmarks.push(await measure('vitoria.comparators_gini_rejected', () => getWellbeingComparators(p, { ibge7: 3205309 }, 'WB-INC-GINI')));
out.benchmarks.push(await measure('coverage_all', () => getWellbeingCoverage(p), 12));
out.benchmarks.push(await measure('methodology_munic', () => getWellbeingMethodology(p, 'WB-MUNIC-WIFI-WHOLE-MUNICIPALITY')));
out.benchmarks.push(await measure('finance_context_vitoria', () => getWellbeingFinanceContext(p, { ibge7: 3205309 }, 2024)));
out.finishedAt = new Date().toISOString(); console.log(JSON.stringify(out, null, 2)); await p.end();
