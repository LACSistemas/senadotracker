// P10.8: apenas estruturas compactas comprovadamente necessárias à leitura integrada.
// Nenhum fato das P10.1-P10.7 é copiado. O rollup contém somente Brasil/UF e pode ser reconstruído.
export const EXEC_DDL_V17 = `
CREATE TABLE civica_exec.exec_edu_contract_rollup (
  scope smallint NOT NULL CHECK (scope IN (1, 3)),                 -- 1 Brasil; 3 UF
  scope_key integer NOT NULL,                                     -- 0 Brasil; código IBGE da UF
  year smallint NOT NULL,
  category smallint NOT NULL CHECK (category BETWEEN 0 AND 16),   -- 0 = contratos únicos; 1..16 = classificação (não aditiva)
  confidence smallint NOT NULL CHECK (confidence BETWEEN 1 AND 3),
  contracts integer NOT NULL CHECK (contracts >= 0),
  with_value integer NOT NULL CHECK (with_value BETWEEN 0 AND contracts),
  outliers integer NOT NULL CHECK (outliers BETWEEN 0 AND contracts),
  contracted_value bigint NOT NULL,
  PRIMARY KEY (scope, scope_key, year, category, confidence)
);
CREATE TABLE civica_exec.exec_edu_analytics_meta (
  materialization text PRIMARY KEY,
  refreshed_at timestamptz NOT NULL,
  source_contract_rows integer NOT NULL,
  source_class_rows integer NOT NULL,
  source_fingerprint text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX exec_edu_program_fact_entity_year_idx
  ON civica_exec.exec_edu_program_fact (entity_id, year, program_code, financial_stage)
  WHERE entity_id IS NOT NULL;
CREATE INDEX exec_fin_fact_year_account_idx
  ON civica_exec.exec_fin_fact (exercicio, conta_id, coluna_id, entity_id);
`;
