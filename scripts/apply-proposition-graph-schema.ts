import { PostgresCollectorStore } from '../apps/collector/src/postgres-collector.ts';
import { ensurePropositionGraphSchema } from '../packages/db/src/postgres-proposition-graph.ts';

/** Aplica (idempotente) o schema do grafo de proposições: tabelas de suporte, fila de resolução e índice pai → filhos. */
const store = new PostgresCollectorStore();
try { await store.assertTarget(); await ensurePropositionGraphSchema(store.pool); console.log(JSON.stringify({ ok: true })); }
finally { await store.pool.end(); }
