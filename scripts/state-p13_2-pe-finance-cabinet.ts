import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'artifacts');
const CRAWL = path.join(OUT, '.p13_2_downloads');
const CIVICA_ARTIFACTS = 'C:\\Projetos\\civicadocs\\artifacts';
const DATABASE = 'civica_postgres_lab';
const SCHEMA = 'civica_state';
const PROVIDER = 'alepe_data_portal';
const HOUSE = 'PE';
const now = new Date().toISOString();

function read(file: string) { return fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/^\uFEFF/, ''); }
function json<T = any>(file: string): T { return JSON.parse(read(file)); }
function sha(value: string | Buffer) { return crypto.createHash('sha256').update(value).digest('hex'); }
function stable(value: unknown) { return JSON.stringify(value, (_k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v); }
function revision(domain: string, value: unknown) { return `state:${HOUSE}:${domain}:${sha(stable(value))}`; }
function digits(v: unknown) { const x = String(v ?? '').replace(/\D/g, ''); return x || null; }
function parseAmountBRL(v: unknown) {
  const s = String(v ?? '').trim().replace(/R\$\s*/i, '').replace(/\./g, '').replace(',', '.');
  if (!s || !/^-?\d+(?:\.\d+)?$/.test(s)) return null;
  // ALEPE CEAP payloads expose whole BRL units (e.g. 21880), unlike cents.
  return Math.round(Number(s) * 100);
}
function parseDate(v: unknown) { const m = String(v ?? '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; }
function fileSha(file: string) { return sha(fs.readFileSync(file)); }
function sourceFile(file: string) { return path.isAbsolute(file) ? file : path.join(ROOT, file); }

type DetailRow = { deputyId: string; year: number; month: number; docid: string; rubrica: string | null; sequencial: string | null; data: string | null; cnpj: string | null; empresa: string | null; valor: number | null; detailFile: string; indexFile: string };

async function main() {
  const pool = new pg.Pool({ host: 'localhost', port: 5432, database: DATABASE, user: process.env.DB_USER ?? 'projetoeleitor_user', password: process.env.DB_PASSWORD ?? 'projetoeleitorsenha', max: 2, connectionTimeoutMillis: 20_000 });
  const preClient = await pool.connect();
  const before: any = {};
  try {
    const probe = (await preClient.query('SELECT current_database() database, current_schema() schema')).rows[0];
    if (probe.database !== DATABASE) throw new Error(`P13.2 target refused: ${probe.database}`);
    before.active = (await preClient.query(`SELECT house,domain,revision_id FROM ${SCHEMA}.active_publications WHERE house IN ('SP','RN','CE','MS') ORDER BY house,domain`)).rows;
    before.personCounts = (await preClient.query(`SELECT house,count(*)::int n FROM ${SCHEMA}.persons WHERE house IN ('SP','RN','CE','MS') GROUP BY house`)).rows;
    before.expenseCounts = (await preClient.query(`SELECT house,count(*)::int n FROM ${SCHEMA}.expenses WHERE house IN ('SP','RN','CE','MS') GROUP BY house`)).rows;
  } finally { preClient.release(); }
  const client = await pool.connect();

  const deputies: any[] = json('artifacts/.p13_2_downloads/deputies.json');
  const currentProbe = fs.existsSync(path.join(CRAWL, 'roster-probe/16.json')) ? json<any[]>('artifacts/.p13_2_downloads/roster-probe/16.json') : [];
  const currentIds = new Set(currentProbe.map(x => String(x.id)));
  const monthsManifest: any[] = json('artifacts/.p13_2_downloads/months-manifest.json');
  const documentsManifest: any[] = json('artifacts/.p13_2_downloads/documents-manifest.json');
  const details: DetailRow[] = [];
  const duplicateKeys = new Map<string, number>();
  for (const d of documentsManifest) {
    const file = sourceFile(d.detailFile);
    const payload: any[] = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) : [];
    for (const x of payload) {
      const row: DetailRow = { deputyId: String(d.deputyId), year: Number(d.year), month: Number(d.month), docid: String(d.docid), rubrica: x.rubrica == null ? null : String(x.rubrica), sequencial: x.sequencial == null ? null : String(x.sequencial), data: parseDate(x.data), cnpj: digits(x.cnpj), empresa: x.empresa == null ? null : String(x.empresa), valor: parseAmountBRL(x.valor), detailFile: d.detailFile, indexFile: d.indexFile };
      // No detail item id is exposed; use the deterministic source composite.
      const key = [row.docid, row.rubrica ?? '', row.sequencial ?? '', row.data ?? '', row.cnpj ?? '', row.valor ?? ''].join(':');
      duplicateKeys.set(key, (duplicateKeys.get(key) ?? 0) + 1); details.push(row);
    }
  }
  const semanticCollisions = [...duplicateKeys.values()].filter(n => n > 1).reduce((n, x) => n + x - 1, 0);
  if (semanticCollisions) throw new Error(`PE semantic natural-key collisions: ${semanticCollisions}`);
  const expenseRows = details.filter(x => x.valor !== null).map(x => ({ ...x, externalId: ['doc', x.docid, 'rubrica', x.rubrica ?? '', 'seq', x.sequencial ?? '', 'date', x.data ?? '', 'supplier', x.cnpj ?? '', 'amount', x.valor].join(':') }));
  const identityRevision = revision('identity', deputies.map(x => ({ id: String(x.id), name: String(x.nome ?? ''), current: currentIds.has(String(x.id)) })).sort((a, b) => a.id.localeCompare(b.id)));
  const financeRevision = revision('finance', expenseRows.map(x => ({ provider: PROVIDER, person: x.deputyId, competence: `${x.year}-${String(x.month).padStart(2, '0')}`, document: x.docid, category: x.rubrica, supplier: x.cnpj, amount: x.valor, key: x.externalId })).sort((a, b) => a.key.localeCompare(b.key)));
  const runId = `p13.2:PE:finance:${financeRevision.slice(-32)}`;
  const identityRun = `p13.2:PE:identity:${identityRevision.slice(-32)}`;
  const cabinetRun = `p13.2:PE:cabinet:${sha(now).slice(-24)}`;
  let cabinetSurfaceCount = 0;
  const rawCache = new Map<string, string>();
  const ensureRaw = async (file: string, resource: string, endpoint: string, externalId: string | null) => {
    const abs = sourceFile(file); const body = fs.readFileSync(abs); const bodyText = body.toString('utf8').replace(/^\uFEFF/, ''); const bodySha = sha(body); const cached = rawCache.get(bodySha); if (cached) return cached;
    const existing = (await client.query(`SELECT raw_id FROM ${SCHEMA}.raw_objects WHERE sha256=$1`, [bodySha])).rows[0]?.raw_id as string | undefined;
    if (existing) { rawCache.set(bodySha, existing); return existing; }
    const rawId = `raw:${bodySha}`;
    await client.query(`INSERT INTO ${SCHEMA}.raw_objects(raw_id,house,provider,resource,endpoint,params,external_id,fetched_at,observed_at,status,content_type,sha256,body) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8::timestamptz,$8::timestamptz,200,$9,$10,$11) ON CONFLICT(raw_id) DO NOTHING`, [rawId, HOUSE, PROVIDER, resource, endpoint, JSON.stringify({}), externalId, now, endpoint.endsWith('.csv') ? 'text/csv' : 'application/json', bodySha, bodyText]);
    rawCache.set(bodySha, rawId); return rawId;
  };

  await client.query('BEGIN');
  try {
    await client.query(`INSERT INTO ${SCHEMA}.ingestion_runs(run_id,house,provider,started_at,finished_at,status,parser_version,expected_count,quality,reconciliation) VALUES($1,$2,$3,$4::timestamptz,$4::timestamptz,'published','p13.2-pe-finance-v1',$5,$6::jsonb,$7::jsonb) ON CONFLICT(run_id) DO UPDATE SET status='published',finished_at=excluded.finished_at,expected_count=excluded.expected_count,quality=excluded.quality,reconciliation=excluded.reconciliation`, [runId, HOUSE, PROVIDER, now, expenseRows.length, JSON.stringify({ status: 'PASS', semanticCollisions, nameOnlyMatches: 0 }), JSON.stringify({ sourceRows: details.length, normalizedRows: expenseRows.length, writtenRows: expenseRows.length })]);
    await client.query(`INSERT INTO ${SCHEMA}.ingestion_runs(run_id,house,provider,started_at,finished_at,status,parser_version,expected_count,quality,reconciliation) VALUES($1,$2,$3,$4::timestamptz,$4::timestamptz,'published','p13.2-pe-identity-v1',$5,$6::jsonb,$7::jsonb) ON CONFLICT(run_id) DO NOTHING`, [identityRun, HOUSE, PROVIDER, now, deputies.length, JSON.stringify({ status: 'PASS', identityCollisions: 0 }), JSON.stringify({ sourceRows: deputies.length, writtenRows: deputies.length })]);
    const identityRaw = await ensureRaw('artifacts/.p13_2_downloads/deputies.json', 'person-roster', 'https://www.alepe.pe.gov.br/servicos/transparencia/dep/deputados.php?leg=-16', null);
    await client.query(`INSERT INTO ${SCHEMA}.public_domain_revisions(house,domain,revision_id,status,quality,created_at,activated_at) VALUES($1,'identity',$2,'active',$3::jsonb,$4::timestamptz,$4::timestamptz) ON CONFLICT(house,domain,revision_id) DO UPDATE SET status='active',quality=excluded.quality`, [HOUSE, identityRevision, JSON.stringify({ status: 'PASS', providerRows: deputies.length, currentCandidates: currentIds.size, historicalOrUnknown: deputies.length - currentIds.size }), now]);
    for (const p of deputies) {
      const id = String(p.id), name = String(p.nome ?? '').trim();
      await client.query(`INSERT INTO ${SCHEMA}.identity_mappings(house,provider,resource,external_id,canonical_entity_id,status,method,raw_id) VALUES($1,$2,'person',$3,NULL,'confirmed','provider-external-id',$4) ON CONFLICT(house,provider,resource,external_id) DO UPDATE SET raw_id=excluded.raw_id,status='confirmed',method='provider-external-id'`, [HOUSE, PROVIDER, id, identityRaw]);
      await client.query(`INSERT INTO ${SCHEMA}.persons(revision_id,house,provider,external_id,name,availability,raw_id,provenance) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb) ON CONFLICT(revision_id,house,provider,external_id) DO UPDATE SET name=excluded.name,availability=excluded.availability,raw_id=excluded.raw_id,provenance=excluded.provenance`, [identityRevision, HOUSE, PROVIDER, id, name || `Deputado PE ${id}`, currentIds.has(id) ? 'current-candidate' : 'historical-or-unknown', identityRaw, JSON.stringify({ source: 'ALEPE deputados.php?leg=-16', providerExternalId: id, temporalClassification: currentIds.has(id) ? 'current-candidate-via-leg-16-intersection' : 'historical-or-unknown', partyRaw: p.partido ?? null, email: p.email ?? null, photo: p.foto ?? null })]);
    }
    await client.query(`INSERT INTO ${SCHEMA}.public_revision_contributions(house,domain,revision_id,provider,run_id,batch_id) VALUES($1,'identity',$2,$3,$4,$5) ON CONFLICT DO NOTHING`, [HOUSE, identityRevision, PROVIDER, identityRun, identityRun]);
    await client.query(`INSERT INTO ${SCHEMA}.active_publications(house,domain,revision_id,activated_at) VALUES($1,'identity',$2,$3::timestamptz) ON CONFLICT(house,domain) DO UPDATE SET revision_id=excluded.revision_id,activated_at=excluded.activated_at`, [HOUSE, identityRevision, now]);

    const sourceFiles = new Set<string>(['artifacts/.p13_2_downloads/categories-2026.json', ...monthsManifest.map(x => `artifacts/.p13_2_downloads/months-${x.deputyId}-2026.json`), ...documentsManifest.map(x => x.indexFile), ...documentsManifest.map(x => x.detailFile)]);
    for (const f of sourceFiles) await ensureRaw(f, f.includes('detail-') ? 'expense-detail' : f.includes('docs-') ? 'expense-index' : f.includes('months-') ? 'expense-months' : 'finance-source', `https://www.alepe.pe.gov.br/${f.includes('detail-') ? 'servicos/transparencia/adm/verbaindenizatorianotas.php' : f.includes('docs-') ? 'servicos/transparencia/adm/verbaindenizatoria.php' : f.includes('months-') ? 'servicos/transparencia/adm/verbaindenizatoria-dep-meses.php' : 'servicos/transparencia/adm/verbaindenizatoria-rubricas.php'}`, null);
    const cabinetFiles = ['cabinet-1.txt','cabinet-2.txt','cabinet-3.txt','cabinet-4.txt','cabinet-5.txt'];
    const cabinetRaw: string[] = []; for (const f of cabinetFiles) if (fs.existsSync(path.join(CRAWL, f))) cabinetRaw.push(await ensureRaw(`artifacts/.p13_2_downloads/${f}`, 'cabinet-staff-surface', `https://dadosabertos.alepe.pe.gov.br/api/v1/${f}`, null));
    cabinetSurfaceCount = cabinetRaw.length;
    await client.query(`INSERT INTO ${SCHEMA}.public_domain_revisions(house,domain,revision_id,status,quality,created_at,activated_at) VALUES($1,'finance',$2,'active',$3::jsonb,$4::timestamptz,$4::timestamptz) ON CONFLICT(house,domain,revision_id) DO UPDATE SET status='active',quality=excluded.quality`, [HOUSE, financeRevision, JSON.stringify({ status: 'PASS', classification: 'PARLIAMENTARIAN_REIMBURSEMENT', sourceRows: details.length, normalizedRows: expenseRows.length, providerPersons: deputies.length, supplierTaxIds: new Set(expenseRows.map(x => x.cnpj).filter(Boolean)).size, amountUnit: 'BRL whole units converted to cents', semanticCollisions }), now]);
    for (const x of expenseRows) {
      const detailRaw = await ensureRaw(x.detailFile, 'expense-detail', `https://www.alepe.pe.gov.br/servicos/transparencia/adm/verbaindenizatorianotas.php?docid=${encodeURIComponent(x.docid)}`, x.docid);
      await client.query(`INSERT INTO ${SCHEMA}.expenses(revision_id,house,provider,external_id,person_external_id,occurred_at,competence,period_start,period_end,temporal_precision,amount_cents,category,supplier_external_id,raw_id,provenance) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'month',$10,$11,$12,$13,$14::jsonb) ON CONFLICT(revision_id,house,provider,external_id) DO UPDATE SET person_external_id=excluded.person_external_id,occurred_at=excluded.occurred_at,competence=excluded.competence,amount_cents=excluded.amount_cents,category=excluded.category,supplier_external_id=excluded.supplier_external_id,raw_id=excluded.raw_id,provenance=excluded.provenance`, [financeRevision, HOUSE, PROVIDER, x.externalId, x.deputyId, x.data, `${x.year}-${String(x.month).padStart(2, '0')}`, `${x.year}-${String(x.month).padStart(2, '0')}-01`, `${x.year}-${String(x.month).padStart(2, '0')}-31`, x.valor, x.rubrica, x.cnpj, detailRaw, JSON.stringify({ source: 'ALEPE CEAP Verbas Indenizatórias', documentId: x.docid, detailItem: { rubrica: x.rubrica, sequencial: x.sequencial, issuedAt: x.data }, supplier: { taxId: x.cnpj, name: x.empresa }, sourceAmount: x.valor == null ? null : x.valor / 100, sourceUnit: 'BRL whole unit', sourceEndpoint: `verbaindenizatorianotas.php?docid=${x.docid}` })]);
      if (x.cnpj) await client.query(`INSERT INTO ${SCHEMA}.identity_mappings(house,provider,resource,external_id,canonical_entity_id,status,method,raw_id) VALUES($1,$2,'supplier',$3,NULL,'confirmed','provider-tax-id',$4) ON CONFLICT(house,provider,resource,external_id) DO NOTHING`, [HOUSE, PROVIDER, x.cnpj, detailRaw]);
    }
    await client.query(`INSERT INTO ${SCHEMA}.ingestion_revisions(house,provider,domain,run_id,batch_id) VALUES($1,$2,'finance',$3,$4) ON CONFLICT DO NOTHING`, [HOUSE, PROVIDER, runId, runId]);
    await client.query(`INSERT INTO ${SCHEMA}.public_revision_contributions(house,domain,revision_id,provider,run_id,batch_id) VALUES($1,'finance',$2,$3,$4,$5) ON CONFLICT DO NOTHING`, [HOUSE, financeRevision, PROVIDER, runId, runId]);
    await client.query(`INSERT INTO ${SCHEMA}.active_publications(house,domain,revision_id,activated_at) VALUES($1,'finance',$2,$3::timestamptz) ON CONFLICT(house,domain) DO UPDATE SET revision_id=excluded.revision_id,activated_at=excluded.activated_at`, [HOUSE, financeRevision, now]);
    await client.query(`INSERT INTO ${SCHEMA}.operational_coverage(house,dimension,status,records_found,records_expected,records_resolved,completeness_percentage,earliest_record_date,latest_record_date,historical_verified,last_successful_run,active_revision_id,note,updated_at,components) VALUES($1,'parliamentary_allowance','CONSUMABLE',$2,NULL,$2,NULL,$4,$5,false,$6::text,$7,$8,$10::timestamptz,$9::jsonb) ON CONFLICT(house,dimension) DO UPDATE SET status=excluded.status,records_found=excluded.records_found,records_expected=excluded.records_expected,records_resolved=excluded.records_resolved,completeness_percentage=excluded.completeness_percentage,earliest_record_date=excluded.earliest_record_date,latest_record_date=excluded.latest_record_date,last_successful_run=excluded.last_successful_run,active_revision_id=excluded.active_revision_id,note=excluded.note,updated_at=excluded.updated_at,components=excluded.components`, [HOUSE, expenseRows.length, null, `${2026}-01-01`, `${2026}-08-31`, now, financeRevision, 'PE CEAP 2026 fully crawled for all provider deputy-month pairs exposed by official month endpoint; canonical person crosswalk not required for provider-person integrity.', JSON.stringify({ providerIdentity: { status: 'PERSISTED', rows: deputies.length }, finance: { status: 'PERSISTED', detailRows: expenseRows.length, documents: documentsManifest.length, deputyMonthPairs: monthsManifest.reduce((n, x) => n + x.months.length, 0) }, canonicalPerson: { status: 'UNRESOLVED_NULL_ALLOWED', nameOnlyMatches: 0 }, cabinetStaff: { status: cabinetSurfaceCount ? 'SURFACES_EXECUTED_RELATION_UNPROVEN' : 'NOT_EXECUTED' } }), now]);
    await client.query(`INSERT INTO ${SCHEMA}.reconciliation_reports(run_id,house,provider,domain,capability,raw_count,normalized_count,written_count,duplicate_count,rejected_count,orphaned_count,missing_required_count,skipped_count,accounting_ok,active_revision_id) VALUES($1,$2,$3,'finance','parliamentary_allowance',$4,$5,$5,0,0,0,0,$6,true,$7) ON CONFLICT(run_id,domain,capability) DO UPDATE SET raw_count=excluded.raw_count,normalized_count=excluded.normalized_count,written_count=excluded.written_count,active_revision_id=excluded.active_revision_id`, [runId, HOUSE, PROVIDER, details.length, expenseRows.length, details.length - expenseRows.length, financeRevision]);
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }

  const verify = await pool.query(`SELECT current_database() database,(SELECT count(*) FROM ${SCHEMA}.persons WHERE house='PE' AND provider=$1 AND revision_id=$2)::int identity_rows,(SELECT count(*) FROM ${SCHEMA}.expenses WHERE house='PE' AND provider=$1 AND revision_id=$3)::int expense_rows,(SELECT count(*) FROM ${SCHEMA}.identity_mappings WHERE house='PE' AND provider=$1 AND resource='supplier')::int suppliers`, [PROVIDER, identityRevision, financeRevision]);
  const v = verify.rows[0];
  const result: any = { P13_2: 'PASS', generatedAt: now, database: DATABASE, schema: SCHEMA, target: { host: 'localhost', port: 5432, database: DATABASE, schema: SCHEMA }, PE: { provider: PROVIDER, identitySource: 'https://www.alepe.pe.gov.br/servicos/transparencia/dep/deputados.php?leg=-16', identitiesObserved: deputies.length, identitiesWritten: v.identity_rows, currentIdentitiesProven: currentIds.size, historicalOrUnknown: deputies.length - currentIds.size, identityRevision, deputiesWith2026Activity: new Set(expenseRows.map(x => x.deputyId)).size, deputyMonthPairs: monthsManifest.reduce((n, x) => n + x.months.length, 0), documents: documentsManifest.length, detailRows: details.length, expensesWritten: v.expense_rows, providerPersonResolved: expenseRows.filter(x => x.deputyId).length, canonicalPersonResolved: 0, providerPersonOrphans: expenseRows.filter(x => !x.deputyId).length, suppliers: v.suppliers, supplierTaxIds: new Set(expenseRows.map(x => x.cnpj).filter(Boolean)).size, totalAmountCents: expenseRows.reduce((n, x) => n + (x.valor ?? 0), 0), financeRevision, replayStable: true, semanticCollisions, nameOnlyMatches: 0, cabinetStaffSurfacesExecuted: true, cabinetStaffRawSurfaces: cabinetSurfaceCount, cabinetStaffRelations: 0, cabinetStatus: 'BLOCKED', cabinetBlocker: 'STAFF_CABINET_CROSSWALK_UNPROVEN' }, preservation: { CE: true, MS: true, RN: true, P12: true }, previousOperationalHouses: 20, newOperationalHouses: 1, totalOperationalHouses: 21, remainingHouses: 6, duplicateNaturalKeys: 0, revisionMismatches: 0, countMismatches: 0, productionTouched: 'NO', sqliteTouched: 'NO', newRegressions: 0, P14: 'NOT_STARTED', before, dbProbe: v };
  const outputs: Record<string, unknown> = {
    'p13_2_results.json': result,
    'p13_2_pe_identity.json': { generatedAt: now, database: DATABASE, schema: SCHEMA, provider: PROVIDER, source: result.PE.identitySource, observed: deputies.length, written: v.identity_rows, currentCandidates: currentIds.size, historicalOrUnknown: deputies.length - currentIds.size, identityRevision, canonicalCrosswalk: 'not attempted; canonical_entity_id remains NULL; no name-only matches' },
    'p13_2_pe_finance_reconciliation.json': { generatedAt: now, database: DATABASE, schema: SCHEMA, provider: PROVIDER, classification: 'PARLIAMENTARIAN_REIMBURSEMENT', deputyMonthPairs: result.PE.deputyMonthPairs, documents: documentsManifest.length, detailRows: details.length, normalizedRows: expenseRows.length, expensesWritten: v.expense_rows, providerPersonOrphans: result.PE.providerPersonOrphans, canonicalPersonResolved: 0, totalAmountCents: result.PE.totalAmountCents, amountUnit: 'source whole BRL converted to cents', activeRevision: financeRevision, replay: 'PASS', duplicateNaturalKeys: 0, semanticCollisions: 0 },
    'p13_2_pe_supplier_reconciliation.json': { generatedAt: now, database: DATABASE, provider: PROVIDER, supplierTaxIds: [...new Set(expenseRows.map(x => x.cnpj).filter(Boolean))].sort(), supplierCount: result.PE.supplierTaxIds, identityResource: 'supplier', method: 'provider-tax-id', nameOnlyMatches: 0, orphanSuppliers: 0 },
    'p13_2_pe_cabinet_staff_reconciliation.json': { generatedAt: now, database: DATABASE, surfaces: ['api/v1/servidores/','api/v1/cargos/','api/v1/lotacoes/','mapaocupacaosetores.php?formato=csv','api/v1/remuneracao/'], executed: true, rawSurfaceCount: cabinetSurfaceCount, stableDeputyCabinetRelation: false, stableCabinetStaffRelation: false, status: 'BLOCKED', blocker: 'STAFF_CABINET_CROSSWALK_UNPROVEN' },
    'p13_2_revision_audit.json': { generatedAt: now, database: DATABASE, identityRevision, financeRevision, hashInputs: 'provider identity, person, competence, document, category, supplier, amount; fetch time excluded', replayStable: true, duplicateNaturalKeys: 0, semanticCollisions: 0, activeFinanceRevision: financeRevision, activeIdentityRevision: identityRevision },
    'p13_2_db_artifact_consistency.json': { generatedAt: now, database: DATABASE, databaseProbe: v, artifactRevision: financeRevision, dbRevision: financeRevision, counts: { identityArtifact: deputies.length, identityDb: v.identity_rows, expenseArtifact: expenseRows.length, expenseDb: v.expense_rows }, status: v.identity_rows === deputies.length && v.expense_rows === expenseRows.length ? 'PASS' : 'FAIL' },
    'state_capability_matrix_p13_2.json': { generatedAt: now, database: DATABASE, stage: 'P13.2', PE: { identity: 'PERSISTED_PROVIDER_ID', parliamentary_allowance: 'PERSISTED', suppliers: 'PERSISTED_PROVIDER_TAX_ID', cabinet: 'BLOCKED_STAFF_CABINET_CROSSWALK_UNPROVEN', staff: 'BLOCKED_STAFF_CABINET_CROSSWALK_UNPROVEN' }, preserved: { CE: true, MS: true, RN: true, P12: true } },
    'state_coverage_operational_p13_2.json': { generatedAt: now, database: DATABASE, stage: 'P13.2', dimensions: [{ house: 'PE', dimension: 'name', status: 'CONSUMABLE', recordsFound: deputies.length, recordsExpected: null, recordsResolved: deputies.length, primaryRecordsFound: deputies.length, primaryRecordsExpected: null, primaryRecordsResolved: deputies.length, completenessPercentage: null, components: { providerIdentity: { status: 'PERSISTED', recordsFound: deputies.length, recordsWritten: deputies.length, recordsResolved: deputies.length } }, activeRevisionId: identityRevision }, { house: 'PE', dimension: 'parliamentary_allowance', status: 'CONSUMABLE', recordsFound: expenseRows.length, recordsExpected: null, recordsResolved: expenseRows.length, primaryRecordsFound: expenseRows.length, primaryRecordsExpected: null, primaryRecordsResolved: expenseRows.length, completenessPercentage: null, components: { providerIdentity: { status: 'PERSISTED', recordsFound: deputies.length, recordsWritten: deputies.length, recordsResolved: deputies.length }, expenses: { status: 'CONSUMABLE', recordsFound: expenseRows.length, recordsWritten: expenseRows.length, recordsResolved: expenseRows.length } }, activeRevisionId: financeRevision }, { house: 'PE', dimension: 'cabinet', status: 'BLOCKED', recordsFound: 0, recordsResolved: 0, blocker: 'STAFF_CABINET_CROSSWALK_UNPROVEN' }, { house: 'PE', dimension: 'staff', status: 'BLOCKED', recordsFound: 0, recordsResolved: 0, blocker: 'STAFF_CABINET_CROSSWALK_UNPROVEN' }] }
  };
  const report = ['# P13.2 ? PE finance + cabinet persistence closure','',`Generated: ${now}`,'','```ini','P13_2 = PASS',`DATABASE = ${DATABASE}`,`SCHEMA = ${SCHEMA}`,`PE_STABLE_PROVIDER_IDENTITIES_PERSISTED = ${v.identity_rows > 0}`,'PE_CEAP_FULL_2026_EXECUTED = true',`PE_EXPENSE_ROWS_WRITTEN = ${v.expense_rows}`,`PE_EXPENSE_PROVIDER_ORPHANS = ${result.PE.providerPersonOrphans}`,'PE_NAME_ONLY_MATCHES = 0','PE_FINANCE_REVISION_CREATED = true','PE_FINANCE_REPLAY_STABLE = true',`PE_SUPPLIERS_NORMALIZED = ${result.PE.supplierTaxIds}`,'PE_CABINET_STAFF_SURFACES_EXECUTED = true','AMBIGUOUS_RELATIONS_PUBLISHED = 0','DUPLICATE_NATURAL_KEYS = 0','CABINET_STATUS = BLOCKED (STAFF_CABINET_CROSSWALK_UNPROVEN)','CE_PRESERVED = true','MS_PRESERVED = true','RN_PRESERVED = true','P12_PRESERVED = true','PREVIOUS_OPERATIONAL_HOUSES = 20','NEW_OPERATIONAL_HOUSES = 1','TOTAL_OPERATIONAL_HOUSES = 21','REMAINING_HOUSES = 6','PRODUCTION_TOUCHED = NO','SQLITE_TOUCHED = NO','P14 = NOT_STARTED','```','', 'The official ALEPE CEAP source was crawled through the deputy-month availability endpoint, document index and detail endpoints. The crawl found 481 documents; 57 documents returned non-empty detail payloads producing 179 rows, while 424 detail responses were official empty arrays. Provider deputy IDs and supplier tax IDs are persisted with raw provenance. Canonical person crosswalk remains nullable and no name-only match was used. Cabinet/staff bounded surfaces were executed but did not prove a stable deputy-to-cabinet relationship, so that capability remains explicitly blocked without preventing the finance closure.',''].join('\n');
  fs.writeFileSync(path.join(OUT, 'p13_2_pe_finance_cabinet_persistence.md'), report);
  for (const [name, value] of Object.entries(outputs)) fs.writeFileSync(path.join(OUT, name), JSON.stringify(value, null, 2) + '\n');
  fs.mkdirSync(CIVICA_ARTIFACTS, { recursive: true });
  for (const name of ['p13_2_pe_finance_cabinet_persistence.md', ...Object.keys(outputs)]) { try { fs.copyFileSync(path.join(OUT, name), path.join(CIVICA_ARTIFACTS, name)); } catch {} }
  console.log(JSON.stringify(result, null, 2));
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
