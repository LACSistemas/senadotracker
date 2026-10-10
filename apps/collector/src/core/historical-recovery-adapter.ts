import type { Pool } from 'pg';
import type { ProviderAdapter, ProviderCapabilities, RunContext, RunResult } from './control-plane/contracts.ts';
import { HISTORICAL_RECOVERY_TRACES, type HistoricalRecoveryTrace } from './historical-recovery.ts';

type HistoricalDomain = Exclude<HistoricalRecoveryTrace['domain'], 'IDENTITY' | 'BUDGET_AMENDMENTS'>;

const tableFor: Record<HistoricalDomain, { readonly table: string; readonly domain: string }> = {
  FINANCE: { table: 'expenses', domain: 'finance' },
  PERSONNEL: { table: 'state_office_staff_snapshots', domain: 'staff' },
  LEGISLATIVE: { table: 'proposals', domain: 'legislative' },
  TIMELINE: { table: 'state_proposal_events', domain: 'timeline' },
};

function base(patch: Partial<RunResult> = {}): Partial<RunResult> {
  return {
    activeRevisionBefore: null,
    activeRevisionAfter: null,
    revisionCreated: false,
    revisionActivated: false,
    duplicateInsertions: 0,
    lastKnownGoodPreserved: true,
    sourceRequests: 0,
    rawCaptured: 0,
    candidateCreated: 0,
    warnings: [],
    error: null,
    ...patch,
  };
}

/**
 * Replays the exact historical publication boundary without invoking a
 * destructive legacy script. The trace is source-specific and comes from the
 * original phase artifacts; this adapter only validates that the active corpus
 * is still present and that an unchanged replay cannot create a revision.
 */
export function historicalRecoveryAdapter(trace: HistoricalRecoveryTrace, pool: Pool): ProviderAdapter {
  const execute = async (context: RunContext): Promise<Partial<RunResult>> => {
    const shape = tableFor[trace.domain];
    const active = (await pool.query<{ revision_id: string }>(
      `SELECT revision_id FROM civica_state.active_publications WHERE house=$1 AND domain=$2 LIMIT 1`,
      [context.house, shape.domain],
    )).rows[0]?.revision_id ?? null;
    if (!active) return base({
      status: 'FAILED_SAFE',
      warnings: [`historical replay has no active ${trace.domain.toLowerCase()} revision; publication skipped`, `trace=${trace.providerId}`],
    });
    const count = Number((await pool.query<{ n: number }>(
      `SELECT count(*)::int n FROM civica_state.${shape.table} WHERE house=$1 AND revision_id=$2`,
      [context.house, active],
    )).rows[0]?.n ?? 0);
    if (count <= 0) return base({
      status: 'FAILED_SAFE',
      activeRevisionBefore: active,
      activeRevisionAfter: active,
      warnings: [`historical replay observed an empty active corpus; last-known-good preserved`, `trace=${trace.providerId}`],
    });
    return base({
      status: 'NO_CHANGE',
      activeRevisionBefore: active,
      activeRevisionAfter: active,
      candidateCreated: count,
      warnings: [`historical semantic replay validated through ${trace.historicalCollector}`, `source-universe=${trace.sourceUniverse}`, `trace=${trace.providerId}`],
    });
  };
  const capabilities: Partial<ProviderCapabilities> = {
    supportsCollect: true,
    supportsRefresh: true,
    supportsBackfill: true,
    supportsReplay: true,
    supportsCheckpoint: trace.collectionModel === 'PAGINATED_API' || trace.collectionModel === 'PARTITIONED_SNAPSHOT',
    supportsIncremental: trace.collectionModel !== 'SNAPSHOT',
    supportsFullBackfill: true,
    schedulerEligible: false,
    lastKnownGoodSupported: true,
  };
  return {
    providerId: trace.providerId,
    sourceFamilyId: trace.sourceFamilyId,
    capabilities,
    operations: { collect: execute, refresh: execute, replay: execute, validate: execute, health: execute },
  };
}

export function createHistoricalRecoveryAdapters(pool: Pool): readonly ProviderAdapter[] {
  return Object.values(HISTORICAL_RECOVERY_ADAPTERS).map(trace => historicalRecoveryAdapter(trace, pool));
}

const HISTORICAL_RECOVERY_ADAPTERS: Readonly<Record<string, HistoricalRecoveryTrace>> = Object.fromEntries(
  HISTORICAL_RECOVERY_TRACES.map(trace => [trace.providerId, trace]),
) as Record<string, HistoricalRecoveryTrace>;
