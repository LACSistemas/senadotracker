import type { Pool } from 'pg';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ensureStatePersistenceSchema } from '../../persistence.ts';
import { reconcileCandidate, type PublicationDecision } from '../../../core/publication-lifecycle.ts';
import type { NormalizedExpense } from '../../contracts.ts';
import type { LiveAttempt, LiveFetch } from './live-wave-a.ts';

export interface FinancePublicationResult {
  readonly status: 'SUCCESS' | 'NO_CHANGE' | 'FAILED_SAFE';
  readonly revisionId: string | null;
  readonly activeBefore: string | null;
  readonly activeAfter: string | null;
  readonly sourceRows: number;
  readonly candidateRows: number;
  readonly duplicateInsertions: number;
  readonly rawCaptured: number;
  readonly reconciliation: PublicationDecision<NormalizedExpense>['reconciliation'];
  readonly reason?: string;
}

/**
 * Full-safe finance publication.  Source-specific collectors remain in
 * live-wave-a.ts; this module owns the common raw -> candidate -> reconcile ->
 * immutable revision -> activation lifecycle and never replaces a good active
 * revision with an empty or smaller candidate.
 */
export async function publishFinanceAttempt(pool: Pool, attempt: LiveAttempt, runId: string): Promise<FinancePublicationResult> {
  const beforeRow = (await pool.query<{ revision_id: string }>(`SELECT revision_id FROM civica_state.active_publications WHERE house=$1 AND domain='finance' LIMIT 1`, [attempt.house])).rows[0];
  const activeBefore = beforeRow?.revision_id ?? null;
  const activeCount = activeBefore ? Number((await pool.query<{ n: number }>(`SELECT count(*)::int n FROM civica_state.expenses WHERE house=$1 AND revision_id=$2`, [attempt.house, activeBefore])).rows[0]?.n ?? 0) : 0;
  const sourceHash = createHash('sha256').update(attempt.fetches.map(fetch => fetch.sha256).sort().join('\n')).digest('hex');
  const decision = reconcileCandidate({ rows: attempt.rows, sourceRows: attempt.sourceRows, scope: `state:${attempt.house}:finance`, sourceHash }, { revisionId: activeBefore, rowCount: activeCount, sourceHash: activeSourceHash(attempt, activeBefore) }, row => ({ id: row.key.externalId, person: row.person?.externalId ?? null, competence: row.competence ?? null, occurredAt: row.occurredAt ?? null, amountCents: row.amountCents ?? null, category: row.category ?? null, supplier: row.supplier?.externalId ?? null, supplierName: row.supplierName ?? null, supplierDocument: row.supplierDocument ?? null, fiscalDocument: row.fiscalDocument ?? null, description: row.description ?? null }));
  if (attempt.sourceCompleteness !== 'PROVEN' || attempt.keyStatus === 'FAIL') return { status: 'FAILED_SAFE', revisionId: activeBefore, activeBefore, activeAfter: activeBefore, sourceRows: attempt.sourceRows, candidateRows: attempt.rows.length, duplicateInsertions: 0, rawCaptured: 0, reconciliation: decision.reconciliation, reason: attempt.blocker ?? `SOURCE_COMPLETENESS_${attempt.sourceCompleteness}` };
  if (decision.status !== 'PUBLISH') return { status: decision.status, revisionId: decision.revisionId, activeBefore, activeAfter: activeBefore, sourceRows: attempt.sourceRows, candidateRows: attempt.rows.length, duplicateInsertions: 0, rawCaptured: 0, reconciliation: decision.reconciliation, ...(decision.reason ? { reason: decision.reason } : {}) };
  const raw = rawBodies(attempt.fetches);
  if (raw.length !== attempt.fetches.filter(fetch => fetch.ok).length) return { status: 'FAILED_SAFE', revisionId: activeBefore, activeBefore, activeAfter: activeBefore, sourceRows: attempt.sourceRows, candidateRows: attempt.rows.length, duplicateInsertions: 0, rawCaptured: raw.length, reconciliation: decision.reconciliation, reason: 'RAW_PROVENANCE_INCOMPLETE' };
  await ensureStatePersistenceSchema(pool);
  const now = new Date().toISOString();
  const revisionId = decision.revisionId!;
  let duplicateInsertions = 0;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of raw) {
      const result = await client.query(`INSERT INTO civica_state.raw_objects(raw_id,house,provider,resource,endpoint,params,fetched_at,observed_at,status,content_type,sha256,body) VALUES($1,$2,$3,'finance-source',$4,'{}'::jsonb,$5,$5,$6,$7,$8,$9) ON CONFLICT(raw_id) DO NOTHING`, [item.rawId, attempt.house, attempt.provider, item.fetch.url, now, item.fetch.status, item.fetch.contentType ?? 'application/octet-stream', item.fetch.sha256, item.body]);
      // ON CONFLICT DO NOTHING guarantees that a replay never inserts a
      // duplicate raw object. `duplicateInsertions` intentionally counts
      // rows inserted twice, rather than conflict attempts, so it remains 0
      // for a safe replay.
    }
    const quality = { sourceCompleteness: attempt.sourceCompleteness, sourceRows: attempt.sourceRows, candidateRows: attempt.rows.length, fetches: attempt.fetches.length, sourceMap: attempt.sourceMap, dataThrough: attempt.sourceMap.dataThrough ?? null };
    await client.query(`INSERT INTO civica_state.ingestion_runs(run_id,house,provider,started_at,finished_at,status,parser_version,expected_count,quality,reconciliation) VALUES($1,$2,$3,$4,$4,'published','p25-2u-finance-v1',$5,$6,$7) ON CONFLICT(run_id) DO NOTHING`, [runId, attempt.house, attempt.provider, now, attempt.sourceRows, JSON.stringify(quality), JSON.stringify(decision.reconciliation)]);
    await client.query(`INSERT INTO civica_state.public_domain_revisions(house,domain,revision_id,status,quality,created_at,activated_at) VALUES($1,'finance',$2,'active',$3,$4,$4) ON CONFLICT(house,domain,revision_id) DO UPDATE SET status='active',quality=excluded.quality`, [attempt.house, revisionId, JSON.stringify(quality), now]);
    await client.query(`INSERT INTO civica_state.public_revision_contributions(house,domain,revision_id,provider,run_id,batch_id) VALUES($1,'finance',$2,$3,$4,$4) ON CONFLICT DO NOTHING`, [attempt.house, revisionId, attempt.provider, runId]);
    for (const row of attempt.rows) {
      const result = await client.query(`INSERT INTO civica_state.expenses(revision_id,house,provider,external_id,person_external_id,occurred_at,competence,period_start,period_end,temporal_precision,amount_cents,category,supplier_external_id,raw_id,provenance) VALUES($1,$2,$3,$4,$5,$6,$7,$6,$6,$8,$9,$10,$11,$12,$13) ON CONFLICT DO NOTHING`, [revisionId, attempt.house, attempt.provider, row.key.externalId, row.person?.externalId ?? null, row.occurredAt ?? null, row.competence ?? null, row.temporalPrecision, row.amountCents ?? null, row.category ?? null, row.supplier?.externalId ?? null, row.provenance.rawId, JSON.stringify(row.provenance)]);
      if (Number(result.rowCount ?? 0) === 0) duplicateInsertions += 1;
    }
    await client.query(`INSERT INTO civica_state.active_publications(house,domain,revision_id,activated_at) VALUES($1,'finance',$2,$3) ON CONFLICT(house,domain) DO UPDATE SET revision_id=excluded.revision_id,activated_at=excluded.activated_at`, [attempt.house, revisionId, now]);
    await client.query(`UPDATE civica_state.public_domain_revisions SET status='rejected' WHERE house=$1 AND domain='finance' AND revision_id<>$2 AND status='active'`, [attempt.house, revisionId]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  return { status: 'SUCCESS', revisionId, activeBefore, activeAfter: revisionId, sourceRows: attempt.sourceRows, candidateRows: attempt.rows.length, duplicateInsertions, rawCaptured: raw.length, reconciliation: decision.reconciliation };
}

function rawBodies(fetches: readonly LiveFetch[]): { readonly fetch: LiveFetch; readonly body: string; readonly rawId: string }[] {
  return fetches.filter(fetch => fetch.ok).map(fetch => {
    const body = fetch.body ?? (fetch.tempFile ? readFileSync(fetch.tempFile) : null);
    if (body === null) return null;
    const text = typeof body === 'string' ? body : body.toString('utf8');
    return { fetch, body: text, rawId: `raw:live:${fetch.sha256}` };
  }).filter((value): value is { readonly fetch: LiveFetch; readonly body: string; readonly rawId: string } => value !== null);
}

function activeSourceHash(_attempt: LiveAttempt, _revision: string | null): string | null { return null; }
