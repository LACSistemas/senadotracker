// P10.8 performance rollup for integrated finance reads; source facts remain intact.
export const EXEC_DDL_V19 = `
CREATE TABLE civica_exec.exec_edu_finance_rollup (
  scope smallint NOT NULL CHECK (scope IN (1, 3)),
  scope_key text NOT NULL,
  source text NOT NULL CHECK (source IN ('SICONFI', 'SIOPE')),
  year smallint NOT NULL,
  component smallint,
  code text,
  stage text NOT NULL,
  entities integer NOT NULL,
  amount_cents bigint NOT NULL,
  PRIMARY KEY (scope, scope_key, source, year, component, code, stage)
);
CREATE INDEX exec_edu_finance_rollup_query_idx ON civica_exec.exec_edu_finance_rollup (scope, scope_key, year, source, stage);
`;
