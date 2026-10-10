import { createHash } from 'node:crypto';
import type { DiscoveryResult, RawEnvelope } from '../../contracts.ts';
import { AlepClient } from './client.ts';

export interface AlepDiscoveryResult extends DiscoveryResult { readonly schemaEnvelope: RawEnvelope; readonly drift: { readonly expectedHash?: string; readonly actualHash: string; readonly drift: boolean; readonly criticalCapabilitiesMissing: string[] }; }

export class AlepDiscovery {
  constructor(private readonly client: AlepClient) {}
  async discover(expectedSchemaHash?: string): Promise<AlepDiscoveryResult> {
    const response = await this.client.json<Record<string, unknown>>('/proposicao/campos');
    const actualHash = createHash('sha256').update(canonical(response.data)).digest('hex');
    const result: DiscoveryResult = { providerDetected: 'alep_api' as DiscoveryResult['providerDetected'], endpoints: ['/proposicao/campos', '/proposicao/filtrar', '/proposicao/{codigo}'], capabilities: { proposals: 'supported', authorship: 'partial', movements: 'supported', identity: 'unknown', mandates: 'unknown', party_membership: 'unknown' }, auth: 'none', pagination: 'mixed', schemaHash: actualHash, checkedAt: response.envelope.fetchedAt };
    return { ...result, schemaEnvelope: response.envelope, drift: { ...(expectedSchemaHash ? { expectedHash: expectedSchemaHash } : {}), actualHash, drift: Boolean(expectedSchemaHash && expectedSchemaHash !== actualHash), criticalCapabilitiesMissing: [] } };
  }
}

function canonical(value: unknown): string { if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`; if (value && typeof value === 'object') return `{${Object.keys(value as Record<string, unknown>).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`; return JSON.stringify(value); }
