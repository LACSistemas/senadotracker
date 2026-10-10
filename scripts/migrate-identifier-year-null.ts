import { PostgresCollectorStore } from '../apps/collector/src/postgres-collector.ts';
import { migrateIdentifierYearZeroToNull } from '../packages/db/src/postgres-temporal.ts';

/** Migração idempotente: `civica_poc.proposals.year = 0` → NULL (identifierYear), coluna `presented_year` e guarda CHECK. */
const store = new PostgresCollectorStore();
try { await store.assertTarget(); console.log(JSON.stringify(await migrateIdentifierYearZeroToNull(store.pool))); }
finally { await store.pool.end(); }
