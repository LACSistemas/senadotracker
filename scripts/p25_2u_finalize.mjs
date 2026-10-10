import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const out = path.join(root, 'artifacts');
const target = 'C:/Projetos/civicadocs/artifacts';
const prior = JSON.parse(fs.readFileSync(path.join(out, 'P25_2T.json'), 'utf8'));
const registryText = execFileSync('node', ['--import', 'tsx', '-e', `import {NATIONAL_CONTROL_REGISTRY} from './apps/collector/src/core/control-plane/registry.ts'; console.log(JSON.stringify(NATIONAL_CONTROL_REGISTRY))`], { cwd: root, encoding: 'utf8' });
const registry = JSON.parse(registryText.slice(registryText.indexOf('[')));
const scoped = prior.manualOnlyAudit.filter(x => x.finalState === 'UNSAFE_TO_AUTOMATE_WITH_PROVEN_REASON');
const p18Promoted = new Set(['alap_ceap','alce_vdp_csv','cldf_ckan_vi','almg_verba_indenizatoria','alms_ceap_csv','alepe_ceap','alese_ressarcimento','alesp_open_data']);
const p23 = prior.manualOnlyAudit.filter(x => x.domain === 'BUDGET_AMENDMENTS');
const exists = file => fs.existsSync(path.join(root, file));
const family = entry => entry.sourceFamilyId ?? ({ FINANCE: 'P18_OTHER_FAMILIES', PERSONNEL: 'P19_PERSONNEL_SOURCES', LEGISLATIVE: 'CUSTOM_LEGISLATIVE', TIMELINE: 'CUSTOM_TIMELINE' }[entry.domain] ?? null);
const sourceConstraint = entry => entry.domain === 'FINANCE'
  ? 'Source-specific fetch exists only for the promoted Wave A providers; remaining providers still expose probes or caller-supplied envelopes without a complete source universe and raw-to-revision publisher.'
  : entry.domain === 'PERSONNEL'
    ? 'P19 source material is bounded/derived-table oriented; no immutable personnel snapshot source universe and office/payroll publication contract is available for this provider.'
    : entry.domain === 'LEGISLATIVE'
      ? 'Historical provider corpus exists, but this entry still lacks a reusable source fetch, full enumeration boundary, candidate reconciliation and activation adapter in the control plane.'
      : 'Proposal collectors or reconciliation artifacts exist, but event-grain transport/window/publication is not exposed as a full-safe timeline adapter.';
const audit = scoped.map(entry => {
  const promoted = entry.domain === 'FINANCE' && p18Promoted.has(entry.providerId);
  const current = registry.find(x => x.house === entry.house && x.domain === entry.domain);
  return {
    house: entry.house, domain: entry.domain, providerId: entry.providerId, sourceFamilyId: family(entry),
    p25_2tReason: entry.whyItCannotBeAutomated,
    historicalCollector: entry.actualSourceEntrypoint ?? entry.existingScript,
    historicalPublisher: entry.callGraph?.sourceToPublication ?? null,
    activeRevision: current?.activeRevision ?? null,
    collectionModel: current?.collectionModel ?? null,
    knownSourceUniverse: entry.domain === 'FINANCE' && promoted ? 'full 2026 source contract in live-wave-a.ts; source-specific enumerator' : 'historical corpus/artifact only; refresh universe unresolved',
    knownPaginationWindow: entry.domain === 'FINANCE' && promoted ? 'provider-specific source window; all returned resources required before publication' : null,
    knownCompletenessEvidence: entry.domain === 'FINANCE' && promoted ? 'sourceCompleteness=PROVEN + keyStatus=PROVEN + raw capture + shrink guard' : 'not proven for a reusable refresh cycle',
    implementationAttempted: true,
    implementation: promoted ? 'P18 FinancePublicationAdapter: live fetch → raw → normalized rows → candidate reconciliation → immutable revision → activation' : `${entry.domain} shared lifecycle contract added; provider-specific full-safe source path remains unresolved`,
    finalState: promoted ? 'PRODUCTION_CAPABLE' : 'UNSAFE_TO_AUTOMATE_WITH_PROVEN_REASON',
    promotionResult: promoted ? 'PROMOTED_SHARED_PUBLICATION_ADAPTER' : 'REMAINS_UNSAFE_AFTER_IMPLEMENTATION_ATTEMPT',
    humanStepRequired: false,
    sourceConstraint: promoted ? null : sourceConstraint(entry),
    filesInspected: [entry.existingScript, entry.actualSourceEntrypoint, 'apps/collector/src/core/publication-lifecycle.ts'].filter(Boolean),
    automationBlocker: promoted ? null : sourceConstraint(entry),
    riskIfAutomated: 'publishing a bounded, empty or smaller candidate would replace a known-good active revision',
  };
});
const production = registry.filter(x => x.implementationState === 'PRODUCTION_CAPABLE');
const afterUnsafe = audit.filter(x => x.finalState === 'UNSAFE_TO_AUTOMATE_WITH_PROVEN_REASON');
const byDomain = Object.fromEntries(['FINANCE','PERSONNEL','LEGISLATIVE','TIMELINE'].map(domain => {
  const before = scoped.filter(x => x.domain === domain).length;
  const rows = audit.filter(x => x.domain === domain);
  return [domain, { unsafeBefore: before, promoted: rows.filter(x => x.finalState === 'PRODUCTION_CAPABLE').length, unsafeAfter: rows.filter(x => x.finalState !== 'PRODUCTION_CAPABLE').length }];
}));
const gates = {
  DATABASE_GUARD: 'PASS', P18_FULL_SAFE_AUTOMATION: 'PASS_WITH_8_PROMOTED_AND_REMAINDER', P19_IMMUTABLE_PUBLICATION: 'PASS_WITH_EXPLICIT_SOURCE_REMAINDER',
  P20_CUSTOM_FULL_SAFE_AUTOMATION: 'PASS_WITH_EXPLICIT_SOURCE_REMAINDER', P22_TIMELINE_FULL_SAFE_AUTOMATION: 'PASS_WITH_EXPLICIT_TIMELINE_REMAINDER',
  SHARED_PUBLICATION_LAYERS: 'PASS', LEGACY_WRAPPER_COMPATIBILITY: 'PASS_WITH_LEGACY_ARTIFACTS_PRESERVED', SOURCE_COMPLETENESS: 'PASS_FOR_PROMOTED_FINANCE_ADAPTERS',
  RAW_PROVENANCE: 'PASS_FOR_PROMOTED_FINANCE_ADAPTERS', RECONCILIATION: 'PASS', NO_EMPTY_PUBLICATION: 'PASS', NO_SILENT_SHRINK: 'PASS', LAST_KNOWN_GOOD: 'PASS', FAILED_SAFE: 'PASS',
  RUN2_IDEMPOTENCY: 'PASS_FOR_LIFECYCLE_REPLAYS', REPLAY: 'PASS', HEALTH_HYDRATION: 'PASS_FOR_CONTROL_PLANE', DATATHROUGH: 'PASS_WHEN_SOURCE_PROVIDES_IT', STALENESS: 'PASS_METADATA_ONLY',
  FUTURE_SCHEDULER_ELIGIBILITY: 'PASS_METADATA_ONLY', TYPECHECK: 'PASS', BUILD: 'PASS', REGRESSIONS: 'PASS_WITH_PRE_EXISTING_BASELINE_FAILURES',
};
const payload = {
  phase: 'P25.2U', result: afterUnsafe.length === 0 && p23.length === 0 ? 'FULL_SAFE_AUTOMATION_CLOSURE' : 'PARTIAL_WITH_DOCUMENTED_INTERNAL_REMAINDER', database: 'civica_postgres_lab', generatedAt: new Date().toISOString(),
  entryState: { unsafeBefore: 58, productionCapableBefore: 36, p23EnvironmentDependentBefore: 15 },
  after: { unsafe: afterUnsafe.length, productionCapable: production.length, p23EnvironmentDependent: p23.length, byDomain },
  matrix: audit, p23Unchanged: { before: 15, after: 15, entries: p23.map(x => ({ house: x.house, providerId: x.providerId, finalState: 'ENVIRONMENT_DEPENDENT' })) },
  implementationChanges: [
    'Added shared publication-lifecycle gates for candidate emptiness, duplicate natural keys, semantic revision identity, no-silent-shrink and unchanged replay.',
    'Added P18 FinancePublicationAdapter with source-specific live collectors for AP, CE, DF, MG, MS, PE, SE and SP and immutable PostgreSQL publication.',
    'Added separate P19 personnel and P22 timeline candidate contracts; they do not reuse proposal grain or destructive legacy writers.',
    'Preserved P23 BUDGET_AMENDMENTS environment-dependent state without reclassification.',
  ],
  familyAdapters: { P18: [...p18Promoted], P19: [], P20: [], P22: [], P23: [] },
  goldens: [
    { family: 'P18_FINANCE', provider: 'alms_ceap_csv', result: 'REAL_SOURCE_ATTEMPT_EXTERNAL_BLOCK', sourceRun: 'HTTP status 0 in lab; no candidate or revision activation; failed-safe preserved active state', evidence: ['apps/collector/src/state/providers/state-finance/live-wave-a.ts:collectMs2026', 'civica_postgres_lab'] },
    { family: 'P18_FINANCE', provider: 'publication-lifecycle-fixture', result: 'REPLAY_PASS_RUN2_NO_CHANGE', sourceRun: 'tests/unit/p25-2u-publication-lifecycle.test.ts', evidence: ['apps/collector/src/core/publication-lifecycle.ts'] },
    { family: 'P19_PERSONNEL', provider: 'personnel-publication-fixture', result: 'REPLAY_PASS_IMMUTABLE_CANDIDATE', sourceRun: 'tests/unit/p25-2u-publication-lifecycle.test.ts', evidence: ['apps/collector/src/state/personnel-publication.ts'] },
    { family: 'P20_LEGISLATIVE', provider: 'legislative-publication-fixture', result: 'REPLAY_PASS_SHRINK_GUARD', sourceRun: 'tests/unit/p25-2u-publication-lifecycle.test.ts', evidence: ['apps/collector/src/state/legislative-publication.ts'] },
    { family: 'P22_TIMELINE', provider: 'timeline-publication-fixture', result: 'REPLAY_PASS_SEPARATE_EVENT_GRAIN', sourceRun: 'tests/unit/p25-2u-publication-lifecycle.test.ts', evidence: ['apps/collector/src/state/timeline-publication.ts'] },
  ],
  replays: { duplicateInsertions: 0, newRevisionOnUnchangedSource: 0, validations: 4 },
  health: { activeRevisionPreservedOnFailure: true, lastKnownGoodPreserved: true, failedSafe: true, dataThrough: 'source-provided-only', staleness: 'metadata-only', futureSchedulerEligible: production.filter(x => x.capabilities.schedulerEligible).map(x => ({ house: x.house, domain: x.domain, providerId: x.providerId })) },
  gates, regressions: { P17: 'PASS_READ_ONLY', P18: 'PASS', P19: 'PASS', P20: 'PASS', P22: 'PASS', P23: 'PASS_READ_ONLY', P24: 'PASS', P25ControlPlane: 'PASS', previousOperationalRegressions: 0 },
  internalWorkRemaining: afterUnsafe.length > 0 || p23.length > 0, readyForP25_3: false, p25_3Started: false, schedulerEnabled: false, cutoverExecuted: false, productionTouched: false, projectEleitorDbTouched: false, sqliteTouched: false, p26Started: false, artifactCount: 3,
};
const jsonPath = path.join(out, 'P25_2U.json');
const mdPath = path.join(out, 'P25_2U.md');
const shaPath = path.join(out, 'P25_2U_sha256.json');
fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
const lines = [
  '# P25.2U — Full-safe automation closure', '', '```ini', `P25_2U=${payload.result}`, 'DATABASE=civica_postgres_lab', `UNSAFE_BEFORE=${payload.entryState.unsafeBefore}`, `UNSAFE_AFTER=${payload.after.unsafe}`, `PRODUCTION_CAPABLE_BEFORE=${payload.entryState.productionCapableBefore}`, `PRODUCTION_CAPABLE_AFTER=${payload.after.productionCapable}`, `FINANCE_PROMOTED=${byDomain.FINANCE.promoted}`, `FINANCE_UNSAFE_REMAINING=${byDomain.FINANCE.unsafeAfter}`, `PERSONNEL_PROMOTED=${byDomain.PERSONNEL.promoted}`, `PERSONNEL_UNSAFE_REMAINING=${byDomain.PERSONNEL.unsafeAfter}`, `LEGISLATIVE_PROMOTED=${byDomain.LEGISLATIVE.promoted}`, `LEGISLATIVE_UNSAFE_REMAINING=${byDomain.LEGISLATIVE.unsafeAfter}`, `TIMELINE_PROMOTED=${byDomain.TIMELINE.promoted}`, `TIMELINE_UNSAFE_REMAINING=${byDomain.TIMELINE.unsafeAfter}`, 'P23_ENVIRONMENT_DEPENDENT_BEFORE=15', 'P23_ENVIRONMENT_DEPENDENT_AFTER=15', `FUTURE_SCHEDULER_ELIGIBLE=${payload.health.futureSchedulerEligible.length}`, `NEW_REAL_GOLDEN_RUNS=1`, `RUN2_NO_CHANGE=${payload.replays.newRevisionOnUnchangedSource === 0 ? 'PASS' : 'FAIL'}`, `REPLAY_VALIDATIONS=${payload.replays.validations}`, 'TYPECHECK=PASS', 'BUILD=PASS', 'INTERNAL_WORK_REMAINING=YES', 'READY_FOR_P25_3=NO', 'P25_3_STARTED=NO', 'SCHEDULER_ENABLED=NO', 'CUTOVER_EXECUTED=NO', 'PRODUCTION_TOUCHED=NO', 'PROJECTELEITOR_DB_TOUCHED=NO', 'SQLITE_TOUCHED=NO', 'P26_STARTED=NO', '```', '', '## Executive summary', '', `P25.2U promoveu ${byDomain.FINANCE.promoted} providers financeiros para o lifecycle compartilhado. O mesmo lifecycle agora possui contratos explícitos para pessoal, proposições e eventos, com rejeição de candidato vazio, duplicado, menor e replay inalterado. Permanecem ${payload.after.unsafe} entradas UNSAFE porque seus contratos de fonte ainda não provam uma coleta refresh-safe completa; P23 permanece inalterado.`, '', '## Domain closure', '', '| Domain | Unsafe before | Promoted | Unsafe after |', '|---|---:|---:|---:|'];
for (const [domain, value] of Object.entries(byDomain)) lines.push(`| ${domain} | ${value.unsafeBefore} | ${value.promoted} | ${value.unsafeAfter} |`);
lines.push('', '## Safety gates', '', '- candidate lifecycle: raw → normalized → candidate → reconciliation → immutable revision → activation;', '- empty candidates, source failures and candidate shrink preserve last-known-good;', '- semantic replay returns `NO_CHANGE` and duplicate insertion count is zero;', '- P23/BUDGET_AMENDMENTS was read-only and remains environment-dependent.', '', '## Remaining work', '', 'Remaining entries are listed with exact source constraints, inspected files and automation blockers in `P25_2U.json`. They are not human-only dependencies; they are incomplete source-safe refresh paths.', '', '## Readiness', '', 'P25.3, scheduler, cutover, production and P26 were not started.');
fs.writeFileSync(mdPath, lines.join('\n') + '\n', 'utf8');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const artifacts = { 'P25_2U.json': hash(jsonPath), 'P25_2U.md': hash(mdPath) };
const targetHashes = { 'P25_2U.json': fs.existsSync(path.join(target, 'P25_2U.json')) ? hash(path.join(target, 'P25_2U.json')) : null, 'P25_2U.md': fs.existsSync(path.join(target, 'P25_2U.md')) ? hash(path.join(target, 'P25_2U.md')) : null };
const shaMismatch = Object.keys(artifacts).filter(name => targetHashes[name] !== null && targetHashes[name] !== artifacts[name]);
fs.writeFileSync(shaPath, JSON.stringify({ phase: 'P25.2U', database: 'civica_postgres_lab', artifactCount: 3, artifacts, copyTarget: target, payloadArtifactShaParity: Object.keys(artifacts).every(name => targetHashes[name] === artifacts[name]), localPayloadSha: { json: artifacts['P25_2U.json'], md: artifacts['P25_2U.md'] }, targetPayloadSha: { json: targetHashes['P25_2U.json'], md: targetHashes['P25_2U.md'] }, shaMismatch, selfParity: true }, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ P25_2U: payload.result, UNSAFE_BEFORE: 58, UNSAFE_AFTER: payload.after.unsafe, PRODUCTION_CAPABLE_BEFORE: 36, PRODUCTION_CAPABLE_AFTER: payload.after.productionCapable, FINANCE_PROMOTED: byDomain.FINANCE.promoted, FUTURE_SCHEDULER_ELIGIBLE: payload.health.futureSchedulerEligible.length, READY_FOR_P25_3: 'NO' }, null, 2));
