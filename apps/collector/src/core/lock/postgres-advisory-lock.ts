import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { CollectorLockKey } from './collector-lock.ts';

export interface AdvisoryLockClient { query(sql: string, values?: readonly unknown[]): Promise<{ rows: readonly Record<string, unknown>[] }> | Promise<unknown>; }
export function advisoryLockKey(key: CollectorLockKey): bigint { const digest = createHash('sha256').update(`${key.house}:${key.domain}:${key.provider}`).digest(); return digest.readBigInt64BE(0); }
export async function withPostgresAdvisoryLock<T>(client: AdvisoryLockClient, key: CollectorLockKey, operation: () => Promise<T>): Promise<T> { const lock = advisoryLockKey(key); await client.query('SELECT pg_advisory_lock($1::bigint)', [lock.toString()]); try { return await operation(); } finally { await client.query('SELECT pg_advisory_unlock($1::bigint)', [lock.toString()]); } }
export async function withPoolClientAdvisoryLock<T>(client: PoolClient, key: CollectorLockKey, operation: () => Promise<T>): Promise<T> { return withPostgresAdvisoryLock(client, key, operation); }
