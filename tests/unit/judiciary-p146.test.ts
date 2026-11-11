import test from 'node:test';
import assert from 'node:assert/strict';
import { openPool } from '../../scripts/exec/db.ts';
import { getJudiciaryThemesCatalog, getJudiciaryThemeOverview, getJudiciaryThemeIndicators, getJudiciaryThemeComparators, getJudiciaryStjPrecedentsByTheme } from '../../packages/db/src/postgres-judiciary-themes.ts';

test('P14.6 catálogo e fatos temáticos possuem proveniência', async () => {
  const pool = openPool(2);
  try {
    const result = await getJudiciaryThemesCatalog(pool);
    assert.equal(result.availability, 'AVAILABLE');
    assert.ok((result.data as any[]).some((x) => x.themeId === 'TAX_EXECUTION'));
  } finally { await pool.end(); }
});

test('P14.6 overview não soma taxas temáticas', async () => {
  const pool = openPool(2);
  try {
    const result = await getJudiciaryThemeOverview(pool, 'TAX_EXECUTION', { year: 2025 });
    const metrics = (result.data as any).metrics as any[];
    assert.ok(metrics.length > 0);
    const rates = metrics.filter((x) => x.unit === 'proportion' || x.unit === 'ratio');
    assert.ok(rates.every((x) => x.value === null || x.metric_availability === 'METHOD_INCOMPATIBLE'));
  } finally { await pool.end(); }
});

test('P14.6 indicadores e comparadores usam paginação server-side', async () => {
  const pool = openPool(2);
  try {
    const page = await getJudiciaryThemeIndicators(pool, 'DOMESTIC_VIOLENCE', { page: 1, pageSize: 2 });
    assert.equal((page.data as any).pageSize, 2);
    const indicatorId = (page.data as any).items[0].indicator_id;
    const comparison = await getJudiciaryThemeComparators(pool, 'DOMESTIC_VIOLENCE', indicatorId, 2025);
    assert.ok(['AVAILABLE', 'NOT_REPORTED'].includes(comparison.availability));
  } finally { await pool.end(); }
});

test('P14.6 STJ permanece parcial e não inventa taxonomia', async () => {
  const pool = openPool(2);
  try {
    const result = await getJudiciaryStjPrecedentsByTheme(pool, 'STJ_PRECEDENTS', { page: 1, pageSize: 1 });
    assert.equal(result.availability, 'PARTIAL_COVERAGE');
    const unavailable = await getJudiciaryStjPrecedentsByTheme(pool, 'HEALTH', { page: 1, pageSize: 1 });
    assert.equal(unavailable.availability, 'NOT_REPORTED');
  } finally { await pool.end(); }
});
