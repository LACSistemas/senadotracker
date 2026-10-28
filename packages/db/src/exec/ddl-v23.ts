/** P11.3 — Indicadores oficiais de qualidade do ensino superior (INEP). */
export const EXEC_DDL_V23 = `
CREATE TABLE IF NOT EXISTS civica_exec.exec_edu_quality_source_run (
  source_run_id bigserial PRIMARY KEY,
  indicator text NOT NULL CHECK (indicator IN ('IGC','CPC','ENADE','IDD')),
  reference_year smallint NOT NULL,
  source_url text NOT NULL,
  source_file text NOT NULL,
  source_sha256 text NOT NULL,
  source_bytes bigint NOT NULL,
  parser_version text NOT NULL,
  methodology_version text,
  status text NOT NULL CHECK (status IN ('published','no_change','failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  data_through date,
  rows_source bigint NOT NULL DEFAULT 0,
  rows_valid bigint NOT NULL DEFAULT 0,
  rows_linked bigint NOT NULL DEFAULT 0,
  rows_unresolved bigint NOT NULL DEFAULT 0,
  error text,
  UNIQUE (indicator, reference_year, source_sha256, parser_version)
);

CREATE TABLE IF NOT EXISTS civica_exec.exec_edu_quality_ies (
  source_run_id bigint NOT NULL REFERENCES civica_exec.exec_edu_quality_source_run(source_run_id),
  reference_year smallint NOT NULL,
  co_ies bigint NOT NULL,
  uf char(2),
  name text,
  academic_organization text,
  administrative_category text,
  igc_continuous numeric(12,8),
  igc_band smallint,
  courses_with_cpc smallint,
  source_status text,
  raw_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (reference_year, co_ies, source_run_id)
);
CREATE INDEX IF NOT EXISTS exec_edu_quality_ies_lookup_idx ON civica_exec.exec_edu_quality_ies(co_ies, reference_year);
CREATE INDEX IF NOT EXISTS exec_edu_quality_ies_uf_idx ON civica_exec.exec_edu_quality_ies(uf, reference_year);

CREATE TABLE IF NOT EXISTS civica_exec.exec_edu_quality_course (
  source_run_id bigint NOT NULL REFERENCES civica_exec.exec_edu_quality_source_run(source_run_id),
  indicator text NOT NULL CHECK (indicator IN ('CPC','ENADE','IDD')),
  reference_year smallint NOT NULL,
  source_key text NOT NULL,
  co_ies bigint,
  co_curso bigint,
  co_municipio integer,
  uf char(2),
  area_code text,
  area_name text,
  degree text,
  modality text,
  course_name text,
  continuous_value numeric(12,8),
  band smallint,
  source_status text,
  crosswalk_status text NOT NULL CHECK (crosswalk_status IN ('OFFICIAL_LINK','UNRESOLVED','AMBIGUOUS','NOT_APPLICABLE','NEEDS_VALIDATION')),
  raw_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (indicator, reference_year, source_key, source_run_id)
);
CREATE INDEX IF NOT EXISTS exec_edu_quality_course_ies_idx ON civica_exec.exec_edu_quality_course(co_ies, indicator, reference_year);
CREATE INDEX IF NOT EXISTS exec_edu_quality_course_course_idx ON civica_exec.exec_edu_quality_course(co_curso, indicator, reference_year);
CREATE INDEX IF NOT EXISTS exec_edu_quality_course_geo_idx ON civica_exec.exec_edu_quality_course(co_municipio, uf, indicator, reference_year);
CREATE INDEX IF NOT EXISTS exec_edu_quality_course_area_idx ON civica_exec.exec_edu_quality_course(area_code, indicator, reference_year);

CREATE TABLE IF NOT EXISTS civica_exec.exec_edu_quality_crosswalk (
  source_run_id bigint NOT NULL REFERENCES civica_exec.exec_edu_quality_source_run(source_run_id),
  indicator text NOT NULL,
  reference_year smallint NOT NULL,
  source_key text NOT NULL,
  co_ies bigint,
  co_curso bigint,
  status text NOT NULL CHECK (status IN ('OFFICIAL_LINK','UNRESOLVED','AMBIGUOUS','NOT_APPLICABLE','NEEDS_VALIDATION')),
  evidence text NOT NULL,
  PRIMARY KEY (indicator, reference_year, source_key, source_run_id)
);
CREATE INDEX IF NOT EXISTS exec_edu_quality_crosswalk_status_idx ON civica_exec.exec_edu_quality_crosswalk(status, indicator, reference_year);

CREATE TABLE IF NOT EXISTS civica_exec.exec_edu_quality_coverage (
  source_run_id bigint PRIMARY KEY REFERENCES civica_exec.exec_edu_quality_source_run(source_run_id),
  indicator text NOT NULL,
  reference_year smallint NOT NULL,
  source_rows bigint NOT NULL,
  valid_rows bigint NOT NULL,
  linked_ies bigint NOT NULL DEFAULT 0,
  linked_courses bigint NOT NULL DEFAULT 0,
  unresolved_rows bigint NOT NULL DEFAULT 0,
  ambiguous_rows bigint NOT NULL DEFAULT 0,
  municipalities_count bigint NOT NULL DEFAULT 0,
  ufs_count bigint NOT NULL DEFAULT 0,
  bands jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS exec_edu_quality_coverage_indicator_idx ON civica_exec.exec_edu_quality_coverage(indicator, reference_year);

CREATE TABLE IF NOT EXISTS civica_exec.exec_edu_quality_territory_year (
  indicator text NOT NULL,
  reference_year smallint NOT NULL,
  scope smallint NOT NULL CHECK (scope IN (1,3,4)),
  scope_key text NOT NULL,
  evaluated_ies bigint NOT NULL DEFAULT 0,
  evaluated_courses bigint NOT NULL DEFAULT 0,
  published_rows bigint NOT NULL DEFAULT 0,
  band_distribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_run_id bigint NOT NULL REFERENCES civica_exec.exec_edu_quality_source_run(source_run_id),
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (indicator, reference_year, scope, scope_key)
);
CREATE INDEX IF NOT EXISTS exec_edu_quality_territory_lookup_idx ON civica_exec.exec_edu_quality_territory_year(scope, scope_key, indicator, reference_year);
`;
