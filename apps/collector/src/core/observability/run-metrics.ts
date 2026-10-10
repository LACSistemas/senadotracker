export type LifecycleStatus = 'STARTED' | 'FETCHED' | 'VALIDATED' | 'PARSED' | 'CANONICALIZED' | 'RECONCILED' | 'NO_OP' | 'STAGED' | 'PUBLISHED' | 'FAILED';
export interface RunMetrics { readonly startedAt: string; finishedAt?: string; fetchMs?: number; parseMs?: number; reconcileMs?: number; publicationMs?: number; lifecycle: LifecycleStatus[]; }
export const startMetrics = (): RunMetrics => ({ startedAt: new Date().toISOString(), lifecycle: ['STARTED'] });
