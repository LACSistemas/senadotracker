import type { Pool } from 'pg';
import { JUDICIARY_SCHEMA } from './postgres-judiciary.ts';

/** P14.4 compact STJ jurisprudence metadata. Full decision bodies remain in the official RAW area only. */
export const JUDICIARY_STJ_SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS ${JUDICIARY_SCHEMA}.jud_stj_orgao (
    org_id text PRIMARY KEY, source_name text NOT NULL, normalized_name text NOT NULL UNIQUE,
    verification_status text NOT NULL CHECK (verification_status IN ('SOURCE_STRUCTURED','SOURCE_NOMINAL','AMBIGUOUS')),
    source_snapshot_id text REFERENCES ${JUDICIARY_SCHEMA}.jud_source_snapshot(snapshot_id),
    provenance jsonb NOT NULL DEFAULT '{}'::jsonb
  )`,
  `CREATE TABLE IF NOT EXISTS ${JUDICIARY_SCHEMA}.jud_stj_person (
    person_id text PRIMARY KEY, source_name text NOT NULL, normalized_name text NOT NULL UNIQUE,
    role text NOT NULL CHECK (role IN ('MINISTER','RELATOR','OTHER')),
    verification_status text NOT NULL CHECK (verification_status IN ('SOURCE_NOMINAL_UNIQUE','AMBIGUOUS','SOURCE_ID')),
    source_snapshot_id text REFERENCES ${JUDICIARY_SCHEMA}.jud_source_snapshot(snapshot_id),
    provenance jsonb NOT NULL DEFAULT '{}'::jsonb
  )`,
  `CREATE TABLE IF NOT EXISTS ${JUDICIARY_SCHEMA}.jud_stj_precedent (
    precedent_id text NOT NULL, publication_revision_id text NOT NULL,
    source_sequential text NOT NULL, precedent_type text, precedent_number text,
    first_affectation_date date, judgment_date date, publication_date date, status text,
    complementary_information text, submitted_question text, fixed_thesis text,
    annotations text, judgment_scope text, previous_understanding text,
    legislative_reference text, summary_reference text, originated_summary text,
    public_hearing boolean, public_hearing_date date, organ_name text, subjects text,
    stf_general_repercussion_number text, stf_general_repercussion_description text,
    source_snapshot_id text NOT NULL REFERENCES ${JUDICIARY_SCHEMA}.jud_source_snapshot(snapshot_id),
    raw_row_hash text NOT NULL, provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (precedent_id, publication_revision_id),
    UNIQUE (source_sequential, publication_revision_id)
  )`,
  `CREATE INDEX IF NOT EXISTS jud_stj_precedent_active_idx ON ${JUDICIARY_SCHEMA}.jud_stj_precedent(publication_revision_id, status, judgment_date)`,
  `CREATE TABLE IF NOT EXISTS ${JUDICIARY_SCHEMA}.jud_stj_precedent_process (
    process_id text NOT NULL, publication_revision_id text NOT NULL, precedent_id text NOT NULL,
    source_sequential text NOT NULL, process_label text, registration_number text,
    relator_name text, leading_case boolean, affectation_date date, affectation_publication_date date,
    affectation_note text, affectation_proposer text, mpf_view_date date, judgment_date date,
    judgment_publication_date date, stf_process text, stf_remittance_date date, stf_status text,
    origin_court text, origin_court_sigla text, origin_region text, origin_uf char(2),
    origin_justice_type text, suspended_origin_processes integer, declaration_embargo_publication_date date,
    desafectation text, divergent_embargo text,
    source_snapshot_id text NOT NULL REFERENCES ${JUDICIARY_SCHEMA}.jud_source_snapshot(snapshot_id),
    raw_row_hash text NOT NULL, provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (process_id, publication_revision_id)
  )`,
  `CREATE INDEX IF NOT EXISTS jud_stj_precedent_process_lookup_idx ON ${JUDICIARY_SCHEMA}.jud_stj_precedent_process(publication_revision_id, precedent_id, registration_number)`,
  `CREATE TABLE IF NOT EXISTS ${JUDICIARY_SCHEMA}.jud_stj_acordao_mirror (
    mirror_id text NOT NULL, publication_revision_id text NOT NULL, dataset_name text NOT NULL,
    source_resource_name text NOT NULL, process_number text, registration_number text,
    class_sigla text, class_description text, organ_name text, relator_name text,
    decision_date date, publication_source text, decision_type text, ementa text,
    decision_summary text, cited_jurisprudence text, notes text, complementary_information text,
    auxiliary_terms text, legal_thesis text, theme_reference text, legislative_references jsonb,
    similar_acordaos jsonb, source_snapshot_id text NOT NULL REFERENCES ${JUDICIARY_SCHEMA}.jud_source_snapshot(snapshot_id),
    raw_row_hash text NOT NULL, provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (mirror_id, publication_revision_id)
  )`,
  `CREATE INDEX IF NOT EXISTS jud_stj_mirror_lookup_idx ON ${JUDICIARY_SCHEMA}.jud_stj_acordao_mirror(publication_revision_id, organ_name, decision_date)`,
  `CREATE TABLE IF NOT EXISTS ${JUDICIARY_SCHEMA}.jud_stj_decision (
    decision_id text NOT NULL, publication_revision_id text NOT NULL, source_resource_name text NOT NULL,
    publication_date date, decision_type text, registration_number text, process_label text,
    receipt_date date, distribution_date date, relator_name text, appeal_type text,
    outcome text, monocratic_description text, subjects text,
    source_snapshot_id text NOT NULL REFERENCES ${JUDICIARY_SCHEMA}.jud_source_snapshot(snapshot_id),
    raw_row_hash text NOT NULL, provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (decision_id, publication_revision_id)
  )`,
  `CREATE INDEX IF NOT EXISTS jud_stj_decision_lookup_idx ON ${JUDICIARY_SCHEMA}.jud_stj_decision(publication_revision_id, publication_date, decision_type, registration_number)`,
  `CREATE TABLE IF NOT EXISTS ${JUDICIARY_SCHEMA}.jud_stj_document_relation (
    relation_id text NOT NULL, publication_revision_id text NOT NULL, relation_kind text NOT NULL,
    source_type text NOT NULL, source_id text NOT NULL, target_type text NOT NULL, target_id text NOT NULL,
    match_status text NOT NULL CHECK (match_status IN ('OFFICIAL_ID','OFFICIAL_REFERENCE','UNRESOLVED')),
    evidence text NOT NULL, source_snapshot_id text NOT NULL REFERENCES ${JUDICIARY_SCHEMA}.jud_source_snapshot(snapshot_id),
    provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (relation_id, publication_revision_id),
    UNIQUE (relation_kind, source_id, target_id, publication_revision_id)
  )`,
  `CREATE INDEX IF NOT EXISTS jud_stj_relation_source_idx ON ${JUDICIARY_SCHEMA}.jud_stj_document_relation(publication_revision_id, source_type, source_id)`,
];

export async function ensureJudiciaryStjSchema(pool: Pool): Promise<void> {
  for (const sql of JUDICIARY_STJ_SCHEMA_SQL) await pool.query(sql);
}

async function activeRevision(pool: Pool) {
  return (await pool.query(`SELECT revision_id FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='STJ_JURISPRUDENCE' AND is_active=true ORDER BY created_at DESC LIMIT 1`)).rows[0]?.revision_id ?? null;
}

export async function getJudiciaryStjOverview(pool: Pool) {
  const revision = await activeRevision(pool);
  if (!revision) return { revision: null, precedents: 0, processes: 0, mirrors: 0, decisions: 0, relations: 0 };
  const r = await pool.query(`SELECT
    (SELECT count(*) FROM ${JUDICIARY_SCHEMA}.jud_stj_precedent WHERE publication_revision_id=$1)::int AS precedents,
    (SELECT count(*) FROM ${JUDICIARY_SCHEMA}.jud_stj_precedent_process WHERE publication_revision_id=$1)::int AS processes,
    (SELECT count(*) FROM ${JUDICIARY_SCHEMA}.jud_stj_acordao_mirror WHERE publication_revision_id=$1)::int AS mirrors,
    (SELECT count(*) FROM ${JUDICIARY_SCHEMA}.jud_stj_decision WHERE publication_revision_id=$1)::int AS decisions,
    (SELECT count(*) FROM ${JUDICIARY_SCHEMA}.jud_stj_document_relation WHERE publication_revision_id=$1)::int AS relations`, [revision]);
  return { revision, ...r.rows[0] };
}

export async function getJudiciaryStjPrecedents(pool: Pool, filters: { status?: string; type?: string; year?: number; page?: number; pageSize?: number } = {}) {
  const rev = await activeRevision(pool); if (!rev) return { total: 0, page: 1, pageSize: 20, items: [] };
  const page = filters.page ?? 1; const pageSize = filters.pageSize ?? 20;
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error('Paginação STJ inválida');
  const where = ['publication_revision_id=$1']; const args: unknown[] = [rev];
  if (filters.status) { args.push(filters.status); where.push(`status=$${args.length}`); }
  if (filters.type) { args.push(filters.type); where.push(`precedent_type=$${args.length}`); }
  if (filters.year) { args.push(filters.year); where.push(`EXTRACT(YEAR FROM COALESCE(judgment_date,first_affectation_date))=$${args.length}`); }
  const total = Number((await pool.query(`SELECT count(*)::int n FROM ${JUDICIARY_SCHEMA}.jud_stj_precedent WHERE ${where.join(' AND ')}`, args)).rows[0].n);
  args.push(pageSize, (page - 1) * pageSize);
  const items = (await pool.query(`SELECT * FROM ${JUDICIARY_SCHEMA}.jud_stj_precedent WHERE ${where.join(' AND ')} ORDER BY COALESCE(judgment_date,first_affectation_date) DESC,precedent_number,precedent_id LIMIT $${args.length - 1} OFFSET $${args.length}`, args)).rows;
  return { total, page, pageSize, items };
}

export async function getJudiciaryStjPrecedentDetail(pool: Pool, precedentId: string) {
  const rev = await activeRevision(pool); if (!rev) return null;
  const precedent = (await pool.query(`SELECT * FROM ${JUDICIARY_SCHEMA}.jud_stj_precedent WHERE precedent_id=$1 AND publication_revision_id=$2`, [precedentId, rev])).rows[0] ?? null;
  if (!precedent) return null;
  const [processes, relations] = await Promise.all([
    pool.query(`SELECT * FROM ${JUDICIARY_SCHEMA}.jud_stj_precedent_process WHERE precedent_id=$1 AND publication_revision_id=$2 ORDER BY registration_number,process_id`, [precedentId, rev]),
    pool.query(`SELECT * FROM ${JUDICIARY_SCHEMA}.jud_stj_document_relation WHERE publication_revision_id=$1 AND ((source_type='PRECEDENT' AND source_id=$2) OR (target_type='PRECEDENT' AND target_id=$2))`, [rev, precedentId]),
  ]);
  return { precedent, processes: processes.rows, relations: relations.rows };
}

export async function getJudiciaryStjDecisions(pool: Pool, filters: { type?: string; organ?: string; from?: string; to?: string; page?: number; pageSize?: number } = {}) {
  const rev = await activeRevision(pool); if (!rev) return { total: 0, page: 1, pageSize: 20, items: [] };
  const page = filters.page ?? 1; const pageSize = filters.pageSize ?? 20;
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error('Paginação STJ inválida');
  const where = ['publication_revision_id=$1']; const args: unknown[] = [rev];
  if (filters.type) { args.push(filters.type); where.push(`decision_type=$${args.length}`); }
  if (filters.organ) { args.push(filters.organ); where.push(`relator_name=$${args.length}`); }
  if (filters.from) { args.push(filters.from); where.push(`publication_date >= $${args.length}`); }
  if (filters.to) { args.push(filters.to); where.push(`publication_date <= $${args.length}`); }
  const total = Number((await pool.query(`SELECT count(*)::int n FROM ${JUDICIARY_SCHEMA}.jud_stj_decision WHERE ${where.join(' AND ')}`, args)).rows[0].n);
  args.push(pageSize, (page - 1) * pageSize);
  const items = (await pool.query(`SELECT * FROM ${JUDICIARY_SCHEMA}.jud_stj_decision WHERE ${where.join(' AND ')} ORDER BY publication_date DESC,decision_id DESC LIMIT $${args.length - 1} OFFSET $${args.length}`, args)).rows;
  return { total, page, pageSize, items };
}

export async function getJudiciaryStjSourceCoverage(pool: Pool) {
  return (await pool.query(`SELECT revision_id,scope,row_count,state,is_active,last_known_good,created_at,snapshot_ids FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='STJ_JURISPRUDENCE' ORDER BY created_at DESC`)).rows;
}
