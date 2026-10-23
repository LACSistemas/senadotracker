// DDL v3 do schema civica_exec: Trânsito e Segurança Viária (P9.2). Três tabelas tipadas, todas SEM dado pessoal e sem sinistro individualizado:
//  - exec_tra_frota_mun_mes: frota registrada por município × mês × tipo (largura fixa de 22 colunas, mesmo padrão de exec_sau_sih_mun_mes);
//  - exec_tra_infr_uf_mes: notificações de penalidade por UF de jurisdição × mês × código de infração (RENAINF);
//  - exec_tra_cov: cobertura de relato por fonte × UF × mês (RENAEST e PRF). exec_seg_cov (P9.1) é específica do VDE (indicator_id/abrangência) e NÃO foi reutilizada.
// Reversível: DROP TABLE das três (nada depende delas). Valores NULL na frota = célula vazia na fonte (≠ 0).
export const EXEC_DDL_V3 = `
CREATE TABLE civica_exec.exec_tra_frota_mun_mes (
  entity_id     integer NOT NULL REFERENCES civica_exec.exec_entity,       -- município (kind 4) ou município ignorado da UF (kind 5)
  competence    civica_exec.competence NOT NULL,                           -- mês do instantâneo publicado pelo Senatran
  total         integer,
  automovel integer, bonde integer, caminhao integer, caminhao_trator integer, caminhonete integer, camioneta integer, chassi_plataf integer, ciclomotor integer,
  micro_onibus integer, motocicleta integer, motoneta integer, onibus integer, quadriciclo integer, reboque integer, semi_reboque integer, side_car integer,
  outros integer, trator_esteira integer, trator_rodas integer, triciclo integer, utilitario integer,
  PRIMARY KEY (entity_id, competence)
);
CREATE INDEX ON civica_exec.exec_tra_frota_mun_mes (competence);
CREATE TABLE civica_exec.exec_tra_infr_uf_mes (
  uf            smallint NOT NULL,                                         -- UF de JURISDIÇÃO do veículo (não o local da infração)
  competence    civica_exec.competence NOT NULL,
  cod_infracao  smallint NOT NULL,                                         -- código RENAINF
  qtde          integer NOT NULL CHECK (qtde >= 0),
  PRIMARY KEY (uf, competence, cod_infracao)
);
CREATE INDEX ON civica_exec.exec_tra_infr_uf_mes (competence);
CREATE TABLE civica_exec.exec_tra_cov (
  source        smallint NOT NULL CHECK (source IN (1, 2)),                -- 1 RENAEST, 2 PRF
  uf            smallint NOT NULL,
  competence    civica_exec.competence NOT NULL,
  records       integer NOT NULL,                                          -- sinistros no UF × mês na fonte
  fatal_records integer NOT NULL,                                          -- sinistros com óbito (RENAEST) / com vítima fatal (PRF)
  municipalities integer NOT NULL,                                         -- municípios distintos com registro
  universe      integer NOT NULL,                                          -- municípios que a fonte lista para a UF no mês (RENAEST: tabela Localidade; PRF: 0 = não informa)
  scope         smallint NOT NULL CHECK (scope IN (1, 2, 3)),              -- 1 registros presentes (escopo desconhecido) · 2 restrito a fatais (INFERIDO dos dados) · 3 sem registros
  PRIMARY KEY (source, uf, competence)
);
CREATE INDEX ON civica_exec.exec_tra_cov (competence);
`;
