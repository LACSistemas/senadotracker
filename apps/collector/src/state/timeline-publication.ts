import { reconcileCandidate, semanticRevisionId, type PublicationDecision, type PublicationState } from '../core/publication-lifecycle.ts';

export interface TimelineEventCandidate {
  readonly proposalExternalId: string;
  readonly sourceEventKey: string;
  readonly eventOrder: number;
  readonly occurredAt: string | null;
  readonly eventType: string;
  readonly description: string;
  readonly rawId: string;
}

/** P22 owns a separate event grain; proposal publication must never be reused as timeline identity. */
export function reconcileTimelineWindow(rows: readonly TimelineEventCandidate[], sourceRows: number, sourceHash: string, active: PublicationState, scope: string): PublicationDecision<TimelineEventCandidate> {
  return reconcileCandidate({ rows, sourceRows, sourceHash, scope }, active, row => row);
}

export function timelineRevisionId(rows: readonly TimelineEventCandidate[], scope: string): string { return semanticRevisionId(scope, rows, row => row); }
