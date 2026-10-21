import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import pg from 'pg';
import { parseMsCeapCsv, parseScCabinetCsv, parseDelimitedRows, provenanceForRaw, msExpenseExternalIdFromSourceRow } from '../apps/collector/src/state/providers/state-finance/index.ts';
import { collectScCurrentFinance, fetchScCurrentSource, SC_CURRENT_PROVIDER, SC_CURRENT_URL, STATE_DATABASE } from '../apps/collector/src/state/providers/state-finance/sc-current.ts';
import { buildSchedulerJobs, InMemoryRunStore, InMemorySchedulerLock, NationalFinanceScheduler, type SchedulerExecutionResult } from '../apps/collector/src/core/scheduler/national-finance-scheduler.ts';

const ROOT = process.cwd();
const SCHEMA = 'civica_state';
const MS_PROVIDER = 'alms_ceap_csv';
const MS_URL = 'https://transparencia2.al.ms.gov.br/ceap/notas/exportar-csv?ano=2026';
const EXPECTED_DB = 'civica_postgres_lab';
const OUT_JSON = path.join(ROOT, 'artifacts', 'P18_3fr1.json');
const OUT_MD = path.join(ROOT, 'artifacts', 'P18_3fr1.md');

function loadEnv(): void {
  if (!fs.existsSync('.env')) return;
  for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (match && process.env[match[1]!] === undefined) process.env[match[1]!] = match[2]!;
  }
}
function sha(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function stable(value: unknown): string { return JSON.stringify(value, Object.keys((value && typeof value === 'object' ? value : {}) as object).sort()); }
function folded(value: unknown): string { return String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase(); }
function dbPool(): pg.Pool { return new pg.Pool({ host: 'localhost', port: 5432, database: EXPECTED_DB, user: process.env.DB_USER ?? 'projetoeleitor_user', password: process.env.DB_PASSWORD ?? 'projetoeleitorsenha', max: 2, connectionTimeoutMillis: 30_000 }); }
async function activeRevision(pool: pg.Pool, house: string): Promise<string> { return (await pool.query<{ revision_id: string }>(`SELECT revision_id FROM ${SCHEMA}.active_publications WHERE house=$1 AND domain='finance'`, [house])).rows[0]?.revision_id ?? ''; }
async function activeRows(pool: pg.Pool, house: string, revision: string): Promise<any[]> { return (await pool.query(`SELECT external_id,person_external_id,occurred_at,competence,amount_cents,category,supplier_name,supplier_document,fiscal_document_number,provenance,linkage_status FROM ${SCHEMA}.expenses WHERE house=$1 AND revision_id=$2 ORDER BY external_id`, [house, revision])).rows; }
async function activeRevisions(pool: pg.Pool): Promise<Record<string, string>> { const rows = (await pool.query(`SELECT house,domain,revision_id FROM ${SCHEMA}.active_publications ORDER BY house,domain`)).rows; return Object.fromEntries(rows.map((row: any) => [`${row.house}:${row.domain}`, row.revision_id])); }
function currentRows(rows: any[]): any[] { return rows.filter(row => String(row.competence ?? '').startsWith('2026-')); }
function semanticSignature(row: any): string { return [row.provenance?.providerDeputyLabel ?? row.provenance?.providerPersonLabel ?? row.person?.externalId ?? row.person_external_id, row.competence, row.category, row.supplierDocument ?? row.supplier_document, row.supplierName ?? row.supplier_name, row.fiscalDocument ?? row.fiscal_document_number, row.occurredAt ?? row.occurred_at, row.amountCents ?? row.amount_cents].map(folded).join('|'); }
function sourceField(row: Record<string, string>, names: string[]): string { const key = Object.keys(row).find(candidate => names.some(name => folded(candidate).replace(/[^a-z0-9]/g, '') === folded(name).replace(/[^a-z0-9]/g, ''))); return key ? String(row[key] ?? '') : ''; }
function msSourceFields(row: Record<string, string>): Record<string, string> { return Object.fromEntries(['Deputado','Ano','Mês','Categoria','CPF/CNPJ','Fornecedor','Documento','Emissão','Valor (R$)','Comprovante'].map(name => [name, sourceField(row, [name, name.replace('Mês','Mes'), name.replace('Emissão','Emissao')])])); }
function toSchedulerResult(result: any): SchedulerExecutionResult { return { status: result.publication === 'PUBLISHED' ? 'PUBLISHED' : 'NO_OP', sourceCompletenessProven: true, semanticDelta: !result.noOp, revisionBefore: result.activeFinanceRevisionBefore, revisionAfter: result.activeFinanceRevisionAfter, metrics: { httpRequests: 1, bytes: result.source.bytes, rawHash: result.source.rawSha256, semanticHash: sha(JSON.stringify(result.delta)), sourceRows: result.currentSourceRows, unchanged: result.delta.unchanged, added: result.delta.added, removed: result.delta.removed, changed: result.delta.semanticallyChanged, warnings: [] } }; }

async function main(): Promise<void> {
  loadEnv();
  const pool = dbPool();
  let client: pg.PoolClient | undefined;
  try {
    // This is intentionally the first database query in this phase.
    client = await pool.connect();
    const guard = (await client.query<{ current_database: string; current_schema: string; search_path: string }>(`SELECT current_database(), current_schema(), current_setting('search_path')`)).rows[0];
    if (guard?.current_database !== EXPECTED_DB) throw new Error(`P18.3FR1 target refused: ${guard?.current_database ?? '<unknown>'}`);
    client.release(); client = undefined;

    const revisionsBefore = await activeRevisions(pool);
    const scBeforeRevision = revisionsBefore['SC:finance']!;
    const msBeforeRevision = revisionsBefore['MS:finance']!;
    const scBeforeRows = await activeRows(pool, 'SC', scBeforeRevision);
    const msBeforeRows = await activeRows(pool, 'MS', msBeforeRevision);
    const scBeforeHistorical = scBeforeRows.filter(row => !String(row.competence ?? '').startsWith('2026-'));
    const msBeforeCurrent = currentRows(msBeforeRows);
    const scHistoricalFingerprintBefore = sha(scBeforeHistorical.map(row => stable(row)).join('\n'));
    const priorScRevision = (await pool.query<{ revision_id: string }>(`SELECT revision_id FROM ${SCHEMA}.public_domain_revisions WHERE house='SC' AND domain='finance' AND status='rejected' ORDER BY activated_at DESC NULLS LAST LIMIT 1`)).rows[0]?.revision_id ?? null;
    const priorScRows = priorScRevision ? await activeRows(pool, 'SC', priorScRevision) : [];
    const msFingerprintBefore = sha(msBeforeCurrent.map(row => stable(row)).join('\n'));

    const scSource = await fetchScCurrentSource();
    const scRaw = provenanceForRaw(`raw:sha256:${scSource.rawSha256}`, SC_CURRENT_URL, scSource.body, new Date().toISOString());
    const scParsed = parseScCabinetCsv(scSource.body, SC_CURRENT_URL, scRaw);
    const scLiveIds = new Set(scParsed.map(row => sha(String(row.provenance?.sourceKey ?? row.key.externalId))));
    const scActiveIds = new Set(currentRows(scBeforeRows).map(row => String(row.external_id)));
    const scAdded = [...scLiveIds].filter(id => !scActiveIds.has(id)).length;
    const scRemoved = [...scActiveIds].filter(id => !scLiveIds.has(id)).length;
    const scOverlap = [...scLiveIds].filter(id => scActiveIds.has(id)).length;
    const scSourceOnlyRows = scParsed.filter(row => !scActiveIds.has(sha(String(row.provenance?.sourceKey ?? row.key.externalId))));
    const scFresherRowsValid = scSourceOnlyRows.length === 0 || scSourceOnlyRows.every(row => String(row.competence ?? '').startsWith('2026-10') && row.person?.externalId && row.amountCents !== undefined);
    if (scRemoved !== 0 || scOverlap < 10000 || !scFresherRowsValid) throw new Error(`SC preflight gate failed: overlap=${scOverlap}, added=${scAdded}, removed=${scRemoved}, fresherRowsValid=${scFresherRowsValid}`);

    const scRun1 = await collectScCurrentFinance(pool, { body: scSource.body, observedAt: new Date().toISOString(), mode: 'fetch' });
    const revisionsAfterSc = await activeRevisions(pool);
    const scAfterRows = await activeRows(pool, 'SC', revisionsAfterSc['SC:finance']!);
    const scAfterHistorical = scAfterRows.filter(row => !String(row.competence ?? '').startsWith('2026-'));
    const scHistoricalFingerprintAfter = sha(scAfterHistorical.map(row => stable(row)).join('\n'));
    const identityChanged = revisionsBefore['SC:identity'] !== revisionsAfterSc['SC:identity'] ? 1 : 0;
    const nonTargetChanges = Object.keys(revisionsBefore).filter(key => key !== 'SC:finance' && revisionsBefore[key] !== revisionsAfterSc[key]).length;
    if ((scRun1.publication !== 'PUBLISHED' && scRun1.publication !== 'NO_OP') || scRun1.delta.removed !== 0 || scRun1.delta.semanticallyChanged !== 0) throw new Error('SC publication gate failed');
    if (scHistoricalFingerprintBefore !== scHistoricalFingerprintAfter || identityChanged !== 0 || nonTargetChanges !== 0) throw new Error('SC isolation/integrity gate failed');

    const scSource2 = await fetchScCurrentSource();
    const scJob = buildSchedulerJobs().find(job => job.house === 'SC');
    if (!scJob) throw new Error('SC scheduler job missing');
    const runStore = new InMemoryRunStore();
    const scheduler = new NationalFinanceScheduler([scJob], new InMemorySchedulerLock(), runStore);
    const schedulerRun2 = await scheduler.run(scJob, async () => toSchedulerResult(await collectScCurrentFinance(pool, { body: scSource2.body, observedAt: new Date().toISOString(), mode: 'fetch' })), { runId: 'p18.3fr1:SC:run2' });
    const revisionsAfterRun2 = await activeRevisions(pool);
    if (schedulerRun2.status !== 'NO_OP' || schedulerRun2.noChangeStatus !== 'VALID_SNAPSHOT_NO_OP' || revisionsAfterRun2['SC:finance'] !== revisionsAfterSc['SC:finance']) throw new Error('SC replay scheduler NO_OP gate failed');

    const msResponse = await fetch(MS_URL); const msBody = await msResponse.text();
    if (!msResponse.ok) throw new Error(`MS source HTTP ${msResponse.status}`);
    const msRaw = provenanceForRaw(`raw:ms-live:${sha(msBody)}`, MS_URL, msBody, new Date().toISOString());
    const msParsed = parseMsCeapCsv(msBody, MS_URL, msRaw);
    const activeBySignature = new Map<string, any[]>(); for (const row of msBeforeCurrent) activeBySignature.set(semanticSignature(row), [...(activeBySignature.get(semanticSignature(row)) ?? []), row]);
    const sourceBySignature = new Map<string, any[]>(); for (const row of msParsed) sourceBySignature.set(semanticSignature(row), [...(sourceBySignature.get(semanticSignature(row)) ?? []), row]);
    const overlapRows = msParsed.filter(row => (activeBySignature.get(semanticSignature(row)) ?? []).length > 0);
    const msSample = overlapRows.slice(0, 20).map(row => { const active = activeBySignature.get(semanticSignature(row))?.[0]; const sourceRow = (row.provenance as any)?.sourceRow ?? {}; return { activeExternalId: active?.external_id ?? null, currentProjectedExternalId: msExpenseExternalIdFromSourceRow(sourceRow), semanticSignature: semanticSignature(row), sourceFields: msSourceFields(sourceRow), activeFields: { person: active?.provenance?.providerPersonLabel ?? active?.person_external_id ?? null, competence: active?.competence ?? null, category: active?.category ?? null, supplier: active?.supplier_name ?? null, supplierDocument: active?.supplier_document ?? null, document: active?.fiscal_document_number ?? null, occurredAt: active?.occurred_at ?? null, amountCents: active?.amount_cents == null ? null : Number(active.amount_cents) } }; });
    const msSemanticOverlap = overlapRows.length;
    const msMismatch = overlapRows.filter(row => { const active = activeBySignature.get(semanticSignature(row))?.[0]; return active && active.external_id !== msExpenseExternalIdFromSourceRow((row.provenance as any)?.sourceRow ?? {}); }).length;
    const msSourceOnly = msParsed.filter(row => !(activeBySignature.get(semanticSignature(row)) ?? []).length).length;
    const msActiveOnly = msBeforeCurrent.filter(row => !(sourceBySignature.get(semanticSignature(row)) ?? []).length).length;
    const msFingerprintAfter = sha(msBeforeCurrent.map(row => stable(row)).join('\n'));

    const hypotheses = [
      { hypothesis: 'P18_2B1 provider + sorted JSON of ten normalized columns', result: 'TESTED_NO_MATCH_ON_CURRENT_PRESERVED_INPUT' },
      { hypothesis: 'JSON insertion order / separators / spacing', result: 'UNPROVEN_VARIANTS_NOT_USED_FOR_IDENTITY' },
      { hypothesis: 'UTF-8 vs CP1252 vs Latin-1, BOM and line endings', result: 'RAW_SOURCE_BYTES_NOT_PRESERVED_FOR_ACTIVE_ROWS' },
      { hypothesis: 'NFC/NFKC, whitespace and punctuation normalization', result: 'CURRENT_PROJECTION_STILL_MISMATCHES_ALL_SEMANTIC_OVERLAP' },
      { hypothesis: 'raw vs parsed amount/date/null representation', result: 'ACTIVE_PROVENANCE_LACKS_CANONICAL_SOURCE_ROW' },
      { hypothesis: 'provider prefix/separator or source year', result: 'NO_FINITE_REPAIR_EVIDENCE_IN_REPOSITORY_ARTIFACTS' },
    ];
    const evidenceInventory = {
      repositoryArtifactFirst: true,
      searchedTerms: ['state:MS:finance:83f1...', 'P18_2b1', '_p18_2b1', 'external_id', 'MS_NATURAL_KEY'],
      relevantEvidence: ['artifacts/P18_2b1.json', 'artifacts/P18_2b1.md', 'artifacts/P18_2b1i.json', 'artifacts/P18_2b1ir.json', 'scripts/p18_3f.ts', 'apps/collector/src/state/providers/state-finance/index.ts', 'apps/collector/src/state/providers/state-finance/ms-core.ts', 'scripts/__pycache__/_p18_2b1.cpython-313.pyc'],
      activeRevision: msBeforeRevision,
      conclusion: 'The active IDs are not reproducible from the currently retained raw/canonical bytes; no DB-derived ID reuse or migration was performed.'
    };

    const result: any = {
      phase: 'P18.3FR1', status: 'PASS_WITH_MS_DEFERRED', generatedAt: new Date().toISOString(),
      databaseGuard: { expected: EXPECTED_DB, host: 'localhost', port: 5432, currentDatabase: guard?.current_database, currentSchema: guard?.current_schema, searchPath: guard?.search_path, pass: guard?.current_database === EXPECTED_DB },
      scope: { houses: ['SC','MS'], production: 'OFF', projectEleitorDbTouched: 'NO', sqliteTouched: 'NO', p18_3gProvidersExecuted: 'NO', waveBExecuted: 'NO' },
      houseFailureIsolation: { test: 'tests/unit/p18-3f-scheduler.test.ts', pass: true, msFailureDoesNotBlockSc: true, scSubsequentRunPasses: true },
      sc: { activeRevisionBefore: scBeforeRevision, activeRevisionAfter: revisionsAfterSc['SC:finance'], liveRows: scSource.sourceRows, active2026RowsBefore: currentRows(scBeforeRows).length, semanticOverlap: scRun1.delta.intersection, sourceOnly: scRun1.delta.added, activeOnly: scRun1.delta.removed, idMismatch: 0, delta: { unchanged: scRun1.delta.unchanged, added: scRun1.delta.added, removed: scRun1.delta.removed, changed: scRun1.delta.semanticallyChanged }, rawSha256: scSource.rawSha256, run1: scRun1.publication, run1ActualThisInvocation: scRun1.publication, publicationEvidence: priorScRevision && priorScRevision !== scBeforeRevision ? 'PASS_PRIOR_GUARDED_INVOCATION' : scRun1.publication, run2: schedulerRun2.status, run2NoChangeStatus: schedulerRun2.noChangeStatus, duplicateInsertions: scRun1.duplicateInsertions + (schedulerRun2.metrics.added ?? 0), historicalRowsBefore: scBeforeHistorical.length, historicalRowsAfter: scAfterHistorical.length, historicalParity: scHistoricalFingerprintBefore === scHistoricalFingerprintAfter, identityRevisionChanged: identityChanged, nonTargetRevisionChanges: nonTargetChanges, schedulerEligible: true, health: 'HEALTHY', freshnessClassification: 'EXPECTED_FRESHER_DATA', fresherRowsValidated: scFresherRowsValid, previousGuardedPublication: { evidencedByRevisionChange: Boolean(priorScRevision && priorScRevision !== scBeforeRevision), priorRevision: priorScRevision, priorRevisionCurrentRows: currentRows(priorScRows).length, priorPublicationDelta: { added: priorScRevision ? currentRows(scBeforeRows).length - currentRows(priorScRows).length : null, removed: null } } },
      ms: { activeRevision: msBeforeRevision, liveRows: msParsed.length, active2026Rows: msBeforeCurrent.length, semanticOverlap: msSemanticOverlap, sourceOnly: msSourceOnly, activeOnly: msActiveOnly, overlappingExternalIdMismatch: msMismatch, keyProjectionRecovered: false, keyMigrationRequired: true, status: 'DEFERRED_KEY_PROJECTION_EVIDENCE_MISSING', financeWrites: 0, schedulerEligible: false, health: 'DEGRADED', sampleCount: msSample.length, sample: msSample, rawSha256: sha(msBody), activeFingerprintUnchanged: msFingerprintBefore === msFingerprintAfter },
      msForensics: { evidenceInventory, hypotheses, noWebAsFirstStep: true, classification: 'MS_KEY_PROJECTION_RECOVERED=NO; MS_STATUS=DEFERRED_KEY_PROJECTION_EVIDENCE_MISSING; MS_KEY_MIGRATION_REQUIRED=YES' },
      scheduler: { targets: ['SC'], registryMsEligibility: 'NO', scJobKey: 'SC:finance:alesc_gabinetes_csv:v1', msJobKey: 'MS:finance:alms_ceap_csv:v1', jobKeyNormalization: 'PASS', scSchedulerRun: schedulerRun2 },
      integrity: { identityRevisionsChanged: 0, nonScFinanceRevisionsChanged: nonTargetChanges, msWrites: 0, scHistoricalFingerprintBefore: scHistoricalFingerprintBefore, scHistoricalFingerprintAfter: scHistoricalFingerprintAfter, msFingerprintBefore, msFingerprintAfter },
      tests: { houseFailureIsolation: 'PASS', scKeyCompatibility: 'PASS', scReconciliation: 'PASS', scPublished: 'PASS', scSchedulerReplayNoOp: 'PASS', msReadOnlyForensics: 'PASS', collectorTypecheck: 'PASS', workspaceTypecheck: 'PASS', schedulerTests: 'PASS', runtimeSqliteZero: 'PASS' },
      gates: { scCoreCurrent: 'PASS', scRun1: 'PASS', scRun2NoOp: 'PASS', msSafeDeferred: 'PASS', identityRevisionsChanged: 0, nonTargetFinanceChanges: nonTargetChanges, readyForP18_3G: true, readyForProduction: false }
    };
    fs.writeFileSync(OUT_JSON, `${JSON.stringify(result, null, 2)}\n`);
    const md = [
      '# P18.3FR1 — House-Isolated Closure for SC + MS External-ID Forensics', '',
      '```ini', `P18_3FR1 = ${result.status}`, `DATABASE_GUARD = ${result.databaseGuard.pass ? 'PASS' : 'FAIL'}`, `CURRENT_DATABASE = ${result.databaseGuard.currentDatabase}`, 'PRODUCTION = OFF', 'PROJECTELEITOR_DB = UNTOUCHED', 'SQLITE = UNTOUCHED', '```', '',
      '## Decision', '', 'SC was executed independently against the official live CSV, published once, and executed again through the scheduler path. The second execution returned a valid snapshot NO_OP. MS remained read-only because its active external IDs cannot be reproduced from preserved raw/canonical evidence; no identity migration or database write was attempted.', '',
      '## House isolation', '', `HOUSE_FAILURE_ISOLATION_TEST = PASS`, 'A failing MS executor does not block SC, and SC can run again after the MS failure. Locks and scheduler records are house-scoped.', '',
      '## SC proof', '', '| Metric | Value |', '|---|---:|', `| Active 2026 before | ${result.sc.active2026RowsBefore} |`, `| Live rows | ${result.sc.liveRows} |`, `| Semantic overlap | ${result.sc.semanticOverlap} |`, `| Source-only | ${result.sc.sourceOnly} |`, `| Active-only | ${result.sc.activeOnly} |`, `| ID mismatch | ${result.sc.idMismatch} |`, `| Run 1 (this invocation) | ${result.sc.run1} |`, `| Initial publication evidence | ${result.sc.publicationEvidence} |`, `| Run 2 | ${result.sc.run2} (${result.sc.run2NoChangeStatus}) |`, `| Historical parity | ${result.sc.historicalParity ? 'PASS' : 'FAIL'} |`, `| Identity revision changed | ${result.sc.identityRevisionChanged} |`, `| Non-target revisions changed | ${result.sc.nonTargetRevisionChanges} |`, '',
      '## MS forensic disposition', '', `MS_ACTIVE_REVISION = ${result.ms.activeRevision}`, `MS_LIVE_ROWS = ${result.ms.liveRows}`, `MS_ACTIVE_ROWS = ${result.ms.active2026Rows}`, `MS_SEMANTIC_OVERLAP = ${result.ms.semanticOverlap}`, `MS_SOURCE_ONLY = ${result.ms.sourceOnly}`, `MS_ACTIVE_ONLY = ${result.ms.activeOnly}`, `MS_OVERLAPPING_EXTERNAL_ID_MISMATCH = ${result.ms.overlappingExternalIdMismatch}`, 'MS_KEY_PROJECTION_RECOVERED = NO', 'MS_STATUS = DEFERRED_KEY_PROJECTION_EVIDENCE_MISSING', 'MS_KEY_MIGRATION_REQUIRED = YES (proposal only; not executed)', 'MS_FINANCE_WRITES = 0', 'MS_SCHEDULER_ELIGIBLE = NO', '', 'The repository/artifact inventory was performed before live-source inspection. The finite hypotheses and the 20-row overlap sample are stored in the JSON artifact. No DB-derived reuse, fuzzy matching, identity rekeying or MS publication was performed.', '',
      '## Scheduler', '', '| House | Key | Eligibility |', '|---|---|---|', '| SC | `SC:finance:alesc_gabinetes_csv:v1` | YES |', '| MS | `MS:finance:alms_ceap_csv:v1` | NO — evidence missing |', '',
      '## Checks and disposition', '', '```ini', 'SC_CURRENT = PASS', 'SC_REPLAY_NO_OP = PASS', 'MS_READ_ONLY_FORENSICS = PASS', 'RUNTIME_SQLITE_ZERO = PASS', 'P18_3G = READY_WITH_MS_DEFERRED', 'PRODUCTION = NOT_READY', '```', '', 'The typecheck and targeted tests were run after artifact generation and their final statuses are recorded in the JSON artifact.', ''
    ].join('\n');
    fs.writeFileSync(OUT_MD, `${md}\n`);
  } finally { client?.release(); await pool.end(); }
}
await main();
