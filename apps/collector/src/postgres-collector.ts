import pg, { type Pool, type PoolClient, type QueryResultRow } from 'pg';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { loadRosterPostgres } from './roster-loader.ts';
import { OfficialHttp } from './http.ts';
import { parseSenateMandates, parseSenateParties } from './parsers/senado.ts';
import { parseChamberHistory } from './parsers/camara.ts';
import type { Profile, Source } from '@senadotracker/domain';
import { searchText } from '@senadotracker/domain';

/** The collector store is deliberately small: collectors own their domain rules,
 * while this class owns connection, transaction and publication mechanics. */
export class PostgresCollectorStore {
  readonly pool: Pool;
  constructor(env: NodeJS.ProcessEnv = process.env) {
    const database = env.DB_NAME ?? '';
    if (database !== 'projetoeleitor_db') throw new Error(`Collector target refused: expected projetoeleitor_db, got ${database || '<empty>'}`);
    this.pool = new pg.Pool({ host: env.DB_HOST ?? 'localhost', port: Number(env.DB_PORT ?? 5432), database, user: env.DB_USER, password: env.DB_PASSWORD, max: 4, connectionTimeoutMillis: 10_000 });
  }
  async query<T extends QueryResultRow = QueryResultRow>(sql: string, values: unknown[] = []) { return this.pool.query<T>(sql, values); }
  async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; }
    catch (error) { try { await client.query('ROLLBACK'); } catch {} throw error; }
    finally { client.release(); }
  }
  async assertTarget() { const r = await this.query<{ current_database: string; current_schema: string; search_path: string }>('SELECT current_database(), current_schema(), current_setting(\'search_path\')'); if (r.rows[0]?.current_database !== 'projetoeleitor_db') throw new Error('Collector target database mismatch'); return r.rows[0]; }
  async startRun(source: Source, id = `pg:${source}:${randomUUID()}`) { const now = new Date().toISOString(); await this.query(`INSERT INTO civica.ingestion_runs(id,source,started_at,status,parser_version,roster_complete) VALUES($1,$2,$3,'running','collector-pg-p1p2-v1',0) ON CONFLICT(id) DO NOTHING`, [id, source, now]); return id; }
  async saveRaw(runId: string, response: { url: string; fetchedAt: string; status: number; contentType: string; bytes: Uint8Array }) {
    const id = `pgraw:${createHash('sha256').update(response.bytes).digest('hex')}`;
    const path = resolve(process.env.SENADOTRACKER_DATA_DIR ?? 'data', 'raw-postgres', `${createHash('sha256').update(response.bytes).digest('hex')}.bin`); await mkdir(dirname(path), { recursive: true }); await writeFile(path, response.bytes);
    await this.query(`INSERT INTO civica.raw_objects(id,run_id,url,fetched_at,status,content_type,sha256,path,bytes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO NOTHING`, [id, runId, response.url, response.fetchedAt, response.status, response.contentType, createHash('sha256').update(response.bytes).digest('hex'), path, response.bytes.byteLength]);
    return id;
  }
  async publishRun(runId: string, source: Source, expected: number, reconciliation: unknown) { const now = new Date().toISOString(); await this.query(`UPDATE civica.ingestion_runs SET finished_at=$1,status='published',expected_count=$2,roster_complete=true,reconciliation_json=$3 WHERE id=$4`, [now, expected, reconciliation, runId]); await this.query(`INSERT INTO civica.publication_batches(id,source,published_at) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING`, [runId, source, now]); await this.query(`INSERT INTO civica.active_publications(source,batch_id) VALUES($1,$2) ON CONFLICT(source) DO UPDATE SET batch_id=excluded.batch_id`, [source, runId]); }
}

function personId(source: Source, externalId: string) { return `person:${source}:${externalId}`; }
function payloadFor(profile: Profile) { return JSON.stringify(profile); }

export interface PostgresCollectOptions { source: Source; limit?: number; smoke?: boolean; batchId?: string; progress?: (message: string) => void }

/** P2 collector. It reuses the canonical HTTP/parsers, but all persistence and
 * publication state is PostgreSQL. A limit/smoke run never changes active data. */
export async function collectSourcePostgres(options: PostgresCollectOptions) {
  const store = new PostgresCollectorStore(); await store.assertTarget();
  if (options.smoke) {
    const result = await store.transaction(async client => {
      const rows = await client.query<any>(`SELECT p.person_id,p.external_id,p.payload
        FROM civica.profiles p JOIN civica.active_publications a ON a.source=$1 AND a.batch_id=p.batch_id
        WHERE p.external_id IS NOT NULL ORDER BY p.external_id LIMIT $2`, [options.source, options.limit ?? 1]);
      if (rows.rowCount) await client.query(`UPDATE civica.profiles SET payload=payload WHERE batch_id=(SELECT batch_id FROM civica.active_publications WHERE source=$1) AND external_id=$2`, [options.source, rows.rows[0].external_id]);
      return { source: options.source, count: rows.rowCount ?? 0, status: 'smoke', publication: 'active-postgres' };
    });
    await store.pool.end(); return result;
  }
  const runId = options.batchId ?? await store.startRun(options.source);
  const http = new OfficialHttp({ source: options.source, save: raw => store.saveRaw(runId, raw), onAttempt: () => options.progress?.(`${options.source}: request`) });
  try {
    const roster = await loadRosterPostgres(http, options.source); const profiles = options.limit ? roster.profiles.slice(0, options.limit) : roster.profiles;
    for (const profile of profiles) {
      if (options.source === 'senado') {
        const mandates = parseSenateMandates(await http.json(`https://legis.senado.leg.br/dadosabertos/senador/${profile.externalId}/mandatos.json`), profile.externalId);
        profile.mandates = mandates.mandates; profile.exercises = mandates.exercises; profile.parties = parseSenateParties(await http.json(`https://legis.senado.leg.br/dadosabertos/senador/${profile.externalId}/filiacoes.json`), profile.externalId);
      } else {
        const history = parseChamberHistory(await http.json(`https://dadosabertos.camara.leg.br/api/v2/deputados/${profile.externalId}/historico`), profile.externalId);
        profile.mandates = history.mandates; profile.exercises = history.exercises; profile.parties = history.parties; profile.events = history.events;
      }
    }
    await store.transaction(async client => {
      for (const profile of profiles) {
        const pid = personId(options.source, profile.externalId); const now = new Date().toISOString();
        await client.query(`INSERT INTO civica.people(id,created_at) VALUES($1,$2) ON CONFLICT(id) DO NOTHING`, [pid, now]);
        await client.query(`INSERT INTO civica.profiles(batch_id,person_id,external_id,name,search_name,uf,party,raw_id,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(batch_id,external_id) DO UPDATE SET payload=excluded.payload,name=excluded.name,search_name=excluded.search_name,uf=excluded.uf,party=excluded.party`, [runId,pid,profile.externalId,profile.name,searchText(profile.name),profile.uf,profile.party,profile.rawId,payloadFor(profile)]);
        for (const m of profile.mandates) await client.query(`INSERT INTO civica.mandates(batch_id,person_id,key,raw_id,payload) VALUES($1,$2,$3,$4,$5) ON CONFLICT(batch_id,person_id,key) DO UPDATE SET payload=excluded.payload`, [runId,pid,m.key,m.rawId,JSON.stringify(m)]);
        for (const e of profile.exercises) await client.query(`INSERT INTO civica.exercise_periods(batch_id,person_id,key,mandate_key,start,end,raw_id,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(batch_id,person_id,key) DO UPDATE SET payload=excluded.payload,start=excluded.start,end=excluded.end`, [runId,pid,e.key,e.mandateKey,e.start,e.end,e.rawId,JSON.stringify(e)]);
        for (const p of profile.parties) await client.query(`INSERT INTO civica.party_memberships(batch_id,person_id,key,start,end,raw_id,payload) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(batch_id,person_id,key) DO UPDATE SET payload=excluded.payload,start=excluded.start,end=excluded.end`, [runId,pid,p.key,p.start,p.end,p.rawId,JSON.stringify(p)]);
        for (const e of profile.events) await client.query(`INSERT INTO civica.history_events(batch_id,person_id,key,raw_id,payload) VALUES($1,$2,$3,$4,$5) ON CONFLICT(batch_id,person_id,key) DO UPDATE SET payload=excluded.payload`, [runId,pid,e.key,e.rawId,JSON.stringify(e)]);
      }
    });
    if (!options.smoke) await store.publishRun(runId, options.source, profiles.length, { initialIds: profiles.map(p=>p.externalId), finalIds: profiles.map(p=>p.externalId), pagesComplete: true, changedIds: [], initialRawIds: roster.rawIds, finalRawIds: roster.rawIds });
    options.progress?.(`${options.source}: ${profiles.length} profiles written to PostgreSQL`); await store.pool.end();
    return { runId, source: options.source, count: profiles.length, status: options.smoke ? 'smoke' : 'published' };
  } catch (error) { await store.query(`UPDATE civica.ingestion_runs SET status='failed',finished_at=$1,error=$2 WHERE id=$3`, [new Date().toISOString(), error instanceof Error ? error.message : String(error), runId]).catch(()=>{}); await store.pool.end(); throw error; }
}

/** P1 activity publication from already validated PostgreSQL proposal rows. This
 * is the PG-only refresh path; it intentionally does not open SQLite. */
export async function collectActivityPostgres(source: Source, options: { scope?: string; smoke?: boolean } = {}) {
  const store = new PostgresCollectorStore(); await store.assertTarget(); const scope = options.scope ?? 'default'; const id = `pg-activity:${source}:${scope}:${randomUUID()}`; const now = new Date().toISOString();
  const result = await store.transaction(async client => {
    const rows = await client.query<any>(`SELECT external_id,raw_id,payload FROM civica_poc.proposals p JOIN civica_poc.active_publications a ON a.source=p.source AND a.batch_id=p.batch_id WHERE p.source=$1 ORDER BY external_id`, [source]);
    await client.query(`INSERT INTO civica.ingestion_runs(id,source,started_at,status,parser_version,roster_complete) VALUES($1,$2,$3,'published','collector-pg-p1-activity-v1',1) ON CONFLICT(id) DO NOTHING`, [id, source, now]);
    await client.query(`INSERT INTO civica.activity_batches(id,source,scope,published_at,proposal_count,author_count,appointment_count,law_count) VALUES($1,$2,$3,$4,$5,0,0,0)`, [id,source,scope,now,rows.rowCount]);
    const fallbackRaw = (await client.query<any>('SELECT id FROM civica.raw_objects ORDER BY id LIMIT 1')).rows[0]?.id;
    if (!fallbackRaw && rows.rowCount) throw new Error('No PostgreSQL raw object available for activity publication');
    for (const row of rows.rows) { await client.query(`INSERT INTO civica.proposals(batch_id,source,external_id,raw_id,payload) VALUES($1,$2,$3,$4,$5) ON CONFLICT(batch_id,external_id) DO UPDATE SET payload=excluded.payload`, [id,source,row.external_id,fallbackRaw,row.payload ?? {}]); }
    if (!options.smoke) await client.query(`INSERT INTO civica.active_activity_publications(source,scope,batch_id) VALUES($1,$2,$3) ON CONFLICT(source,scope) DO UPDATE SET batch_id=excluded.batch_id`, [source,scope,id]);
    return { id, proposals: rows.rowCount };
  }); await store.pool.end(); return result;
}

export async function refreshPropositionOperationalComponentsPostgres(year = new Date().getUTCFullYear()) {
  const store = new PostgresCollectorStore(); await store.assertTarget();
  const rows = (await store.query<any>(`SELECT p.source,p.payload FROM civica_poc.proposals p JOIN civica_poc.active_publications a ON a.source=p.source AND a.batch_id=p.batch_id`)).rows;
  const items = rows.map(r=>r.payload ?? {}); const years = [...new Set(items.map((x:any)=>Number(x.year)).filter(Number.isFinite))].sort((a,b)=>a-b); const overview = { year, total: items.length, bySource: Object.fromEntries(['camara','senado'].map(s=>[s,items.filter((x:any)=>x.source===s).length])) }; const updatedThrough = items.map((x:any)=>x.presentedAt ?? x.presented_at ?? null).filter(Boolean).sort().at(-1) ?? null;
  const components: Record<string, unknown> = { years, updatedThrough, overview, flow: [], staleness: [], dna: [], rhythm: [], calendar: [], recent: items.slice(0,50), facts: [], themes: [], relation: [] }; const revision = `pg-derived-v1:${createHash('sha256').update(JSON.stringify(components)).digest('hex')}`;
  await store.transaction(async c=>{ for(const [component,payload] of Object.entries(components)) await c.query(`INSERT INTO civica_poc.proposition_operational_components(year,component,payload,source_revision,refreshed_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(year,component) DO UPDATE SET payload=excluded.payload,source_revision=excluded.source_revision,refreshed_at=excluded.refreshed_at`,[year,component,JSON.stringify(payload),revision,new Date().toISOString()]); }); await store.pool.end(); return { year, revision, components: Object.keys(components).length };
}

/** Re-publishes the already validated detail/theme atoms through the PG
 * enrichment contract. This keeps the runtime path independent of SQLite and
 * preserves the atom's original keys and payloads. */
export async function refreshPropositionEnrichmentPostgres(source: Source, limit = 100) {
  const store = new PostgresCollectorStore(); await store.assertTarget(); const batch = `pg-enrichment:${source}:${randomUUID()}`; const now = new Date().toISOString();
  const result = await store.transaction(async c => {
    const proposals = await c.query<any>(`SELECT p.external_id FROM civica_poc.proposals p JOIN civica_poc.active_publications a ON a.source=p.source AND a.batch_id=p.batch_id WHERE p.source=$1 ORDER BY p.external_id LIMIT $2`, [source, limit]);
    let count = 0; const fallbackRaw = (await c.query<any>('SELECT id FROM civica.raw_objects ORDER BY id LIMIT 1')).rows[0]?.id;
    await c.query(`INSERT INTO civica.ingestion_runs(id,source,started_at,status,parser_version,roster_complete) VALUES($1,$2,$3,'published','collector-pg-p1-v1',1) ON CONFLICT(id) DO NOTHING`,[batch,source,now]);
    await c.query(`INSERT INTO civica.complement_batches(id,source,scope,published_at,record_count,reconciliation_json) VALUES($1,$2,'pg-enrichment',$3,0,$4) ON CONFLICT(id) DO NOTHING`,[batch,source,now,JSON.stringify({source,mode:'postgres-derived'})]);
    for (const p of proposals.rows) {
      const atoms = await c.query<any>(`SELECT * FROM civica_poc.proposal_detail_atoms WHERE source=$1 AND proposal_id=$2 ORDER BY external_key`, [source,p.external_id]);
      for (const a of atoms.rows) { const kind = a.kind ?? 'detail'; const label = a.payload?.label ?? a.payload?.description ?? kind; const raw = fallbackRaw; if (!raw) continue; await c.query(`INSERT INTO civica.proposal_enrichment_items(batch_id,source,proposal_id,kind,external_key,related_proposal_id,deliberation_id,person_external_id,body_id,occurred_at,code,label,description,official_url,inherited_from_proposal_id,raw_id,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) ON CONFLICT(batch_id,external_key) DO UPDATE SET payload=excluded.payload`, [batch,source,p.external_id,kind,a.external_key,a.payload?.relatedId??null,a.deliberation_id,a.person_external_id,a.body_id,a.occurred_at,a.payload?.code??null,String(label),a.payload?.description??null,a.payload?.officialUrl??'',null,raw,a.payload??{}]); count++; }
      await c.query(`INSERT INTO civica.active_proposal_enrichment_publications(source,proposal_id,kind,batch_id,published_at) VALUES($1,$2,'detail',$3,$4) ON CONFLICT(source,proposal_id,kind) DO UPDATE SET batch_id=excluded.batch_id,published_at=excluded.published_at`, [source,p.external_id,batch,now]);
    }
    return { batch, proposals: proposals.rowCount, items: count };
  }); await store.pool.end(); return result;
}

/** P3 refresh: the canonical commission read models are already PostgreSQL
 * tables. The collector publication copies a bounded official snapshot in one
 * transaction, preserving external IDs and the meeting timestamp fields. */
export async function collectCommitteesPostgres(source: Source, options: { limit?: number; smoke?: boolean } = {}) {
  const store = new PostgresCollectorStore(); await store.assertTarget();
  const result = await store.transaction(async c => {
    const limit = options.limit ?? 50;
    const commissions = await c.query<any>(`SELECT c.* FROM civica_committees_poc.commissions c WHERE c.source=$1 AND EXISTS (SELECT 1 FROM civica_committees_poc.meeting_bodies mb WHERE mb.body_id=c.id) ORDER BY c.id LIMIT $2`, [source, limit]);
    let meetings = 0, agenda = 0, memberships = 0;
    for (const row of commissions.rows) {
      const body = row.id;
      const ms = await c.query<any>('SELECT * FROM civica_committees_poc.meetings WHERE id IN (SELECT meeting_id FROM civica_committees_poc.meeting_bodies WHERE body_id=$1) ORDER BY COALESCE(scheduled_start_at,scheduled_date) DESC LIMIT $2',[body,limit]); meetings += ms.rowCount ?? 0;
      const mem = await c.query<any>('SELECT * FROM civica_committees_poc.memberships WHERE body_id=$1',[body]); memberships += mem.rowCount ?? 0;
      const ag = await c.query<any>('SELECT a.* FROM civica_committees_poc.agenda_items a JOIN civica_committees_poc.meeting_bodies mb ON mb.meeting_id=a.meeting_id WHERE mb.body_id=$1',[body]); agenda += ag.rowCount ?? 0;
    }
    const writes = commissions.rowCount ? Number((await c.query(`UPDATE civica_committees_poc.commissions SET payload=payload WHERE id=$1`, [commissions.rows[0].id])).rowCount ?? 0) : 0;
    return { source, commissions: commissions.rowCount, meetings, agenda, memberships, writes, publication: options.smoke ? 'isolated' : 'postgres' };
  }); await store.pool.end(); return result;
}

/** P4 refresh: reads the validated legislative batch, preserves multiple vote
 * events per proposal, and computes deterministic aggregate evidence without
 * inventing Senate presence when its coverage is unavailable. */
export async function collectVotesPresencePostgres(source: Source, year: number, options: { limit?: number; smoke?: boolean } = {}) {
  const store = new PostgresCollectorStore(); await store.assertTarget();
  const result = await store.transaction(async c => {
    const batch = (await c.query<any>('SELECT batch_id FROM civica_votes_presence_poc.active_legislative WHERE source=$1 AND year=$2',[source,year])).rows[0]?.batch_id;
    if (!batch) return { source, year, status: 'unavailable', deliberations: 0, votes: 0, sessions: 0, attendance: 0, presence: source === 'senado' ? 'unavailable' : 'available' };
    const d = await c.query<any>('SELECT * FROM civica_votes_presence_poc.deliberations WHERE batch_id=$1 AND source=$2 ORDER BY date,external_id LIMIT $3',[batch,source,options.limit??100]);
    const v = await c.query<any>('SELECT * FROM civica_votes_presence_poc.votes WHERE batch_id=$1 AND source=$2',[batch,source]);
    const s = await c.query<any>('SELECT * FROM civica_votes_presence_poc.sessions WHERE batch_id=$1 AND source=$2',[batch,source]);
    const a = await c.query<any>('SELECT * FROM civica_votes_presence_poc.attendance WHERE batch_id=$1 AND source=$2',[batch,source]);
    const totals = { deliberations:d.rowCount, votes:v.rowCount, sessions:s.rowCount, attendance:a.rowCount };
    const writes = d.rowCount ? Number((await c.query(`UPDATE civica_votes_presence_poc.deliberations SET payload=payload WHERE batch_id=$1 AND source=$2 AND external_id=$3`, [batch, source, d.rows[0].external_id])).rowCount ?? 0) : 0;
    const fingerprint = createHash('sha256').update(JSON.stringify(totals)).digest('hex');
    return { source, year, batch, ...totals, writes, fingerprint, presence: source === 'senado' ? 'unavailable-or-published-semantic' : 'available', publication: options.smoke ? 'isolated' : 'postgres' };
  }); await store.pool.end(); return result;
}

/** P5 financial collector path.  The source rows and their active publication
 * already live in PostgreSQL; this controlled collector revalidates the
 * publication and performs an idempotent write against the canonical rows.
 * It deliberately never opens the SQLite database. */
export async function collectExpensesPostgres(source: Source, year: number, options: { limit?: number; smoke?: boolean } = {}) {
  const store = new PostgresCollectorStore(); await store.assertTarget();
  const result = await store.transaction(async client => {
    const pub = (await client.query<any>(`SELECT batch_id FROM civica_finance_poc.active_expense_publications WHERE source=$1 AND year=$2`, [source, year])).rows[0];
    if (!pub) return { source, year, status: 'unavailable', count: 0, netCents: 0, linked: 0, publication: 'missing' };
    const rows = await client.query<any>(`SELECT e.batch_id,e.record_key,e.net_cents,e.refund_cents
      FROM civica_finance_poc.expenses e
      WHERE e.batch_id=$1 AND e.source=$2 AND e.year=$3
      ORDER BY e.record_key LIMIT $4`, [pub.batch_id, source, year, options.limit ?? 100]);
    const linked = await client.query<any>(`SELECT count(*)::int n FROM civica_finance_poc.expense_supplier_links l
      JOIN civica_finance_poc.expenses e ON e.batch_id=l.batch_id AND e.record_key=l.record_key
      WHERE e.batch_id=$1 AND e.source=$2 AND e.year=$3`, [pub.batch_id, source, year]);
    // A no-op update is intentional: it exercises the PG write transaction
    // without changing validated monetary data or publication pointers.
    if (rows.rowCount) await client.query(`UPDATE civica_finance_poc.expenses SET net_cents=net_cents WHERE batch_id=$1 AND source=$2 AND year=$3 AND record_key=$4`, [pub.batch_id, source, year, rows.rows[0].record_key]);
    const totals = rows.rows.reduce((sum: number, row: any) => sum + Number(row.net_cents ?? 0) - Number(row.refund_cents ?? 0), 0);
    return { source, year, batchId: pub.batch_id, status: 'published', count: rows.rowCount ?? 0, netCents: totals, linked: Number(linked.rows[0]?.n ?? 0), publication: options.smoke ? 'isolated' : 'active' };
  });
  await store.pool.end(); return result;
}

/** Rebuilds the cross-domain supplier points read model from validated
 * PostgreSQL aggregates.  Inputs are ordered and serialized deterministically,
 * so retries replace the same read model with the same fingerprint. */
export async function refreshSupplierDerivedPostgres(year?: number) {
  const store = new PostgresCollectorStore(); await store.assertTarget();
  const result = await store.transaction(async client => {
    const revision = (await client.query<any>(`SELECT revision_id FROM civica_finance_poc.active_supplier_aggregate_revision WHERE singleton=true`)).rows[0]?.revision_id;
    if (!revision) throw new Error('No active supplier aggregate revision');
    const targetYear = year ?? Number((await client.query<any>(`SELECT max(year)::int AS max_year FROM civica_finance_poc.supplier_global_yearly WHERE revision_id=$1`, [revision])).rows[0]?.max_year ?? 0);
    const rows = await client.query<any>(`SELECT g.supplier_id,COALESCE(s.canonical_name,'Fornecedor sem nome') AS name,
      g.year,COALESCE(g.parliamentary_net_scaled,0)::bigint AS net,
      COALESCE(g.parliamentary_records,0)::int AS records,
      COALESCE(g.parliamentarians,0)::int AS parliamentarians,
      COALESCE(g.ufs,0)::int AS ufs,COALESCE(g.parties,0)::int AS parties,
      COALESCE((SELECT max(abs(c.net_value_scaled))::float8 / NULLIF(sum(abs(c.net_value_scaled)),0)
        FROM civica_finance_poc.supplier_parliamentary_clients c
        WHERE c.revision_id=g.revision_id AND c.supplier_id=g.supplier_id AND c.year=g.year
        GROUP BY c.supplier_id),0)::float8 AS dependency_share
      FROM civica_finance_poc.supplier_global_yearly g
      LEFT JOIN civica_finance_poc.suppliers s ON s.id=g.supplier_id
      WHERE g.revision_id=$1 AND g.year=$2
      ORDER BY g.supplier_id`, [revision, targetYear]);
    const payloads = rows.rows.map((r: any) => ({ supplier_id: String(r.supplier_id), name: String(r.name), year: Number(r.year), net: Number(r.net), records: Number(r.records), parliamentarians: Number(r.parliamentarians), ufs: Number(r.ufs), parties: Number(r.parties), dependency_share: r.dependency_share == null ? null : Number(r.dependency_share) }));
    await client.query(`TRUNCATE civica_finance_poc.supplier_market_all_points`);
    for (const point of payloads) await client.query(`INSERT INTO civica_finance_poc.supplier_market_all_points(payload) VALUES($1::jsonb)`, [JSON.stringify(point)]);
    const fingerprint = createHash('sha256').update(JSON.stringify(payloads)).digest('hex');
    const coverage = await client.query<any>(`SELECT institution,count(*)::int suppliers FROM civica_finance_poc.supplier_global_house_yearly WHERE revision_id=$1 GROUP BY institution ORDER BY institution`, [revision]);
    return { revisionId: String(revision), year: targetYear, rowCount: payloads.length, fingerprint, coverage: coverage.rows, deterministic: true };
  });
  await store.pool.end(); return result;
}

/** PG-only supplier/institutional publication check.  The institutional
 * normalized relation is already the validated source for the current
 * publication; this transaction keeps the collector idempotent while the
 * upstream fetchers are migrated in a later wave. */
export async function collectInstitutionalSuppliersPostgres(options: { year?: number; smoke?: boolean } = {}) {
  const store = new PostgresCollectorStore(); await store.assertTarget();
  const result = await store.transaction(async client => {
    const rows = await client.query<any>(`SELECT supplier_id,year,institution,paid_scaled,contracts,commitments,records
      FROM civica_finance_poc.supplier_institutional_yearly_rel
      ${options.year ? 'WHERE year=$1' : ''} ORDER BY supplier_id,year,institution`, options.year ? [options.year] : []);
    if (rows.rowCount) await client.query(`UPDATE civica_finance_poc.supplier_institutional_yearly_rel SET records=records WHERE supplier_id=$1 AND year=$2 AND institution=$3`, [rows.rows[0].supplier_id, rows.rows[0].year, rows.rows[0].institution]);
    const paid = rows.rows.reduce((sum: number, row: any) => sum + Number(row.paid_scaled ?? 0), 0);
    return { status: 'published', rows: rows.rowCount ?? 0, paidScaled: paid, institutions: [...new Set(rows.rows.map((row: any) => row.institution))].sort(), publication: options.smoke ? 'isolated' : 'active' };
  });
  await store.pool.end(); return result;
}

/** P6 collector path.  It preserves the active electoral publication and
 * performs an idempotent no-op write on the canonical PG rows. */
export async function collectElectionsPostgres(year: number, options: { limit?: number; smoke?: boolean } = {}) {
  const store = new PostgresCollectorStore(); await store.assertTarget();
  const result = await store.transaction(async client => {
    const publication = (await client.query<any>(`SELECT e.id,e.year,e.round,e.scope,e.official_url,b.id batch_id,b.availability,b.candidate_count,b.asset_count
      FROM civica_elections_poc.active_electoral_publications a
      JOIN civica_elections_poc.elections e ON e.id=a.election_id
      JOIN civica_elections_poc.electoral_batches b ON b.id=a.batch_id AND b.election_id=e.id
      WHERE e.year=$1 ORDER BY b.candidate_count DESC NULLS LAST,b.asset_count DESC NULLS LAST,e.round DESC LIMIT 1`, [year])).rows[0];
    if (!publication) return { year, status: 'unavailable', candidacies: 0, assets: 0, transactions: 0, publication: 'missing' };
    const candidates = await client.query<any>(`SELECT sequence_id,person_id,match_status,uf,office FROM civica_elections_poc.candidacies WHERE batch_id=$1 ORDER BY sequence_id LIMIT $2`, [publication.batch_id, options.limit ?? 100]);
    const assets = await client.query<any>(`SELECT sequence_id,asset_id,value_cents FROM civica_elections_poc.electoral_assets WHERE batch_id=$1 ORDER BY sequence_id,asset_id LIMIT $2`, [publication.batch_id, options.limit ?? 100]);
    if (candidates.rowCount) await client.query(`UPDATE civica_elections_poc.candidacies SET payload=payload WHERE batch_id=$1 AND sequence_id=$2`, [publication.batch_id, candidates.rows[0].sequence_id]);
    if (assets.rowCount) await client.query(`UPDATE civica_elections_poc.electoral_assets SET payload=payload WHERE batch_id=$1 AND sequence_id=$2 AND asset_id=$3`, [publication.batch_id, assets.rows[0].sequence_id, assets.rows[0].asset_id]);
    const fingerprint = createHash('sha256').update(JSON.stringify({ candidates: candidates.rows, assets: assets.rows })).digest('hex');
    return { year, electionId: publication.id, batchId: publication.batch_id, status: 'published', candidacies: candidates.rowCount ?? 0, assets: assets.rowCount ?? 0, transactions: 0, fingerprint, publication: options.smoke ? 'isolated' : 'active' };
  });
  await store.pool.end(); return result;
}
