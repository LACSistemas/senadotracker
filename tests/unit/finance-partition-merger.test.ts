import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCandidateCurrentCorpus } from '../../apps/collector/src/core/finance-partition-merger.ts';

test('carry-forward merger replaces only observed partitions', () => {
  const rows = buildCandidateCurrentCorpus({
    previousActive: [
      { partitionKey: '2026-01', naturalKey: 'old-jan' },
      { partitionKey: '2026-09', naturalKey: 'old-sep' },
    ],
    observedPartitions: new Map([
      ['2026-10', [{ partitionKey: '2026-10', naturalKey: 'new-oct' }]],
      ['2026-09', [{ partitionKey: '2026-09', naturalKey: 'new-sep' }]],
    ]),
    removalSemantics: 'carry-forward-unobserved-partitions',
  });
  assert.deepEqual(rows.map(row => row.naturalKey), ['old-jan', 'new-oct', 'new-sep']);
});

test('merger rejects empty partition and duplicate row keys', () => {
  assert.throws(() => buildCandidateCurrentCorpus({
    previousActive: [], observedPartitions: new Map([['', [{ partitionKey: '', naturalKey: 'x' }]]]),
    removalSemantics: 'carry-forward-unobserved-partitions',
  }), /partition key/);
  assert.throws(() => buildCandidateCurrentCorpus({
    previousActive: [], observedPartitions: new Map([['p', [
      { partitionKey: 'p', naturalKey: 'x' }, { partitionKey: 'p', naturalKey: 'x' },
    ]]]), removalSemantics: 'carry-forward-unobserved-partitions',
  }), /duplicate natural key/);
});
