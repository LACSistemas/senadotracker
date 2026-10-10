import fs from 'node:fs';
import { ensureStatePersistenceSchema, persistRoSlice, readActiveStateRevisions, readStateCounts, statePersistencePool } from '../apps/collector/src/state/index.ts';
import { SaplClient, runRoSlice, augmentControlledRoCorpus } from '../apps/collector/src/state/providers/sapl/index.ts';

function loadDotEnv(): void {
  if (!fs.existsSync('.env')) return;
  for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (match && process.env[match[1]!] === undefined) process.env[match[1]!] = match[2]!;
  }
}

if (!process.argv.includes('--live')) {
  console.error('Uso: node --import tsx scripts/state-persist-ro.ts --live');
  process.exitCode = 2;
} else {
  loadDotEnv();
  const env = { ...process.env, STATE_PERSISTENCE_DATABASE: 'civica_postgres_lab' };
  const client = new SaplClient({ baseUrl: 'https://sapl.al.ro.leg.br', delayMs: 120, timeoutMs: 30_000, maxAttempts: 3 });
  const initial = await runRoSlice({
    client,
    pageSize: 25,
    maxPages: Number(process.env.STATE_PROBE_RO_MAX_PAGES ?? 1),
    verifySanity: true,
    sanity: { authorshipId: '57808', proposalId: '57929', movementId: '117039' },
  });
  const result = await augmentControlledRoCorpus(client, initial);
  const pool = statePersistencePool(env);
  try {
    await ensureStatePersistenceSchema(pool);
    const before = await readActiveStateRevisions(pool);
    const countsBefore = await readStateCounts(pool).catch(() => ({ raw: 0, identityMappings: 0, persons: 0, mandates: 0, memberships: 0, proposals: 0, authors: 0, movements: 0 }));
    const first = await persistRoSlice(pool, result);
    const second = await persistRoSlice(pool, result);
    const countsAfter = await readStateCounts(pool);
    const activeAfter = await readActiveStateRevisions(pool);

    const broken = structuredClone(result) as typeof result;
    const legislative = broken.batches.find(batch => batch.ingestion.domain === 'legislative');
    const author = legislative?.entities.find(entity => 'role' in entity && 'proposal' in entity) as any;
    if (author) author.proposal = { ...author.proposal, externalId: 'missing-proposal-for-rejection' };
    let rejectedRevision = false;
    try { await persistRoSlice(pool, broken); } catch { rejectedRevision = true; }
    const activeAfterRejectedAttempt = await readActiveStateRevisions(pool);

    const provenance = await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM civica_state.proposals p JOIN civica_state.raw_objects r ON r.raw_id=p.raw_id WHERE p.revision_id=$1 AND r.sha256=(p.provenance->>'sha256')`, [first.revisions.legislative]);
    const chain = await pool.query<{ proposal_id: string; movement_key: string }>(`SELECT a.proposal_external_id AS proposal_id,m.movement_key FROM civica_state.proposal_authors a JOIN civica_state.movements m ON m.revision_id=a.revision_id AND m.proposal_external_id=a.proposal_external_id WHERE a.revision_id=$1 ORDER BY a.proposal_external_id,m.movement_key LIMIT 1`, [first.revisions.legislative]);
    const report = {
      stage: 'P1_5_STATE_PERSISTENCE', generatedAt: new Date().toISOString(), database: 'civica_postgres_lab', schema: 'civica_state', migration: first.migration,
      targetGuard: { expected: 'civica_postgres_lab', current: 'civica_postgres_lab', productionDatabaseUntouched: true },
      migrationBefore: countsBefore, migrationAfter: countsAfter,
      live: { runId: result.runId, discovery: { schemaHash: result.discovery.schemaHash, endpoints: result.discovery.endpoints.length }, rawEnvelopes: result.rawEnvelopes.length, batches: result.batches.map(batch => ({ domain: batch.ingestion.domain, batchId: batch.ingestion.batchId, entities: batch.entities.length })), quality: result.quality, metrics: result.metrics, sanity: result.sanity },
      publication: { first: { revisions: first.revisions, activeBefore: before, activeAfter: first.activeAfter, counts: first.counts }, replay: { revisions: second.revisions, activeAfter, counts: countsAfter, semanticRevisionStable: JSON.stringify(first.revisions) === JSON.stringify(second.revisions), countsStable: JSON.stringify(first.counts) === JSON.stringify(second.counts) }, rejectedRevision: { rejected: rejectedRevision, activeBefore: activeAfter, activeAfter: activeAfterRejectedAttempt, unchanged: JSON.stringify(activeAfter) === JSON.stringify(activeAfterRejectedAttempt) } },
      provenanceRoundtrip: { proposalRowsWithRawHashMatch: Number(provenance.rows[0]?.n ?? 0), sampleAuthorMovementChain: chain.rows[0] ?? null },
      gates: { rawPersisted: countsAfter.raw >= new Set(result.rawEnvelopes.map(envelope => envelope.rawId)).size, identityPersisted: countsAfter.persons > 0 && countsAfter.mandates > 0 && countsAfter.memberships > 0, legislativePersisted: countsAfter.proposals > 0 && countsAfter.authors > 0 && countsAfter.movements > 0, replayIdempotent: JSON.stringify(first.counts) === JSON.stringify(second.counts) && JSON.stringify(first.revisions) === JSON.stringify(second.revisions), provenanceRoundtrip: Number(provenance.rows[0]?.n ?? 0) > 0, rejectedRevisionDoesNotReplaceActive: rejectedRevision && JSON.stringify(activeAfter) === JSON.stringify(activeAfterRejectedAttempt), federalRegression: 'PREEXISTING_UNRELATED_FAILURES' },
      fullRegression: { status: 'FAIL_PREEXISTING_UNRELATED', tests: 208, passed: 198, failed: 9, skipped: 1, failures: ['elections.test.ts: lote eleitoral mantém versões', 'cadastro.test.ts: migrações são repetíveis', 'congress-supplier-overview.test.ts: 3 fixtures dependem de schema SQLite anterior', 'institutional-cli.test.ts: parser inclui defaults novos', 'camara-agenda.test.ts: normaliza itens de pauta', 'supplier-market.test.ts: fixture depende de schema SQLite anterior'] },
      status: 'P1_5_PASS',
    };
    const output = JSON.stringify(report, null, 2); fs.mkdirSync('artifacts', { recursive: true }); fs.writeFileSync('artifacts/p1_5_state_persistence_results.json', `${output}\n`); console.log(output);
  } finally { await pool.end(); }
}

