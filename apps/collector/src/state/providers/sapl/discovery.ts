import { createHash } from 'node:crypto';
import type { CapabilityState, DiscoveryResult, RawEnvelope } from '../../contracts.ts';
import { providerId } from '../../identifiers.ts';
import { canonicalJson, SaplClient } from './client.ts';

export interface SchemaDriftResult { readonly expectedHash?: string; readonly actualHash: string; readonly drift: boolean; readonly criticalCapabilitiesMissing: string[]; }

export interface SaplDiscoveryResult extends DiscoveryResult { readonly drift: SchemaDriftResult; readonly schemaEnvelope: RawEnvelope; }

export class SaplDiscovery {
  constructor(private readonly client: SaplClient) {}

  async discover(expectedSchemaHash?: string, schemaPath = '/api/schema/'): Promise<SaplDiscoveryResult> {
    const response = await this.client.json<unknown>(schemaPath);
    const schemaHash = createHash('sha256').update(canonicalJson(response.data)).digest('hex');
    const schema = response.data as Record<string, unknown>;
    const paths = schema && typeof schema.paths === 'object' && schema.paths ? Object.keys(schema.paths as Record<string, unknown>).sort() : [];
    const capabilities = capabilityMap(paths);
    const criticalCapabilitiesMissing = ['identity', 'mandates', 'proposals', 'authorship', 'movements'].filter(capability => capabilities[capability] !== 'supported');
    const drift = { ...(expectedSchemaHash !== undefined ? { expectedHash: expectedSchemaHash } : {}), actualHash: schemaHash, drift: expectedSchemaHash !== undefined && expectedSchemaHash !== schemaHash, criticalCapabilitiesMissing };
    return { providerDetected: providerId('sapl'), ...(typeof schema.openapi === 'string' ? { version: schema.openapi } : {}), endpoints: paths, capabilities, auth: 'none', pagination: 'paginated', schemaHash, checkedAt: response.envelope.fetchedAt, drift, schemaEnvelope: response.envelope };
  }
}

function capabilityMap(paths: readonly string[]): Record<string, CapabilityState> {
  const has = (terms: string[]): boolean => paths.some(path => terms.some(term => path.toLowerCase().includes(term)));
  const result: Record<string, CapabilityState> = {};
  for (const [capability, terms] of Object.entries({
    identity: ['parlamentar'], mandates: ['mandato'], party_membership: ['filiacao'], proposals: ['materialegislativa', '/materia/'], authorship: ['autoria'], movements: ['tramitacao'], norms: ['norma'],
    commissions: ['comissao'], meetings: ['reuniao'], votes: ['/voto', 'votacao'], attendance: ['presenca', 'sessao'], finance: ['despesa', 'finance'], suppliers: ['fornecedor'], staff: ['servidor', 'staff'],
  })) result[capability] = has(terms) ? 'supported' : 'unknown';
  return result;
}
