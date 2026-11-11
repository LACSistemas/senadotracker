import type { Pool } from 'pg';

export const JUDICIARY_SCHEMA = 'civica_jud';
export const JUDICIARY_DATABASE = process.env.CIVICA_JUDICIARY_DATABASE ?? process.env.DB_NAME ?? 'projetoeleitor_db';

/** P14.1 institutional foundation. No process or DataJud tables are defined here. */
export const JUDICIARY_SCHEMA_SQL = [
  `CREATE SCHEMA IF NOT EXISTS ${JUDICIARY_SCHEMA}`,
  `CREATE TABLE IF NOT EXISTS ${JUDICIARY_SCHEMA}.schema_migrations (version text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS ${JUDICIARY_SCHEMA}.jud_branch (
    branch_id text PRIMARY KEY, code text NOT NULL UNIQUE, name text NOT NULL, institutional_kind text NOT NULL,
    source_url text NOT NULL, source_ref text NOT NULL, status text NOT NULL CHECK (status IN ('ACTIVE','CONTROL','DOCUMENTED')),
    valid_from date NOT NULL DEFAULT '1900-01-01', valid_to date, provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
    CHECK (valid_to IS NULL OR valid_to > valid_from)
  )`,
  `CREATE TABLE IF NOT EXISTS ${JUDICIARY_SCHEMA}.jud_degree (
    degree_id text PRIMARY KEY, code text NOT NULL UNIQUE, name text NOT NULL, description text,
    source_url text NOT NULL, provenance jsonb NOT NULL DEFAULT '{}'::jsonb
  )`,
  `CREATE TABLE IF NOT EXISTS ${JUDICIARY_SCHEMA}.jud_tribunal (
    tribunal_id text PRIMARY KEY, sigla text NOT NULL UNIQUE, official_name text NOT NULL, branch_id text NOT NULL REFERENCES ${JUDICIARY_SCHEMA}.jud_branch(branch_id),
    institutional_level text NOT NULL, cnj_code text, source_system text NOT NULL, source_alias text,
    seat_uf char(2), status text NOT NULL CHECK (status IN ('ACTIVE','CONTROL','DOCUMENTED')),
    match_status text NOT NULL CHECK (match_status IN ('EXACT_OFFICIAL','OFFICIAL_CROSS_REFERENCE','DOCUMENT_VERIFIED','CANDIDATE_ONLY','AMBIGUOUS','UNRESOLVED')),
    valid_from date NOT NULL DEFAULT '1900-01-01', valid_to date, source_url text NOT NULL,
    provenance jsonb NOT NULL DEFAULT '{}'::jsonb, UNIQUE (source_system, source_alias),
    CHECK (valid_to IS NULL OR valid_to > valid_from)
  )`,
  `CREATE TABLE IF NOT EXISTS ${JUDICIARY_SCHEMA}.jud_tribunal_version (
    tribunal_id text NOT NULL REFERENCES ${JUDICIARY_SCHEMA}.jud_tribunal(tribunal_id), revision_id text NOT NULL,
    official_name text NOT NULL, sigla text NOT NULL, status text NOT NULL, source_hash text NOT NULL,
    observed_at timestamptz NOT NULL, provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (tribunal_id, revision_id)
  )`,
  `CREATE TABLE IF NOT EXISTS ${JUDICIARY_SCHEMA}.jud_unit (
    unit_id text PRIMARY KEY, tribunal_id text NOT NULL REFERENCES ${JUDICIARY_SCHEMA}.jud_tribunal(tribunal_id), degree_id text REFERENCES ${JUDICIARY_SCHEMA}.jud_degree(degree_id),
    source_system text NOT NULL, source_entity_type text NOT NULL, source_id text NOT NULL, official_name text NOT NULL,
    unit_type text, source_parent_id text, physical_municipality_source_code text, physical_municipality_source_system text,
    physical_entity_id integer REFERENCES civica_exec.exec_entity(entity_id), physical_uf char(2), active boolean,
    match_status text NOT NULL CHECK (match_status IN ('EXACT_OFFICIAL','OFFICIAL_CROSS_REFERENCE','DOCUMENT_VERIFIED','CANDIDATE_ONLY','AMBIGUOUS','UNRESOLVED')),
    valid_from date NOT NULL DEFAULT '1900-01-01', valid_to date, source_url text NOT NULL, raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (source_system, source_entity_type, source_id), CHECK (valid_to IS NULL OR valid_to > valid_from)
  )`,
  `CREATE TABLE IF NOT EXISTS ${JUDICIARY_SCHEMA}.jud_unit_version (
    unit_id text NOT NULL REFERENCES ${JUDICIARY_SCHEMA}.jud_unit(unit_id), revision_id text NOT NULL, official_name text NOT NULL,
    source_parent_id text, physical_municipality_source_code text, active boolean, source_hash text NOT NULL, observed_at timestamptz NOT NULL,
    provenance jsonb NOT NULL DEFAULT '{}'::jsonb, PRIMARY KEY (unit_id, revision_id)
  )`,
  `CREATE INDEX IF NOT EXISTS jud_unit_tribunal_idx ON ${JUDICIARY_SCHEMA}.jud_unit(tribunal_id, active)`,
  `CREATE INDEX IF NOT EXISTS jud_unit_municipality_idx ON ${JUDICIARY_SCHEMA}.jud_unit(physical_entity_id, physical_municipality_source_system)`,
  `CREATE TABLE IF NOT EXISTS ${JUDICIARY_SCHEMA}.jud_external_id (
    external_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, entity_type text NOT NULL, canonical_id text NOT NULL,
    source_system text NOT NULL, source_entity_type text NOT NULL, source_id text NOT NULL, valid_from date NOT NULL DEFAULT '1900-01-01', valid_to date,
    match_status text NOT NULL CHECK (match_status IN ('EXACT_OFFICIAL','OFFICIAL_CROSS_REFERENCE','DOCUMENT_VERIFIED','CANDIDATE_ONLY','AMBIGUOUS','UNRESOLVED')),
    evidence text NOT NULL, revision_id text NOT NULL, UNIQUE (entity_type, canonical_id, source_system, source_entity_type, source_id, revision_id),
    CHECK (valid_to IS NULL OR valid_to > valid_from)
  )`,
  `CREATE TABLE IF NOT EXISTS ${JUDICIARY_SCHEMA}.jud_territorial_relation (
    relation_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, relation_kind text NOT NULL,
    tribunal_id text REFERENCES ${JUDICIARY_SCHEMA}.jud_tribunal(tribunal_id), unit_id text REFERENCES ${JUDICIARY_SCHEMA}.jud_unit(unit_id),
    source_system text NOT NULL, source_relation_id text NOT NULL, territory_source_code text, territory_entity_id integer REFERENCES civica_exec.exec_entity(entity_id),
    territory_name text, valid_from date NOT NULL DEFAULT '1900-01-01', valid_to date, match_status text NOT NULL,
    revision_id text NOT NULL, evidence text NOT NULL, raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (relation_kind, source_system, source_relation_id, revision_id), CHECK (valid_to IS NULL OR valid_to > valid_from),
    CHECK (tribunal_id IS NOT NULL OR unit_id IS NOT NULL)
  )`,
  `CREATE INDEX IF NOT EXISTS jud_territory_unit_idx ON ${JUDICIARY_SCHEMA}.jud_territorial_relation(unit_id, relation_kind)`,
  `CREATE TABLE IF NOT EXISTS ${JUDICIARY_SCHEMA}.jud_source_snapshot (
    snapshot_id text PRIMARY KEY, provider text NOT NULL, resource_name text NOT NULL, source_url text NOT NULL,
    fetched_at timestamptz NOT NULL, http_status integer NOT NULL, content_type text, bytes bigint NOT NULL, sha256 text NOT NULL UNIQUE,
    raw_path text NOT NULL, parser_version text NOT NULL, source_updated_at timestamptz, source_rows integer NOT NULL,
    parsed_rows integer NOT NULL, rejected_rows integer NOT NULL, duplicate_rows integer NOT NULL, status text NOT NULL,
    details jsonb NOT NULL DEFAULT '{}'::jsonb
  )`,
  `CREATE TABLE IF NOT EXISTS ${JUDICIARY_SCHEMA}.jud_publication_revision (
    revision_id text PRIMARY KEY, scope text NOT NULL, snapshot_ids jsonb NOT NULL, semantic_hash text NOT NULL,
    row_count integer NOT NULL, state text NOT NULL CHECK (state IN ('STAGED','ACTIVE','REJECTED')),
    is_active boolean NOT NULL DEFAULT false, last_known_good boolean NOT NULL DEFAULT false, previous_revision_id text,
    created_at timestamptz NOT NULL, activated_at timestamptz, provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (scope, semantic_hash)
  )`,
  `CREATE INDEX IF NOT EXISTS jud_publication_active_idx ON ${JUDICIARY_SCHEMA}.jud_publication_revision(scope, is_active, created_at DESC)`,
];

export async function ensureJudiciarySchema(pool: Pool): Promise<void> {
  const db = (await pool.query<{ current_database: string }>('SELECT current_database()')).rows[0]?.current_database;
  if (db !== JUDICIARY_DATABASE) throw new Error(`P14.1 database guard refused ${db ?? '<unknown>'}`);
  for (const sql of JUDICIARY_SCHEMA_SQL) await pool.query(sql);
}

export async function getJudiciaryBranches(pool: Pool) {
  return (await pool.query(`SELECT * FROM ${JUDICIARY_SCHEMA}.jud_branch ORDER BY code`)).rows;
}

export async function getJudiciaryTribunals(pool: Pool, filters: { branchCode?: string; uf?: string } = {}) {
  const params: string[] = []; const where: string[] = [];
  if (filters.branchCode) { params.push(filters.branchCode); where.push(`b.code=$${params.length}`); }
  if (filters.uf) { params.push(filters.uf); where.push(`t.seat_uf=$${params.length}`); }
  return (await pool.query(`SELECT t.*,b.code AS branch_code,b.name AS branch_name FROM ${JUDICIARY_SCHEMA}.jud_tribunal t JOIN ${JUDICIARY_SCHEMA}.jud_branch b ON b.branch_id=t.branch_id ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY t.sigla`, params)).rows;
}

export async function getJudiciaryTribunalDetail(pool: Pool, tribunalId: string) {
  const tribunal = (await pool.query(`SELECT * FROM ${JUDICIARY_SCHEMA}.jud_tribunal WHERE tribunal_id=$1`, [tribunalId])).rows[0] ?? null;
  if (!tribunal) return null;
  const [units, ids, revisions] = await Promise.all([
    pool.query(`SELECT * FROM ${JUDICIARY_SCHEMA}.jud_unit WHERE tribunal_id=$1 ORDER BY official_name`, [tribunalId]),
    pool.query(`SELECT * FROM ${JUDICIARY_SCHEMA}.jud_external_id WHERE entity_type='TRIBUNAL' AND canonical_id=$1 ORDER BY source_system`, [tribunalId]),
    pool.query(`SELECT * FROM ${JUDICIARY_SCHEMA}.jud_tribunal_version WHERE tribunal_id=$1 ORDER BY observed_at DESC`, [tribunalId]),
  ]);
  return { tribunal, units: units.rows, externalIds: ids.rows, versions: revisions.rows };
}

export async function getJudiciaryUnits(pool: Pool, filters: { tribunalId?: string; provider?: string; active?: boolean } = {}) {
  const params: unknown[] = []; const where: string[] = [];
  if (filters.tribunalId) { params.push(filters.tribunalId); where.push(`tribunal_id=$${params.length}`); }
  if (filters.provider) { params.push(filters.provider); where.push(`source_system=$${params.length}`); }
  if (filters.active !== undefined) { params.push(filters.active); where.push(`active=$${params.length}`); }
  return (await pool.query(`SELECT * FROM ${JUDICIARY_SCHEMA}.jud_unit ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY official_name`, params)).rows;
}

export async function getJudiciaryUnitDetail(pool: Pool, unitId: string) {
  const unit = (await pool.query(`SELECT * FROM ${JUDICIARY_SCHEMA}.jud_unit WHERE unit_id=$1`, [unitId])).rows[0] ?? null;
  if (!unit) return null;
  const [ids, relations, versions] = await Promise.all([
    pool.query(`SELECT * FROM ${JUDICIARY_SCHEMA}.jud_external_id WHERE entity_type='UNIT' AND canonical_id=$1 ORDER BY source_system`, [unitId]),
    pool.query(`SELECT * FROM ${JUDICIARY_SCHEMA}.jud_territorial_relation WHERE unit_id=$1 ORDER BY relation_kind,territory_name`, [unitId]),
    pool.query(`SELECT * FROM ${JUDICIARY_SCHEMA}.jud_unit_version WHERE unit_id=$1 ORDER BY observed_at DESC`, [unitId]),
  ]);
  return { unit, externalIds: ids.rows, territorialRelations: relations.rows, versions: versions.rows };
}

export async function getJudiciaryUnitsByPhysicalMunicipality(pool: Pool, physicalEntityId: number) {
  return (await pool.query(`SELECT * FROM ${JUDICIARY_SCHEMA}.jud_unit WHERE physical_entity_id=$1 ORDER BY official_name`, [physicalEntityId])).rows;
}

export async function getJudiciaryJurisdiction(pool: Pool, canonicalId: string) {
  return (await pool.query(`SELECT * FROM ${JUDICIARY_SCHEMA}.jud_territorial_relation WHERE unit_id=$1 OR tribunal_id=$1 ORDER BY relation_kind,territory_name`, [canonicalId])).rows;
}

export async function getJudiciaryInstitutionalCoverage(pool: Pool) {
  return (await pool.query(`
    SELECT t.sigla,t.official_name,b.code AS branch_code,count(u.unit_id)::int AS unit_count,
      count(*) FILTER (WHERE u.physical_municipality_source_code IS NOT NULL)::int AS physical_source_count,
      count(*) FILTER (WHERE u.physical_entity_id IS NOT NULL)::int AS physical_ibge_count,
      count(*) FILTER (WHERE tr.relation_id IS NOT NULL AND tr.relation_kind='JURISDICTION_TERRITORY')::int AS jurisdiction_count
    FROM ${JUDICIARY_SCHEMA}.jud_tribunal t JOIN ${JUDICIARY_SCHEMA}.jud_branch b ON b.branch_id=t.branch_id
    LEFT JOIN ${JUDICIARY_SCHEMA}.jud_unit u ON u.tribunal_id=t.tribunal_id
    LEFT JOIN ${JUDICIARY_SCHEMA}.jud_territorial_relation tr ON tr.unit_id=u.unit_id
    GROUP BY t.sigla,t.official_name,b.code ORDER BY t.sigla
  `)).rows;
}
