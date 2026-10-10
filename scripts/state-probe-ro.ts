import { SaplClient, runRoSlice } from '../apps/collector/src/state/providers/sapl/index.ts';

if (!process.argv.includes('--live')) {
  console.error('Uso: node --import tsx scripts/state-probe-ro.ts --live [--verify-sanity]');
  process.exitCode = 2;
} else {
  const client = new SaplClient({ baseUrl: 'https://sapl.al.ro.leg.br', delayMs: 120, timeoutMs: 30_000, maxAttempts: 3 });
  const result = await runRoSlice({
    client,
    pageSize: 25,
    maxPages: Number(process.env.STATE_PROBE_RO_MAX_PAGES ?? 1),
    ...(process.argv.includes('--verify-sanity') ? { verifySanity: true, sanity: { authorshipId: '57808', proposalId: '57929', movementId: '117039' } } : {}),
  });
  console.log(JSON.stringify({
    runId: result.runId,
    discovery: { version: result.discovery.version, endpoints: result.discovery.endpoints.length, schemaHash: result.discovery.schemaHash, drift: result.discovery.drift },
    rawObjects: result.rawEnvelopes.length,
    batches: result.batches.map(batch => ({ domain: batch.ingestion.domain, entities: batch.entities.length, coverage: batch.coverage })),
    publications: result.publications.map(publication => publication.revision),
    quality: result.quality,
    metrics: result.metrics,
    sanity: result.sanity,
  }, null, 2));
}
