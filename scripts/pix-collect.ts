import { OfficialHttp } from '../apps/collector/src/http.ts';
import { PostgresCollectorStore } from '../apps/collector/src/postgres-collector.ts';
import { runPixCollection } from '../apps/collector/src/postgres-pix-run.ts';
import { runPixIdentity } from '../apps/collector/src/postgres-pix-identity.ts';
import { activeBudgetRun, crosswalkCoverage, ensureBudgetSchema } from '../packages/db/src/index.ts';

/**
 * Emendas Pix (Transferências Especiais).
 *   collect   Transferegov + Portal → civica_budget (carga atômica, reconciliação, publicação)
 *   identity  rosters históricos Câmara/Senado → pessoas/mandatos + crosswalk SIOP + identity_links candidatos
 *   report    cobertura/reconciliação da coleta ativa (somente leitura)
 */
const [command = 'report', ...rest] = process.argv.slice(2);
const flag = (name: string) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined; };
const progress = (m: string) => console.error(`[pix] ${m}`);
const store = new PostgresCollectorStore();
try {
  await store.assertTarget();
  if (command === 'collect') {
    const result = await runPixCollection(store, { runId: flag('--run'), dataDir: flag('--data-dir'), progress });
    console.log(JSON.stringify({ runId: result.runId, status: result.status, counts: result.counts, gates: Object.fromEntries(Object.entries(result.reconciliation.gates).map(([k, v]) => [k, v.status])), totals: result.reconciliation.totals }, null, 1));
  } else if (command === 'identity') {
    const mk = (source: 'camara' | 'senado') => {
      let runId = '';
      return store.startRun(source, `pg:pix-roster-fetch:${source}:${Date.now()}`).then(id => { runId = id; return new OfficialHttp({ source, save: raw => store.saveRaw(runId, raw), delayMs: 100, maxAttempts: 4 }); });
    };
    const result = await runPixIdentity(store, { camara: await mk('camara'), senado: await mk('senado'), progress });
    await store.query(`UPDATE civica.ingestion_runs SET status='published', finished_at=$1, roster_complete=1 WHERE id LIKE 'pg:pix-roster-fetch:%' AND status='running'`, [new Date().toISOString()]);
    console.log(JSON.stringify({ summary: result.summary, roster: result.roster, persisted: { people: result.persisted.people, created: result.persisted.created, reused: result.persisted.reused }, identityCandidates: result.identityCandidates, crosswalk: result.crosswalk }, null, 1));
  } else if (command === 'report') {
    await ensureBudgetSchema(store.pool);
    const run = await activeBudgetRun(store.pool);
    console.log(JSON.stringify({ activeRun: run?.run_id ?? null, crosswalk: await crosswalkCoverage(store.pool) }, null, 1));
  } else throw new Error(`Comando desconhecido: ${command}`);
} finally { await store.pool.end(); }
