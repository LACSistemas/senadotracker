// DDL v5 do schema civica_exec: Finanças da Segurança Pública (P9.5). A despesa por função do Siconfi (DCA/RREO) NÃO ganha tabela própria:
// reutiliza exec_fin_fact (entity × exercício × período × conta × coluna → valor em centavos), com dicionários em exec_ref_code (domínios 30–33).
// Acrescenta apenas o que o fato compartilhado não comporta:
//  - exec_fin_cov: cobertura por fonte × ente × exercício × período (declarou? há linha da função 06? invariantes contábeis?), para que ausência ≠ zero;
//  - exec_fin_org: identidade institucional (órgão superior, subordinado, unidade orçamentária) com nomes por exercício; chave natural (ente, nível, código);
//  - exec_fin_exec: execução MENSAL por unidade orçamentária × função × subfunção × programa × ação × categoria × grupo (empenhado, liquidado, pago e restos a pagar). Fluxo do mês, nunca acumulado;
//  - exec_fin_dot: dotação ANUAL (inicial e atualizada) com o empenhado e o "realizado" tal como publicados no orçamento (snapshot do exercício, não somável a exec_fin_exec).
// Todas as tabelas são institucionais/agregadas (sem credor, sem CPF). Reversível: DROP das quatro tabelas (nada mais depende delas); exec_fin_fact já existia.
export const EXEC_DDL_V5 = `
CREATE TABLE civica_exec.exec_fin_cov (
  source     smallint NOT NULL,                                               -- 1 DCA I-E (função/subfunção), 2 RREO Anexo 02, 3 DCA I-G (restos a pagar por função), 4 federal exec, 5 federal dotação
  entity_id  integer  NOT NULL REFERENCES civica_exec.exec_entity,
  exercicio  smallint NOT NULL,
  periodo    smallint NOT NULL,                                               -- 0 = anual (DCA); RREO: bimestre do snapshot
  status     smallint NOT NULL CHECK (status BETWEEN 1 AND 8),                -- 1 PUBLISHED, 2 PUBLISHED_WITH_CAVEATS, 3 NOT_REPORTED, 4 NO_SOURCE_DATA, 5 SOURCE_UNAVAILABLE, 6 METHODOLOGY_PENDING, 7 RECONCILIATION_FAILED, 8 DECLARED_WITHOUT_FUNCTION
  items      integer  NOT NULL,                                               -- linhas devolvidas pela fonte (0 = resposta vazia)
  fn06       smallint NOT NULL DEFAULT 0 CHECK (fn06 IN (0, 1)),              -- 1 = a função 06 aparece na declaração
  stages     smallint NOT NULL DEFAULT 0,                                     -- bits dos estágios presentes para a função 06 (ver FIN_STAGE_BITS)
  caveats    smallint NOT NULL DEFAULT 0,                                     -- bits: 1 Σ funções ≠ total, 2 Σ subfunções ≠ função 06, 4 linhas duplicadas divergentes, 8 rótulo desconhecido na função 06
  PRIMARY KEY (source, entity_id, exercicio, periodo)
);
CREATE INDEX ON civica_exec.exec_fin_cov (entity_id, exercicio);
CREATE INDEX ON civica_exec.exec_fin_cov (exercicio, source, status);
CREATE TABLE civica_exec.exec_fin_org (
  org_id     integer PRIMARY KEY,                                             -- federal: nível × 1.000.000 + código oficial (superior 1, subordinado 2, unidade orçamentária 3)
  entity_id  integer  NOT NULL REFERENCES civica_exec.exec_entity,            -- ente da esfera a que o órgão pertence (União: kind 1)
  level      smallint NOT NULL CHECK (level IN (1, 2, 3)),
  code       text     NOT NULL,
  parent_id  integer,                                                         -- superior de um subordinado; subordinado de uma unidade orçamentária (último visto)
  name       text     NOT NULL,                                               -- nome mais recente
  first_year smallint NOT NULL,
  last_year  smallint NOT NULL,
  names      jsonb    NOT NULL,                                               -- nome por exercício (órgãos mudam de nome; nomes parecidos NÃO são a mesma instituição)
  UNIQUE (entity_id, level, code)
);
CREATE TABLE civica_exec.exec_fin_exec (
  entity_id  integer  NOT NULL REFERENCES civica_exec.exec_entity,
  exercicio  smallint NOT NULL,
  mes        smallint NOT NULL CHECK (mes BETWEEN 1 AND 12),
  org_id     integer  NOT NULL,                                               -- unidade orçamentária (nível 3)
  funcao     smallint NOT NULL,
  subfuncao  smallint NOT NULL,
  programa   smallint NOT NULL,                                               -- 0 quando a fonte não informa
  acao       text     NOT NULL,
  categoria  smallint NOT NULL,                                               -- 3 corrente, 4 capital (-1 sem informação)
  grupo      smallint NOT NULL,                                               -- 1 pessoal, 2 juros, 3 outras correntes, 4 investimentos, 5 inversões, 6 amortização (-1 sem informação)
  modalidade smallint NOT NULL,                                               -- 30/31/32 transferência a Estados/DF, 40/41/42 a Municípios, 50 a entidades privadas, 90 aplicação direta, 91 intra-orçamentária (-1 sem informação)
  uf_loc     smallint NOT NULL,                                               -- UF do localizador orçamentário do gasto (código IBGE); 0 = nacional/não regionalizado/exterior. NÃO é o município nem o beneficiário
  emp        bigint   NOT NULL,                                               -- centavos, fluxo do mês (pode ser negativo: anulações)
  liq        bigint   NOT NULL,
  pago       bigint   NOT NULL,
  rp_insc    bigint   NOT NULL,
  rp_canc    bigint   NOT NULL,
  rp_pago    bigint   NOT NULL,
  PRIMARY KEY (entity_id, exercicio, mes, org_id, funcao, subfuncao, programa, acao, categoria, grupo, modalidade, uf_loc)
);
CREATE INDEX ON civica_exec.exec_fin_exec (entity_id, exercicio, funcao);
CREATE INDEX ON civica_exec.exec_fin_exec (org_id, exercicio);
CREATE TABLE civica_exec.exec_fin_dot (
  entity_id  integer  NOT NULL REFERENCES civica_exec.exec_entity,
  exercicio  smallint NOT NULL,
  org_id     integer  NOT NULL,                                               -- unidade orçamentária (nível 3)
  funcao     smallint NOT NULL,
  subfuncao  smallint NOT NULL,
  programa   smallint NOT NULL,
  acao       text     NOT NULL,
  categoria  smallint NOT NULL,
  grupo      smallint NOT NULL,
  dot_ini    bigint   NOT NULL,                                               -- centavos: orçamento inicial (LOA)
  dot_atu    bigint   NOT NULL,                                               -- centavos: orçamento atualizado (LOA + créditos)
  orc_emp    bigint   NOT NULL,                                               -- "orçamento empenhado" do arquivo de orçamento
  orc_real   bigint   NOT NULL,                                               -- "orçamento realizado" do arquivo de orçamento = valor PAGO incluindo intra-orçamentárias (conferido ao centavo contra Σ pago mensal de 2023, função 06)
  PRIMARY KEY (entity_id, exercicio, org_id, funcao, subfuncao, programa, acao, categoria, grupo)
);
CREATE INDEX ON civica_exec.exec_fin_dot (org_id, exercicio);
`;
