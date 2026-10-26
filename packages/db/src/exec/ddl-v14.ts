// P10.5 — finanças da educação. A extensão é aditiva: nenhum objeto P10.1–P10.4 é alterado.
export const EXEC_DDL_V14 = `
ALTER TABLE civica_exec.exec_fin_cov ADD COLUMN IF NOT EXISTS fn12 smallint NOT NULL DEFAULT 0 CHECK (fn12 IN (0,1));
CREATE TABLE civica_exec.exec_edu_siope_fact (
  entity_id integer NOT NULL REFERENCES civica_exec.exec_entity,
  exercicio smallint NOT NULL,
  periodo smallint NOT NULL,
  componente smallint NOT NULL CHECK (componente BETWEEN 1 AND 4), -- 1 dados gerais, 2 despesas, 3 indicadores, 4 informações complementares
  codigo text NOT NULL,
  estagio text NOT NULL DEFAULT '',
  valor_cents bigint,
  valor_text text,
  source_key text NOT NULL,
  raw_sha256 text NOT NULL,
  PRIMARY KEY (entity_id, exercicio, periodo, componente, codigo, estagio)
);
CREATE INDEX exec_edu_siope_fact_year_idx ON civica_exec.exec_edu_siope_fact (exercicio, componente, codigo);
CREATE TABLE civica_exec.exec_edu_siope_cov (
  uf smallint NOT NULL,
  exercicio smallint NOT NULL,
  periodo smallint NOT NULL,
  componente smallint NOT NULL,
  status smallint NOT NULL,
  rows_in integer NOT NULL,
  valid integer NOT NULL,
  rejected integer NOT NULL,
  source_hash text,
  source_updated_at timestamptz,
  PRIMARY KEY (uf, exercicio, periodo, componente)
);
`;
