/**
 * P11.6 — ENEM: participação e desempenho agregados por município da escola de conclusão, UF e Brasil.
 * Nunca por município de residência (não publicado pela fonte) e nunca por aluno ou escola individual
 * (`CO_ESCOLA` existe só em 2024/2025 e é mascarado pelo próprio Inep em células pequenas; não é guardado aqui).
 */
export const EXEC_DDL_V26 = `
CREATE TABLE IF NOT EXISTS civica_exec.exec_enem_source_run (
  source_run_id bigserial PRIMARY KEY,
  edition smallint NOT NULL,
  source_url text NOT NULL,
  source_file text NOT NULL,
  source_sha256 text NOT NULL,
  source_bytes bigint NOT NULL DEFAULT 0,
  parser_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('running','published','no_change','failed','blocked')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  results_rows bigint NOT NULL DEFAULT 0,
  error text,
  UNIQUE (edition, source_sha256, parser_version)
);
CREATE INDEX IF NOT EXISTS exec_enem_source_run_lookup ON civica_exec.exec_enem_source_run(edition, status);

-- Participação por território/rede: inscritos (total de linhas da base de resultados), presença nas quatro provas e redação válida.
-- scope: 1=Brasil, 3=UF, 4=município. scope_key: UF usa a sigla; município usa o código IBGE de 7 dígitos (CO_MUNICIPIO_ESC), sem tradução.
-- network: 0=todas as redes, 1..4 = TP_DEPENDENCIA_ADM_ESC (federal/estadual/municipal/privada), mesmos códigos da fonte.
CREATE TABLE IF NOT EXISTS civica_exec.exec_enem_territory_year (
  source_run_id bigint NOT NULL REFERENCES civica_exec.exec_enem_source_run(source_run_id),
  edition smallint NOT NULL,
  scope smallint NOT NULL CHECK (scope IN (1,3,4)),
  scope_key text NOT NULL,
  network smallint NOT NULL DEFAULT 0 CHECK (network BETWEEN 0 AND 4),
  registrants bigint NOT NULL DEFAULT 0,
  all_four_present bigint NOT NULL DEFAULT 0,
  essay_valid bigint NOT NULL DEFAULT 0,
  suppressed boolean NOT NULL DEFAULT false,
  PRIMARY KEY (source_run_id, edition, scope, scope_key, network)
);
CREATE INDEX IF NOT EXISTS exec_enem_territory_year_lookup ON civica_exec.exec_enem_territory_year(edition, scope, scope_key);

-- Nota por área (CN/CH/LC/MT/ESSAY), por território/rede. Percentis calculados por histograma exato na resolução nativa da nota (1 decimal).
CREATE TABLE IF NOT EXISTS civica_exec.exec_enem_subject_year (
  source_run_id bigint NOT NULL REFERENCES civica_exec.exec_enem_source_run(source_run_id),
  edition smallint NOT NULL,
  scope smallint NOT NULL CHECK (scope IN (1,3,4)),
  scope_key text NOT NULL,
  network smallint NOT NULL DEFAULT 0 CHECK (network BETWEEN 0 AND 4),
  subject text NOT NULL CHECK (subject IN ('CN','CH','LC','MT','ESSAY')),
  valid_n bigint NOT NULL DEFAULT 0,
  mean numeric(8,2),
  median numeric(8,1),
  p25 numeric(8,1),
  p75 numeric(8,1),
  suppressed boolean NOT NULL DEFAULT false,
  PRIMARY KEY (source_run_id, edition, scope, scope_key, network, subject)
);
CREATE INDEX IF NOT EXISTS exec_enem_subject_year_lookup ON civica_exec.exec_enem_subject_year(edition, scope, scope_key, subject);

-- Reconciliação nacional contra as Sinopses Estatísticas do Inep (tabelas 1.1, 1.2, 7.4.1, 7.5.1): só publica quando reconciled=true.
CREATE TABLE IF NOT EXISTS civica_exec.exec_enem_coverage (
  source_run_id bigint PRIMARY KEY REFERENCES civica_exec.exec_enem_source_run(source_run_id),
  edition smallint NOT NULL,
  registrants bigint NOT NULL DEFAULT 0,
  all_four_present bigint NOT NULL DEFAULT 0,
  math_valid bigint NOT NULL DEFAULT 0,
  essay_valid bigint NOT NULL DEFAULT 0,
  sinopse_registrants bigint,
  sinopse_all_four_present bigint,
  sinopse_math_valid bigint,
  sinopse_essay_valid bigint,
  reconciled boolean NOT NULL DEFAULT false,
  note text NOT NULL DEFAULT ''
);
`;
