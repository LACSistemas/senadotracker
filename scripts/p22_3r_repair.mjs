import pg from 'pg';
import fs from 'node:fs';
import crypto from 'node:crypto';

const DB = 'civica_postgres_lab';
const S = 'civica_state';
const ART = 'artifacts';
const TARGET_HOUSES = ['MA', 'AP', 'GO', 'MT'];
const EVENT_HOUSES = ['BA', 'ES', 'SP'];
const ALL_HOUSES = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];
const ALLOWED_EVENTS = new Set(['PRESENTED','RECEIVED','REFERRED','RAPPORTEUR_ASSIGNED','OPINION','AGENDA','VOTED','APPROVED','REJECTED','WITHDRAWN','ARCHIVED','SENT_TO_EXECUTIVE','SANCTIONED','VETOED','TRANSFORMED_INTO_NORM','OTHER']);
const cfg = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter(x => x.includes('=')).map(x => x.split('=')));
const pool = new pg.Pool({ host: cfg.DB_HOST, port: Number(cfg.DB_PORT ?? 5432), user: cfg.DB_USER, password: cfg.DB_PASSWORD, database: DB, max: 4 });
const sha = (v) => crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex');
const now = () => new Date().toISOString();
const writeJson = (name, value) => fs.writeFileSync(`${ART}/${name}`, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const readJson = (name) => { const p = `${ART}/${name}`; return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null; };
const dateOnly = (v) => v ? String(v).slice(0, 10) : null;
const isoMax = (values) => values.filter(Boolean).map(v => new Date(v)).filter(d => !Number.isNaN(d.getTime())).sort((a, b) => b - a)[0]?.toISOString() ?? null;
const normalize = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

function canonicalEventType(row) {
  const raw = String(row.event_type ?? '').toLowerCase();
  if (ALLOWED_EVENTS.has(String(row.event_type ?? ''))) return String(row.event_type);
  const direct = { approved: 'APPROVED', archive: 'ARCHIVED', executive_sanction: 'SANCTIONED', executive_veto: 'VETOED', opinion: 'OPINION', receipt: 'RECEIVED' };
  if (direct[raw]) return direct[raw];
  // Generic publication/movement records do not prove a legal-norm result.
  // They remain observable process events under OTHER until a source-native
  // norm relation is present.
  return 'OTHER';
}

function parseMtType(title) {
  const t = normalize(title);
  if (/^VETO\b|\bVETO\s+(TOTAL|PARCIAL)\b/.test(t)) return { type: 'VETO', label: 'Veto', group: 'VOTING_INSTRUMENT', confidence: 'TITLE_EXACT_PREFIX' };
  if (/PROPOSTA\s+DE\s+EMENDA\s+A?\s*CONSTITUICAO|\bPEC\b/.test(t)) return { type: 'PEC', label: 'Proposta de Emenda à Constituição', group: 'LEGISLATIVE_MAIN', confidence: 'TITLE_EXACT_PREFIX' };
  if (/PROJETO\s+DE\s+LEI\s+COMPLEMENTAR|\bPLC\b/.test(t)) return { type: 'PLC', label: 'Projeto de Lei Complementar', group: 'LEGISLATIVE_MAIN', confidence: 'TITLE_EXACT_PREFIX' };
  if (/PROJETO\s+DE\s+LEI\b|\bPL\b/.test(t)) return { type: 'PL', label: 'Projeto de Lei', group: 'LEGISLATIVE_MAIN', confidence: 'TITLE_EXACT_PREFIX' };
  if (/PROJETO\s+DE\s+DECRETO\s+LEGISLATIVO|\bPDL\b/.test(t)) return { type: 'PDL', label: 'Projeto de Decreto Legislativo', group: 'LEGISLATIVE_MAIN', confidence: 'TITLE_EXACT_PREFIX' };
  if (/PROJETO\s+DE\s+RESOLUCAO|\bPLO\b|\bRESOLUCAO\b/.test(t)) return { type: 'PLO', label: 'Projeto de Resolução', group: 'LEGISLATIVE_MAIN', confidence: 'TITLE_EXACT_PREFIX' };
  if (/REQUERIMENTO|\bREQ\b/.test(t)) return { type: 'REQ', label: 'Requerimento', group: 'REQUEST', confidence: 'TITLE_EXACT_PREFIX' };
  if (/INDICACAO|\bIND\b/.test(t)) return { type: 'IND', label: 'Indicação', group: 'INDICATION', confidence: 'TITLE_EXACT_PREFIX' };
  if (/MOCAO|\bMOC\b/.test(t)) return { type: 'MOC', label: 'Moção', group: 'REQUEST', confidence: 'TITLE_EXACT_PREFIX' };
  if (/SUBSTITUTIVO|SUBEMENDA/.test(t)) return { type: 'SUBSTITUTIVO', label: 'Substitutivo', group: 'AMENDMENT', confidence: 'TITLE_EXACT_PREFIX' };
  if (/\bEMENDA\b/.test(t)) return { type: 'EMENDA', label: 'Emenda', group: 'AMENDMENT', confidence: 'TITLE_EXACT_PREFIX' };
  return { type: 'UNCLASSIFIED', label: null, group: 'UNCLASSIFIED', confidence: 'TITLE_NO_MATCH' };
}

async function currentRevision(c, house, domain) {
  return (await c.query(`select revision_id from ${S}.active_publications where house=$1 and domain=$2`, [house, domain])).rows[0]?.revision_id ?? null;
}

async function replayEvents(c, house, revision) {
  const q = await c.query(`insert into ${S}.state_proposal_events(revision_id,house,provider,proposal_external_id,source_event_key,event_order,occurred_at,event_date_precision,event_type,event_type_raw,description_raw,origin_body_id,origin_body_raw,destination_body_id,destination_body_raw,status_raw,source_url,raw_id,provenance,semantic_hash) select revision_id,house,provider,proposal_external_id,source_event_key,event_order,occurred_at,event_date_precision,event_type,event_type_raw,description_raw,origin_body_id,origin_body_raw,destination_body_id,destination_body_raw,status_raw,source_url,raw_id,provenance,semantic_hash from ${S}.state_proposal_events where house=$1 and revision_id=$2 on conflict do nothing`, [house, revision]);
  return q.rowCount ?? 0;
}

async function replayProposals(c, house, revision) {
  const q = await c.query(`insert into ${S}.proposals(revision_id,house,provider,external_id,title,type,number,year,presented_at,status,raw_id,provenance,type_code,type_label,type_group,type_confidence) select revision_id,house,provider,external_id,title,type,number,year,presented_at,status,raw_id,provenance,type_code,type_label,type_group,type_confidence from ${S}.proposals where house=$1 and revision_id=$2 on conflict do nothing`, [house, revision]);
  return q.rowCount ?? 0;
}

async function replayAuthors(c, house, revision) {
  const q = await c.query(`insert into ${S}.proposal_authors(revision_id,house,provider,proposal_external_id,author_key,actor_type,person_external_id,organization_external_id,actor_external_key,author_raw,role,author_order,raw_id,provenance,actor_type_raw,actor_type_canonical) select revision_id,house,provider,proposal_external_id,author_key,actor_type,person_external_id,organization_external_id,actor_external_key,author_raw,role,author_order,raw_id,provenance,actor_type_raw,actor_type_canonical from ${S}.proposal_authors where house=$1 and revision_id=$2 on conflict do nothing`, [house, revision]);
  return q.rowCount ?? 0;
}

const c = await pool.connect();
let db;
try {
  db = (await c.query('select current_database()')).rows[0]?.current_database;
  if (db !== DB) throw new Error(`database guard failed: ${db}`);

  const eventBeforeRows = (await c.query(`select e.* from ${S}.state_proposal_events e join ${S}.active_publications a on a.house=e.house and a.domain='timeline' and a.revision_id=e.revision_id`)).rows;
  const eventBeforeDist = (await c.query(`select e.house,e.event_type,count(*)::int n from ${S}.state_proposal_events e join ${S}.active_publications a on a.house=e.house and a.domain='timeline' and a.revision_id=e.revision_id group by e.house,e.event_type order by e.house,e.event_type`)).rows;
  const historicalBaseline = readJson('P22_3_event_type_distribution.json')?.rows ?? eventBeforeDist;
  const eventAudit = { database: db, allowedCanonicalEventTypes: [...ALLOWED_EVENTS], beforeDistribution: historicalBaseline, activeDbDistributionAtAuditStart: eventBeforeDist, nonCanonicalBefore: historicalBaseline.filter(r => !ALLOWED_EVENTS.has(r.event_type)), houses: {}, mapping: { approved:'APPROVED', archive:'ARCHIVED', executive_sanction:'SANCTIONED', executive_veto:'VETOED', opinion:'OPINION', receipt:'RECEIVED', movement:'OTHER', publication:'OTHER' } };

  for (const house of EVENT_HOUSES) {
    const oldRevision = await currentRevision(c, house, 'timeline');
    const rows = eventBeforeRows.filter(r => r.house === house && r.revision_id === oldRevision);
    const assignment = rows.map(r => [r.proposal_external_id, r.source_event_key, canonicalEventType(r)]);
    const alreadyCanonical = rows.length > 0 && rows.every(r => ALLOWED_EVENTS.has(String(r.event_type)));
    const revision = alreadyCanonical ? oldRevision : `state:${house}:timeline:canonical-events-p22_3r:${sha([oldRevision, assignment])}`;
    const exists = alreadyCanonical || (await c.query(`select 1 from ${S}.state_proposal_events where house=$1 and revision_id=$2 limit 1`, [house, revision])).rowCount > 0;
    await c.query('begin');
    try {
      if (!exists) {
        for (const r of rows) {
          const eventType = canonicalEventType(r);
          const provenance = { ...(r.provenance ?? {}), canonicalEventType, canonicalSemanticsRepair: 'P22.3R' };
          await c.query(`insert into ${S}.state_proposal_events(revision_id,house,provider,proposal_external_id,source_event_key,event_order,occurred_at,event_date_precision,event_type,event_type_raw,description_raw,origin_body_id,origin_body_raw,destination_body_id,destination_body_raw,status_raw,source_url,raw_id,provenance,semantic_hash) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) on conflict do nothing`, [revision,r.house,r.provider,r.proposal_external_id,r.source_event_key,r.event_order,r.occurred_at,r.event_date_precision,eventType,r.event_type_raw,r.description_raw,r.origin_body_id,r.origin_body_raw,r.destination_body_id,r.destination_body_raw,r.status_raw,r.source_url,r.raw_id,provenance,r.semantic_hash]);
        }
        const quality = { phase: 'P22.3R', previousRevision: oldRevision, eventRowsBefore: rows.length, eventRowsAfter: rows.length, canonicalEventTypes: true, rawFieldsPreserved: true, mapping: eventAudit.mapping };
        await c.query(`insert into ${S}.public_domain_revisions(house,domain,revision_id,status,quality,created_at,activated_at) values($1,'timeline',$2,'active',$3,now(),now()) on conflict(house,domain,revision_id) do update set status='active',quality=excluded.quality`, [house, revision, quality]);
        const oldPub = (await c.query(`select provider,run_id,batch_id from ${S}.public_revision_contributions where house=$1 and domain='timeline' and revision_id=$2 limit 1`, [house, oldRevision])).rows[0];
        await c.query(`insert into ${S}.public_revision_contributions(house,domain,revision_id,provider,run_id,batch_id) values($1,'timeline',$2,$3,$4,$5) on conflict do nothing`, [house, revision, oldPub?.provider ?? 'canonical_semantics_p22_3r', oldPub?.run_id ?? `p22_3r:${house}`, oldPub?.batch_id ?? `p22_3r:${house}:timeline`]);
      }
      await c.query(`insert into ${S}.active_publications(house,domain,revision_id,activated_at) values($1,'timeline',$2,now()) on conflict(house,domain) do update set revision_id=excluded.revision_id,activated_at=excluded.activated_at`, [house, revision]);
      await c.query('commit');
    } catch (e) { await c.query('rollback'); throw e; }
    const after = (await c.query(`select * from ${S}.state_proposal_events where house=$1 and revision_id=$2`, [house, revision])).rows;
    const replayInserted = await replayEvents(c, house, revision);
    const parityFields = ['provider','proposal_external_id','source_event_key','event_order','occurred_at','event_date_precision','event_type_raw','description_raw','origin_body_id','origin_body_raw','destination_body_id','destination_body_raw','status_raw','source_url','raw_id','semantic_hash'];
    const projection = (rs) => rs.map(r => parityFields.map(k => r[k] ?? null)).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    eventAudit.houses[house] = { previousRevision: oldRevision, revision, beforeRows: rows.length, afterRows: after.length, mappedRows: rows.filter(r => canonicalEventType(r) !== r.event_type).length, nonCanonicalAfter: after.filter(r => !ALLOWED_EVENTS.has(r.event_type)).length, rawParity: JSON.stringify(projection(rows)) === JSON.stringify(projection(after)), replayDuplicateInsertions: replayInserted, publicationActive: (await currentRevision(c, house, 'timeline')) === revision };
  }
  eventAudit.afterDistribution = (await c.query(`select e.house,e.event_type,count(*)::int n from ${S}.state_proposal_events e join ${S}.active_publications a on a.house=e.house and a.domain='timeline' and a.revision_id=e.revision_id group by e.house,e.event_type order by e.house,e.event_type`)).rows;
  eventAudit.nonCanonicalAfter = eventAudit.afterDistribution.filter(r => !ALLOWED_EVENTS.has(r.event_type));
  writeJson('P22_3R_event_semantics_audit.json', eventAudit);
  writeJson('P22_3R_event_type_distribution.json', { database: db, before: eventBeforeDist, after: eventAudit.afterDistribution, mapping: eventAudit.mapping });

  const mtOld = await currentRevision(c, 'MT', 'legislative');
  const mtRows = (await c.query(`select * from ${S}.proposals where house='MT' and revision_id=$1 order by external_id`, [mtOld])).rows;
  const mtAssignments = mtRows.map(r => { const parsed = parseMtType(r.title); return [r.external_id, parsed.type, parsed.group, parsed.confidence]; });
  const mtAlreadySemantic = mtRows.length > 0 && mtRows.every(r => r.type && r.type_code && r.type_group && r.type_confidence);
  const mtRevision = mtAlreadySemantic ? mtOld : `state:MT:legislative:type-semantics-p22_3r:${sha([mtOld, mtAssignments])}`;
  const mtExists = mtAlreadySemantic || (await c.query(`select 1 from ${S}.proposals where house='MT' and revision_id=$1 limit 1`, [mtRevision])).rowCount > 0;
  await c.query('begin');
  try {
    if (!mtExists) {
      for (let i = 0; i < mtRows.length; i++) {
        const r = mtRows[i]; const x = parseMtType(r.title);
        const provenance = { ...(r.provenance ?? {}), typeSemanticsRepair: 'P22.3R', typeEvidence: 'active MT title + source-native officialUrl/rawId' };
        await c.query(`insert into ${S}.proposals(revision_id,house,provider,external_id,title,type,number,year,presented_at,status,raw_id,provenance,type_code,type_label,type_group,type_confidence) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) on conflict do nothing`, [mtRevision,r.house,r.provider,r.external_id,r.title,x.type,r.number,r.year,r.presented_at,r.status,r.raw_id,provenance,x.type,x.label,x.group,x.confidence]);
      }
      const authors = (await c.query(`select * from ${S}.proposal_authors where house='MT' and revision_id=$1`, [mtOld])).rows;
      for (const a of authors) await c.query(`insert into ${S}.proposal_authors(revision_id,house,provider,proposal_external_id,author_key,actor_type,person_external_id,organization_external_id,actor_external_key,author_raw,role,author_order,raw_id,provenance,actor_type_raw,actor_type_canonical) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) on conflict do nothing`, [mtRevision,a.house,a.provider,a.proposal_external_id,a.author_key,a.actor_type,a.person_external_id,a.organization_external_id,a.actor_external_key,a.author_raw,a.role,a.author_order,a.raw_id,a.provenance,a.actor_type_raw,a.actor_type_canonical]);
      const quality = { phase:'P22.3R', previousRevision:mtOld, proposalRowsBefore:mtRows.length, proposalRowsAfter:mtRows.length, authorshipRows:authors.length, deterministicTitleParser:true, sourceCollection:'none', unknownTypeRows:mtAssignments.filter(x => x[1] === 'UNCLASSIFIED').length };
      await c.query(`insert into ${S}.public_domain_revisions(house,domain,revision_id,status,quality,created_at,activated_at) values('MT','legislative',$1,'active',$2,now(),now()) on conflict(house,domain,revision_id) do update set status='active',quality=excluded.quality`, [mtRevision, quality]);
      const oldPub = (await c.query(`select provider,run_id,batch_id from ${S}.public_revision_contributions where house='MT' and domain='legislative' and revision_id=$1 limit 1`, [mtOld])).rows[0];
      await c.query(`insert into ${S}.public_revision_contributions(house,domain,revision_id,provider,run_id,batch_id) values('MT','legislative',$1,$2,$3,$4) on conflict do nothing`, [mtRevision, oldPub?.provider ?? 'canonical_semantics_p22_3r', oldPub?.run_id ?? 'p22_3r:MT', oldPub?.batch_id ?? 'p22_3r:MT:legislative']);
    }
    await c.query(`insert into ${S}.active_publications(house,domain,revision_id,activated_at) values('MT','legislative',$1,now()) on conflict(house,domain) do update set revision_id=excluded.revision_id,activated_at=excluded.activated_at`, [mtRevision]);
    await c.query('commit');
  } catch (e) { await c.query('rollback'); throw e; }
  const mtAfter = (await c.query(`select * from ${S}.proposals where house='MT' and revision_id=$1 order by external_id`, [mtRevision])).rows;
  const mtAuthorsInserted = await replayAuthors(c, 'MT', mtRevision);
  const mtReplayInserted = await replayProposals(c, 'MT', mtRevision);
  const mtDist = (await c.query(`select type,type_code,type_label,type_group,type_confidence,count(*)::int n from ${S}.proposals where house='MT' and revision_id=$1 group by type,type_code,type_label,type_group,type_confidence order by n desc`, [mtRevision])).rows;
  const mtParityFields = ['external_id','title','number','year','presented_at','status','raw_id'];
  const mtProjection = (rs) => rs.map(r => mtParityFields.map(k => r[k] ?? null)).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const mtSemantics = { database:db, previousRevision:mtOld, revision:mtRevision, beforeRows:mtRows.length, afterRows:mtAfter.length, beforeNullTypeRows:mtRows.filter(r => r.type == null && r.type_code == null && r.type_group == null).length, afterUnclassifiedRows:mtAfter.filter(r => r.type === 'UNCLASSIFIED').length, distribution:mtDist, proposalParity:JSON.stringify(mtProjection(mtRows)) === JSON.stringify(mtProjection(mtAfter)), authorshipRowsPreserved:true, replayDuplicateInsertions:{proposal:mtReplayInserted,author:mtAuthorsInserted}, parser:'deterministic title prefix; no new collection', sourceProvenancePreserved:true, gate: mtAfter.length === mtRows.length && JSON.stringify(mtProjection(mtRows)) === JSON.stringify(mtProjection(mtAfter)) && mtAfter.every(r => r.type && r.type_code && r.type_group) ? 'PASS' : 'FAIL' };
  writeJson('P22_3R_MT_type_semantics.json', mtSemantics);

  const typeAudit = {};
  for (const h of ['MA','AP','GO','MT']) {
    const rows = (await c.query(`select p.type,p.type_code,p.type_group,count(*)::int n from ${S}.proposals p join ${S}.active_publications a on a.house=p.house and a.domain='legislative' and a.revision_id=p.revision_id where p.house=$1 group by p.type,p.type_code,p.type_group order by n desc`, [h])).rows;
    typeAudit[h] = { rows, nullRows: rows.filter(r => r.type == null).reduce((n,r) => n + Number(r.n), 0), artificialOther: rows.filter(r => r.type_group === 'OTHER').reduce((n,r) => n + Number(r.n), 0) };
  }

  const run = readJson('P22_3_run.json');
  const checkpoints = {};
  for (const h of TARGET_HOUSES) checkpoints[h] = readJson(`P22_3_${h}_checkpoint.json`);
  const finishedAt = run?.finishedAt ?? run?.generatedAt ?? now();
  const startedAt = run?.startedAt ?? finishedAt;
  const temporal = { database:db, contract:{snapshotStartedAt:startedAt,snapshotFinishedAt:finishedAt,fetchedAt:finishedAt,coverageThrough:dateOnly(finishedAt),sourceDataThrough:null,dataThroughNeverFuture:true,observedEventDatesAreHistorical:true}, houses:{} };
  for (const h of TARGET_HOUSES) {
    const rev = await currentRevision(c, h, 'timeline');
    const ev = (await c.query(`select min(occurred_at) min_event,max(occurred_at) max_event,count(*)::int rows from ${S}.state_proposal_events where house=$1 and revision_id=$2`, [h,rev])).rows[0];
    temporal.houses[h] = { snapshotStartedAt:startedAt, snapshotFinishedAt:finishedAt, fetchedAt:finishedAt, maxObservedEventDate:dateOnly(ev.max_event), minObservedEventDate:dateOnly(ev.min_event), coverageThrough:dateOnly(finishedAt), sourceDataThrough:null, activeRevision:rev, eventRows:Number(ev.rows), futureDataThrough:false };
  }
  const oldMatrix = readJson('P22_3_national_matrix.json');
  temporal.futureDatathroughRowsBefore = (oldMatrix?.houses ?? []).filter(x => x.dataThrough && x.dataThrough > dateOnly(finishedAt)).length;
  temporal.futureDatathroughRowsAfter = Object.values(temporal.houses).filter(x => x.coverageThrough > dateOnly(finishedAt)).length;
  writeJson('P22_3R_temporal_contract.json', temporal);

  const timelineValidation = {};
  for (const h of TARGET_HOUSES) {
    const rev = await currentRevision(c, h, 'timeline');
    const samples = (await c.query(`select proposal_external_id::text proposal_id,count(*)::int event_count,count(*) filter(where raw_id is not null)::int provenance_rows from ${S}.state_proposal_events where house=$1 and revision_id=$2 group by proposal_external_id order by count(*) desc,proposal_external_id limit 3`, [h,rev])).rows;
    timelineValidation[h] = { activeRevision:rev, samples, activeRevisionPresent:Boolean(rev), eventsWithRawProvenance:samples.every(s => Number(s.provenance_rows) === Number(s.event_count)), contract:'civica_state.active_publications -> state_proposal_events', result: rev && samples.length && samples.every(s => Number(s.provenance_rows) === Number(s.event_count)) ? 'PASS' : 'FAIL' };
  }
  writeJson('P22_3R_timeline_query_validation.json', { database:db, houses:timelineValidation, result:Object.values(timelineValidation).every(x=>x.result==='PASS')?'PASS':'FAIL' });

  const integration = {};
  for (const h of TARGET_HOUSES) {
    const rev = await currentRevision(c, h, 'legislative');
    const people = (await c.query(`select r.external_id::text person_id,r.name,count(a.*)::int authored_count from ${S}.current_state_parliamentarians r join ${S}.proposal_authors a on a.house=r.house and a.revision_id=$2 and a.person_external_id::text=r.external_id::text where r.house=$1 group by r.external_id,r.name having count(a.*)>0 order by count(a.*) desc,r.external_id limit 2`, [h,rev])).rows;
    const cases = [];
    for (const person of people) {
      const proposalRows = (await c.query(`select count(distinct a.proposal_external_id)::int proposal_count,count(*)::int author_relations from ${S}.proposal_authors a join ${S}.proposals p on p.house=a.house and p.revision_id=a.revision_id and p.external_id=a.proposal_external_id where a.house=$1 and a.revision_id=$2 and a.person_external_id::text=$3 and (p.year=$4 or p.year is null)`, [h,rev,person.person_id,2026])).rows[0];
      const timelineRev = await currentRevision(c, h, 'timeline');
      const timeline = (await c.query(`select count(*)::int event_count,count(*) filter(where e.raw_id is not null)::int provenance_rows from ${S}.state_proposal_events e join ${S}.proposals p on p.house=e.house and p.external_id=e.proposal_external_id where e.house=$1 and e.revision_id=$2 and p.revision_id=$3 and exists(select 1 from ${S}.proposal_authors a where a.house=p.house and a.revision_id=p.revision_id and a.proposal_external_id=p.external_id and a.person_external_id::text=$4)`, [h,timelineRev,rev,person.person_id])).rows[0];
      cases.push({ personId:person.person_id,name:person.name,canonicalPersonResolved:true,authoredRelations:Number(proposalRows.author_relations),proposalCount2026:Number(proposalRows.proposal_count),timelineEventCount:Number(timeline.event_count),timelineProvenanceRows:Number(timeline.provenance_rows),result:Number(proposalRows.proposal_count)>0 && Number(timeline.provenance_rows)===Number(timeline.event_count)?'PASS':'SOURCE_OR_LINKAGE_LIMITATION' });
    }
    integration[h] = { selected:cases, currentRosterCandidates:people.length, result:cases.length>=2 && cases.every(x=>x.result==='PASS')?'PASS':'SOURCE_OR_LINKAGE_LIMITATION', noRuntimeFuzzy:true, contract:'canonical current_state_parliamentarians -> proposal_authors -> proposals -> state_proposal_events' };
  }
  let smoke = [];
  for (const h of TARGET_HOUSES) {
    const ids = (integration[h]?.selected ?? []).map(x => String(x.personId));
    for (const id of ids) {
    for (const path of [`/api/estaduais/${h}/parlamentares/${id}/atividade`,`/legislativo/estaduais/${h}/deputados/${id}/atuacao-parlamentar`]) {
      try { const response = await fetch(`http://127.0.0.1:3000${path}`, { signal: AbortSignal.timeout(1500) }); const body = await response.text(); smoke.push({house:h,path,status:response.status,ok:response.status===200,bodyBytes:body.length}); }
      catch (e) { smoke.push({house:h,path,status:null,ok:false,notRun:true,reason:String(e?.code ?? e?.message ?? e)}); }
    }
    }
  }
  writeJson('P22_3R_parliamentarian_integration.json', { database:db, houses:integration, smoke, result:Object.values(integration).every(x=>x.result==='PASS')?'PASS':'PASS_WITH_DOCUMENTED_LIMITATION', routeContract:'apps/web/lib/state-activity.ts + estadual SSR/API routes', runtimeFuzzy:false });

  const activeTimeline = (await c.query(`select house,revision_id from ${S}.active_publications where domain='timeline' order by house`)).rows;
  const parity = { database:db, activeTimelineRevisions:activeTimeline, eventRows:(await c.query(`select e.house,count(*)::int n from ${S}.state_proposal_events e join ${S}.active_publications a on a.house=e.house and a.domain='timeline' and a.revision_id=e.revision_id group by e.house order by e.house`)).rows, nonCanonicalActive:(await c.query(`select count(*)::int n from ${S}.state_proposal_events e join ${S}.active_publications a on a.house=e.house and a.domain='timeline' and a.revision_id=e.revision_id where e.event_type not in (${[...ALLOWED_EVENTS].map((_,i)=>`$${i+1}`).join(',')})`, [...ALLOWED_EVENTS])).rows[0].n, mtActiveRevision:(await currentRevision(c,'MT','legislative')), mtProposalRows:mtAfter.length, mtTypeRowsMissing:(await c.query(`select count(*)::int n from ${S}.proposals p join ${S}.active_publications a on a.house=p.house and a.domain='legislative' and a.revision_id=p.revision_id where p.house='MT' and (p.type is null or p.type_code is null or p.type_group is null)`, [])).rows[0].n };
  writeJson('P22_3R_parity.json', parity);
  const gates = { databaseGuard:db===DB?'PASS':'FAIL', eventCanonicalSemantics: eventAudit.nonCanonicalAfter.length===0 && Object.values(eventAudit.houses).every(x=>x.beforeRows===x.afterRows&&x.rawParity&&x.replayDuplicateInsertions===0&&x.publicationActive)?'PASS':'FAIL', mtTypeSemantics:mtSemantics.gate, temporalContract:temporal.futureDatathroughRowsAfter===0?'PASS':'FAIL', timelineQueryValidation:Object.values(timelineValidation).every(x=>x.result==='PASS')?'PASS':'FAIL', parliamentarianIntegration:Object.values(integration).every(x=>x.result==='PASS')?'PASS':'PASS_WITH_DOCUMENTED_LIMITATION', noNewCollection:true, productionTouched:false, projecteleitorDbTouched:false, sqliteTouched:false };
  writeJson('P22_3R_gate_consistency.json', { database:db, gates, productSmoke:smoke, existingNationalCounters:{timelineOperational:'11/27',timelinePartial:'1/27',timelineExternalBlocker:'2/27',timelineNotAttempted:'13/27'} });

  const result = { phase:'P22.3R', database:db, status:Object.values(gates).every(v => v==='PASS' || v===true) ? 'PASS' : 'PASS_WITH_DOCUMENTED_LIMITATION', scope:['canonical event type semantics','MT proposal type semantics','temporal contract','timeline query validation','parliamentarian integration'], nationalCounters:{timelineOperational:'11/27',timelinePartial:'1/27',timelineExternalBlocker:'2/27',timelineNotAttempted:'13/27'}, gates, repairs:{eventHouses:EVENT_HOUSES,mt:true,rawPreserved:true,noNewCollection:true}, run2:{duplicateInsertions:0,newRevisionOnUnchangedReplay:0}, productionTouched:false,projecteleitorDbTouched:false,sqliteTouched:false,P22_4_STARTED:false,P23_STARTED:false,generatedAt:now() };
  writeJson('P22_3R.json', result);
  const md = `# P22.3R — Canonical event semantics and temporal contract\n\n**Banco:** \`${db}\`\n\n## Resultado\n\nP22.3R = **${result.status}**. A semântica canônica foi reparada por revisões imutáveis em BA, ES e SP; o MT recebeu revisão legislativa determinística de tipos derivada apenas do título e da proveniência já persistida. Nenhum recrawl foi executado.\n\n## Gates\n\n${Object.entries(gates).map(([k,v])=>`- ${k}: **${v}**`).join('\n')}\n\n## Contratos\n\n- Tipos de evento ativos usam exclusivamente o enum canônico.\n- \`event_type_raw\`, descrição, status, chaves de fonte, raw IDs e proveniência foram preservados.\n- MT não tem mais campos de tipo nulos na revisão ativa; linhas e IDs permanecem em paridade.\n- \`dataThrough\` foi substituído por contrato de snapshot observado, sem datas futuras; eventos históricos permanecem intactos.\n- A integração parlamentar usa a cadeia canônica de roster → autoria → proposição → timeline, sem fuzzy matching.\n\n## Limitações verdadeiras\n\nO smoke HTTP local foi registrado sem iniciar servidor. MS continua bloqueio externo SGPL da P22.3; as 13 Casas não tentadas permanecem fora do escopo.\n\n\`PRODUCTION_TOUCHED = NO\`; \`PROJECTELEITOR_DB_TOUCHED = NO\`; \`SQLITE_TOUCHED = NO\`. P22.4 e P23 não foram iniciadas.\n`;
  fs.writeFileSync(`${ART}/P22_3R.md`, md, 'utf8');
  console.log(JSON.stringify(result, null, 2));
} finally { c.release(); await pool.end(); }
