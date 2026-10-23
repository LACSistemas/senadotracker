// DDL v6 do schema civica_exec: contratos de segurança no PNCP e transferências voluntárias do MJSP (P9.5, ondas F). Três tabelas, todas SEM dado pessoal:
//  - exec_fin_contract: contrato do PNCP classificado como de segurança. Duas classificações NUNCA fundidas: `org_kind` (o ÓRGÃO contratante é uma instituição de segurança, por nome:
//    confiança alta, não exata) e `theme` (o OBJETO sugere tema de segurança, derivado por palavras-chave: não é despesa oficial da função 06). O texto do objeto NÃO é guardado
//    (equipamentos e instalações sensíveis); só o código do tema. Valor contratado ≠ empenhado ≠ pago: não se soma a nenhum fato de exec_fin_fact/exec_fin_exec.
//  - exec_fin_supplier: fornecedor PESSOA JURÍDICA (CNPJ) dos contratos acima; pessoa física nunca é persistida (supplier = NULL no contrato).
//  - exec_fin_transfer: instrumento (convênio/contrato de repasse) da Plataforma +Brasil/Transferegov cujo concedente é o MJSP. Origem do financiamento ≠ execução final:
//    nunca se soma ao pagamento do ente beneficiário.
// Reversível: DROP das três tabelas.
export const EXEC_DDL_V6 = `
CREATE TABLE civica_exec.exec_fin_supplier (
  cnpj  bigint PRIMARY KEY,
  name  text NOT NULL
);
CREATE TABLE civica_exec.exec_fin_contract (
  pncp_id       text     PRIMARY KEY,                                         -- numeroControlePNCP
  year          smallint NOT NULL,                                            -- ano de publicação no PNCP (fatia)
  uf            smallint NOT NULL,                                            -- UF da unidade do órgão (fatia); 0 = sem UF informada
  entity_id     integer  NOT NULL REFERENCES civica_exec.exec_entity,         -- ente do órgão: município (esfera M), UF (E) ou Brasil (F); sem IBGE válido → UF ou Brasil conforme a esfera
  esfera        char(1)  NOT NULL,                                            -- F federal, E estadual, M municipal, D distrital
  org_cnpj      bigint   NOT NULL,
  org_kind      smallint NOT NULL,                                            -- 0 = órgão NÃO identificado como de segurança; 1 secretaria de segurança, 2 PM, 3 PC, 4 bombeiros, 5 polícia penal/administração penitenciária, 6 perícia/polícia científica, 7 guarda municipal/secretaria municipal de segurança, 8 federal (PF, PRF, MJSP, SENAPPEN), 9 defesa civil
  theme         smallint NOT NULL,                                            -- 0 = sem tema derivado; ver SEC_THEMES
  link          smallint NOT NULL CHECK (link IN (1, 2, 3)),                  -- 1 só institucional (órgão), 2 só temático derivado, 3 ambos
  tipo          smallint NOT NULL,                                            -- tipoContrato.id do PNCP (7 = Empenho)
  categoria     smallint NOT NULL,                                            -- categoriaProcesso.id
  valor_global  bigint   NOT NULL,                                            -- centavos: valor global CONTRATADO (não é pago)
  valor_inicial bigint   NOT NULL,
  signed        date,
  supplier      bigint,                                                       -- CNPJ do fornecedor PJ (exec_fin_supplier, sem FK: o log inverso precisa de ordem livre); NULL = pessoa física ou sem identificação (nunca persistida)
  empenho       text,                                                         -- numeroContratoEmpenho quando tipo = Empenho (referência, sem prova de pagamento)
  retif         smallint NOT NULL DEFAULT 0
);
CREATE INDEX ON civica_exec.exec_fin_contract (entity_id, year);
CREATE INDEX ON civica_exec.exec_fin_contract (year, uf);
CREATE INDEX ON civica_exec.exec_fin_contract (supplier) WHERE supplier IS NOT NULL;
CREATE TABLE civica_exec.exec_fin_transfer (
  proposal_id   integer  PRIMARY KEY,                                         -- ID_PROPOSTA da Plataforma +Brasil
  year          smallint NOT NULL,                                            -- ano da assinatura do convênio; sem convênio, ano da proposta (fatia)
  uf            smallint NOT NULL,                                            -- UF do proponente
  entity_id     integer  REFERENCES civica_exec.exec_entity,                  -- ente beneficiário quando o CNPJ do proponente é o de um ente do Siconfi (EXACT); NULL para OSC, consórcio, empresa
  benef_kind    smallint NOT NULL,                                            -- 1 estado/DF, 2 município, 3 consórcio público, 4 organização da sociedade civil, 5 empresa pública/mista, 9 outro
  concedente    integer  NOT NULL,                                            -- COD_ORGAO do concedente (30000 MJSP, 30907 FUNPEN, 30911 FNSP, 30912 FUNAD)
  instrument    smallint NOT NULL,                                            -- 1 convênio, 2 contrato de repasse, 3 termo de parceria/fomento/colaboração, 9 outro
  prop_status   smallint NOT NULL,                                            -- situação da proposta (ver FIN_TRANSFER_STATUS)
  conv_status   smallint NOT NULL,                                            -- situação do convênio; 0 = proposta sem convênio
  v_global_prop bigint   NOT NULL,                                            -- centavos
  v_repasse_prop bigint  NOT NULL,
  v_global_conv bigint,                                                       -- NULL = sem convênio
  v_repasse_conv bigint,
  v_empenhado_conv bigint,
  v_desembolsado_conv bigint,
  signed        date
);
CREATE INDEX ON civica_exec.exec_fin_transfer (entity_id, year) WHERE entity_id IS NOT NULL;
CREATE INDEX ON civica_exec.exec_fin_transfer (year, uf);
`;
