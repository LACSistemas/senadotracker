import { createHash } from 'node:crypto';

export interface SourceSnapshot {
  readonly provider: string;
  readonly providerVersion: string;
  readonly sourceUrl: string;
  readonly fetchedAt: string;
  readonly httpStatus: number;
  readonly contentType: string;
  readonly rawHash: string;
  readonly semanticHash?: string;
  readonly schemaVersion: string;
  readonly sourceCount: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export const hashSource = (value: string | Uint8Array): string => createHash('sha256').update(value).digest('hex');
export const hashSemantic = (value: unknown): string => hashSource(JSON.stringify(value));
