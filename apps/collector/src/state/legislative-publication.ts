import { reconcileCandidate, semanticRevisionId, type PublicationDecision, type PublicationState } from '../core/publication-lifecycle.ts';

export interface LegislativeCandidate {
  readonly sourceId: string;
  readonly title: string | null;
  readonly type: string | null;
  readonly number: string | null;
  readonly year: number;
  readonly presentedAt: string | null;
  readonly rawId: string;
}

/** Shared custom-legislative candidate gate; source-family fetch/parsing stays explicit. */
export function reconcileLegislativeCorpus(rows: readonly LegislativeCandidate[], sourceRows: number, sourceHash: string, active: PublicationState, scope: string): PublicationDecision<LegislativeCandidate> {
  return reconcileCandidate({ rows, sourceRows, scope, sourceHash }, active, row => row);
}

export function legislativeRevisionId(rows: readonly LegislativeCandidate[], scope: string): string { return semanticRevisionId(scope, rows, row => row); }
