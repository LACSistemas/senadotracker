import { createHash } from 'node:crypto';

/** Common, side-effect-free publication gates shared by state domains. */
export interface PublicationCandidate<T> {
  readonly rows: readonly T[];
  readonly sourceRows: number;
  readonly scope: string;
  readonly sourceHash: string;
  readonly dataThrough?: string | null;
  readonly sourceUpdatedAt?: string | null;
}

export interface PublicationState {
  readonly revisionId: string | null;
  readonly rowCount: number;
  readonly sourceHash?: string | null;
}

export interface PublicationReconciliation {
  readonly sourceRows: number;
  readonly candidateRows: number;
  readonly activeRows: number;
  readonly duplicateRows: number;
  readonly shrink: boolean;
  readonly empty: boolean;
  readonly unchanged: boolean;
  readonly sourceHash: string;
}

export interface PublicationDecision<T> {
  readonly status: 'PUBLISH' | 'NO_CHANGE' | 'FAILED_SAFE';
  readonly candidate: PublicationCandidate<T>;
  readonly reconciliation: PublicationReconciliation;
  readonly revisionId: string | null;
  readonly reason?: string;
}

export function semanticRevisionId<T>(scope: string, rows: readonly T[], semantic: (row: T) => unknown): string {
  const payload = rows.map(row => stableJson(semantic(row))).sort().join('\n');
  return `${scope}:${createHash('sha256').update(payload).digest('hex')}`;
}

export function reconcileCandidate<T>(candidate: PublicationCandidate<T>, active: PublicationState, semantic: (row: T) => unknown): PublicationDecision<T> {
  const ids = candidate.rows.map(row => stableJson(semantic(row)));
  const duplicateRows = ids.length - new Set(ids).size;
  const shrink = active.rowCount > 0 && candidate.rows.length < active.rowCount;
  const empty = candidate.rows.length === 0 || candidate.sourceRows === 0;
  const candidateRevision = semanticRevisionId(candidate.scope, candidate.rows, semantic);
  const unchanged = Boolean((active.sourceHash && active.sourceHash === candidate.sourceHash) || active.revisionId === candidateRevision);
  const reconciliation = { sourceRows: candidate.sourceRows, candidateRows: candidate.rows.length, activeRows: active.rowCount, duplicateRows, shrink, empty, unchanged, sourceHash: candidate.sourceHash };
  if (empty) return { status: 'FAILED_SAFE', candidate, reconciliation, revisionId: active.revisionId, reason: 'EMPTY_CANDIDATE' };
  if (duplicateRows > 0) return { status: 'FAILED_SAFE', candidate, reconciliation, revisionId: active.revisionId, reason: 'DUPLICATE_NATURAL_KEYS' };
  if (shrink) return { status: 'FAILED_SAFE', candidate, reconciliation, revisionId: active.revisionId, reason: 'CANDIDATE_SHRINK' };
  if (unchanged) return { status: 'NO_CHANGE', candidate, reconciliation, revisionId: active.revisionId, reason: 'UNCHANGED_SOURCE' };
  return { status: 'PUBLISH', candidate, reconciliation, revisionId: candidateRevision };
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`;
}
