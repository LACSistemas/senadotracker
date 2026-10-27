// P10.9.1: serving compacto por território e séries sob demanda.
export const EXEC_DDL_V21 = `
CREATE TABLE civica_exec.exec_edu_overview_rollup (
  scope smallint NOT NULL CHECK (scope IN (1,3,4)),
  scope_key text NOT NULL,
  year smallint NOT NULL,
  payload jsonb NOT NULL,
  source_fingerprint text NOT NULL,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, scope_key, year)
);
CREATE INDEX exec_edu_overview_rollup_lookup_idx ON civica_exec.exec_edu_overview_rollup(scope, scope_key, year);

CREATE TABLE civica_exec.exec_edu_series_rollup (
  scope smallint NOT NULL CHECK (scope IN (1,3,4)),
  scope_key text NOT NULL,
  indicator text NOT NULL,
  year smallint NOT NULL,
  value numeric,
  unit text NOT NULL,
  universe text NOT NULL,
  source_fingerprint text NOT NULL,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, scope_key, indicator, year)
);
CREATE INDEX exec_edu_series_rollup_lookup_idx ON civica_exec.exec_edu_series_rollup(scope, scope_key, indicator, year);
`;
