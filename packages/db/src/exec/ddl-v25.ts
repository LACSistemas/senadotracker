/** P11.5 — CAPES/Sucupira: programas, cursos, avaliação e agregados sem PII. */
export const EXEC_DDL_V25 = `
CREATE TABLE IF NOT EXISTS civica_exec.exec_capes_source_run (
  source_run_id bigserial PRIMARY KEY,
  family text NOT NULL CHECK (family IN ('PROGRAM','COURSE','DISCENTE','DOCENTE','EVALUATION')),
  reference_year smallint NOT NULL,
  source_url text NOT NULL,
  source_file text NOT NULL,
  source_sha256 text NOT NULL,
  source_bytes bigint NOT NULL DEFAULT 0,
  parser_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('running','published','no_change','failed','blocked')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  data_through date,
  rows_source bigint NOT NULL DEFAULT 0,
  rows_valid bigint NOT NULL DEFAULT 0,
  rows_linked bigint NOT NULL DEFAULT 0,
  rows_unresolved bigint NOT NULL DEFAULT 0,
  rows_ambiguous bigint NOT NULL DEFAULT 0,
  error text,
  UNIQUE (family, reference_year, source_sha256, parser_version)
);
CREATE INDEX IF NOT EXISTS exec_capes_source_run_lookup ON civica_exec.exec_capes_source_run(family, reference_year, status);

CREATE TABLE IF NOT EXISTS civica_exec.exec_capes_ppg (
  capes_program_code text PRIMARY KEY,
  first_year smallint NOT NULL,
  last_year smallint NOT NULL,
  current_name text NOT NULL DEFAULT '',
  current_institution text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS civica_exec.exec_capes_ppg_year (
  source_run_id bigint NOT NULL REFERENCES civica_exec.exec_capes_source_run(source_run_id),
  reference_year smallint NOT NULL,
  capes_program_code text NOT NULL REFERENCES civica_exec.exec_capes_ppg(capes_program_code),
  capes_entity_code text NOT NULL DEFAULT '', emec_code bigint, entity_id integer,
  institution_name text NOT NULL DEFAULT '', institution_sigla text NOT NULL DEFAULT '',
  municipality_name text NOT NULL DEFAULT '', uf char(2) NOT NULL DEFAULT '',
  modality text NOT NULL DEFAULT '', degree text NOT NULL DEFAULT '', situation text NOT NULL DEFAULT '',
  area_evaluation text NOT NULL DEFAULT '', concept smallint,
  source_row_hash text NOT NULL DEFAULT '',
  PRIMARY KEY (source_run_id, reference_year, capes_program_code)
);
CREATE INDEX IF NOT EXISTS exec_capes_ppg_year_lookup ON civica_exec.exec_capes_ppg_year(reference_year, uf, municipality_name);
CREATE INDEX IF NOT EXISTS exec_capes_ppg_year_territory_order ON civica_exec.exec_capes_ppg_year(reference_year, uf, institution_name);

CREATE TABLE IF NOT EXISTS civica_exec.exec_capes_course (
  capes_course_code text PRIMARY KEY,
  capes_program_code text NOT NULL REFERENCES civica_exec.exec_capes_ppg(capes_program_code),
  first_year smallint NOT NULL,
  last_year smallint NOT NULL,
  current_name text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS civica_exec.exec_capes_course_year (
  source_run_id bigint NOT NULL REFERENCES civica_exec.exec_capes_source_run(source_run_id),
  reference_year smallint NOT NULL, capes_course_code text NOT NULL REFERENCES civica_exec.exec_capes_course(capes_course_code),
  capes_program_code text NOT NULL, capes_entity_code text NOT NULL DEFAULT '', emec_code bigint, entity_id integer,
  course_name text NOT NULL DEFAULT '', degree text NOT NULL DEFAULT '', situation text NOT NULL DEFAULT '',
  uf char(2) NOT NULL DEFAULT '', municipality_name text NOT NULL DEFAULT '', concept smallint,
  source_row_hash text NOT NULL DEFAULT '',
  PRIMARY KEY (source_run_id, reference_year, capes_course_code)
);
CREATE INDEX IF NOT EXISTS exec_capes_course_year_lookup ON civica_exec.exec_capes_course_year(reference_year, uf, capes_program_code);

CREATE TABLE IF NOT EXISTS civica_exec.exec_capes_crosswalk (
  source_run_id bigint NOT NULL REFERENCES civica_exec.exec_capes_source_run(source_run_id),
  reference_year smallint NOT NULL, entity_type text NOT NULL CHECK (entity_type IN ('PPG','COURSE','INSTITUTION')),
  source_key text NOT NULL, capes_entity_code text NOT NULL DEFAULT '', emec_code bigint, co_ies bigint, entity_id integer,
  status text NOT NULL CHECK (status IN ('OFFICIAL_LINK','UNRESOLVED','AMBIGUOUS','NOT_APPLICABLE','NEEDS_VALIDATION')),
  evidence text NOT NULL DEFAULT '', PRIMARY KEY (source_run_id, reference_year, entity_type, source_key)
);
CREATE INDEX IF NOT EXISTS exec_capes_crosswalk_status ON civica_exec.exec_capes_crosswalk(entity_type, status, reference_year);

CREATE TABLE IF NOT EXISTS civica_exec.exec_capes_evaluation (
  source_run_id bigint NOT NULL REFERENCES civica_exec.exec_capes_source_run(source_run_id),
  cycle text NOT NULL, capes_program_code text NOT NULL, institution_name text NOT NULL DEFAULT '', area_evaluation text NOT NULL DEFAULT '',
  level text NOT NULL DEFAULT '', initial_concept text NOT NULL DEFAULT '', reconsideration_concept text NOT NULL DEFAULT '', final_concept text NOT NULL DEFAULT '',
  publication_date date, source_row_number integer NOT NULL, PRIMARY KEY (source_run_id, cycle, capes_program_code)
);
CREATE INDEX IF NOT EXISTS exec_capes_evaluation_lookup ON civica_exec.exec_capes_evaluation(cycle, final_concept);

CREATE TABLE IF NOT EXISTS civica_exec.exec_capes_student_aggregate (
  source_run_id bigint NOT NULL REFERENCES civica_exec.exec_capes_source_run(source_run_id), reference_year smallint NOT NULL,
  capes_program_code text NOT NULL, degree text NOT NULL DEFAULT '', status_bucket text NOT NULL, uf char(2) NOT NULL DEFAULT '', municipality_name text NOT NULL DEFAULT '',
  row_count bigint NOT NULL DEFAULT 0, distinct_student_count bigint NOT NULL DEFAULT 0, entrant_count bigint NOT NULL DEFAULT 0, graduated_count bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (source_run_id, reference_year, capes_program_code, degree, status_bucket)
);
CREATE INDEX IF NOT EXISTS exec_capes_student_lookup ON civica_exec.exec_capes_student_aggregate(reference_year, uf, status_bucket);

CREATE TABLE IF NOT EXISTS civica_exec.exec_capes_faculty_aggregate (
  source_run_id bigint NOT NULL REFERENCES civica_exec.exec_capes_source_run(source_run_id), reference_year smallint NOT NULL,
  capes_program_code text NOT NULL, category text NOT NULL DEFAULT '', employment_link text NOT NULL DEFAULT '', work_regime text NOT NULL DEFAULT '',
  doctorate_flag boolean, faculty_count bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (source_run_id, reference_year, capes_program_code, category, employment_link, work_regime, doctorate_flag)
);
CREATE INDEX IF NOT EXISTS exec_capes_faculty_lookup ON civica_exec.exec_capes_faculty_aggregate(reference_year, capes_program_code);

CREATE TABLE IF NOT EXISTS civica_exec.exec_capes_coverage (
  source_run_id bigint PRIMARY KEY REFERENCES civica_exec.exec_capes_source_run(source_run_id), family text NOT NULL, reference_year smallint NOT NULL,
  source_rows bigint NOT NULL DEFAULT 0, valid_rows bigint NOT NULL DEFAULT 0, linked_rows bigint NOT NULL DEFAULT 0, unresolved_rows bigint NOT NULL DEFAULT 0,
  ambiguous_rows bigint NOT NULL DEFAULT 0, ppg_count bigint NOT NULL DEFAULT 0, course_count bigint NOT NULL DEFAULT 0, municipality_count bigint NOT NULL DEFAULT 0,
  uf_count bigint NOT NULL DEFAULT 0, note text NOT NULL DEFAULT ''
);
`;
