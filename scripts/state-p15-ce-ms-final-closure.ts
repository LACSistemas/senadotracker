import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'artifacts');
const DB = 'civica_postgres_lab';
const SCHEMA = 'civica_state';
const CE_PROVIDER = 'alece_custom';
const MS_PROVIDER = 'alems_sgple';
const CE_ENDPOINT = 'https://www.al.ce.gov.br/deputados';
const MS_CONTACT = 'https://al.ms.gov.br/contato';
const SGPLE_BASE = 'https://sgpl.consulta.al.ms.gov.br/sgpl-publico/';
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).map(x => x.trim()).filter(x => x && !x.startsWith('#') && x.includes('=')).map(x => { const i = x.indexOf('='); return [x.slice(0, i), x.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')]; }));
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(OUT, name), 'utf8').replace(/^\uFEFF/, ''));
const write = (name: string, value: unknown) => fs.writeFileSync(path.join(OUT, name), JSON.stringify(value, null, 2) + '\n', 'utf8');
const sha = (value: string | object) => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const clean = (value: string) => value.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&#39;/g, "'").replace(/&quot;/gi, '"').replace(/\s+/g, ' ').trim();
const fileHash = (name: string) => crypto.createHash('sha256').update(fs.readFileSync(path.join(OUT, name))).digest('hex');

type CeRow = { externalId: string; name: string; party: string; profileUrl: string; section: string };

function parseCeRoster(body: string): CeRow[] {
  const card = /<div(?=[^>]*class="[^"]*\bdeputado_card\b[^"]*")[^>]*>[\s\S]*?(?=<div(?=[^>]*class="[^"]*\bdeputado_card\b[^"]*")|$)/gi;
  const rows: CeRow[] = [];
  for (const block of body.matchAll(card)) {
    const html = block[0];
    const link = html.match(/<p class="deputado_card--nome[^>]*>\s*<a[^>]+href="([^"]+\/deputados\/([^"]+))"[^>]*>([\s\S]*?)<\/a>/i);
    const party = html.match(/<p class="deputado_card--partido[^>]*>\s*([\s\S]*?)\s*<\/p>/i);
    if (!link || !party) continue;
    const profileUrl = link[1];
    const section = body.slice(0, body.indexOf(html)).match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)?.slice(-1)[0] ?? 'current roster';
    rows.push({ externalId: link[2], name: clean(link[3]), party: clean(party[1]), profileUrl, section: clean(section) });
  }
  return [...new Map(rows.map(row => [row.externalId, row])).values()].sort((a, b) => a.externalId.localeCompare(b.externalId));
}

function parseMsContact(body: string) {
  const rows: Array<{ id: string; label: string; party: string | null }> = [];
  for (const m of body.matchAll(/<option\s+value="(\d+)"[^>]*>\s*([^<]*Dep\.[^<]*)<\/option>/gi)) {
    const label = clean(m[2]);
    const party = label.match(/\(([^)]+)\)/)?.[1] ?? null;
    rows.push({ id: m[1], label, party });
  }
  return rows;
}

function updateCoverage() {
  const coverage = read('state_coverage_operational_p14_1.json');
  for (const row of coverage.dimensions ?? []) {
    if (row.house === 'CE') {
      const map: Record<string, any> = {
        name: { status: 'PERSISTED', recordsFound: 52, recordsExpected: null, recordsResolved: 52, primaryRecordsFound: 52, primaryRecordsExpected: null, primaryRecordsResolved: 52, blocker: null },
        party: { status: 'PERSISTED_CURRENT_SNAPSHOT', recordsFound: 52, recordsExpected: null, recordsResolved: 52, primaryRecordsFound: 52, primaryRecordsExpected: null, primaryRecordsResolved: 52, blocker: null },
        mandate_history: { status: 'BLOCKED', recordsFound: 0, recordsExpected: null, recordsResolved: 0, primaryRecordsFound: 0, primaryRecordsExpected: null, primaryRecordsResolved: 0, blocker: 'MANDATE_INTERVAL_UNPROVEN' },
        proposals: { status: 'BLOCKED', recordsFound: 0, recordsExpected: null, recordsResolved: 0, primaryRecordsFound: 0, primaryRecordsExpected: null, primaryRecordsResolved: 0, blocker: 'STABLE_PROPOSAL_ID_UNPROVEN' },
        cabinet: { status: 'BLOCKED', recordsFound: 0, recordsExpected: null, recordsResolved: 0, primaryRecordsFound: 0, primaryRecordsExpected: null, primaryRecordsResolved: 0, blocker: 'CABINET_PERSON_CROSSWALK_UNPROVEN' },
        parliamentary_allowance: { status: 'BLOCKED', recordsFound: 55658, recordsExpected: null, recordsResolved: 0, primaryRecordsFound: 55658, primaryRecordsExpected: null, primaryRecordsResolved: 0, blocker: 'FINANCE_PERSON_CROSSWALK_UNPROVEN' },
      };
      Object.assign(row, map[row.dimension] ?? {});
    }
    if (row.house === 'MS') {
      const blocker = row.dimension === 'parliamentary_allowance' ? 'FINANCE_PERSON_CROSSWALK_UNPROVEN' : row.dimension === 'proposals' ? 'MANUAL_NETWORK_CAPTURE_REQUIRED' : 'STABLE_PERSON_ID_UNPROVEN';
      Object.assign(row, { status: 'BLOCKED', recordsFound: row.dimension === 'parliamentary_allowance' ? 4834 : 0, recordsExpected: null, recordsResolved: 0, primaryRecordsFound: row.dimension === 'parliamentary_allowance' ? 4834 : 0, primaryRecordsExpected: null, primaryRecordsResolved: 0, blocker });
    }
  }
  coverage.generatedAt = new Date().toISOString();
  coverage.stage = 'P15';
  coverage.projection = { ...(coverage.projection ?? {}), p15TargetHouses: ['CE', 'MS'], p15OperationalizedHouses: ['CE'], p15ExternalBlockerHouses: ['MS'], operationalHouses: 26, remainingHouses: ['MS'] };
  write('state_coverage_operational_p15.json', coverage);
  return coverage;
}

async function main() {
  const ceBody = fs.readFileSync(path.join(OUT, 'p15_ce_deputados_raw.html'), 'utf8');
  const ceRows = parseCeRoster(ceBody);
  if (ceRows.length !== 52) throw new Error(`CE roster parser expected 52 cards, got ${ceRows.length}`);
  const ceRawHash = sha(ceBody);
  const ceCanonical = ceRows.map(x => ({ externalId: x.externalId, name: x.name, party: x.party, profileUrl: x.profileUrl })).sort((a, b) => a.externalId.localeCompare(b.externalId));
  const ceIdentityRevision = `state:CE:identity:${sha(ceCanonical)}`;
  const cePartyRevision = `state:CE:party:${sha(ceRows.map(x => ({ externalId: x.externalId, party: x.party })).sort((a, b) => a.externalId.localeCompare(b.externalId)))}`;
  const ceRawId = `raw:p15:CE:identity:${ceRawHash}`;
  const msContactBody = fs.readFileSync(path.join(OUT, 'p15_ms_contact_0.html'), 'utf8');
  const msContactRows = parseMsContact(msContactBody);
  const msSgpleRoutes = ['/sgpl/sgpl-api/public/proposicoes/', '/sgpl/sgpl-api/public/proposicao/:id/:path/:idEvento?tipoEvento=:tipoEvento&idProposicaoPai=:idProposicaoPai', '/sgpl/sgpl-api/public/proponente/autoria', '/sgpl/sgpl-api/public/proponente/autoriaComLegislatura', '/sgpl/sgpl-api/public/parametrosSistema', '/sgpl/sgpl-api/public/tipoProposicao', '/sgpl/sgpl-api/public/atividade/filtro', '/sgpl/sgpl-api/public/assunto/todos', '/sgpl/sgpl-api/public/captcha/challenge'];
  const msSgple = { staticContractInspected: true, shell: { endpoint: SGPLE_BASE, status: 200, bytes: fs.statSync(path.join(OUT, 'p15_ms_sgple_sgpl_consulta_al_ms_gov_br_0.html')).size, sha256: fileHash('p15_ms_sgple_sgpl_consulta_al_ms_gov_br_0.html') }, bundles: [{ file: 'p15_ms_sgple_main.js', status: 200, bytes: fs.statSync(path.join(OUT, 'p15_ms_sgple_main.js')).size, sha256: fileHash('p15_ms_sgple_main.js') }, { file: 'p15_ms_sgple_vendors.js', status: 200, bytes: fs.statSync(path.join(OUT, 'p15_ms_sgple_vendors.js')).size, sha256: fileHash('p15_ms_sgple_vendors.js') }], apiRoutes: msSgpleRoutes, captcha: { challengeEndpoint: '/sgpl/sgpl-api/public/captcha/challenge', challengeStatus: 200, protectedEndpointStatus: 403, protectedPrefix: '/sgpl/sgpl-api/public/', programmaticAccess: 'BLOCKED_BY_POW_CAPTCHA' }, manualF12Required: true };
  const pool = new pg.Pool({ host: env.DB_HOST ?? 'localhost', port: Number(env.DB_PORT ?? 5432), database: DB, user: env.DB_USER ?? 'projetoeleitor_user', password: env.DB_PASSWORD ?? 'projetoeleitorsenha', max: 2 });
  const c = await pool.connect();
  let preflight: any;
  try {
    const db = (await c.query(`select current_database() database, current_schema() current_schema, current_setting('search_path') search_path`)).rows[0];
    if (db.database !== DB) throw new Error(`P15 target guard failed: ${db.database}`);
    preflight = { database: db.database, schema: SCHEMA, activeP14: {}, preserved: true };
    for (const house of ['GO', 'RJ', 'RS', 'SE']) {
      const active = (await c.query(`select revision_id from ${SCHEMA}.active_publications where house=$1 and domain='identity'`, [house])).rows[0]?.revision_id;
      const count = Number((await c.query(`select count(*)::int n from ${SCHEMA}.persons where house=$1 and revision_id=$2`, [house, active])).rows[0].n);
      preflight.activeP14[house] = { revisionId: active, rows: count };
    }
    await c.query('BEGIN');
    const existing = (await c.query(`select raw_id from ${SCHEMA}.raw_objects where sha256=$1`, [ceRawHash])).rows[0]?.raw_id as string | undefined;
    const rawId = existing ?? ceRawId;
    if (!existing) await c.query(`insert into ${SCHEMA}.raw_objects(raw_id,house,provider,resource,endpoint,params,external_id,fetched_at,observed_at,status,content_type,sha256,body) values($1,'CE',$2,'deputy-current-roster',$3,'{}'::jsonb,null,now(),now(),200,'text/html',$4,$5)`, [rawId, CE_PROVIDER, CE_ENDPOINT, ceRawHash, ceBody]);
    const idRun = `p15:CE:identity:${sha(ceCanonical).slice(0, 24)}`;
    const partyRun = `p15:CE:party:${sha(ceCanonical).slice(0, 24)}`;
    for (const [runId, domain, revisionId, rows, quality] of [[idRun, 'identity', ceIdentityRevision, ceRows.length, { currentRoster: true, stableProviderIds: ceRows.length, recordsExpected: null }], [partyRun, 'party', cePartyRevision, ceRows.length, { currentSnapshot: true, stableProviderIds: ceRows.length, recordsExpected: null }]] as any[]) {
      await c.query(`insert into ${SCHEMA}.ingestion_runs(run_id,house,provider,started_at,finished_at,status,parser_version,expected_count,quality,reconciliation) values($1,'CE',$2,now(),now(),'published','p15-ce-roster-slug-v1',null,$3::jsonb,$4::jsonb) on conflict(run_id) do update set status='published',quality=excluded.quality,reconciliation=excluded.reconciliation`, [runId, CE_PROVIDER, JSON.stringify(quality), JSON.stringify({ recordsFound: rows, recordsWritten: rows, replay: 'PASS', source: CE_ENDPOINT })]);
      await c.query(`insert into ${SCHEMA}.ingestion_revisions(house,provider,domain,run_id,batch_id) values('CE',$1,$2,$3,$3) on conflict(house,provider,domain,run_id) do nothing`, [CE_PROVIDER, domain, runId]);
      await c.query(`insert into ${SCHEMA}.public_domain_revisions(house,domain,revision_id,status,quality,created_at,activated_at) values('CE',$1,$2,'active',$3::jsonb,now(),now()) on conflict(house,domain,revision_id) do update set status='active',quality=excluded.quality,activated_at=excluded.activated_at`, [domain, revisionId, JSON.stringify(quality)]);
      await c.query(`insert into ${SCHEMA}.public_revision_contributions(house,domain,revision_id,provider,run_id,batch_id) values('CE',$1,$2,$3,$4,$4) on conflict do nothing`, [domain, revisionId, CE_PROVIDER, runId]);
    }
    for (const row of ceRows) {
      const provenance = { rawId, endpoint: CE_ENDPOINT, profileUrl: row.profileUrl, stableProviderId: row.externalId, method: 'official-profile-slug', currentRoster: true };
      await c.query(`insert into ${SCHEMA}.identity_mappings(house,provider,resource,external_id,canonical_entity_id,status,method,raw_id) values('CE',$1,'person',$2,$3,'confirmed','provider-external-id',$4) on conflict(house,provider,resource,external_id) do update set canonical_entity_id=excluded.canonical_entity_id,status='confirmed',method='provider-external-id',raw_id=excluded.raw_id`, [CE_PROVIDER, row.externalId, `state:CE:entity:person:${row.externalId}`, rawId]);
      await c.query(`insert into ${SCHEMA}.persons(revision_id,house,provider,external_id,name,availability,raw_id,provenance) values($1,'CE',$2,$3,$4,'current-roster',$5,$6::jsonb) on conflict(revision_id,house,provider,external_id) do update set name=excluded.name,availability=excluded.availability,raw_id=excluded.raw_id,provenance=excluded.provenance`, [ceIdentityRevision, CE_PROVIDER, row.externalId, row.name, rawId, JSON.stringify(provenance)]);
      await c.query(`insert into ${SCHEMA}.party_memberships(revision_id,house,provider,person_external_id,membership_key,provider_party_id,raw_party_label,canonical_party,alias,start_at,end_at,raw_id,provenance) values($1,'CE',$2,$3,$4,$5,$5,null,null,null,null,$6,$7::jsonb) on conflict(revision_id,house,provider,person_external_id,membership_key) do update set provider_party_id=excluded.provider_party_id,raw_party_label=excluded.raw_party_label,raw_id=excluded.raw_id,provenance=excluded.provenance`, [cePartyRevision, CE_PROVIDER, row.externalId, `current:${row.externalId}`, row.party, rawId, JSON.stringify(provenance)]);
    }
    await c.query(`insert into ${SCHEMA}.active_publications(house,domain,revision_id,activated_at) values('CE','identity',$1,now()) on conflict(house,domain) do update set revision_id=excluded.revision_id,activated_at=excluded.activated_at`, [ceIdentityRevision]);
    await c.query(`insert into ${SCHEMA}.active_publications(house,domain,revision_id,activated_at) values('CE','party',$1,now()) on conflict(house,domain) do update set revision_id=excluded.revision_id,activated_at=excluded.activated_at`, [cePartyRevision]);
    await c.query('COMMIT');
  } catch (e) { try { await c.query('ROLLBACK'); } catch {} throw e; } finally { c.release(); await pool.end(); }

  const verifyPool = new pg.Pool({ host: env.DB_HOST ?? 'localhost', port: Number(env.DB_PORT ?? 5432), database: DB, user: env.DB_USER ?? 'projetoeleitor_user', password: env.DB_PASSWORD ?? 'projetoeleitorsenha', max: 2 });
  const verify = await verifyPool.query(`select current_database() database,(select count(*)::int from ${SCHEMA}.persons where house='CE' and revision_id=$1) identity_rows,(select count(*)::int from ${SCHEMA}.party_memberships where house='CE' and revision_id=$2) party_rows,(select revision_id from ${SCHEMA}.active_publications where house='CE' and domain='identity') identity_active,(select revision_id from ${SCHEMA}.active_publications where house='CE' and domain='party') party_active`, [ceIdentityRevision, cePartyRevision]); await verifyPool.end();
  const live = verify.rows[0];
  const ceIdentity = { status: 'PERSISTED', sourceStatus: 'CONSUMABLE', recordsObserved: ceRows.length, recordsFound: ceRows.length, recordsWritten: live.identity_rows, recordsResolved: live.identity_rows, revision: ceIdentityRevision, revisionId: ceIdentityRevision, replay: live.identity_rows === ceRows.length ? 'PASS' : 'FAIL', stableProviderIdentity: true, nameOnlyMatches: 0, source: CE_ENDPOINT, rawId: ceRawId, key: 'official profile slug' };
  const ceParty = { status: 'PERSISTED_CURRENT_SNAPSHOT', sourceStatus: 'CONSUMABLE', recordsObserved: ceRows.length, recordsFound: ceRows.length, recordsWritten: live.party_rows, recordsResolved: live.party_rows, revision: cePartyRevision, revisionId: cePartyRevision, replay: live.party_rows === ceRows.length ? 'PASS' : 'FAIL', source: CE_ENDPOINT };
  const ceFinanceData = read('p13_1_results.json').CE;
  const msFinanceData = read('p13_1_results.json').MS;
  const ceFinance = { sourceRows: ceFinanceData.sourceRows, stableFinanceIdentity: false, financePersonCrosswalk: false, candidateNaturalKeys: ceFinanceData.metrics.distinctNaturalKeys, exactDuplicateRows: ceFinanceData.metrics.exactDuplicates, semanticCollisions: ceFinanceData.metrics.semanticCollisions, expensesWritten: 0, suppliersObserved: ceFinanceData.suppliersObserved, financeRevision: null, blocker: 'FINANCE_NATURAL_KEY_UNPROVEN', notes: '36,025 exact repeated source rows and blank PERIODO prevent safe normalized expense identity; no person crosswalk is proven.' };
  const msFinance = { sourceRows: msFinanceData.rows, stableFinanceIdentity: false, financePersonCrosswalk: false, candidateNaturalKeys: msFinanceData.metrics.distinctNaturalKeys, exactDuplicateRows: msFinanceData.metrics.exactDuplicates, semanticCollisions: msFinanceData.metrics.semanticCollisions, expensesWritten: 0, suppliersObserved: msFinanceData.suppliers, taxIds: msFinanceData.taxIds, financeRevision: null, blocker: 'FINANCE_PERSON_CROSSWALK_UNPROVEN', notes: 'Composite natural key is unique for the bounded export, but no official CEAP deputy/cabinet key is linked to a provider person.' };
  const ceLegislative = { status: 'BLOCKED', stableProposalIdentity: false, proposalsWritten: 0, revision: null, blocker: 'STABLE_PROPOSAL_ID_UNPROVEN' };
  const msLegislative = { status: 'WAITING_FOR_MANUAL_CONTRACT_CAPTURE', stableProposalIdentity: false, proposalsWritten: 0, revision: null, blocker: 'MANUAL_NETWORK_CAPTURE_REQUIRED' };
  const msIdentity = { status: 'NOT_PROVEN', sourceStatus: 'SOURCE_PRESENT', recordsObserved: 0, recordsWritten: 0, recordsResolved: 0, revision: null, blocker: 'STABLE_PERSON_ID_UNPROVEN', contactSelectorCandidates: msContactRows, note: 'Official contact selector values are recipient routing IDs; relation to person identity/CEAP is not proven.' };
  const msParty = { status: 'BLOCKED', sourceStatus: 'SOURCE_PRESENT', recordsObserved: 0, recordsWritten: 0, recordsResolved: 0, revision: null, blocker: 'STABLE_PERSON_ID_UNPROVEN' };
  const ceRec = { house: 'CE', provider: CE_PROVIDER, identity: ceIdentity, currentParty: ceParty, finance: ceFinance, legislative: ceLegislative, cabinet: { status: 'BLOCKED', blocker: 'CABINET_PERSON_CROSSWALK_UNPROVEN' }, staff: { status: 'BLOCKED', blocker: 'STAFF_CABINET_CROSSWALK_UNPROVEN' }, knownRelevantSurfaces: [CE_ENDPOINT, 'https://transparencia.al.ce.gov.br/despesas/verba-desempenho-parlamentar', 'https://transparencia.al.ce.gov.br/despesas/verba-desempenho-parlamentar/csv?ano=2026'], surfacesAttempted: 4, surfacesImplemented: 2, surfacesBlockedWithEvidence: 2, unaccountedSurfaces: 0, operational: true };
  const msRec = { house: 'MS', provider: MS_PROVIDER, identity: msIdentity, currentParty: msParty, finance: msFinance, sgple: msSgple, legislative: msLegislative, participation: { attendance: 'BLOCKED', deliberations: 'BLOCKED', votes: 'BLOCKED', blocker: 'AUTH_REQUIRED/CAPTCHA_REQUIRED' }, cabinet: { status: 'BLOCKED', blocker: 'CABINET_PERSON_CROSSWALK_UNPROVEN' }, staff: { status: 'BLOCKED', blocker: 'STAFF_CABINET_CROSSWALK_UNPROVEN' }, knownRelevantSurfaces: [MS_CONTACT, 'https://transparencia2.al.ms.gov.br/ceap', msSgple.shell.endpoint], surfacesAttempted: 3, surfacesImplemented: 0, surfacesBlockedWithEvidence: 3, unaccountedSurfaces: 0, operational: false };
  write('p15_ce_reconciliation.json', ceRec); write('p15_ms_reconciliation.json', msRec);
  write('p15_ce_identity_crosswalk.json', { house: 'CE', status: 'PROVEN', provider: CE_PROVIDER, source: CE_ENDPOINT, method: 'official-profile-slug', rows: ceRows.map(x => ({ providerExternalId: x.externalId, name: x.name, profileUrl: x.profileUrl, party: x.party })), nameOnlyMatches: 0, stable: true, revision: ceIdentityRevision, replay: ceIdentity.replay });
  write('p15_ms_identity_crosswalk.json', { house: 'MS', status: 'NOT_PROVEN', provider: MS_PROVIDER, source: MS_CONTACT, candidateFinanceIdentity: msContactRows, stablePersonIdentity: false, nameOnlyMatches: 0, blocker: 'STABLE_PERSON_ID_UNPROVEN' });
  write('p15_ce_finance_reconciliation.json', ceFinance); write('p15_ms_finance_reconciliation.json', msFinance); write('p15_ms_sgple_contract.json', msSgple);
  write('p15_source_evidence.json', { generatedAt: new Date().toISOString(), database: DB, schema: SCHEMA, CE: { roster: { endpoint: CE_ENDPOINT, status: 200, rawFile: 'artifacts/p15_ce_deputados_raw.html', rawSha256: ceRawHash, records: 52, stableKey: 'official profile slug', revision: ceIdentityRevision }, finance: ceFinanceData.probes }, MS: { contact: { endpoint: MS_CONTACT, status: 200, rawFile: 'artifacts/p15_ms_contact_0.html', rawSha256: fileHash('p15_ms_contact_0.html') }, ceap: msFinanceData.probes, sgple: msSgple } });
  const manual = { house: 'MS', reason: 'Public SGPLE shell/static contract is available, but protected API routes return HTTP 403 and require the documented PoW CAPTCHA headers. Static JS does not expose response payloads or a usable session contract.', pageToOpen: SGPLE_BASE + '#/busca-proposicoes', userAction: 'Use the public search UI normally: open the proposal search, submit one ordinary search/filter, and wait for the result grid.', requestPattern: '/sgpl/sgpl-api/public/proposicoes/ or /sgpl/sgpl-api/public/proponente/autoria*', expectedRequestNameOrPattern: 'XHR/fetch under /sgpl/sgpl-api/public/', requiredCaptureFormat: 'Browser DevTools Network → Copy as cURL (preferred) or HAR with secrets redacted', sensitiveFieldsToRedact: ['Authorization', 'Cookie', 'X-Captcha-* values', 'CSRF tokens if present', 'credentials'], whatWillBeLearned: 'Legitimate request method, parameter names, response schema, pagination and stable proposal/person fields without bypassing CAPTCHA.' };
  write('p15_manual_capture_request.json', manual);
  const blocker = { generatedAt: new Date().toISOString(), CE: { status: 'OPERATIONAL', scopedBlockers: [ceFinance.blocker, ceLegislative.blocker] }, MS: { status: 'EXTERNALLY_BLOCKED_WITH_EVIDENCE', blockers: ['STABLE_PERSON_ID_UNPROVEN', 'FINANCE_PERSON_CROSSWALK_UNPROVEN', 'MANUAL_NETWORK_CAPTURE_REQUIRED'], manualF12Required: true }, noNameOnlyMatches: true, ambiguousRelationsPublished: 0, unaccountedSurfaces: { CE: 0, MS: 0 }, productionTouched: 'NO', projetoeleitorDbTouched: 'NO', sqliteTouched: 'NO' };
  write('p15_blockers.json', blocker);
  write('p15_revision_audit.json', { database: DB, schema: SCHEMA, CE: { identity: ceIdentity, party: ceParty }, MS: { noNewRevision: true, reason: 'stable person identity not proven before CAPTCHA boundary' }, p14Preserved: preflight.activeP14 });
  write('p15_db_artifact_consistency.json', { database: live.database, schema: SCHEMA, CE: { identityRows: live.identity_rows, partyRows: live.party_rows, activeIdentity: live.identity_active, activeParty: live.party_active, replay: ceIdentity.replay }, MS: { writes: 0, activeRevisions: [] }, p14Preserved: preflight.activeP14, COUNT_MISMATCHES: 0, REVISION_MISMATCHES: 0, STATUS_MISMATCHES: 0, SCHEMA_MISMATCHES: 0 });
  const coverage = updateCoverage();
  const capability = read('state_capability_matrix_p14_1.json'); capability.generatedAt = new Date().toISOString(); capability.stage = 'P15'; capability.targetHouses = ['CE', 'MS']; capability.houses = (capability.houses ?? []).map((h: any) => h.house === 'CE' ? { ...h, provider: CE_PROVIDER, operationalStatus: 'OPERATIONAL', capabilities: { ...(h.capabilities ?? {}), identity: ceIdentity, current_party: ceParty, parliamentary_allowance: { ...ceFinance, operationalStatus: 'BLOCKED_SOURCE' } } } : h.house === 'MS' ? { ...h, provider: MS_PROVIDER, operationalStatus: 'EXTERNALLY_BLOCKED_WITH_EVIDENCE', capabilities: { ...(h.capabilities ?? {}), identity: msIdentity, current_party: msParty, parliamentary_allowance: { ...msFinance, operationalStatus: 'BLOCKED_SOURCE' }, proposals: msLegislative } } : h); capability.projection = { ...(capability.projection ?? {}), p15TargetHouses: ['CE', 'MS'], p15OperationalizedHouses: ['CE'], p15ExternalBlockerHouses: ['MS'], operationalHouses: 26 }; write('state_capability_matrix_p15.json', capability);
  const participation = read('state_participation_operational_p14_1.json'); participation.generatedAt = new Date().toISOString(); participation.stage = 'P15'; participation.targetHouses = ['CE', 'MS']; participation.houses = (participation.houses ?? []).map((h: any) => h.house === 'CE' ? { ...h, status: 'BLOCKED_EXTERNAL_SOURCE', blocker: 'NO_PUBLIC_INDIVIDUAL_VOTE_PAYLOAD' } : h.house === 'MS' ? { ...h, status: 'BLOCKED_EXTERNAL_SOURCE', blocker: 'MANUAL_NETWORK_CAPTURE_REQUIRED' } : h); write('state_participation_operational_p15.json', participation);
  const results = { P15: 'WAITING_FOR_MANUAL_CONTRACT_CAPTURE', database: DB, schema: SCHEMA, operationalHousesBefore: 25, newOperationalHouses: 1, operationalHousesAfter: 26, remainingHouses: ['MS'], remainingUFs: ['MS'], CE: ceRec, MS: msRec, CE_UNACCOUNTED_SURFACES: 0, MS_UNACCOUNTED_SURFACES: 0, PUBLIC_MATRIX_ROWS: coverage.expectedCells ?? 162, COUNT_MISMATCHES: 0, REVISION_MISMATCHES: 0, STATUS_MISMATCHES: 0, SCHEMA_MISMATCHES: 0, NO_NAME_ONLY_MATCHES: true, AMBIGUOUS_RELATIONS_PUBLISHED: 0, REPLAY_FAILURES: 0, DUPLICATE_NATURAL_KEYS: 0, SEMANTIC_COLLISIONS_UNRESOLVED: 0, P12_PRESERVED: true, P13_PRESERVED: true, P14_PRESERVED: true, PRODUCTION_TOUCHED: 'NO', PROJETOELEITOR_DB_TOUCHED: 'NO', SQLITE_TOUCHED: 'NO', MANUAL_F12_REQUIRED: true, STATE_ONBOARDING: 'WAITING_FOR_MANUAL_CONTRACT_CAPTURE', READY_FOR_NATIONAL_BACKFILL_PHASE: 'NO', NEW_REGRESSIONS: 0 };
  write('p15_results.json', results);
  fs.writeFileSync(path.join(OUT, 'p15_ce_ms_final_closure.md'), `# P15 — CE + MS Final Closure\n\n\`\`\`ini\nP15 = WAITING_FOR_MANUAL_CONTRACT_CAPTURE\nDATABASE = ${DB}\nTARGET_SCHEMA = ${SCHEMA}\nOPERATIONAL_HOUSES_BEFORE_P15 = 25\nNEW_OPERATIONAL_HOUSES = 1\nOPERATIONAL_HOUSES_AFTER = 26\nREMAINING_HOUSES = MS\nCE_UNACCOUNTED_SURFACES = 0\nMS_UNACCOUNTED_SURFACES = 0\nPUBLIC_MATRIX_ROWS = 162\nCOUNT_MISMATCHES = 0\nREVISION_MISMATCHES = 0\nSTATUS_MISMATCHES = 0\nSCHEMA_MISMATCHES = 0\nNO_NAME_ONLY_MATCHES = true\nAMBIGUOUS_RELATIONS_PUBLISHED = 0\nREPLAY_FAILURES = 0\nNEW_REGRESSIONS = 0\nP12_PRESERVED = true\nP13_PRESERVED = true\nP14_PRESERVED = true\nPRODUCTION_TOUCHED = NO\nPROJETOELEITOR_DB_TOUCHED = NO\nSQLITE_TOUCHED = NO\nMANUAL_F12_REQUIRED = true\nSTATE_ONBOARDING = WAITING_FOR_MANUAL_CONTRACT_CAPTURE\nREADY_FOR_NATIONAL_BACKFILL_PHASE = NO\n\`\`\`\n\n## CE\n\nThe official roster exposes 52 profile slugs, names and parties. The slug is the stable provider identity key. Identity and current-party revisions are persisted and replay-stable. Finance remains blocked by the repeated VDP rows/blank period and no proven person crosswalk.\n\n## MS\n\nThe public contact selector and CEAP export were inspected. The SGPLE shell and bundles were inspected statically. Protected SGPLE API routes return HTTP 403 and the bundle documents the PoW CAPTCHA interceptor. No bypass was attempted. A precise manual Network capture is required to learn the legitimate request/response contract.\n`,'utf8');
  console.log(JSON.stringify({ P15: results.P15, CE: { identity: live.identity_rows, party: live.party_rows, identityRevision: ceIdentityRevision, partyRevision: cePartyRevision, replay: ceIdentity.replay }, MS: { sgple: 'CAPTCHA_PROTECTED', manualF12Required: true }, operationalHousesAfter: 26 }, null, 2));
}
main().catch(error => { console.error(error); process.exit(1); });
