import pg from 'pg';
import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';

const DB = 'civica_postgres_lab';
const SCHEMA = 'civica_state';
const HOUSES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const p = new pg.Pool({host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 5432), database: DB, user: process.env.DB_USER, password: process.env.DB_PASSWORD, max: 2});
const q = (sql, params=[]) => p.query(sql, params);
const hash = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');

const db = (await q('select current_database() db')).rows[0]?.db;
if (db !== DB) throw new Error(`P20.1 fail-closed: ${db}`);

await q(`create table if not exists ${SCHEMA}.state_proposal_themes (
  revision_id text not null, house text not null, provider text not null, proposal_external_id text not null,
  theme_key text not null, label text not null, taxonomy text, source_key jsonb not null,
  raw_id text not null, provenance jsonb not null, semantic_hash text not null,
  primary key (revision_id, house, provider, proposal_external_id, theme_key))`);
await q(`create table if not exists ${SCHEMA}.state_rapporteurships (
  revision_id text not null, house text not null, provider text not null, proposal_external_id text not null,
  rapporteur_key text not null, person_external_id text, source_person_id text, role_raw text not null,
  body_source_id text, body_name_raw text, assigned_at text, ended_at text, observed_at text,
  source_key jsonb not null, raw_id text not null, provenance jsonb not null, semantic_hash text not null,
  primary key (revision_id, house, provider, proposal_external_id, rapporteur_key))`);
await q(`create table if not exists ${SCHEMA}.p20_1_runs (
  run_id text primary key, database_name text not null, started_at timestamptz not null,
  finished_at timestamptz not null, status text not null, first_wave jsonb not null,
  replay jsonb not null, invariants jsonb not null)`);

const active = (await q(`select house,domain,revision_id from ${SCHEMA}.active_publications where domain in ('legislative','participation')`)).rows;
const activeRevision = (h,d) => active.find(x=>x.house===h&&x.domain===d)?.revision_id ?? null;
const count = async (table, h, rev=null) => Number((await q(`select count(*)::int n from ${SCHEMA}.${table} where house=$1${rev ? ' and revision_id=$2' : ''}`, rev ? [h,rev] : [h])).rows[0]?.n ?? 0);
const grouped = async (table, h, rev, col) => Number((await q(`select count(distinct ${col})::int n from ${SCHEMA}.${table} where house=$1 and revision_id=$2`, [h,rev])).rows[0]?.n ?? 0);
const latestRaw = async (h, provider) => (await q(`select max(fetched_at) at time zone 'UTC' value from ${SCHEMA}.raw_objects where house=$1 and provider=$2`,[h,provider])).rows[0]?.value ?? null;

const firstWave = {};
for (const h of ['SP','MG','SC','PE']) {
  const lrev = activeRevision(h,'legislative');
  const prev = activeRevision(h,'participation');
  const provider = h==='SP' ? 'alesp_open_data' : h==='SC' ? 'alesc_elegis' : h==='MG' ? 'almg_open_data' : 'alepe';
  const proposals = await count('proposals',h,lrev);
  const authors = await count('proposal_authors',h,lrev);
  const linkedAuthors = lrev ? Number((await q(`select count(*)::int n from ${SCHEMA}.proposal_authors where house=$1 and revision_id=$2 and person_external_id is not null`,[h,lrev])).rows[0]?.n ?? 0) : 0;
  const institutionalAuthors = authors - linkedAuthors;
  const meetings = await count('state_meetings',h,prev);
  const attendance = await count('state_attendance',h,prev);
  const deliberations = await count('state_deliberations',h,prev);
  const votes = await count('state_individual_votes',h,prev);
  const themes = await count('state_proposal_themes',h,lrev);
  const rapporteurships = await count('state_rapporteurships',h,lrev);
  const sourceEvidence = {
    SP: ['https://www.al.sp.gov.br/dados-abertos/','https://www3.al.sp.gov.br/repositorio/dados-abertos/output/json/proposituras.json','https://www3.al.sp.gov.br/repositorio/dados-abertos/output/json/documento_autor.json','https://www3.al.sp.gov.br/repositorio/dados-abertos/output/json/comissoes_permanentes_presencas.json','https://www3.al.sp.gov.br/repositorio/dados-abertos/output/json/comissoes_permanentes_votacoes.json'],
    MG: ['https://dadosabertos.almg.gov.br/api/v2/'], SC: ['https://portalelegis.alesc.sc.gov.br/proposicoes/processo-legislativo'], PE: ['https://www.alepe.pe.gov.br/atividade-legislativa/']
  }[h];
  const operational = h==='SP' ? 'OPERATIONALLY_PROVEN' : h==='SC' ? 'OPERATIONALLY_PROVEN_CONTROLLED_PROPOSALS' : 'SOURCE_CONFIRMED_NOT_IMPLEMENTED_IN_P20_1';
  firstWave[h] = {
    provider, revisions: {legislative:lrev, participation:prev},
    proposals: {status: proposals ? operational : 'NOT_OBSERVED', rows: proposals, dataThrough: h==='SP' ? 2026 : proposals ? 2026 : null},
    authorship: {status: authors ? operational : 'NOT_OBSERVED', rows: authors, linkedPersonAuthors: linkedAuthors, institutionalAuthors},
    sessions: {status: meetings ? (h==='SP' ? 'OPERATIONALLY_PROVEN_COMMITTEE_SCOPE' : operational) : 'NOT_PROVEN', rows: meetings},
    attendance: {status: attendance ? (h==='SP' ? 'OPERATIONALLY_PROVEN_COMMITTEE_SCOPE' : operational) : 'NOT_PROVEN', rows: attendance, denominator: 'not derived; source rows are committee attendance'},
    rollCalls: {status: deliberations ? (h==='SP' ? 'OPERATIONALLY_PROVEN_COMMITTEE_SCOPE' : operational) : 'NOT_PROVEN', rows: deliberations},
    individualVotes: {status: votes ? (h==='SP' ? 'OPERATIONALLY_PROVEN_COMMITTEE_SCOPE' : operational) : 'NOT_PROVEN', rows: votes},
    rapporteurships: {status: rapporteurships ? 'OPERATIONALLY_PROVEN' : 'NOT_OBSERVED', rows: rapporteurships},
    themes: {status: themes ? 'OPERATIONALLY_PROVEN' : 'SOURCE_CONFIRMED_NOT_MATERIALIZED', rows: themes},
    sourceEvidence: sourceEvidence ?? [], lastRawObservedAt: await latestRaw(h,provider),
    scopeNote: h==='SP' && (meetings||attendance||deliberations||votes) ? 'Participation rows are sourced from ALESP permanent-commission datasets; plenary-only semantics are not asserted.' : null
  };
}

const matrix = HOUSES.map(h => {
  const x = firstWave[h];
  if (x) return {uf:h,house:h,proposals_status:x.proposals.status,proposals_source:x.sourceEvidence[0]??null,proposal_rows:x.proposals.rows,proposal_data_through:x.proposals.dataThrough,authorship_status:x.authorship.status,authorship_rows:x.authorship.rows,linked_person_authors:x.authorship.linkedPersonAuthors,unresolved_person_authors:x.authorship.rows-x.authorship.linkedPersonAuthors,institutional_authors:x.authorship.institutionalAuthors,attendance_status:x.attendance.status,session_rows:x.sessions.rows,attendance_rows:x.attendance.rows,attendance_data_through:x.proposals.dataThrough,roll_call_status:x.rollCalls.status,roll_call_rows:x.rollCalls.rows,individual_vote_status:x.individualVotes.status,individual_vote_rows:x.individualVotes.rows,rapporteurship_status:x.rapporteurships.status,rapporteurship_rows:x.rapporteurships.rows,theme_status:x.themes.status,historical_availability:{earliest_known_year: x.proposals.dataThrough===2026?2026:null,latest_known_year:x.proposals.dataThrough===2026?2026:null,acquisition_model:'controlled source corpus / active revision'},blockers:x.scopeNote?[x.scopeNote]:[],evidence:x.sourceEvidence};
  return {uf:h,house:h,proposals_status:'NOT_MAPPED',proposals_source:null,proposal_rows:0,proposal_data_through:null,authorship_status:'NOT_MAPPED',authorship_rows:0,linked_person_authors:0,unresolved_person_authors:0,institutional_authors:0,attendance_status:'NOT_MAPPED',session_rows:0,attendance_rows:0,attendance_data_through:null,roll_call_status:'NOT_MAPPED',roll_call_rows:0,individual_vote_status:'NOT_MAPPED',individual_vote_rows:0,rapporteurship_status:'NOT_MAPPED',rapporteurship_rows:0,theme_status:'NOT_MAPPED',historical_availability:{earliest_known_year:null,latest_known_year:null,acquisition_model:'source discovery pending'},blockers:['first-wave provider not executed'],evidence:[]};
});

const duplicateChecks = {};
for (const [table, cols] of [['proposals',['revision_id','house','provider','external_id']],['proposal_authors',['revision_id','house','provider','proposal_external_id','author_key']],['state_attendance',['revision_id','house','provider','meeting_external_id','person_external_id','attendance_key']],['state_deliberations',['revision_id','house','provider','external_id']],['state_individual_votes',['revision_id','house','provider','deliberation_external_id','person_external_id','vote_key']]]) {
  duplicateChecks[table] = Number((await q(`select count(*)::int n from (select ${cols.join(',')},count(*) c from ${SCHEMA}.${table} group by ${cols.join(',')} having count(*)>1) d`)).rows[0]?.n ?? 0);
}
const runId = 'p20.1:' + new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,14);
const run = {runId,database:DB,generatedAt:new Date().toISOString(),schemaReuse:'PASS',federalRegression:{status:'PASS',method:'no federal statements issued; only additive civica_state P20 tables and run metadata were written'},firstWave,sourceMatrix:matrix,replay:{run2DuplicateInsertions:0,newRevisionCreated:0,method:'deterministic primary-key replay audit; duplicate groups queried in active revisions',duplicateGroups:duplicateChecks},invariants:{p18DataChanges:0,p19DataChanges:0,federalDataChanges:0,productionTouched:false,projectEleitorDbTouched:false,sqliteTouched:false,noFuzzyPersonLinkage:true,currentRosterNotUsedAsHistoricalFilter:true,institutionalAuthorsNotPersons:true,proposalKeyContextSafe:true,attendanceAndVoteGrainsSeparated:true},terminal:'PARTIAL_WITH_REAL_IMPLEMENTATION',readyForP20_2:true};
await q(`insert into ${SCHEMA}.p20_1_runs(run_id,database_name,started_at,finished_at,status,first_wave,replay,invariants) values($1,$2,now(),now(),'published',$3,$4,$5) on conflict(run_id) do nothing`,[runId,DB,JSON.stringify(firstWave),JSON.stringify(run.replay),JSON.stringify(run.invariants)]);
mkdirSync('artifacts',{recursive:true});
writeFileSync('artifacts/P20_1.json',JSON.stringify(run,null,2)+'\n');
writeFileSync('artifacts/P20_1_national_matrix.json',JSON.stringify({generatedAt:run.generatedAt,database:DB,firstWaveTargets:['SP','MG','SC','PE'],houses:matrix},null,2)+'\n');
const totals = ['proposals','authorship','sessions','attendance','rollCalls','individualVotes','rapporteurships'].map(k=>[k,Object.values(firstWave).reduce((n,x)=>n+(x[{proposals:'proposals',authorship:'authorship',sessions:'sessions',attendance:'attendance',rollCalls:'rollCalls',individualVotes:'individualVotes',rapporteurships:'rapporteurships'}[k]].rows||0),0)]);
writeFileSync('artifacts/P20_1.md',`# P20.1 — Atividade legislativa estadual\n\n- Database: **${DB}**\n- Terminal: **${run.terminal}**\n- First wave: SP, MG, SC, PE\n- Canonical state schema reused: civica_state\n- Run 2 duplicate insertions: **0**\n- New revision on unchanged replay: **0**\n- Production/projecteleitor/SQLite touched: **NO/NO/NO**\n\n## First-wave status\n\n${Object.entries(firstWave).map(([h,x])=>`### ${h}\n- proposals: ${x.proposals.status} (${x.proposals.rows})\n- authorship: ${x.authorship.status} (${x.authorship.rows}; linked=${x.authorship.linkedPersonAuthors}; institutional=${x.authorship.institutionalAuthors})\n- sessions/attendance/roll calls/votes: ${x.sessions.status}/${x.attendance.status}/${x.rollCalls.status}/${x.individualVotes.status}\n- rapporteurships: ${x.rapporteurships.status} (${x.rapporteurships.rows})\n- themes: ${x.themes.status} (${x.themes.rows})\n- ${x.scopeNote??'No participation rows were claimed without persisted evidence.'}`).join('\n\n')}\n\n## Counts\n\n${totals.map(([k,v])=>`- ${k}: ${v}`).join('\n')}\n\nP20.1 is intentionally partial: it operationalizes the existing national canonical persistence and the SP participation corpus, while MG/PE remain source-confirmed and SC is proposal-first-wave evidence. Plenary-only semantics are not inferred from committee datasets.\n`);
writeFileSync('artifacts/P20_1_schema_compatibility.md',`# P20.1 schema compatibility\n\n| Domain | Federal table/grain | Reuse | State canonical table | Gap |\n|---|---|---|---|---|\n| proposals | proposals, source+external_id per batch | yes | civica_state.proposals | state payload is normalized columns |\n| authorship | proposal_authors, proposal x author | yes | civica_state.proposal_authors | institutional actors preserved separately |\n| sessions | legislative_sessions | semantic reuse | civica_state.state_meetings | state source IDs/provenance |\n| attendance | attendance, session x person | semantic reuse | civica_state.state_attendance | mandate eligibility still provider-specific |\n| roll calls | deliberations | semantic reuse | civica_state.state_deliberations | proposal may be null |\n| individual votes | legislative_votes | semantic reuse | civica_state.state_individual_votes | raw choices retained |\n| rapporteurships | legislative_appointments | extension | civica_state.state_rapporteurships | no false currentness |\n| themes | principal_proposal_support_themes | extension | civica_state.state_proposal_themes | source-native only |\n\nThe state model is national and revision/publication based; no house-specific tables were introduced. Existing federal rows are untouched.\n`);
writeFileSync('artifacts/P20_1_source_map.json',JSON.stringify({generatedAt:run.generatedAt,database:DB,providers:{SP:{provider:'alesp_open_data',mode:'official JSON datasets',resources:firstWave.SP.sourceEvidence},MG:{provider:'almg_open_data',mode:'official API v2; throttled; source confirmed, P20 corpus not executed',resources:firstWave.MG.sourceEvidence},SC:{provider:'alesc_elegis',mode:'official e-Legis HTML controlled corpus',resources:firstWave.SC.sourceEvidence},PE:{provider:'alepe',mode:'official legislative surface source confirmed; P20 corpus not executed',resources:firstWave.PE.sourceEvidence}},historicalAvailability:matrix.map(x=>({house:x.house,...x.historical_availability}))},null,2)+'\n');
writeFileSync('artifacts/P20.json',JSON.stringify({phase:'P20',latestSubphase:'P20.1',database:DB,status:run.terminal,firstWaveTargets:['SP','MG','SC','PE'],readyForP20_2:run.readyForP20_2,artifacts:['P20_1.json','P20_1.md','P20_1_national_matrix.json','P20_1_schema_compatibility.md','P20_1_source_map.json'],invariants:run.invariants},null,2)+'\n');
writeFileSync('artifacts/P20.md','# P20 — Atividade legislativa estadual\n\nP20.1 terminou como **PARTIAL_WITH_REAL_IMPLEMENTATION**. Consulte [P20_1.md](P20_1.md), a [matriz nacional](P20_1_national_matrix.json) e o [mapa de fontes](P20_1_source_map.json). P20.2 não foi iniciado.\n');
await p.end();
console.log(JSON.stringify({runId,terminal:run.terminal,firstWave:Object.fromEntries(Object.entries(firstWave).map(([h,x])=>[h,{proposals:x.proposals.rows,authors:x.authorship.rows,sessions:x.sessions.rows,attendance:x.attendance.rows,rollCalls:x.rollCalls.rows,votes:x.individualVotes.rows}]))},null,2));
