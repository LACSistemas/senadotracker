// DDL v10 do schema civica_exec: matrículas, turmas e oferta por escola (P10.2, Censo Escolar INEP). Três tabelas aditivas, sem dado pessoal:
//  - exec_edu_offer_year: UMA linha por escola × edição do universo (matrícula básica > 0 ou turmas > 0), com as medidas ADITIVAS (partição exata de QT_MAT_BAS: infantil, fundamental, médio, EJA e o resto =
//    educação profissional não integrada, derivável) e as TRANSVERSAIS (educação profissional total, educação especial, tempo integral, turno) em colunas tipadas. NULL = a edição não tem a coluna; 0 = zero declarado.
//    Escola do cadastro SEM linha aqui = sem matrícula/turma no arquivo (equivale ao bit0 = 0 de exec_edu_school_year.flags). Chave estrangeira composta para o cadastro da P10.1: nada de escola sem identidade.
//  - exec_edu_offer_agg: soma por edição × UF × dependência × localização (uma centena de linhas por UF e edição no total), para séries de UF e Brasil sem varrer 4 milhões de linhas.
//  - exec_edu_offer_cov: cobertura da edição × UF (linhas lidas, válidas, rejeitadas, escolas com matrícula/turma).
// Reversível: DROP das três tabelas (nenhuma tabela existente depende delas).
const MEAS = `
  mat_bas integer, mat_inf_cre integer, mat_inf_pre integer, mat_fund_ai integer, mat_fund_af integer, mat_med integer, mat_eja_fund integer, mat_eja_med integer,
  mat_prof integer, mat_esp_cc integer, mat_esp_ce integer, mat_int_inf integer, mat_int_fund integer, mat_int_med integer, mat_noturno integer, mat_ead integer,
  tur_bas integer, tur_inf_cre integer, tur_inf_pre integer, tur_fund_ai integer, tur_fund_af integer, tur_med integer, tur_eja integer, tur_eja_fund integer, tur_eja_med integer,
  tur_prof integer, tur_esp_cc integer, tur_esp_ce integer, tur_int_inf integer, tur_int_fund integer, tur_int_med integer`;
const SUMS = `
  mat_bas bigint NOT NULL DEFAULT 0, mat_inf_cre bigint, mat_inf_pre bigint, mat_fund_ai bigint, mat_fund_af bigint, mat_med bigint, mat_eja_fund bigint, mat_eja_med bigint,
  mat_prof bigint, mat_esp_cc bigint, mat_esp_ce bigint, mat_int_inf bigint, mat_int_fund bigint, mat_int_med bigint, mat_noturno bigint, mat_ead bigint,
  tur_bas bigint NOT NULL DEFAULT 0, tur_inf_cre bigint, tur_inf_pre bigint, tur_fund_ai bigint, tur_fund_af bigint, tur_med bigint, tur_eja bigint, tur_eja_fund bigint, tur_eja_med bigint,
  tur_prof bigint, tur_esp_cc bigint, tur_esp_ce bigint, tur_int_inf bigint, tur_int_fund bigint, tur_int_med bigint`;
export const EXEC_DDL_V10 = `
CREATE TABLE civica_exec.exec_edu_offer_year (
  inep integer NOT NULL,
  year smallint NOT NULL,
  ${MEAS},
  PRIMARY KEY (inep, year),
  FOREIGN KEY (inep, year) REFERENCES civica_exec.exec_edu_school_year (inep, year),
  CHECK (coalesce(mat_bas, 0) >= 0 AND coalesce(tur_bas, 0) >= 0 AND (coalesce(mat_bas, 0) > 0 OR coalesce(tur_bas, 0) > 0)),
  -- partição exata da matrícula básica (para turmas o EJA entra pelo TOTAL QT_TUR_EJA: em 2025 há turmas de EJA sem etapa classificada, então fund+médio < total): o resto (BAS − INF − FUND − MED − EJA) é educação profissional não integrada e nunca é negativo
  CHECK (coalesce(mat_bas, 0) >= coalesce(mat_inf_cre, 0) + coalesce(mat_inf_pre, 0) + coalesce(mat_fund_ai, 0) + coalesce(mat_fund_af, 0) + coalesce(mat_med, 0) + coalesce(mat_eja_fund, 0) + coalesce(mat_eja_med, 0)),
  CHECK (coalesce(tur_bas, 0) >= coalesce(tur_inf_cre, 0) + coalesce(tur_inf_pre, 0) + coalesce(tur_fund_ai, 0) + coalesce(tur_fund_af, 0) + coalesce(tur_med, 0) + coalesce(tur_eja, 0)),
  -- educação especial é um recorte transversal da matrícula básica (nunca maior que ela)
  CHECK (coalesce(mat_esp_cc, 0) + coalesce(mat_esp_ce, 0) <= coalesce(mat_bas, 0))
);
CREATE TABLE civica_exec.exec_edu_offer_agg (
  year smallint NOT NULL,
  uf smallint NOT NULL,
  dep smallint NOT NULL CHECK (dep BETWEEN 1 AND 4),                       -- mesma codificação de exec_edu_school_year.dep
  loc smallint NOT NULL CHECK (loc BETWEEN 0 AND 2),                       -- 0 = localização não informada
  schools integer NOT NULL,                                                -- escolas do universo (matrícula ou turma > 0) no grupo
  ${SUMS},
  PRIMARY KEY (year, uf, dep, loc)
);
CREATE TABLE civica_exec.exec_edu_offer_cov (
  year smallint NOT NULL,
  uf smallint NOT NULL,
  layout smallint NOT NULL,                                                -- 1 = CSV único (2007–2024); 2 = tabelas separadas (2025+)
  rows_in integer NOT NULL,                                                -- escolas do universo lidas do arquivo oficial na UF
  valid integer NOT NULL,
  rejected integer NOT NULL,
  with_mat integer NOT NULL,                                               -- mat_bas > 0
  with_tur integer NOT NULL,                                               -- tur_bas > 0
  only_tur integer NOT NULL,                                               -- turma sem matrícula
  PRIMARY KEY (year, uf)
);
`;
