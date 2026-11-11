import test from 'node:test';
import assert from 'node:assert/strict';
import { getCourseQualitySeries, searchQuality } from '../../packages/db/src/exec/educacao-quality-read.ts';

test('P11.3 curso preserva série e nulos sem converter em zero', async () => {
  let captured: { sql: string; args: unknown[] } | undefined;
  const q = { query: async (sql: string, args: unknown[]) => {
    captured = { sql, args };
    return { rows: [{ indicator: 'CPC', reference_year: 2023, continuous_value: null, band: null, area_code: '12', area_name: 'Computação', source_run_id: 7, crosswalk_status: 'UNRESOLVED' }] };
  } };
  const rows = await getCourseQualitySeries(q, 123, 'CPC');
  assert.equal(rows[0].continuousValue, null);
  assert.equal(rows[0].band, null);
  assert.deepEqual(captured?.args, [123, 'CPC']);
});

test('P11.3 busca limita paginação a 100', async () => {
  let captured: { args: unknown[] } | undefined;
  const q = { query: async (_sql: string, args: unknown[]) => {
    captured = { args };
    return { rows: [] };
  } };
  await searchQuality(q, { text: 'engenharia', page: 2, pageSize: 500 });
  assert.deepEqual(captured?.args, ['%engenharia%', 100, 100]);
});
