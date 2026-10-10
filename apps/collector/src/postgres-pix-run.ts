import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ensureBudgetSchema, finishBudgetRun, loadBudgetRun, reconcileBudget, startBudgetRun, type BudgetReconciliation } from '@senadotracker/db';
import { PostgresCollectorStore } from './postgres-collector.ts';
import { downloadTransferegov, httpTransferegovApi, readTransferegovTables, type TransferegovApi, type TransferegovManifest } from './postgres-pix-transferegov.ts';
import { downloadPortalZip, parsePortalZip } from './postgres-pix-portal.ts';

export interface PixRunOptions {
  dataDir?: string | undefined; runId?: string | undefined; api?: TransferegovApi | undefined; portalBytes?: Uint8Array | undefined; portalFetch?: typeof fetch | undefined; progress?: ((message: string) => void) | undefined;
  /** Só os gates que derrubam a publicação; `CROSSWALK_COVERAGE` e `REFERENTIAL_INTEGRITY` informam, não bloqueiam. */
  blockingGates?: string[] | undefined;
}
export interface PixRunResult { runId: string; status: 'published' | 'failed'; reconciliation: BudgetReconciliation; counts: Record<string, number>; manifest: TransferegovManifest; portal: Record<string, unknown> }

/** Coleta completa: Transferegov (corpus inteiro) + Portal (UNICO) → carga atômica → reconciliação → publicação. Reexecutável. */
export async function runPixCollection(store: PostgresCollectorStore, options: PixRunOptions = {}): Promise<PixRunResult> {
  const progress = options.progress ?? (() => {});
  const runId = options.runId ?? `pix:${new Date().toISOString().slice(0, 10)}`;
  const dir = resolve(options.dataDir ?? process.env.SENADOTRACKER_DATA_DIR ?? 'data', 'pix', runId.replace(/[^\w.-]+/g, '_'));
  await mkdir(dir, { recursive: true });
  await ensureBudgetSchema(store.pool);
  await startBudgetRun(store.pool, runId, {});
  try {
    const manifest = await downloadTransferegov(options.api ?? httpTransferegovApi(), { dir, runId, progress });
    const portalFile = resolve(dir, 'portal.zip'); let portalBytes = options.portalBytes; let portalFetchedAt: string | null = null, portalLastModified: string | null = null;
    if (!portalBytes && existsSync(portalFile)) portalBytes = new Uint8Array(await readFile(portalFile));
    if (!portalBytes) { const dl = await downloadPortalZip({ fetch: options.portalFetch }); portalBytes = dl.bytes; portalFetchedAt = dl.fetchedAt; portalLastModified = dl.lastModified; await writeFile(portalFile, portalBytes); }
    progress(`Portal: ${portalBytes.byteLength} bytes`);
    const portal = parsePortalZip(portalBytes);
    const portalInfo = { sha256: portal.sha256, bytes: portalBytes.byteLength, fetchedAt: portalFetchedAt, lastModified: portalLastModified, ...portal.meta };
    const tables = await readTransferegovTables(dir);
    const official = Object.fromEntries(Object.entries(manifest.tables).map(([k, v]) => [k, v.official]));
    const fetched = Object.fromEntries(Object.entries(manifest.tables).map(([k, v]) => [k, v.fetched]));
    const blocking = options.blockingGates ?? ['TRANSFEREGOV_PLAN_COVERAGE', 'PORTAL_AMENDMENT_MATCH'];
    const outcome = await store.transaction(async client => {
      const load = await loadBudgetRun(client, runId, { tables, portalAmendments: portal.amendments, portalPayments: portal.payments });
      const duplicates = Object.fromEntries(Object.entries(load.warnings).filter(([k]) => k.startsWith('duplicate_')).map(([k, v]) => [k.slice('duplicate_'.length), v]));
      const reconciliation = await reconcileBudget(client, runId, { official, fetched, duplicates });
      const failed = blocking.filter(g => reconciliation.gates[g]?.status === 'FAIL');
      if (failed.length) throw Object.assign(new Error(`Gates reprovados: ${failed.map(g => `${g} ${JSON.stringify(reconciliation.gates[g]!.detail).slice(0, 1500)}`).join('; ')}`), { reconciliation, load });
      await finishBudgetRun(client, runId, 'published', { ...load.counts, warnings: load.warnings }, reconciliation);
      await client.query(`UPDATE civica_budget.budget_ingestion_runs SET source_cutoff=$2 WHERE run_id=$1`, [runId, JSON.stringify({ transferegov: manifest, portal: portalInfo })]);
      return { load, reconciliation };
    });
    return { runId, status: 'published', reconciliation: outcome.reconciliation, counts: outcome.load.counts, manifest, portal: portalInfo };
  } catch (error) {
    await finishBudgetRun(store.pool, runId, 'failed', {}, (error as any).reconciliation ?? {}, (error as Error).message);
    throw error;
  }
}
