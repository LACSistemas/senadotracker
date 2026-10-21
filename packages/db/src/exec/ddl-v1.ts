// DDL v1 do schema civica_exec (revisão 2 de docs/executivo-collector-plan/saude-fase1-arquitetura/modelo_dados_territorial_saude.md, seção 5).
// Validado em PostgreSQL 17 descartável antes de ser aplicado ao banco do Cívica.
export const EXEC_DDL_V1 = `
-- Tipo e aritmética de competência (nunca subtrair 1)
CREATE DOMAIN civica_exec.competence AS integer CHECK (VALUE BETWEEN 190001 AND 299912 AND VALUE % 100 BETWEEN 1 AND 12);
CREATE FUNCTION civica_exec.ym_next(c integer) RETURNS integer LANGUAGE sql IMMUTABLE
  AS $$ SELECT CASE WHEN c % 100 = 12 THEN (c / 100 + 1) * 100 + 1 ELSE c + 1 END $$;
CREATE FUNCTION civica_exec.ym_prev(c integer) RETURNS integer LANGUAGE sql IMMUTABLE
  AS $$ SELECT CASE WHEN c % 100 = 1 THEN (c / 100 - 1) * 100 + 12 ELSE c - 1 END $$;
CREATE FUNCTION civica_exec.ym_date(c integer) RETURNS date LANGUAGE sql IMMUTABLE AS $$ SELECT make_date(c / 100, c % 100, 1) $$;

-- Território
CREATE TABLE civica_exec.exec_entity (
  entity_id  integer PRIMARY KEY,
  kind       smallint NOT NULL CHECK (kind BETWEEN 1 AND 5),   -- 1 BR, 2 região, 3 UF, 4 município, 5 município ignorado da UF
  ibge7      integer  NOT NULL,                                -- BR 76; região 1..5; UF 11..53; município 7 dígitos; kind 5 = uf_code * 100000
  ibge6      integer  GENERATED ALWAYS AS (CASE WHEN kind IN (4, 5) THEN ibge7 / 10 END) STORED,
  uf_code    smallint, uf char(2), name text NOT NULL,
  parent_id  integer REFERENCES civica_exec.exec_entity,
  is_current boolean NOT NULL DEFAULT true,
  UNIQUE (kind, ibge7)
);
CREATE UNIQUE INDEX ON civica_exec.exec_entity (ibge6) WHERE kind IN (4, 5);
CREATE INDEX ON civica_exec.exec_entity (uf_code, kind);
CREATE TABLE civica_exec.exec_entity_version (
  entity_id integer REFERENCES civica_exec.exec_entity, valid_from date NOT NULL, valid_to date,
  change_kind smallint NOT NULL, name text, ibge7_prev integer, source_id smallint, evidence_ref text,
  PRIMARY KEY (entity_id, valid_from), CHECK (valid_to IS NULL OR valid_to > valid_from)
);
CREATE TABLE civica_exec.exec_entity_external_id (
  source smallint, code text, valid_from date NOT NULL DEFAULT '1900-01-01', valid_to date,
  entity_id integer NOT NULL REFERENCES civica_exec.exec_entity, PRIMARY KEY (source, code, valid_from),
  CHECK (valid_to IS NULL OR valid_to > valid_from)
);
CREATE TABLE civica_exec.exec_territory_population (
  entity_id integer REFERENCES civica_exec.exec_entity, year smallint, source smallint, value integer NOT NULL,
  PRIMARY KEY (entity_id, year, source)
);
CREATE INDEX ON civica_exec.exec_territory_population (year, source, value);
CREATE TABLE civica_exec.exec_ref_code (
  ref_id smallint GENERATED ALWAYS AS IDENTITY UNIQUE, domain smallint, code text, valid_from date NOT NULL DEFAULT '1900-01-01', valid_to date,
  canonical_code text, label text NOT NULL, attrs jsonb, PRIMARY KEY (domain, code, valid_from)
);

-- Execução, proveniência e publicação
CREATE TABLE civica_exec.exec_ingestion_run (
  run_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY, dataset_id smallint NOT NULL, uf smallint NOT NULL,   -- uf 0 = escopo nacional
  competence civica_exec.competence NOT NULL, stage smallint NOT NULL DEFAULT 2,                                -- 1 preliminar, 2 definitivo
  status smallint NOT NULL, bootstrap boolean NOT NULL DEFAULT false, started_at timestamptz, finished_at timestamptz,
  parser_version text, rows_in integer, rows_out integer, source_hash bytea NOT NULL, slice_hash bytea, inputs jsonb, quality jsonb, error text,
  UNIQUE (dataset_id, uf, competence, source_hash)
);
CREATE TABLE civica_exec.exec_raw_manifest (
  file_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, run_id integer REFERENCES civica_exec.exec_ingestion_run,
  source_url text NOT NULL, rel_path text NOT NULL, sha256 bytea NOT NULL UNIQUE, bytes bigint NOT NULL, source_modified_at timestamptz,
  competence civica_exec.competence, uf smallint, fetched_at timestamptz, state smallint NOT NULL, retention_class smallint NOT NULL
);
CREATE TABLE civica_exec.exec_publication (
  dataset_id smallint, uf smallint, competence civica_exec.competence,
  run_id integer NOT NULL REFERENCES civica_exec.exec_ingestion_run, previous_run_id integer REFERENCES civica_exec.exec_ingestion_run,
  state smallint NOT NULL, stage smallint NOT NULL, row_count integer NOT NULL, source_hash bytea NOT NULL, activated_at timestamptz NOT NULL,
  PRIMARY KEY (dataset_id, uf, competence)
);
CREATE TABLE civica_exec.exec_change_log (
  run_id integer REFERENCES civica_exec.exec_ingestion_run, seq integer, table_id smallint NOT NULL,
  op "char" NOT NULL CHECK (op IN ('I', 'U', 'D')), pk jsonb NOT NULL, old_row jsonb,
  PRIMARY KEY (run_id, seq)
);
CREATE INDEX ON civica_exec.exec_change_log (run_id, table_id);

-- Saúde: identidade e cadastro por intervalos
CREATE TABLE civica_exec.exec_sau_cnes_estab (
  cnes integer PRIMARY KEY, first_seen civica_exec.competence, last_seen civica_exec.competence,          -- last_seen NULL = vigente
  origin smallint NOT NULL,                                                                                 -- 1 ST, 2 stub criado pelo SIH
  entity_id integer REFERENCES civica_exec.exec_entity, name text, legal_name text, address text, cep integer,
  lat real, lon real, cnpj_maint bigint, descr_updated_at date
);
CREATE TABLE civica_exec.exec_sau_cnes_estab_v (
  cnes integer NOT NULL REFERENCES civica_exec.exec_sau_cnes_estab,
  valid_from civica_exec.competence NOT NULL, valid_to civica_exec.competence,                           -- [valid_from, valid_to); valid_to = 1ª competência em que o estado deixa de valer
  entity_id integer NOT NULL REFERENCES civica_exec.exec_entity, tp_unid smallint, nat_jur smallint, gestao smallint, vinc_sus boolean, flags integer,
  PRIMARY KEY (cnes, valid_from), CHECK (valid_to IS NULL OR valid_to > valid_from)
);
CREATE UNIQUE INDEX ON civica_exec.exec_sau_cnes_estab_v (cnes) WHERE valid_to IS NULL;                  -- no máximo 1 intervalo aberto
CREATE INDEX ON civica_exec.exec_sau_cnes_estab_v (entity_id, valid_from);
CREATE TABLE civica_exec.exec_sau_cnes_leito_v (
  cnes integer NOT NULL REFERENCES civica_exec.exec_sau_cnes_estab, entity_id integer NOT NULL REFERENCES civica_exec.exec_entity,
  tp_leito smallint, cod_leito smallint, valid_from civica_exec.competence NOT NULL, valid_to civica_exec.competence,
  qt_exist integer, qt_sus integer, qt_nsus integer,
  PRIMARY KEY (cnes, tp_leito, cod_leito, valid_from), CHECK (valid_to IS NULL OR valid_to > valid_from)
);
CREATE UNIQUE INDEX ON civica_exec.exec_sau_cnes_leito_v (cnes, tp_leito, cod_leito) WHERE valid_to IS NULL;
CREATE INDEX ON civica_exec.exec_sau_cnes_leito_v (entity_id, valid_from);
CREATE TABLE civica_exec.exec_sau_cnes_equip_v (
  cnes integer NOT NULL REFERENCES civica_exec.exec_sau_cnes_estab, entity_id integer NOT NULL REFERENCES civica_exec.exec_entity,
  tp_equip smallint, cod_equip smallint, valid_from civica_exec.competence NOT NULL, valid_to civica_exec.competence,
  qt_exist integer, qt_uso integer, sus_flag smallint,
  PRIMARY KEY (cnes, tp_equip, cod_equip, valid_from), CHECK (valid_to IS NULL OR valid_to > valid_from)
);
CREATE UNIQUE INDEX ON civica_exec.exec_sau_cnes_equip_v (cnes, tp_equip, cod_equip) WHERE valid_to IS NULL;
CREATE INDEX ON civica_exec.exec_sau_cnes_equip_v (entity_id, valid_from);
CREATE TABLE civica_exec.exec_sau_prof_mun_cbo (
  entity_id integer REFERENCES civica_exec.exec_entity, cbo_group smallint, snapshot_ym civica_exec.competence, vinculos integer, pessoas integer,
  PRIMARY KEY (entity_id, cbo_group, snapshot_ym)
);

-- Saúde: atividade hospitalar (competência de processamento do SIH)
CREATE TABLE civica_exec.exec_sau_hosp_mes_subgrupo (
  cnes integer NOT NULL REFERENCES civica_exec.exec_sau_cnes_estab, competence civica_exec.competence, subgrupo smallint,
  uf smallint NOT NULL,                                                       -- UF do estabelecimento na competência (validada contra exec_sau_cnes_estab_v)
  n_aih integer, valor_cents bigint, dias_perm integer, obitos integer, n_icsap integer,
  PRIMARY KEY (cnes, competence, subgrupo)
);
CREATE INDEX ON civica_exec.exec_sau_hosp_mes_subgrupo (competence, uf);
CREATE TABLE civica_exec.exec_sau_sih_mun_mes (
  entity_id integer REFERENCES civica_exec.exec_entity, competence civica_exec.competence,   -- entity_id: residência (kind 4 ou 5)
  n_aih integer, n_icsap integer, n_fora_mun integer, valor_cents bigint, dias_perm integer, obitos integer,
  PRIMARY KEY (entity_id, competence)
);

-- Indicadores (compartilhado)
CREATE TABLE civica_exec.exec_ind_def (
  indicator_id smallint PRIMARY KEY, code text NOT NULL, method_version smallint NOT NULL DEFAULT 1,
  supersedes_id smallint REFERENCES civica_exec.exec_ind_def, valid_from_period date, valid_to_period date,
  domain smallint NOT NULL, sort_order smallint, label text NOT NULL, unit text, grain char(1) NOT NULL CHECK (grain IN ('M', 'Q', 'S', 'A')),
  direction text, numerator_desc text, denominator_desc text, min_denominator integer, ranking_allowed boolean NOT NULL DEFAULT false,
  aggregation_allowed boolean, null_semantics text, methodology_note text, UNIQUE (code, method_version)
);
CREATE TABLE civica_exec.exec_ind_value (
  indicator_id smallint NOT NULL REFERENCES civica_exec.exec_ind_def, entity_id integer NOT NULL REFERENCES civica_exec.exec_entity,
  period_start date NOT NULL, period_end date NOT NULL, status smallint NOT NULL CHECK (status IN (1, 2)),   -- 1 preliminar, 2 definitivo
  numerator double precision, denominator double precision, value double precision, flags smallint NOT NULL DEFAULT 0,
  run_id integer NOT NULL REFERENCES civica_exec.exec_ingestion_run,
  PRIMARY KEY (indicator_id, entity_id, period_start), CHECK (period_end > period_start)
);
CREATE INDEX ON civica_exec.exec_ind_value (entity_id, indicator_id, period_start);
CREATE TABLE civica_exec.exec_ind_latest (
  indicator_id smallint, entity_id integer, period_start date NOT NULL, status smallint NOT NULL, value double precision,
  numerator double precision, denominator double precision, flags smallint NOT NULL, run_id integer NOT NULL, published_at timestamptz NOT NULL,
  PRIMARY KEY (indicator_id, entity_id),
  FOREIGN KEY (indicator_id, entity_id, period_start) REFERENCES civica_exec.exec_ind_value (indicator_id, entity_id, period_start)
);
CREATE INDEX ON civica_exec.exec_ind_latest (entity_id, indicator_id);

-- Finanças (Siconfi, lista branca) e serving
CREATE TABLE civica_exec.exec_fin_fact (
  entity_id integer REFERENCES civica_exec.exec_entity, exercicio smallint, periodo smallint,                -- periodo: bimestre/quadrimestre/semestre conforme a variante da conta
  conta_id smallint REFERENCES civica_exec.exec_ref_code (ref_id), coluna_id smallint REFERENCES civica_exec.exec_ref_code (ref_id),
  valor bigint NOT NULL,                                                                                      -- unidade (centavos | pontos-base) vem de exec_ref_code(coluna_id)
  PRIMARY KEY (entity_id, exercicio, periodo, conta_id, coluna_id)
);
CREATE TABLE civica_exec.exec_story (
  entity_id integer REFERENCES civica_exec.exec_entity, domain smallint, section text, source_key text, built_at timestamptz, payload jsonb,
  PRIMARY KEY (entity_id, domain, section)
);
`;
