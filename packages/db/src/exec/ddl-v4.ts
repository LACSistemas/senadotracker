// DDL v4 do schema civica_exec: Sistema Prisional (P9.4, SISDEPEN/SENAPPEN). Seis tabelas, todas SEM dado pessoal de custodiado, sem endereço, CEP ou telefone:
//  - exec_pri_unit: identidade INTERNA do Cívica de um estabelecimento (o SISDEPEN não publica identificador estável; unit_id NÃO é código oficial);
//  - exec_pri_obs: observação do estabelecimento por ciclo semestral (snapshot institucional: nome original, município, tipo, sexo de destinação, gestão);
//  - exec_pri_fact: fatos por estabelecimento × ciclo × medida (capacidade 1.3 e população 4.1). Só células preenchidas: célula vazia = SEM linha (≠ zero declarado);
//  - exec_pri_measure: catálogo das medidas (id → bloco, regime, sexo, jurisdição, rótulo oficial);
//  - exec_pri_xwalk: crosswalk linha do ciclo → unit_id, com método, evidência, confiança e estado de revisão;
//  - exec_pri_cov: cobertura/continuidade por UF × ciclo (o arquivo só contém respostas validadas: o universo esperado NÃO consta da fonte).
// Agregados territoriais (município, UF, Brasil) ficam em exec_ind_value. Reversível: DROP das seis tabelas (nada fora delas depende delas).
export const EXEC_DDL_V4 = `
CREATE TABLE civica_exec.exec_pri_unit (
  unit_id           integer PRIMARY KEY,
  uf                smallint NOT NULL,
  ambito            smallint NOT NULL CHECK (ambito IN (1, 2)),               -- 1 estadual, 2 federal (do ciclo mais recente)
  first_competence  civica_exec.competence NOT NULL,
  last_competence   civica_exec.competence NOT NULL,
  canonical_name    text NOT NULL,                                            -- nome do ciclo mais recente (os nomes originais de cada ciclo ficam em exec_pri_obs)
  key_kind          smallint NOT NULL DEFAULT 1                               -- 1 = chave interna do Cívica (única existente: a fonte não tem código oficial)
);
CREATE INDEX ON civica_exec.exec_pri_unit (uf);
CREATE TABLE civica_exec.exec_pri_obs (
  unit_id      integer NOT NULL REFERENCES civica_exec.exec_pri_unit,
  competence   civica_exec.competence NOT NULL,                               -- fim do semestre: AAAA06 (1º) ou AAAA12 (2º)
  uf           smallint NOT NULL,
  cycle        smallint NOT NULL,                                             -- ciclo SISDEPEN (1 = 2016/2 … 19 = 2025/2)
  source_name  text NOT NULL,                                                 -- nome original no ciclo
  other_names  text,
  entity_id    integer REFERENCES civica_exec.exec_entity,                    -- município (kind 4); NULL = município não conciliado
  ibge7        integer,
  tipo         smallint NOT NULL CHECK (tipo IN (1, 2, 3)),                   -- 1 cela física, 2 domiciliar SEM monitoramento eletrônico, 3 domiciliar COM monitoramento
  ambito       smallint NOT NULL CHECK (ambito IN (1, 2)),
  sex_dest     smallint CHECK (sex_dest IN (1, 2, 3)),                        -- 1 masculino, 2 feminino, 3 misto (item 1.1)
  gestao       smallint,                                                      -- 1 pública, 2 cogestão, 3 PPP, 4 organização sem fins lucrativos (item 1.4)
  row_no       integer NOT NULL,                                              -- linha no arquivo do ciclo (rastreabilidade)
  PRIMARY KEY (unit_id, competence)
);
CREATE INDEX ON civica_exec.exec_pri_obs (competence, uf);
CREATE INDEX ON civica_exec.exec_pri_obs (entity_id, competence) WHERE entity_id IS NOT NULL;
CREATE TABLE civica_exec.exec_pri_measure (
  measure_id  smallint PRIMARY KEY,
  code        text NOT NULL UNIQUE,
  block       text NOT NULL,                                                  -- '1.3 capacidade' | '4.1 população'
  label       text NOT NULL,                                                  -- cabeçalho oficial da coluna
  note        text NOT NULL
);
CREATE TABLE civica_exec.exec_pri_fact (
  unit_id     integer NOT NULL,
  competence  civica_exec.competence NOT NULL,
  measure_id  smallint NOT NULL REFERENCES civica_exec.exec_pri_measure,
  value       integer NOT NULL CHECK (value >= 0),                            -- 0 = zero DECLARADO; célula vazia não tem linha
  PRIMARY KEY (unit_id, competence, measure_id)                              -- sem FK para exec_pri_obs: o motor de publicação aplica tabela a tabela (snapshot) e o log inverso precisa de ordem livre
);
CREATE TABLE civica_exec.exec_pri_xwalk (
  competence   civica_exec.competence NOT NULL,
  row_no       integer NOT NULL,
  uf           smallint NOT NULL,
  unit_id      integer NOT NULL REFERENCES civica_exec.exec_pri_unit,
  source_name  text NOT NULL,
  source_city  text NOT NULL,
  ibge7        integer,
  method       smallint NOT NULL,                                             -- 1 nome+município exatos; 2 mesmo CEP e município, nome diferente; 3 mesmo CEP e nome, município diferente; 0 unidade nova; 9 candidatos ambíguos (separada)
  confidence   smallint NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  review       smallint NOT NULL CHECK (review IN (0, 1)),                    -- 1 = exige validação humana antes de uso longitudinal
  evidence     text NOT NULL,
  PRIMARY KEY (competence, row_no)
);
CREATE INDEX ON civica_exec.exec_pri_xwalk (unit_id, competence);
CREATE INDEX ON civica_exec.exec_pri_xwalk (competence, uf);
CREATE TABLE civica_exec.exec_pri_cov (
  competence        civica_exec.competence NOT NULL,
  uf                smallint NOT NULL,
  rows_in_file      integer NOT NULL,                                         -- estabelecimentos no arquivo (só respostas validadas)
  cela              integer NOT NULL,
  dom_sem           integer NOT NULL,
  dom_com           integer NOT NULL,
  federal           integer NOT NULL,
  new_units         integer NOT NULL,                                         -- unidades que nunca apareceram em ciclo anterior
  continuing        integer NOT NULL,                                         -- unidades reconhecidas em ciclo anterior
  absent_vs_prev    integer NOT NULL,                                         -- unidades vistas antes e ausentes neste ciclo (NÃO é encerramento comprovado)
  cap_incomplete    integer NOT NULL,                                         -- celas físicas sem capacidade utilizável (célula esperada vazia)
  unassigned_mun    integer NOT NULL,                                         -- estabelecimentos sem município conciliado
  PRIMARY KEY (competence, uf)
);
`;
