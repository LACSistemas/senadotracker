import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('post-cutover semantic invariants are recorded against the intended database', () => {
  const file = 'artifacts/post-cutover-semantic-recovery.json';
  assert.equal(fs.existsSync(file), true, `run scripts/post-cutover-semantic-audit.ts before this test`);
  const audit = JSON.parse(fs.readFileSync(file, 'utf8')) as { database: string; runtimeSqliteZero: string; invariants: Array<{ pass: boolean }> };
  assert.equal(audit.database, 'projetoeleitor_db');
  assert.equal(audit.runtimeSqliteZero, 'PASS');
  assert.equal(audit.invariants.every(item => item.pass), true);
});
