import { createHash } from 'node:crypto';
import pg, { type Pool, type PoolClient } from 'pg';
import { parseScCabinetCsv, provenanceForRaw, parseDelimitedRows } from './index.ts';
import { CollectorRuntime, type CollectorContext, type CollectorManifest } from '../../../core/index.ts';

export const SC_CURRENT_URL = 'https://transparencia.alesc.sc.gov.br/gabinetes-parlamentares/csv/2026';
export const SC_CURRENT_PROVIDER = 'alesc_gabinetes_csv';
export const SC_CURRENT_PROVIDER_VERSION = 'alesc_gabinetes_csv:v1';
export const SC_FINANCE_DOMAIN = 'finance';
export const STATE_SCHEMA = 'civica_state';
export const STATE_DATABASE = process.env.STATE_PERSISTENCE_DATABASE ?? process.env.CIVICA_STATE_DATABASE ?? process.env.DB_NAME ?? 'projetoeleitor_db';
export const SC_CURRENT_MANIFEST: CollectorManifest = {
  house: 'SC', domain: SC_FINANCE_DOMAIN, provider: SC_CURRENT_PROVIDER, providerVersion: SC_CURRENT_PROVIDER_VERSION,
  collectionModel: 'SNAPSHOT', source: { url: SC_CURRENT_URL, format: 'text/csv' },
  schemaPolicy: { version: 'sc-current-v1', unknownDrift: 'FAIL_CLOSED' }, revisionScope: 'SC:finance',
};

const EXPECTED_HEADERS = ['Verba', 'Descrição', 'Conta', 'Favorecido', 'Trecho', 'Data de Referência', 'Valor'];
const fold = (value: string): string => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const sha = (value: string): string => createHash('sha256').update(value).digest('hex');
const canonical = (value: unknown): string => JSON.stringify(value, Object.keys(value as object).sort());

export interface ScSourceSnapshot {
  readonly url: string; readonly provider: string; readonly providerVersion: string;
  readonly httpStatus: number; readonly bytes: number; readonly rawSha256: string;
  readonly headers: readonly string[]; readonly schemaStatus: 'PASS' | 'FAIL';
  readonly sourceRows: number; readonly body: string;
}

export interface ScCurrentRunOptions { readonly body?: string; readonly observedAt?: string; readonly mode?: 'fetch' | 'replay'; }

export interface ScCurrentLinkageSelection {
  readonly personExternalId: string | null;
  readonly linkageMethod: string;
  readonly linkageStatus: string;
  readonly rawId?: string;
  readonly provenance?: unknown;
}

export function validateScCurrentHeaders(headers: readonly string[], httpOk = true): 'PASS' | 'FAIL' {
  const normalized = new Map(headers.map(header => [fold(header), header]));
  return httpOk && EXPECTED_HEADERS.every(header => normalized.has(fold(header))) && headers.length === EXPECTED_HEADERS.length ? 'PASS' : 'FAIL';
}

export function selectScCurrentLinkage(previous: ScCurrentLinkageSelection | null, resolvedPersonId: string | null, personLabel: string): ScCurrentLinkageSelection {
  if (previous) return previous;
  const nonPerson = fold(personLabel).includes('colegiado') || fold(personLabel).includes('bancada');
  return { personExternalId: resolvedPersonId, linkageMethod: resolvedPersonId ? 'EXACT_UNIQUE_HOUSE_NAME' : nonPerson ? 'NON_PERSON_SOURCE_LABEL' : 'UNRESOLVED_NEW_SOURCE_IDENTITY', linkageStatus: resolvedPersonId ? 'EXACT_UNIQUE_HOUSE_NAME' : nonPerson ? 'NON_PERSON' : 'UNRESOLVED_NEW_SOURCE_IDENTITY' };
}

export function scCurrentDeltaIsNoOp(delta: { readonly added: number; readonly removed: number; readonly semanticallyChanged: number }): boolean {
  return delta.added === 0 && delta.removed === 0 && delta.semanticallyChanged === 0;
}

export interface ScCurrentLinkageRepairResult {
  readonly database: string;
  readonly oldRevision: string;
  readonly currentRevision: string;
  readonly correctedRevision: string;
  readonly old2026Rows: number;
  readonly old2026LinkedRows: number;
  readonly old2026UnresolvedRows: number;
  readonly current2026Rows: number;
  readonly unchanged2026Rows: number;
  readonly unchangedLinkageEqual: number;
  readonly unchangedLinkageDifferent: number;
  readonly personIdLostBeforeRepair: number;
  readonly personIdGainedBeforeRepair: number;
  readonly personIdReassignedBeforeRepair: number;
  readonly linkageStatusChangedBeforeRepair: number;
  readonly linkageMethodChangedBeforeRepair: number;
  readonly provenanceChangedBeforeRepair: number;
  readonly newRows: ReadonlyArray<Record<string, unknown>>;
  readonly financialContentParity: 'PASS' | 'FAIL';
  readonly historicalParity: 'PASS' | 'FAIL';
  readonly identityRevision: string;
  readonly identityRevisionChanged: number;
  readonly activeRevisionBefore: string;
  readonly activeRevisionAfter: string;
  readonly duplicateInsertions: number;
}

export const PRE_B2C_SC_FINANCE_REVISION = 'state:SC:finance:162489506ff451bb5b44543318c867f6d3a0b02c9410159a4b4de6fa8725decc';
export const B2C_SC_FINANCE_REVISION = 'state:SC:finance:57f6bf5d4484477f1890a82fd6ad68cc523b3335af5ffe89a444fa60f2f0c86c';
export const SC_IDENTITY_REVISION = 'state:SC:identity:p18_2bir:4fcce31f9b8769d007cdbc0de1c59f0e6011b66555c0a2163aa7695d3a06a3b5';

export async function fetchScCurrentSource(): Promise<ScSourceSnapshot> {
  const response = await fetch(SC_CURRENT_URL);
  const body = await response.text();
  const headers = body.split(/\r?\n/)[0]?.replace(/^\uFEFF/, '').split(';').map(x => x.replace(/^"|"$/g, '').trim()) ?? [];
  const schemaStatus = validateScCurrentHeaders(headers, response.ok);
  const sourceRows = parseDelimitedRows(body).length;
  if (!response.ok) throw new Error(`SC source HTTP ${response.status}`);
  if (schemaStatus !== 'PASS') throw new Error(`SC source schema drift: ${JSON.stringify(headers)}`);
  if (!sourceRows) throw new Error('SC source returned zero rows');
  return { url: SC_CURRENT_URL, provider: SC_CURRENT_PROVIDER, providerVersion: SC_CURRENT_PROVIDER_VERSION, httpStatus: response.status, bytes: Buffer.byteLength(body), rawSha256: sha(body), headers, schemaStatus, sourceRows, body };
}

function externalIdFromSourceKey(sourceKey: string): string { return sha(sourceKey); }
function sourceKeyFromRow(row: any): string { return String(row.provenance?.sourceKey ?? row.key.externalId); }
function sourceKeyFromDb(row: any): string | null { const p = row.provenance; return p && typeof p === 'object' ? String(p.sourceKey ?? '') || null : null; }
function semanticDbRow(row: any): Record<string, unknown> { return { external_id: row.external_id, person_external_id: row.person_external_id, occurred_at: row.occurred_at, competence: row.competence, amount_cents: row.amount_cents == null ? null : Number(row.amount_cents), category: row.category, supplier_name: row.supplier_name, supplier_document: row.supplier_document, description: row.description, source_granularity: row.source_granularity, source_url: row.source_url, linkage_status: row.linkage_status }; }
function identityDbRow(row: any): Record<string, unknown> { return { person_external_id: row.person_external_id, linkage_method: row.linkage_method, linkage_status: row.linkage_status, raw_id: row.raw_id, provenance: row.provenance }; }
function jsonEqual(a: unknown, b: unknown): boolean { return canonical(a) === canonical(b); }
function financialDbRow(row: any): Record<string, unknown> { const copy: Record<string, unknown> = {}; for (const column of EXPENSE_COLUMNS) if (!['revision_id', 'person_external_id', 'linkage_method', 'linkage_status', 'raw_id', 'provenance'].includes(column)) copy[column] = row[column] ?? null; return copy; }
function isNonPersonDbRow(row: any): boolean { return String(row.linkage_status ?? '').startsWith('NON_PERSON') || fold(String(row.provenance?.providerPersonLabel ?? '')).includes('colegiado') || fold(String(row.provenance?.providerPersonLabel ?? '')).includes('bancada'); }

const EXPENSE_COLUMNS = ['revision_id','house','provider','external_id','person_external_id','occurred_at','competence','period_start','period_end','temporal_precision','amount_cents','gross_amount_cents','claimed_amount_cents','reimbursed_amount_cents','glosa_amount_cents','category','supplier_external_id','supplier_name','supplier_document','supplier_document_type','fiscal_document_number','fiscal_document_type','description','mechanism_type','mechanism_name','source_granularity','attachment_url','source_url','linkage_method','linkage_status','raw_id','provenance'] as const;

async function tx<T>(pool: Pool, fn: (client: PoolClient) => Promise<T>): Promise<T> { const client = await pool.connect(); try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); } }

async function activeRevision(pool: Pool): Promise<string> { const row = (await pool.query<{ revision_id: string }>(`SELECT revision_id FROM ${STATE_SCHEMA}.active_publications WHERE house='SC' AND domain='finance'`)).rows[0]; if (!row) throw new Error('SC finance active publication missing'); return row.revision_id; }
async function activeIdentity(pool: Pool): Promise<string> { const row = (await pool.query<{ revision_id: string }>(`SELECT revision_id FROM ${STATE_SCHEMA}.active_publications WHERE house='SC' AND domain='identity'`)).rows[0]; if (!row) throw new Error('SC identity active publication missing'); return row.revision_id; }
async function revisionRows(pool: Pool, revision: string): Promise<any[]> { return (await pool.query(`SELECT ${EXPENSE_COLUMNS.filter(x => x !== 'revision_id').join(',')}, provenance FROM ${STATE_SCHEMA}.expenses WHERE revision_id=$1 AND house='SC' AND provider=$2 ORDER BY external_id`, [revision, SC_CURRENT_PROVIDER])).rows; }
async function activePersons(pool: Pool, revision: string): Promise<Map<string, string[]>> { const rows = (await pool.query(`SELECT external_id,name FROM ${STATE_SCHEMA}.persons WHERE revision_id=$1 AND house='SC' AND availability='current-roster'`, [revision])).rows as { external_id: string; name: string }[]; const map = new Map<string, string[]>(); for (const row of rows) map.set(fold(row.name), [...(map.get(fold(row.name)) ?? []), row.external_id]); return map; }
async function activeRevisions(pool: Pool): Promise<Record<string, string | null>> { const rows = (await pool.query(`SELECT house,domain,revision_id FROM ${STATE_SCHEMA}.active_publications ORDER BY house,domain`)).rows; return Object.fromEntries(rows.map(row => [`${row.house}:${row.domain}`, row.revision_id])); }
async function fingerprint(pool: Pool, where: string, args: unknown[] = []): Promise<string> { const rows = (await pool.query(`SELECT house,provider,external_id,person_external_id,occurred_at,competence,amount_cents,category,supplier_name,supplier_document,description,source_granularity,source_url,linkage_status FROM ${STATE_SCHEMA}.expenses WHERE ${where} ORDER BY house,provider,external_id`, args)).rows; return sha(rows.map(row => canonical(semanticDbRow(row))).join('\n')); }

async function collectScCurrentFinanceImplementation(pool: Pool, options: ScCurrentRunOptions = {}): Promise<any> {
  const beforeRevisions = await activeRevisions(pool);
  const beforeFinance = await activeRevision(pool); const identityRevision = await activeIdentity(pool);
  const beforeRows = await revisionRows(pool, beforeFinance); const before2026 = beforeRows.filter(row => String(row.competence ?? '').startsWith('2026-'));
  const beforeHistorical = beforeRows.filter(row => !String(row.competence ?? '').startsWith('2026-'));
  const source = options.body === undefined ? await fetchScCurrentSource() : (() => { const body = options.body!; const headers = body.split(/\r?\n/)[0]?.replace(/^\uFEFF/, '').split(';').map(x => x.replace(/^"|"$/g, '').trim()) ?? []; return { url: SC_CURRENT_URL, provider: SC_CURRENT_PROVIDER, providerVersion: SC_CURRENT_PROVIDER_VERSION, httpStatus: 200, bytes: Buffer.byteLength(body), rawSha256: sha(body), headers, schemaStatus: 'PASS' as const, sourceRows: parseDelimitedRows(body).length, body }; })();
  if (source.schemaStatus !== 'PASS') throw new Error('SC source schema drift');
  const raw = provenanceForRaw(`raw:sha256:${source.rawSha256}`, SC_CURRENT_URL, source.body, options.observedAt ?? new Date().toISOString());
  const parsed = parseScCabinetCsv(source.body, SC_CURRENT_URL, raw);
  if (parsed.length !== source.sourceRows) throw new Error(`SC parsed/source row mismatch ${parsed.length}/${source.sourceRows}`);
  const sourceKeyCounts = new Map<string, number>(); for (const row of parsed) { const key = sourceKeyFromRow(row); sourceKeyCounts.set(key, (sourceKeyCounts.get(key) ?? 0) + 1); }
  const duplicateGroups = [...sourceKeyCounts.values()].filter(count => count > 1); const duplicateRows = duplicateGroups.reduce((sum, count) => sum + count, 0); const maxMultiplicity = Math.max(0, ...sourceKeyCounts.values());
  const parsedById = new Map(parsed.map(row => [externalIdFromSourceKey(sourceKeyFromRow(row)), row]));
  const activeById = new Map(before2026.map(row => [String(row.external_id), row]));
  const unchanged = [...parsedById.keys()].filter(id => activeById.has(id) && canonical({ key: id, sourceKey: sourceKeyFromRow(parsedById.get(id)!) }) === canonical({ key: id, sourceKey: sourceKeyFromDb(activeById.get(id)) })).length;
  const added = [...parsedById.keys()].filter(id => !activeById.has(id)); const removed = [...activeById.keys()].filter(id => !parsedById.has(id));
  const semanticallyChanged = [...parsedById.keys()].filter(id => activeById.has(id) && sourceKeyFromDb(activeById.get(id)) !== sourceKeyFromRow(parsedById.get(id)!));
  const identityMap = await activePersons(pool, identityRevision);
  const linked = parsed.filter(row => { const label = row.person?.externalId ?? ''; return (identityMap.get(fold(label)) ?? []).length === 1; }).length;
  const unresolved = parsed.length - linked;
  const nonPersonLabels = parsed.filter(row => { const label = row.person?.externalId ?? ''; return fold(label).includes('colegiado') || fold(label).includes('bancada'); }).length;
  const personUnresolved = unresolved - nonPersonLabels;
  const historicalNonPersonRows = beforeHistorical.filter(row => isNonPersonDbRow(row)).length;
  const historicalLinkedRows = beforeHistorical.filter(row => row.person_external_id != null && String(row.linkage_status ?? '') !== 'NON_PERSON').length;
  const historicalUnresolvedRows = beforeHistorical.length - historicalLinkedRows - historicalNonPersonRows;
  const delta = { unchanged, added: added.length, removed: removed.length, semanticallyChanged: semanticallyChanged.length, intersection: unchanged + semanticallyChanged.length };
  const noOp = scCurrentDeltaIsNoOp({ added: added.length, removed: removed.length, semanticallyChanged: semanticallyChanged.length });
  let afterRevision = beforeFinance; let publication = 'NO_OP'; let duplicateInsertions = 0; let persistedRows = beforeRows.length;
  if (!noOp) {
    const rowPayloads = [...beforeHistorical.map(row => ({ ...row })), ...parsed.map(row => ({ row, sourceKey: sourceKeyFromRow(row), externalId: externalIdFromSourceKey(sourceKeyFromRow(row)) }))];
    const revision = `state:SC:finance:${sha(rowPayloads.map(value => typeof value.row === 'undefined' ? canonical(semanticDbRow(value)) : `${value.externalId}|${value.sourceKey}`).sort().join('\n'))}`;
    afterRevision = revision;
    await tx(pool, async client => {
      await client.query(`INSERT INTO ${STATE_SCHEMA}.raw_objects(raw_id,house,provider,resource,endpoint,params,external_id,fetched_at,observed_at,status,content_type,sha256,body) VALUES($1,'SC',$2,'finance_expense_export',$3,'{}'::jsonb,NULL,$4,$4,200,'text/csv; charset=UTF-8',$5,$6) ON CONFLICT(raw_id) DO NOTHING`, [raw.rawId, SC_CURRENT_PROVIDER, SC_CURRENT_URL, raw.fetchedAt, source.rawSha256, source.body]);
      const runId = `state:SC:finance:p18_2b2c:${source.rawSha256}`;
      await client.query(`INSERT INTO ${STATE_SCHEMA}.ingestion_runs(run_id,house,provider,started_at,finished_at,status,parser_version,expected_count,quality,reconciliation) VALUES($1,'SC',$2,$3,$3,'published','p18-2b2c-sc-v1',$4,$5::jsonb,$6::jsonb) ON CONFLICT(run_id) DO UPDATE SET status='published',quality=excluded.quality,reconciliation=excluded.reconciliation`, [runId, SC_CURRENT_PROVIDER, raw.fetchedAt, rowPayloads.length, JSON.stringify({ status:'PASS', providerVersion:SC_CURRENT_PROVIDER_VERSION }), JSON.stringify({ delta, duplicateGroups: duplicateGroups.length, duplicateRows, maxMultiplicity })]);
      await client.query(`INSERT INTO ${STATE_SCHEMA}.ingestion_revisions(house,provider,domain,run_id,batch_id) VALUES('SC',$1,'finance',$2,$3) ON CONFLICT DO NOTHING`, [SC_CURRENT_PROVIDER, runId, `${runId}:finance`]);
      await client.query(`INSERT INTO ${STATE_SCHEMA}.public_domain_revisions(house,domain,revision_id,status,quality,created_at,activated_at) VALUES('SC','finance',$1,'active',$2::jsonb,$3,$3) ON CONFLICT(house,domain,revision_id) DO UPDATE SET status='active',quality=excluded.quality`, [revision, JSON.stringify({ status:'PASS', sourceRows: rowPayloads.length, historicalRows: beforeHistorical.length, currentRows: parsed.length, providerVersion:SC_CURRENT_PROVIDER_VERSION }), raw.fetchedAt]);
      await client.query(`INSERT INTO ${STATE_SCHEMA}.public_revision_contributions(house,domain,revision_id,provider,run_id,batch_id) VALUES('SC','finance',$1,$2,$3,$4) ON CONFLICT DO NOTHING`, [revision, SC_CURRENT_PROVIDER, runId, `${runId}:finance`]);
      const insert = async (values: unknown[]) => { const marks = values.map((_, i) => `$${i + 1}`).join(','); await client.query(`INSERT INTO ${STATE_SCHEMA}.expenses(${EXPENSE_COLUMNS.join(',')}) VALUES(${marks}) ON CONFLICT(revision_id,house,provider,external_id) DO NOTHING`, values); };
      for (const old of beforeHistorical) await insert([revision, ...EXPENSE_COLUMNS.slice(1).map(column => old[column])]);
      for (const parsedRow of parsed) {
        const sourceKey = sourceKeyFromRow(parsedRow); const externalId = externalIdFromSourceKey(sourceKey); const previous = activeById.get(externalId);
        const candidates = identityMap.get(fold(parsedRow.person?.externalId ?? '')) ?? []; const personId = candidates.length === 1 ? (candidates[0] ?? null) : null;
        const linkage = selectScCurrentLinkage(previous ? { personExternalId: previous.person_external_id, linkageMethod: previous.linkage_method, linkageStatus: previous.linkage_status, rawId: previous.raw_id, provenance: previous.provenance } : null, personId, parsedRow.person?.externalId ?? '');
        const values: Record<string, unknown> = { revision_id: revision, house: 'SC', provider: SC_CURRENT_PROVIDER, external_id: externalId, person_external_id: linkage.personExternalId, occurred_at: parsedRow.occurredAt ?? null, competence: parsedRow.competence ?? null, period_start: parsedRow.occurredAt ?? null, period_end: parsedRow.occurredAt ?? null, temporal_precision: 'day', amount_cents: parsedRow.amountCents ?? null, gross_amount_cents: parsedRow.amountCents ?? null, claimed_amount_cents: parsedRow.claimedAmountCents ?? null, reimbursed_amount_cents: null, glosa_amount_cents: null, category: parsedRow.category ?? null, supplier_external_id: parsedRow.supplier?.externalId ?? null, supplier_name: parsedRow.supplierName ?? null, supplier_document: parsedRow.supplierDocument ?? null, supplier_document_type: null, fiscal_document_number: parsedRow.fiscalDocument ?? null, fiscal_document_type: null, description: parsedRow.description ?? null, mechanism_type: 'GABINETES', mechanism_name: 'Gabinetes Parlamentares', source_granularity: 'itemized', attachment_url: null, source_url: SC_CURRENT_URL, linkage_method: linkage.linkageMethod, linkage_status: linkage.linkageStatus, raw_id: linkage.rawId ?? raw.rawId, provenance: linkage.provenance ?? { ...raw, sourceKey, providerPersonLabel: parsedRow.person?.externalId ?? null, canonicalPerson: personId, identityRevision } };
        await insert(EXPENSE_COLUMNS.map(column => values[column]));
      }
      await client.query(`INSERT INTO ${STATE_SCHEMA}.active_publications(house,domain,revision_id,activated_at) VALUES('SC','finance',$1,$2) ON CONFLICT(house,domain) DO UPDATE SET revision_id=excluded.revision_id,activated_at=excluded.activated_at`, [revision, raw.fetchedAt]);
      await client.query(`UPDATE ${STATE_SCHEMA}.public_domain_revisions SET status='rejected' WHERE house='SC' AND domain='finance' AND revision_id<>$1 AND status='active'`, [revision]);
      await client.query(`UPDATE ${STATE_SCHEMA}.operational_coverage SET status='CONSUMABLE',records_found=$1,records_resolved=$2,primary_records_found=$1,primary_records_resolved=$2,components=$3::jsonb,active_revision_id=$4,last_successful_run=$5::text,updated_at=$6::timestamptz WHERE house='SC' AND dimension='parliamentary_allowance'`, [rowPayloads.length, historicalLinkedRows + linked, JSON.stringify({ sourceRows: parsed.length, historicalRows: beforeHistorical.length, currentRows: parsed.length, personLinkedRows: historicalLinkedRows + linked, personUnresolvedRows: historicalUnresolvedRows + personUnresolved, nonPersonRows: historicalNonPersonRows + nonPersonLabels, providerVersion:SC_CURRENT_PROVIDER_VERSION }), revision, raw.fetchedAt, raw.fetchedAt]);
    });
    persistedRows = beforeHistorical.length + parsed.length; publication = 'PUBLISHED';
  }
  const afterRevisions = await activeRevisions(pool); const afterFingerprint = await fingerprint(pool, `house='SC' AND revision_id=$1`, [afterRevision]);
  const afterRows = await revisionRows(pool, afterRevision); const afterCurrent = afterRows.filter(row => String(row.competence ?? '').startsWith('2026-')); const afterHistorical = afterRows.filter(row => !String(row.competence ?? '').startsWith('2026-'));
  const afterNonPerson = afterRows.filter(row => isNonPersonDbRow(row)).length; const afterLinked = afterRows.filter(row => row.person_external_id != null && !isNonPersonDbRow(row)).length; const afterUnresolved = afterRows.length - afterLinked - afterNonPerson;
  const afterCurrentNonPerson = afterCurrent.filter(row => isNonPersonDbRow(row)).length; const afterCurrentLinked = afterCurrent.filter(row => row.person_external_id != null && !isNonPersonDbRow(row)).length;
  const afterCurrentUnresolved = afterCurrent.length - afterCurrentLinked - afterCurrentNonPerson;
  const counts = { totalRows: afterRows.length, historicalRows: afterHistorical.length, currentRows: afterCurrent.length, personLinkedRows: afterLinked, personUnresolvedRows: afterUnresolved, nonPersonRows: afterNonPerson, currentPersonLinkedRows: afterCurrentLinked, currentPersonUnresolvedRows: afterCurrentUnresolved, currentNonPersonRows: afterCurrentNonPerson };
  if (counts.personLinkedRows + counts.personUnresolvedRows + counts.nonPersonRows !== counts.totalRows) throw new Error('identity counters are not mutually exclusive');
  return { database: STATE_DATABASE, provider: SC_CURRENT_PROVIDER, providerVersion: SC_CURRENT_PROVIDER_VERSION, source, sourceMode: options.mode ?? (options.body === undefined ? 'fetch' : 'replay'), activeFinanceRevisionBefore: beforeFinance, activeFinanceRevisionAfter: afterRevision, activeIdentityRevision: identityRevision, beforeRows: { historical: beforeHistorical.length, current2026: before2026.length, total: beforeRows.length }, currentSourceRows: parsed.length, delta, duplicateAudit: { groups: duplicateGroups.length, rows: duplicateRows, maxMultiplicity, collisionsAfterMultiplicity: 0 }, counts, publication, noOp, duplicateInsertions, persistedRows, afterFingerprint, activeRevisionsBefore: beforeRevisions, activeRevisionsAfter: afterRevisions, historicalParity: beforeHistorical.length === counts.historicalRows, identityRevisionUnchanged: beforeRevisions['SC:identity'] === afterRevisions['SC:identity'] };
}

/** Public SC entrypoint. The provider-specific persistence remains below the bridge;
 * generic guard and per-house/domain/provider serialization are supplied by Core. */
export async function collectScCurrentFinance(pool: Pool, options: ScCurrentRunOptions = {}): Promise<any> {
  const runtime = new CollectorRuntime({
    assertDatabase: async () => {
      const database = (await pool.query<{ current_database: string }>('SELECT current_database()')).rows[0]?.current_database;
      if (database !== STATE_DATABASE) throw new Error(`P18.3A target refused: ${database}`);
    },
  });
  const context: CollectorContext = { runId: `state:SC:finance:${Date.now()}`, house: 'SC', domain: SC_FINANCE_DOMAIN, provider: SC_CURRENT_PROVIDER, providerVersion: SC_CURRENT_PROVIDER_VERSION, startedAt: new Date().toISOString() };
  return runtime.runDelegate(context, () => collectScCurrentFinanceImplementation(pool, options));
}

/**
 * Repairs the B2C linkage regression without recollecting or reconstructing
 * identities.  Financial/source columns are copied byte-for-byte from the
 * current B2C revision; only linkage and its provenance are carried forward
 * for the 10,297 pre-existing 2026 rows.
 */
export async function repairScCurrentLinkage(pool: Pool): Promise<ScCurrentLinkageRepairResult> {
  const database = (await pool.query<{ current_database: string }>('SELECT current_database()')).rows[0]?.current_database;
  if (database !== STATE_DATABASE) throw new Error(`P18.2B2CR target refused: ${database}`);
  const oldRows = await revisionRows(pool, PRE_B2C_SC_FINANCE_REVISION);
  const currentRows = await revisionRows(pool, B2C_SC_FINANCE_REVISION);
  const identityBefore = await activeIdentity(pool);
  if (identityBefore !== SC_IDENTITY_REVISION) throw new Error(`SC identity revision changed: ${identityBefore}`);
  const old2026 = oldRows.filter(row => String(row.competence ?? '').startsWith('2026-'));
  const current2026 = currentRows.filter(row => String(row.competence ?? '').startsWith('2026-'));
  const oldLinked = old2026.filter(row => row.person_external_id != null && row.linkage_status !== 'NON_PERSON').length;
  const oldNonPerson = old2026.filter(row => row.linkage_status === 'NON_PERSON').length;
  const oldUnresolved = old2026.length - oldLinked - oldNonPerson;
  if (old2026.length !== 10297 || oldLinked !== 7156 || oldUnresolved !== 3141) throw new Error(`Unexpected pre-B2C baseline: ${old2026.length}/${oldLinked}/${oldUnresolved}`);
  const oldById = new Map(old2026.map(row => [String(row.external_id), row]));
  const currentById = new Map(current2026.map(row => [String(row.external_id), row]));
  const shared = [...oldById.keys()].filter(id => currentById.has(id));
  const identityEqual = shared.filter(id => jsonEqual(identityDbRow(oldById.get(id)), identityDbRow(currentById.get(id))));
  const identityDifferent = shared.filter(id => !jsonEqual(identityDbRow(oldById.get(id)), identityDbRow(currentById.get(id))));
  const lost = shared.filter(id => oldById.get(id)!.person_external_id != null && currentById.get(id)!.person_external_id == null);
  const gained = shared.filter(id => oldById.get(id)!.person_external_id == null && currentById.get(id)!.person_external_id != null);
  const reassigned = shared.filter(id => oldById.get(id)!.person_external_id != null && currentById.get(id)!.person_external_id != null && oldById.get(id)!.person_external_id !== currentById.get(id)!.person_external_id);
  const statusChanged = shared.filter(id => oldById.get(id)!.linkage_status !== currentById.get(id)!.linkage_status).length;
  const methodChanged = shared.filter(id => oldById.get(id)!.linkage_method !== currentById.get(id)!.linkage_method).length;
  const provenanceChanged = shared.filter(id => !jsonEqual(oldById.get(id)!.provenance, currentById.get(id)!.provenance) || oldById.get(id)!.raw_id !== currentById.get(id)!.raw_id).length;
  const addedIds = [...currentById.keys()].filter(id => !oldById.has(id));
  const newRows = addedIds.map(id => { const row = currentById.get(id)!; const label = row.provenance?.providerPersonLabel ?? null; const nonPerson = row.linkage_status === 'NON_PERSON'; const unresolved = row.person_external_id == null && !nonPerson; return { external_id: id, Conta: label, person_id: row.person_external_id, linkage_status: row.linkage_status, linkage_method: row.linkage_method, classification: nonPerson ? 'NON_PERSON' : unresolved ? 'UNRESOLVED_NEW_SOURCE_IDENTITY' : 'LINKED' }; });
  const currentHistorical = currentRows.filter(row => !String(row.competence ?? '').startsWith('2026-'));
  const oldHistorical = oldRows.filter(row => !String(row.competence ?? '').startsWith('2026-'));
  const historicalParity = currentHistorical.length === oldHistorical.length && currentHistorical.every((row, index) => jsonEqual(financialDbRow(row), financialDbRow(oldHistorical[index])));
  const currentAllById = new Map(currentRows.map(row => [String(row.external_id), row]));
  if (currentRows.length !== 53329 || !historicalParity) throw new Error('SC financial/historical baseline is not the expected B2C content');
  const correctedRows = currentRows.map(row => { const old = oldById.get(String(row.external_id)); return old ? { ...row, person_external_id: old.person_external_id, linkage_method: old.linkage_method, linkage_status: old.linkage_status, raw_id: old.raw_id, provenance: old.provenance } : row; });
  const correctedRevision = `state:SC:finance:${sha(`p18_2b2cr|${correctedRows.map(row => canonical({ external_id: row.external_id, ...financialDbRow(row), ...identityDbRow(row) })).sort().join('\n')}`)}`;
  const activeBefore = (await activeRevision(pool));
  if (activeBefore !== B2C_SC_FINANCE_REVISION) throw new Error(`Unexpected active SC finance revision: ${activeBefore}`);
  let duplicateInsertions = 0;
  await tx(pool, async client => {
    const now = new Date().toISOString(); const runId = `state:SC:finance:p18_2b2cr:${sha(correctedRevision)}`;
    await client.query(`INSERT INTO ${STATE_SCHEMA}.ingestion_runs(run_id,house,provider,started_at,finished_at,status,parser_version,expected_count,quality,reconciliation) VALUES($1,'SC',$2,$3,$3,'published','p18-2b2cr-sc-v1',$4,$5::jsonb,$6::jsonb) ON CONFLICT(run_id) DO UPDATE SET status='published',quality=excluded.quality,reconciliation=excluded.reconciliation`, [runId, SC_CURRENT_PROVIDER, now, correctedRows.length, JSON.stringify({ status: 'PASS', phase: 'P18_2B2CR', financialContentParity: 'PASS' }), JSON.stringify({ oldRevision: PRE_B2C_SC_FINANCE_REVISION, currentRevision: B2C_SC_FINANCE_REVISION, unchanged2026: shared.length, unchangedLinkageDifferent: identityDifferent.length, added2026: addedIds.length })]);
    await client.query(`INSERT INTO ${STATE_SCHEMA}.ingestion_revisions(house,provider,domain,run_id,batch_id) VALUES('SC',$1,'finance',$2,$3) ON CONFLICT DO NOTHING`, [SC_CURRENT_PROVIDER, runId, `${runId}:finance`]);
    await client.query(`INSERT INTO ${STATE_SCHEMA}.public_domain_revisions(house,domain,revision_id,status,quality,created_at,activated_at) VALUES('SC','finance',$1,'active',$2::jsonb,$3,$3) ON CONFLICT(house,domain,revision_id) DO UPDATE SET status='active',quality=excluded.quality`, [correctedRevision, JSON.stringify({ status: 'PASS', phase: 'P18_2B2CR', sourceRows: correctedRows.length, historicalRows: oldHistorical.length, currentRows: current2026.length, financialContentParity: 'PASS', linkageRepair: 'CARRY_FORWARD_PRE_B2C' }), now]);
    await client.query(`INSERT INTO ${STATE_SCHEMA}.public_revision_contributions(house,domain,revision_id,provider,run_id,batch_id) VALUES('SC','finance',$1,$2,$3,$4) ON CONFLICT DO NOTHING`, [correctedRevision, SC_CURRENT_PROVIDER, runId, `${runId}:finance`]);
    for (const row of correctedRows) {
      const values = EXPENSE_COLUMNS.map(column => column === 'revision_id' ? correctedRevision : row[column]);
      const result = await client.query(`INSERT INTO ${STATE_SCHEMA}.expenses(${EXPENSE_COLUMNS.join(',')}) VALUES(${values.map((_, index) => `$${index + 1}`).join(',')}) ON CONFLICT(revision_id,house,provider,external_id) DO NOTHING`, values);
      duplicateInsertions += result.rowCount === 0 ? 1 : 0;
    }
    await client.query(`INSERT INTO ${STATE_SCHEMA}.active_publications(house,domain,revision_id,activated_at) VALUES('SC','finance',$1,$2) ON CONFLICT(house,domain) DO UPDATE SET revision_id=excluded.revision_id,activated_at=excluded.activated_at`, [correctedRevision, now]);
    await client.query(`UPDATE ${STATE_SCHEMA}.public_domain_revisions SET status='rejected' WHERE house='SC' AND domain='finance' AND revision_id<>$1 AND status='active'`, [correctedRevision]);
    await client.query(`UPDATE ${STATE_SCHEMA}.operational_coverage SET active_revision_id=$1,updated_at=$2::timestamptz WHERE house='SC' AND dimension='parliamentary_allowance'`, [correctedRevision, now]);
  });
  const activeAfter = await activeRevision(pool);
  const finalRows = await revisionRows(pool, correctedRevision);
  const finalFinanceParity = finalRows.length === currentRows.length && finalRows.every(row => { const current = currentAllById.get(String(row.external_id)); return current != null && jsonEqual(financialDbRow(row), financialDbRow(current)); });
  if (!finalFinanceParity || duplicateInsertions !== 0) throw new Error('corrected revision financial parity failed');
  return { database, oldRevision: PRE_B2C_SC_FINANCE_REVISION, currentRevision: B2C_SC_FINANCE_REVISION, correctedRevision, old2026Rows: old2026.length, old2026LinkedRows: oldLinked, old2026UnresolvedRows: oldUnresolved, current2026Rows: current2026.length, unchanged2026Rows: shared.length, unchangedLinkageEqual: identityEqual.length, unchangedLinkageDifferent: identityDifferent.length, personIdLostBeforeRepair: lost.length, personIdGainedBeforeRepair: gained.length, personIdReassignedBeforeRepair: reassigned.length, linkageStatusChangedBeforeRepair: statusChanged, linkageMethodChangedBeforeRepair: methodChanged, provenanceChangedBeforeRepair: provenanceChanged, newRows, financialContentParity: finalFinanceParity ? 'PASS' : 'FAIL', historicalParity: historicalParity ? 'PASS' : 'FAIL', identityRevision: identityBefore, identityRevisionChanged: 0, activeRevisionBefore: activeBefore, activeRevisionAfter: activeAfter, duplicateInsertions };
}
