import type { EnrichmentMode } from '../collector-provider.ts';
export function carryForwardStableEnrichment<T, E>(previous: readonly T[], incoming: readonly T[], keyOf: (value: T) => string, enrichmentOf: (value: T) => E | undefined, apply: (value: T, enrichment: E) => T, mode: EnrichmentMode = 'NEW_ONLY'): T[] {
  const stable = new Map(previous.map(value => [keyOf(value), enrichmentOf(value)]));
  return incoming.map(value => { const enrichment = stable.get(keyOf(value)); return mode === 'NEW_ONLY' && enrichment !== undefined ? apply(value, enrichment) : value; });
}
