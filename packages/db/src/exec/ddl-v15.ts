// P10.6 — programas e transferências educacionais. Extensão aditiva: não altera fatos P10.1–P10.5.
// O valor é sempre acompanhado do estágio source-native; não há rateio de repasses entre escolas.
export const EXEC_DDL_V15 = `
CREATE TABLE civica_exec.exec_edu_program_fact (
  source_key text PRIMARY KEY,
  source_dataset text NOT NULL,
  competence integer NOT NULL CHECK (competence BETWEEN 190001 AND 210012),
  year smallint NOT NULL CHECK (year BETWEEN 2014 AND 2100),
  month smallint CHECK (month BETWEEN 1 AND 12),
  program_code text NOT NULL,
  program_name text NOT NULL DEFAULT '',
  financial_stage text NOT NULL,
  amount_cents bigint NOT NULL,
  uf smallint NOT NULL DEFAULT 0,
  municipality_siafi text,
  beneficiary_type text,
  beneficiary_code text,
  beneficiary_name text,
  entity_id integer REFERENCES civica_exec.exec_entity,
  school_inep integer REFERENCES civica_exec.exec_edu_school,
  uex_cnpj text,
  eex_cnpj text,
  action text,
  plan text,
  source_status text,
  raw_id text,
  source_url text NOT NULL,
  raw_sha256 bytea NOT NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX exec_edu_program_fact_scope_idx ON civica_exec.exec_edu_program_fact (source_dataset, competence, uf, program_code);
CREATE INDEX exec_edu_program_fact_beneficiary_idx ON civica_exec.exec_edu_program_fact (beneficiary_code, year, program_code);
CREATE INDEX exec_edu_program_fact_school_idx ON civica_exec.exec_edu_program_fact (school_inep, year, program_code) WHERE school_inep IS NOT NULL;
CREATE TABLE civica_exec.exec_edu_program_cov (
  source_dataset text NOT NULL,
  competence integer NOT NULL,
  uf smallint NOT NULL,
  program_code text NOT NULL,
  status text NOT NULL,
  source_rows integer NOT NULL,
  parsed_rows integer NOT NULL,
  published_rows integer NOT NULL,
  rejected_rows integer NOT NULL,
  unresolved_entity_rows integer NOT NULL DEFAULT 0,
  unresolved_school_rows integer NOT NULL DEFAULT 0,
  source_hash text,
  source_updated_at timestamptz,
  notes jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (source_dataset, competence, uf, program_code)
);
CREATE INDEX exec_edu_program_cov_year_idx ON civica_exec.exec_edu_program_cov (competence, program_code, uf);
`;
