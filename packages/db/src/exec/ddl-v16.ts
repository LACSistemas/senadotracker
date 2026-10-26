// DDL v16 do schema civica_exec: contratações, obras e investimentos na Educação (P10.7). Extensão ADITIVA (nada das ondas anteriores é alterado).
//  - exec_edu_contract: UM registro por contrato do PNCP classificado como educacional (RAW local, 5,1 milhões de contratos lidos). Não duplica exec_fin_contract (contratos de Segurança): os
//    contratos que também são de Segurança aparecem nas duas tabelas e as somas entre domínios devem deduplicar por pncp_id. O fornecedor PJ reutiliza exec_fin_supplier (upsert por CNPJ);
//    pessoa física nunca é persistida. Valores em centavos: valor_global é o valor CONTRATADO (não é pago, não é executado); NULL = não informado.
//  - exec_edu_contract_class: classificação auditável (categoria, eixo, regra, confiança, evidência) com versão no run; um contrato pode ter mais de uma categoria.
//  - exec_edu_procurement: a contratação (compra/licitação) a que o contrato pertence: valor estimado e homologado, modalidade, situação.
//  - exec_edu_contract_term: termos aditivos, apostilamentos e rescisões publicados no PNCP.
//  - exec_edu_work / exec_edu_work_commit: obras do Obrasgov (execução física e empenhos oficiais). Obra ≠ contrato ≠ pagamento; empenho ≠ pago.
//  - exec_edu_contract_audit: veredito da revisão amostral da classificação (proveniência da precisão medida).
//  - exec_edu_ctr_cov: cobertura por fonte × ano × UF.
// Reversível: DROP das tabelas (nenhuma tabela anterior depende delas).
export const EXEC_DDL_V16 = `
CREATE TABLE civica_exec.exec_edu_contract (
  pncp_id text PRIMARY KEY,                                          -- numeroControlePNCP
  year smallint NOT NULL,                                            -- ano do pacote de publicação do PNCP (fatia)
  uf smallint NOT NULL,                                              -- UF da unidade do órgão; 0 = sem UF informada
  entity_id integer NOT NULL REFERENCES civica_exec.exec_entity (entity_id),   -- ente do órgão: município (esfera M), UF (E/D) ou Brasil (F)
  esfera char(1) NOT NULL,
  org_cnpj bigint NOT NULL,
  buyer smallint NOT NULL CHECK (buyer BETWEEN 0 AND 5),             -- 0 comprador que não é órgão de educação (classificado só pelo objeto), 1 MEC/FNDE/INEP, 2 secretaria, 3 fundo, 4 departamento, 5 unidade escolar
  best_confidence smallint NOT NULL CHECK (best_confidence BETWEEN 1 AND 3),   -- 1 CONFIRMED_OFFICIAL, 2 HIGH_CONFIDENCE_DERIVED, 3 POSSIBLE_EDUCATION
  tipo smallint NOT NULL,                                            -- tipoContrato.id do PNCP (7 = Empenho)
  categoria smallint NOT NULL,                                       -- categoriaProcesso.id
  valor_global bigint CHECK (valor_global >= 0),                     -- centavos CONTRATADOS (não é pago); NULL = não informado
  valor_inicial bigint CHECK (valor_inicial >= 0),
  valor_acumulado bigint CHECK (valor_acumulado >= 0),
  outlier boolean NOT NULL DEFAULT false,                            -- valor global acima de R$ 10 bilhões: erro de digitação na origem, fora das somas
  signed date, vig_start date, vig_end date,
  supplier bigint,                                                   -- CNPJ do fornecedor PJ (exec_fin_supplier); NULL = pessoa física ou ausente
  empenho text,                                                      -- número do empenho quando o registro é do tipo Empenho
  retif smallint NOT NULL DEFAULT 0,
  compra text,                                                       -- numeroControlePncpCompra (exec_edu_procurement.compra)
  cipi text,                                                         -- identificadorCipi: chave oficial do projeto no Obrasgov (exec_edu_work.work_id)
  seq integer NOT NULL DEFAULT 0,                                    -- sequencialContrato no órgão
  objeto text NOT NULL                                               -- objeto do contrato (texto público do PNCP, até 1.000 caracteres)
);
CREATE INDEX exec_edu_contract_entity_idx ON civica_exec.exec_edu_contract (entity_id, year);
CREATE INDEX exec_edu_contract_scope_idx ON civica_exec.exec_edu_contract (year, uf);
CREATE INDEX exec_edu_contract_supplier_idx ON civica_exec.exec_edu_contract (supplier) WHERE supplier IS NOT NULL;
CREATE INDEX exec_edu_contract_compra_idx ON civica_exec.exec_edu_contract (compra) WHERE compra IS NOT NULL;
CREATE INDEX exec_edu_contract_cipi_idx ON civica_exec.exec_edu_contract (cipi) WHERE cipi IS NOT NULL;
CREATE TABLE civica_exec.exec_edu_contract_class (
  pncp_id text NOT NULL REFERENCES civica_exec.exec_edu_contract (pncp_id) DEFERRABLE INITIALLY DEFERRED,
  year smallint NOT NULL, uf smallint NOT NULL,                      -- fatia (escopo de publicação independente da tabela de contratos)
  entity_id integer NOT NULL, esfera char(1) NOT NULL,                -- cópia do contrato: leituras por território/categoria sem JOIN (consistência garantida pela verificação da publicação)
  valor bigint, outlier boolean NOT NULL DEFAULT false,               -- cópia de valor_global (centavos CONTRATADOS) e do marcador de outlier
  category smallint NOT NULL CHECK (category BETWEEN 1 AND 16),
  via smallint NOT NULL CHECK (via BETWEEN 1 AND 3),                 -- 1 comprador, 2 objeto, 3 os dois
  rule smallint NOT NULL,                                            -- regra que sustenta a classificação (edu-contract-build.ts)
  confidence smallint NOT NULL CHECK (confidence BETWEEN 1 AND 3),
  evidence text NOT NULL DEFAULT '',                                 -- trecho do objeto ou tipo do comprador que acionou a regra
  PRIMARY KEY (pncp_id, category)
);
CREATE INDEX exec_edu_contract_class_cat_idx ON civica_exec.exec_edu_contract_class (category, confidence);
CREATE INDEX exec_edu_contract_class_scope_idx ON civica_exec.exec_edu_contract_class (year, uf);
CREATE INDEX exec_edu_contract_class_entity_idx ON civica_exec.exec_edu_contract_class (entity_id, year);
CREATE TABLE civica_exec.exec_edu_procurement (
  compra text PRIMARY KEY,                                           -- numeroControlePNCP da compra
  year smallint NOT NULL,                                            -- anoCompra (fatia)
  uf smallint NOT NULL,
  entity_id integer NOT NULL REFERENCES civica_exec.exec_entity (entity_id),
  org_cnpj bigint NOT NULL,
  modalidade smallint, modo_disputa smallint, situacao smallint, srp boolean,
  valor_estimado bigint CHECK (valor_estimado >= 0), valor_homologado bigint CHECK (valor_homologado >= 0),   -- centavos; NULL = não informado/sigiloso
  sigiloso boolean NOT NULL DEFAULT false,
  pub_date date, open_date date, close_date date, has_result boolean,
  objeto text NOT NULL DEFAULT ''
);
CREATE INDEX exec_edu_procurement_entity_idx ON civica_exec.exec_edu_procurement (entity_id, year);
CREATE INDEX exec_edu_procurement_scope_idx ON civica_exec.exec_edu_procurement (year, uf);
CREATE TABLE civica_exec.exec_edu_contract_term (
  pncp_id text NOT NULL, seq smallint NOT NULL,                      -- contrato e sequencialTermoContrato
  year smallint NOT NULL, uf smallint NOT NULL,                      -- fatia do contrato
  kind text NOT NULL,                                                -- tipoTermoContratoNome (Termo Aditivo, Termo de Apostilamento, Termo de Rescisão…)
  signed date, vig_end date,
  valor_acrescido bigint, valor_global bigint, prazo_dias integer,   -- centavos / dias; NULL = não informado
  q_valor boolean NOT NULL DEFAULT false, q_vigencia boolean NOT NULL DEFAULT false, q_reajuste boolean NOT NULL DEFAULT false, q_fornecedor boolean NOT NULL DEFAULT false,
  objeto text NOT NULL DEFAULT '',
  PRIMARY KEY (pncp_id, seq)
);
CREATE INDEX exec_edu_contract_term_scope_idx ON civica_exec.exec_edu_contract_term (year, uf);
CREATE TABLE civica_exec.exec_edu_work (
  work_id text PRIMARY KEY,                                          -- idUnico do Obrasgov (= identificadorCipi dos contratos do PNCP)
  uf smallint NOT NULL,
  entity_id integer NOT NULL REFERENCES civica_exec.exec_entity (entity_id),   -- UF da obra (o Obrasgov não traz código IBGE de município)
  name text NOT NULL, descricao text NOT NULL DEFAULT '',
  especie text, natureza text, situacao text,
  d_start_prev date, d_end_prev date, d_start_eff date, d_end_eff date, d_situacao date, d_cadastro date,
  valor_previsto bigint CHECK (valor_previsto >= 0), valor_placeholder boolean NOT NULL DEFAULT false,   -- valor <= R$ 0,01 é placeholder: NULL + marca
  tomadores text NOT NULL DEFAULT '', executores text NOT NULL DEFAULT '', repassadores text NOT NULL DEFAULT '',
  edu_basis smallint NOT NULL CHECK (edu_basis BETWEEN 1 AND 4),     -- 1 órgão de educação como executor/tomador/repassador, 2 nome ou descrição com marcador escolar, 3 contrato educacional do PNCP aponta a obra (CIPI), 4 mais de um
  edu_confidence smallint NOT NULL CHECK (edu_confidence BETWEEN 1 AND 3),
  phys_percent smallint CHECK (phys_percent BETWEEN 0 AND 100), phys_situacao text, phys_date date, em_operacao boolean,   -- execução física oficial; NULL = sem registro
  committed bigint, commits smallint NOT NULL DEFAULT 0,             -- soma e quantidade de empenhos oficiais (centavos): empenhado, NÃO pago
  year smallint NOT NULL                                             -- ano da coleta (fatia)
);
CREATE INDEX exec_edu_work_uf_idx ON civica_exec.exec_edu_work (uf, situacao);
CREATE TABLE civica_exec.exec_edu_work_commit (
  work_id text NOT NULL, idx smallint NOT NULL,
  uf smallint NOT NULL, year smallint NOT NULL,
  nota text, ug_emitente text, natureza text, fonte text,
  valor bigint,                                                      -- centavos EMPENHADOS; negativo = estorno/anulação de empenho (fiel à origem), por isso sem CHECK
  PRIMARY KEY (work_id, idx)
);
CREATE TABLE civica_exec.exec_edu_contract_audit (
  pncp_id text PRIMARY KEY,
  band text NOT NULL,                                                -- faixa amostral (OBRAS_1_2, ALIMENTACAO_8, NEG_COM_TERMO_ESCOLAR…)
  verdict smallint NOT NULL CHECK (verdict BETWEEN 0 AND 2),         -- 1 educacional correto, 0 não educacional, 2 indeterminado
  cat_ok smallint CHECK (cat_ok IN (0, 1)),                          -- categoria primária correta (1) ou errada (0); NULL = não se aplica (faixa de falso negativo ou contrato não educacional)
  note text NOT NULL DEFAULT '',
  rules text NOT NULL,                                               -- versão das regras auditadas
  reviewed_on date NOT NULL
);
CREATE TABLE civica_exec.exec_edu_ctr_cov (
  kind smallint NOT NULL CHECK (kind BETWEEN 1 AND 4),               -- 1 contratos, 2 contratações, 3 termos, 4 obras
  year smallint NOT NULL, uf smallint NOT NULL,
  rows_in integer NOT NULL,                                          -- registros lidos do RAW na fatia
  rows_out integer NOT NULL,                                         -- registros publicados
  rejected integer NOT NULL DEFAULT 0,
  no_value integer NOT NULL DEFAULT 0,                               -- publicados sem valor
  pending integer NOT NULL DEFAULT 0,                                -- ainda não coletados (compra/termos) ou páginas com falha
  PRIMARY KEY (kind, year, uf)
);
`;
