import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { migrations } from './migrations.ts';
import { reportingCutoff } from './reporting-period.ts';
import { countsAsParticipation } from './vote-participation.ts';
import { searchText, validateProfile, ufs, type Attendance, type Candidacy, type CampaignTransaction, type Deliberation, type ElectoralAsset, type ExpandedCost, type Expense, type Issue, type LegislativeComplement, type LegislativeSession, type LegislativeVote, type Profile, type Source, type Proposal, type ProposalAuthor, type LegislativeAppointment, type LawLink } from '@senadotracker/domain';

export function transaction<T>(db: DatabaseSync, work: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try { const result = work(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
export function openDatabase(path: string, readOnly = false): DatabaseSync {
  if (!readOnly && path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path, { readOnly, enableForeignKeyConstraints: true });
  db.function('search_text',{deterministic:true},value=>searchText(String(value??'')));
  db.exec('PRAGMA busy_timeout=5000');
  if (!readOnly) {
    db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,sha256 TEXT NOT NULL) STRICT');
    for (const migration of migrations) transaction(db, () => {
      const hash = createHash('sha256').update(migration.sql).digest('hex');
      const prior = db.prepare('SELECT sha256 FROM schema_migrations WHERE version=?').get(migration.version);
      if (prior) { if (prior.sha256 !== hash) throw new Error('Migração já aplicada foi alterada'); return; }
      db.exec(migration.sql);
      db.prepare('INSERT INTO schema_migrations VALUES (?,?)').run(migration.version, hash);
    });
  }
  return db;
}
export function startRun(db: DatabaseSync, source: Source|'tse', now = Date.now(), leaseMs = 120_000): string {
  return transaction(db, () => {
    const lock = db.prepare('SELECT * FROM job_locks WHERE source=?').get(source);
    if (lock && Number(lock.expires_at) > now) throw new Error(`Job ${source} já está em execução`);
    if (lock) db.prepare("UPDATE ingestion_runs SET status='failed',finished_at=?,error='Lease expirado' WHERE id=? AND status IN ('running','validated')").run(new Date(now).toISOString(), lock.run_id!);
    const id = randomUUID();
    db.prepare("INSERT INTO ingestion_runs(id,source,started_at,status,parser_version) VALUES (?,?,?,'running','cadastro-v1')").run(id, source, new Date(now).toISOString());
    db.prepare('INSERT INTO job_locks VALUES (?,?,?) ON CONFLICT(source) DO UPDATE SET run_id=excluded.run_id,expires_at=excluded.expires_at').run(source, id, now + leaseMs);
    return id;
  });
}
export function heartbeat(db: DatabaseSync, runId: string, now = Date.now(), leaseMs = 120_000): void {
  const result = db.prepare('UPDATE job_locks SET expires_at=? WHERE run_id=? AND expires_at>?').run(now + leaseMs, runId, now);
  if (Number(result.changes) !== 1) throw new Error('Lease perdido; execução não pode continuar');
}
export function failRun(db: DatabaseSync, runId: string, error: string): void {
  transaction(db, () => {
    db.prepare("UPDATE ingestion_runs SET status='failed',finished_at=?,error=? WHERE id=? AND status <> 'published'").run(new Date().toISOString(), error, runId);
    db.prepare('DELETE FROM job_locks WHERE run_id=?').run(runId);
  });
}
export function addIssues(db: DatabaseSync, runId: string, issues: Issue[]): void {
  const insert = db.prepare('INSERT INTO validation_issues(run_id,external_id,raw_id,severity,code,message) VALUES (?,?,?,?,?,?)');
  for (const issue of issues) insert.run(runId, issue.externalId, issue.rawId, issue.severity, issue.code, issue.message);
}
export function stageProfile(db: DatabaseSync, runId: string, profile: Profile): void {
  const run = db.prepare('SELECT source,status FROM ingestion_runs WHERE id=?').get(runId);
  if (!run || run.source !== profile.source || run.status !== 'running') throw new Error('Staging exige execução ativa da mesma fonte');
  heartbeat(db, runId);
  db.prepare('INSERT INTO staged_profiles VALUES (?,?,?) ON CONFLICT(run_id,external_id) DO UPDATE SET payload=excluded.payload').run(runId, profile.externalId, JSON.stringify(profile));
}
export interface Reconciliation {
  initialIds: string[]; finalIds: string[]; changedIds: string[]; pagesComplete: boolean;
  initialRawIds: string[]; finalRawIds: string[];
}
export function validateRun(db: DatabaseSync, runId: string, report: Reconciliation): { valid: boolean; count: number; issues: Issue[] } {
  heartbeat(db, runId);
  const rows = db.prepare('SELECT payload FROM staged_profiles WHERE run_id=? ORDER BY external_id').all(runId);
  const profiles = rows.map(row => JSON.parse(String(row.payload)) as Profile);
  const issues: Issue[] = [];
  const error = (code: string, message: string) => issues.push({ severity: 'error', code, message, externalId: null, rawId: null });
  const equalIds = (a: string[], b: string[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
  if (!report.pagesComplete || !profiles.length || !report.initialIds.length) error('incomplete_roster', 'Cadastro vazio ou paginação incompleta');
  if (new Set(report.initialIds).size !== report.initialIds.length || new Set(report.finalIds).size !== report.finalIds.length) error('duplicate_roster', 'Identidades duplicadas na fonte');
  if (!equalIds(report.initialIds, report.finalIds) || report.changedIds.length) error('roster_changed', 'Cadastro mudou durante a coleta; executar novamente');
  if (!equalIds(report.initialIds, profiles.map(p => p.externalId))) error('missing_profiles', 'Staging não cobre a lista oficial');
  if (!report.initialRawIds.length || !report.finalRawIds.length) error('missing_evidence', 'Reconciliação sem respostas oficiais');
  const rawExists = db.prepare('SELECT id FROM raw_objects WHERE id=? AND run_id=? AND status=200');
  for (const rawId of [...report.initialRawIds, ...report.finalRawIds]) if (!rawExists.get(rawId, runId)) error('missing_evidence', 'Objeto de reconciliação não pertence à execução');
  for (const profile of profiles) {
    const diagnostics = validateProfile(profile);
    issues.push(...diagnostics);
    const origins = [profile, ...profile.mandates, ...profile.exercises, ...profile.parties, ...profile.events];
    if (origins.some(item => !rawExists.get(item.rawId, runId))) error('missing_origin', 'Registro sem resposta oficial nesta execução');
    if (!profile.mandates.length) error('missing_history', `Mandatos ausentes: ${profile.externalId}`);
    if (diagnostics.some(issue => issue.severity === 'warning')) {
      profile.historyAvailability = 'partial';
      db.prepare('UPDATE staged_profiles SET payload=? WHERE run_id=? AND external_id=?').run(JSON.stringify(profile), runId, profile.externalId);
    }
  }
  addIssues(db, runId, issues);
  const errors = db.prepare("SELECT count(*) AS count FROM validation_issues WHERE run_id=? AND severity='error'").get(runId)!;
  const valid = Number(errors.count) === 0;
  db.prepare('UPDATE ingestion_runs SET expected_count=?,roster_complete=?,reconciliation_json=?,status=? WHERE id=?').run(report.initialIds.length, valid ? 1 : 0, JSON.stringify(report), valid ? 'validated' : 'running', runId);
  return { valid, count: profiles.length, issues };
}
export function publishRun(db: DatabaseSync, runId: string): void {
  transaction(db, () => {
    const run = db.prepare('SELECT * FROM ingestion_runs WHERE id=?').get(runId);
    if (run?.status === 'published') return; // Idempotent retry of the exact batch.
    heartbeat(db, runId);
    if (!run || run.status !== 'validated' || run.roster_complete !== 1) throw new Error('Publicação exige lote validado e completo');
    const rows = db.prepare('SELECT payload FROM staged_profiles WHERE run_id=?').all(runId);
    if (rows.length !== run.expected_count) throw new Error('Staging alterado após validação');
    const now = new Date().toISOString();
    db.prepare('INSERT INTO publication_batches VALUES (?,?,?)').run(runId, run.source!, now);
    for (const row of rows) {
      const profile = JSON.parse(String(row.payload)) as Profile;
      let personId = db.prepare('SELECT person_id FROM external_identifiers WHERE source=? AND external_id=?').get(profile.source, profile.externalId)?.person_id;
      if (!personId) {
        personId = randomUUID();
        db.prepare('INSERT INTO people VALUES (?,?)').run(personId, now);
        db.prepare('INSERT INTO external_identifiers VALUES (?,?,?)').run(profile.source, profile.externalId, personId);
      }
      db.prepare('INSERT INTO profiles VALUES (?,?,?,?,?,?,?,?,?)').run(runId, personId, profile.externalId, profile.name, searchText(profile.name), profile.uf, profile.party, profile.rawId, JSON.stringify(profile));
      for (const m of profile.mandates) db.prepare('INSERT INTO mandates VALUES (?,?,?,?,?)').run(runId, personId, m.key, m.rawId, JSON.stringify(m));
      for (const e of profile.exercises) db.prepare('INSERT INTO exercise_periods VALUES (?,?,?,?,?,?,?,?)').run(runId, personId, e.key, e.mandateKey, e.start, e.end, e.rawId, JSON.stringify(e));
      for (const p of profile.parties) db.prepare('INSERT INTO party_memberships VALUES (?,?,?,?,?,?,?)').run(runId, personId, p.key, p.start, p.end, p.rawId, JSON.stringify(p));
      for (const e of profile.events) db.prepare('INSERT INTO history_events VALUES (?,?,?,?,?)').run(runId, personId, e.key, e.rawId, JSON.stringify(e));
    }
    db.prepare('INSERT INTO active_publications VALUES (?,?) ON CONFLICT(source) DO UPDATE SET batch_id=excluded.batch_id').run(run.source!, runId);
    db.prepare("UPDATE ingestion_runs SET status='published',finished_at=? WHERE id=?").run(now, runId);
    db.prepare('DELETE FROM job_locks WHERE run_id=?').run(runId);
  });
}
export interface ProfileQuery { source?: Source; uf?: string; party?: string; search?: string; page?: number; pageSize?: number }
export function listPublished(db: DatabaseSync, query: ProfileQuery = {}) {
  const page = query.page ?? 1; const pageSize = query.pageSize ?? 20;
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100 || !Number.isSafeInteger((page - 1) * pageSize)) throw new Error('Paginação inválida');
  if (query.source && !['senado','camara'].includes(query.source)) throw new Error('Fonte inválida');
  if (query.uf && !ufs.has(query.uf)) throw new Error('UF inválida');
  const where: string[] = []; const values: string[] = [];
  for (const [column, value] of [['a.source', query.source], ['p.uf', query.uf], ['p.party', query.party]] as const) if (value) { where.push(`${column}=?`); values.push(value); }
  if (query.search) { where.push('instr(p.search_name,?)>0'); values.push(searchText(query.search)); }
  const from = `FROM profiles p JOIN active_publications a ON a.batch_id=p.batch_id JOIN publication_batches b ON b.id=a.batch_id ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`;
  const total = Number(db.prepare(`SELECT count(*) AS total ${from}`).get(...values)!.total);
  const rows = db.prepare(`SELECT p.person_id,p.payload,p.batch_id,b.published_at ${from} ORDER BY p.search_name,a.source,p.external_id LIMIT ? OFFSET ?`).all(...values, pageSize, (page - 1) * pageSize);
  return { total, page, pageSize, items: rows.map(row => ({ personId: String(row.person_id), batchId: String(row.batch_id), publishedAt: String(row.published_at), ...JSON.parse(String(row.payload)) as Profile })) };
}
export function getPublished(db: DatabaseSync, source: Source, externalId: string) {
  const row = db.prepare('SELECT p.person_id,p.payload,p.batch_id,b.published_at FROM profiles p JOIN active_publications a ON a.batch_id=p.batch_id JOIN publication_batches b ON b.id=a.batch_id WHERE a.source=? AND p.external_id=?').get(source, externalId);
  return row ? { personId: String(row.person_id), batchId: String(row.batch_id), publishedAt: String(row.published_at), ...JSON.parse(String(row.payload)) as Profile } : null;
}
export function publishedFacets(db: DatabaseSync, source?: Source) {
  const filter = source ? 'WHERE a.source=?' : '';
  const values = source ? [source] : [];
  const base = `FROM profiles p JOIN active_publications a ON a.batch_id=p.batch_id ${filter}`;
  return {
    parties: db.prepare(`SELECT p.party value,count(*) count ${base} GROUP BY p.party ORDER BY p.party`).all(...values).map(row => ({ value: String(row.value), count: Number(row.count) })),
    ufs: db.prepare(`SELECT p.uf value,count(*) count ${base} GROUP BY p.uf ORDER BY p.uf`).all(...values).map(row => ({ value: String(row.value), count: Number(row.count) })),
  };
}
export function publishedSourceInfo(db: DatabaseSync, source: Source, externalId: string) {
  const row = db.prepare(`SELECT r.url,r.fetched_at,r.sha256,r.content_type,p.batch_id,b.published_at
    FROM profiles p JOIN active_publications a ON a.batch_id=p.batch_id
    JOIN publication_batches b ON b.id=p.batch_id JOIN raw_objects r ON r.id=p.raw_id
    WHERE a.source=? AND p.external_id=?`).get(source, externalId);
  return row ? { url: String(row.url), fetchedAt: String(row.fetched_at), sha256: String(row.sha256), contentType: String(row.content_type), batchId: String(row.batch_id), publishedAt: String(row.published_at) } : null;
}

export function publishExpenses(db: DatabaseSync, runId: string, source: Source, year: number, expenses: Expense[]): void {
  transaction(db,()=>{
    const run=db.prepare('SELECT status FROM ingestion_runs WHERE id=? AND source=?').get(runId,source);
    if(!run||run.status!=='running')throw new Error('Publicação financeira exige execução ativa');
    if(!Number.isInteger(year)||year<2008||year>2100)throw new Error('Ano financeiro inválido');
    if(!expenses.length)throw new Error('Lote financeiro vazio');
    const keys=new Set<string>();
    for(const expense of expenses){
      if(expense.source!==source||expense.year!==year||keys.has(expense.recordKey))throw new Error('Lote financeiro inconsistente ou duplicado');
      keys.add(expense.recordKey);
      if(!db.prepare('SELECT 1 FROM external_identifiers WHERE source=? AND external_id=?').get(source,expense.externalId))throw new Error(`Despesa sem identidade publicada: ${expense.externalId}`);
      if(!db.prepare('SELECT 1 FROM raw_objects WHERE id=? AND run_id=?').get(expense.rawId,runId))throw new Error('Despesa sem origem nesta execução');
    }
    const now=new Date().toISOString(); const total=expenses.reduce((sum,e)=>sum+e.netCents-e.refundCents,0);
    db.prepare('INSERT INTO expense_batches VALUES (?,?,?,?,?,?)').run(runId,source,year,now,expenses.length,total);
    const insert=db.prepare('INSERT INTO expenses VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    for(const e of expenses)insert.run(runId,e.source,e.externalId,e.year,e.month,e.recordKey,e.categoryCode,e.category,e.supplier,e.supplierDocument,e.documentNumber,e.documentId,e.documentUrl,e.issuedAt,e.grossCents,e.deductionCents,e.netCents,e.refundCents,e.installment,e.detail,e.rawId);
    db.prepare('INSERT INTO active_expense_publications VALUES (?,?,?) ON CONFLICT(source,year) DO UPDATE SET batch_id=excluded.batch_id').run(source,year,runId);
    db.prepare("UPDATE ingestion_runs SET status='published',finished_at=?,expected_count=?,roster_complete=1,reconciliation_json=? WHERE id=?").run(now,expenses.length,JSON.stringify({year,recordCount:expenses.length,netCents:total}),runId);
    db.prepare('DELETE FROM job_locks WHERE run_id=?').run(runId);
  });
}
export function publishedExpenses(db: DatabaseSync, source: Source, externalId: string) {
  const years=db.prepare('SELECT year,batch_id FROM active_expense_publications WHERE source=? ORDER BY year DESC').all(source);
  const rows=db.prepare(`SELECT e.*,r.url,r.fetched_at,r.sha256,b.published_at FROM expenses e
    JOIN active_expense_publications a ON a.batch_id=e.batch_id JOIN expense_batches b ON b.id=e.batch_id JOIN raw_objects r ON r.id=e.raw_id
    WHERE e.source=? AND e.external_id=? ORDER BY e.year DESC,e.month DESC,e.issued_at DESC,e.record_key`).all(source,externalId);
  return {coverage:years.map(r=>({year:Number(r.year),batchId:String(r.batch_id)})),items:rows.map(r=>({source:String(r.source) as Source,externalId:String(r.external_id),year:Number(r.year),month:Number(r.month),recordKey:String(r.record_key),categoryCode:String(r.category_code),category:String(r.category),supplier:r.supplier?String(r.supplier):null,supplierDocument:r.supplier_document?String(r.supplier_document):null,documentNumber:r.document_number?String(r.document_number):null,documentId:r.document_id?String(r.document_id):null,documentUrl:r.document_url?String(r.document_url):null,issuedAt:r.issued_at?String(r.issued_at):null,grossCents:r.gross_cents===null?null:Number(r.gross_cents),deductionCents:Number(r.deduction_cents),netCents:Number(r.net_cents),refundCents:Number(r.refund_cents),installment:r.installment===null?null:Number(r.installment),detail:r.detail?String(r.detail):null,rawId:String(r.raw_id),origin:{url:String(r.url),fetchedAt:String(r.fetched_at),sha256:String(r.sha256),publishedAt:String(r.published_at),batchId:String(r.batch_id)}}))};
}
export function publishLegislation(db:DatabaseSync,runId:string,source:Source,year:number,deliberations:Deliberation[],votes:LegislativeVote[]){transaction(db,()=>{const run=db.prepare('SELECT status FROM ingestion_runs WHERE id=? AND source=?').get(runId,source);if(!run||run.status!=='running'||!deliberations.length)throw new Error('Lote legislativo inválido');const ds=new Set(deliberations.map(d=>d.externalId));if(ds.size!==deliberations.length||votes.some(v=>!ds.has(v.deliberationId)))throw new Error('Voto sem deliberação ou deliberação duplicada');const now=new Date().toISOString();db.prepare('INSERT INTO legislative_batches VALUES (?,?,?,?,?,?)').run(runId,source,year,now,deliberations.length,votes.length);const di=db.prepare('INSERT INTO deliberations VALUES (?,?,?,?,?,?,?)');for(const d of deliberations)di.run(runId,source,d.externalId,year,d.date,d.rawId,JSON.stringify(d));const vi=db.prepare('INSERT INTO legislative_votes VALUES (?,?,?,?,?,?)');for(const v of votes)vi.run(runId,source,v.deliberationId,v.externalId,v.rawId,JSON.stringify(v));db.prepare('INSERT INTO active_legislative_publications VALUES (?,?,?) ON CONFLICT(source,year) DO UPDATE SET batch_id=excluded.batch_id').run(source,year,runId);db.prepare("UPDATE ingestion_runs SET status='published',finished_at=?,expected_count=?,roster_complete=1,reconciliation_json=? WHERE id=?").run(now,votes.length,JSON.stringify({year,deliberations:deliberations.length,votes:votes.length}),runId);db.prepare('DELETE FROM job_locks WHERE run_id=?').run(runId)})}
export function publishedVotes(db:DatabaseSync,source:Source,externalId:string){const rows=db.prepare(`SELECT v.payload vote,d.payload deliberation,r.url,r.fetched_at,r.sha256,b.published_at,v.batch_id FROM legislative_votes v JOIN active_legislative_publications a ON a.batch_id=v.batch_id JOIN deliberations d ON d.batch_id=v.batch_id AND d.external_id=v.deliberation_id JOIN legislative_batches b ON b.id=v.batch_id JOIN raw_objects r ON r.id=v.raw_id WHERE v.source=? AND v.external_id=? AND substr(d.date,1,10)<=? ORDER BY d.date DESC,v.deliberation_id`).all(source,externalId,reportingCutoff(new Date().getFullYear()));return rows.map(r=>({vote:JSON.parse(String(r.vote)) as LegislativeVote,deliberation:JSON.parse(String(r.deliberation)) as Deliberation,origin:{url:String(r.url),fetchedAt:String(r.fetched_at),sha256:String(r.sha256),publishedAt:String(r.published_at),batchId:String(r.batch_id)}}))}
export function publishActivity(db:DatabaseSync,runId:string,source:Source,scope:string,proposals:Proposal[],authors:ProposalAuthor[],appointments:LegislativeAppointment[],laws:LawLink[]){transaction(db,()=>{const run=db.prepare('SELECT status FROM ingestion_runs WHERE id=? AND source=?').get(runId,source);if(!run||run.status!=='running')throw new Error('Lote de atuação inválido');const ids=new Set(proposals.map(p=>p.externalId));if(ids.size!==proposals.length||authors.some(a=>!ids.has(a.proposalId))||laws.some(l=>!ids.has(l.proposalId)))throw new Error('Relação legislativa órfã ou proposição duplicada');const now=new Date().toISOString();db.prepare('INSERT INTO activity_batches VALUES (?,?,?,?,?,?,?,?)').run(runId,source,scope,now,proposals.length,authors.length,appointments.length,laws.length);const pi=db.prepare('INSERT INTO proposals VALUES (?,?,?,?,?)');for(const p of proposals)pi.run(runId,source,p.externalId,p.rawId,JSON.stringify(p));const ai=db.prepare('INSERT INTO proposal_authors VALUES (?,?,?,?,?,?)');for(const [i,a] of authors.entries())ai.run(runId,a.proposalId,`${a.externalId??a.name}:${a.order??i}`,a.externalId,a.rawId,JSON.stringify(a));const xi=db.prepare('INSERT INTO legislative_appointments VALUES (?,?,?,?,?,?,?)');for(const a of appointments)xi.run(runId,a.externalId,source,a.personExternalId,a.kind,a.rawId,JSON.stringify(a));const li=db.prepare('INSERT INTO law_links VALUES (?,?,?,?,?)');for(const l of laws)li.run(runId,l.proposalId,l.lawId,l.rawId,JSON.stringify(l));db.prepare('INSERT INTO active_activity_publications VALUES (?,?,?) ON CONFLICT(source,scope) DO UPDATE SET batch_id=excluded.batch_id').run(source,scope,runId);db.prepare("UPDATE ingestion_runs SET status='published',finished_at=?,expected_count=?,roster_complete=1,reconciliation_json=? WHERE id=?").run(now,proposals.length,JSON.stringify({scope,proposals:proposals.length,authors:authors.length,appointments:appointments.length,laws:laws.length}),runId);db.prepare('DELETE FROM job_locks WHERE run_id=?').run(runId)})}
export function publishedActivity(db:DatabaseSync,source:Source,externalId:string){const proposals=db.prepare(`SELECT DISTINCT p.payload FROM proposals p JOIN active_activity_publications a ON a.batch_id=p.batch_id JOIN proposal_authors x ON x.batch_id=p.batch_id AND x.proposal_id=p.external_id WHERE a.source=? AND x.person_external_id=? ORDER BY json_extract(p.payload,'$.presentedAt') DESC LIMIT 100`).all(source,externalId).map(r=>JSON.parse(String(r.payload)) as Proposal);const appointments=db.prepare(`SELECT x.payload FROM legislative_appointments x JOIN active_activity_publications a ON a.batch_id=x.batch_id WHERE a.source=? AND x.person_external_id=? ORDER BY COALESCE(json_extract(x.payload,'$.start'),'') DESC LIMIT 100`).all(source,externalId).map(r=>JSON.parse(String(r.payload)) as LegislativeAppointment);const laws=db.prepare(`SELECT l.payload FROM law_links l JOIN active_activity_publications a ON a.batch_id=l.batch_id JOIN proposal_authors x ON x.batch_id=l.batch_id AND x.proposal_id=l.proposal_id WHERE a.source=? AND x.person_external_id=? ORDER BY l.law_id`).all(source,externalId).map(r=>JSON.parse(String(r.payload)) as LawLink);return{proposals,appointments,laws}}
export function publishPresence(db:DatabaseSync,runId:string,source:Source,year:number,availability:'available'|'partial'|'unavailable',note:string,sessions:LegislativeSession[],records:Attendance[]){transaction(db,()=>{const run=db.prepare('SELECT status FROM ingestion_runs WHERE id=? AND source=?').get(runId,source);const ids=new Set(sessions.map(s=>s.externalId));if(!run||run.status!=='running'||ids.size!==sessions.length||records.some(r=>!ids.has(r.sessionId)))throw new Error('Lote de presença inválido');const now=new Date().toISOString();db.prepare('INSERT INTO presence_batches VALUES (?,?,?,?,?,?,?,?)').run(runId,source,year,now,availability,sessions.length,records.length,note);const si=db.prepare('INSERT INTO legislative_sessions VALUES (?,?,?,?,?,?,?)');for(const s of sessions)si.run(runId,source,s.externalId,s.date,s.eligible?1:0,s.rawId,JSON.stringify(s));const ai=db.prepare('INSERT INTO attendance VALUES (?,?,?,?,?,?,?)');for(const r of records)ai.run(runId,source,r.sessionId,r.externalId,r.state,r.rawId,JSON.stringify(r));db.prepare('INSERT INTO active_presence_publications VALUES (?,?,?) ON CONFLICT(source,year) DO UPDATE SET batch_id=excluded.batch_id').run(source,year,runId);db.prepare("UPDATE ingestion_runs SET status='published',finished_at=?,expected_count=?,roster_complete=1,reconciliation_json=? WHERE id=?").run(now,records.length,JSON.stringify({year,availability,sessions:sessions.length,attendance:records.length}),runId);db.prepare('DELETE FROM job_locks WHERE run_id=?').run(runId)})}
const within=(date:string,periods:{start:string;end:string|null}[])=>periods.some(p=>date>=p.start.slice(0,10)&&(!p.end||date<=p.end.slice(0,10)));
export function publishedParticipation(db:DatabaseSync,source:Source,externalId:string,year=2026){const cutoff=reportingCutoff(year);const profile=getPublished(db,source,externalId);const periods=profile?.exercises??[];const batch=db.prepare('SELECT b.* FROM presence_batches b JOIN active_presence_publications a ON a.batch_id=b.id WHERE a.source=? AND a.year=?').get(source,year);const sessionRows=batch?db.prepare('SELECT payload FROM legislative_sessions WHERE batch_id=? AND eligible=1 AND substr(date,1,10)<=? ORDER BY date').all(String(batch.id),cutoff).map(r=>JSON.parse(String(r.payload)) as LegislativeSession):[];const eligibleSessions=sessionRows.filter(s=>within(s.date,periods));const attended=batch?new Set(db.prepare('SELECT session_id FROM attendance WHERE batch_id=? AND external_id=?').all(String(batch.id),externalId).map(r=>String(r.session_id))):new Set<string>();const attendanceDays=new Map<string,boolean>();for(const session of eligibleSessions)attendanceDays.set(session.date.slice(0,10),Boolean(attendanceDays.get(session.date.slice(0,10)))||attended.has(session.externalId));const attendanceNumerator=[...attendanceDays.values()].filter(Boolean).length;const officialPresence=source==='camara'?db.prepare('SELECT * FROM chamber_official_presence WHERE external_id=? AND year=?').get(externalId,year):null;const deliberations=db.prepare(`SELECT d.external_id,d.date,d.payload FROM deliberations d JOIN active_legislative_publications a ON a.batch_id=d.batch_id WHERE a.source=? AND a.year=? AND substr(d.date,1,10)<=?`).all(source,year,cutoff).map(r=>JSON.parse(String(r.payload)) as Deliberation).filter(d=>d.chamberBody==='PLEN'&&within(d.date,periods));const voteRows=db.prepare(`SELECT v.external_id,v.deliberation_id,v.payload FROM legislative_votes v JOIN active_legislative_publications a ON a.batch_id=v.batch_id WHERE a.source=? AND a.year=?`).all(source,year);const nominalIds=new Set(voteRows.filter(row=>countsAsParticipation(source,(JSON.parse(String(row.payload)) as LegislativeVote).vote)).map(row=>String(row.deliberation_id)));const voted=new Set(voteRows.filter(row=>String(row.external_id)===externalId&&countsAsParticipation(source,(JSON.parse(String(row.payload)) as LegislativeVote).vote)).map(row=>String(row.deliberation_id)));const eligibleDeliberations=deliberations.filter(d=>nominalIds.has(d.externalId));const participationNumerator=eligibleDeliberations.filter(d=>voted.has(d.externalId)).length;return{year,presence:{availability:batch?String(batch.availability):'unavailable',numerator:officialPresence?Number(officialPresence.days_present):batch?.availability==='available'?attendanceNumerator:null,denominator:officialPresence?Number(officialPresence.days_total):batch?.availability==='available'?attendanceDays.size:null,note:officialPresence?'Dias de Plenário conforme o relatório individual oficial da Câmara.':batch?(source==='camara'?'Dias únicos derivados do lote de eventos; justificativas podem ter cobertura parcial.':String(batch.note)):'Lote de presença não publicado'},participation:{availability:eligibleDeliberations.length?'available':'unavailable',numerator:eligibleDeliberations.length?participationNumerator:null,denominator:eligibleDeliberations.length||null,note:'Votações nominais plenárias durante períodos de exercício; não mede presença.'}}}
export function publishComplement(db:DatabaseSync,runId:string,source:Source,scope:string,records:LegislativeComplement[],reconciliation:unknown){transaction(db,()=>{const run=db.prepare('SELECT status FROM ingestion_runs WHERE id=? AND source=?').get(runId,source);if(!run||run.status!=='running'||new Set(records.map(r=>r.externalKey)).size!==records.length)throw new Error('Lote complementar inválido ou duplicado');for(const r of records){if(r.source!==source)throw new Error('Fonte complementar divergente');if(!db.prepare('SELECT id FROM raw_objects WHERE id=? AND run_id=?').get(r.rawId,runId))throw new Error('Complemento sem evidência do lote')}const now=new Date().toISOString();db.prepare('INSERT INTO complement_batches VALUES (?,?,?,?,?,?)').run(runId,source,scope,now,records.length,JSON.stringify(reconciliation));const insert=db.prepare('INSERT INTO legislative_complements VALUES (?,?,?,?,?,?,?,?,?,?,?)');for(const r of records)insert.run(runId,source,r.externalKey,r.kind,r.personExternalId,r.proposalId,r.deliberationId,r.bodyId,r.occurredAt,r.rawId,JSON.stringify(r));db.prepare('INSERT INTO active_complement_publications VALUES (?,?,?) ON CONFLICT(source,scope) DO UPDATE SET batch_id=excluded.batch_id').run(source,scope,runId);db.prepare("UPDATE ingestion_runs SET status='published',finished_at=?,expected_count=?,roster_complete=1,reconciliation_json=? WHERE id=?").run(now,records.length,JSON.stringify(reconciliation),runId);db.prepare('DELETE FROM job_locks WHERE run_id=?').run(runId)})}
export function publishedComplement(db:DatabaseSync,source:Source,externalId:string){const personal=db.prepare(`SELECT c.payload FROM legislative_complements c JOIN active_complement_publications a ON a.batch_id=c.batch_id WHERE a.source=? AND c.person_external_id=? ORDER BY COALESCE(c.occurred_at,'') DESC,c.external_key LIMIT 100`).all(source,externalId).map(r=>JSON.parse(String(r.payload)) as LegislativeComplement);const summaries=db.prepare(`SELECT c.payload FROM legislative_complements c JOIN active_complement_publications a ON a.batch_id=c.batch_id WHERE a.source=? AND c.kind='reconciliation' ORDER BY c.external_key`).all(source).map(r=>JSON.parse(String(r.payload)) as LegislativeComplement);return{personal,summaries}}

export function publishElection(db:DatabaseSync,runId:string,election:{id:string;year:number;round:number;scope:string;officialUrl:string},availability:'available'|'partial'|'unavailable',note:string,candidacies:Candidacy[],assets:ElectoralAsset[],transactions:CampaignTransaction[]){transaction(db,()=>{const run=db.prepare("SELECT status FROM ingestion_runs WHERE id=? AND source='tse'").get(runId);if(!run||run.status!=='running')throw new Error('Lote eleitoral exige execução TSE ativa');const ids=new Set(candidacies.map(c=>c.sequenceId));if(ids.size!==candidacies.length||candidacies.some(c=>c.electionId!==election.id||c.year!==election.year||c.round!==election.round)||[...assets,...transactions].some(x=>!ids.has(x.sequenceId)))throw new Error('Registro eleitoral órfão, candidatura duplicada ou recorte divergente');const rawExists=(rawId:string)=>Boolean(db.prepare('SELECT 1 FROM raw_objects WHERE id=? AND run_id=?').get(rawId,runId));for(const c of candidacies){if(c.matchStatus==='confirmed'&&(!c.personId||c.matchEvidence.length<2))throw new Error('Vínculo eleitoral confirmado sem duas evidências');if(c.matchStatus!=='confirmed'&&c.personId)throw new Error('Vínculo eleitoral não confirmado não pode atribuir pessoa');if(!rawExists(c.rawId)||(c.detailsRawId&&!rawExists(c.detailsRawId)))throw new Error('Candidatura sem origem no lote')}const assetKeys=new Set<string>();for(const a of assets){const key=`${a.sequenceId}:${a.assetId}:${a.version}`;if(assetKeys.has(key)||!Number.isSafeInteger(a.valueCents)||a.valueCents<0||!rawExists(a.rawId))throw new Error('Bem eleitoral duplicado, impreciso ou sem origem');assetKeys.add(key)}const transactionKeys=new Set<string>();for(const t of transactions){const key=`${t.sequenceId}:${t.transactionId}:${t.kind}:${t.version}`;if(transactionKeys.has(key)||!Number.isSafeInteger(t.valueCents)||!rawExists(t.rawId))throw new Error('Transação eleitoral duplicada, imprecisa ou sem origem');transactionKeys.add(key)}const now=new Date().toISOString();db.prepare('INSERT OR IGNORE INTO elections VALUES (?,?,?,?,?)').run(election.id,election.year,election.round,election.scope,election.officialUrl);db.prepare('INSERT INTO electoral_batches VALUES (?,?,?,?,?,?,?,?,?)').run(runId,election.id,now,availability,candidacies.length,assets.length,transactions.filter(x=>x.kind==='revenue').length,transactions.filter(x=>x.kind==='expense').length,note);const ci=db.prepare('INSERT INTO candidacies VALUES (?,?,?,?,?,?,?,?,?)');for(const c of candidacies)ci.run(runId,c.sequenceId,c.personId,c.matchStatus,c.year,c.uf,c.office,c.rawId,JSON.stringify(c));const ai=db.prepare('INSERT INTO electoral_assets VALUES (?,?,?,?,?,?,?)');for(const a of assets)ai.run(runId,a.sequenceId,a.assetId,a.version,a.valueCents,a.rawId,JSON.stringify(a));const ti=db.prepare('INSERT INTO campaign_transactions VALUES (?,?,?,?,?,?,?,?)');for(const t of transactions)ti.run(runId,t.sequenceId,t.transactionId,t.kind,t.version,t.valueCents,t.rawId,JSON.stringify(t));db.prepare('INSERT INTO active_electoral_publications VALUES (?,?) ON CONFLICT(election_id) DO UPDATE SET batch_id=excluded.batch_id').run(election.id,runId);db.prepare("UPDATE ingestion_runs SET status='published',finished_at=?,expected_count=?,roster_complete=1,reconciliation_json=? WHERE id=?").run(now,candidacies.length,JSON.stringify({availability,candidacies:candidacies.length,assets:assets.length,transactions:transactions.length}),runId);db.prepare('DELETE FROM job_locks WHERE run_id=?').run(runId)})}
export function publishedElections(db:DatabaseSync,personId:string){const candidacies=db.prepare(`SELECT c.payload,b.availability,b.note,b.published_at FROM candidacies c JOIN active_electoral_publications a ON a.batch_id=c.batch_id JOIN electoral_batches b ON b.id=c.batch_id WHERE c.person_id=? AND c.match_status='confirmed' ORDER BY c.year DESC`).all(personId).map(r=>({...JSON.parse(String(r.payload)) as Candidacy,availability:String(r.availability),note:String(r.note),publishedAt:String(r.published_at)}));return candidacies.map(c=>{const assets=db.prepare('SELECT payload FROM electoral_assets WHERE batch_id=(SELECT batch_id FROM active_electoral_publications WHERE election_id=?) AND sequence_id=? ORDER BY asset_id').all(c.electionId,c.sequenceId).map(r=>JSON.parse(String(r.payload)) as ElectoralAsset);const tx=db.prepare('SELECT payload FROM campaign_transactions WHERE batch_id=(SELECT batch_id FROM active_electoral_publications WHERE election_id=?) AND sequence_id=? ORDER BY kind,transaction_id,version').all(c.electionId,c.sequenceId).map(r=>JSON.parse(String(r.payload)) as CampaignTransaction);return{candidacy:c,assets,revenues:tx.filter(x=>x.kind==='revenue'),expenses:tx.filter(x=>x.kind==='expense')}})}
export function publishedElectoralCoverage(db:DatabaseSync){return db.prepare(`SELECT e.year,e.round,e.scope,b.availability,b.note,b.published_at FROM electoral_batches b JOIN active_electoral_publications a ON a.batch_id=b.id JOIN elections e ON e.id=b.election_id ORDER BY e.year DESC,e.round`).all().map(r=>({year:Number(r.year),round:Number(r.round),scope:String(r.scope),availability:String(r.availability),note:String(r.note),publishedAt:String(r.published_at)}))}
export function publishedExpenseComparison(db:DatabaseSync,source:Source,year:number,filters:{uf?:string;party?:string}={}){if(!Number.isInteger(year)||year<2008||year>2100)throw new Error('Ano inválido');if(filters.uf&&!ufs.has(filters.uf))throw new Error('UF inválida');const where=['a.source=?','e.year=?'];const values:(string|number)[]=[source,year];if(filters.uf){where.push('p.uf=?');values.push(filters.uf)}if(filters.party){where.push('p.party=?');values.push(filters.party)}const rows=db.prepare(`SELECT p.person_id,p.name,p.uf,p.party,p.external_id,sum(e.net_cents-e.refund_cents) value_cents,count(*) record_count FROM expenses e JOIN active_expense_publications x ON x.batch_id=e.batch_id JOIN active_publications a ON a.source=e.source JOIN profiles p ON p.batch_id=a.batch_id AND p.external_id=e.external_id WHERE ${where.join(' AND ')} GROUP BY p.person_id,p.name,p.uf,p.party,p.external_id ORDER BY value_cents DESC,p.name,p.external_id`).all(...values).map((r,i)=>({rank:i+1,personId:String(r.person_id),externalId:String(r.external_id),name:String(r.name),uf:String(r.uf),party:String(r.party),valueCents:Number(r.value_cents),recordCount:Number(r.record_count)}));const mean=rows.length?Math.round(rows.reduce((n,r)=>n+r.valueCents,0)/rows.length):null;return{metric:'Cota parlamentar líquida identificada',source,year,coverage:'Lote anual ativo; somente pessoas com registros vinculados',meanCents:mean,items:rows}}





export { publishExpandedCosts, publishedExpandedCosts } from './costs.ts';
export { publishedExpenseYears, publishedHousePanorama, publishedParticipationRows, type HousePanorama } from './panorama.ts';
export { countsAsParticipation } from './vote-participation.ts';
export { publishedMonthlyParticipation } from './participation-series.ts';
export { publishedStateComparison, publishedStateRepresentation, publishedStateTopics, type StateRepresentative, type StateSummary } from './states.ts';
export { comparisonDimensions, publishedComparisonOptions, publishedComparisonYears, publishedPersonComparison, type ComparisonDimension, type PersonComparison } from './comparisons.ts';
export { calculateVoteAgreement, normalizedComparableVote, publishedPartyComparison, publishedPersonComparisonDashboard, publishedStatesComparison } from './comparison-dashboard.ts';
export { partyAtDate, groupRecordedPartyVotes, publishedPartyPanorama, publishedVoteOptions, publishedPartyVote, publishedOfficialTopics, publishedPartyDetail, type PartyHouse, type PartyRow } from './parties.ts';
export { publishStaffSnapshot, publishedStaffSnapshot, snapshotAvailability, publishCabinetBudgets, publishedCabinetBudgets } from './cabinet-data.ts';
export { publishedPersonElectoralProfile, publishedCabinetProfile, publishedCabinetPanorama } from './frontend-data.ts';
export { publishedRankings, type RankingDimension, type RankingQuery } from './rankings.ts';
export { publishedParliamentarySubsidy, publishedExpenseCoverage, publishedSourceFreshness } from './public-info.ts';
export { publishedPropositionCoverage, publishedPropositions, publishedProposition, type PropositionQuery } from './propositions.ts';
export { publishedExpenseDetail } from './expense-intelligence.ts';
export { publishedSupplierRadar, publishedSupplierDetail, publishedPatrimonyRanking, validCnpj, type SupplierRadarQuery, type SupplierDetailQuery } from './investigative.ts';
