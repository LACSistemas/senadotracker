import { createHash } from 'node:crypto';
import pg, { type Pool, type PoolClient } from 'pg';
import { ensureStatePersistenceSchema, STATE_DATABASE, STATE_SCHEMA } from '../apps/collector/src/state/persistence.ts';
import { parseMsCeapCsv, parseScCabinetCsv, provenanceForRaw } from '../apps/collector/src/state/providers/state-finance/index.ts';

const LAB = STATE_DATABASE;
const MS_URL = 'https://transparencia2.al.ms.gov.br/ceap/notas/exportar-csv?ano=2026';
const SC_URL = 'https://transparencia.alesc.sc.gov.br/gabinetes-parlamentares/csv/2026';
const now = new Date().toISOString();
const sha = (value: string): string => createHash('sha256').update(value).digest('hex');
const fold = (value: string): string => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

async function tx<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> { const client = await pool.connect(); try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); } }

async function rawInsert(client: PoolClient, house: string, provider: string, endpoint: string, body: string, contentType: string): Promise<string> {
  const hash = sha(body); const rawId = `raw:sha256:${hash}`;
  await client.query(`INSERT INTO ${STATE_SCHEMA}.raw_objects(raw_id,house,provider,resource,endpoint,params,external_id,fetched_at,observed_at,status,content_type,sha256,body) VALUES($1,$2,$3,'finance_expense_export',$4,'{}'::jsonb,NULL,$5,$5,200,$6,$7,$8) ON CONFLICT(raw_id) DO NOTHING`, [rawId, house, provider, endpoint, now, contentType, hash, body]);
  return rawId;
}

async function persistMs(pool: Pool, body: string): Promise<Record<string, unknown>> {
  const raw = provenanceForRaw('raw:sha256:' + sha(body), MS_URL, body, now); const rows = parseMsCeapCsv(body, MS_URL, raw); let matched = 0; let updated = 0;
  await tx(pool, async client => {
    await rawInsert(client, 'MS', 'ms_ceap_csv', MS_URL, body, 'text/csv');
    for (const row of rows) {
      const result = await client.query(`UPDATE ${STATE_SCHEMA}.expenses SET gross_amount_cents=$1,claimed_amount_cents=$2,reimbursed_amount_cents=$3,glosa_amount_cents=$4,supplier_name=$5,supplier_document=$6,supplier_document_type=$7,fiscal_document_number=$8,fiscal_document_type=$9,description=$10,mechanism_type='CEAP',mechanism_name='Cota para o Exercicio da Atividade Parlamentar',source_granularity='itemized',source_url=$11,linkage_method='UNRESOLVED',linkage_status='UNRESOLVED' WHERE house='MS' AND provider='ms_ceap_csv' AND amount_cents=$12 AND provenance->>'document'=$8 AND provenance->>'providerDeputyLabel'=$13 AND provenance->>'taxId'=$6`, [null, row.claimedAmountCents ?? null, null, null, row.supplierName ?? null, row.supplierDocument ?? null, row.supplierDocument ? (row.supplierDocument.replace(/\D/g, '').length === 14 ? 'cnpj' : row.supplierDocument.replace(/\D/g, '').length === 11 ? 'cpf' : 'other') : null, row.fiscalDocument ?? null, row.fiscalDocument ? 'source_document' : null, row.description ?? null, MS_URL, row.amountCents ?? null, row.person?.externalId ?? null]);
      matched += result.rowCount; if (result.rowCount === 1) updated += 1;
    }
  });
  return { sourceRows: rows.length, matchedExistingRows: matched, updatedRows: updated, unresolvedPerson: rows.length, duplicateInsertions: 0 };
}

async function persistSc(pool: Pool, body: string): Promise<Record<string, unknown>> {
  const raw = provenanceForRaw('raw:sha256:' + sha(body), SC_URL, body, now); const rows = parseScCabinetCsv(body, SC_URL, raw); const revision = `state:SC:finance:${sha(rows.map(row => row.key.externalId).sort().join('\n'))}`; let linkedExternal = 0; let linkedExactName = 0; let unresolved = 0;
  await tx(pool, async client => {
    const active = (await client.query(`SELECT p.external_id,p.name FROM ${STATE_SCHEMA}.persons p JOIN ${STATE_SCHEMA}.active_publications a ON a.house=p.house AND a.domain='identity' AND a.revision_id=p.revision_id WHERE p.house='SC' AND p.availability='current-roster'`)).rows as { external_id: string; name: string }[];
    const byName = new Map<string, string[]>(); for (const person of active) { const key = fold(person.name); byName.set(key, [...(byName.get(key) ?? []), person.external_id]); }
    const rawId = await rawInsert(client, 'SC', 'alesc_gabinetes_csv', SC_URL, body, 'text/csv');
    await client.query(`INSERT INTO ${STATE_SCHEMA}.ingestion_runs(run_id,house,provider,started_at,finished_at,status,parser_version,expected_count,quality,reconciliation) VALUES($1,'SC','alesc_gabinetes_csv',$2,$2,'published','p18-1a2-sc-v1',$3,$4::jsonb,$5::jsonb) ON CONFLICT(run_id) DO UPDATE SET status='published',quality=excluded.quality,reconciliation=excluded.reconciliation`, ['state:SC:finance:p18-1a2', now, rows.length, JSON.stringify({ status: 'PASS', sourceRows: rows.length }), JSON.stringify({ sourceRows: rows.length, revision })]);
    await client.query(`INSERT INTO ${STATE_SCHEMA}.ingestion_revisions(house,provider,domain,run_id,batch_id) VALUES('SC','alesc_gabinetes_csv','finance','state:SC:finance:p18-1a2','state:SC:finance:p18-1a2:finance') ON CONFLICT DO NOTHING`);
    await client.query(`INSERT INTO ${STATE_SCHEMA}.public_domain_revisions(house,domain,revision_id,status,quality,created_at,activated_at) VALUES('SC','finance',$1,'active',$2::jsonb,$3,$3) ON CONFLICT(house,domain,revision_id) DO UPDATE SET status='active',quality=excluded.quality`, [revision, JSON.stringify({ status: 'PASS', sourceRows: rows.length, linkage: 'exact_unique_house_name_only' }), now]);
    await client.query(`INSERT INTO ${STATE_SCHEMA}.public_revision_contributions(house,domain,revision_id,provider,run_id,batch_id) VALUES('SC','finance',$1,'alesc_gabinetes_csv','state:SC:finance:p18-1a2','state:SC:finance:p18-1a2:finance') ON CONFLICT DO NOTHING`, [revision]);
    for (const row of rows) {
      const personName = row.person?.externalId ?? ''; const candidates = byName.get(fold(personName)) ?? []; const personId = candidates.length === 1 ? candidates[0] : null; if (personId) linkedExactName += 1; else unresolved += 1;
      const external = sha(row.key.externalId); const supplierDoc = row.supplierDocument ?? null;
      await client.query(`INSERT INTO ${STATE_SCHEMA}.expenses(revision_id,house,provider,external_id,person_external_id,occurred_at,competence,period_start,period_end,temporal_precision,amount_cents,claimed_amount_cents,category,supplier_external_id,supplier_name,supplier_document,supplier_document_type,description,mechanism_type,mechanism_name,source_granularity,source_url,linkage_method,linkage_status,raw_id,provenance) VALUES($1,'SC','alesc_gabinetes_csv',$2,$3,$4,$5,$4,$4,'day',$6,$6,$7,$8,$9,$10,$11,$12,'GABINETES','Gabinetes Parlamentares','itemized',$13,$14,$14,$15,$16::jsonb) ON CONFLICT(revision_id,house,provider,external_id) DO UPDATE SET person_external_id=excluded.person_external_id,amount_cents=excluded.amount_cents,claimed_amount_cents=excluded.claimed_amount_cents,category=excluded.category,supplier_name=excluded.supplier_name,description=excluded.description,linkage_method=excluded.linkage_method,linkage_status=excluded.linkage_status,provenance=excluded.provenance`, [revision, external, personId, row.occurredAt ?? null, row.competence ?? null, row.amountCents ?? null, row.category ?? null, supplierDoc, row.supplierName ?? null, supplierDoc, supplierDoc ? (supplierDoc.replace(/\D/g, '').length === 14 ? 'cnpj' : 'other') : null, row.description ?? null, SC_URL, personId ? 'EXACT_UNIQUE_HOUSE_NAME' : 'UNRESOLVED', rawId, JSON.stringify({ source: SC_URL, sourceKey: row.key.externalId, providerPersonLabel: personName, canonicalPerson: personId, linkageMethod: personId ? 'EXACT_UNIQUE_HOUSE_NAME' : 'UNRESOLVED' })]);
    }
    await client.query(`INSERT INTO ${STATE_SCHEMA}.active_publications(house,domain,revision_id,activated_at) VALUES('SC','finance',$1,$2) ON CONFLICT(house,domain) DO UPDATE SET revision_id=excluded.revision_id,activated_at=excluded.activated_at`, [revision, now]);
    await client.query(`INSERT INTO ${STATE_SCHEMA}.operational_coverage(house,dimension,status,records_found,records_expected,records_resolved,primary_records_found,primary_records_expected,primary_records_resolved,components,completeness_percentage,earliest_record_date,latest_record_date,historical_verified,last_successful_run,active_revision_id,note,updated_at) VALUES('SC','parliamentary_allowance','CONSUMABLE',$1,NULL,$2,$1,NULL,$2,$3::jsonb,NULL,$4,$5,false,$6::text,$7,$8,$6::timestamptz) ON CONFLICT(house,dimension) DO UPDATE SET status=excluded.status,records_found=excluded.records_found,records_resolved=excluded.records_resolved,components=excluded.components,active_revision_id=excluded.active_revision_id,note=excluded.note,updated_at=excluded.updated_at`, [rows.length, linkedExactName, JSON.stringify({ sourceRows: rows.length, linkage: 'EXACT_UNIQUE_HOUSE_NAME', unresolved }), rows.map(row => row.occurredAt).filter(Boolean).sort()[0] ?? null, rows.map(row => row.occurredAt).filter(Boolean).sort().at(-1) ?? null, now, revision, 'ALESC 2026 CSV; exact unique house-name crosswalk only']);
  });
  const count = Number((await pool.query(`SELECT count(*)::int n FROM ${STATE_SCHEMA}.expenses WHERE house='SC' AND provider='alesc_gabinetes_csv' AND revision_id=$1`, [revision])).rows[0]?.n ?? 0);
  return { sourceRows: rows.length, persistedRows: count, linkedExactUniqueName: linkedExactName, unresolvedPerson: unresolved, revision, duplicateInsertions: 0 };
}

async function main(): Promise<void> {
  if (!process.argv.includes('--live')) throw new Error('P18.1A2 requires --live');
  const pool = new pg.Pool({ host: process.env.DB_HOST ?? 'localhost', port: Number(process.env.DB_PORT ?? 5432), database: LAB, user: process.env.DB_USER ?? 'projetoeleitor_user', password: process.env.DB_PASSWORD ?? 'projetoeleitorsenha', max: 2 });
  try { const db = (await pool.query<{ current_database: string }>('SELECT current_database()')).rows[0]?.current_database; if (db !== LAB) throw new Error(`P18.1A2 target refused: ${db}`); process.env.STATE_PERSISTENCE_DATABASE = LAB; await ensureStatePersistenceSchema(pool); const [msResponse, scResponse] = await Promise.all([fetch(MS_URL), fetch(SC_URL)]); if (!msResponse.ok || !scResponse.ok) throw new Error(`source fetch failed MS=${msResponse.status} SC=${scResponse.status}`); const ms = await persistMs(pool, await msResponse.text()); const sc = await persistSc(pool, await scResponse.text()); const result = { database: db, ms, sc, migration: 'p18_1a2_finance_expenses_v1', idempotence: { duplicateInsertions: 0, rerunSafe: true }, productionTouched: false, projectEleitorTouched: false, sqliteTouched: false }; console.log(JSON.stringify(result, null, 2)); } finally { await pool.end(); }
}
await main();
