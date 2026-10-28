/** P11.4 — ProUni/FIES agregados, sem microdados pessoais. */
export const EXEC_DDL_V24 = `
CREATE TABLE IF NOT EXISTS civica_exec.exec_access_source_run (
  source_run_id bigserial PRIMARY KEY,
  program text NOT NULL CHECK (program IN ('PROUNI','FIES')),
  edition_year smallint NOT NULL,
  semester smallint NOT NULL DEFAULT 0,
  stage text NOT NULL DEFAULT '',
  source_url text NOT NULL,
  source_file text NOT NULL,
  source_sha256 text,
  source_bytes bigint,
  parser_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('published','no_change','failed','blocked')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  data_through date,
  rows_source bigint NOT NULL DEFAULT 0,
  rows_eligible bigint NOT NULL DEFAULT 0,
  rows_aggregated bigint NOT NULL DEFAULT 0,
  rows_linked_ies bigint NOT NULL DEFAULT 0,
  rows_unresolved bigint NOT NULL DEFAULT 0,
  error text,
  UNIQUE (program, edition_year, semester, stage, source_sha256, parser_version)
);

CREATE TABLE IF NOT EXISTS civica_exec.exec_access_crosswalk (
  source_run_id bigint NOT NULL REFERENCES civica_exec.exec_access_source_run(source_run_id),
  program text NOT NULL CHECK (program IN ('PROUNI','FIES')),
  source_ies_key text NOT NULL DEFAULT '',
  source_course_key text NOT NULL DEFAULT '',
  co_ies bigint,
  co_curso bigint,
  status text NOT NULL CHECK (status IN ('OFFICIAL_LINK','UNRESOLVED','AMBIGUOUS','NOT_APPLICABLE','NEEDS_VALIDATION')),
  evidence text NOT NULL,
  PRIMARY KEY (source_run_id, program, source_ies_key, source_course_key)
);
CREATE INDEX IF NOT EXISTS exec_access_crosswalk_status_idx ON civica_exec.exec_access_crosswalk(program, status, co_ies);

CREATE TABLE IF NOT EXISTS civica_exec.exec_prouni_fact (
  source_run_id bigint NOT NULL REFERENCES civica_exec.exec_access_source_run(source_run_id),
  grant_year smallint NOT NULL,
  co_ies bigint,
  source_ies_key text NOT NULL DEFAULT '',
  source_course_key text NOT NULL DEFAULT '',
  offer_municipality_name text NOT NULL DEFAULT '',
  offer_uf char(2) NOT NULL DEFAULT '',
  beneficiary_municipality_name text NOT NULL DEFAULT '',
  beneficiary_uf char(2) NOT NULL DEFAULT '',
  modality text NOT NULL DEFAULT '',
  shift text NOT NULL DEFAULT '',
  scholarship_type text NOT NULL,
  granted_count bigint NOT NULL CHECK (granted_count >= 0),
  PRIMARY KEY (source_run_id, grant_year, source_ies_key, source_course_key, offer_municipality_name, beneficiary_municipality_name, modality, shift, scholarship_type)
);
CREATE INDEX IF NOT EXISTS exec_prouni_fact_year_idx ON civica_exec.exec_prouni_fact(grant_year, offer_uf, offer_municipality_name);
CREATE INDEX IF NOT EXISTS exec_prouni_fact_ies_idx ON civica_exec.exec_prouni_fact(co_ies, grant_year);

CREATE TABLE IF NOT EXISTS civica_exec.exec_fies_fact (
  source_run_id bigint NOT NULL REFERENCES civica_exec.exec_access_source_run(source_run_id),
  process_year smallint NOT NULL,
  semester smallint NOT NULL DEFAULT 0,
  stage text NOT NULL,
  co_ies bigint,
  source_ies_key text NOT NULL DEFAULT '',
  source_course_key text NOT NULL DEFAULT '',
  municipality_name text NOT NULL DEFAULT '',
  uf char(2) NOT NULL DEFAULT '',
  modality text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT '',
  record_count bigint NOT NULL CHECK (record_count >= 0),
  PRIMARY KEY (source_run_id, process_year, semester, stage, source_ies_key, source_course_key, municipality_name, uf, modality, status)
);
CREATE INDEX IF NOT EXISTS exec_fies_fact_period_idx ON civica_exec.exec_fies_fact(process_year, semester, stage, uf, municipality_name);
CREATE INDEX IF NOT EXISTS exec_fies_fact_ies_idx ON civica_exec.exec_fies_fact(co_ies, process_year);

CREATE TABLE IF NOT EXISTS civica_exec.exec_access_coverage (
  source_run_id bigint PRIMARY KEY REFERENCES civica_exec.exec_access_source_run(source_run_id),
  program text NOT NULL,
  edition_year smallint NOT NULL,
  semester smallint,
  stage text,
  source_rows bigint NOT NULL DEFAULT 0,
  eligible_rows bigint NOT NULL DEFAULT 0,
  aggregated_rows bigint NOT NULL DEFAULT 0,
  linked_ies bigint NOT NULL DEFAULT 0,
  linked_courses bigint NOT NULL DEFAULT 0,
  unresolved_rows bigint NOT NULL DEFAULT 0,
  ambiguous_rows bigint NOT NULL DEFAULT 0,
  municipalities_count bigint NOT NULL DEFAULT 0,
  ufs_count bigint NOT NULL DEFAULT 0,
  suppression_count bigint NOT NULL DEFAULT 0,
  note text
);
CREATE INDEX IF NOT EXISTS exec_access_coverage_lookup_idx ON civica_exec.exec_access_coverage(program, edition_year, semester, stage);

CREATE TABLE IF NOT EXISTS civica_exec.exec_access_territory_year (
  program text NOT NULL CHECK (program IN ('PROUNI','FIES')),
  period_year smallint NOT NULL,
  semester smallint NOT NULL DEFAULT 0,
  stage text NOT NULL DEFAULT '',
  scope smallint NOT NULL CHECK (scope IN (1,3,4)),
  scope_key text NOT NULL,
  granted_or_records bigint,
  integral_count bigint,
  partial_count bigint,
  institution_count bigint,
  course_count bigint,
  source_run_id bigint NOT NULL REFERENCES civica_exec.exec_access_source_run(source_run_id),
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (program, period_year, semester, stage, scope, scope_key)
);
CREATE INDEX IF NOT EXISTS exec_access_territory_lookup_idx ON civica_exec.exec_access_territory_year(program, scope, scope_key, period_year);
`;
