// P10.8 performance rollup: compact aggregates only; no program facts are copied.
export const EXEC_DDL_V18 = `
CREATE TABLE civica_exec.exec_edu_program_rollup (
  scope smallint NOT NULL CHECK (scope IN (1, 3, 4)),
  scope_key text NOT NULL,
  source_dataset text NOT NULL,
  year smallint NOT NULL,
  month smallint,
  program_code text NOT NULL,
  financial_stage text NOT NULL,
  rows integer NOT NULL,
  amount_cents bigint NOT NULL,
  beneficiaries integer NOT NULL,
  schools integer NOT NULL,
  PRIMARY KEY (scope, scope_key, source_dataset, year, month, program_code, financial_stage)
);
CREATE INDEX exec_edu_program_rollup_query_idx
  ON civica_exec.exec_edu_program_rollup (scope, scope_key, year, program_code, financial_stage, month);
`;
