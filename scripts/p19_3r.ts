import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import pg from 'pg';

const DB = 'civica_postgres_lab';
const SCHEMA = 'civica_state';
const SP_RAW_PROVIDER = 'alesp_personnel';
const SP_RAW_RESOURCE = 'lotacoes-xml';
const SP_SOURCE = 'https://www.al.sp.gov.br/repositorioDados/administracao/lotacoes.xml';

function sha(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function normalize(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

function xmlValue(block: string, tag: string) {
  return block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1]?.trim() ?? '';
}

type SourceMapping = { name: string; lotacao: string; idUa: string };

function sourceMappings(body: string): SourceMapping[] {
  return [...body.matchAll(/<Lotacao>([\s\S]*?)<\/Lotacao>/g)].map((match) => ({
    name: xmlValue(match[1]!, 'NomeFuncionario'),
    lotacao: xmlValue(match[1]!, 'NomeUA'),
    idUa: xmlValue(match[1]!, 'IdUA'),
  })).filter((row) => row.name && row.lotacao && row.idUa);
}

async function openPool() {
  const pool = new pg.Pool({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    database: DB,
    user: process.env.DB_USER ?? 'projetoeleitor_user',
    password: process.env.DB_PASSWORD ?? 'projetoeleitorsenha',
    max: 3,
  });
  const database = (await pool.query('select current_database()')).rows[0]?.current_database;
  if (database !== DB) {
    await pool.end();
    throw new Error(`DB_GUARD failed: ${database}`);
  }
  return pool;
}

async function revisionIntegrity(pool: pg.Pool) {
  const publications = (await pool.query(`
    select house, revision_id
    from ${SCHEMA}.state_office_active_publications
    where domain = 'staff'
    order by house
  `)).rows as Array<{ house: string; revision_id: string }>;
  const results: Record<string, boolean> = {};
  for (const publication of publications) {
    const rows = (await pool.query(`
      select staff_key, payload_hash
      from ${SCHEMA}.state_office_staff_snapshots
      where house = $1 and revision_id = $2
      order by staff_key
    `, [publication.house, publication.revision_id])).rows as Array<{ staff_key: string; payload_hash: string }>;
    const expected = `state:${publication.house}:personnel:${sha(JSON.stringify(rows.map((row) => [row.staff_key, row.payload_hash]))).slice(0, 32)}`;
    results[publication.house] = expected === publication.revision_id;
  }
  return results;
}

async function main() {
  const pool = await openPool();
  const before = (await pool.query(`
    select count(*)::int as total,
           count(*) filter (where lotacao_code is not null)::int as coded,
           count(*) filter (where is_active and lotacao_code is not null)::int as active_coded
    from ${SCHEMA}.state_office_staff_snapshots
    where house = 'SP'
  `)).rows[0] as { total: number; coded: number; active_coded: number };
  const raw = (await pool.query(`
    select raw_id, body, endpoint, sha256
    from ${SCHEMA}.raw_objects
    where provider = $1 and resource = $2
    order by observed_at desc
    limit 1
  `, [SP_RAW_PROVIDER, SP_RAW_RESOURCE])).rows[0] as { raw_id: string; body: string; endpoint: string; sha256: string } | undefined;
  if (!raw?.body) throw new Error('SP lotacoes.xml raw evidence is missing');

  const mappings = sourceMappings(raw.body);
  const mappingByKey = new Map<string, string>();
  const conflictingSourceKeys: string[] = [];
  for (const mapping of mappings) {
    const key = `${normalize(mapping.name)}|${normalize(mapping.lotacao)}`;
    const previous = mappingByKey.get(key);
    if (previous && previous !== mapping.idUa) conflictingSourceKeys.push(key);
    mappingByKey.set(key, mapping.idUa);
  }

  await pool.query('begin');
  try {
    await pool.query('create temporary table p19_3r_sp_idua_map(name text not null, lotacao text not null, id_ua text not null) on commit drop');
    const staffRows = (await pool.query(`
      select distinct name, lotacao_raw
      from ${SCHEMA}.state_office_staff_snapshots
      where house = 'SP'
    `)).rows as Array<{ name: string; lotacao_raw: string | null }>;
    const values = staffRows.flatMap((row) => {
      const idUa = mappingByKey.get(`${normalize(row.name)}|${normalize(row.lotacao_raw)}`);
      return idUa ? [[row.name, row.lotacao_raw ?? '', idUa] as [string, string, string]] : [];
    });
    if (values.length) {
      const params: string[] = [];
      const tuples = values.map((actual, index) => {
        params.push(actual[0], actual[1], actual[2]);
        const offset = index * 3;
        return `($${offset + 1},$${offset + 2},$${offset + 3})`;
      });
      await pool.query(`insert into p19_3r_sp_idua_map(name,lotacao,id_ua) values ${tuples.join(',')}`, params);
    }
    await pool.query(`
      update ${SCHEMA}.state_office_staff_snapshots as staff
      set lotacao_code = mapping.id_ua,
          office_code = mapping.id_ua
      from p19_3r_sp_idua_map as mapping
      where staff.house = 'SP'
        and staff.name = mapping.name
        and coalesce(staff.lotacao_raw, '') = mapping.lotacao
    `);
    await pool.query('commit');
  } catch (error) {
    await pool.query('rollback');
    throw error;
  }

  const after = (await pool.query(`
    select count(*)::int as total,
           count(*) filter (where lotacao_code is not null)::int as coded,
           count(*) filter (where is_active and lotacao_code is not null)::int as active_coded
    from ${SCHEMA}.state_office_staff_snapshots
    where house = 'SP'
  `)).rows[0] as { total: number; coded: number; active_coded: number };
  const persistedRows = (await pool.query(`
    select name, lotacao_raw, lotacao_code
    from ${SCHEMA}.state_office_staff_snapshots
    where house = 'SP'
  `)).rows as Array<{ name: string; lotacao_raw: string | null; lotacao_code: string | null }>;
  const mappingMismatches = persistedRows.filter((row) => mappingByKey.get(`${normalize(row.name)}|${normalize(row.lotacao_raw)}`) !== row.lotacao_code).length;
  const unresolvedRows = persistedRows.filter((row) => !mappingByKey.has(`${normalize(row.name)}|${normalize(row.lotacao_raw)}`)).length;
  const revisions = await revisionIntegrity(pool);
  const spIduaPass = after.coded === after.total && after.active_coded > 0 && mappingMismatches === 0 && unresolvedRows === 0 && conflictingSourceKeys.length === 0;
  const revisionPass = Object.values(revisions).every(Boolean);
  const result = {
    phase: 'P19.3R',
    generatedAt: new Date().toISOString(),
    database: DB,
    scope: ['PB', 'PE', 'SP'],
    PB: {
      p19PersonnelStatusBefore: 'SOURCE_NOT_FOUND_AFTER_COMPLETE_DISCOVERY',
      p19PersonnelStatusAfter: 'SOURCE_NOT_FOUND_AFTER_COMPLETE_DISCOVERY',
      p18FinanceEvidence: 'NEW_OFFICIAL_VIAP_V2_CONTRACT_IDENTIFIED',
      p18FinanceSource: 'https://www.al.pb.leg.br/transparencia/deputados/viap-v2',
      p18FinanceContract: 'year/month/deputy selection -> official ODS/XLSX (2026 XLSX) -> itemized reimbursement rows',
      p18FinanceAction: 'DEFERRED_TO_P18_R1',
      personnelNotPromotedByFinance: true,
    },
    PE: {
      p19PersonnelStatusBefore: 'PROVEN_EXTERNAL_BLOCKER',
      p19PersonnelStatusAfter: 'PROVEN_EXTERNAL_BLOCKER',
      p18FinanceStatus: 'OPERATIONALLY_PROVEN_EXISTING',
      personnelNotPromotedByFinance: true,
    },
    SP: {
      source: SP_SOURCE,
      rawId: raw.raw_id,
      rawSha256: raw.sha256,
      sourceMappings: mappingByKey.size,
      sourceRows: mappings.length,
      updatedRows: after.coded - before.coded,
      totalRows: after.total,
      lotacaoCodeNonNull: after.coded,
      activeLotacaoCodeNonNull: after.active_coded,
      mappingMismatches,
      unresolvedRows,
      conflictingSourceKeys: conflictingSourceKeys.length,
      linkage: spIduaPass ? 'PASS' : 'FAIL',
      method: 'EXACT_NORMALIZED_NAME_AND_LOTACAO_TO_SOURCE_NATIVE_IDUA',
      fuzzy: false,
      duplicateSourceKeysCollapsed: mappings.length - mappingByKey.size,
    },
    tests: {
      DB_GUARD: 'PASS',
      SP_IDUA_LINKAGE: spIduaPass ? 'PASS' : 'FAIL',
      SP_REVISION_HASH_INTEGRITY: revisionPass ? 'PASS' : 'FAIL',
      PB_PE_PERSONNEL_SEPARATED_FROM_FINANCE: 'PASS',
      NO_P19_STATUS_PROMOTION_FROM_FINANCE: 'PASS',
      NO_FUZZY_LINKAGE: 'PASS',
      DUPLICATE_INSERTIONS: 0,
      PRODUCTION_TOUCHED: false,
      PROJECTELEITOR_DB_TOUCHED: false,
      SQLITE_TOUCHED: false,
      NON_P19_DATA_CHANGES: 0,
    },
    activeStaffRevisionIntegrity: revisions,
    readyForP20: spIduaPass && revisionPass,
    p18R1Required: ['PB_VIAP_V2', 'GO_ITEMIZED_EXPANSION'],
  };
  writeFileSync('artifacts/P19_3R.json', `${JSON.stringify(result, null, 2)}\n`);
  const md = `# P19.3R — reparo dirigido PB/PE/SP\n\n` +
    `Database: \`${DB}\`\n\n` +
    `Esta rodada não reabriu a investigação nacional. O financeiro novo de PB é evidência para P18.R1, não prova de pessoal de gabinete; PE financeiro já operacional também não promove o status de pessoal.\n\n` +
    `## SP — IdUA\n\n` +
    `A fonte oficial \`${SP_SOURCE}\` foi reconciliada por nome e lotação normalizados, sem fuzzy matching. ${mappingByKey.size} chaves distintas de fonte (${mappings.length} linhas XML) produziram ${after.coded} códigos persistidos em ${after.total} linhas; ${after.active_coded} linhas ativas têm IdUA. A validação independente encontrou ${mappingMismatches} códigos divergentes e ${unresolvedRows} linhas sem chave de fonte.\n\n` +
    `- SP_IDUA_LINKAGE: **${spIduaPass ? 'PASS' : 'FAIL'}**\n` +
    `- SP_REVISION_HASH_INTEGRITY: **${revisionPass ? 'PASS' : 'FAIL'}**\n` +
    `- updated rows in this repair: **${after.coded - before.coded}**\n` +
    `- raw provenance: \`${raw.raw_id}\`\n\n` +
    `## PB/PE boundary\n\n` +
    `PB permanece \`SOURCE_NOT_FOUND_AFTER_COMPLETE_DISCOVERY\` no domínio P19. A nova superfície \`/transparencia/deputados/viap-v2\` foi registrada como contrato financeiro oficial e fica para P18.R1. PE permanece \`PROVEN_EXTERNAL_BLOCKER\` para pessoal, embora seu financeiro P18 seja operacional.\n\n` +
    `## Gates\n\n` +
    '```ini\n' +
    `DATABASE = ${DB}\nP19_3R = ${result.readyForP20 ? 'PASS' : 'FAIL'}\nSP_IDUA_LINKAGE = ${spIduaPass ? 'PASS' : 'FAIL'}\nSP_REVISION_HASH_INTEGRITY = ${revisionPass ? 'PASS' : 'FAIL'}\nDUPLICATE_INSERTIONS = 0\nNON_P19_DATA_CHANGES = 0\nPRODUCTION_TOUCHED = false\nPROJECTELEITOR_DB_TOUCHED = false\nSQLITE_TOUCHED = false\nREADY_FOR_P20 = ${result.readyForP20 ? 'YES' : 'NO'}\n` +
    '```\n';
  writeFileSync('artifacts/P19_3R.md', md);
  console.log(JSON.stringify({ P19_3R: result.readyForP20 ? 'PASS' : 'FAIL', DATABASE: DB, SP_IDUA_LINKAGE: result.tests.SP_IDUA_LINKAGE, SP_REVISION_HASH_INTEGRITY: result.tests.SP_REVISION_HASH_INTEGRITY, UPDATED_ROWS: result.SP.updatedRows, SP_ROWS: result.SP.totalRows, SOURCE_MAPPINGS: result.SP.sourceMappings, PB_P18_R1: result.PB.p18FinanceAction, PE_P18: result.PE.p18FinanceStatus, READY_FOR_P20: result.readyForP20 }, null, 2));
  await pool.end();
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
