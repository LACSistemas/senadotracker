// P13.5: cadastro físico nacional de empreendimentos Obrasgov.
// Compacto e source-native; não copia payload JSON nem fatos financeiros do Siconfi/PNCP.
export const EXEC_DDL_V27 = `
CREATE TABLE civica_exec.exec_work_project (
  source_project_id text PRIMARY KEY,
  source_system text NOT NULL DEFAULT 'obrasgov',
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  function_social text,
  meta_global text,
  nature_id integer,
  nature text,
  species_id integer,
  species text,
  situation text,
  uf smallint NOT NULL DEFAULT 0,
  org_resp text,
  org_resp_cnpj bigint,
  d_start_prev date,
  d_end_prev date,
  d_start_eff date,
  d_end_eff date,
  d_cadastro date,
  cadastro_year smallint,
  population_benefited bigint,
  jobs_generated integer,
  planned_amount bigint,
  system_resp text,
  last_source_update timestamptz,
  run_id bigint
);
CREATE INDEX exec_work_project_uf_idx ON civica_exec.exec_work_project (uf, situation);
CREATE INDEX exec_work_project_org_idx ON civica_exec.exec_work_project (org_resp_cnpj) WHERE org_resp_cnpj IS NOT NULL;
CREATE TABLE civica_exec.exec_work_location (
  source_project_id text NOT NULL REFERENCES civica_exec.exec_work_project(source_project_id),
  location_seq smallint NOT NULL,
  location_kind text NOT NULL,
  geometry_id bigint,
  ibge7 integer,
  uf smallint,
  municipality text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  source_precision text,
  PRIMARY KEY(source_project_id,location_seq)
);
CREATE INDEX exec_work_location_ibge_idx ON civica_exec.exec_work_location (ibge7) WHERE ibge7 IS NOT NULL;
CREATE TABLE civica_exec.exec_work_physical (
  source_project_id text NOT NULL REFERENCES civica_exec.exec_work_project(source_project_id),
  execution_id bigint NOT NULL,
  percent numeric(7,4),
  start_date date,
  end_date date,
  instrument text,
  execution_form text,
  created_at timestamptz,
  updated_at date,
  run_id bigint,
  PRIMARY KEY(source_project_id,execution_id)
);
CREATE TABLE civica_exec.exec_work_status_event (
  source_project_id text NOT NULL REFERENCES civica_exec.exec_work_project(source_project_id),
  history_id bigint NOT NULL,
  status text NOT NULL,
  status_date date,
  justification text,
  treatments text,
  run_id bigint,
  PRIMARY KEY(source_project_id,history_id)
);
CREATE TABLE civica_exec.exec_work_contract (
  contract_id bigint PRIMARY KEY,
  source_project_id text NOT NULL REFERENCES civica_exec.exec_work_project(source_project_id),
  contract_number text,
  signed date,
  vig_start date,
  vig_end date,
  supplier_cnpj bigint,
  supplier_name text,
  amount_global bigint,
  amount_accumulated bigint,
  object text,
  status text,
  transparency_url text,
  run_id bigint
);
CREATE INDEX exec_work_contract_project_idx ON civica_exec.exec_work_contract(source_project_id);
CREATE TABLE civica_exec.exec_work_commitment (
  commitment_key text PRIMARY KEY,
  source_project_id text NOT NULL REFERENCES civica_exec.exec_work_project(source_project_id),
  ug_emitente text,
  nr_empenho text,
  emission_date date,
  value_cents bigint,
  source_system text,
  source_database text,
  nature text,
  source text,
  liquidation numeric,
  paid numeric,
  run_id bigint
);
CREATE INDEX exec_work_commitment_project_idx ON civica_exec.exec_work_commitment(source_project_id);
CREATE TABLE civica_exec.exec_work_cov (
  dataset text NOT NULL,
  source_updated_at timestamptz,
  pages integer NOT NULL,
  source_rows integer NOT NULL,
  published_rows integer NOT NULL,
  rejected integer NOT NULL DEFAULT 0,
  status text NOT NULL,
  run_id bigint,
  PRIMARY KEY(dataset,source_updated_at)
);
`;
