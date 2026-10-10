import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileCandidate, semanticRevisionId } from '../../apps/collector/src/core/publication-lifecycle.ts';
import { reconcilePersonnelSnapshot } from '../../apps/collector/src/state/personnel-publication.ts';
import { reconcileTimelineWindow } from '../../apps/collector/src/state/timeline-publication.ts';

const semantic = (row: { id: string; value: number }) => row;

test('P25.2U lifecycle rejects empty and shrinking candidates', () => {
  const active = { revisionId: 'state:x:finance:old', rowCount: 2, sourceHash: null };
  const empty = reconcileCandidate({ rows: [], sourceRows: 0, scope: 'state:X:finance', sourceHash: 'empty' }, active, semantic);
  const shrink = reconcileCandidate({ rows: [{ id: 'a', value: 1 }], sourceRows: 1, scope: 'state:X:finance', sourceHash: 'small' }, active, semantic);
  assert.equal(empty.status, 'FAILED_SAFE');
  assert.equal(empty.reason, 'EMPTY_CANDIDATE');
  assert.equal(shrink.status, 'FAILED_SAFE');
  assert.equal(shrink.reason, 'CANDIDATE_SHRINK');
});

test('P25.2U lifecycle is deterministic and produces NO_CHANGE on replay', () => {
  const rows = [{ id: 'a', value: 1 }, { id: 'b', value: 2 }];
  const revision = semanticRevisionId('state:X:finance', rows, semantic);
  const first = reconcileCandidate({ rows, sourceRows: 2, scope: 'state:X:finance', sourceHash: 'source' }, { revisionId: null, rowCount: 0 }, semantic);
  const replay = reconcileCandidate({ rows: [...rows].reverse(), sourceRows: 2, scope: 'state:X:finance', sourceHash: 'different-fetch-order' }, { revisionId: revision, rowCount: 2 }, semantic);
  assert.equal(first.status, 'PUBLISH');
  assert.equal(first.revisionId, revision);
  assert.equal(replay.status, 'NO_CHANGE');
  assert.equal(replay.reconciliation.unchanged, true);
});

test('P25.2U lifecycle rejects duplicate natural keys', () => {
  const result = reconcileCandidate({ rows: [{ id: 'a', value: 1 }, { id: 'a', value: 1 }], sourceRows: 2, scope: 'state:X:finance', sourceHash: 'dup' }, { revisionId: null, rowCount: 0 }, semantic);
  assert.equal(result.status, 'FAILED_SAFE');
  assert.equal(result.reason, 'DUPLICATE_NATURAL_KEYS');
});

test('P19 and P22 keep their own canonical grains while sharing safety gates', () => {
  const personnel = reconcilePersonnelSnapshot([{ personExternalId: 'p1', officeExternalId: 'o1', role: 'assessor', assignmentKey: 'p1|o1|2026', observedAt: '2026-01-01', rawId: 'raw-p1' }], 1, 'personnel-source', { revisionId: null, rowCount: 0 });
  const timeline = reconcileTimelineWindow([{ proposalExternalId: 'prop-1', sourceEventKey: 'event-1', eventOrder: 1, occurredAt: '2026-01-01', eventType: 'protocol', description: 'Entrada', rawId: 'raw-event' }], 1, 'timeline-source', { revisionId: null, rowCount: 0 }, 'state:AC:timeline');
  assert.equal(personnel.status, 'PUBLISH');
  assert.equal(timeline.status, 'PUBLISH');
  assert.notEqual(personnel.revisionId, timeline.revisionId);
});
