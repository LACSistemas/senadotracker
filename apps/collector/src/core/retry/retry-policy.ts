import { CollectorError } from '../errors/collector-errors.ts';
export interface RetryPolicy { readonly attempts: number; readonly baseDelayMs: number; readonly maxDelayMs: number; }
export const DEFAULT_RETRY_POLICY: RetryPolicy = { attempts: 3, baseDelayMs: 100, maxDelayMs: 2_000 };
export function retryable(error: unknown): boolean { return error instanceof CollectorError && ['FETCH_ERROR', 'HTTP_ERROR', 'SOURCE_TIMEOUT'].includes(error.code); }
export async function withRetry<T>(operation: () => Promise<T>, policy: RetryPolicy = DEFAULT_RETRY_POLICY): Promise<T> { let last: unknown; for (let attempt = 0; attempt < policy.attempts; attempt++) { try { return await operation(); } catch (error) { last = error; if (!retryable(error) || attempt === policy.attempts - 1) throw error; await new Promise(resolve => setTimeout(resolve, Math.min(policy.maxDelayMs, policy.baseDelayMs * (2 ** attempt)))); } } throw last; }
