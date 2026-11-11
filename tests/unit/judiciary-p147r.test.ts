import test from 'node:test';
import assert from 'node:assert/strict';
import { openPool } from '../../scripts/exec/db.ts';
import { getJudiciaryThemesCatalog, getJudiciaryThemeHistoricalSeries } from '../../packages/db/src/postgres-judiciary-themes.ts';

test('P14.7-R separa execução fiscal, geral e penal no serving', async () => {
  const pool = openPool(2);
  try {
    const catalog = (await getJudiciaryThemesCatalog(pool)).data as any[];
    assert.equal(catalog.find((x) => x.themeId === 'TAX_EXECUTION')?.indicatorCount, 9);
    assert.equal(catalog.find((x) => x.themeId === 'GENERAL_EXECUTION')?.indicatorCount, 5);
    assert.equal(catalog.find((x) => x.themeId === 'CRIMINAL_EXECUTION')?.indicatorCount, 1);
    assert.equal(catalog.find((x) => x.themeId === 'SOCIAL_SECURITY')?.indicatorCount, 0);
  } finally { await pool.end(); }
});

test('P14.7-R preserva fatos P14.6 via factRevision e corrige feminicídio', async () => {
  const pool = openPool(2);
  try {
    const series = await getJudiciaryThemeHistoricalSeries(pool, 'DOMESTIC_VIOLENCE', 'P146_DOMESTIC_VIOLENCE_FEMINICIDE_SENTENCES');
    assert.equal(series.availability, 'AVAILABLE');
    assert.equal((series.provenance as any).revisionId, 'p147r-theme-metadata-20261105-v2');
    assert.equal((series.data as any).items.length, 1472);
  } finally { await pool.end(); }
});
