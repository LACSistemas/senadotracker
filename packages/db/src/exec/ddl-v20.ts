// P10.9 — vínculo determinístico de códigos municipais do Portal de Transferências.
// A tabela preserva o código source-native e não altera valores financeiros.
export const EXEC_DDL_V20 = `
CREATE TABLE civica_exec.exec_edu_program_municipality_map (
  source_dataset text NOT NULL,
  year smallint NOT NULL,
  uf smallint NOT NULL,
  municipality_siafi text NOT NULL,
  entity_id integer REFERENCES civica_exec.exec_entity,
  source_name text NOT NULL DEFAULT '',
  status text NOT NULL CHECK (status IN ('LINKED','UNRESOLVED','AMBIGUOUS','NON_MUNICIPAL')),
  method text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (source_dataset, year, uf, municipality_siafi)
);
CREATE INDEX exec_edu_program_municipality_map_entity_idx ON civica_exec.exec_edu_program_municipality_map(entity_id, year) WHERE entity_id IS NOT NULL;
CREATE INDEX exec_edu_program_municipality_map_status_idx ON civica_exec.exec_edu_program_municipality_map(status, source_dataset, year);
CREATE INDEX exec_edu_program_fact_municipality_map_idx ON civica_exec.exec_edu_program_fact(source_dataset, year, uf, municipality_siafi) WHERE municipality_siafi IS NOT NULL;
`;
