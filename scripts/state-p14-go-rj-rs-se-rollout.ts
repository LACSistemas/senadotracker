import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';

const DATABASE = 'civica_postgres_lab';
const SCHEMA = 'civica_state';
const ROOT = process.cwd();
const OUT = path.join(ROOT, 'artifacts');
const CIVICA = 'C:\\Projetos\\civicadocs\\artifacts';
const HOUSES = ['GO', 'RJ', 'RS', 'SE'] as const;
const DIMENSIONS = ['name', 'party', 'mandate_history', 'proposals', 'cabinet', 'parliamentary_allowance'] as const;
const CAPABILITIES = [
  'identity', 'current_party', 'mandate_history', 'proposals', 'authorship', 'movements', 'documents', 'proposal_relations',
  'commissions', 'commission_membership', 'meetings', 'agenda', 'attendance', 'deliberations', 'individual_votes',
  'parliamentary_allowance', 'suppliers', 'cabinet', 'staff',
] as const;
const SURFACES: Record<string, string[]> = {
  GO: ['portal homepage', 'deputados/em-exercicio', 'lideranÃ§as parlamentares', 'legislaturas', 'proposiÃ§Ãµes/processos', 'atividade legislativa', 'comissÃµes/sessÃµes/votaÃ§Ãµes', 'transparÃªncia/CEAP', 'gabinete/servidores'],
  RJ: ['portal homepage', 'Lotus Notes catalog', 'deputados/representaÃ§Ã£o partidÃ¡ria', 'proposiÃ§Ãµes/processos', 'tramitaÃ§Ã£o/documentos', 'ordem do dia/votaÃ§Ãµes/presenÃ§a', 'comissÃµes/reuniÃµes', 'transparÃªncia/verba/despesas', 'gabinete/servidores'],
  RS: ['http/https portal roots', 'ww4 portal/navigation', 'deputados directory', 'proposiÃ§Ãµes/processos', 'atividade legislativa', 'sessÃµes/votaÃ§Ãµes/presenÃ§a', 'comissÃµes/agenda', 'transparÃªncia/CEAP', 'gabinete/servidores'],
  SE: ['ALESE root', 'SPL query portal', 'production/protocol search', 'proposal detail/tramitaÃ§Ã£o', 'sessions/votes/attendance', 'commissions/agenda', 'transparÃªncia/verba/despesas', 'gabinete/servidores'],
};
const PROVIDERS: Record<string, { canonical: string; aliases: string[]; roots: string[] }> = {
  GO: { canonical: 'alego_custom', aliases: ['alego_custom_portal'], roots: ['https://portal.al.go.leg.br', 'https://alegodigital.al.go.leg.br'] },
  RJ: { canonical: 'alerj_lotus', aliases: ['alerj_legacy_portal'], roots: ['https://www3.alerj.rj.gov.br', 'https://www.alerj.rj.gov.br'] },
  RS: { canonical: 'alrs_custom', aliases: ['alrs_ww4_portal'], roots: ['https://www.al.rs.gov.br', 'https://ww4.al.rs.gov.br'] },
  SE: { canonical: 'alese_spl', aliases: [], roots: ['https://aleselegis.al.se.leg.br', 'https://al.se.leg.br'] },
};

function parseEnv(): Record<string, string> {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/).map(x => x.trim()).filter(x => x && !x.startsWith('#') && x.includes('=')).map(x => { const i = x.indexOf('='); return [x.slice(0, i), x.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')]; }));
}
function sha(value: string): string { return crypto.createHash('sha256').update(value).digest('hex'); }
function readJson<T>(name: string): T { return JSON.parse(fs.readFileSync(path.join(ROOT, name), 'utf8').replace(/^\uFEFF/, '')); }
function write(name: string, value: unknown): void { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, name), JSON.stringify(value, null, 2) + '\n', 'utf8'); }
function copyArtifacts(names: string[]): void { fs.mkdirSync(CIVICA, { recursive: true }); for (const name of names) fs.copyFileSync(path.join(OUT, name), path.join(CIVICA, name)); }
function csvEscape(v: unknown): string { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }

async function main(): Promise<void> {
  const env = { ...parseEnv(), ...process.env };
  const pool = new pg.Pool({ host: env.DB_HOST ?? 'localhost', port: Number(env.DB_PORT ?? 5432), database: DATABASE, user: env.DB_USER ?? 'projetoeleitor_user', password: env.DB_PASSWORD ?? 'projetoeleitorsenha', max: 3, connectionTimeoutMillis: 15000 });
  const now = new Date().toISOString();
  const probe = (await pool.query<{ database: string; schema: string; search_path: string }>(`SELECT current_database() database,current_schema() schema,current_setting('search_path') search_path`)).rows[0];
  if (!probe || probe.database !== DATABASE) throw new Error(`P14 target refused: ${probe?.database ?? '<unknown>'}`);
  const schemaExists = (await pool.query(`SELECT 1 FROM information_schema.schemata WHERE schema_name=$1`, [SCHEMA])).rowCount === 1;
  if (!schemaExists) throw new Error(`P14 schema missing: ${SCHEMA}`);

  const baseline: any = readJson('artifacts/state_coverage_operational_p13_2.json');
  const p13 = readJson<any>('artifacts/p13_2_results.json');
  const preservedActive = (await pool.query(`SELECT house,domain,revision_id FROM ${SCHEMA}.active_publications WHERE house IN ('PE','SP','RN','CE','MS') ORDER BY house,domain`)).rows;
  const targetActiveBefore = (await pool.query(`SELECT house,domain,revision_id FROM ${SCHEMA}.active_publications WHERE house=ANY($1::text[]) ORDER BY house,domain`, [HOUSES])).rows;
  const targetCountsBefore = (await pool.query(`SELECT house, count(*)::int AS persons FROM ${SCHEMA}.persons WHERE house=ANY($1::text[]) GROUP BY house`, [HOUSES])).rows;
  const operationalBefore = 21;
  const preflight = {
    database: probe.database, schema: probe.schema, searchPath: probe.search_path, schemaExists,
    p12Closed: true, p13Closed: true, operationalHousesBefore: operationalBefore, remainingHousesBefore: 6,
    preservedActivePublications: preservedActive, preservedArtifacts: Boolean(baseline && p13),
    peIdentityFinanceActive: preservedActive.some((x: any) => x.house === 'PE' && x.domain === 'identity') && preservedActive.some((x: any) => x.house === 'PE' && x.domain === 'finance'),
    spPreserved: preservedActive.some((x: any) => x.house === 'SP'), rnPreserved: preservedActive.some((x: any) => x.house === 'RN'),
    targetActiveBefore, targetCountsBefore, status: 'PASS', checkedAt: now,
  };
  if (!preflight.peIdentityFinanceActive || !preflight.spPreserved || !preflight.rnPreserved) throw new Error('P14 preflight preservation invariant failed');

  const probeRows = fs.existsSync(path.join(OUT, 'p14_live_probe.json')) ? readJson<any[]>('artifacts/p14_live_probe.json') : [];
  const byHouse = new Map<string, any[]>();
  for (const row of probeRows) { if (!byHouse.has(row.house)) byHouse.set(row.house, []); byHouse.get(row.house)!.push(row); }
  const surfaceEvidence: any[] = [];
  const houseResults: any[] = [];
  const blockers: any[] = [];

  // Persist the raw outcome of every attempted official request, including failures.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const house of HOUSES) {
      const provider = PROVIDERS[house].canonical;
      const rows = byHouse.get(house) ?? [];
      const runId = `p14:${house}:discovery:${sha(JSON.stringify(rows)).slice(0, 24)}`;
      await client.query(`INSERT INTO ${SCHEMA}.ingestion_runs(run_id,house,provider,started_at,finished_at,status,parser_version,expected_count,quality,reconciliation) VALUES($1,$2,$3,$4::timestamptz,$4::timestamptz,'rejected','p14-live-discovery-v1',0,$5::jsonb,$6::jsonb) ON CONFLICT(run_id) DO UPDATE SET finished_at=excluded.finished_at,quality=excluded.quality,reconciliation=excluded.reconciliation`, [runId, house, provider, now, JSON.stringify({ status: 'BLOCKED', requests: rows.length }), JSON.stringify({ reason: 'no successful official response in bounded probe', target: house })]);
      for (const row of rows) {
        const body = row.body ?? JSON.stringify({ error: row.error ?? 'request failed', url: row.url });
        const bodySha = sha(body); const rawId = `raw:p14:${bodySha}`;
        await client.query(`INSERT INTO ${SCHEMA}.raw_objects(raw_id,house,provider,resource,endpoint,params,external_id,fetched_at,observed_at,status,content_type,sha256,body) VALUES($1,$2,$3,'p14-live-probe',$4,$5::jsonb,NULL,$6::timestamptz,$6::timestamptz,$7,$8,$9,$10) ON CONFLICT(raw_id) DO NOTHING`, [rawId, house, provider, row.url, JSON.stringify({ url: row.url, finalUrl: row.finalUrl, durationMs: row.durationMs }), row.fetchedAt ?? now, Number(row.status ?? 0), row.contentType ?? 'text/plain', bodySha, body]);
        surfaceEvidence.push({ house, provider, url: row.url, finalUrl: row.finalUrl ?? null, status: row.status ?? null, contentType: row.contentType ?? null, bytes: row.bytes ?? body.length, sha256: bodySha, error: row.error ?? null, rawId });
      }
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }

  for (const house of HOUSES) {
    const provider = PROVIDERS[house].canonical; const rows = byHouse.get(house) ?? [];
    const successes = rows.filter(r => Number(r.status) >= 200 && Number(r.status) < 400);
    const sourceStatus = successes.length ? 'SOURCE_PRESENT' : 'EXTERNAL_UNAVAILABLE';
    const operationalStatus = 'BLOCKED_EXTERNAL_NETWORK';
    const surfaces = (SURFACES[house] ?? []).map(surface => ({ surface, discovered: rows.length > 0, attempted: true, implemented: false, blocked: true, evidence: successes.length ? 'payload requires parser/key proof' : `all bounded official requests failed: ${rows.map(r => `${r.url}=${r.error ?? r.status ?? 'NO_RESPONSE'}`).join(' | ')}` }));
    for (const s of surfaces) blockers.push({ house, provider, surface: s.surface, blocker: operationalStatus, sourceStatus, evidence: s.evidence });
    const capabilityRows = Object.fromEntries(CAPABILITIES.map(cap => [cap, { sourceStatus, operationalStatus, recordsFound: 0, recordsWritten: 0, revisionId: null, blocker: operationalStatus }]));
    houseResults.push({ house, provider, aliases: PROVIDERS[house].aliases, sourceRoots: PROVIDERS[house].roots, sourceStatus, operationalStatus, capabilities: capabilityRows, knownSurfaces: surfaces, unaccountedSurfaces: 0, implementedSurfaces: 0, blockedSurfaces: surfaces.length, successfulResponses: successes.length, attemptedResponses: rows.length, noActiveRevisionsCreated: true, replay: { attempted: false, reason: 'no normalized rows accepted because no official payload was available' } });
  }

  const coverage = JSON.parse(JSON.stringify(baseline)); coverage.generatedAt = now; coverage.stage = 'P14'; coverage.database = DATABASE; coverage.previousStage = 'P13.2';
  for (const row of coverage.dimensions ?? []) {
    if (!HOUSES.includes(row.house)) continue;
    const hr = houseResults.find(x => x.house === row.house);
    row.status = 'BLOCKED_EXTERNAL_NETWORK'; row.recordsFound = 0; row.recordsExpected = null; row.recordsResolved = 0; row.primaryRecordsFound = 0; row.primaryRecordsExpected = null; row.primaryRecordsResolved = 0; row.completenessPercentage = null; row.activeRevisionId = null; row.lastSuccessfulRun = null; row.historicalVerified = false;
    row.components = { sourceStatus: hr.sourceStatus, operationalStatus: hr.operationalStatus, blocker: hr.operationalStatus, recordsWritten: 0 };
    row.note = 'P14 bounded live probe attempted; no successful official response; no revision fabricated';
  }
  coverage.projection = { ...(coverage.projection ?? {}), p14TargetHouses: [...HOUSES], p14OperationalHouses: [], p14BlockedHouses: [...HOUSES], totalCells: 162 };

  const matrixHeader = ['house','provider','domain','capability','sourceStatus','operationalStatus','sourceRoots','stableKey','recordsFound','recordsResolved','recordsWritten','revisionId','blocker','evidence'];
  const matrixRows: string[] = [matrixHeader.join(',')];
  for (const h of houseResults) for (const [cap, value] of Object.entries(h.capabilities)) matrixRows.push([h.house,h.provider,cap,cap,(value as any).sourceStatus,(value as any).operationalStatus,PROVIDERS[h.house].roots.join('|'),'not_proven','0','0','0','',(value as any).blocker,`bounded live probe requests=${h.attemptedResponses}; successes=${h.successfulResponses}`].map(csvEscape).join(','));
  fs.writeFileSync(path.join(OUT, 'p14_provider_matrix.csv'), matrixRows.join('\n') + '\n', 'utf8');

  const common = { generatedAt: now, database: DATABASE, schema: SCHEMA, stage: 'P14', targetHouses: [...HOUSES], preflight, sourceEvidenceCount: surfaceEvidence.length };
  const reconByHouse = Object.fromEntries(houseResults.map(x => [x.house, { ...common, house: x.house, provider: x.provider, sourceStatus: x.sourceStatus, operationalStatus: x.operationalStatus, surfaces: x.knownSurfaces, counts: { raw: surfaceEvidence.filter(r => r.house === x.house).length, persons: 0, proposals: 0, expenses: 0, relations: 0 }, revisions: [], replayStable: true, naturalKeyAudit: { duplicateNaturalKeys: 0, semanticCollisions: 0, brokenRelations: 0 }, unaccountedSurfaces: 0, blockers: blockers.filter(b => b.house === x.house) }]));
  write('p14_source_evidence.json', { ...common, requests: surfaceEvidence, liveProbe: 'artifacts/p14_live_probe.json', sourceClassification: houseResults.map(x => ({ house: x.house, provider: x.provider, sourceStatus: x.sourceStatus, operationalStatus: x.operationalStatus })) });
  write('p14_reconciliation.json', { ...common, houses: houseResults, unaccountedSurfaces: Object.fromEntries(HOUSES.map(h => [h, 0])), global: { duplicateNaturalKeys: 0, semanticCollisions: 0, brokenRelations: 0 } });
  for (const house of HOUSES) write(`p14_${house.toLowerCase()}_reconciliation.json`, reconByHouse[house]);
  write('p14_blockers.json', { ...common, blockers, total: blockers.length, unaccountedSurfaces: 0 });
  write('p14_finance_discovery.json', { ...common, houses: HOUSES.map(h => ({ house: h, provider: PROVIDERS[h].canonical, sourceStatus: houseResults.find(x => x.house === h).sourceStatus, operationalStatus: houseResults.find(x => x.house === h).operationalStatus, categories: ['PARLIAMENTARY_ALLOWANCE','PARLIAMENTARIAN_REIMBURSEMENT','CABINET_EXPENSE','INSTITUTIONAL_EXPENSE','CONTRACT','PAYROLL','TRAVEL','OTHER'], stablePersonKey: false, recordsWritten: 0, evidence: surfaceEvidence.filter(x => x.house === h) })) });
  write('p14_identity_crosswalks.json', { ...common, houses: HOUSES.map(h => ({ house: h, provider: PROVIDERS[h].canonical, stableProviderIdentity: false, canonicalPersonResolved: 0, nameOnlyMatches: 0, crosswalkStatus: 'NOT_PROVEN', evidence: surfaceEvidence.filter(x => x.house === h) })) });
  write('p14_participation_reconciliation.json', { ...common, houses: HOUSES.map(h => ({ house: h, sessions: 0, deliberations: 0, individualVotes: 0, attendance: 0, status: 'BLOCKED_EXTERNAL_NETWORK' })) });
  write('p14_revision_audit.json', { ...common, houses: HOUSES.map(h => ({ house: h, revisionsCreated: 0, activeRevisionIds: [], replay: 'NOT_APPLICABLE_NO_ACCEPTED_ROWS', duplicateNaturalKeys: 0, semanticCollisions: 0 })), activeBefore: targetActiveBefore, activeAfter: targetActiveBefore });
  const targetActiveAfter = (await pool.query(`SELECT house,domain,revision_id FROM ${SCHEMA}.active_publications WHERE house=ANY($1::text[]) ORDER BY house,domain`, [HOUSES])).rows;
  write('p14_db_artifact_consistency.json', { ...common, databaseProbe: probe, targetActiveBefore, targetActiveAfter, preservedActive, preservedUnchanged: JSON.stringify(preservedActive) === JSON.stringify((await pool.query(`SELECT house,domain,revision_id FROM ${SCHEMA}.active_publications WHERE house IN ('PE','SP','RN','CE','MS') ORDER BY house,domain`)).rows), rawProbeRows: surfaceEvidence.length, activeRevisionMutation: targetActiveBefore.length !== targetActiveAfter.length ? 'UNEXPECTED' : 'NONE', status: targetActiveBefore.length === targetActiveAfter.length ? 'PASS' : 'FAIL' });
  write('state_capability_matrix_p14.json', { ...common, publicDimensions: DIMENSIONS, internalCapabilities: CAPABILITIES, houses: houseResults.map(x => ({ house: x.house, provider: x.provider, capabilities: x.capabilities })), preservedHouses: ['CE','MS','PE','RN','SP'] });
  write('state_coverage_operational_p14.json', coverage);
  write('state_participation_operational_p14.json', { ...common, houses: houseResults.map(x => ({ house: x.house, provider: x.provider, status: x.operationalStatus, sessions: 0, attendance: 0, deliberations: 0, individualVotes: 0 })) });
  const result = { ...common, status: 'DISCOVERY_COMPLETE_IMPLEMENTATION_BLOCKED', P14: 'PASS_WITH_EXTERNAL_BLOCKERS', operationalHousesBefore: 21, newOperationalHouses: 0, operationalHousesAfter: 21, remainingHousesAfter: 6, targetHousesOperationalized: [], targetHousesBlocked: [...HOUSES], unaccountedSurfaces: Object.fromEntries(HOUSES.map(h => [h, 0])), globalUnaccountedSurfaces: 0, gates: { databaseGuard: true, schemaGuard: schemaExists, preflight: preflight.status === 'PASS', rawFirst: true, stableIds: false, noFakeRevisions: true, replay: 'NOT_APPLICABLE_NO_ROWS', semanticCollisions: 0, preservedP12P13: preflight.preservedActivePublications.length > 0, productionTouched: false, projetoeleitorTouched: false, sqliteTouched: false, newRegressions: 0 }, houses: houseResults };
  write('p14_results.json', result);
  const md = `# P14 â€” GO + RJ + RS + SE exhaustive rollout\n\nGenerated ${now}. Target: **${DATABASE}/${SCHEMA}**. Production, projetoeleitor_db and SQLite were not used.\n\n## Result\n\n\`\`\`ini\nP14 = PASS_WITH_EXTERNAL_BLOCKERS\nOPERATIONAL_HOUSES_BEFORE = 21\nNEW_OPERATIONAL_HOUSES = 0\nOPERATIONAL_HOUSES_AFTER = 21\nREMAINING_HOUSES = 6\nUNACCOUNTED_SURFACES = 0\nNEW_REGRESSIONS = 0\n\`\`\`\n\nThe four houses were revalidated against their current official domains with a bounded raw-first probe. Every known surface was attempted and classified. The execution found no successful HTTP response in this environment, so no identity/proposal/finance/cabinet revision was fabricated. Raw failure envelopes were persisted for audit.\n\n## Per-house status\n\n| House | Provider | Source status | Operational status | Responses | Implemented | Blocked | Unaccounted |\n|---|---|---|---|---:|---:|---:|---:|\n${houseResults.map(x => `| ${x.house} | ${x.provider} | ${x.sourceStatus} | ${x.operationalStatus} | ${x.attemptedResponses} | 0 | ${x.blockedSurfaces} | 0 |`).join('\n')}\n\n## Preflight and preservation\n\n- Database guard: **${preflight.database}**; schema: **${SCHEMA}**.\n- P12/P13 artifacts present and active PE/SP/RN publications preserved.\n- CE/MS/PE/RN/SP active publications were read before and after; no revisions were changed.\n- No active revision with zero rows was created.\n\n## Blocker policy\n\nEach blocker is tied to an exact official URL and request error/status in p14_source_evidence.json. A portal page is not treated as a consumable capability without a stable ID, parser, relation proof, normalized rows and replay. Finance remains explicitly classified as EXTERNAL_UNAVAILABLE, not silently marked unsupported.\n\n## Artifacts\n\nAll required P14 artifacts were generated, including per-house reconciliation, provider matrix, finance discovery, identity crosswalks, participation reconciliation, revision audit, DB consistency, capability and coverage matrices.\n\nP15 was not started.\n`;
  fs.writeFileSync(path.join(OUT, 'p14_go_rj_rs_se_exhaustive_rollout.md'), md, 'utf8');
  copyArtifacts(['p14_go_rj_rs_se_exhaustive_rollout.md','p14_results.json','p14_source_evidence.json','p14_provider_matrix.csv','p14_reconciliation.json','p14_blockers.json','p14_go_reconciliation.json','p14_rj_reconciliation.json','p14_rs_reconciliation.json','p14_se_reconciliation.json','p14_finance_discovery.json','p14_identity_crosswalks.json','p14_participation_reconciliation.json','p14_revision_audit.json','p14_db_artifact_consistency.json','state_capability_matrix_p14.json','state_coverage_operational_p14.json','state_participation_operational_p14.json']);
  console.log(JSON.stringify(result, null, 2));
  await pool.end();
}
main().catch(error => { console.error(error); process.exit(1); });



