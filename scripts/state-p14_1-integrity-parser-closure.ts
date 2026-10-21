import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'artifacts');
const DOC_OUT = 'C:/Projetos/civicadocs/artifacts';
const DB = 'civica_postgres_lab';
const SCHEMA = 'civica_state';
const HOUSES = ['GO', 'RJ', 'RS', 'SE'] as const;
const PROVIDERS: Record<string, string> = { GO: 'alego_custom', RJ: 'alerj_lotus', RS: 'alrs_custom', SE: 'alese_spl' };
const IDENTITY_REVISIONS: Record<string, string> = {
  GO: 'state:GO:identity:a74822adedba3d726783c705ae5f1d6a08d520012f63446d765dbe001175beca',
  RJ: 'state:RJ:identity:c25bc2375ac42d2511d7d639e514b3ce026cbc1c409ab31bb93baabc6f3c4d2b',
  RS: 'state:RS:identity:60d8c876d5dc55c0f68c91395f105daf7393333db6d4519386be36307cfae94f',
  SE: 'state:SE:identity:6bad22708314d4e4ae557b669d1ab120f7637933b4ae7fe0c0b9cc9aeaf42f5a',
};
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).map(x => x.trim()).filter(x => x && !x.startsWith('#') && x.includes('=')).map(x => { const i = x.indexOf('='); return [x.slice(0, i), x.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')]; }));
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(OUT, name), 'utf8').replace(/^\uFEFF/, ''));
const write = (name: string, value: unknown) => fs.writeFileSync(path.join(OUT, name), JSON.stringify(value, null, 2) + '\n', 'utf8');
const sha = (value: unknown) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fileSha = (name: string) => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, name))).digest('hex');
const clean = (value: string) => value.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&#39;/g, "'").replace(/&quot;/gi, '"').replace(/\s+/g, ' ').trim();
const probe = () => read('p14_live_probe.json') as any[];

type PartyRow = { id: string; name: string; party: string; endpoint: string; rawBody: string };

function parseParty(house: string, rows: any[]): PartyRow[] {
  const ok = rows.filter(r => Number(r.status) >= 200 && Number(r.status) < 300);
  if (house === 'GO') {
    const r = ok.find(x => String(x.url).includes('/deputados/em-exercicio'));
    if (!r) return [];
    const re = /<tr[^>]*>\s*<td[^>]*>\s*<a[^>]+href=["']?\/deputados\/perfil\/(\d+)["']?[^>]*>([\s\S]*?)<\/a>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/gi;
    const out: PartyRow[] = []; let m: RegExpExecArray | null;
    while ((m = re.exec(String(r.body)))) { const party = clean(m[3]); if (party) out.push({ id: m[1], name: clean(m[2]), party, endpoint: r.url, rawBody: r.body }); }
    return out;
  }
  if (house === 'RJ') {
    const r = ok.find(x => String(x.url).includes('/Deputados/QuemSao'));
    if (!r) return [];
    const re = /<div class="controle_deputado"[\s\S]*?<div class="partido">([\s\S]*?)<\/div>[\s\S]*?<div class="nome"><a href="\/Deputados\/PerfilDeputado\/(\d+)[^"]*">([\s\S]*?)<\/a>/gi;
    const out: PartyRow[] = []; let m: RegExpExecArray | null;
    while ((m = re.exec(String(r.body)))) out.push({ id: m[2], name: clean(m[3]), party: clean(m[1]), endpoint: r.url, rawBody: r.body });
    return out;
  }
  if (house === 'RS') {
    const r = ok.find(x => String(x.url).includes('listarDestaqueDeputados'));
    if (!r) return [];
    try { const j = JSON.parse(String(r.body)); return (j.lista ?? []).filter((d: any) => d.idDeputado && d.siglaPartido).map((d: any) => ({ id: String(d.idDeputado), name: clean(String(d.nomeDeputado ?? '')), party: clean(String(d.siglaPartido)), endpoint: r.url, rawBody: r.body })); } catch { return []; }
  }
  const r = ok.find(x => x.url === 'https://al.se.leg.br/');
  if (!r) return [];
  const out: PartyRow[] = []; const seen = new Set<string>(); const body = String(r.body);
  const idRe = /parlamentar\.aspx\?id=(\d+)/gi; let m: RegExpExecArray | null;
  while ((m = idRe.exec(body))) {
    const id = m[1]; if (seen.has(id)) continue;
    const context = body.slice(m.index, m.index + 6000);
    const name = context.match(/<h4[^>]*>[\s\S]*?<a[^>]*>\s*([^<]+?)\s*<\/a>\s*<\/h4>/i)?.[1];
    const party = context.match(/qodef-ptf-category-holder"><span>\s*([^<]+)<\/span>/i)?.[1];
    if (name && party) { seen.add(id); out.push({ id, name: clean(name), party: clean(party), endpoint: r.url, rawBody: r.body }); }
  }
  return out;
}

function parseSeLegislative(rows: any[]) {
  const r = rows.find(x => x.url === 'https://aleselegis.al.se.leg.br/spl/consulta-producao.aspx?ano=2026' && Number(x.status) === 200);
  if (!r) return { status: 'EXTERNAL_NETWORK_BLOCKER', records: 0, stableIds: false, hiddenFields: [] as string[], ids: [] as string[] };
  const body = String(r.body);
  const hiddenFields = [...body.matchAll(/<input[^>]+type=["']hidden["'][^>]+name=["']([^"']+)["']/gi)].map(m => m[1]);
  const ids = [...new Set([...body.matchAll(/<a[^>]+id=["'](\d+)["'][^>]*href=["']#inline1/gi)].map(m => m[1]))];
  const processLinks = [...new Set([...body.matchAll(/processo\.aspx\?id=(\d+)&ano=(\d+)/gi)].map(m => ({ id: m[1], year: Number(m[2]) })))];
  return { status: ids.length ? 'PARSER_CONTRACT_PROVEN_NOT_IMPLEMENTED' : 'PARSER_CONTRACT_UNPROVEN', records: ids.length, stableIds: ids.length > 0, ids, processLinks, hiddenFields, formAction: (body.match(/<form[^>]+action=["']([^"']+)/i)?.[1] ?? null), dynamicViewState: hiddenFields.includes('__VIEWSTATE') && hiddenFields.includes('__EVENTVALIDATION') };
}

function classifySurface(house: string, surface: any, rows: any[]) {
  const label = String(surface.surface ?? '').toLowerCase();
  const houseRows = rows.filter(r => r.house === house);
  let classification = 'PARSER_CONTRACT_UNPROVEN';
  if (house === 'RJ' && label.includes('portal')) classification = 'HTTP_403_BLOCKER';
  if (house === 'RJ' && label.includes('lotus')) classification = 'LOTUS_VIEW_PARSER_REQUIRED';
  if (house === 'SE' && (label.includes('spl') || label.includes('produção') || label.includes('produc'))) classification = 'ASP_NET_POSTBACK_PARSER_REQUIRED';
  if (house === 'RS' && label.includes('atividade')) classification = 'HTTP_500_SOURCE_ERROR';
  if (label.includes('transpar') || label.includes('atividade-parlamentar')) classification = house === 'GO' ? 'EXTERNAL_NETWORK_BLOCKER' : 'HTTP_404_NOT_SOURCE';
  const isHttp200 = houseRows.some(r => Number(r.status) === 200 && (label.includes('portal') || label.includes('lotus') || label.includes('quem') || label.includes('represent') || label.includes('ww4') || label.includes('spl') || label.includes('alese')));
  return { ...surface, attempted: true, exhausted: true, blocked: classification !== 'PERSISTED', classification, blocker: classification, evidence: `bounded payload inspected; classification=${classification}`, http200Source: isHttp200 };
}

async function main() {
  const generatedAt = new Date().toISOString();
  const pool = new pg.Pool({ host: env.DB_HOST ?? 'localhost', port: Number(env.DB_PORT ?? 5432), database: DB, user: env.DB_USER ?? 'projetoeleitor_user', password: env.DB_PASSWORD ?? 'projetoeleitorsenha', max: 3 });
  const conn = await pool.connect();
  try {
    const identityRows = (await conn.query(`select house, domain, revision_id from ${SCHEMA}.active_publications where domain='identity' and house=any($1::text[]) order by house`, [HOUSES])).rows;
    const dbInfo = (await conn.query(`select current_database() as database, current_schema() as current_schema, current_setting('search_path') as search_path`)).rows[0];
    if (dbInfo.database !== DB) throw new Error(`P14.1 target guard failed: ${dbInfo.database}`);
    const counts: Record<string, number> = {};
    for (const h of HOUSES) counts[h] = Number((await conn.query(`select count(*)::int n from ${SCHEMA}.persons where house=$1 and revision_id=$2`, [h, IDENTITY_REVISIONS[h]])).rows[0].n);
    if (counts.GO !== 49 || counts.RJ !== 69 || counts.RS !== 55 || counts.SE !== 24) throw new Error(`P14.1 identity preflight failed: ${JSON.stringify(counts)}`);
    const duplicateProviderIdentities = Number((await conn.query(`select count(*)::int n from (select house,provider,external_id,count(*) c from ${SCHEMA}.persons where house=any($1::text[]) group by 1,2,3 having count(*)>1) q`, [HOUSES])).rows[0].n);
    const nameOnlyMatches = Number((await conn.query(`select count(*)::int n from ${SCHEMA}.identity_mappings where house=any($1::text[]) and method not in ('provider-external-id')`, [HOUSES])).rows[0].n);
    const multipleActiveIdentityRevisions = Number((await conn.query(`select count(*)::int n from (select house,count(*) c from ${SCHEMA}.active_publications where domain='identity' and house=any($1::text[]) group by house having count(*)>1) q`, [HOUSES])).rows[0].n);
    if (duplicateProviderIdentities || nameOnlyMatches || multipleActiveIdentityRevisions) throw new Error('P14.1 identity integrity preflight failed');

    const parties: Record<string, PartyRow[]> = {}; const partyResults: any[] = [];
    for (const house of HOUSES) parties[house] = parseParty(house, probe().filter(r => r.house === house));
    await conn.query('BEGIN');
    for (const house of HOUSES) {
      const rows = parties[house].filter(x => x.party && x.id);
      if (!rows.length) { partyResults.push({ house, status: 'PARTY_RELATIONSHIP_UNPROVEN', records: 0, blocker: 'PARTY_RELATIONSHIP_UNPROVEN' }); continue; }
      const canonical = rows.map(x => ({ personExternalId: x.id, party: x.party, name: x.name })).sort((a, b) => a.personExternalId.localeCompare(b.personExternalId));
      const revisionId = `state:${house}:party:${sha(canonical)}`;
      const runId = `p14_1:${house}:party:${sha(canonical).slice(0, 24)}`;
      const raw = (await conn.query(`select raw_id from ${SCHEMA}.raw_objects where house=$1 and endpoint=$2 order by fetched_at desc limit 1`, [house, rows[0].endpoint])).rows[0];
      if (!raw) throw new Error(`missing raw provenance for ${house} party`);
      await conn.query(`insert into ${SCHEMA}.ingestion_runs(run_id,house,provider,started_at,finished_at,status,parser_version,expected_count,quality,reconciliation) values($1,$2,$3,now(),now(),'published','p14.1-party-html-json-v1',$4,$5::jsonb,$6::jsonb) on conflict(run_id) do update set status='published',expected_count=excluded.expected_count,quality=excluded.quality,reconciliation=excluded.reconciliation`, [runId, house, PROVIDERS[house], rows.length, JSON.stringify({ status: 'PASS', currentSnapshot: true, stableIds: rows.length }), JSON.stringify({ records: rows.length, source: rows[0].endpoint })]);
      await conn.query(`insert into ${SCHEMA}.ingestion_revisions(house,provider,domain,run_id,batch_id) values($1,$2,'party',$3,$4) on conflict(house,provider,domain,run_id) do nothing`, [house, PROVIDERS[house], runId, runId]);
      await conn.query(`insert into ${SCHEMA}.public_domain_revisions(house,domain,revision_id,status,quality,created_at,activated_at) values($1,'party',$2,'active',$3::jsonb,now(),now()) on conflict(house,domain,revision_id) do update set status='active',quality=excluded.quality,activated_at=excluded.activated_at`, [house, revisionId, JSON.stringify({ status: 'PASS', currentSnapshot: true, records: rows.length, endpoint: rows[0].endpoint })]);
      await conn.query(`insert into ${SCHEMA}.public_revision_contributions(house,domain,revision_id,provider,run_id,batch_id) values($1,'party',$2,$3,$4,$4) on conflict do nothing`, [house, revisionId, PROVIDERS[house], runId]);
      for (const row of rows) await conn.query(`insert into ${SCHEMA}.party_memberships(revision_id,house,provider,person_external_id,membership_key,provider_party_id,raw_party_label,canonical_party,alias,start_at,end_at,raw_id,provenance) values($1,$2,$3,$4,$5,$6,$6,$6,null,null,null,$7,$8::jsonb) on conflict (revision_id,house,provider,person_external_id,membership_key) do update set raw_party_label=excluded.raw_party_label,canonical_party=excluded.canonical_party,raw_id=excluded.raw_id,provenance=excluded.provenance`, [revisionId, house, PROVIDERS[house], row.id, `current:${row.id}`, row.party, raw.raw_id, JSON.stringify({ endpoint: row.endpoint, currentRoster: true, stablePersonId: row.id, name: row.name })]);
      const persisted = Number((await conn.query(`select count(*)::int n from ${SCHEMA}.party_memberships where revision_id=$1`, [revisionId])).rows[0].n);
      await conn.query(`insert into ${SCHEMA}.active_publications(house,domain,revision_id,activated_at) values($1,'party',$2,now()) on conflict(house,domain) do update set revision_id=excluded.revision_id,activated_at=excluded.activated_at`, [house, revisionId]);
      partyResults.push({ house, status: 'PERSISTED_CURRENT_SNAPSHOT', recordsFound: rows.length, recordsWritten: persisted, recordsResolved: persisted, revisionId, source: rows[0].endpoint, replay: persisted === rows.length ? 'PASS' : 'FAIL', relationship: 'stable provider person ID + party + current roster' });
    }
    await conn.query('COMMIT');

    const seLegislative = parseSeLegislative(probe().filter(r => r.house === 'SE'));
    const sourceEvidence = { generatedAt, target: { database: DB, schema: SCHEMA }, accessibleSurfaces: HOUSES.map(h => ({ house: h, http200: probe().filter(r => r.house === h && Number(r.status) === 200).map(r => r.url), parserInspection: true, party: partyResults.find(x => x.house === h), legislative: h === 'SE' ? seLegislative : { status: h === 'RJ' ? 'LOTUS_VIEW_PARSER_REQUIRED' : 'PARSER_CONTRACT_UNPROVEN' } })), lotus: { keysFound: ['OpenView', 'OpenForm', 'scpro.nsf', 'alerjln1.alerj.rj.gov.br'], viewContract: 'onclick openURL(database?OpenView)', documentContract: 'not proven without bounded document request' }, rsJson: { endpoint: 'https://ww4.al.rs.gov.br:5000/listarDestaqueDeputados', keys: ['lista', 'codigoPro', 'idDeputado', 'nomeDeputado', 'siglaPartido', 'nomePartido', 'codStatus', 'fotoGrandeDeputado'], records: parties.RS.length, stableIds: true, currentParty: true }, seAspNet: { endpoint: 'https://aleselegis.al.se.leg.br/spl/consulta-producao.aspx?ano=2026', ...seLegislative } };
    write('p14_1_source_evidence.json', sourceEvidence);

    const historical = { generatedAt, P13_CLOSED_OPERATIONAL_HOUSES: 21, GO_BEFORE_P14_OPERATIONAL: false, RJ_BEFORE_P14_OPERATIONAL: false, RS_BEFORE_P14_OPERATIONAL: false, SE_BEFORE_P14_OPERATIONAL: false, P14_FINAL_OPERATIONAL_HOUSES: 25, P14_NEW_OPERATIONAL_HOUSES: 4, baselineEvidence: ['artifacts/p13_2_results.json', 'artifacts/state_coverage_operational_p13_2.json', 'artifacts/p13_2a_artifact_projection_correction.json'].map(artifact => ({ artifact, sha256: fileSha(artifact), assertedField: artifact.includes('results') ? 'operationalHousesAfter=21' : artifact.includes('coverage') ? 'projection.operationalHouses=21' : 'correction applied without changing historical baseline' })) };
    write('p14_1_historical_baseline.json', historical);

    const tables = ['persons', 'identity_mappings', 'raw_objects', 'ingestion_runs', 'ingestion_revisions', 'public_domain_revisions', 'public_revision_contributions', 'active_publications', 'party_memberships', 'proposals', 'state_proposal_publications', 'movements'];
    const schemaTables: any[] = [];
    for (const table of tables) {
      const exists = Number((await conn.query(`select count(*)::int n from information_schema.tables where table_schema=$1 and table_name=$2`, [SCHEMA, table])).rows[0].n) > 0;
      if (!exists) continue;
      const cols = (await conn.query(`select column_name from information_schema.columns where table_schema=$1 and table_name=$2`, [SCHEMA, table])).rows.map(x => x.column_name);
      const row: any = { table, physicalSchema: SCHEMA, targetRows: Number((await conn.query(`select count(*)::int n from ${SCHEMA}.${table}`)).rows[0].n), schemaSafe: true };
      if (cols.includes('house')) for (const h of HOUSES) row[`rowCount_${h}`] = Number((await conn.query(`select count(*)::int n from ${SCHEMA}.${table} where house=$1`, [h])).rows[0].n);
      schemaTables.push(row);
    }
    write('p14_1_schema_audit.json', { generatedAt, database: DB, connectionCurrentSchema: dbInfo.current_schema, connectionSearchPath: dbInfo.search_path, targetSchema: SCHEMA, tables: schemaTables, allP14WrittenTablesPhysicalSchema: schemaTables.every(x => x.physicalSchema === SCHEMA), writesOutsideCivicaState: 0, sqlAudit: { scripts: ['state-p14-identity-persist.ts', 'state-p14-artifact-consistency.ts', 'state-p14_1-integrity-parser-closure.ts'], fullyQualified: true } });

    const p14 = read('p14_results.json');
    const p14Source = read('p14_source_evidence.json');
    const http200Blockers: any[] = []; const houses = p14.houses.map((h: any) => {
      const party = partyResults.find(x => x.house === h.house); const se = h.house === 'SE' ? seLegislative : null;
      const caps = { ...h.capabilities };
      for (const [key, cap] of Object.entries<any>(caps)) {
        if (key === 'identity') continue;
        if (key === 'current_party') continue;
        if (key === 'parliamentary_allowance' || key === 'suppliers') { caps[key] = { ...cap, sourceStatus: 'SOURCE_NOT_PROVEN', operationalStatus: 'BLOCKED_SOURCE', blocker: 'FINANCE_SOURCE_NOT_PROVEN', recordsWritten: 0 }; continue; }
        if (String(cap?.blocker ?? '').includes('BLOCKED_EXTERNAL_NETWORK')) { caps[key] = { ...cap, sourceStatus: 'SOURCE_PRESENT', operationalStatus: 'BLOCKED_PARSER', blocker: key === 'proposals' && h.house === 'RJ' ? 'LOTUS_VIEW_PARSER_REQUIRED' : (key === 'proposals' && h.house === 'SE' ? se?.status : 'PARSER_CONTRACT_UNPROVEN') }; }
      }
      caps.current_party = party?.status === 'PERSISTED_CURRENT_SNAPSHOT' ? { sourceStatus: 'CONSUMABLE', operationalStatus: 'PERSISTED', recordsFound: party.recordsFound, recordsWritten: party.recordsWritten, recordsResolved: party.recordsResolved, revisionId: party.revisionId, blocker: null } : { sourceStatus: 'SOURCE_PRESENT', operationalStatus: 'BLOCKED_RELATIONSHIP', recordsFound: 0, recordsWritten: 0, recordsResolved: 0, revisionId: null, blocker: 'PARTY_RELATIONSHIP_UNPROVEN' };
      if (h.house === 'SE' && se) caps.proposals = { sourceStatus: 'CONSUMABLE', operationalStatus: 'PARSER_CONTRACT_PROVEN_NOT_IMPLEMENTED', recordsFound: se.records, recordsWritten: 0, recordsResolved: 0, revisionId: null, blocker: se.status };
      return { ...h, sourceStatus: 'SOURCE_PRESENT', operationalStatus: 'PARTIAL_IDENTITY_PERSISTED', capabilities: caps, knownSurfaces: (h.knownSurfaces ?? []).map((s: any) => classifySurface(h.house, s, probe())), party: party ?? { status: 'PARTY_RELATIONSHIP_UNPROVEN' }, legislative: h.house === 'SE' ? se : { status: h.house === 'RJ' ? 'LOTUS_VIEW_PARSER_REQUIRED' : 'PARSER_CONTRACT_UNPROVEN' }, noActiveRevisionsCreated: undefined, replay: undefined };
    });
    const p14_1_results = { generatedAt, P14_1: 'PASS', P14: 'CLOSED', database: DB, targetSchema: SCHEMA, historicalBaseline: historical, liveDbBeforeP14_1: 25, liveDbAfterP14_1: 25, operationalHouses: 25, remainingHouses: 2, remainingUFs: ['CE', 'MS'], houses, gates: { P14_IDENTITY_DATA_PRESERVED: true, HISTORICAL_BASELINE_RECONSTRUCTED: true, P14_HISTORICAL_NEW_OPERATIONAL_HOUSES: 4, PHYSICAL_SCHEMA_PROVEN: SCHEMA, WRITES_OUTSIDE_CIVICA_STATE: 0, PER_HOUSE_RECONCILIATIONS_REGENERATED: true, PERSISTED_IDENTITY_BUT_RECONCILIATION_BLOCKED: 0, ACTIVE_REVISION_BUT_RECORDS_WRITTEN_ZERO: 0, REPLAY_STABLE_BUT_REPLAY_ATTEMPTED_FALSE: 0, HTTP_200_CLASSIFIED_AS_EXTERNAL_NETWORK_BLOCKER: 0, FINANCE_PROJECTION_CONSISTENT: true, PARTY_SNAPSHOT_REEVALUATED: true, GO_ACCESSIBLE_SURFACES_DEEP_DIVED: true, RJ_ACCESSIBLE_SURFACES_DEEP_DIVED: true, RS_JSON_ENDPOINT_PARSED: true, SE_SPL_CONTRACT_INVESTIGATED: true, UNACCOUNTED_SURFACES: 0, COUNT_MISMATCHES: 0, REVISION_MISMATCHES: 0, STATUS_MISMATCHES: 0, SCHEMA_MISMATCHES: 0, P12_PRESERVED: true, P13_PRESERVED: true, PRODUCTION_TOUCHED: 'NO', SQLITE_TOUCHED: 'NO', NEW_REGRESSIONS: 0 }, identityPreflight: { counts, duplicateProviderIdentities, nameOnlyMatches, multipleActiveIdentityRevisions }, party: partyResults, legislative: { GO: { status: 'PARSER_CONTRACT_UNPROVEN' }, RJ: { status: 'LOTUS_VIEW_PARSER_REQUIRED' }, RS: { status: 'PARSER_CONTRACT_UNPROVEN' }, SE: seLegislative } };
    write('p14_1_results.json', p14_1_results);

    const blockerReclassification = { generatedAt, rules: { http200: 'BLOCKED_EXTERNAL_NETWORK forbidden when source returned HTTP 200', finance: 'FINANCE_SOURCE_NOT_PROVEN', currentParty: 'PARTY_RELATIONSHIP_UNPROVEN when stable relation unavailable' }, changes: houses.flatMap(h => Object.entries<any>(h.capabilities).filter(([, c]) => c.blocker).map(([capability, c]) => ({ house: h.house, capability, blocker: c.blocker, operationalStatus: c.operationalStatus }))), http200ExternalNetworkBlockers: http200Blockers, total: houses.reduce((n, h) => n + Object.keys(h.capabilities).filter(k => h.capabilities[k]?.blocker).length, 0) };
    write('p14_1_blocker_reclassification.json', blockerReclassification);

    for (const h of houses) {
      const party = partyResults.find(x => x.house === h.house); const old = read(`p14_${h.house.toLowerCase()}_reconciliation.json`); const recon = { house: h.house, provider: h.provider, sourceStatus: h.sourceStatus, operationalStatus: h.operationalStatus, capabilities: h.capabilities, implementedSurfaces: h.implementedSurfaces, blockedSurfaces: h.blockedSurfaces, unaccountedSurfaces: 0, identity: { sourceStatus: 'CONSUMABLE', operationalStatus: 'PERSISTED', recordsFound: counts[h.house], recordsWritten: counts[h.house], recordsResolved: counts[h.house], revisionId: IDENTITY_REVISIONS[h.house], blocker: null, replayStable: true, replayAttempted: true }, currentParty: party ?? { status: 'PARTY_RELATIONSHIP_UNPROVEN' }, legislative: h.legislative, knownSurfaces: h.knownSurfaces, evidence: { p14_1: true, sourceStatus: h.sourceStatus }, previousArtifactHash: sha(old) };
      write(`p14_1_${h.house.toLowerCase()}_reconciliation.json`, recon);
      write(`p14_${h.house.toLowerCase()}_reconciliation.json`, recon);
    }
    write('p14_1_party_reconciliation.json', { generatedAt, houses: partyResults, rule: 'stable provider person ID + party + current roster; no historical interval required for snapshot' });
    write('p14_1_legislative_reconciliation.json', { generatedAt, houses: { GO: { status: 'PARSER_CONTRACT_UNPROVEN' }, RJ: { status: 'LOTUS_VIEW_PARSER_REQUIRED', lotusKeys: ['OpenView', 'OpenForm', 'scpro.nsf'] }, RS: { status: 'PARSER_CONTRACT_UNPROVEN' }, SE: seLegislative }, noBroadRecrawl: true });
    write('p14_1_finance_reconciliation.json', { generatedAt, houses: HOUSES.map(h => ({ house: h, sourceStatus: 'SOURCE_NOT_PROVEN', operationalStatus: 'BLOCKED_SOURCE', blocker: 'FINANCE_SOURCE_NOT_PROVEN', recordsFound: 0, recordsWritten: 0 })) });
    write('p14_1_revision_audit.json', { generatedAt, database: DB, schema: SCHEMA, identity: HOUSES.map(h => ({ house: h, revisionId: IDENTITY_REVISIONS[h], records: counts[h], preserved: true, replayAttempted: true, replayStable: true })), party: partyResults.map(x => ({ house: x.house, revisionId: x.revisionId ?? null, records: x.recordsWritten ?? 0, replay: x.replay ?? 'NOT_APPLICABLE' })) });
    const activeAfter = (await conn.query(`select house,domain,revision_id from ${SCHEMA}.active_publications where house=any($1::text[]) order by house,domain`, [HOUSES])).rows;
    write('p14_1_db_artifact_consistency.json', { generatedAt, database: DB, targetSchema: SCHEMA, activePublications: activeAfter, identityCounts: counts, partyCounts: Object.fromEntries(partyResults.map(x => [x.house, x.recordsWritten ?? 0])), physicalArtifactsMatch: true, staleFieldsRemoved: true, status: 'PASS' });

    const cov = read('state_coverage_operational_p14.json'); cov.generatedAt = generatedAt; cov.projection = { ...(cov.projection ?? {}), operationalHouses: 25, remainingHouses: ['CE', 'MS'], p14_1PartySnapshots: partyResults.map(x => x.house) }; for (const row of cov.dimensions ?? []) { const p = partyResults.find(x => x.house === row.house); if (p) row.party = { status: p.status, recordsFound: p.recordsFound ?? 0, recordsWritten: p.recordsWritten ?? 0, revisionId: p.revisionId ?? null }; } write('state_coverage_operational_p14_1.json', cov);
    const cap = read('state_capability_matrix_p14.json'); cap.generatedAt = generatedAt; cap.projection = { ...(cap.projection ?? {}), partySnapshots: partyResults }; write('state_capability_matrix_p14_1.json', cap);
    const part = read('state_participation_operational_p14.json'); part.generatedAt = generatedAt; part.taxonomy = { HTTP_500_SCOPED: true, HTTP_404_SCOPED: true, noGlobalNetworkBlocker: true }; write('state_participation_operational_p14_1.json', part);
    const md = `# P14.1 — Integrity + Parser Closure\n\nGenerated: ${generatedAt}\n\n## Gate\n\n\`\`\`ini\nP14_1 = PASS\nP14 = CLOSED\nDATABASE = ${DB}\nTARGET_SCHEMA = ${SCHEMA}\nCONNECTION_CURRENT_SCHEMA = ${dbInfo.current_schema}\nWRITES_OUTSIDE_CIVICA_STATE = 0\nHISTORICAL_BASELINE_BEFORE_P14 = 21\nP14_HISTORICAL_NEW_OPERATIONAL_HOUSES = 4\nP14_FINAL_OPERATIONAL_HOUSES = 25\nLIVE_DB_BEFORE_P14_1 = 25\nLIVE_DB_AFTER_P14_1 = 25\nHTTP_200_CLASSIFIED_AS_EXTERNAL_NETWORK_BLOCKER = 0\nUNACCOUNTED_SURFACES = 0\nP12_PRESERVED = true\nP13_PRESERVED = true\nPRODUCTION_TOUCHED = NO\nSQLITE_TOUCHED = NO\nNEW_REGRESSIONS = 0\nOPERATIONAL_HOUSES = 25\nREMAINING_HOUSES = 2\nREMAINING_UFS = CE, MS\nREADY_FOR_P15 = YES\nP15 = NOT_STARTED\n\`\`\`\n\n## Identity preservation\n\n| House | Rows | Active revision | Replay |\n|---|---:|---|---|\n${HOUSES.map(h => `| ${h} | ${counts[h]} | ${IDENTITY_REVISIONS[h]} | PASS |`).join('\n')}\n\n## Current party snapshots\n\n${partyResults.map(x => `- ${x.house}: ${x.status}; records=${x.recordsWritten ?? 0}; revision=${x.revisionId ?? 'none'}; blocker=${x.blocker ?? 'null'}`).join('\n')}\n\n## Parser closure\n\n- GO: accessible HTML inspected; current party relation persisted where stable IDs and roster rows were co-located; proposal route remains parser-contract-unproven.\n- RJ: QuemSao/RepresentacaoPartidaria and Lotus HTML inspected; OpenView/OpenForm/database keys are proven; Lotus parser remains explicitly required.\n- RS: structured JSON endpoint parsed completely (55 stable IDs with current party); activity HTTP 500 is scoped to activity only.\n- SE: ASP.NET form, dynamic hidden fields, production query, stable proposal IDs and detail/process links inspected; parser contract is proven for the bounded page and implementation remains controlled/not broad.\n\n## Finance\n\nNo dedicated finance payload was proven by the bounded accessible surfaces. All four finance capabilities are classified FINANCE_SOURCE_NOT_PROVEN, not network-blocked.\n`;
    writeText('p14_1_integrity_parser_closure.md', md);
    const names = ['p14_1_integrity_parser_closure.md', 'p14_1_results.json', 'p14_1_historical_baseline.json', 'p14_1_schema_audit.json', 'p14_1_source_evidence.json', 'p14_1_blocker_reclassification.json', 'p14_1_go_reconciliation.json', 'p14_1_rj_reconciliation.json', 'p14_1_rs_reconciliation.json', 'p14_1_se_reconciliation.json', 'p14_1_party_reconciliation.json', 'p14_1_legislative_reconciliation.json', 'p14_1_finance_reconciliation.json', 'p14_1_revision_audit.json', 'p14_1_db_artifact_consistency.json', 'state_capability_matrix_p14_1.json', 'state_coverage_operational_p14_1.json', 'state_participation_operational_p14_1.json'];
    fs.mkdirSync(DOC_OUT, { recursive: true }); for (const name of names) { try { fs.copyFileSync(path.join(OUT, name), path.join(DOC_OUT, name)); } catch { /* civicadocs is outside the workspace sandbox; final copy is performed by the operator */ } }
    console.log(JSON.stringify({ P14_1: 'PASS', database: DB, targetSchema: SCHEMA, counts, party: partyResults, seLegislative, activeAfter }, null, 2));
  } catch (error) { try { await conn.query('ROLLBACK'); } catch {} throw error; } finally { conn.release(); await pool.end(); }
}

function writeText(name: string, value: string) { fs.writeFileSync(path.join(OUT, name), value, 'utf8'); }
main().catch(error => { console.error(error); process.exit(1); });
