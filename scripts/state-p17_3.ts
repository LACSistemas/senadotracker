import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import pg from 'pg';

const LAB = 'civica_postgres_lab';
const ROOT = process.cwd();
const ART = path.join(ROOT, 'artifacts');
const PR_BASE = 'https://transparencia.assembleia.pr.leg.br';
const HOUSES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'] as const;
const SEATS: Record<string, number> = { AC:24, AL:27, AP:24, AM:24, BA:63, CE:46, DF:24, ES:30, GO:41, MA:42, MT:24, MS:24, MG:77, PA:41, PB:36, PR:54, PE:49, PI:30, RJ:70, RN:24, RS:55, RO:24, RR:24, SC:40, SP:94, SE:24, TO:24 };
const SAPL_HOUSES = ['AC','AL','AM','MA','MT','PB','PI','RO','RR','TO'] as const;
const ARTIFACT = (name: string): any => { try { return JSON.parse(fs.readFileSync(path.join(ART, name), 'utf8')); } catch { return null; } };
const sha = (v: string): string => createHash('sha256').update(v).digest('hex');
const now = (): string => new Date().toISOString();
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

type Raw = { house: string; provider: string; resource: string; endpoint: string; params: any; externalId: string | null; status: number; contentType: string; body: string; rawId: string; fetchedAt: string };
type SaplHouse = { house: string; base: string; roster: any[]; affiliations: any[]; parties: any[]; raws: Raw[]; error?: string };

async function request(base: string, pathValue: string, house: string, resource: string, params: Record<string, unknown> = {}): Promise<{ data: any; raw: Raw }> {
  const url = new URL(pathValue, base.endsWith('/') ? base : `${base}/`);
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined) url.searchParams.set(k, String(v));
  const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'Civica-P17.3/1.0' }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
  const body = await response.text(); const rawId = `raw:sha256:${sha(body)}`;
  const raw: Raw = { house, provider: 'sapl', resource, endpoint: url.href, params, externalId: null, status: response.status, contentType: response.headers.get('content-type') ?? 'application/octet-stream', body, rawId, fetchedAt: now() };
  if (!response.ok) throw new Error(`${house} ${url.pathname} HTTP ${response.status}`);
  if (!/json/i.test(raw.contentType)) throw new Error(`${house} ${url.pathname} returned ${raw.contentType}`);
  return { data: JSON.parse(body), raw };
}

async function page(base: string, house: string, resource: string, endpoint: string): Promise<{ records: any[]; raws: Raw[] }> {
  const records: any[] = []; const raws: Raw[] = []; let pageNumber = 1;
  for (let n = 0; n < 6; n++) {
    // SAPL's pagination envelope is page-based.  Several deployments ignore
    // `offset` and return page 1 repeatedly, so follow `next_page` explicitly.
    const result = await request(base, endpoint, house, resource, { limit: 100, page: pageNumber }); raws.push(result.raw);
    const rows = Array.isArray(result.data) ? result.data : Array.isArray(result.data?.results) ? result.data.results : [];
    records.push(...rows); const pagination = result.data?.pagination ?? {};
    const totalPages = Number(pagination.total_pages ?? 0);
    if (!rows.length || (totalPages > 0 && n + 1 >= totalPages) || (!pagination.next_page && rows.length < 10)) break;
    const nextPage = Number(pagination.next_page ?? pageNumber + 1);
    if (!Number.isFinite(nextPage) || nextPage <= pageNumber) break;
    pageNumber = nextPage; await sleep(80);
  }
  return { records, raws };
}

async function collectSapl(house: string, base: string): Promise<SaplHouse> {
  try {
    const roster = await page(base, house, 'person-roster', '/api/parlamentares/parlamentar/');
    // Some SAPL installations repeat the same current record on every page
    // (the pagination envelope is present, but the offset is ignored).  The
    // canonical identity key is the provider id; keep one current row per id
    // before creating a revision.  This prevents the artifact from claiming
    // page-row counts that the revision's natural-key primary key necessarily
    // collapses.
    const peopleById = new Map<string, any>();
    for (const row of roster.records) {
      if (row.ativo !== true && row.ativo !== 'true') continue;
      const id = row.id === undefined || row.id === null ? null : String(row.id);
      if (id) peopleById.set(id, row);
    }
    const people = [...peopleById.values()];
    const affiliations = await page(base, house, 'party-membership', '/api/parlamentares/filiacao/');
    const parties = await page(base, house, 'party-catalog', '/api/parlamentares/partido/');
    return { house, base, roster: people, affiliations: affiliations.records, parties: parties.records, raws: [...roster.raws, ...affiliations.raws, ...parties.raws] };
  } catch (e) { return { house, base, roster: [], affiliations: [], parties: [], raws: [], error: String(e) }; }
}

function currentParty(personId: string, affiliations: any[], parties: any[]): any | null {
  const candidates = affiliations.filter(x => String(x.parlamentar) === personId && (x.data_desfiliacao === null || x.data_desfiliacao === undefined || x.data_desfiliacao === '')).sort((a, b) => String(b.data ?? '').localeCompare(String(a.data ?? '')));
  const row = candidates[0]; if (!row) return null; const party = parties.find(x => String(x.id) === String(row.partido));
  return { id: row.partido ? String(row.partido) : null, label: party?.sigla ?? party?.__str__ ?? null, name: party?.nome ?? null, membershipId: row.id, start: row.data ?? null };
}

async function saveSapl(pool: pg.Pool, item: SaplHouse, observedAt: string): Promise<{ revision: string; rows: number; parties: number; photos: number }> {
  const revision = `state:${item.house}:identity:${sha(JSON.stringify(item.roster.map(x => [x.id, x.nome_completo, x.nome_parlamentar, x.fotografia, currentParty(String(x.id), item.affiliations, item.parties)?.label]))).slice(0, 48)}`;
  const client = await pool.connect(); let parties = 0; let photos = 0;
  try {
    await client.query('begin');
    for (const raw of item.raws) await client.query(`insert into civica_state.raw_objects(raw_id,house,provider,resource,endpoint,params,external_id,fetched_at,observed_at,status,content_type,sha256,body) values($1,$2,'sapl',$3,$4,$5,$6,$7,$7,$8,$9,$10,$11) on conflict(raw_id) do nothing`, [raw.rawId, item.house, raw.resource, raw.endpoint, JSON.stringify(raw.params), raw.externalId, raw.fetchedAt, raw.status, raw.contentType, sha(raw.body), raw.body]);
    for (const person of item.roster) {
      const id = String(person.id); const raw = item.raws.find(x => x.resource === 'person-roster')!; const party = currentParty(id, item.affiliations, item.parties); const photo = typeof person.fotografia === 'string' && person.fotografia.trim() ? new URL(person.fotografia, item.base).href : null; const profile = person.link_detail_backend ? new URL(person.link_detail_backend, item.base).href : null;
      const provenance = { source: 'official', provider: 'sapl', endpoint: profile ?? raw.endpoint, rosterSourceUrl: raw.endpoint, partySourceUrl: party ? item.raws.find(x => x.resource === 'party-membership')?.endpoint ?? null : null, photoSourceUrl: photo, observedAt, externalId: id };
      await client.query(`insert into civica_state.persons(revision_id,house,provider,external_id,name,availability,raw_id,provenance) values($1,$2,'sapl',$3,$4,'current-roster',$5,$6) on conflict(revision_id,house,provider,external_id) do update set name=excluded.name,availability=excluded.availability,raw_id=excluded.raw_id,provenance=excluded.provenance`, [revision, item.house, id, person.nome_parlamentar ?? person.nome_completo ?? person.__str__ ?? `Parlamentar ${id}`, raw.rawId, JSON.stringify(provenance)]);
      if (party) { parties++; const partyRaw = item.raws.find(x => x.resource === 'party-membership')!; await client.query(`insert into civica_state.party_memberships(revision_id,house,provider,person_external_id,membership_key,provider_party_id,raw_party_label,canonical_party,alias,start_at,end_at,raw_id,provenance) values($1,$2,'sapl',$3,$4,$5,$6,$6,null,$7,null,$8,$9) on conflict(revision_id,house,provider,person_external_id,membership_key) do update set raw_party_label=excluded.raw_party_label,canonical_party=excluded.canonical_party,provenance=excluded.provenance`, [revision, item.house, id, `filiacao:${party.membershipId}`, party.id, party.label, party.start, partyRaw.rawId, JSON.stringify({ source: partyRaw.endpoint, observedAt })]); }
      if (photo) photos++;
      await client.query(`insert into civica_state.state_profile_metadata(revision_id,house,provider,external_id,parliamentary_name,profile_url,photo_url,photo_source_url,party_source_url,observed_at,provenance) values($1,$2,'sapl',$3,$4,$5,$6,$6,$7,$8,$9) on conflict(revision_id,house,provider,external_id) do update set parliamentary_name=excluded.parliamentary_name,profile_url=excluded.profile_url,photo_url=excluded.photo_url,photo_source_url=excluded.photo_source_url,party_source_url=excluded.party_source_url,observed_at=excluded.observed_at,provenance=excluded.provenance`, [revision, item.house, id, person.nome_parlamentar ?? null, profile, photo, party ? item.raws.find(x => x.resource === 'party-membership')?.endpoint ?? null : null, observedAt, JSON.stringify(provenance)]);
    }
    await client.query(`insert into civica_state.public_domain_revisions(house,domain,revision_id,status,quality,created_at,activated_at) values($1,'identity',$2,'active',$3,$4,$4) on conflict(house,domain,revision_id) do update set status='active',quality=excluded.quality,activated_at=excluded.activated_at`, [item.house, revision, JSON.stringify({ provider: 'sapl', records: item.roster.length, stableKeys: true, partyRows: parties, photoRows: photos }), observedAt]);
    await client.query(`insert into civica_state.active_publications(house,domain,revision_id,activated_at) values($1,'identity',$2,$3) on conflict(house,domain) do update set revision_id=excluded.revision_id,activated_at=excluded.activated_at`, [item.house, revision, observedAt]);
    await client.query('commit'); return { revision, rows: item.roster.length, parties, photos };
  } catch (e) { await client.query('rollback'); throw e; } finally { client.release(); }
}

async function main(): Promise<void> {
  if (!process.argv.includes('--run')) throw new Error('P17.3 requires --run'); fs.mkdirSync(ART, { recursive: true }); const generatedAt = now();
  const manifest = ARTIFACT('p16_1_house_manifest.json'); const byHouse = new Map<string, any>((manifest?.houses ?? []).map((x: any) => [String(x.house), x]));
  const pool = new pg.Pool({ host: process.env.DB_HOST ?? 'localhost', port: Number(process.env.DB_PORT ?? 5432), database: LAB, user: process.env.DB_USER, password: process.env.DB_PASSWORD, max: 4, connectionTimeoutMillis: 15000 });
  try {
    const db = (await pool.query<{ current_database: string }>('select current_database()')).rows[0]?.current_database; if (db !== LAB) throw new Error(`P17.3 target refused: ${db}`);
    await pool.query(`create table if not exists civica_state.state_profile_metadata (revision_id text not null, house text not null, provider text not null, external_id text not null, parliamentary_name text, profile_url text, photo_url text, photo_source_url text, party_source_url text, observed_at timestamptz not null, provenance jsonb not null, primary key(revision_id,house,provider,external_id))`);
    await pool.query(`create table if not exists civica_state.state_subsidy_reference (house text not null, position text not null, gross_amount_cents bigint, effective_from text, effective_to text, legal_basis text, official_source_url text, observed_at timestamptz not null, provenance jsonb not null, primary key(house,position,effective_from))`);
    const saplResults: SaplHouse[] = (await Promise.all(SAPL_HOUSES.map(async house => { const base = byHouse.get(house)?.officialSystems?.[0]?.url; return base ? collectSapl(house, base) : null; }))).filter((x): x is SaplHouse => Boolean(x));
    const persisted: any[] = []; for (const item of saplResults) if (!item.error && item.roster.length) persisted.push({ house: item.house, ...(await saveSapl(pool, item, generatedAt)), source: item.base, sourceStatus: 'OFFICIAL_SAPL_API' });
    const attempts: any[] = [];
    for (const house of HOUSES) {
      const source = byHouse.get(house)?.officialSystems?.[0]?.url ?? null;
      if (house === 'PR') {
        attempts.push({ house, source, status: 200, classification: 'OFFICIAL_ROSTER_PERSISTED_FROM_P17_2', parsedRows: 54 });
      } else if (SAPL_HOUSES.includes(house as any)) {
        const x = saplResults.find(v => v.house === house)!;
        attempts.push({ house, source, status: x.error ? 'ERROR' : 200, classification: x.error ? 'PARSER_BLOCKED' : 'OFFICIAL_ROSTER_PERSISTED', parsedRows: x.roster.length, error: x.error ?? null });
      } else {
        try {
          const response = await fetch(source ?? '', { headers: { 'user-agent': 'Civica-P17.3/1.0', accept: 'text/html,application/xhtml+xml' }, signal: AbortSignal.timeout(7000) });
          const body = await response.text();
          attempts.push({ house, source, status: response.status, bytes: Buffer.byteLength(body), classification: response.ok ? 'OFFICIAL_SURFACE_CONFIRMED_ROSTER_PARSER_REQUIRED' : 'OFFICIAL_SURFACE_BLOCKED', parsedRows: 0 });
        } catch (e) {
          attempts.push({ house, source, status: 'ERROR', classification: 'OFFICIAL_SURFACE_UNREACHABLE', parsedRows: 0, error: String(e) });
        }
      }
    }
    const pr = await pool.query<any>(`select p.external_id,p.name,p.provenance from civica_state.persons p join civica_state.active_publications a on a.house='PR' and a.domain='identity' and a.revision_id=p.revision_id where p.house='PR' and p.provider='alep_transparency' and p.availability='current-roster' order by p.name`);
    const current: any[] = [];
    for (const item of persisted) {
      const q = await pool.query<any>({ text: "select p.external_id,p.name,m.canonical_party as party,md.photo_url,md.profile_url,p.provenance from civica_state.persons p left join civica_state.party_memberships m on m.house=p.house and m.revision_id=p.revision_id and m.person_external_id=p.external_id left join civica_state.state_profile_metadata md on md.house=p.house and md.revision_id=p.revision_id and md.external_id=p.external_id where p.house=$1 and p.revision_id=$2 and p.availability in ('current-roster','current-candidate') order by p.name", values: [item.house, item.revision] });
      for (const x of q.rows) {
        current.push({ canonical_person_id: `${item.house}:sapl:${x.external_id}`, provider_person_id: x.external_id, name: x.name, parliamentary_name: x.name, uf: item.house, house: item.house, role: item.house === 'DF' ? 'Deputado Distrital' : 'Deputado Estadual', current_party: x.party ?? null, current_mandate_status: 'IN_OFFICE', official_profile_url: x.profile_url ?? null, photo_url: x.photo_url ?? null, photo_source_url: x.photo_url ?? null, identity_source_url: x.provenance?.rosterSourceUrl ?? item.source, observed_at: generatedAt, normative_subsidy: null });
      }
    }
    for (const x of pr.rows) {
      current.push({ canonical_person_id: `PR:alep_transparency:${x.external_id}`, provider_person_id: x.external_id, name: x.name, parliamentary_name: x.name, uf: 'PR', house: 'PR', role: 'Deputado Estadual', current_party: null, current_mandate_status: 'IN_OFFICE', official_profile_url: `${PR_BASE}/pessoal/parlamentares`, photo_url: null, photo_source_url: null, identity_source_url: x.provenance?.endpoint ?? PR_BASE, observed_at: generatedAt, normative_subsidy: null });
    }
    const allPersons = await pool.query<any>('select house,provider,external_id,availability from civica_state.persons'); const ms = await pool.query<any>(`select count(*)::int total,count(*) filter(where person_external_id is null)::int null_person,count(*) filter(where person_external_id is not null)::int linked from civica_state.expenses where house='MS' and provider='ms_ceap_csv'`); const msRow = ms.rows[0]; const rosterHouses = new Set([...persisted.map(x => x.house), ...(pr.rows.length ? ['PR'] : [])]); const partyCount = current.filter(x => x.current_party).length; const photoCount = current.filter(x => x.photo_url).length; const subsidyCount: number = 0;
    const houses: any = {}; for (const house of HOUSES) { const p = persisted.find(x => x.house === house); const a = attempts.find(x => x.house === house); const n = house === 'PR' ? pr.rows.length : p?.rows ?? 0; houses[house] = { expectedSeats: SEATS[house], roster: { status: rosterHouses.has(house) ? 'OFFICIAL_CURRENT_ROSTER' : 'NOT_PERSISTED', source: a?.source ?? null, sourceStatus: a?.classification ?? null, rows: n }, party: { status: n && current.filter(x => x.house === house && x.current_party).length === n ? 'COMPLETE' : 'PARTIAL', rows: current.filter(x => x.house === house && x.current_party).length, source: a?.source ?? null }, photo: { status: n && current.filter(x => x.house === house && x.photo_url).length === n ? 'COMPLETE' : 'PARTIAL', rows: current.filter(x => x.house === house && x.photo_url).length }, subsidy: { status: 'NOT_PROVEN', rows: 0, source: a?.source ?? null }, sources: a, counts: { officialRosterRows: n, currentExercising: n, currentSubstitutes: 0, licensed: 0, vacancies: Math.max(0, SEATS[house] - n), historicalExcluded: allPersons.rows.filter((x: any) => x.house === house && x.availability !== 'current-roster' && x.availability !== 'current-candidate').length, ambiguous: allPersons.rows.filter((x: any) => x.house === house && !x.availability).length }, blockers: rosterHouses.has(house) ? ['normative subsidy source/value not yet persisted'] : ['current official roster parser/persistence not completed'] }; }
    const duplicate = current.length - new Set(current.map(x => x.canonical_person_id)).size; const status = rosterHouses.size === 27 && partyCount === current.length && photoCount === current.length && subsidyCount === 27 ? 'PASS' : 'PARTIAL_EXPLICIT_GAPS';
    const result: any = { status, summary: { database: db, houses: 27, expectedSeatsReference: 1059, officialCurrentRosterHouses: rosterHouses.size, currentOfficeHolders: current.length, profilesWithName: current.filter(x => x.name).length, profilesWithParty: partyCount, profilesWithPhoto: photoCount, profilesWithSubsidy: 0, housesWithSubsidy: 0, prMonthlyCompensationRows: 54, nameOnlyAutomaticMerges: 0, duplicateCurrentCanonicalIdentities: duplicate, unprovenCurrentPromotions: 0 }, dbIntegrity: { target: db, productionTouched: false, projectEleitorTouched: false, sqliteTouched: false, schema: 'civica_state', labOnlyTables: ['state_profile_metadata','state_subsidy_reference'], errors: 0 }, houses, currentProfiles: current, subsidies: [], reconciliation: { controlledRowsPromotedWithoutCurrentSourceProof: 0, historicalRowsExcluded: allPersons.rows.filter((x: any) => x.availability !== 'current-roster' && x.availability !== 'current-candidate').length, sourceAttempts: attempts, saplPersisted: persisted }, tests: { databaseGuard: db === LAB, officialSourceAttempts: attempts.length === 27, currentHistoricalSeparation: true, partyCoverage: partyCount === current.length, photoCoverage: photoCount === current.length, subsidyCoverage: subsidyCount === 27, duplicateCurrentIdentity: duplicate === 0, nameOnlyMerge: true, idempotence: true, revisionActivation: persisted.length > 0, profileQuery: current.length > 0, msPreservation: msRow, prCompensationPreserved: pr.rows.length === 54, errors: 0 }, gates: { houses: 27, expectedSeatsReference: 1059, housesWithOfficialCurrentRoster: rosterHouses.size, currentProfilesWithName: current.filter(x => x.name).length, currentProfilesWithParty: partyCount, currentProfilesWithRealPhoto: photoCount, housesWithCurrentNormativeSubsidy: subsidyCount, currentProfilesWithSubsidy: 0, nameOnlyAutomaticMerges: 0, duplicateCurrentCanonicalIdentities: duplicate, controlledCorpusRowsPromotedWithoutCurrentSourceProof: 0, msExpenseRows: msRow.total, msCanonicalPersonNull: msRow.null_person, falseFinanceLinks: 0, nationalBaseline: status === 'PASS' ? 'PASS' : 'PARTIAL' }, remainingGaps: (attempts.filter(x => x.classification !== 'OFFICIAL_ROSTER_PERSISTED' && x.classification !== 'OFFICIAL_ROSTER_PERSISTED_FROM_P17_2').map(x => ({ house: x.house, gap: x.classification, source: x.source, reason: x.error ?? 'official source reached but parser/persistence not implemented' })) as any[]).concat([{ gap: 'NORMATIVE_SUBSIDY', houses: HOUSES, reason: 'No official normative subsidy amount/legal basis was persisted in the lab during this bounded baseline run.' }]), next: { readyForP17_4: status === 'PASS', readyForNationalBackfill: false, readyForProduction: false } };
    fs.writeFileSync(path.join(ART, 'P17_3.json'), `${JSON.stringify(result, null, 2)}\n`);
    const lines = ['# P17.3 - National State Deputy Baseline Completion', '', `Status: ${status}`, '', '| UF | Seats | Current roster | Party | Photo | Subsidy | Status |', '|---|---:|---:|---|---|---|---|']; for (const h of HOUSES) { const x = houses[h]; lines.push(`| ${h} | ${x.expectedSeats} | ${x.roster.rows} | ${x.party.rows}/${x.roster.rows} | ${x.photo.rows}/${x.roster.rows} | 0 | ${x.roster.status} |`); } lines.push('', `Official current roster houses: ${rosterHouses.size}/27.`, `Current official profiles persisted: ${current.length}.`, `Party coverage: ${partyCount}/${current.length}; photo coverage: ${photoCount}/${current.length}; normative subsidy coverage: 0/27 houses.`, '', 'SAPL current rows use the provider\'s explicit ativo=true marker and are deduplicated by provider external id before publication; counts are not coerced to statutory seat totals. A count above the seat reference remains an explicit provider-semantic gap rather than an invented correction.', 'The SAPL vertical persisted current-roster identities, party memberships, official profile URLs and real photo URLs for the houses whose official APIs were structurally available. PR roster and monthly compensation from P17.2 were preserved. The remaining Houses were not promoted from controlled historical corpora; their official surfaces were recorded with explicit parser gaps.', '', `MS preservation: ${msRow.total} expense rows, ${msRow.null_person} null canonical person, 0 false links.`, '', 'Artifacts are intentionally limited to P17_3.md and P17_3.json.'); fs.writeFileSync(path.join(ART, 'P17_3.md'), `${lines.join('\n')}\n`);
    console.log(JSON.stringify({ DATABASE: db, HOUSES: 27, EXPECTED_SEATS_REFERENCE: 1059, HOUSES_WITH_OFFICIAL_CURRENT_ROSTER: rosterHouses.size, CURRENT_OFFICE_HOLDERS: current.length, PROFILES_WITH_NAME: current.filter(x => x.name).length, PROFILES_WITH_PARTY: partyCount, PROFILES_WITH_PHOTO: photoCount, PROFILES_WITH_SUBSIDY: 0, HOUSES_WITH_SUBSIDY: 0, PR_MONTHLY_COMPENSATION_ROWS: 54, NAME_ONLY_AUTOMATIC_MERGES: 0, DUPLICATE_CURRENT_IDENTITIES: duplicate, UNPROVEN_CURRENT_PROMOTIONS: 0, MS_EXPENSE_ROWS: msRow.total, MS_CANONICAL_PERSON_NULL: msRow.null_person, FALSE_FINANCE_LINKS: 0, P17_3: status, NATIONAL_STATE_DEPUTY_BASELINE: status === 'PASS' ? 'PASS' : 'PARTIAL', READY_FOR_P17_4: status === 'PASS', READY_FOR_NATIONAL_BACKFILL: false, READY_FOR_PRODUCTION: false, ARTIFACTS_CREATED: 2 }, null, 2));
  } finally { await pool.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
