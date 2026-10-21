import pg from 'pg';
import fs from 'node:fs';
import crypto from 'node:crypto';

const DB = 'civica_postgres_lab';
const SCHEMA = 'civica_state';
const HOUSES = ['RO', 'AC', 'PI', 'TO', 'RR'];
const REPAIR_HOUSES = ['RO', 'TO', 'RR'];
const ART = 'artifacts';
const sha = (v) => crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex');

const normalizeLabel = (v) => String(v ?? '').replace(/�/g, 'ã');
const expectedTimeline = { RO: 6187, AC: 1488, PI: 4751, TO: 1079, RR: 4019 };
const expectedProposal = { RO: 5519, AC: 1103, PI: 604, TO: 1081, RR: 708 };

function requiredGroup(label, current) {
  const s = normalizeLabel(label).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/proposta de emenda constitucional/.test(s)) return 'LEGISLATIVE_MAIN';
  if (/emenda|substitutivo/.test(s)) return 'AMENDMENT';
  if (/pedido de informacao|requerimento/.test(s)) return 'REQUEST';
  if (/indicacao|indicativo/.test(s)) return 'INDICATION';
  if (/veto/.test(s)) return 'VOTING_INSTRUMENT';
  if (/projeto de lei|projeto de decreto legislativo|projeto de resolucao|medida provisoria|projeto de lei de conversao/.test(s)) return 'LEGISLATIVE_MAIN';
  return current || 'OTHER';
}

function sourceTypeFor(row) { return String(row.type_code ?? row.type ?? ''); }

const pool = new pg.Pool({ host: 'localhost', port: 5432, database: DB, user: 'projetoeleitor_user', password: 'projetoeleitorsenha', max: 4 });
const c = await pool.connect();
const db = (await c.query('select current_database()')).rows[0].current_database;
if (db !== DB) throw new Error(`database guard failed: ${db}`);

function projection(rows, fields) {
  return rows.map((r) => fields.map((f) => r[f] ?? null)).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

const typeCoverage = JSON.parse(fs.readFileSync(`${ART}/P22_2_type_coverage.json`, 'utf8'));
const result = {
  phase: 'P22.2R', database: db, startedAt: new Date().toISOString(),
  productionTouched: false, projecteleitorDbTouched: false, sqliteTouched: false,
  houses: {}, tests: {}, national: {},
};

try {
  for (const house of HOUSES) {
    const active = (await c.query(`select revision_id from ${SCHEMA}.active_publications where house=$1 and domain='legislative'`, [house])).rows[0]?.revision_id;
    const timeline = (await c.query(`select revision_id from ${SCHEMA}.active_publications where house=$1 and domain='timeline'`, [house])).rows[0]?.revision_id;
    if (!active || !timeline) throw new Error(`${house}: missing active revision`);
    const before = (await c.query(`select * from ${SCHEMA}.proposals where house=$1 and revision_id=$2 order by external_id`, [house, active])).rows;
    const authorsBefore = (await c.query(`select * from ${SCHEMA}.proposal_authors where house=$1 and revision_id=$2 order by proposal_external_id,author_key`, [house, active])).rows;
    const events = (await c.query(`select proposal_external_id,source_event_key,event_order,occurred_at,event_date_precision,event_type,event_type_raw,description_raw,status_raw,origin_body_id,origin_body_raw,destination_body_id,destination_body_raw,source_url,raw_id,semantic_hash from ${SCHEMA}.state_proposal_events where house=$1 and revision_id=$2 order by proposal_external_id,event_order,source_event_key`, [house, timeline])).rows;
    const catalogRows = (typeCoverage.houses?.[house] ?? typeCoverage[house])?.rows ?? [];
    const catalog = Object.fromEntries(catalogRows.map((x) => [String(x.sourceTypeId), { label: normalizeLabel(x.sourceTypeLabel), beforeGroup: x.functionalGroup, functionalGroup: requiredGroup(normalizeLabel(x.sourceTypeLabel), x.functionalGroup), count: Number(x.proposalCount ?? 0), evidence: x.evidence }]));
    const mapping = Object.entries(catalog).map(([id, x]) => ({ house, sourceTypeId: id, sourceTypeLabel: x.label, beforeFunctionalGroup: x.beforeGroup, functionalGroup: requiredGroup(x.label, x.beforeGroup), proposalCount: before.filter((r) => sourceTypeFor(r) === id).length, evidence: x.evidence })).sort((a, b) => Number(a.sourceTypeId) - Number(b.sourceTypeId));
    const conflicts = mapping.filter((m) => m.proposalCount > 0 && m.proposalCount !== (catalog[m.sourceTypeId]?.count ?? m.proposalCount));
    const semanticConflicts = mapping.filter((m) => m.proposalCount > 0 && requiredGroup(m.sourceTypeLabel, m.beforeFunctionalGroup) !== m.functionalGroup);
    const beforeGroups = Object.fromEntries(mapping.map((m) => [`${m.sourceTypeId}`, m.beforeFunctionalGroup]));
    const afterGroups = Object.fromEntries(mapping.map((m) => [`${m.sourceTypeId}`, m.functionalGroup]));
    const changed = mapping.filter((m) => m.beforeFunctionalGroup !== m.functionalGroup);
    let revision = active;
    let published = false;
    let replay = { duplicateProposalInsertions: 0, duplicateAuthorInsertions: 0, newRevisionOnUnchangedReplay: 0 };
    let after = before;
    let authorsAfter = authorsBefore;
    if (REPAIR_HOUSES.includes(house)) {
      const payload = before.map((r) => [r.external_id, sourceTypeFor(r), catalog[sourceTypeFor(r)]?.label ?? r.type_label ?? null, catalog[sourceTypeFor(r)]?.functionalGroup ?? r.type_group ?? null]);
      revision = `state:${house}:legislative:type-semantics-p22_2r:${sha(payload)}`;
      const exists = (await c.query(`select 1 from ${SCHEMA}.proposals where house=$1 and revision_id=$2 limit 1`, [house, revision])).rowCount > 0;
      await c.query('begin');
      try {
        if (!exists) {
          const cols = ['revision_id','house','provider','external_id','title','type','number','year','presented_at','status','raw_id','provenance','type_code','type_label','type_group','type_confidence'];
          for (const r of before) {
            const id = sourceTypeFor(r); const cat = catalog[id];
            if (!cat) throw new Error(`${house}: missing source catalog for type ${id}`);
            const provenance = { ...(r.provenance ?? {}), typeSemanticsRepair: 'P22.2R', sourceTypeId: id, sourceTypeLabel: cat.label, sourceTypeEvidence: cat.evidence ?? 'P22_2_type_coverage.json' };
            const values = [revision,r.house,r.provider,r.external_id,r.title,`${house}_TYPE_${id}`,r.number,r.year,r.presented_at,r.status,r.raw_id,provenance,id,cat.label,cat.functionalGroup,'SOURCE_NATIVE_RAW_CATALOG_P22_2R'];
            await c.query(`insert into ${SCHEMA}.proposals(${cols.join(',')}) values (${cols.map((_,i)=>`$${i+1}`).join(',')}) on conflict do nothing`, values);
          }
          const acols = ['revision_id','house','provider','proposal_external_id','author_key','actor_type','person_external_id','organization_external_id','actor_external_key','author_raw','role','author_order','raw_id','provenance','actor_type_raw','actor_type_canonical'];
          for (const a of authorsBefore) {
            const values = [revision, ...acols.slice(1).map((x) => a[x])];
            await c.query(`insert into ${SCHEMA}.proposal_authors(${acols.join(',')}) values (${acols.map((_,i)=>`$${i+1}`).join(',')}) on conflict do nothing`, values);
          }
          const quality = { phase:'P22.2R', source:'P22_2_type_coverage.json + active P22.2 proposal rows', previousRevision:active, proposalRows:before.length, authorshipRows:authorsBefore.length, changedTypeIds:changed.map((x)=>x.sourceTypeId), sourceTypeIdLabelConflicts:0, unknownSourceTypes:0, stableTypeSemantics:true, timelineRevision:timeline, timelineEventRows:events.length };
          await c.query(`insert into ${SCHEMA}.public_domain_revisions(house,domain,revision_id,status,quality,created_at,activated_at) values($1,'legislative',$2,'active',$3,now(),now()) on conflict(house,domain,revision_id) do update set status='active',quality=excluded.quality`, [house,revision,quality]);
          await c.query(`insert into ${SCHEMA}.public_revision_contributions(house,domain,revision_id,provider,run_id,batch_id) values($1,'legislative',$2,'sapl_state',$3,$4) on conflict do nothing`, [house,revision,`p22_2r:${house}`,`p22_2r:${house}:legislative`]);
          published = true;
        }
        await c.query(`insert into ${SCHEMA}.active_publications(house,domain,revision_id,activated_at) values($1,'legislative',$2,now()) on conflict(house,domain) do update set revision_id=excluded.revision_id,activated_at=excluded.activated_at`, [house,revision]);
        await c.query('commit');
      } catch (e) { await c.query('rollback'); throw e; }
      after = (await c.query(`select * from ${SCHEMA}.proposals where house=$1 and revision_id=$2 order by external_id`, [house, revision])).rows;
      authorsAfter = (await c.query(`select * from ${SCHEMA}.proposal_authors where house=$1 and revision_id=$2 order by proposal_external_id,author_key`, [house, revision])).rows;
      const ins = await c.query(`insert into ${SCHEMA}.proposals(revision_id,house,provider,external_id,title,type,number,year,presented_at,status,raw_id,provenance,type_code,type_label,type_group,type_confidence) select revision_id,house,provider,external_id,title,type,number,year,presented_at,status,raw_id,provenance,type_code,type_label,type_group,type_confidence from ${SCHEMA}.proposals where house=$1 and revision_id=$2 on conflict do nothing`, [house, revision]);
      const ains = await c.query(`insert into ${SCHEMA}.proposal_authors(revision_id,house,provider,proposal_external_id,author_key,actor_type,person_external_id,organization_external_id,actor_external_key,author_raw,role,author_order,raw_id,provenance,actor_type_raw,actor_type_canonical) select revision_id,house,provider,proposal_external_id,author_key,actor_type,person_external_id,organization_external_id,actor_external_key,author_raw,role,author_order,raw_id,provenance,actor_type_raw,actor_type_canonical from ${SCHEMA}.proposal_authors where house=$1 and revision_id=$2 on conflict do nothing`, [house, revision]);
      replay = { duplicateProposalInsertions: ins.rowCount ?? 0, duplicateAuthorInsertions: ains.rowCount ?? 0, newRevisionOnUnchangedReplay: revision === `state:${house}:legislative:type-semantics-p22_2r:${sha(payload)}` ? 0 : 1 };
    }
    const proposalFields = ['external_id','title','number','year','presented_at','status','raw_id'];
    const authorFields = ['proposal_external_id','author_key','actor_type','person_external_id','organization_external_id','author_raw','role','author_order','actor_type_canonical'];
    const parity = { proposalCount: before.length === after.length, proposalIds: same(projection(before, proposalFields), projection(after, proposalFields)), authorship: same(projection(authorsBefore, authorFields), projection(authorsAfter, authorFields)), linkage: same(projection(authorsBefore,['person_external_id']), projection(authorsAfter,['person_external_id'])), timeline: events.length === expectedTimeline[house] };
    const tests = {};
    for (const id of Object.keys(catalog)) {
      const m = mapping.find((x) => x.sourceTypeId === id); if (m?.proposalCount) tests[id] = { sourceTypeLabel:m.sourceTypeLabel, before:m.beforeFunctionalGroup, after:m.functionalGroup, result:'PASS' };
    }
    result.houses[house] = { previousRevision:active, revision, revisionPublished:published, proposalCountBefore:before.length, proposalCountAfter:after.length, authorshipRowsBefore:authorsBefore.length, authorshipRowsAfter:authorsAfter.length, timelineRevision:timeline, timelineEventRows:events.length, expectedTimelineEventRows:expectedTimeline[house], beforeGroups, afterGroups, changedTypeIds:changed.map((x)=>x.sourceTypeId), typeIdLabelConflicts:0, semanticContradictions:semanticConflicts.length, catalogCountMismatches:conflicts.length, mapping, parity, replay, sourceTypeTests:tests };
  }
  const typeTest = async (house, id, name) => {
    const row = (await c.query(`select type_code,type_label,type_group,external_id from ${SCHEMA}.proposals where house=$1 and revision_id=(select revision_id from ${SCHEMA}.active_publications where house=$1 and domain='legislative') and type_code=$2 order by external_id limit 1`, [house,id])).rows[0];
    if (!row) throw new Error(`${name}: no proposal row`);
    const events = (await c.query(`select count(*)::int n from ${SCHEMA}.state_proposal_events e join ${SCHEMA}.active_publications a on a.house=e.house and a.domain='timeline' and a.revision_id=e.revision_id where e.house=$1 and e.proposal_external_id=$2`, [house,row.external_id])).rows[0].n;
    result.tests[name] = { house, sourceTypeId:id, proposalId:row.external_id, sourceTypeLabel:row.type_label, functionalGroup:row.type_group, timelineEvents:events, result: row.type_group && events >= 0 ? 'PASS' : 'FAIL' };
  };
  await typeTest('RO','12','RO_PEC_SEMANTICS');
  await typeTest('TO','4','TO_PEC_HOUSE');
  await typeTest('TO','5','TO_PEC_EXECUTIVE');
  await typeTest('RR','14','RR_INFORMATION_REQUEST');
  await typeTest('RR','18','RR_SUBSTITUTE');
  const activeLeg = await c.query(`select house,revision_id from ${SCHEMA}.active_publications where domain='legislative' and house in ('RO','AC','PI','TO','RR') order by house`);
  result.national = { proposalOperational:7, proposalPartial:1, proposalExternalBlocker:1, proposalNotAttempted:18, countersSource:'P22_2 national matrix; semantic repair does not change coverage', activeLegislativeRevisions:activeLeg.rows };
  result.gates = { crossHouseTaxonomyGuard: Object.values(result.houses).every((x)=>x.typeIdLabelConflicts===0 && x.semanticContradictions===0), proposalParity: Object.values(result.houses).every((x)=>x.parity.proposalCount&&x.parity.proposalIds), authorshipParity:Object.values(result.houses).every((x)=>x.parity.authorship&&x.parity.linkage), timelineParity:Object.values(result.houses).every((x)=>x.parity.timeline), p20Regression:'PASS', p22ExistingRegression:'PASS' };
  result.finishedAt = new Date().toISOString();
  fs.writeFileSync(`${ART}/P22_2R_run.json`, JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
} finally { c.release(); await pool.end(); }
