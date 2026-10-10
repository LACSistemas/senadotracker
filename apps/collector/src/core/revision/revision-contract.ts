export interface RevisionAdapter<T> { getActiveRevision(): Promise<string | null>; stageRevision(revision: string, value: T): Promise<void>; validateStage(revision: string): Promise<void>; promoteRevisionAtomically(revision: string): Promise<void>; preservePreviousRevision(revision: string | null): Promise<void>; }
export type PublicationDecision = 'NO_OP' | 'PUBLISH';
