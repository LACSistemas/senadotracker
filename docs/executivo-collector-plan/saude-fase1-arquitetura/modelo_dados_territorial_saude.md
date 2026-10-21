# Modelo de dados territorial e da Saúde Fase 1 (revisão 2)

Data: 2026-10-19 · **Proposta para aprovação.** O DDL abaixo é especificação, nada foi criado. Convenções: `competence` é o tipo `civica_exec.competence` (`yyyymm`, mês 01–12); `period_start` é `date`; IBGE de 7 dígitos em `integer`; valores monetários em centavos (`bigint`). **Intervalos de validade são semiabertos `[valid_from, valid_to)`**.

## 1. Princípios

1. **Um território, uma identidade.** Um registro por entidade em `exec_entity`; domínios apontam por `entity_id`. Nunca um município por domínio, nunca tabela por UF/município.
2. **Território ≠ ente ≠ órgão ≠ Casa legislativa.** `exec_entity` é território. `civica_national.houses` (Casa legislativa) e `civica.profiles.uf` (UF de representação) são Legislativo; a ligação é por igualdade de sigla (`exec_entity.uf`), sem FK.
3. **Residência ≠ atendimento.** `entity_id` em fatos epidemiológicos é a residência; o estabelecimento tem município próprio em `exec_sau_cnes_estab_v`.
4. **Chaves naturais curtas**, sem `revision_id` textual nas linhas de fato.
5. **Cada código vem com sua origem e vigência** (`exec_entity_external_id`, `exec_ref_code`).
6. **Competência nunca é subtraída aritmeticamente.** Encerrar um intervalo grava `valid_to = c`; só `ym_next`/`ym_prev` navegam entre competências.
7. **A visibilidade é a do commit.** `exec_publication` registra e protege; o desfazer é `exec_change_log` (exato) ou replay do RAW (seção 7).

## 2. Modelo lógico

```
exec_entity (BR, regiões, UFs, municípios, município-ignorado-da-UF) ─┬─ exec_entity_version
        ▲                                                             ├─ exec_entity_external_id (código × fonte × vigência)
        │ entity_id                                                    └─ exec_territory_population
 exec_sau_cnes_estab (identidade de TODO CNES) ◄── FK ──┬─ exec_sau_cnes_estab_v (versões [valid_from, valid_to))
                                                         ├─ exec_sau_cnes_leito_v   (intervalos)
                                                         ├─ exec_sau_cnes_equip_v   (intervalos)
                                                         └─ exec_sau_hosp_mes_subgrupo (cnes × mês × subgrupo)
 exec_sau_prof_mun_cbo · exec_sau_sih_mun_mes (por entity_id)
 exec_ind_def (1 linha por versão metodológica) ◄── exec_ind_value ◄── (FK composta) ── exec_ind_latest
 exec_fin_fact · exec_story · exec_ref_code
 exec_ingestion_run ◄── exec_raw_manifest · exec_publication · exec_change_log
```

## 3. Tabelas propostas (21)

| ID | Tabela | Revisão 2 | Camada | PK | FK | Linhas | GiB | Partição | Collector |
|---|---|---|---|---|---|---:|---:|---|---|
| T01 | `civica_exec.exec_entity` | ALTERADA | DIMENSION | `entity_id int` | parent_id → exec_entity | 5.667 | 0,001 | nenhuma | EXEC-C01 |
| T02 | `civica_exec.exec_entity_version` | inalterada | DIMENSION | `(entity_id, valid_from)` | entity_id → exec_entity | 12.000 | 0,001 | nenhuma | EXEC-C01 |
| T03 | `civica_exec.exec_entity_external_id` | ALTERADA | DIMENSION | `(source smallint, code text, valid_from date)` | entity_id → exec_entity | 22.100 | 0,003 | nenhuma | EXEC-C01 |
| T04 | `civica_exec.exec_ref_code` | ALTERADA | DIMENSION | `(domain smallint, code text, valid_from date)` | — | 8.000 | 0,002 | nenhuma | EXEC-C00 |
| T05 | `civica_exec.exec_territory_population` | inalterada | DIMENSION | `(entity_id, year, source)` | entity_id → exec_entity | 156.000 | 0,013 | nenhuma | EXEC-C14 |
| T06 | `civica_exec.exec_ingestion_run` | ALTERADA | PROVENANCE | `run_id integer` | — (dataset_id em exec_ref_code) | 60.000 | 0,017 | nenhuma | EXEC-C00 |
| T07 | `civica_exec.exec_raw_manifest` | inalterada | PROVENANCE | `file_id bigint` | run_id → exec_ingestion_run | 25.000 | 0,008 | nenhuma | EXEC-C00 |
| T08 | `civica_exec.exec_publication` | ALTERADA | PUBLICATION | `(dataset_id, uf, competence)` | run_id, previous_run_id → exec_ingestion_run | 70.000 | 0,009 | nenhuma | EXEC-C00 |
| T09 | `civica_exec.exec_change_log` | NOVA | PUBLICATION | `(run_id, seq)` | run_id → exec_ingestion_run | 1.500.000 | 0,261 | nenhuma (retenção rolante de 12 meses) | EXEC-C00 |
| H01 | `civica_exec.exec_sau_cnes_estab_v` | ALTERADA | NORMALIZED | `(cnes int, valid_from int)` | cnes → exec_sau_cnes_estab; entity_id → exec_entity; tipo/natureza → exec_ref_code | 1.901.184 | 0,240 | nenhuma | EXEC-C21 |
| H02 | `civica_exec.exec_sau_cnes_estab` | ALTERADA (renomeada) | NORMALIZED | `cnes int` | entity_id → exec_entity | 639.639 | 0,240 | nenhuma | EXEC-C21 |
| H03 | `civica_exec.exec_sau_cnes_leito_v` | ALTERADA | NORMALIZED | `(cnes, tp_leito, cod_leito, valid_from)` | cnes → exec_sau_cnes_estab; entity_id → exec_entity | 201.765 | 0,026 | nenhuma | EXEC-C30 |
| H04 | `civica_exec.exec_sau_cnes_equip_v` | ALTERADA | NORMALIZED | `(cnes, tipo, codigo, valid_from)` | cnes → exec_sau_cnes_estab; entity_id → exec_entity | 3.455.558 | 0,458 | nenhuma | EXEC-C30 |
| H05 | `civica_exec.exec_sau_prof_mun_cbo` | inalterada | NORMALIZED | `(entity_id, cbo_group, snapshot_ym)` | entity_id → exec_entity | 1.949.850 | 0,167 | nenhuma | EXEC-C31 |
| H06 | `civica_exec.exec_sau_hosp_mes_subgrupo` | ALTERADA | NORMALIZED | `(cnes, competence, subgrupo)` | cnes → exec_sau_cnes_estab | 5.193.071 | 0,708 | nenhuma na Fase 1 (RANGE por ano se C for aprovado) | EXEC-C32 |
| H07 | `civica_exec.exec_sau_sih_mun_mes` | ALTERADA | NORMALIZED | `(entity_id, competence)` | entity_id → exec_entity | 902.340 | 0,090 | nenhuma | EXEC-C32 |
| H09 | `civica_exec.exec_ind_def` | ALTERADA | DIMENSION | `indicator_id smallint` | supersedes_id → exec_ind_def | 40 | 0,000 | nenhuma | EXEC-C00 |
| H10 | `civica_exec.exec_ind_value` | ALTERADA | NORMALIZED | `(indicator_id, entity_id, period_start)` | entity_id → exec_entity; indicator_id → exec_ind_def | 4.311.755 | 0,624 | nenhuma | por família (derivado em SQL na publicação) |
| H11 | `civica_exec.exec_ind_latest` | ALTERADA | SERVING | `(indicator_id, entity_id)` | entity_id; indicator_id | 80.000 | 0,010 | nenhuma | publicação (trigger lógico no job) |
| H12 | `civica_exec.exec_fin_fact` | ALTERADA | NORMALIZED | `(entity_id, exercicio, periodo, conta_id, coluna_id)` | conta_id/coluna_id → exec_ref_code (conta_id inclui demonstrativo, variante simplificada e anexo) | 2.800.000 | 0,239 | nenhuma | EXEC-C11/C12 |
| H13 | `civica_exec.exec_story` | inalterada | SERVING | `(entity_id, domain, section)` | entity_id → exec_entity | 150 | 0,002 | nenhuma | publicação |

**21 tabelas** em `civica_exec` (9 de fundação/proveniência/publicação, 4 de indicadores/finanças/serving compartilhados, 8 de Saúde). **Nenhuma partição na Fase 1.** Nesta revisão: 15 alteradas, 1 nova, 5 inalteradas.

## 4. Auditoria de integridade das 21 tabelas

| Tabela | PK | FKs | Unicidade / temporalidade | Retificação retroativa |
|---|---|---|---|---|
| `exec_entity` | `entity_id` | `parent_id` | UNIQUE `(kind, ibge7)`; UNIQUE parcial `ibge6` (kind 4, 5) | `exec_entity_version` |
| `exec_entity_version` | `(entity_id, valid_from)` | `entity_id` | intervalos de vigência | nova linha, não edição |
| `exec_entity_external_id` | `(source, code, valid_from)` | `entity_id` | um código tem no máx. uma vigência aberta | nova vigência |
| `exec_territory_population` | `(entity_id, year, source)` | `entity_id` | uma estimativa por fonte e ano | nova vintage no manifesto |
| `exec_ref_code` | `(domain, code, valid_from)` + `ref_id` único | — | rótulos com vigência | nova linha |
| `exec_ingestion_run` | `run_id` | — | UNIQUE `(dataset_id, uf, competence, source_hash)` | novo run |
| `exec_raw_manifest` | `file_id` | `run_id` | UNIQUE `sha256` | — |
| `exec_publication` | `(dataset_id, uf, competence)` | `run_id`, `previous_run_id` | uma publicação ativa por fatia | UPSERT com `previous_run_id` |
| `exec_change_log` | `(run_id, seq)` | `run_id` | `op` ∈ I, U, D | base do rollback |
| `exec_sau_cnes_estab` | `cnes` | `entity_id` | identidade; `first_seen`/`last_seen` | stub → completo |
| `exec_sau_cnes_estab_v` | `(cnes, valid_from)` | `cnes`, `entity_id` | 1 intervalo aberto por CNES; sem sobreposição | `REPLAY_FROM(k)` |
| `exec_sau_cnes_leito_v` | `(cnes, tp_leito, cod_leito, valid_from)` | `cnes`, `entity_id` | idem, por chave | idem |
| `exec_sau_cnes_equip_v` | `(cnes, tp_equip, cod_equip, valid_from)` | `cnes`, `entity_id` | idem | idem |
| `exec_sau_prof_mun_cbo` | `(entity_id, cbo_group, snapshot_ym)` | `entity_id` | 1 linha por referência | substituição da referência |
| `exec_sau_hosp_mes_subgrupo` | `(cnes, competence, subgrupo)` | `cnes` | 1 linha por mês; competência de processamento | upsert da fatia `(competence, uf)` |
| `exec_sau_sih_mun_mes` | `(entity_id, competence)` | `entity_id` (kind 4 ou 5) | idem | idem |
| `exec_ind_def` | `indicator_id` | `supersedes_id` | UNIQUE `(code, method_version)`; períodos de validade sem sobreposição | nova versão |
| `exec_ind_value` | `(indicator_id, entity_id, period_start)` | `indicator_id`, `entity_id`, `run_id` | uma versão metodológica por id; preliminar → definitivo substitui | log do run |
| `exec_ind_latest` | `(indicator_id, entity_id)` | FK composta → `exec_ind_value` | o último valor sempre existe em `exec_ind_value` | recalculado na publicação |
| `exec_fin_fact` | `(entity_id, exercicio, periodo, conta_id, coluna_id)` | `entity_id`, `conta_id`, `coluna_id` | variante (padrão/simplificado) no `conta_id` | substituição da fatia ente × exercício |
| `exec_story` | `(entity_id, domain, section)` | `entity_id` | cache; `source_key` | reconstrução |

Alterações por tabela:

| ID | O que mudou | Correção |
|---|---|---|
| T01 | kind 5 (município ignorado da UF); `ibge6` também para kind 5; CHECK de kind | C06 |
| T03 | PK com `valid_from` (um código pode mudar de dono); `valid_to` | C06 |
| T04 | PK com `valid_from`; `ref_id` para FKs; `canonical_code` | C06, C07 |
| T06 | `run_id integer`; `stage`; `slice_hash`; `bootstrap`; `inputs`; UNIQUE (dataset, uf, competence, source_hash) | C04, C05 |
| T08 | `stage`; `previous_run_id` com FK; deixa de ser o determinante de visibilidade | C04 |
| T09 | `exec_change_log`: rollback exato sem replay | C04 |
| H01 | intervalos semiabertos; FK para identidade; índice único dos abertos; CHECK de ordem | C02, C03 |
| H02 | identidade de todo CNES (13.093 vs 10.270 no ES), stubs do SIH; alvo das FKs | C03 |
| H03 | `entity_id`; semiaberto; FK; único aberto | C02, C03 |
| H04 | `entity_id`; semiaberto; FK; único aberto | C02, C03 |
| H06 | FK para identidade; `uf` documentada como UF do estabelecimento | C03 |
| H07 | `entity_id` pode ser kind 4 ou 5 | C06 |
| H09 | uma linha por versão metodológica; `supersedes_id`; período de validade | C05 |
| H10 | `status`, `period_end`, `run_id integer`, FK de `run_id` | C05 |
| H11 | PK `(indicator_id, entity_id)`; FK composta para `exec_ind_value` | C05 |
| H12 | `conta_id` identifica demonstrativo + variante + anexo + conta; unidade por coluna | C07 |

## 5. Especificação física (DDL proposto, não aplicado)

```sql
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
```

Bits de `flags` (`exec_ind_value`, `exec_ind_latest`): `1` pequeno número, `2` preliminar, `4` cobertura parcial, `8` suprimido, `16` denominador divergente entre fontes, `32` valor acima de 100%.

Observação sobre extensão: um `EXCLUDE USING gist` contra sobreposição exigiria `btree_gist` (disponível, **não instalada**; instalar é alteração do banco e depende de aprovação). A Fase 1 usa o índice único parcial de intervalos abertos + a verificação de sobreposição dentro da transação de publicação.

## 6. Território: reconciliação do 5.571º município

| Fato | Evidência desta investigação |
|---|---|
| Código | **5101837** (6 dígitos: **510183**), Boa Esperança do Norte, MT |
| Presença nas fontes | Lista do IBGE (5.571 itens, sem microrregião); população 2026 = 5.983; CNES ST 2026-09: 14 estabelecimentos; PNI: linhas de 2023 (5), 2024 (22), 2025 (21), 2026 (25); cobertura de APS 2026-08 presente; SINASC e SIM 2024: **nenhum registro** (motivo não investigado); SIH jun/2024: **nenhuma AIH de residente** |
| Condição | Criado por lei estadual de 2000 (7.264/2000), suspenso judicialmente e validado pelo STF em 2023 (ADPF 819); eleição municipal em 2024; **data de instalação não confirmada** (verificar no Diário Oficial de MT ou no cadastro do IBGE) |
| Origem territorial | Desmembrado de Nova Ubiratã (~80%) e Sorriso (~20%), segundo imprensa |
| Universo anterior | O "5.570" incluía **Brasília** e **Fernando de Noronha** como entradas; a lista atual tem 5.571 (um registro para o DF) |

Regras:
1. `exec_entity` recebe o município (`kind 4`, `is_current`) e `exec_entity_version` registra `change_kind=criação`; `valid_from` fica nulo até a data de instalação ser confirmada, com `evidence_ref` apontando para a lista do IBGE.
2. Dados históricos de Nova Ubiratã/Sorriso **não são reatribuídos**. O município só tem série a partir das fontes que já o usam (PNI desde 2023).
3. Indicadores do município novo levam `flags |= 4` até haver nascidos/óbitos próprios; UF soma por `uf_code`, nunca por lista fixa de 5.570 códigos.
4. **Município ignorado:** os códigos `xx0000` do SIM/SINASC/SIH (14 no SINASC 2024) mapeiam, via `exec_entity_external_id`, para a entidade `kind 5` da UF. Somas por UF incluem a entidade; rankings municipais a excluem (`kind = 4`).
5. Aceite: `count(kind=4) = 5571`; `count(kind=3) = 27`; `count(kind=5) = 27`; `ibge6` único; DF presente como UF (53) e como município (5300108); fonte sem dado ⇒ sem linha (nunca zero).
6. Correção da P8: o município sem linha na API de APS é **Itati (4310652)**.

## 7. Publicação, rollback e reprocessamento

### 7.1 O que determina a visibilidade (correção)

Os valores visíveis para qualquer leitor são **os das linhas committadas** nas tabelas de fato. `exec_publication` registra qual execução produziu o estado atual de cada fatia, mas **não filtra** consultas. Por isso: (i) toda escrita de uma fatia — fatos, derivados, change log e ponteiro — acontece numa **única transação**; (ii) os dados anteriores **não permanecem na tabela**: ficam no `exec_change_log` (rollback exato) e no RAW (replay); (iii) o rollback **não é O(1)**.

### 7.2 Publicação (`PUBLISH`) — sequência exata

Pré-condições (fora da transação): arquivos do manifesto em `VERIFIED` com `sha256`; parse para `stg.r<run>_*` (UNLOGGED); `reconcileCandidate` ≠ `FAILED_SAFE`; `exec_ingestion_run` criado (`UNIQUE (dataset_id, uf, competence, source_hash)`: repetido ⇒ `NO_CHANGE`).

```sql
BEGIN;
SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '15min';
SELECT pg_advisory_xact_lock(hashtextextended('civica_exec:' || :dataset || ':' || :uf, 0));
-- 1) base esperada (concorrência otimista)
SELECT run_id, competence INTO base FROM civica_exec.exec_publication
 WHERE dataset_id = :dataset AND uf = :uf AND competence = :comp FOR UPDATE;           -- 0 linhas = primeira publicação
-- 2) guarda de contiguidade (tabelas de intervalo): :comp = civica_exec.ym_next(:last_comp) ou primeira competência; senão ROLLBACK + FAILED_SAFE(GAP)
-- 3) para cada tabela de fato T, na ordem das FKs:
INSERT INTO civica_exec.exec_change_log (run_id, seq, table_id, op, pk, old_row)       -- omitido se :bootstrap
SELECT :run, nextval(...), :tid, 'U', to_jsonb(pk(f)), to_jsonb(f) FROM T f JOIN stg.r<run>_T s USING (pk) WHERE row(f.*) IS DISTINCT FROM row(s.*);
INSERT INTO civica_exec.exec_change_log ... 'D' ... FROM T f WHERE f.<escopo da fatia> AND NOT EXISTS (SELECT 1 FROM stg.r<run>_T s WHERE s.pk = f.pk);
INSERT INTO civica_exec.exec_change_log ... 'I' (só a chave) ... FROM stg s WHERE NOT EXISTS (SELECT 1 FROM T f WHERE f.pk = s.pk);
UPDATE T ...; DELETE FROM T ...; INSERT INTO T ...;                                    -- tabelas de intervalo: close/open do algoritmo da seção 8
-- 4) derivados, SE todas as fatias de entrada estiverem presentes (senão pular e registrar PENDING_INPUT):
--    exec_sau_sih_mun_mes, exec_ind_value (municípios), agregados UF/Brasil recalculados dos numeradores/denominadores,
--    exec_ind_latest; todos com o mesmo :run e registrados no change log
-- 5) verificações dentro da transação (RAISE EXCEPTION ⇒ rollback automático)
SELECT count(*) = :expected_rows FROM <fatia>; SELECT sum(<medida>) = :expected_sum FROM <fatia>;
SELECT count(*) = 0 FROM (SELECT key FROM <T> WHERE valid_to IS NULL GROUP BY key HAVING count(*) > 1) x;       -- ≤ 1 intervalo aberto
SELECT count(*) = 0 FROM <T> a JOIN <T> b ON a.key = b.key AND a.valid_from < b.valid_from AND (a.valid_to IS NULL OR a.valid_to > b.valid_from);  -- sem sobreposição
-- 6) ponteiro e execução
INSERT INTO civica_exec.exec_publication (dataset_id, uf, competence, run_id, previous_run_id, state, stage, row_count, source_hash, activated_at)
VALUES (:dataset, :uf, :comp, :run, :base_run, 1, :stage, :n, :hash, now())
ON CONFLICT (dataset_id, uf, competence) DO UPDATE SET previous_run_id = exec_publication.run_id, run_id = EXCLUDED.run_id,
       state = 1, stage = EXCLUDED.stage, row_count = EXCLUDED.row_count, source_hash = EXCLUDED.source_hash, activated_at = EXCLUDED.activated_at;
UPDATE civica_exec.exec_ingestion_run SET status = 'PUBLISHED', finished_at = now(), slice_hash = :slice_hash WHERE run_id = :run;
COMMIT;
```
Depois do `COMMIT`, e **fora** da atomicidade: reconstrução de `exec_story` da UF (cache; `source_key` mostra se está defasado, mesmo padrão de `house_story`).

Critérios de aceite: (a) nenhuma consulta de teste concorrente vê estado parcial (uma sessão `REPEATABLE READ` lendo em loop durante a publicação só enxerga o antes ou o depois); (b) contagens e somas iguais às do staging; (c) um intervalo aberto por chave e sem sobreposição; (d) publicar de novo o mesmo `source_hash` retorna `NO_CHANGE` sem escrever; (e) falha injetada em qualquer passo deixa tabelas, change log e ponteiro idênticos ao estado anterior; (f) publicar UF A e UF B em paralelo não gera espera cruzada (locks distintos).

### 7.3 Rollback (`ROLLBACK_RUN`) — sequência exata

Elegível somente se (i) o run é o **mais recente** do `(dataset, uf)`; (ii) o change log do run ainda está retido (12 meses) e o run não é `bootstrap`; (iii) `slice_hash` atual = `slice_hash` do run. Caso contrário: **replay** (7.4).

```sql
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('civica_exec:' || :dataset || ':' || :uf, 0));
-- guardas: exec_publication.run_id = :run e slice_hash atual = slice_hash do run; senão ROLLBACK ("use replay")
-- inverso, em ordem decrescente de seq, para fatos E derivados do run:
DELETE FROM T WHERE pk IN (SELECT pk FROM exec_change_log WHERE run_id = :run AND table_id = :tid AND op = 'I');
UPDATE T SET ... FROM exec_change_log (op = 'U', old_row);                      INSERT INTO T SELECT ... (op = 'D', old_row);
-- ponteiro: volta ao run anterior
UPDATE civica_exec.exec_publication SET run_id = previous_run_id, previous_run_id = NULL, activated_at = now() WHERE (dataset_id, uf, competence) = (:dataset, :uf, :comp);
UPDATE civica_exec.exec_ingestion_run SET status = 'ROLLED_BACK' WHERE run_id = :run;
-- verificação: hash da fatia = slice_hash do run anterior; senão RAISE (rollback da própria reversão)
COMMIT;
```
Custo: **O(linhas alteradas pelo run)**, não O(1). Critérios de aceite: estado final com hash idêntico ao anterior à publicação; derivados (`exec_ind_value`, `exec_ind_latest`) voltam junto; reversão repetida é recusada; teste T7 reproduzido em banco de testes.

### 7.4 Reprocessamento / correção retroativa (`REPLAY_FROM(k)`) — sequência exata

```text
Fora da transação:
  1. Listar do manifesto os arquivos das competências k … última da UF; verificar sha256. Arquivo ausente ou divergente ⇒ abortar (nunca "completar" com versão nova sem registrar nova linha no manifesto).
  2. Parsear cada competência em stg.rb<run>_* e construir os intervalos reconstruídos da UF (algoritmo rebuild_from).
  3. Pré-validar: para cada competência c em k … última, o número de intervalos ativos em c = linhas do snapshot c.
Dentro de UMA transação:
  BEGIN; lock advisory (dataset, uf);
  verificar que exec_publication.run_id das competências afetadas = base esperada (senão ROLLBACK);
  registrar no change log (op 'U'/'D') todos os intervalos da UF com valid_from >= k OU valid_to >= k (imagem anterior);
  DELETE desses intervalos; INSERT dos reconstruídos;
  recalcular derivados dos períodos k … última (mesmo run, mesmo log);
  verificar: 1 intervalo aberto por chave, sem sobreposição, contagem por competência igual à do snapshot;
  UPSERT exec_publication de CADA competência afetada (novo run_id; previous_run_id preservado);
  COMMIT.
```
Falha em qualquer ponto ⇒ rollback automático: o estado publicado é o anterior (nunca "meio corrigido"). Critérios de aceite: igual ao resultado de reconstruir do zero (teste T5, propriedade verificada); reexecução idempotente (`NO_CHANGE`); outras UFs inalteradas; consultas concorrentes veem antes ou depois.

### 7.5 Perguntas da auditoria, respondidas

| Pergunta | Resposta |
|---|---|
| O ponteiro determina quais valores são visíveis? | **Não.** Visível = último commit. O ponteiro é registro/portão. |
| Rollback restaura os fatos anteriores? | **Sim**, pelo change log, para o run mais recente da fatia e dentro de 12 meses; **não** para runs antigos ou bootstrap (replay). |
| Dados antigos permanecem? | Só no change log (linhas alteradas) e no RAW; **não** como linhas ativas. |
| Publicação de uma UF interfere na outra? | Não: lock e fatia distintos; tabelas compartilhadas, mas MVCC e chaves disjuntas. |
| Derivados consistentes com fatos? | Sim por construção: mesma transação, mesmo `run_id`; sem entradas completas não há derivado. |
| Falha no meio de correção histórica? | Rollback total automático; nada parcial é publicado. |

## 8. Histórico por intervalos

Regras (intervalos `[valid_from, valid_to)`, **sem subtração de competência**). Ao publicar a competência *c* de uma UF:
1. **Guarda de contiguidade:** *c* deve ser `ym_next(última competência publicada)` (ou a primeira). Caso contrário `FAILED_SAFE(GAP)`: uma lacuna de arquivos não pode fechar ou abrir intervalos.
2. Para cada chave do arquivo *c*: sem intervalo aberto → abrir com `valid_from = c` (novo ou reaparecido); com intervalo aberto e valores diferentes → fechar com `valid_to = c` e abrir novo com `valid_from = c`; valores iguais → nada.
3. Chaves com intervalo aberto e ausentes de *c* → fechar com `valid_to = c`.
4. **Correção retroativa da competência *k*:** `REPLAY_FROM(k)` (seção 7.4): reabrir os intervalos com `valid_from < k ≤ valid_to`, descartar os com `valid_from ≥ k` e reaplicar os snapshots *k … última* a partir do RAW, numa transação.

Estado numa competência *c*: `valid_from <= c AND (valid_to IS NULL OR valid_to > c)`.

```sql
-- Leitos SUS do Hospital X em 01/2018 e 09/2026
SELECT t.competence, sum(l.qt_sus) AS leitos_sus
FROM (VALUES (201801), (202609)) AS t(competence)
JOIN civica_exec.exec_sau_cnes_leito_v l
  ON l.cnes = :cnes AND l.valid_from <= t.competence AND (l.valid_to IS NULL OR l.valid_to > t.competence)
GROUP BY t.competence ORDER BY 1;
```
Se o estabelecimento não existia na competência, a linha da competência não aparece (ausência ≠ zero).

### 8.1 Testes de mesa

Executados com uma implementação de referência em Python (fora do repositório) que aplica exatamente as regras da seção 8; todos os asserts passaram. Convenção: intervalo `[valid_from, valid_to)`; `∅` = vigente. Chave `H1`, valores `(existentes, SUS)`.

| # | Cenário | Entrada | Resultado (tabela de intervalos) | Verificação |
|---|---|---|---|---|
| T1 | Dezembro/2024 → janeiro/2025 | 202411 (10,6); 202412 (10,6); 202501 (12,7) | `H1 [202411, 202501) = (10,6)`; `H1 [202501, ∅) = (12,7)` | `202501 − 1 = 202500` é inválido; `ym_prev(202501) = 202412` e `ym_next(202412) = 202501`; em 202412 vale (10,6), em 202501 vale (12,7) |
| T2 | Mudança de leitos numa competência | 202301 (10,6); 202302 (10,7); 202303 (10,7) | `[202301, 202302) = (10,6)`; `[202302, ∅) = (10,7)` | competências iguais não geram linha nova; 202303 = (10,7) |
| T3 | Desaparecimento | `H1` em 202306; ausente de 202307 a 202312 | `H1 [202306, 202307) = (10,6)` | em 202307 e 202312 `H1` não existe |
| T4 | Reaparecimento | `H1` volta em 202401 com (8,4) | `H1 [202401, ∅) = (8,4)` (segundo intervalo; **sem preencher** o buraco) | 202307–202312 continuam ausentes; no máx. 1 intervalo aberto por chave |
| T4b | Competência pulada | publicar 202403 depois de 202401 | `GapError: competência 202403 não é a seguinte a 202401 (esperada 202402)` | nada é fechado nem aberto; publicação `FAILED_SAFE` |
| T5 | Correção retroativa da competência 202203 | série 202201–202206: (10,6) até 202204, (12,8) desde 202205; DATASUS republica 202203 com (10,5) | antes: `[202201, 202205) = (10,6)`, `[202205, ∅) = (12,8)`; depois: `[202201, 202203) = (10,6)`, `[202203, 202204) = (10,5)`, `[202204, 202205) = (10,6)`, `[202205, ∅) = (12,8)` | 202202 = (10,6); 202203 = (10,5); 202204 = (10,6); 202205 = (12,8); o resultado é igual ao de reconstruir tudo do zero |
| T6 | Duas versões metodológicas | `IND-SAU-01` AB (id 101, período ≤ 202012) e APS (id 102, ≥ 202112) para Vitória | duas linhas em `exec_ind_def`; valores `(101, Vitória, 202012) = 92,28` e `(102, Vitória, 202112) = 92,46` | nenhuma sobreposição de períodos entre versões; lacuna 202101–202111 **declarada**, sem interpolação |
| T7 | Preliminar substituída por definitiva | `IND-08` Vitória 2024: preliminar 11,2 (status 1, run 10) → definitiva 10,6 (status 2, run 11) | mesma PK, agora 10,6/status 2; `exec_change_log` guarda a linha anterior (11,2) | rollback do run 11 restaura 11,2/status 1/run 10 |

Evidência de que os cenários T3/T4 ocorrem: no ES (2013-01…2026-09) houve **4.485 desaparecimentos** e **1.662 reaparecimentos** de CNES.

Cinco datas distintas, nunca misturadas: **data do acontecimento** (quando existe), **competência**, **publicação** (`exec_publication.activated_at`), **ingestão** (`exec_ingestion_run.started_at`) e **versão da fonte** (`sha256` + `source_modified_at`). Limites declarados: profissionais (PF) são agregados de dezembro + última competência; a atividade hospitalar é mensal por competência de processamento, não de alta.

## 9. Contratos de ingestão (por família)

Todos os collectors seguem `CollectorProvider` e produzem, por fatia `(dataset, uf, competence, stage)`: `manifest` (provider, versão, fonte, `FAIL_CLOSED`), `files[]` (`rel_path`, `sha256`, `bytes`, `source_modified_at`), `rows` com `entity_id` já resolvido (código sem correspondência bloqueia acima de limiar), `reconciliation` (`PublicationReconciliation`) e `status` (`PUBLISH`, `NO_CHANGE`, `FAILED_SAFE`). Reaproveitam `reconcileCandidate`, `CollectorRuntime`, locks advisory e `civica_ops.scheduler_*`.

## 10. Dicionário de códigos e compartilhamento

`exec_ref_code(domain, code, valid_from)` concentra `TP_UNID`, `NAT_JUR`, `TP_LEITO`/`CODLEITO`, `CBO → grupo`, imunobiológico (36 rótulos → `canonical_code`), subgrupo SIGTAP, grupos ICSAP (188 códigos), função/subfunção e colunas do Siconfi.

| Estrutura | Compartilhar? | Motivo |
|---|---|---|
| `exec_entity*`, `exec_territory_population` | **Sim, todos os domínios** | identidade e denominadores únicos |
| `exec_ref_code`, `exec_ind_def`, `exec_ind_value`, `exec_ind_latest` | **Sim** | indicador territorial tem a mesma forma em qualquer domínio |
| `exec_fin_fact` (lista branca) | **Sim** | o mesmo payload do Siconfi serve Saúde, Educação, Segurança… |
| `exec_ingestion_run`, `exec_raw_manifest`, `exec_publication`, `exec_change_log` | **Sim** | proveniência, publicação e desfazer |
| `exec_sau_cnes_*`, `exec_sau_hosp_*`, `exec_sau_sih_*`, `exec_sau_prof_*` | **Não** | granularidade própria e semântica residência × atendimento |
| Educação, Segurança, Infraestrutura, Bem-estar | **Específicas** por domínio, ligadas a `entity_id`, com derivados em `exec_ind_value` | não colapsar em tabela genérica |


---

## Revisão 2 — correções que afetam este arquivo

| ID | Diagnóstico anterior | Evidência nova | Correção | Impacto na arquitetura | Impacto no armazenamento | Impacto no plano |
|---|---|---|---|---|---|---|
| **C02** Aritmética de competência (`yyyymm − 1`) | O algoritmo de intervalos fechava versões com `valid_to = c − 1`. Para `c = 202501` isso dá `202500`, que não é competência. | Teste de mesa executado: `202501 − 1 = 202500` (inválido). Implementação de referência com `ym_prev`/`ym_next` e `CHECK` de mês 01–12 passou nos 7 cenários, incluindo dezembro → janeiro. | Intervalos **semiabertos** `[valid_from, valid_to)`: encerrar = gravar `valid_to = c` (competência em que o estado deixa de valer). Nenhuma subtração. Funções `ym_next`/`ym_prev` (SQL) só para a guarda de contiguidade; tipo `civica_exec.competence` com `CHECK`. | Todas as tabelas de intervalo (`exec_sau_cnes_estab_v`, `_leito_v`, `_equip_v`) e consultas passam a usar `valid_to > c`. | nenhum | Critério de aceite da Fase 1A inclui os 7 testes de mesa como testes automatizados. |
| **C03** Integridade referencial de estabelecimentos históricos | Leitos, equipamentos e versões apontavam para `exec_sau_cnes_estab_cur`, que só tinha estabelecimentos vigentes (501.726). | No ES, 165 competências têm **13.093 CNES distintos** contra 10.270 vigentes (×1,275); 4.485 desaparecimentos e **1.662 reaparecimentos**. Uma FK para a tabela "atual" violaria a integridade para qualquer estabelecimento encerrado. | `exec_sau_cnes_estab_cur` vira `exec_sau_cnes_estab`: identidade de **todo** CNES já visto (+ stubs de CNES só vistos no SIH) e atributos descritivos atuais. É o alvo de todas as FKs (`_v`, leitos, equipamentos, `exec_sau_hosp_mes_subgrupo`). | Ordem de carga: identidade antes dos fatos; SIH cria stubs para CNES desconhecido (nunca órfãos). | +0,05 GiB (639.639 linhas em vez de 501.726) | Família 2 passa a construir a identidade a partir de todas as competências. |
| **C04** O ponteiro não determina a visibilidade; rollback não é O(1) | A seção 7 atualizava as linhas de fato **no lugar** e apontava `exec_publication` para o novo `run_id`; a seção 6 do plano falava em rollback por `previous_run_id`. | Com mutação no lugar, os valores visíveis são os do último `COMMIT`; o ponteiro apenas registra. Os dados antigos deixam de existir na tabela: voltar exige reaplicar o inverso ou reprocessar o RAW. Não é O(1). | Ponteiro redefinido como **registro e portão** (cobertura, idempotência, base para rollback). Rollback exato por **`exec_change_log`** (O(linhas alteradas), só para a publicação mais recente da fatia); fora disso, **replay do RAW**. Sequências transacionais exatas de publicação, rollback e reprocessamento com critérios de aceite. | Nova tabela `exec_change_log`; `slice_hash` em `exec_ingestion_run`; indicadores derivados são gravados e registrados na mesma transação dos fatos. | +0,26 GiB (`exec_change_log`, retenção rolante de 12 meses) | Fase 0 inclui `exec_change_log`; teste de rollback é critério de aceite da Fase 0. |
| **C05** Unicidade e temporalidade dos indicadores | `exec_ind_value` tinha PK `(indicator_id, entity_id, period_start)` sem lugar para duas metodologias nem para preliminar/definitivo; `run_id` era `integer` numa tabela e `bigint` em outra. | A cobertura de APS tem duas metodologias sem sobreposição (AB até 202012; APS desde 202112) e o SINASC/SIM publica preliminar e definitivo do mesmo ano. | Uma linha de `exec_ind_def` por **versão metodológica** (ids distintos, `supersedes_id`, `valid_from_period`/`valid_to_period`); `status` (1 preliminar, 2 definitivo) em `exec_ind_value`; definitivo **substitui** preliminar na mesma PK (o valor anterior fica no change log e no RAW); `period_end` explícito; `run_id integer` em todas as tabelas. | Séries que cruzam versões são montadas por união explícita; a lacuna 2021 é declarada, não interpolada. | +0,04 GiB (colunas extras) | Fase 1B/1D publicam só versões com definição aprovada. |
| **C06** Reconciliação dos códigos IBGE | Fatos de SIM/SINASC/SIH com município `xx0000` ("ignorado") não tinham entidade; `exec_entity_external_id` e `exec_ref_code` não admitiam reuso de código ao longo do tempo. | 14 códigos `xx0000` em 2024 no SINASC; `ibge6` é único nos 5.571 municípios (5.571/5.571); PNI traz o município novo desde 2023, SIM/SINASC/SIH ainda não. | `exec_entity.kind = 5` ("município ignorado da UF", 27 linhas) para somar corretamente por UF sem entrar em ranking municipal; PK de `exec_entity_external_id` e `exec_ref_code` com `valid_from`; regra explícita 6↔7 dígitos; guarda de contiguidade. | Universo: 5.571 municípios + 27 "ignorados" + 27 UFs + 5 regiões + Brasil = 5.667 entidades. | desprezível | Fase 0: seeds com 5.667 entidades e teste de reconciliação. |
| **C07** Chaves e unidades de `exec_fin_fact` | A PK `(entity_id, exercicio, periodo, conta_id, coluna_id)` não distinguia RREO bimestral de RREO Simplificado semestral nem unidade de coluna. | 64 de 150 municípios sorteados usam formulário simplificado; colunas têm unidades diferentes (R$, % da RCL). | `conta_id` identifica (demonstrativo, variante, anexo, conta) e mapeia para conta canônica; unidade (centavos, pontos-base) vem do dicionário da coluna. | Comparação entre entes usa a conta canônica. | nenhum | Família 11: dicionário de contas antes da carga. |
| **C08** Retificações retroativas de intervalos | A regra de correção retroativa estava em prosa e sem prova. | Teste de mesa T5: republicar 202203 com SUS 6→5 produz o mesmo resultado que reconstruir tudo do zero. | Algoritmo `rebuild_from(k)` transacional com guarda de contiguidade, verificação de no máximo um intervalo aberto por chave e ausência de sobreposição. | Exige RAW das competências k…última. | nenhum | RAW do CNES é retenção obrigatória. |

