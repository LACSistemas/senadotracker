import { performance } from 'node:perf_hooks';
import { openPool } from '../../../../scripts/exec/db.ts';
import { getEducationFinanceSummary, getSiopeEducationSummary, getEducationFinanceCoverage } from '../../../../packages/db/src/exec/index.ts';
const p = openPool(2); const out: Record<string, unknown> = { database: (await p.query('select current_database() db')).rows[0].db, measuredAt: new Date().toISOString(), calls: [] };
for (const [name, fn] of [['siconfi_summary', () => getEducationFinanceSummary(p, 2024, 32)], ['siope_summary', () => getSiopeEducationSummary(p, 2024, 32)], ['coverage', () => getEducationFinanceCoverage(p, 2024, 32)]] as const) { const t = performance.now(); await fn(); (out.calls as unknown[]).push({ name, ms: performance.now() - t }); }
console.log(JSON.stringify(out, null, 2)); await p.end();
