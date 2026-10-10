import type { SaplClient } from './client.ts';
import type { RoSliceRunResult } from './slice.ts';
import { SaplMapper } from './mapper.ts';

/** Builds the bounded P1/P2 proof corpus without claiming population completeness. */
export async function augmentControlledRoCorpus(client: SaplClient, result: RoSliceRunResult): Promise<RoSliceRunResult> {
  const mapper = new SaplMapper();
  const details = await Promise.all([
    client.json<Record<string, unknown>>('/api/materia/autoria/57808/'),
    client.json<Record<string, unknown>>('/api/materia/materialegislativa/57929/'),
    client.json<Record<string, unknown>>('/api/materia/tramitacao/117039/'),
  ]);
  const unwrap = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const object = value as Record<string, unknown>;
    for (const key of ['results', 'data', 'object']) { const nested = object[key]; if (Array.isArray(nested)) return (nested[0] as Record<string, unknown>) ?? {}; if (nested && typeof nested === 'object') return nested as Record<string, unknown>; }
    return object;
  };
  const author = mapper.author(unwrap(details[0].data), details[0].envelope);
  const proposal = mapper.proposal(unwrap(details[1].data), details[1].envelope);
  const movement = mapper.movement(unwrap(details[2].data), details[2].envelope);
  const legislative = result.batches.find(batch => batch.ingestion.domain === 'legislative');
  if (!legislative) return result;
  const proposalIds = new Set(legislative.entities.filter(entity => 'key' in entity && (entity as any).key.resource === 'materia').map(entity => String((entity as any).key.externalId)));
  proposalIds.add(String((proposal as any).key.externalId));
  const entities = legislative.entities.filter(entity => { const value = entity as any; return value.proposal ? proposalIds.has(String(value.proposal.externalId)) : true; }).filter(entity => (entity as any).movementKey !== (movement as any).movementKey).concat(proposal, author, movement);
  return { ...result, rawEnvelopes: [...result.rawEnvelopes, ...details.map(value => value.envelope)], batches: result.batches.map(batch => batch.ingestion.domain === 'legislative' ? { ...batch, entities } : batch) };
}
