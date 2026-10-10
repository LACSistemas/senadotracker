import type { Pool } from 'pg';

export const STATE_BUDGET_SCHEMA = 'civica_state_budget';
export const STATE_BUDGET_DATABASE = process.env.CIVICA_STATE_DATABASE ?? process.env.DB_NAME ?? 'projetoeleitor_db';

/** Additive P23.1 schema.  It never alters civica_budget (federal Pix). */
export const STATE_BUDGET_SCHEMA_SQL = [
  `CREATE SCHEMA IF NOT EXISTS ${STATE_BUDGET_SCHEMA}`,
  `CREATE TABLE IF NOT EXISTS ${STATE_BUDGET_SCHEMA}.collection_runs (run_id text PRIMARY KEY, house text NOT NULL, fiscal_year integer NOT NULL, provider text NOT NULL, status text NOT NULL, started_at timestamptz NOT NULL, finished_at timestamptz, data_through date, source_updated_at timestamptz, counters jsonb NOT NULL DEFAULT '{}'::jsonb, error text)`,
  `CREATE TABLE IF NOT EXISTS ${STATE_BUDGET_SCHEMA}.raw_evidence (raw_id text PRIMARY KEY, house text NOT NULL, provider text NOT NULL, resource text NOT NULL, source_url text NOT NULL, http_status integer NOT NULL, content_type text, fetched_at timestamptz NOT NULL, source_updated_at timestamptz, sha256 text, bytes bigint NOT NULL DEFAULT 0, error text)`,
  `ALTER TABLE ${STATE_BUDGET_SCHEMA}.raw_evidence ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'raw_source'`,
  `CREATE TABLE IF NOT EXISTS ${STATE_BUDGET_SCHEMA}.revisions (revision_id text PRIMARY KEY, house text NOT NULL, fiscal_year integer NOT NULL, provider text NOT NULL, status text NOT NULL CHECK (status IN ('staged','active','rejected')), semantic_hash text NOT NULL, data_through date, source_updated_at timestamptz, raw_hashes jsonb NOT NULL DEFAULT '[]'::jsonb, coverage jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL, activated_at timestamptz, UNIQUE (house,fiscal_year,provider,semantic_hash))`,
  `CREATE TABLE IF NOT EXISTS ${STATE_BUDGET_SCHEMA}.amendments (revision_id text NOT NULL REFERENCES ${STATE_BUDGET_SCHEMA}.revisions(revision_id), house text NOT NULL, fiscal_year integer NOT NULL, source_provider text NOT NULL, source_amendment_key text NOT NULL, source_amendment_number text, source_amendment_type text, canonical_amendment_type text, description text, source_status text, canonical_status text NOT NULL, source_url text NOT NULL, raw_id text NOT NULL, amount_indicated_cents bigint, amount_approved_cents bigint, amount_current_cents bigint, amount_committed_cents bigint, amount_liquidated_cents bigint, amount_paid_cents bigint, amount_outstanding_payable_cents bigint, amount_used_cents bigint, semantic_hash text NOT NULL, provenance jsonb NOT NULL, PRIMARY KEY (revision_id,source_amendment_key))`,
  `CREATE TABLE IF NOT EXISTS ${STATE_BUDGET_SCHEMA}.authors (revision_id text NOT NULL, house text NOT NULL, fiscal_year integer NOT NULL, source_amendment_key text NOT NULL, author_key text NOT NULL, actor_type text NOT NULL, actor_raw text, source_actor_id text, party_raw text, canonical_person_id text, linkage_method text, PRIMARY KEY (revision_id,source_amendment_key,author_key), FOREIGN KEY (revision_id,source_amendment_key) REFERENCES ${STATE_BUDGET_SCHEMA}.amendments(revision_id,source_amendment_key))`,
  `CREATE TABLE IF NOT EXISTS ${STATE_BUDGET_SCHEMA}.destinations (revision_id text NOT NULL, source_amendment_key text NOT NULL, destination_key text NOT NULL, beneficiary_name text, beneficiary_document text, beneficiary_type text, municipality_source_code text, municipality_name text, municipality_ibge_code text, executing_agency text, budget_unit text, program text, action text, subaction text, function_code text, subfunction_code text, expense_group text, expense_element text, object_finality text, PRIMARY KEY (revision_id,source_amendment_key,destination_key), FOREIGN KEY (revision_id,source_amendment_key) REFERENCES ${STATE_BUDGET_SCHEMA}.amendments(revision_id,source_amendment_key))`,
  `CREATE TABLE IF NOT EXISTS ${STATE_BUDGET_SCHEMA}.execution_items (revision_id text NOT NULL, execution_key text NOT NULL, source_amendment_key text, document_number text, commitment_number text, process_number text, occurred_at text, financial_stage text NOT NULL, amount_cents bigint, creditor_document text, creditor_name text, management_unit text, agency text, procurement_type text, procurement_number text, contract_number text, agreement_number text, raw_id text NOT NULL, provenance jsonb NOT NULL, PRIMARY KEY (revision_id,execution_key), FOREIGN KEY (revision_id) REFERENCES ${STATE_BUDGET_SCHEMA}.revisions(revision_id))`,
  `CREATE TABLE IF NOT EXISTS ${STATE_BUDGET_SCHEMA}.active_publications (house text NOT NULL, fiscal_year integer NOT NULL, domain text NOT NULL DEFAULT 'state_budget_amendments', revision_id text NOT NULL REFERENCES ${STATE_BUDGET_SCHEMA}.revisions(revision_id), activated_at timestamptz NOT NULL, PRIMARY KEY (house,fiscal_year,domain))`,
  `CREATE INDEX IF NOT EXISTS state_budget_amendments_author_idx ON ${STATE_BUDGET_SCHEMA}.authors(revision_id,canonical_person_id)`,
  `CREATE INDEX IF NOT EXISTS state_budget_execution_amendment_idx ON ${STATE_BUDGET_SCHEMA}.execution_items(revision_id,source_amendment_key)`,
];

export async function ensureStateBudgetSchema(pool: Pool): Promise<void> {
  const db = (await pool.query<{ current_database: string }>('SELECT current_database()')).rows[0]?.current_database;
  if (db !== STATE_BUDGET_DATABASE) throw new Error(`P23.1 database guard refused ${db ?? '<unknown>'}`);
  for (const sql of STATE_BUDGET_SCHEMA_SQL) await pool.query(sql);
}

export async function getStateBudgetAmendmentsByLegislator(pool: Pool, house: string, fiscalYear: number, canonicalPersonId: string) {
  return (await pool.query(`SELECT a.*, au.canonical_person_id FROM ${STATE_BUDGET_SCHEMA}.amendments a JOIN ${STATE_BUDGET_SCHEMA}.authors au ON au.revision_id=a.revision_id AND au.source_amendment_key=a.source_amendment_key JOIN ${STATE_BUDGET_SCHEMA}.active_publications ap ON ap.revision_id=a.revision_id AND ap.house=a.house AND ap.fiscal_year=a.fiscal_year WHERE a.house=$1 AND a.fiscal_year=$2 AND au.canonical_person_id=$3 ORDER BY a.source_amendment_key`, [house, fiscalYear, canonicalPersonId])).rows;
}

export async function getStateBudgetAmendmentDetail(pool: Pool, house: string, fiscalYear: number, amendmentKey: string) {
  const amendment = (await pool.query(`SELECT a.* FROM ${STATE_BUDGET_SCHEMA}.amendments a JOIN ${STATE_BUDGET_SCHEMA}.active_publications ap ON ap.revision_id=a.revision_id WHERE a.house=$1 AND a.fiscal_year=$2 AND a.source_amendment_key=$3`, [house, fiscalYear, amendmentKey])).rows[0] ?? null;
  if (!amendment) return null;
  const revisionId = String(amendment.revision_id);
  const [authors, destinations, execution] = await Promise.all([
    pool.query(`SELECT * FROM ${STATE_BUDGET_SCHEMA}.authors WHERE revision_id=$1 AND source_amendment_key=$2 ORDER BY author_key`, [revisionId, amendmentKey]),
    pool.query(`SELECT * FROM ${STATE_BUDGET_SCHEMA}.destinations WHERE revision_id=$1 AND source_amendment_key=$2 ORDER BY destination_key`, [revisionId, amendmentKey]),
    pool.query(`SELECT * FROM ${STATE_BUDGET_SCHEMA}.execution_items WHERE revision_id=$1 AND source_amendment_key=$2 ORDER BY execution_key`, [revisionId, amendmentKey]),
  ]);
  return { amendment, authors: authors.rows, destinations: destinations.rows, executionItems: execution.rows };
}

export async function getStateBudgetAmendmentHouseSummary(pool: Pool, house: string, fiscalYear: number) {
  // Finance lives at amendment grain.  Authors and destinations are 1:N
  // relations, so joining them before SUM would multiply every amount.
  return (await pool.query(`
    WITH active_revision AS (
      SELECT revision_id
      FROM ${STATE_BUDGET_SCHEMA}.active_publications
      WHERE house = $1 AND fiscal_year = $2 AND domain = 'state_budget_amendments'
    ), finance AS (
      SELECT count(*)::int AS amendment_count,
             sum(a.amount_current_cents) AS total_current_cents,
             sum(a.amount_committed_cents) AS committed_cents,
             sum(a.amount_liquidated_cents) AS liquidated_cents,
             sum(a.amount_paid_cents) AS paid_cents
      FROM ${STATE_BUDGET_SCHEMA}.amendments a
      JOIN active_revision ar ON ar.revision_id = a.revision_id
    ), legislators AS (
      SELECT count(DISTINCT canonical_person_id)::int AS distinct_legislators
      FROM ${STATE_BUDGET_SCHEMA}.authors au
      JOIN active_revision ar ON ar.revision_id = au.revision_id
      WHERE au.canonical_person_id IS NOT NULL
    ), beneficiaries AS (
      SELECT count(DISTINCT COALESCE(NULLIF(d.beneficiary_document, ''), NULLIF(d.beneficiary_name, '')))::int AS distinct_beneficiaries,
             count(DISTINCT COALESCE(NULLIF(d.municipality_ibge_code, ''), NULLIF(d.municipality_name, '')))::int AS distinct_municipalities
      FROM ${STATE_BUDGET_SCHEMA}.destinations d
      JOIN active_revision ar ON ar.revision_id = d.revision_id
      WHERE NULLIF(d.beneficiary_document, '') IS NOT NULL
         OR NULLIF(d.beneficiary_name, '') IS NOT NULL
         OR NULLIF(d.municipality_ibge_code, '') IS NOT NULL
         OR NULLIF(d.municipality_name, '') IS NOT NULL
    )
    SELECT finance.*, legislators.distinct_legislators,
           beneficiaries.distinct_beneficiaries,
           beneficiaries.distinct_municipalities
    FROM finance CROSS JOIN legislators CROSS JOIN beneficiaries
  `, [house, fiscalYear])).rows[0];
}
