import { INFRA_VARS } from './educacao-infra-catalog.ts';

// DDL v11 do schema civica_exec: infraestrutura escolar (P10.3, Censo Escolar INEP, Tabela de Escola). Três tabelas aditivas, sem dado pessoal e sem contato:
//  - exec_edu_infra_year: UMA linha por escola em atividade × edição, com as respostas AUTODECLARADAS de infraestrutura (boolean: true = "sim", false = "não"; smallint para quantidades).
//    NULL = a edição não tem a variável OU a escola deixou em branco; as duas situações se separam pelo catálogo (educacao-infra-catalog.ts) e pela cobertura. Nunca zero no lugar de ausência.
//    FK composta para o cadastro da P10.1: nenhuma escola sem identidade.
//  - exec_edu_infra_agg: contagens por edição × UF × dependência × localização (escolas com "sim" e com "não" por variável; soma e nº de escolas com valor para as quantidades). O percentual é sempre
//    sim ÷ (sim + não): escolas sem resposta não entram como "não".
//  - exec_edu_infra_cov: cobertura da edição × UF.
// Reversível: DROP das três tabelas (nenhuma tabela existente depende delas).
const flags = INFRA_VARS.filter(x => x.kind === 'flag');
const counts = INFRA_VARS.filter(x => x.kind === 'count');
const YEAR_COLS = [...flags.map(x => `${x.code} boolean`), ...counts.map(x => `${x.code} smallint CHECK (${x.code} >= 0)`)].join(',\n  ');
const AGG_COLS = [...flags.flatMap(x => [`${x.code}_t integer`, `${x.code}_f integer`]), ...counts.flatMap(x => [`${x.code}_s bigint`, `${x.code}_n integer`])].join(',\n  ');
export const EXEC_DDL_V11 = `
CREATE TABLE civica_exec.exec_edu_infra_year (
  inep integer NOT NULL,
  year smallint NOT NULL,
  ${YEAR_COLS},
  PRIMARY KEY (inep, year),
  FOREIGN KEY (inep, year) REFERENCES civica_exec.exec_edu_school_year (inep, year)
);
CREATE TABLE civica_exec.exec_edu_infra_agg (
  year smallint NOT NULL,
  uf smallint NOT NULL,
  dep smallint NOT NULL CHECK (dep BETWEEN 1 AND 4),
  loc smallint NOT NULL CHECK (loc BETWEEN 0 AND 2),
  schools integer NOT NULL,                         -- escolas em atividade com linha de infraestrutura no grupo
  ${AGG_COLS},
  PRIMARY KEY (year, uf, dep, loc)
);
CREATE TABLE civica_exec.exec_edu_infra_cov (
  year smallint NOT NULL,
  uf smallint NOT NULL,
  layout smallint NOT NULL,                         -- 1 = CSV único (2007–2024); 2 = tabelas separadas (2025+)
  rows_in integer NOT NULL,                         -- escolas lidas do arquivo oficial na UF (todas as situações)
  active integer NOT NULL,                          -- em atividade (TP_SITUACAO_FUNCIONAMENTO = 1)
  valid integer NOT NULL,                           -- linhas de infraestrutura publicadas
  rejected integer NOT NULL,
  answered integer NOT NULL,                        -- com pelo menos uma variável aplicável respondida
  unanswered integer NOT NULL,                      -- em atividade e sem nenhuma resposta aplicável (ex.: 2022, 4.259 escolas)
  with_mat integer NOT NULL,                        -- escolas publicadas com matrícula básica no cadastro (bit0 da P10.1)
  extreme integer NOT NULL,                         -- células com "valor extremo" marcado pelo INEP (88888), publicadas como NULL
  coded_unknown integer NOT NULL,                   -- células com código oficial "não informado" (9), publicadas como NULL
  PRIMARY KEY (year, uf)
);
`;
