import { performance } from 'node:perf_hooks';
import { writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { openDatabase } from '../packages/db/src/index.ts';
import { publishedCommissionDirectory, publishedCommissionOverview } from '../packages/db/src/commissions.ts';
const db = openDatabase('data/senadotracker.sqlite', true);
const measurements: { label: string; ms: number }[] = [];
function measure<T>(label: string, fn: () => T): T {
  const t = performance.now(), value = fn();
  measurements.push({ label, ms: Math.round(performance.now() - t) });
  return value;
}
try {
  const directory = measure('directory cold process', () => publishedCommissionDirectory(db));
  measure('directory warm uncached', () => publishedCommissionDirectory(db));
  for (const house of ['CAMARA', 'SENADO'] as const) measure(house, () => publishedCommissionDirectory(db, { house }));
  const cases = ['CMA', 'CAE', 'CCJ', 'CCJC', 'CAPADR', 'CFT'].map(query => {
    const result = measure(query, () => publishedCommissionDirectory(db, { query }));
    assert.equal(result.items[0]?.body.sigla, query);
    assert.deepEqual(result.counts, directory.counts);
    return result.items[0];
  });
  const overview = measure('overview', () => publishedCommissionOverview(db));
  const data = { measuredAt: new Date().toISOString(), counts: directory.counts, measurements, cases, overview };
  mkdirSync('artifacts/comissoes-v3', { recursive: true });
  writeFileSync('artifacts/comissoes-v3/database-validation.json', JSON.stringify(data, null, 2));
  console.log(JSON.stringify(data, null, 2));
} finally { db.close(); }
