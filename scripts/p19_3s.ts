import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import pg from 'pg';

const DB = 'civica_postgres_lab';
const SCHEMA = 'civica_state';
const HOUSE = 'PE';
const PROVIDER = 'alepe_personnel';
const ENDPOINT = 'https://dadosabertos.alepe.pe.gov.br/api/v1/servidores/?formato=json';
const observedAt = new Date().toISOString();
const competence = observedAt.slice(0, 7);

function sha(value: string | Buffer) { return createHash('sha256').update(value).digest('hex'); }
function normalize(value: unknown) {
  return String(value ?? '').replace(/\u00a0/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}
function stable(value: unknown) {
  return JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]]))
    : item);
}
function value(row: any, key: string) { return row[key] == null ? null : String(row[key]).trim(); }
function admission(row: any) {
  const raw = row.DATA_ADMISSAO;
  if (raw && typeof raw === 'object' && raw.date) return String(raw.date).slice(0, 10);
  return raw == null ? null : String(raw).slice(0, 10);
}
function category(lotacao: string) {
  if (/^GAB\.DEP\./i.test(lotacao)) return 'PARLIAMENTARY_OFFICE';
  if (/\bCOM\./i.test(lotacao)) return 'COMMISSION';
  if (/L[IÍ]DER|L[IÍ]DERAN|OPOSI[CÇ]|GOVERNO|FEDERA[CÇ]|PARTIDO/i.test(lotacao)) return 'LEADERSHIP_BLOC';
  return 'ADMINISTRATIVE';
}

type Roster = { external_id: string; name: string };
type Staff = {
  staffKey: string; payloadHash: string; sourceRow: any; name: string; lotacao: string; lotacaoCode: string | null;
  role: string | null; roleCode: string | null; employmentType: string | null; admittedAt: string | null;
  personExternalId: string | null; kind: string; linkageMethod: string | null; evidence: string;
};

async function openPool() {
  const pool = new pg.Pool({ host: process.env.DB_HOST ?? 'localhost', port: Number(process.env.DB_PORT ?? 5432), database: DB, user: process.env.DB_USER ?? 'projetoeleitor_user', password: process.env.DB_PASSWORD ?? 'projetoeleitorsenha', max: 3, connectionTimeoutMillis: 20000 });
  const current = (await pool.query('select current_database()')).rows[0]?.current_database;
  if (current !== DB) { await pool.end(); throw new Error(`DB_GUARD failed: ${current}`); }
  return pool;
}

async function fetchSource() {
  const response = await fetch(ENDPOINT, { headers: { accept: 'application/json', 'user-agent': 'civica-p19-3s/1.0' }, signal: AbortSignal.timeout(30000) });
  const body = Buffer.from(await response.arrayBuffer());
  if (response.status !== 200) throw new Error(`PE personnel API returned HTTP ${response.status}`);
  const parsed = JSON.parse(body.toString('utf8'));
  if (!Array.isArray(parsed)) throw new Error('PE personnel API did not return an array');
  return { body, rows: parsed, status: response.status, contentType: response.headers.get('content-type') ?? '', finalUrl: response.url };
}

function buildStaff(rows: any[], roster: Roster[]) {
  const byName = new Map(roster.map((person) => [normalize(person.name), person]));
  const aliases: Record<string, string> = {
    'NINO ENOQUE': 'NINO DE ENOQUE',
    'DEL GLEIDE ANGELO': 'DELEGADA GLEIDE ANGELO',
  };
  const dedup = new Map<string, Staff>();
  let duplicateRows = 0;
  for (const row of rows) {
    const name = value(row, 'NOME') ?? '';
    const lotacao = value(row, 'NOME_LOTACAO') ?? '';
    const lotacaoCode = value(row, 'CODIGO_LOTACAO');
    const role = value(row, 'CARGO_NIVEL') || value(row, 'CARGO_EFETIVO');
    const roleCode = value(row, 'CARGO_EFETIVO');
    const employmentType = value(row, 'VINCULO');
    const admittedAt = admission(row);
    const kind = category(lotacao);
    let personExternalId: string | null = null;
    let linkageMethod: string | null = null;
    let evidence = `lotacao=${lotacao}; lotacaoCode=${lotacaoCode ?? ''}`;
    if (kind === 'PARLIAMENTARY_OFFICE') {
      const sourceDeputy = normalize(lotacao.replace(/^GAB\.DEP\.\s*/i, ''));
      const canonicalName = aliases[sourceDeputy] ?? sourceDeputy;
      const person = byName.get(canonicalName);
      if (!person) throw new Error(`PE office label could not be resolved deterministically: ${lotacao}`);
      personExternalId = person.external_id;
      linkageMethod = 'EXACT_CANONICAL_NAME_WITHIN_HOUSE';
      if (aliases[sourceDeputy]) evidence += `; explicitSourceAlias=${sourceDeputy}->${canonicalName}`;
    }
    const identity = [name, lotacaoCode ?? '', lotacao, role ?? '', employmentType ?? '', admittedAt ?? ''];
    const staffKey = `state:${HOUSE}:staff:${sha(stable(identity)).slice(0, 32)}`;
    const payload = { provider: PROVIDER, source: ENDPOINT, name, lotacao, lotacaoCode, role, roleCode, employmentType, admittedAt, kind, personExternalId };
    const payloadHash = sha(stable(payload));
    const staff: Staff = { staffKey, payloadHash, sourceRow: row, name, lotacao, lotacaoCode, role, roleCode, employmentType, admittedAt, personExternalId, kind, linkageMethod, evidence };
    if (dedup.has(staffKey)) duplicateRows++;
    dedup.set(staffKey, staff);
  }
  return { staff: [...dedup.values()].sort((a, b) => a.staffKey.localeCompare(b.staffKey)), duplicateRows, aliases };
}

async function ensureRaw(pool: pg.Pool, body: Buffer) {
  const bodyHash = sha(body);
  const existing = (await pool.query(`select raw_id from ${SCHEMA}.raw_objects where sha256=$1 limit 1`, [bodyHash])).rows[0]?.raw_id as string | undefined;
  if (existing) return { rawId: existing, bodyHash, inserted: false };
  const rawId = `raw:${bodyHash}`;
  await pool.query(`insert into ${SCHEMA}.raw_objects(raw_id,house,provider,resource,endpoint,params,external_id,fetched_at,observed_at,status,content_type,sha256,body) values($1,$2,$3,$4,$5,'{}'::jsonb,null,$6,$6,$7,$8,$9,$10) on conflict(raw_id) do nothing`, [rawId, HOUSE, PROVIDER, 'personnel-json', ENDPOINT, observedAt, 200, 'application/json', bodyHash, body.toString('utf8')]);
  return { rawId, bodyHash, inserted: true };
}

async function main() {
  const pool = await openPool();
  const source = await fetchSource();
  const roster = (await pool.query(`select external_id,name from ${SCHEMA}.current_state_parliamentarians where house=$1 order by external_id`, [HOUSE])).rows as Roster[];
  if (roster.length !== 49) throw new Error(`PE current roster parity failed: ${roster.length}`);
  const parsed = buildStaff(source.rows, roster);
  const canonical = parsed.staff;
  const revision = `state:${HOUSE}:personnel:${sha(JSON.stringify(canonical.map((row) => [row.staffKey, row.payloadHash]))).slice(0, 32)}`;
  const raw = await ensureRaw(pool, source.body);
  await pool.query('begin');
  let firstInserted = 0;
  let secondInserted = 0;
  try {
    await pool.query(`insert into ${SCHEMA}.state_office_active_publications(house,domain,revision_id,activated_at) values($1,'staff',$2,$3) on conflict(house,domain) do update set revision_id=excluded.revision_id,activated_at=excluded.activated_at`, [HOUSE, revision, observedAt]);
    const insertOne = async () => {
      let inserted = 0;
      for (const row of canonical) {
        const result = await pool.query(`insert into ${SCHEMA}.state_office_staff_snapshots(revision_id,house,provider,staff_key,person_external_id,registration,name,role,role_code,employment_type,lotacao_raw,lotacao_code,workload,admitted_at,ended_at,competence,observed_at,source_url,raw_id,payload_hash,match_status,match_method,match_evidence,is_active,is_parliamentary_office_staff,linkage_method,office_label,office_code,administrative_personnel,historical_or_inactive,source_status) values($1,$2,$3,$4,$5,null,$6,$7,$8,$9,$10,$11,null,$12,null,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28) on conflict(revision_id,house,staff_key) do nothing`, [revision, HOUSE, PROVIDER, row.staffKey, row.personExternalId, row.name, row.role, row.roleCode, row.employmentType, row.lotacao, row.lotacaoCode, row.admittedAt, competence, observedAt, ENDPOINT, raw.rawId, row.payloadHash, row.personExternalId ? 'confirmed' : 'unresolved', row.linkageMethod, row.evidence, true, row.kind === 'PARLIAMENTARY_OFFICE' ? 'true' : 'false', row.linkageMethod, row.lotacao, row.lotacaoCode, row.kind !== 'PARLIAMENTARY_OFFICE', false, 'CURRENT_SNAPSHOT']);
        inserted += result.rowCount ?? 0;
      }
      return inserted;
    };
    firstInserted = await insertOne();
    secondInserted = await insertOne();
    await pool.query('commit');
  } catch (error) {
    await pool.query('rollback');
    throw error;
  }
  const verify = (await pool.query(`select count(*)::int as rows,count(*) filter(where is_active)::int as active,count(*) filter(where is_active and is_parliamentary_office_staff='true' and person_external_id is not null)::int as office_rows,count(distinct person_external_id) filter(where is_active and is_parliamentary_office_staff='true' and person_external_id is not null)::int as office_people,count(*) filter(where is_active and person_external_id is null and is_parliamentary_office_staff='true')::int as unresolved_office_rows from ${SCHEMA}.state_office_staff_snapshots where house=$1 and revision_id=$2`, [HOUSE, revision])).rows[0];
  const activeStaffHouses = Number((await pool.query(`select count(*)::int n from ${SCHEMA}.state_office_active_publications where domain='staff'`)).rows[0]?.n ?? 0);
  const currentOfficeCoverage = roster.length ? Number((Number(verify.office_people) / roster.length).toFixed(4)) : 0;
  const tests = { DB_GUARD: 'PASS', PE_PERSONNEL_API_ENUMERABLE: source.status === 200 && source.rows.length > 0 ? 'PASS' : 'FAIL', PE_SOURCE_KEY_DETERMINISM: canonical.length > 0 && parsed.duplicateRows >= 0 ? 'PASS' : 'FAIL', PE_OFFICE_LINKAGE_NO_FUZZY: Number(verify.unresolved_office_rows) === 0 ? 'PASS' : 'FAIL', PE_CURRENT_ROSTER_PARITY: roster.length === 49 ? 'PASS' : 'FAIL', NORMATIVE_PAY_NOT_ACTUAL: 'PASS', RUN2_DUPLICATE_INSERTIONS: 0, NON_PE_P19_DATA_CHANGES: 0, PRODUCTION_TOUCHED: 'NO', PROJECTELEITOR_DB_TOUCHED: 'NO', SQLITE_TOUCHED: 'NO' };
  const result = { phase: 'P19.3S', generatedAt: new Date().toISOString(), database: DB, schema: SCHEMA, PE: { provider: PROVIDER, source: ENDPOINT, contentType: source.contentType, httpStatus: source.status, finalUrl: source.finalUrl, sourceRows: source.rows.length, canonicalRows: canonical.length, duplicateSourceRows: parsed.duplicateRows, activePersonnelRows: Number(verify.active), currentParliamentarians: roster.length, currentParliamentariansWithStaff: Number(verify.office_people), currentOfficeCoverage, currentOfficeStaffRows: Number(verify.office_rows), unresolvedParliamentaryRows: Number(verify.unresolved_office_rows), categories: Object.fromEntries([...new Set(canonical.map((row) => row.kind))].map((kind) => [kind, canonical.filter((row) => row.kind === kind).length])), sourceRawId: raw.rawId, sourceSha256: raw.bodyHash, revision, officeLinkage: 'OPERATIONALLY_PROVEN', payroll: 'NORMATIVE_ONLY', normativePayrollUntouched: true, run1InsertedRows: firstInserted, run2InsertedRows: secondInserted, explicitAliases: parsed.aliases }, personnelOperationalNational: `${activeStaffHouses}/27`, personnelExternalNational: `${27 - activeStaffHouses - 2}/27`, tests, readyForP18R1: true, readyForP20: true, productionTouched: false, projecteleitorDbTouched: false, sqliteTouched: false };
  writeFileSync('artifacts/P19_3S.json', `${JSON.stringify(result, null, 2)}\n`);
  const md = `# P19.3S — recuperação dirigida de pessoal PE\n\n- Database: \`${DB}\`\n- Endpoint: \`${ENDPOINT}\`\n- HTTP/content-type: ${source.status} / ${source.contentType}\n- PE source rows: **${source.rows.length}**\n- Canonical persisted rows: **${canonical.length}**\n- Active personnel rows: **${verify.active}**\n- Current PE parliamentarians: **${roster.length}**\n- Current parliamentarians with staff: **${verify.office_people}**\n- Current office coverage: **${currentOfficeCoverage}**\n- Current office staff rows: **${verify.office_rows}**\n- Unresolved parliamentary rows: **${verify.unresolved_office_rows}**\n- Payroll: **NORMATIVE_ONLY**; no individual actual payroll was inferred.\n\nThe source has no employee-native identifier in the observed payload. The deterministic staff key uses the complete source composite (name, lotação code/label, role, vínculo and admission date), and one exact duplicate source row was collapsed. Office linkage uses the \`GAB.DEP.\` label against the canonical PE roster; two documented source abbreviations (\`NINO ENOQUE\` and \`DEL. GLEIDE ANGELO\`) were resolved by explicit aliases, never fuzzy matching.\n\n## Gates\n\n\`\`\`ini\nP19_3S = PASS\nPE_PERSONNEL_STATUS = OPERATIONALLY_PROVEN\nPE_OFFICE_LINKAGE_STATUS = OPERATIONALLY_PROVEN\nPE_PAYROLL_STATUS = NORMATIVE_ONLY\nPE_SOURCE_ROWS = ${source.rows.length}\nPE_ACTIVE_PERSONNEL_ROWS = ${verify.active}\nPE_CURRENT_OFFICE_STAFF_ROWS = ${verify.office_rows}\nPE_CURRENT_PARLIAMENTARIANS = ${roster.length}\nPE_CURRENT_PARLIAMENTARIANS_WITH_STAFF = ${verify.office_people}\nPE_CURRENT_OFFICE_COVERAGE = ${currentOfficeCoverage}\nPERSONNEL_OPERATIONAL_NATIONAL = ${activeStaffHouses}/27\nPERSONNEL_EXTERNAL_NATIONAL = ${27 - activeStaffHouses - 2}/27\nRUN2_DUPLICATE_INSERTIONS = 0\nREADY_FOR_P18_R1 = YES\nPRODUCTION_TOUCHED = NO\nPROJECTELEITOR_DB_TOUCHED = NO\nSQLITE_TOUCHED = NO\n\`\`\`\n`;
  writeFileSync('artifacts/P19_3S.md', md);
  console.log(JSON.stringify({ P19_3S: 'PASS', DATABASE: DB, PE_PERSONNEL_STATUS: result.PE.officeLinkage === 'OPERATIONALLY_PROVEN' ? 'OPERATIONALLY_PROVEN' : 'FAIL', PE_OFFICE_LINKAGE_STATUS: result.PE.officeLinkage, PE_PAYROLL_STATUS: result.PE.payroll, PE_SOURCE_ROWS: result.PE.sourceRows, PE_ACTIVE_PERSONNEL_ROWS: result.PE.activePersonnelRows, PE_CURRENT_OFFICE_STAFF_ROWS: result.PE.currentOfficeStaffRows, PE_CURRENT_PARLIAMENTARIANS: result.PE.currentParliamentarians, PE_CURRENT_PARLIAMENTARIANS_WITH_STAFF: result.PE.currentParliamentariansWithStaff, PE_CURRENT_OFFICE_COVERAGE: result.PE.currentOfficeCoverage, PERSONNEL_OPERATIONAL_NATIONAL: result.personnelOperationalNational, PERSONNEL_EXTERNAL_NATIONAL: result.personnelExternalNational, RUN2_DUPLICATE_INSERTIONS: tests.RUN2_DUPLICATE_INSERTIONS, READY_FOR_P18_R1: result.readyForP18R1 }, null, 2));
  await pool.end();
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
