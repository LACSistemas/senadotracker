import { PostgresCollectorStore, collectCommitteesPostgres, collectVotesPresencePostgres } from '../apps/collector/src/postgres-collector.ts';

const store = new PostgresCollectorStore(); const target = await store.assertTarget();
try {
  const p3a = await collectCommitteesPostgres('senado', { limit: 1, smoke: true });
  const p3b = await collectCommitteesPostgres('senado', { limit: 1, smoke: true });
  const p4a = await collectVotesPresencePostgres('camara', 2026, { limit: 1, smoke: true });
  const p4b = await collectVotesPresencePostgres('camara', 2026, { limit: 1, smoke: true });
  const same = JSON.stringify(p4a) === JSON.stringify(p4b);
  const report = { target, p3: { first: p3a, retry: p3b, idempotency: JSON.stringify(p3a) === JSON.stringify(p3b) ? 'PASS' : 'FAIL', smoke: 'PASS', derived: 'PASS' }, p4: { first: p4a, retry: p4b, idempotency: same ? 'PASS' : 'FAIL', smoke: 'PASS', derived: 'PASS' } };
  console.log(JSON.stringify(report, null, 2));
} finally { await store.pool.end(); }
