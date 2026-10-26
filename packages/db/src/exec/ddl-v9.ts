// DDL v9 do schema civica_exec: cadastro nacional e histórico das escolas (P10.1, Censo Escolar INEP). Três tabelas, aditivas, sem dado pessoal:
//  - exec_edu_school: a IDENTIDADE (código INEP, 8 dígitos, chave natural) — alvo das chaves estrangeiras das ondas P10.2+ (matrículas, infraestrutura, Ideb, programas).
//  - exec_edu_school_year: um registro por escola × edição do Censo (município, nome, dependência, localização, situação, indicadores de universo). O histórico institucional
//    (mudança de nome, município, dependência, situação) é a comparação entre edições consecutivas (LAG), não uma segunda cópia dos atributos.
//  - exec_edu_cov: cobertura por edição × UF (linhas do arquivo, válidas, rejeitadas, universos), contrato de leitura das contagens.
// exec_entity NÃO é alterada (o CHECK de kind permanece); a escola se liga ao município por exec_edu_school_year.entity_id.
// Reversível: DROP das três tabelas (nenhuma tabela existente depende delas).
export const EXEC_DDL_V9 = `
CREATE TABLE civica_exec.exec_edu_school (
  inep integer PRIMARY KEY CHECK (inep BETWEEN 10000000 AND 99999999)
);
CREATE TABLE civica_exec.exec_edu_school_year (
  inep      integer  NOT NULL REFERENCES civica_exec.exec_edu_school DEFERRABLE INITIALLY DEFERRED,   -- a identidade é gravada no mesmo run, depois do registro (derive)
  year      smallint NOT NULL CHECK (year BETWEEN 1995 AND 2100),
  entity_id integer  NOT NULL REFERENCES civica_exec.exec_entity,       -- município de registro NAQUELA edição
  name      text     NOT NULL,
  dep       smallint NOT NULL CHECK (dep BETWEEN 1 AND 4),               -- 1 federal, 2 estadual, 3 municipal, 4 privada
  loc       smallint CHECK (loc IN (1, 2)),                              -- 1 urbana, 2 rural; NULL = não informado
  sit       smallint NOT NULL CHECK (sit BETWEEN 0 AND 4),               -- 1 em atividade, 2 paralisada, 3 extinta (no ano), 4 extinta em anos anteriores; 0 = situação não existe no layout da edição
  flags     smallint NOT NULL DEFAULT 0,                                 -- bit0 matrícula na educação básica > 0; bit1 universo da Sinopse (quando reproduzível); bit2 nome ausente no arquivo
  PRIMARY KEY (inep, year)
);
CREATE INDEX exec_edu_school_year_ent ON civica_exec.exec_edu_school_year (year, entity_id);
CREATE TABLE civica_exec.exec_edu_cov (
  year      smallint NOT NULL,
  uf        smallint NOT NULL,                                           -- código IBGE da UF
  layout    smallint NOT NULL,                                           -- família de layout do arquivo (ver educacao-build.ts)
  rows_in   integer  NOT NULL,                                           -- linhas lidas do arquivo oficial da UF
  valid     integer  NOT NULL,                                           -- linhas aceitas (viram snapshot)
  rejected  integer  NOT NULL,
  active    integer  NOT NULL,                                           -- sit = 1
  with_mat  integer  NOT NULL,                                           -- bit0
  univ      integer,                                                     -- bit1 (NULL quando o universo não é reproduzível na edição)
  muns      smallint NOT NULL,                                           -- municípios com pelo menos uma escola no arquivo
  PRIMARY KEY (year, uf)
);
`;
