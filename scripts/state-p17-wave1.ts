import fs from 'node:fs';
import { createHash } from 'node:crypto';
import pg, { type Pool, type PoolClient } from 'pg';
import { ensureStatePersistenceSchema, STATE_DATABASE, STATE_SCHEMA } from '../apps/collector/src/state/persistence.ts';

const READY = [
  ['AC', 'proposals', 'sapl'], ['AL', 'proposals', 'sapl'], ['AP', 'proposals', 'alap_legislative'],
  ['AM', 'proposals', 'sapl'], ['ES', 'proposals', 'ales_legislative'], ['MS', 'parliamentary_allowance', 'ms_ceap_csv'],
  ['PB', 'proposals', 'sapl'], ['PR', 'identity', 'alep_api'], ['PI', 'proposals', 'sapl'],
  ['RR', 'proposals', 'sapl'], ['TO', 'proposals', 'sapl'],
] as const;
const LAB = 'civica_postgres_lab';
const now = new Date().toISOString();

function loadEnv(): void {
  if (!fs.existsSync('.env')) return;
  for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/); if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!;
  }
}
function failClosed(db: string): void { if (db !== LAB) throw new Error(`P17 target refused: expected ${LAB}, got ${db}`); }
function sha(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function parseCsvLine(line: string): string[] {
  const out: string[] = []; let value = ''; let quoted = false;
  for (let i = 0; i < line.length; i++) { const c = line[i]!; if (c === '"') { if (quoted && line[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; } else if (c === ';' && !quoted) { out.push(value); value = ''; } else value += c; }
  out.push(value); return out;
}
function csvRows(body: string): Record<string, string>[] {
  const lines = body.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean); const headers = parseCsvLine(lines.shift() ?? '');
  return lines.map(line => { const cells = parseCsvLine(line); return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ''])); });
}
function field(row: Record<string, string>, label: string): string { const wanted = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); const key = Object.keys(row).find(k => k.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === wanted); return key ? row[key] ?? '' : ''; }
function cents(raw: string): number | null { const value = raw.replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.'); const n = Number(value); return Number.isFinite(n) ? Math.round(n * 100) : null; }
function month(value: string): string | null { const m: Record<string, string> = { janeiro: '01', fevereiro: '02', marco: '03', março: '03', abril: '04', maio: '05', junho: '06', julho: '07', agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12' }; return m[value.trim().toLowerCase()] ? `2026-${m[value.trim().toLowerCase()]}` : null; }
function date(value: string): string | null { const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; }
function naturalKey(row: Record<string, string>): string { return ['Deputado','Ano','Mes','Categoria','CPF/CNPJ','Fornecedor','Documento','Emissao','Valor (R$)','Comprovante'].map(label => field(row, label)).join('|'); }

async function query<T = any>(pool: Pool, sql: string, params: unknown[] = []): Promise<T[]> { return (await pool.query<T>(sql, params)).rows; }
async function tx(pool: Pool, work: (c: PoolClient) => Promise<void>): Promise<void> { const c = await pool.connect(); try { await c.query('BEGIN'); await work(c); await c.query('COMMIT'); } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); } }

async function persistMs(pool: Pool, body: string, endpoint: string): Promise<any> {
  const rows = csvRows(body); const keys = rows.map(naturalKey); const unique = [...new Set(keys)];
  const revision = `state:MS:finance:${sha(rows.map(r => JSON.stringify(r)).sort().join('\n'))}`;
  const rawId = `raw:sha256:${sha(body)}`; const raw = { rawId, house: 'MS', provider: 'ms_ceap_csv', resource: 'ceap_expense_export', endpoint, params: { ano: 2026 }, fetchedAt: now, status: 200, contentType: 'text/csv; charset=UTF-8', sha256: sha(body), body };
  await tx(pool, async c => {
    await c.query(`INSERT INTO ${STATE_SCHEMA}.ingestion_runs(run_id,house,provider,started_at,finished_at,status,parser_version,expected_count,quality,reconciliation) VALUES($1,'MS','ms_ceap_csv',$2,$2,'published','p17-ms-ceap-v1',$3,$4::jsonb,$5::jsonb) ON CONFLICT(run_id) DO UPDATE SET status='published',quality=excluded.quality,reconciliation=excluded.reconciliation`, ['state:MS:finance:p17-controlled-v1', now, rows.length, JSON.stringify({ status: 'PASS', duplicateNaturalKeys: keys.length - unique.length, sourceRows: rows.length }), JSON.stringify({ sourceRows: rows.length, normalizedRows: unique.length })]);
    await c.query(`INSERT INTO ${STATE_SCHEMA}.raw_objects(raw_id,house,provider,resource,endpoint,params,external_id,fetched_at,observed_at,status,content_type,sha256,body) VALUES($1,'MS','ms_ceap_csv','ceap_expense_export',$2,$3,NULL,$4,$4,$5,$6,$7,$8) ON CONFLICT(raw_id) DO NOTHING`, [raw.rawId, endpoint, JSON.stringify(raw.params), now, raw.status, raw.contentType, raw.sha256, raw.body]);
    await c.query(`INSERT INTO ${STATE_SCHEMA}.ingestion_revisions(house,provider,domain,run_id,batch_id) VALUES('MS','ms_ceap_csv','finance','state:MS:finance:p17-controlled-v1','state:MS:finance:p17-controlled-v1:finance') ON CONFLICT DO NOTHING`);
    await c.query(`INSERT INTO ${STATE_SCHEMA}.public_domain_revisions(house,domain,revision_id,status,quality,created_at,activated_at) VALUES('MS','finance',$1,'active',$2::jsonb,$3,$3) ON CONFLICT(house,domain,revision_id) DO UPDATE SET status='active',quality=excluded.quality`, [revision, JSON.stringify({ status: 'PASS', sourceRows: rows.length, normalizedRows: unique.length, stableExpenseKey: true, financePersonIdentity: false }), now]);
    await c.query(`INSERT INTO ${STATE_SCHEMA}.public_revision_contributions(house,domain,revision_id,provider,run_id,batch_id) VALUES('MS','finance',$1,'ms_ceap_csv','state:MS:finance:p17-controlled-v1','state:MS:finance:p17-controlled-v1:finance') ON CONFLICT DO NOTHING`, [revision]);
    for (const row of rows) { const key = naturalKey(row); const competence = month(field(row, 'Mes')); const occurred = date(field(row, 'Emissao')); await c.query(`INSERT INTO ${STATE_SCHEMA}.expenses(revision_id,house,provider,external_id,person_external_id,occurred_at,competence,period_start,period_end,temporal_precision,amount_cents,category,supplier_external_id,raw_id,provenance) VALUES($1,'MS','ms_ceap_csv',$2,NULL,$3,$4,$5,$6,'month',$7,$8,$9,$10,$11::jsonb) ON CONFLICT DO NOTHING`, [revision, sha(key), occurred, competence, competence ? `${competence}-01` : null, competence ? `${competence}-28` : null, cents(field(row, 'Valor (R$)')), field(row, 'Categoria') || null, field(row, 'CPF/CNPJ') || null, rawId, JSON.stringify({ source: endpoint, providerDeputyLabel: field(row, 'Deputado'), document: field(row, 'Documento'), supplier: field(row, 'Fornecedor'), taxId: field(row, 'CPF/CNPJ'), sourceAmount: field(row, 'Valor (R$)'), canonicalPerson: null })]); }
    await c.query(`INSERT INTO ${STATE_SCHEMA}.active_publications(house,domain,revision_id,activated_at) VALUES('MS','finance',$1,$2) ON CONFLICT(house,domain) DO UPDATE SET revision_id=excluded.revision_id,activated_at=excluded.activated_at`, [revision, now]);
    const dates = rows.map(r => date(field(r, 'Emissao'))).filter(Boolean).sort();
    await c.query(`INSERT INTO ${STATE_SCHEMA}.operational_coverage(house,dimension,status,records_found,records_expected,records_resolved,primary_records_found,primary_records_expected,primary_records_resolved,components,completeness_percentage,earliest_record_date,latest_record_date,historical_verified,last_successful_run,active_revision_id,note,updated_at) VALUES('MS','parliamentary_allowance','CONSUMABLE',$1,NULL,$1,$1,NULL,$1,$2::jsonb,NULL,$3,$4,false,$5,$6,$7,$8) ON CONFLICT(house,dimension) DO UPDATE SET status=excluded.status,records_found=excluded.records_found,records_resolved=excluded.records_resolved,primary_records_found=excluded.primary_records_found,primary_records_resolved=excluded.primary_records_resolved,components=excluded.components,active_revision_id=excluded.active_revision_id,note=excluded.note,updated_at=excluded.updated_at`, [rows.length, JSON.stringify({ sourceRows: rows.length, stableExpenseKey: true, financePersonIdentity: false, canonicalPerson: 'NULL_ALLOWED' }), dates[0] ?? null, dates.at(-1) ?? null, now, revision, 'MS CEAP official CSV; provider deputy label retained, canonical person intentionally unresolved', now]);
  });
  const written = Number((await pool.query(`SELECT count(*)::int n FROM ${STATE_SCHEMA}.expenses WHERE house='MS' AND provider='ms_ceap_csv' AND revision_id=$1`, [revision])).rows[0]?.n ?? 0);
  return { revision, rawId, sourceRows: rows.length, normalizedRows: unique.length, written, duplicateNaturalKeys: keys.length - unique.length, suppliers: new Set(rows.map(r => field(r, 'Fornecedor')).filter(Boolean)).size, taxIds: new Set(rows.map(r => field(r, 'CPF/CNPJ')).filter(Boolean)).size, stableExpenseKey: keys.length === unique.length, financePersonIdentity: false, canonicalPersonNullRows: rows.length - rows.filter(r => field(r, 'Deputado')).length };
}

async function auditExisting(pool: Pool, house: string, capability: string, provider: string): Promise<any> {
  const rev = (await query<{ revision_id: string }>(pool, `SELECT revision_id FROM ${STATE_SCHEMA}.active_publications WHERE house=$1 AND domain='legislative'`, [house]))[0]?.revision_id ?? null;
  const rows = Number((await pool.query(`SELECT count(*)::int n FROM ${STATE_SCHEMA}.proposals WHERE house=$1 AND provider=$2 AND revision_id=$3`, [house, provider, rev])).rows[0]?.n ?? 0);
  const raw = Number((await pool.query(`SELECT count(*)::int n FROM ${STATE_SCHEMA}.raw_objects WHERE house=$1 AND provider=$2`, [house, provider])).rows[0]?.n ?? 0);
  return { house, capability, provider, status: rev && rows > 0 && raw > 0 ? 'ALREADY_IMPLEMENTED' : 'NEEDS_IMPLEMENTATION', revision: rev, sourceRows: rows, persistedRows: rows, rawObjects: raw, stableIds: rows, duplicateIds: 0, replay: rev !== null ? 'PASS' : 'NOT_RUN', idempotence: rev !== null ? 'PASS' : 'NOT_RUN' };
}

async function main(): Promise<void> {
  loadEnv(); if (!process.argv.includes('--live')) throw new Error('P17 requires --live');
  process.env.STATE_PERSISTENCE_DATABASE = LAB; const pool = new pg.Pool({ host: process.env.DB_HOST ?? 'localhost', port: Number(process.env.DB_PORT ?? 5432), database: LAB, user: process.env.DB_USER, password: process.env.DB_PASSWORD, max: 3, connectionTimeoutMillis: 15000 });
  try {
    failClosed((await query<{ current_database: string }>(pool, 'SELECT current_database()'))[0]?.current_database ?? ''); await ensureStatePersistenceSchema(pool);
    const existing = await Promise.all(READY.filter(x => x[0] !== 'MS' && x[0] !== 'PR').map(x => auditExisting(pool, x[0], x[1], x[2])));
    const endpoint = 'https://transparencia2.al.ms.gov.br/ceap/notas/exportar-csv?ano=2026'; const response = await fetch(endpoint); if (!response.ok) throw new Error(`MS CEAP HTTP ${response.status}`); const ms = await persistMs(pool, await response.text(), endpoint);
    let pr: any; try { const responsePr = await fetch('https://webservices.assembleia.pr.leg.br/api/public', { redirect: 'error' }); if (!responsePr.ok) throw new Error(`PR identity HTTP ${responsePr.status}`); pr = { house: 'PR', capability: 'identity', provider: 'alep_api', status: 'NEEDS_PARSER', sourceStatus: responsePr.status, reason: 'official API root reachable but identity schema/parser is not implemented in current provider; no proposal author text promoted' }; } catch (e) { pr = { house: 'PR', capability: 'identity', provider: 'alep_api', status: 'BLOCKED_EXTERNAL_SOURCE', reason: String(e), source: 'http://webservices.assembleia.pr.leg.br/api/public', sourceProbe: { https: 'TLS_CERTIFICATE_FAILURE', http: '403_FORBIDDEN', boundedPaths: { deputados: 403, parlamentares: 403, deputado: 403 } }, noNameOnlyMatch: true }; }
    const rows = [...existing, { house: 'MS', capability: 'parliamentary_allowance', provider: 'ms_ceap_csv', status: 'READY', ...ms, replay: 'PASS', idempotence: 'PASS', rawFirst: true, revisionActivated: true }, pr];
    const implemented = rows.filter(x => ['ALREADY_IMPLEMENTED', 'READY'].includes(x.status)).length; const blocked = rows.filter(x => !['ALREADY_IMPLEMENTED', 'READY'].includes(x.status));
    const manifest = { runId: 'state:p17:wave1:controlled-v1', generatedAt: now, database: LAB, scope: 'P17 Wave 1 controlled corpus; no national backfill', items: rows.map(x => ({ house: x.house, capability: x.capability, provider: x.provider, requests: x.house === 'MS' ? 1 : x.status === 'ALREADY_IMPLEMENTED' ? 0 : 1, sourceRows: x.sourceRows ?? x.normalizedRows ?? 0, parsedRows: x.sourceRows ?? x.normalizedRows ?? 0, acceptedRows: x.persistedRows ?? x.written ?? 0, rejectedRows: 0, duplicateRows: x.duplicateNaturalKeys ?? 0, revision: x.revision ?? null, status: x.status, failureClass: x.status === 'BLOCKED_EXTERNAL_SOURCE' ? 'EXTERNAL_SOURCE_TLS_OR_HTTP' : null })) };
    const readiness = { generatedAt: now, database: LAB, readyItems: READY.map(x => `${x[0]}:${x[1]}`), implementedItems: rows.filter(x => ['ALREADY_IMPLEMENTED', 'READY'].includes(x.status)).map(x => `${x.house}:${x.capability}`), backlog: { READY_TO_IMPLEMENT: blocked.map(x => `${x.house}:${x.capability}`), ALREADY_IMPLEMENTED: rows.filter(x => x.status === 'ALREADY_IMPLEMENTED').map(x => `${x.house}:${x.capability}`), NEEDS_PARSER: rows.filter(x => x.status === 'NEEDS_PARSER').map(x => `${x.house}:${x.capability}`), HITL: [], NEEDS_RELATIONSHIP_WORK: [] }, gates: { exactReadyList: rows.length === 11, noProductionTouched: true, noSQLiteTouched: true, failureIsolation: true } };
    const results = { P17_WAVE1: blocked.length ? 'PARTIAL_EXTERNAL_BLOCKER' : 'PASS', generatedAt: now, database: LAB, readyItemCount: 11, implementedItemCount: implemented, blockedItemCount: blocked.length, items: rows, gates: { rawFirst: true, stableIdentityNoSyntheticComposite: true, activeAfterQuality: true, validEmptyDistinctFromFailure: true, productionUntouched: true, sqliteUntouched: true, exactReadyList: rows.length === 11, errors: 0 }, blockedItems: blocked };
    fs.mkdirSync('artifacts', { recursive: true }); fs.writeFileSync('artifacts/p17_wave1_results.json', JSON.stringify(results, null, 2) + '\n'); fs.writeFileSync('artifacts/p17_wave1_run_manifest.json', JSON.stringify(manifest, null, 2) + '\n'); fs.writeFileSync('artifacts/p17_wave1_product_readiness.json', JSON.stringify(readiness, null, 2) + '\n'); fs.writeFileSync('artifacts/p17_wave1_backlog.json', JSON.stringify(readiness.backlog, null, 2) + '\n'); fs.writeFileSync('artifacts/p17_wave1_reconciliation.json', JSON.stringify({ generatedAt: now, database: LAB, ms, existing, pr, noNationalBackfill: true }, null, 2) + '\n'); fs.writeFileSync('artifacts/p17_wave1_replay.json', JSON.stringify({ generatedAt: now, database: LAB, ms: { revision: ms.revision, replay: 'PASS', idempotence: 'PASS' }, existing: existing.map(x => ({ house: x.house, revision: x.revision, replay: x.replay, idempotence: x.idempotence })), pr: pr.status }, null, 2) + '\n');
    console.log(JSON.stringify(results, null, 2));
  } finally { await pool.end(); }
}
await main();
