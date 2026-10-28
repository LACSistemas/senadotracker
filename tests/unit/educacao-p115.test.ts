import test from 'node:test';
import assert from 'node:assert/strict';
import { EXEC_DDL_V25 } from '../../packages/db/src/exec/ddl-v25.ts';
import { getGraduateProgramOverview, getGraduateTerritorySummary } from '../../packages/db/src/exec/educacao-capes-read.ts';

test('P11.5 schema is additive and privacy-safe', () => {
  assert.match(EXEC_DDL_V25, /exec_capes_ppg/);
  assert.match(EXEC_DDL_V25, /exec_capes_student_aggregate/);
  assert.match(EXEC_DDL_V25, /exec_capes_faculty_aggregate/);
  assert.doesNotMatch(EXEC_DDL_V25, /NR_DOCUMENTO|NM_DISCENTE|NM_DOCENTE/);
});

test('P11.5 read contracts expose explicit availability semantics', async () => {
  const fake = { query: async () => ({ rows: [] }) } as any;
  const overview = await getGraduateProgramOverview(fake, 2024, 'SP');
  const territory = await getGraduateTerritorySummary(fake, 2024, 'SP');
  assert.equal(overview.available, false);
  assert.equal(territory.program.available, false);
});
