import { openPool } from './db.ts';
import { getWellbeingChapter, getWellbeingComparators, getWellbeingCoverage, getWellbeingFinanceContext, getWellbeingMethodology, getWellbeingOverview, getWellbeingSeries } from '../../packages/db/src/exec/wellbeing-read.ts';

const p = openPool(8);
const cases = [
  ['Vitória/ES', { ibge7: 3205309 }], ['São Paulo/SP', { ibge7: 3550308 }], ['Alto Rio Novo/ES', { ibge7: 3200359 }],
  ['Boa Esperança do Norte/MT', { ibge7: 5101837 }], ['Brasília/DF', { ibge7: 5300108 }], ['Espírito Santo', { ufCode: 32 }], ['São Paulo/UF', { ufCode: 35 }], ['Brasil', {}],
];
const result: any = { database: (await p.query('select current_database()')).rows[0].current_database, cases: {}, checks: {} };
for (const [label, ref] of cases) {
  const o = await getWellbeingOverview(p, ref as any); result.cases[label] = { overview: !!o, observations: o?.observations.length ?? 0, chapters: Object.fromEntries(Object.entries(o?.chapters ?? {}).map(([k,v]) => [k,(v as any[]).length]),), financeRows: o?.finance?.rows.length ?? 0 };
}
const v = await getWellbeingOverview(p, { ibge7: 3205309 });
result.checks.chapter = (await getWellbeingChapter(p, { ibge7: 3205309 }, 'work'))?.observations.length ?? 0;
result.checks.series = (await getWellbeingSeries(p, { ibge7: 3205309 }, 'WB-LABOR-CAGED-BAL'))?.length ?? 0;
result.checks.comparators = await getWellbeingComparators(p, { ibge7: 3205309 }, 'WB-MUNIC-DIGITAL-SERVICE');
result.checks.giniComparator = await getWellbeingComparators(p, { ibge7: 3205309 }, 'WB-INC-GINI');
result.checks.coverage = (await getWellbeingCoverage(p)).length;
result.checks.methodology = await getWellbeingMethodology(p, 'WB-MUNIC-WIFI-WHOLE-MUNICIPALITY');
result.checks.finance = await getWellbeingFinanceContext(p, { ibge7: 3205309 }, 2024);
result.checks.observationContract = Object.keys(v?.observations[0] ?? {});
console.log(JSON.stringify(result, null, 2));
await p.end();
