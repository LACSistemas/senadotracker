/** P11.2 — Censo da Educação Superior: identidade, ofertas anuais e serving territorial. */
export const EXEC_DDL_V22 = `
CREATE TABLE IF NOT EXISTS civica_exec.exec_edu_higher_collection_run (
  run_id bigserial PRIMARY KEY,
  years smallint[] NOT NULL,
  source_urls jsonb NOT NULL,
  source_hashes jsonb NOT NULL,
  parser_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('running','published','failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  data_through smallint,
  rows_ies bigint NOT NULL DEFAULT 0,
  rows_courses bigint NOT NULL DEFAULT 0,
  rows_offers bigint NOT NULL DEFAULT 0,
  error text
);

CREATE TABLE IF NOT EXISTS civica_exec.exec_edu_higher_ies (
  co_ies bigint PRIMARY KEY,
  canonical_name text NOT NULL,
  canonical_sigla text,
  co_mantenedora bigint,
  canonical_mantenedora text,
  first_year smallint NOT NULL,
  last_year smallint NOT NULL,
  source_updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS civica_exec.exec_edu_higher_ies_year (
  year smallint NOT NULL,
  co_ies bigint NOT NULL REFERENCES civica_exec.exec_edu_higher_ies(co_ies),
  co_municipio_ies integer,
  entity_id integer,
  uf_code smallint,
  uf char(2),
  name text NOT NULL,
  sigla text,
  co_mantenedora bigint,
  mantenedora text,
  tp_organizacao_academica smallint,
  tp_categoria_administrativa smallint,
  tp_rede smallint,
  qt_doc_total bigint,
  qt_doc_exe bigint,
  qt_tec_total bigint,
  source_run_id bigint NOT NULL,
  source_file_sha256 text NOT NULL,
  PRIMARY KEY (year, co_ies)
);
CREATE INDEX IF NOT EXISTS exec_edu_higher_ies_year_entity_idx ON civica_exec.exec_edu_higher_ies_year(entity_id, year);
CREATE INDEX IF NOT EXISTS exec_edu_higher_ies_year_uf_idx ON civica_exec.exec_edu_higher_ies_year(uf, year);

CREATE TABLE IF NOT EXISTS civica_exec.exec_edu_higher_course (
  co_curso bigint PRIMARY KEY,
  canonical_name text NOT NULL,
  tp_grau_academico smallint,
  tp_nivel_academico smallint,
  cine_area_detalhada text,
  cine_subarea text,
  first_year smallint NOT NULL,
  last_year smallint NOT NULL
);

CREATE TABLE IF NOT EXISTS civica_exec.exec_edu_higher_offer_year (
  year smallint NOT NULL,
  co_ies bigint NOT NULL REFERENCES civica_exec.exec_edu_higher_ies(co_ies),
  co_curso bigint NOT NULL REFERENCES civica_exec.exec_edu_higher_course(co_curso),
  co_municipio integer NOT NULL DEFAULT 0,
  entity_id integer,
  uf char(2),
  tp_modalidade smallint NOT NULL,
  tp_dimensao smallint NOT NULL,
  tp_rede smallint,
  tp_categoria_administrativa smallint,
  tp_grau_academico smallint,
  tp_nivel_academico smallint,
  nome_curso text NOT NULL,
  qt_curso bigint,
  qt_vg_total bigint,
  qt_inscrito_total bigint,
  qt_ing bigint,
  qt_mat bigint,
  qt_conc bigint,
  source_run_id bigint NOT NULL,
  source_file_sha256 text NOT NULL,
  PRIMARY KEY (year, co_ies, co_curso, co_municipio, tp_modalidade, tp_dimensao)
);
CREATE INDEX IF NOT EXISTS exec_edu_higher_offer_entity_year_idx ON civica_exec.exec_edu_higher_offer_year(entity_id, year);
CREATE INDEX IF NOT EXISTS exec_edu_higher_offer_uf_year_idx ON civica_exec.exec_edu_higher_offer_year(uf, year);
CREATE INDEX IF NOT EXISTS exec_edu_higher_offer_ies_year_idx ON civica_exec.exec_edu_higher_offer_year(co_ies, year);
CREATE INDEX IF NOT EXISTS exec_edu_higher_offer_course_year_idx ON civica_exec.exec_edu_higher_offer_year(co_curso, year);

CREATE TABLE IF NOT EXISTS civica_exec.exec_edu_higher_territory_year (
  scope smallint NOT NULL CHECK (scope IN (1,3,4)),
  scope_key text NOT NULL,
  year smallint NOT NULL,
  ies_count bigint NOT NULL,
  course_count bigint NOT NULL,
  offer_count bigint NOT NULL,
  municipalities_count bigint NOT NULL,
  public_ies_count bigint,
  private_ies_count bigint,
  in_person_offer_count bigint NOT NULL,
  distance_offer_count bigint NOT NULL,
  vacancies bigint,
  applicants bigint,
  entrants bigint,
  enrollments bigint,
  graduates bigint,
  source_run_id bigint NOT NULL,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, scope_key, year)
);
CREATE INDEX IF NOT EXISTS exec_edu_higher_territory_lookup_idx ON civica_exec.exec_edu_higher_territory_year(scope, scope_key, year);

CREATE TABLE IF NOT EXISTS civica_exec.exec_edu_higher_coverage (
  year smallint PRIMARY KEY,
  source_url text NOT NULL,
  source_file_sha256 text NOT NULL,
  ies_rows bigint NOT NULL,
  ies_distinct bigint NOT NULL,
  course_rows bigint NOT NULL,
  course_distinct bigint NOT NULL,
  offer_rows bigint NOT NULL,
  municipalities_resolved bigint NOT NULL,
  municipalities_unresolved bigint NOT NULL,
  duplicate_base_rows bigint NOT NULL,
  parser_version text NOT NULL,
  data_through date NOT NULL,
  status text NOT NULL CHECK (status IN ('published','partial','failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
`;
