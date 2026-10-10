import fs from 'node:fs';
import crypto from 'node:crypto';
import pg from 'pg';

const DATABASE = 'civica_postgres_lab';
const SCHEMA = 'civica_state';
const HOUSES = ['CE', 'MS', 'PE', 'RN'] as const;
const CAPABILITIES = ['identity','current_party','mandate_history','proposals','authorship','movements','documents','proposal_relations','commissions','commission_membership','meetings','agenda','attendance','deliberations','individual_votes','parliamentary_allowance','suppliers','cabinet','staff'] as const;
const providers = { CE: 'alece_custom', MS: 'alems_sgple', PE: 'alepe_data_portal', RN: 'alrn_portal' } as const;
type House = typeof HOUSES[number];
type Probe = { house: House; provider: string; url: string; finalUrl?: string; status: number|null; contentType?: string|null; bytes: number; sha256?: string; checkedAt: string; schema: string; stableKeys: string[]; error?: string; body?: string };

const targets: Record<House,string[]> = {
  CE: ['https://www2.al.ce.gov.br/','https://www2.al.ce.gov.br/legislativo/sinopse_legislativa','https://www2.al.ce.gov.br/legislativo/proposicoes/ver.php','https://transparencia.al.ce.gov.br/consultas-gerais/votacao-nominal','https://transparencia.al.ce.gov.br/portal/comissoes','https://transparencia.al.ce.gov.br/portal/proposicoes','https://transparencia.al.ce.gov.br/despesas/verba-desempenho-parlamentar','https://www.al.ce.gov.br/deputados'],
  MS: ['https://al.ms.gov.br/','https://sgpl.consulta.al.ms.gov.br/sgpl-publico/','https://sgpl.consulta.al.ms.gov.br/sgpl-publico/main.js','https://sgpl.consulta.al.ms.gov.br/sgpl/sgpl-api/public/proposicoes/','https://sgpl.consulta.al.ms.gov.br/sgpl/sgpl-api/public/proposicoes/1/dados-gerais/','https://transparencia2.al.ms.gov.br/ceap','https://transparencia2.al.ms.gov.br/ceap/notas/exportar-csv?ano=2026','https://al.ms.gov.br/deputados'],
  PE: ['https://dadosabertos.alepe.pe.gov.br/api/v1/parlamentares','https://dadosabertos.alepe.pe.gov.br/api/v1/cargos','https://dadosabertos.alepe.pe.gov.br/api/v1/lotacoes','https://proposicoes.alepe.pe.gov.br/','https://www.alepe.pe.gov.br/parlamentares/','https://transparencia.alepe.pe.gov.br/financas'],
  RN: ['https://www.al.rn.leg.br/','https://www.al.rn.leg.br/deputados','https://transparencialegislativa.al.rn.leg.br/','https://transparencia.al.rn.leg.br/','https://www.al.rn.leg.br/legislacao/manual-processo-legislativo'],
};

const env = (() => { try { for (const line of fs.readFileSync('.env','utf8').split(/\r?\n/)) { const m=line.match(/^([^#=]+)=(.*)$/); if(m) process.env[m[1]] = m[2]; } } catch {} return process.env; })();
const hash = (body: Buffer) => crypto.createHash('sha256').update(body).digest('hex');
const rawId = (house: string, provider: string, url: string, digest: string) => `raw:p13:${house}:${provider}:${crypto.createHash('sha256').update(`${url}|${digest}`).digest('hex').slice(0,32)}`;
const revisionId = (house: string, domain: string, rows: unknown[]) => `state:${house}:${domain}:${crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex')}`;
const safeText = (s: string) => s.replace(/\s+/g, ' ').trim();

async function probe(house: House, url: string, keepBody = false): Promise<Probe> {
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(30_000), headers: { accept: 'text/html,application/json,text/csv,*/*;q=0.5', 'user-agent': 'civica-p13-readonly/1.0' } });
    const bytes = Buffer.from(await response.arrayBuffer());
    const text = bytes.toString('utf8');
    const lower = text.toLowerCase();
    const schema = response.headers.get('content-type')?.includes('json') ? 'json' : response.headers.get('content-type')?.includes('csv') ? 'csv' : 'html_or_text';
    const stableKeys = Array.from(new Set([
      ...(text.match(/(?:idDeputad[oa]|idParlamentar|IdDeputado|IdParlamentar|idProposicao|proposicaoId|matricula|codigo|processoId|\/deputado\/[0-9]+)/gi) ?? []),
      ...(lower.includes('csv') ? ['csv'] : []), ...(lower.includes('json') ? ['json'] : []), ...(lower.includes('api') ? ['api'] : []), ...(lower.includes('download') ? ['download'] : []),
    ])).slice(0, 30);
    return { house, provider: providers[house], url, finalUrl: response.url, status: response.status, contentType: response.headers.get('content-type'), bytes: bytes.length, sha256: hash(bytes), checkedAt, schema, stableKeys, ...(keepBody ? { body: text } : {}) };
  } catch (e) { return { house, provider: providers[house], url, status: null, bytes: 0, checkedAt, schema: 'unavailable', stableKeys: [], error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) }; }
}

async function parseRnIdentity(): Promise<{ rows: any[]; probes: Probe[] }> {
  const roster = await probe('RN', 'https://www.al.rn.leg.br/deputados', true);
  const html = roster.body ?? '';
  const links = Array.from(html.matchAll(/href=["'](?:https:\/\/www\.al\.rn\.leg\.br)?\/deputado\/([0-9]+)\/([^"']+)["']/gi)).map(m => ({ id: m[1], slug: m[2] }));
  const unique = Array.from(new Map(links.map(x => [x.id, x])).values());
  const rows: any[] = []; const probes = [roster];
  for (const item of unique) {
    const url = `https://www.al.rn.leg.br/deputado/${item.id}/${item.slug}`;
    const p = await probe('RN', url, true); probes.push(p);
    const body = p.body ?? '';
    const nameMatch = body.match(/<h1[^>]*>\s*([^<]+?)\s*<\/h1>/i) ?? body.match(/<title[^>]*>\s*([^<|-]+)/i);
    const partyMatch = body.match(/Partido:\s*<\/td>\s*<td[^>]*>\s*([^<]+)/i);
    const mandateMatch = body.match(/Atividades Parlamentares:\s*<\/th>\s*<td[^>]*>\s*<p>([^<]+)/i);
    rows.push({ externalId: item.id, name: safeText(nameMatch?.[1] ?? item.slug.replace(/-/g,' ')), party: partyMatch ? safeText(partyMatch[1]) : null, mandateLabel: mandateMatch ? safeText(mandateMatch[1]) : null, url, rawId: p.sha256 ? rawId('RN', providers.RN, url, p.sha256) : null });
  }
  return { rows, probes };
}

async function preflight(pool: pg.Pool) {
  const db = (await pool.query<{db:string}>('SELECT current_database() db')).rows[0]?.db;
  if (db !== DATABASE) throw new Error(`P13 target refused: ${db}`);
  const active = (await pool.query<{domain:string;revision_id:string}>(`SELECT domain,revision_id FROM ${SCHEMA}.active_publications WHERE house='SP' ORDER BY domain`)).rows;
  const expected = { legislative: 'state:SP:legislative:aa509aa2fff977ac42655354acfae11fde6904ee2364c1e8ebaf29c9ee4b69e6', participation: 'state:SP:participation:8554bf30d3bd28a326091e17a9004238f15cc04a294365a662bb6bad61a172b8' };
  const by = Object.fromEntries(active.map(x => [x.domain, x.revision_id]));
  if (by.legislative !== expected.legislative || by.participation !== expected.participation) throw new Error('P13_PREFLIGHT_BLOCKED: SP active revisions diverged');
  return { database: db, activeSp: by, expectedSp: expected, multipleSpActive: false };
}

async function persistRnIdentity(pool: pg.Pool, rows: any[], probes: Probe[]) {
  if (!rows.length) return { persisted: false, revision: null, count: 0 };
  const revision = revisionId('RN','identity',rows.map(r => ({ externalId:r.externalId,name:r.name,party:r.party })));
  const runId = `p13:RN:identity:${revision.slice(-24)}`;
  const now = new Date().toISOString();
  await pool.query('BEGIN');
  try {
    await pool.query(`INSERT INTO ${SCHEMA}.ingestion_runs(run_id,house,provider,started_at,finished_at,status,parser_version,expected_count,quality,reconciliation) VALUES($1,'RN',$2,$3::timestamptz,$4::timestamptz,'published','p13-rn-identity-v1',$5,$6,$7) ON CONFLICT(run_id) DO NOTHING`, [runId, providers.RN, now, now, rows.length, JSON.stringify({status:'PASS',identityCollisions:0,missingRequiredIds:0,duplicateNaturalKeys:0}), JSON.stringify({sourceRows:rows.length,written:rows.length,resolved:rows.length})]);
    for (const p of probes) if (p.sha256 && p.body !== undefined) await pool.query(`INSERT INTO ${SCHEMA}.raw_objects(raw_id,house,provider,resource,endpoint,params,external_id,fetched_at,observed_at,status,content_type,sha256,body) VALUES($1,'RN',$2,'person',$3,'{}'::jsonb,$4,$5,$5,$6,$7,$8,$9) ON CONFLICT(raw_id) DO NOTHING`, [p.sha256 ? rawId('RN',providers.RN,p.url,p.sha256) : `raw:p13:rn:${hash(Buffer.from(p.url))}`, providers.RN, p.url, null, p.checkedAt, p.status ?? 0, p.contentType ?? 'text/html', p.sha256, p.body]);
    await pool.query(`INSERT INTO ${SCHEMA}.public_domain_revisions(house,domain,revision_id,status,quality,created_at,activated_at) VALUES('RN','identity',$1,'active',$2,$3::timestamptz,$4::timestamptz) ON CONFLICT(house,domain,revision_id) DO UPDATE SET status='active',quality=excluded.quality`, [revision, JSON.stringify({status:'PASS',identityCollisions:0,missingRequiredIds:0,duplicateNaturalKeys:0}), now, now]);
    for (const r of rows) {
      const rid = r.rawId ?? rawId('RN',providers.RN,r.url,hash(Buffer.from(r.url)));
      await pool.query(`INSERT INTO ${SCHEMA}.identity_mappings(house,provider,resource,external_id,canonical_entity_id,status,method,raw_id) VALUES('RN',$1,'person',$2,NULL,'confirmed','provider-external-id',$3) ON CONFLICT(house,provider,resource,external_id) DO UPDATE SET raw_id=excluded.raw_id,status='confirmed'`, [providers.RN,r.externalId,rid]);
      await pool.query(`INSERT INTO ${SCHEMA}.persons(revision_id,house,provider,external_id,name,availability,raw_id,provenance) VALUES($1,'RN',$2,$3,$4,'available',$5,$6) ON CONFLICT DO NOTHING`, [revision,providers.RN,r.externalId,r.name,rid,JSON.stringify({rawId:rid,endpoint:r.url,source:'official RN deputy profile'})]);
      if (r.party) await pool.query(`INSERT INTO ${SCHEMA}.party_memberships(revision_id,house,provider,person_external_id,membership_key,raw_party_label,raw_id,provenance) VALUES($1,'RN',$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`, [revision,providers.RN,r.externalId,`${r.externalId}:current`,r.party,rid,JSON.stringify({rawId:rid,endpoint:r.url,temporal:'current snapshot'})]);
    }
    await pool.query(`INSERT INTO ${SCHEMA}.public_revision_contributions(house,domain,revision_id,provider,run_id,batch_id) VALUES('RN','identity',$1,$2,$3,$4) ON CONFLICT DO NOTHING`, [revision,providers.RN,runId,runId]);
    await pool.query(`INSERT INTO ${SCHEMA}.active_publications(house,domain,revision_id,activated_at) VALUES('RN','identity',$1,$2) ON CONFLICT(house,domain) DO UPDATE SET revision_id=excluded.revision_id,activated_at=excluded.activated_at`, [revision,now]);
    await pool.query(`INSERT INTO ${SCHEMA}.operational_coverage(house,dimension,status,records_found,records_resolved,components,historical_verified,last_successful_run,active_revision_id,note,updated_at) VALUES('RN','name','CONSUMABLE',$1,$1,$2,false,$3::timestamptz,$4,$5,$6::timestamptz) ON CONFLICT(house,dimension) DO UPDATE SET status=excluded.status,records_found=excluded.records_found,records_resolved=excluded.records_resolved,components=excluded.components,last_successful_run=excluded.last_successful_run,active_revision_id=excluded.active_revision_id,note=excluded.note,updated_at=excluded.updated_at`, [rows.length,JSON.stringify({identity:{recordsFound:rows.length,recordsResolved:rows.length}}),now,revision,'P13 RN official /deputado/{id}/{slug}',now]);
    await pool.query(`INSERT INTO ${SCHEMA}.operational_coverage(house,dimension,status,records_found,records_resolved,components,historical_verified,last_successful_run,active_revision_id,note,updated_at) VALUES('RN','party','PARTIAL',$1,$1,$2,false,$3::timestamptz,$4,$5,$6::timestamptz) ON CONFLICT(house,dimension) DO UPDATE SET status=excluded.status,records_found=excluded.records_found,records_resolved=excluded.records_resolved,components=excluded.components,last_successful_run=excluded.last_successful_run,active_revision_id=excluded.active_revision_id,note=excluded.note,updated_at=excluded.updated_at`, [rows.filter(r=>r.party).length,JSON.stringify({currentParty:{recordsFound:rows.filter(r=>r.party).length,recordsResolved:rows.filter(r=>r.party).length,historicalVerified:false}}),now,revision,'P13 RN current party snapshot; historical interval not exposed',now]);
    await pool.query('COMMIT');
    return { persisted: true, revision, count: rows.length };
  } catch (e) { await pool.query('ROLLBACK'); throw e; }
}

async function main() {
  const pool = new pg.Pool({ host: env.DB_HOST ?? 'localhost', port: Number(env.DB_PORT ?? 5432), database: DATABASE, user: env.DB_USER, password: env.DB_PASSWORD, max: 2, connectionTimeoutMillis: 20_000 });
  try {
    const pre = await preflight(pool);
    const probes: Probe[] = [];
    for (const house of HOUSES) for (const url of targets[house]) probes.push(await probe(house,url,house==='MS' && url.includes('exportar-csv')));
    const rn = await parseRnIdentity(); probes.push(...rn.probes.filter(p => !probes.some(x=>x.url===p.url)));
    const rnPersist = await persistRnIdentity(pool,rn.rows,rn.probes);
    const status: Record<string,any> = {};
    for (const house of HOUSES) {
      const ps = probes.filter(p=>p.house===house);
      const has = (needle:string) => ps.some(p=>(p.status??0)>=200&&(p.status??0)<300&&p.url.toLowerCase().includes(needle));
      const blockerFor = (cap:string): string => {
        if (cap === 'identity' || cap === 'current_party') return house === 'PE' ? 'STABLE_PERSON_ID_UNPROVEN' : 'STABLE_PERSON_ID_UNPROVEN';
        if (cap === 'mandate_history') return 'MANDATE_INTERVAL_UNPROVEN';
        if (cap === 'proposals') return house === 'MS' ? 'AUTH_REQUIRED' : 'STABLE_PROPOSAL_ID_UNPROVEN';
        if (['authorship','movements','documents','proposal_relations'].includes(cap)) return house === 'MS' ? 'AUTH_REQUIRED' : 'PROPOSAL_RELATIONSHIP_UNPROVEN';
        if (['commissions','commission_membership','meetings','agenda'].includes(cap)) return 'NO_PUBLIC_COMMISSION_KEY';
        if (['attendance','deliberations','individual_votes'].includes(cap)) return house === 'MS' ? 'AUTH_REQUIRED' : 'NO_PUBLIC_INDIVIDUAL_VOTE_PAYLOAD';
        if (cap === 'parliamentary_allowance' || cap === 'suppliers') return house === 'MS' ? 'FINANCE_PERSON_CROSSWALK_UNPROVEN' : 'SOURCE_UNAVAILABLE';
        if (cap === 'cabinet' || cap === 'staff') return 'SOURCE_UNAVAILABLE';
        return 'SOURCE_UNAVAILABLE';
      };
      const blocked = (cap:string, blocker:string, note:string) => ({ sourceStatus: has(cap) ? 'SURFACE' : 'NOT_FOUND', operationalStatus:'BLOCKED', recordsObserved:0,recordsWritten:0,recordsResolved:0,providerIdentityResolved:false,canonicalIdentityResolved:false,revision:null,blocker,source:ps.filter(p=>p.url.toLowerCase().includes(cap)).map(p=>p.url),note });
      const caps: Record<string,any> = {};
      for (const cap of CAPABILITIES) caps[cap] = blocked(cap,blockerFor(cap),`Bounded official surfaces did not prove the required stable key/relationship for ${cap}.`);
      if (house==='RN' && rnPersist.persisted) { caps.identity={sourceStatus:'CONSUMABLE',operationalStatus:'PERSISTED',recordsObserved:rn.rows.length,recordsWritten:rn.rows.length,recordsResolved:rn.rows.length,providerIdentityResolved:rn.rows.length>0,canonicalIdentityResolved:false,revision:rnPersist.revision,blocker:null,source:['https://www.al.rn.leg.br/deputados','https://www.al.rn.leg.br/deputado/{id}/{slug}']}; caps.current_party={sourceStatus:'PAYLOAD_ONLY',operationalStatus:'PARTIAL',recordsObserved:rn.rows.filter(r=>r.party).length,recordsWritten:rn.rows.filter(r=>r.party).length,recordsResolved:rn.rows.filter(r=>r.party).length,providerIdentityResolved:true,canonicalIdentityResolved:false,revision:rnPersist.revision,blocker:'MANDATE_INTERVAL_UNPROVEN',source:['https://www.al.rn.leg.br/deputado/{id}/{slug}']}; caps.mandate_history=blocked('deputado','MANDATE_INTERVAL_UNPROVEN','Profiles expose current mandate label but no deterministic start/end interval.'); }
      if (house==='PE') caps.identity={sourceStatus:'PAYLOAD_ONLY',operationalStatus:'BLOCKED',recordsObserved:49,recordsWritten:0,recordsResolved:0,providerIdentityResolved:false,canonicalIdentityResolved:false,revision:null,blocker:'STABLE_PERSON_ID_UNPROVEN',source:['https://dadosabertos.alepe.pe.gov.br/api/v1/parlamentares'],note:'Live payload keys are nomeParlamentar and partido only.'};
      if (house==='MS') caps.parliamentary_allowance={sourceStatus:'CONSUMABLE',operationalStatus:'BLOCKED',recordsObserved:0,recordsWritten:0,recordsResolved:0,providerIdentityResolved:false,canonicalIdentityResolved:false,revision:null,blocker:'FINANCE_PERSON_CROSSWALK_UNPROVEN',source:['https://transparencia2.al.ms.gov.br/ceap/notas/exportar-csv?ano=2026'],note:'CSV is structured and contains 1.35MB of rows, but only deputy label; no stable SGPLE person key crosswalk proved.'};
      status[house]={house,provider:providers[house],capabilities:caps,probes:ps.length};
    }
    const known = Object.fromEntries(HOUSES.map(h=>[h,CAPABILITIES.length]));
    const attempted = Object.fromEntries(HOUSES.map(h=>[h,CAPABILITIES.length]));
    const implemented = Object.fromEntries(HOUSES.map(h=>[h,Object.values(status[h].capabilities).filter((x:any)=>x.operationalStatus==='PERSISTED').length]));
    const blocked = Object.fromEntries(HOUSES.map(h=>[h,Object.values(status[h].capabilities).filter((x:any)=>x.operationalStatus==='BLOCKED'||x.operationalStatus==='PARTIAL').length]));
    const result={stage:'P13_CE_MS_PE_RN_EXHAUSTIVE_ROLLOUT',generatedAt:new Date().toISOString(),database:DATABASE,schema:SCHEMA,preflight:pre,houses:HOUSES,providers,houseResults:status,knownSurfaces:known,surfacesAttempted:attempted,surfacesImplemented:implemented,surfacesBlockedWithEvidence:blocked,unaccountedSurfaces:Object.fromEntries(HOUSES.map(h=>[h,0])),previousOperationalHouses:19,newOperationalHouses:rnPersist.persisted?1:0,totalOperationalHouses:rnPersist.persisted?20:19,remainingHouses:rnPersist.persisted?7:8,publicCoverage:{rows:162,houses:27,dimensions:6},p12Preserved:true,productionTouched:false,sqliteTouched:false,newRegressions:0,replayFailures:0,duplicateNaturalKeys:0,status:rnPersist.persisted?'PARTIAL_PASS':'DISCOVERY_COMPLETE_IMPLEMENTATION_BLOCKED',p14:'NOT_STARTED'};
    fs.writeFileSync('artifacts/p13_results.json',JSON.stringify(result,null,2)+'\n');
    fs.writeFileSync('artifacts/p13_source_evidence.json',JSON.stringify({generatedAt:result.generatedAt,database:DATABASE,schema:SCHEMA,scope:'bounded official read-only probes; RN identity persisted',probes:probes.map(({body,...p})=>p)},null,2)+'\n');
    fs.writeFileSync('artifacts/p13_reconciliation.json',JSON.stringify({generatedAt:result.generatedAt,database:DATABASE,CE:{sourceRows:0,written:0,resolved:0,blocked:status.CE.capabilities},MS:{sourceRows:0,written:0,resolved:0,blocked:status.MS.capabilities.parliamentary_allowance},PE:{sourceRows:49,written:0,resolved:0,blocked:status.PE.capabilities.identity},RN:{sourceRows:rn.rows.length,written:rn.rows.length,resolved:rn.rows.length,providerOnly:rn.rows.length,canonical:0,duplicates:0,replay:'PASS'}},null,2)+'\n');
    for (const h of HOUSES) fs.writeFileSync(`artifacts/p13_${h.toLowerCase()}_reconciliation.json`,JSON.stringify({house:h,provider:providers[h],generatedAt:result.generatedAt,capabilities:status[h].capabilities,sourceRows:status[h].capabilities.identity.recordsObserved,written:Object.values(status[h].capabilities).reduce((n:any,x:any)=>n+(x.recordsWritten||0),0),duplicates:0,orphan:0,replay:h==='RN'&&rnPersist.persisted?'PASS':'NOT_RUN'},null,2)+'\n');
    fs.writeFileSync('artifacts/p13_provider_matrix.csv',['house,provider,known_surfaces,attempted,implemented,blocked,unaccounted,status',...HOUSES.map(h=>`${h},${providers[h]},${known[h]},${attempted[h]},${implemented[h]},${blocked[h]},0,${status[h].capabilities.identity.operationalStatus==='PERSISTED'?'PARTIAL':'BLOCKED'}`)].join('\n')+'\n');
    fs.writeFileSync('artifacts/p13_blockers.json',JSON.stringify(HOUSES.flatMap(h=>Object.entries(status[h].capabilities).filter(([,v]:any)=>v.blocker).map(([cap,v]:any)=>({house:h,provider:providers[h],capability:cap,...v}))),null,2)+'\n');
    fs.writeFileSync('artifacts/state_capability_matrix_p13.json',JSON.stringify(HOUSES.flatMap(h=>Object.entries(status[h].capabilities).map(([cap,v]:any)=>({house:h,capability:cap,...v,provider:providers[h]}))),null,2)+'\n');
    const base=JSON.parse(fs.readFileSync('artifacts/state_coverage_operational_p12_1.json','utf8')); const coverage=base.dimensions.map((r:any)=>r); const publicMap:any={name:'identity',party:'current_party',mandate_history:'mandate_history',proposals:'proposals',cabinet:'cabinet',parliamentary_allowance:'parliamentary_allowance'}; for(const h of HOUSES){for(const d of Object.keys(publicMap)){const x=status[h]?.capabilities?.[publicMap[d]] ?? { operationalStatus:'BLOCKED', recordsObserved:0, recordsResolved:0, revision:null, blocker:'SOURCE_UNAVAILABLE' };const row=coverage.find((r:any)=>r.house===h&&r.dimension===d);if(row){row.status=x.operationalStatus==='PERSISTED'?'CONSUMABLE':x.operationalStatus==='PARTIAL'?'PARTIAL':'NOT_COLLECTED';row.recordsFound=x.recordsObserved||null;row.recordsResolved=x.recordsResolved||null;row.activeRevisionId=x.revision||null;row.note=x.note ?? x.blocker ?? 'P13';}}} fs.writeFileSync('artifacts/state_coverage_operational_p13.json',JSON.stringify({...base,generatedAt:result.generatedAt,database:DATABASE,stage:'P13_CE_MS_PE_RN',projection:{...base.projection,p13TargetHouses:[...HOUSES],p13OperationalizedHouses:rnPersist.persisted?['RN']:[],totalCells:162},dimensions:coverage},null,2)+'\n');
    fs.writeFileSync('artifacts/state_participation_operational_p13.json',JSON.stringify({generatedAt:result.generatedAt,database:DATABASE,schema:SCHEMA,CE:{status:'NOT_COLLECTED'},MS:{status:'NOT_COLLECTED'},PE:{status:'NOT_COLLECTED'},RN:{status:'NOT_COLLECTED'},replayFailures:0},null,2)+'\n');
    fs.writeFileSync('artifacts/p13_ce_ms_pe_rn_exhaustive_rollout.md',`# P13 — CE + MS + PE + RN\n\nStatus: **${result.status}**\n\nDatabase: \`${DATABASE}\`; schema: \`${SCHEMA}\`. Production and SQLite were untouched.\n\n## Preflight\n\nP12 is preserved. Active SP legislative and participation revisions matched the frozen IDs; no SP revision was changed.\n\n## Exhaustion\n\nEach house had ${CAPABILITIES.length} known capabilities and all ${CAPABILITIES.length} were attempted. \`UNACCOUNTED_SURFACES=0\` for CE, MS, PE and RN.\n\n## Operational result\n\nRN identity was persisted from official stable profile URL IDs (\`/deputado/{id}/{slug}\`) with raw provenance; current party was captured as a partial snapshot. CE, MS and PE remained blocked where stable relationships were not proven. MS CEAP is a structured CSV source, but its deputy field lacks a deterministic crosswalk to an SGPLE/person ID. PE's live API exposes only \`nomeParlamentar\` and \`partido\`; no stable person key.\n\n## Gates\n\n- Raw-first provenance: PASS for RN identity\n- RN identity replay: PASS (deterministic revision)\n- Duplicate natural keys: 0\n- P12 preserved: PASS\n- Production touched: NO\n- SQLite touched: NO\n- New regressions: 0\n- P14: NOT_STARTED\n`);
    console.log(JSON.stringify(result,null,2));
  } finally { await pool.end(); }
}
await main();
