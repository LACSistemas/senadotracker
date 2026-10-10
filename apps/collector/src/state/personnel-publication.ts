import { reconcileCandidate, semanticRevisionId, type PublicationCandidate, type PublicationDecision, type PublicationState } from '../core/publication-lifecycle.ts';

export interface PersonnelSnapshotRow {
  readonly personExternalId: string;
  readonly officeExternalId: string;
  readonly role: string;
  readonly assignmentKey: string;
  readonly salaryCents?: number | null;
  readonly observedAt: string;
  readonly rawId: string;
}

/** P19 candidate contract: immutable rows, explicit source boundary, no destructive rewrite. */
export function reconcilePersonnelSnapshot(rows: readonly PersonnelSnapshotRow[], sourceRows: number, sourceHash: string, active: PublicationState, scope = 'state:PERSONNEL'): PublicationDecision<PersonnelSnapshotRow> {
  return reconcileCandidate({ rows, sourceRows, sourceHash, scope }, active, row => row);
}

export function personnelRevisionId(rows: readonly PersonnelSnapshotRow[], scope = 'state:PERSONNEL'): string { return semanticRevisionId(scope, rows, row => row); }
