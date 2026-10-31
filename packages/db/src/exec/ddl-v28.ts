// P13.5-R2: serving compacto do catálogo Obrasgov. O staging/RAW permanece a fonte completa.
export const EXEC_DDL_V28 = `
CREATE TABLE civica_exec.exec_work_c_revision (
  revision_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_updated_at timestamptz NOT NULL,
  source_hash bytea NOT NULL UNIQUE,
  state text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  notes text
);
CREATE TABLE civica_exec.exec_work_c_text (
  kind smallint NOT NULL,
  code integer GENERATED ALWAYS AS IDENTITY,
  label text NOT NULL,
  PRIMARY KEY (kind, label), UNIQUE (kind, code)
);
CREATE TABLE civica_exec.exec_work_c_org (
  org_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cnpj bigint,
  name text NOT NULL,
  UNIQUE (cnpj, name)
);
CREATE TABLE civica_exec.exec_work_c_municipality (
  ibge7 integer PRIMARY KEY,
  uf smallint NOT NULL,
  name text NOT NULL
);
CREATE TABLE civica_exec.exec_work_c_project (
  project_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_project_id text NOT NULL UNIQUE,
  name text NOT NULL,
  situation_code integer,
  nature_code integer,
  species_code integer,
  uf smallint NOT NULL,
  org_id integer REFERENCES civica_exec.exec_work_c_org,
  d_start_prev date, d_end_prev date, d_start_eff date, d_end_eff date, d_cadastro date,
  cadastro_year smallint, population_benefited bigint, jobs_generated integer,
  planned_amount bigint, system_code integer, revision_id bigint NOT NULL REFERENCES civica_exec.exec_work_c_revision
);
CREATE INDEX exec_work_c_project_uf_idx ON civica_exec.exec_work_c_project (uf, situation_code);
CREATE INDEX exec_work_c_project_revision_idx ON civica_exec.exec_work_c_project (revision_id);
CREATE TABLE civica_exec.exec_work_c_location (
  project_id integer NOT NULL REFERENCES civica_exec.exec_work_c_project,
  ibge7 integer NOT NULL REFERENCES civica_exec.exec_work_c_municipality,
  geometry_id bigint,
  uf smallint NOT NULL,
  precision_code integer,
  PRIMARY KEY (project_id, ibge7, geometry_id)
);
CREATE INDEX exec_work_c_location_ibge_idx ON civica_exec.exec_work_c_location (ibge7);
CREATE TABLE civica_exec.exec_work_c_physical (
  project_id integer NOT NULL REFERENCES civica_exec.exec_work_c_project,
  execution_id bigint NOT NULL,
  percent numeric(7,4), start_date date, end_date date,
  instrument_code integer, form_code integer, updated_at date, revision_id bigint NOT NULL REFERENCES civica_exec.exec_work_c_revision,
  PRIMARY KEY (project_id, execution_id)
);
CREATE INDEX exec_work_c_physical_project_idx ON civica_exec.exec_work_c_physical (project_id);
CREATE TABLE civica_exec.exec_work_c_contract (
  project_id integer NOT NULL REFERENCES civica_exec.exec_work_c_project,
  contract_id bigint PRIMARY KEY, contract_number text,
  signed date, vig_start date, vig_end date, supplier_cnpj bigint, supplier_name text,
  amount_global bigint, amount_accumulated bigint, status_code integer, transparency_url text,
  revision_id bigint NOT NULL REFERENCES civica_exec.exec_work_c_revision
);
CREATE INDEX exec_work_c_contract_project_idx ON civica_exec.exec_work_c_contract (project_id);
CREATE TABLE civica_exec.exec_work_c_commitment (
  project_id integer NOT NULL REFERENCES civica_exec.exec_work_c_project,
  commitment_key text PRIMARY KEY, ug_emitente integer, nr_empenho text, emission_date date,
  value_cents bigint, source_system_code integer, source_database_code integer, nature integer, source text,
  liquidation numeric, paid numeric, revision_id bigint NOT NULL REFERENCES civica_exec.exec_work_c_revision
);
CREATE INDEX exec_work_c_commitment_project_idx ON civica_exec.exec_work_c_commitment (project_id);
CREATE TABLE civica_exec.exec_work_c_history (
  project_id integer NOT NULL REFERENCES civica_exec.exec_work_c_project,
  history_id bigint NOT NULL, status_code integer, status_date date, justification text, treatments text,
  revision_id bigint NOT NULL REFERENCES civica_exec.exec_work_c_revision,
  PRIMARY KEY (project_id, history_id)
);
CREATE TABLE civica_exec.exec_work_c_cov (
  revision_id bigint NOT NULL REFERENCES civica_exec.exec_work_c_revision,
  dataset text NOT NULL, source_rows integer NOT NULL, source_unique integer NOT NULL,
  published_rows integer NOT NULL, rejected_rows integer NOT NULL, duplicate_rows integer NOT NULL,
  status text NOT NULL, PRIMARY KEY (revision_id, dataset)
);
`;
