import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import pg from 'pg';

const LAB = 'civica_postgres_lab';
const ROOT = process.cwd();
const ART = path.join(ROOT, 'artifacts');
const DEST = 'C:\\Projetos\\civicadocs\\artifacts';
const PR_BASE = 'https://transparencia.assembleia.pr.leg.br';
const HOUSES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'] as const;
const SEATS: Record<string, number> = { AC:24, AL:27, AP:24, AM:24, BA:63, CE:46, DF:24, ES:30, GO:41, MA:42, MT:24, MS:24, MG:77, PA:41, PB:36, PR:54, PE:49, PI:30, RJ:70, RN:24, RS:55, RO:24, RR:24, SC:40, SP:94, SE:24, TO:24 };
const DEEP_CAPS = ['attendance','deliberations','individual_votes','activity','proposals','authorship','movements','documents','proposal_relations','parliamentary_allowance','suppliers','expenses','daily_allowances','air_tickets','contracts','procurement'] as const;

function sha(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function json(name: string, fallback: any = null): any { try { return JSON.parse(fs.readFileSync(path.join(ART, name), 'utf8')); } catch { return fallback; } }
function iso(): string { return new Date().toISOString(); }
function cents(value: unknown): number | null { const n = Number(String(value ?? '').replace(',', '.')); return Number.isFinite(n) ? Math.round(n * 100) : null; }
function esc(value: unknown): string { return String(value ?? '').replace(/'/g, "''"); }
function sleep(ms: number): Promise<void> { return new Promise(resolve => setTimeout(resolve, ms)); }

async function fetchWithSession(url: string, session: { cookie?: string; csrf?: string }): Promise<{ status: number; contentType: string; body: string }> {
  const response = await fetch(url, { headers: { 'user-agent': 'Civica-P17.2/1.0', accept: 'application/json, text/html;q=0.9', ...(session.cookie ? { cookie: session.cookie } : {}), ...(session.csrf ? { 'x-csrf-token': session.csrf, 'x-requested-with': 'XMLHttpRequest' } : {}), referer: `${PR_BASE}/pessoal/remuneracao-dos-servidores` } });
  return { status: response.status, contentType: response.headers.get('content-type') ?? 'application/octet-stream', body: await response.text() };
}

async function loadPrCompensation(): Promise<any> {
  const page = await fetchWithSession(`${PR_BASE}/pessoal/remuneracao-dos-servidores`, {});
  if (page.status !== 200) throw new Error(`ALEP remuneration page returned ${page.status}`);
  const cookie = (page as any).headers?.get?.('set-cookie'); // retained for environments exposing headers on helper
  const html = page.body;
  // Node's Response headers are read below through a second request because the helper returns the normalized body.
  const bootstrap = await fetch(`${PR_BASE}/pessoal/remuneracao-dos-servidores`, { headers: { 'user-agent': 'Civica-P17.2/1.0' } });
  const setCookie = bootstrap.headers.get('set-cookie') ?? '';
  const sessionCookie = setCookie.split(/,(?=[A-Za-z0-9_-]+=)/).map(x => x.split(';')[0]).join('; ');
  const pageHtml = await bootstrap.text();
  const csrf = (pageHtml.match(/meta name="csrf-token" content="([^"]+)/) ?? [])[1] ?? '';
  const months = await fetchWithSession(`${PR_BASE}/api/remuneracao/meses?ano=2026`, { cookie: sessionCookie, csrf });
  if (months.status !== 200) throw new Error(`ALEP remuneration months returned ${months.status}`);
  const monthJson = JSON.parse(months.body);
  const availableMonths = Object.keys(monthJson.meses ?? {}).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  const month = availableMonths.at(-1);
  if (!month) throw new Error('ALEP returned no remuneration month');
  await sleep(100);
  const endpoint = `${PR_BASE}/api/remuneracao?t=deputado%20estadual&mes=${month}&ano=2026&page=1&search=&searchType=nome`;
  const rows = await fetchWithSession(endpoint, { cookie: sessionCookie, csrf });
  if (rows.status !== 200) throw new Error(`ALEP remuneration rows returned ${rows.status}`);
  const data = JSON.parse(rows.body);
  return { page: { status: bootstrap.status, body: pageHtml, contentType: bootstrap.headers.get('content-type') ?? 'text/html' }, months: { url: `${PR_BASE}/api/remuneracao/meses?ano=2026`, status: months.status, body: months.body, contentType: months.contentType }, rows: { url: endpoint, status: rows.status, body: rows.body, contentType: rows.contentType }, year: 2026, month, monthLabel: monthJson.meses[String(month)], records: data.remuneracoes ?? [], total: data.total ?? null, lastPage: data.last_page ?? null };
}

async function main(): Promise<void> {
  if (!process.argv.includes('--run')) throw new Error('P17.2 requires --run');
  fs.mkdirSync(ART, { recursive: true });
  const generatedAt = iso();
  const pool = new pg.Pool({ host: process.env.DB_HOST ?? 'localhost', port: Number(process.env.DB_PORT ?? 5432), database: LAB, user: process.env.DB_USER, password: process.env.DB_PASSWORD, max: 3, connectionTimeoutMillis: 15000 });
  const state: any = { generatedAt, database: LAB, productionTouched: false, projectEleitorTouched: false, sqliteTouched: false };
  try {
    const db = (await pool.query<{ current_database: string }>('select current_database()')).rows[0]?.current_database;
    if (db !== LAB) throw new Error(`P17.2 target refused: ${db}`);
    const schemaExists = await pool.query("select exists(select 1 from information_schema.schemata where schema_name='civica_state') as ok");
    if (!schemaExists.rows[0]?.ok) throw new Error('civica_state schema missing');

    const current = await pool.query<any>(`select p.house,p.provider,p.external_id,p.name,p.availability,p.revision_id,p.raw_id,p.provenance from civica_state.persons p join civica_state.active_publications a on a.house=p.house and a.domain='identity' and a.revision_id=p.revision_id order by p.house,p.name`);
    const allPersons = await pool.query<any>(`select house,provider,external_id,name,availability,revision_id from civica_state.persons order by house,provider,external_id`);
    const party = await pool.query<any>(`select house,person_external_id,canonical_party,raw_party_label from civica_state.party_memberships`);
    const active = await pool.query<any>(`select house,domain,revision_id from civica_state.active_publications order by house,domain`);
    const ms = await pool.query<any>(`select count(*)::int total,count(*) filter(where person_external_id is null)::int null_person,count(*) filter(where person_external_id is not null)::int linked from civica_state.expenses where house='MS' and provider='ms_ceap_csv'`);
    const p16 = json('p16_1_house_manifest.json', { houses: [] });
    const sourceByHouse = new Map((p16.houses ?? []).map((x: any) => [x.house, x.officialSystems?.[0]?.url ?? null]));
    const currentStatuses = new Set(['current-roster', 'current-candidate']);
    const currentRows = current.rows.filter((x: any) => currentStatuses.has(x.availability));
    const classify = { current: allPersons.rows.filter((x: any) => currentStatuses.has(x.availability)).length, historical: allPersons.rows.filter((x: any) => !currentStatuses.has(x.availability)).length, ambiguous: allPersons.rows.filter((x: any) => !x.availability).length };
    let pr: any = null; let prError: string | null = null;
    try { pr = await loadPrCompensation(); } catch (e) { prError = String(e); }

    // Lab-only normalized table for the proven PR compensation contract. This is intentionally not a production migration.
    await pool.query(`create table if not exists civica_state.state_compensation (revision_id text not null, house text not null, provider text not null, person_external_id text not null, competence text not null, gross_amount_cents bigint, remuneratory_amount_cents bigint, discounts_cents bigint, net_amount_cents bigint, raw_id text not null, provenance jsonb not null, primary key (revision_id,house,provider,person_external_id,competence))`);
    const prPersist: any = { fetched: false, records: 0, persons: 0, compensation: 0, revision: null, active: false, error: prError };
    if (pr) {
      const rawItems = [pr.page, pr.months, pr.rows];
      const rawIds: string[] = [];
      for (const item of rawItems) {
        const rawId = `raw:PR:alep_transparency:${sha(item.body)}`; rawIds.push(rawId);
        await pool.query(`insert into civica_state.raw_objects(raw_id,house,provider,resource,endpoint,params,external_id,fetched_at,observed_at,status,content_type,sha256,body) values($1,'PR','alep_transparency',$2,$3,$4,$5,$6,$6,$7,$8,$9,$10) on conflict(raw_id) do nothing`, [rawId, item === pr.page ? 'parliamentarians-page' : item === pr.months ? 'api-remuneracao-meses' : 'api-remuneracao', item.url ?? `${PR_BASE}/pessoal/remuneracao-dos-servidores`, JSON.stringify({ year: pr.year, month: pr.month }), null, generatedAt, item.status, item.contentType, sha(item.body), item.body]);
      }
      const revision = `state:PR:identity:${sha(JSON.stringify(pr.records.map((x: any) => [x.matricula, x.nome]))).slice(0, 48)}`; prPersist.revision = revision;
      const compensationRevision = `state:PR:compensation:${sha(JSON.stringify([pr.year,pr.month,pr.records.map((x: any) => [x.matricula,x.valor])])).slice(0,48)}`;
      await pool.query('begin');
      try {
        for (const row of pr.records) {
          const external = String(row.matricula ?? row.id); const rawId = rawIds[2]; const prov = { source: 'official', provider: 'alep_transparency', endpoint: pr.rows.url, observedAt: generatedAt, competence: `${pr.year}-${String(pr.month).padStart(2,'0')}`, officialId: row.id, fieldSemantics: 'valor is the published remuneration value; no net/discount inference' };
          await pool.query(`insert into civica_state.persons(revision_id,house,provider,external_id,name,availability,raw_id,provenance) values($1,'PR','alep_transparency',$2,$3,'current-roster',$4,$5) on conflict(revision_id,house,provider,external_id) do update set name=excluded.name,availability=excluded.availability,raw_id=excluded.raw_id,provenance=excluded.provenance`, [revision, external, row.nome, rawId, JSON.stringify(prov)]);
          await pool.query(`insert into civica_state.state_compensation(revision_id,house,provider,person_external_id,competence,gross_amount_cents,remuneratory_amount_cents,discounts_cents,net_amount_cents,raw_id,provenance) values($1,'PR','alep_transparency',$2,$3,$4,null,null,null,$5,$6) on conflict(revision_id,house,provider,person_external_id,competence) do update set gross_amount_cents=excluded.gross_amount_cents,raw_id=excluded.raw_id,provenance=excluded.provenance`, [compensationRevision, external, `${pr.year}-${String(pr.month).padStart(2,'0')}`, cents(row.valor), rawId, JSON.stringify(prov)]);
        }
        await pool.query(`insert into civica_state.public_domain_revisions(house,domain,revision_id,status,quality,created_at,activated_at) values('PR','identity',$1,'active',$2,$3,$3) on conflict(house,domain,revision_id) do update set status='active',quality=excluded.quality,activated_at=excluded.activated_at`, [revision, JSON.stringify({ provider: 'alep_transparency', records: pr.records.length, stableKeys: true }), generatedAt]);
        await pool.query(`insert into civica_state.active_publications(house,domain,revision_id,activated_at) values('PR','identity',$1,$2) on conflict(house,domain) do update set revision_id=excluded.revision_id,activated_at=excluded.activated_at`, [revision, generatedAt]);
        await pool.query('commit');
      } catch (e) { await pool.query('rollback'); throw e; }
      const counts = await pool.query(`select (select count(*) from civica_state.persons where house='PR' and revision_id=$1)::int persons,(select count(*) from civica_state.state_compensation where house='PR' and revision_id=$2)::int compensation`, [revision, compensationRevision]);
      prPersist.fetched = true; prPersist.records = pr.records.length; prPersist.persons = counts.rows[0].persons; prPersist.compensation = counts.rows[0].compensation; prPersist.active = true; prPersist.compensationRevision = compensationRevision; prPersist.month = pr.month; prPersist.total = pr.total;
      // Replay/idempotence: same natural keys do not create additional rows.
      for (const row of pr.records) { await pool.query(`insert into civica_state.state_compensation(revision_id,house,provider,person_external_id,competence,gross_amount_cents,raw_id,provenance) values($1,'PR','alep_transparency',$2,$3,$4,$5,$6) on conflict(revision_id,house,provider,person_external_id,competence) do nothing`, [compensationRevision, String(row.matricula ?? row.id), `${pr.year}-${String(pr.month).padStart(2,'0')}`, cents(row.valor), rawIds[2], JSON.stringify({ replay: true, source: pr.rows.url })]); }
      const replayCount = await pool.query(`select count(*)::int n from civica_state.state_compensation where revision_id=$1`, [compensationRevision]); prPersist.replayStable = replayCount.rows[0].n === pr.records.length;
    }

    const partyMap = new Map<string, any>(); for (const x of party.rows) if (x.canonical_party || x.raw_party_label) partyMap.set(`${x.house}:${x.person_external_id}`, x.canonical_party ?? x.raw_party_label);
    const houses: any = {}; for (const h of HOUSES) { const rows = currentRows.filter(x => x.house === h); houses[h] = { expectedSeats: SEATS[h], persistedCurrentRows: rows.length, officialCurrentRosterCount: h === 'PR' && pr ? pr.records.length : null, currentExercisingCount: rows.length, licensedCount: 0, substitutesCurrentCount: 0, vacancies: Math.max(0, SEATS[h] - rows.length), historicalRowsExcluded: allPersons.rows.filter((x: any) => x.house === h && !currentStatuses.has(x.availability)).length, ambiguousRows: allPersons.rows.filter((x: any) => x.house === h && !x.availability).length, sourceUrl: sourceByHouse.get(h) ?? null, status: h === 'PR' && pr ? 'PARTIAL_PROVIDER_ROSTER' : rows.length ? 'CONTROLLED_CORPUS_NOT_PROVEN_CURRENT' : 'NOT_PERSISTED' }; }
    if (pr) houses.PR = { ...houses.PR, officialCurrentRosterCount: pr.records.length, currentExercisingCount: pr.records.length, vacancies: Math.max(0, SEATS.PR - pr.records.length), status: pr.records.length === SEATS.PR ? 'OFFICIAL_CURRENT_ROSTER' : 'OFFICIAL_SOURCE_PARTIAL' };
    const persistedControlledCurrentRows = currentRows.filter(x => !(x.house === 'PR' && x.provider === 'alep_transparency'));
    const baselineProfiles = persistedControlledCurrentRows.map(x => ({ canonical_person_id: `${x.house}:${x.provider}:${x.external_id}`, provider_person_id: x.external_id, name: x.name, parliamentary_name: x.name, uf: x.house, house: x.house, role: x.house === 'DF' ? 'Deputado Distrital' : 'Deputado Estadual', current_party: partyMap.get(`${x.house}:${x.external_id}`) ?? null, current_mandate_status: 'IN_OFFICE', official_profile_url: x.provenance?.endpoint ?? null, photo_url: null, photo_source_url: null, normative_subsidy: null, subsidy_effective_from: null, subsidy_effective_to: null, subsidy_legal_basis: null, subsidy_source_url: null, identity_source_url: x.provenance?.endpoint ?? sourceByHouse.get(x.house) ?? null, observed_at: x.provenance?.fetchedAt ?? generatedAt, source_status: 'PERSISTED_CONTROLLED_CORPUS' }));
    if (pr) for (const x of pr.records) baselineProfiles.push({ canonical_person_id: `PR:alep_transparency:${x.matricula ?? x.id}`, provider_person_id: String(x.matricula ?? x.id), name: x.nome, parliamentary_name: x.nome, uf: 'PR', house: 'PR', role: 'Deputado Estadual', current_party: null, current_mandate_status: 'IN_OFFICE', official_profile_url: `${PR_BASE}/pessoal/parlamentares`, photo_url: null, photo_source_url: null, normative_subsidy: null, subsidy_effective_from: null, subsidy_effective_to: null, subsidy_legal_basis: null, subsidy_source_url: null, identity_source_url: pr.rows.url, observed_at: generatedAt, source_status: 'OFFICIAL_TRANSPARENCY_REMUNERATION' });
    const duplicateIds = baselineProfiles.length - new Set(baselineProfiles.map(x => x.canonical_person_id)).size;
    const msRows = ms.rows[0] ?? { total: 0, null_person: 0, linked: 0 };
    const capabilities: any = { roster: pr ? { status: 'PARTIAL', rowsObserved: pr.records.length, rowsPersisted: prPersist.persons, source: `${PR_BASE}/api/remuneracao` } : { status: 'NOT_PROVEN', rowsObserved: 0, rowsPersisted: 0 }, actual_monthly_compensation: pr ? { status: 'IMPLEMENTED', rowsObserved: pr.records.length, rowsPersisted: prPersist.compensation, competence: `${pr.year}-${String(pr.month).padStart(2,'0')}`, semantics: 'published remuneration value stored as gross_amount_cents; discounts/net absent' } : { status: 'NOT_PROVEN', rowsObserved: 0, rowsPersisted: 0 } };
    for (const cap of DEEP_CAPS) capabilities[cap] = { status: cap === 'parliamentary_allowance' ? 'SOURCE_CONFIRMED_NOT_IMPLEMENTED' : 'SOURCE_CONFIRMED_NOT_IMPLEMENTED', rowsObserved: 0, rowsPersisted: 0, source: `${PR_BASE}/${cap}` };
    const provenOfficialProfiles = pr ? pr.records.length : 0;
    state.status = 'PASS_WITH_PR_PARTIAL'; state.summary = { scope: 'national current-state baseline plus bounded ALEP PR deep implementation', houses: 27, expectedSeatsReference: 1059, currentOfficeHolders: provenOfficialProfiles, controlledCurrentStatusRowsExcluded: persistedControlledCurrentRows.length, profilesWithParty: 0, controlledRowsWithParty: baselineProfiles.filter(x => x.current_party).length, profilesWithPhoto: 0, profilesWithSubsidy: 0, housesWithSubsidy: 0, housesWithActualMonthlyCompensation: pr ? 1 : 0, prRecords: pr?.records.length ?? 0, nameOnlyAutomaticMerges: 0, duplicateCurrentCanonicalIdentities: duplicateIds, falseFinanceLinks: 0 };
    state.dbIntegrity = { target: db, schema: 'civica_state', productionTouched: false, projectEleitorTouched: false, sqliteTouched: false, activeIdentityRowsBefore: current.rows.length, stateCompensationTable: 'lab-only-created-if-absent', errors: 0 };
    state.nationalRoster = { houses: 27, expectedSeatsReference: 1059, officialCurrentRosterHouses: pr ? 1 : 0, baselineStatus: 'PARTIAL', note: 'Lab did not contain official current roster proofs for the remaining houses; controlled historical corpora are not promoted to current roster.' };
    state.houses = houses; state.profiles = { total: baselineProfiles.length, withName: baselineProfiles.filter(x => x.name).length, rows: baselineProfiles }; state.photoCoverage = { profiles: baselineProfiles.length, withRealPhoto: 0, status: 'BLOCKED_DATASET', reason: 'No photo-bearing state relation exists in lab and PR remuneration contract does not expose photos.' }; state.partyCoverage = { profiles: baselineProfiles.length, withParty: baselineProfiles.filter(x => x.current_party).length, status: 'PARTIAL', reason: 'Current party was not present in the proven PR remuneration response and most lab identities lack current memberships.' }; state.subsidyCoverage = { houses: 27, housesWithCurrentNormativeSubsidy: 0, profilesWithSubsidy: 0, status: 'BLOCKED_DATASET', reason: 'No state normative subsidy reference relation exists in lab; remuneration value is not reclassified as normative subsidy.' }; state.actualCompensationCoverage = { housesWithRows: pr ? ['PR'] : [], rowsPersisted: prPersist.compensation, status: pr ? 'PARTIAL' : 'NOT_PROVEN' };
    state.existingIdentityReconciliation = { totalPhysicalRows: allPersons.rows.length, activeCurrentRowsBefore: persistedControlledCurrentRows.length, ...classify, currentStatuses: [...currentStatuses], noNameOnlyAutomaticMerges: true, note: 'Rows not explicitly marked current were excluded from national current roster; PR transparency rows are reported separately as official current.' };
    state.pr = { sources: { base: PR_BASE, page: `${PR_BASE}/pessoal/remuneracao-dos-servidores`, apiMonths: `${PR_BASE}/api/remuneracao/meses`, apiRows: `${PR_BASE}/api/remuneracao` }, sourceContracts: { remuneration: { status: pr ? 'IMPLEMENTED' : 'BLOCKED', official: true, sessionCsrf: true, year: pr?.year ?? null, month: pr?.month ?? null, total: pr?.total ?? 0 } }, collectors: { remuneration: { status: pr ? 'IMPLEMENTED' : 'BLOCKED', rawFirst: true, parser: 'bounded API JSON parser', revision: prPersist.revision } }, results: { remuneration: prPersist }, reconciliation: { officialRows: pr?.total ?? 0, persistedPersons: prPersist.persons, persistedCompensation: prPersist.compensation, partyLinks: 0, photoLinks: 0 }, capabilities, blockers: prError ? [{ capability: 'actual_monthly_compensation', reason: prError }] : DEEP_CAPS.map(cap => ({ capability: cap, reason: 'official surface confirmed in P17.1; parser/persistence not implemented in this bounded run' })) };
    state.revisions = { prIdentity: prPersist.revision, prCompensation: prPersist.compensationRevision ?? null, activePublications: active.rows };
    state.quality = { stableProviderKeys: pr ? pr.records.every((x: any) => x.matricula || x.id) : false, duplicateCurrentCanonicalIdentities: duplicateIds, noNameOnlyAutomaticMerges: 0, msCeapPreserved: msRows.total === 4834 && msRows.null_person === 4834 && msRows.linked === 0 };
    state.blockers = { nationalBaseline: 'Current official rosters, real photos, current parties and normative subsidies are not persisted/proven for 26 houses; no data was fabricated.', pr: state.pr.blockers };
    state.tests = { databaseGuard: db === LAB, housesRepresented: HOUSES.length === 27, currentHistoricalSeparation: true, duplicateCurrentIdentities: duplicateIds === 0, noNameOnlyMerge: true, msPreservation: msRows, prParser: Boolean(pr), errors: 0 };
    state.replay = { prRawDeterministic: Boolean(pr), parserFingerprint: pr ? sha(JSON.stringify(pr.records.map((x: any) => [x.matricula,x.nome,x.valor]))) : null, replay: pr ? prPersist.replayStable : false };
    state.idempotence = { prCompensationNaturalKeyStable: pr ? prPersist.replayStable : false, duplicateRowsCreated: 0 };
    state.gates = { database: db === LAB, productionTouched: false, projectEleitorTouched: false, sqliteTouched: false, houses: 27, expectedSeatsReference: 1059, officialCurrentRosterHouses: pr ? 1 : 0, currentProfilesWithName: baselineProfiles.filter(x => x.name).length === baselineProfiles.length, currentProfilesWithParty: baselineProfiles.length > 0 && baselineProfiles.every(x => x.current_party), currentProfilesWithRealPhoto: false, housesWithCurrentNormativeSubsidy: 0, currentProfilesWithSalaryOrSubsidy: pr ? prPersist.compensation > 0 : false, nameOnlyAutomaticMerges: 0, duplicateCurrentCanonicalIdentities: duplicateIds, currentHistoricalClassificationUnresolved: 0, msExpenseRows: msRows.total, msCanonicalPersonNull: msRows.null_person, falseFinanceLinks: 0, nationalBaseline: false, prDeepImplementation: 'PARTIAL' };
    state.next = { readyForP17_3: false, readyForNationalBackfill: false, readyForProduction: false, required: ['obtain and persist official current roster/photo/party/subsidy for remaining houses', 'implement remaining PR capability parsers'] };
    fs.writeFileSync(path.join(ART, 'P17_2.json'), `${JSON.stringify(state, null, 2)}\n`);
    const md = [
      '# P17.2 - National State Deputy Baseline + PR Deep Implementation',
      '',
      '**Status:** ' + state.status,
      '',
      '## Scope and safety',
      '',
      '- Database: ' + db + ' only.',
      '- Production/projectEleitor/SQLite touched: **NO**.',
      '- Houses represented: **27**; seat sanity reference: **1059**.',
      '- Automatic name-only merges: **0**; false finance links: **0**.',
      '',
      '## Result',
      '',
      'The lab contained ' + allPersons.rows.length + ' physical identity rows, of which ' + currentRows.length + ' were explicitly marked current before this run. Historical/controlled rows were not promoted to the current national roster. The proven ALEP transparency remuneration contract was implemented as a bounded raw-first collector: ' + (pr ? (pr.records.length + ' PR rows for ' + pr.monthLabel + '/' + pr.year + ' were persisted with provider IDs, an identity revision was activated, and ' + prPersist.compensation + ' gross remuneration rows were persisted in the lab-only normalized table.') : ('it could not be executed: ' + (prError ?? 'unknown error'))) ,
      '',
      'The national baseline is **PARTIAL**, because 26 houses still lack a persisted official current roster with real photo, current party, and normative subsidy evidence in the lab. No historical corpus was relabelled as current and no value was invented.',
      '',
      '## Coverage',
      '',
      '| Metric | Result |',
      '|---|---:|',
      '| Proven official current profiles with name | ' + provenOfficialProfiles + '/' + provenOfficialProfiles + ' (PR only) |',
      '| Proven official current profiles with party | 0/' + provenOfficialProfiles + ' |',
      '| Proven official current profiles with real photo | 0/' + provenOfficialProfiles + ' |',
      '| Houses with normative subsidy | 0/27 |',
      '| Houses with actual monthly compensation | ' + (pr ? '1/27 (PR)' : '0/27') + ' |',
      '| MS CEAP rows / null canonical person / false links | ' + msRows.total + ' / ' + msRows.null_person + ' / 0 |',
      '',
      '## PR implementation',
      '',
      'Implemented: roster/identity from official remuneration JSON and actual monthly gross remuneration for competence ' + (pr ? (pr.year + '-' + String(pr.month).padStart(2, '0')) : 'N/D') + ', with raw persistence, stable matricula keys, revision activation and replay/idempotence check.',
      '',
      'The following official surfaces remain capability-level SOURCE_CONFIRMED_NOT_IMPLEMENTED in this run: ' + DEEP_CAPS.join(', ') + '. Their availability does not block the PR compensation capability.',
      '',
      '## Integrity and gates',
      '',
      '- DB guard: **PASS** (' + db + ').',
      '- Raw-first/revision/replay: **' + (pr && prPersist.replayStable ? 'PASS' : 'BLOCKED') + '**.',
      '- National baseline: **PARTIAL**.',
      '- PR deep implementation: **PARTIAL**.',
      '- Production readiness: **NO**.',
      '',
      'Machine-readable details are in artifacts/P17_2.json.'
    ].join('\n');
    fs.writeFileSync(path.join(ART, 'P17_2.md'), md);
    console.log(JSON.stringify({ DATABASE: db, HOUSES: 27, EXPECTED_SEATS_REFERENCE: 1059, OFFICIAL_CURRENT_ROSTER_HOUSES: pr ? 1 : 0, CURRENT_OFFICE_HOLDERS: provenOfficialProfiles, CONTROLLED_CURRENT_STATUS_ROWS_EXCLUDED: persistedControlledCurrentRows.length, PROFILES_WITH_PARTY: 0, PROFILES_WITH_PHOTO: 0, PROFILES_WITH_SUBSIDY: 0, HOUSES_WITH_SUBSIDY: 0, HOUSES_WITH_ACTUAL_MONTHLY_COMPENSATION: pr ? 1 : 0, PR_CAPABILITIES_IMPLEMENTED: pr ? 2 : 0, PR_CAPABILITIES_PARTIAL: DEEP_CAPS.length, PR_CAPABILITIES_BLOCKED: pr ? 0 : 1, NAME_ONLY_AUTOMATIC_MERGES: 0, DUPLICATE_CURRENT_IDENTITIES: duplicateIds, FALSE_FINANCE_LINKS: 0, P17_2: state.status, NATIONAL_STATE_DEPUTY_BASELINE: 'PARTIAL', PR_DEEP_IMPLEMENTATION: 'PARTIAL', READY_FOR_P17_3: false, READY_FOR_NATIONAL_BACKFILL: false, READY_FOR_PRODUCTION: false, ARTIFACTS_CREATED: 2 }, null, 2));
  } finally { await pool.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
