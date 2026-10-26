import { FLOW_COLS, INSE_LEVEL_COLS, TRN_COLS } from './educacao-flow-catalog.ts';
import { IDEB_MEASURES, SAEB_LEVEL_COLS } from './educacao-learn-catalog.ts';

// DDL v13 do schema civica_exec: aprendizagem e fluxo escolar (P10.4). Tabelas tipadas e compactas, sem JSONB, sem tabela por UF/ano, sem dado pessoal. Valores OFICIAIS do INEP, como publicados.
//  - exec_edu_ideb_school: Ideb por escola × edição × etapa (1 AI, 2 AF, 3 EM). `uf` vem da planilha (SG_UF) e serve de escopo de publicação. FK para a identidade da P10.1 (`exec_edu_school`);
//    2005 só entra para escola que também existe de 2007 em diante (o restante fica contado na cobertura, sem inventar snapshot).
//  - exec_edu_ideb_terr: Ideb por Brasil (entity 76), região (1–5), UF (código IBGE) e município × edição × etapa × rede (dep: 0 total, 1 federal, 2 estadual, 3 municipal, 4 privada, 5 pública), como o INEP publica.
//    double precision: aprovação (%), P (0–1), proficiências Saeb (escala Saeb), N (0–10), Ideb e meta (1º ciclo, 2007–2021). NULL = "-" no arquivo (não divulgado), nunca zero.
//  - exec_edu_saeb_terr: resultados AGREGADOS do Saeb (2017–2025) por território × dependência × localização × capital × série × disciplina. media, níveis e alfabetização ×100 (2 casas, conferido).
//  - exec_edu_ideb_cov / exec_edu_saeb_cov: cobertura por edição × UF × família × nível.
// Reversível: DROP das tabelas (nenhuma tabela existente depende delas).
const dbl = IDEB_MEASURES.map(m => `${m} double precision CHECK (${m} >= 0)`).join(',\n  ');
const nv = SAEB_LEVEL_COLS.map(c => `${c} smallint CHECK (${c} BETWEEN 0 AND 10000)`).join(',\n  ');
const pct = (cols: string[]) => cols.map(c => `${c} smallint CHECK (${c} BETWEEN 0 AND 10000)`).join(',\n  ');
const COV = (t: string) => `CREATE TABLE civica_exec.${t} (
  year smallint NOT NULL,
  uf smallint NOT NULL,                              -- 0 = fatia nacional (Brasil e regiões)
  family smallint NOT NULL,                          -- 1 Ideb, 2 Saeb, 3 rendimento, 4 distorção, 5 transição, 6 INSE
  lvl smallint NOT NULL CHECK (lvl IN (1, 2)),       -- 1 escola, 2 território
  rows_in integer NOT NULL,                          -- linhas lidas do arquivo oficial na fatia
  valid integer NOT NULL,                            -- linhas com pelo menos um valor, publicadas
  rejected integer NOT NULL,
  no_identity integer NOT NULL,                      -- escola sem identidade no cadastro da P10.1 (não publicada)
  cells_num integer NOT NULL,                        -- células numéricas publicadas
  cells_supp integer NOT NULL DEFAULT 0,             -- células suprimidas pelo Inep (sigilo estatístico, '***'): ausentes na publicação, nunca reconstruídas
  PRIMARY KEY (year, uf, family, lvl)
);`;
export const EXEC_DDL_V13_LEARN = `
CREATE TABLE civica_exec.exec_edu_ideb_school (
  inep integer NOT NULL REFERENCES civica_exec.exec_edu_school (inep),
  year smallint NOT NULL,
  stage smallint NOT NULL CHECK (stage BETWEEN 1 AND 3),
  uf smallint NOT NULL,
  dep smallint NOT NULL CHECK (dep BETWEEN 0 AND 5),
  ${dbl},
  PRIMARY KEY (inep, year, stage)
);
CREATE INDEX exec_edu_ideb_school_uf_idx ON civica_exec.exec_edu_ideb_school (year, uf);
CREATE TABLE civica_exec.exec_edu_ideb_terr (
  year smallint NOT NULL,
  entity_id integer NOT NULL REFERENCES civica_exec.exec_entity (entity_id),
  stage smallint NOT NULL CHECK (stage BETWEEN 1 AND 3),
  dep smallint NOT NULL CHECK (dep BETWEEN 0 AND 5),
  ${dbl},
  PRIMARY KEY (year, entity_id, stage, dep)
);
CREATE INDEX exec_edu_ideb_terr_entity_idx ON civica_exec.exec_edu_ideb_terr (entity_id, stage, dep, year);
CREATE TABLE civica_exec.exec_edu_saeb_terr (
  year smallint NOT NULL,
  entity_id integer NOT NULL REFERENCES civica_exec.exec_entity (entity_id),
  dep smallint NOT NULL CHECK (dep BETWEEN 0 AND 6),
  loc smallint NOT NULL CHECK (loc BETWEEN 0 AND 2),
  cap smallint NOT NULL CHECK (cap BETWEEN 0 AND 2),        -- 0 total, 1 capital, 2 interior
  grade smallint NOT NULL,                                   -- 2, 5, 9, 12, 13, 14
  subj smallint NOT NULL CHECK (subj BETWEEN 1 AND 4),       -- 1 LP, 2 MT, 3 CH, 4 CN
  media integer CHECK (media >= 0),                          -- proficiência média ×100
  tx_alf smallint CHECK (tx_alf BETWEEN 0 AND 10000),        -- alfabetização ×100 (2021, 2023; 2º ano)
  ${nv},
  PRIMARY KEY (year, entity_id, dep, loc, cap, grade, subj)
);
CREATE INDEX exec_edu_saeb_terr_entity_idx ON civica_exec.exec_edu_saeb_terr (entity_id, grade, subj, year);
${COV('exec_edu_ideb_cov')}
${COV('exec_edu_saeb_cov')}
`;

// Fluxo escolar (P10.4). Percentuais ×100 em smallint (NULL = "--" no arquivo). uf/dep/loc da escola são os do arquivo do INEP no ano (a identidade continua em exec_edu_school).
//  - exec_edu_flow_school: rendimento (aprovação, reprovação, abandono) e distorção idade-série por escola × ano; PK (inep, year).
//  - exec_edu_flow_terr: o mesmo por território × ano × localização (0 total, 1 urbana, 2 rural) × rede (dep 0–5), como o INEP publica.
//  - exec_edu_trn_terr: transição (promoção, repetência, evasão, migração para a EJA) do ano Y para Y+1, gravada com year = Y.
//  - exec_edu_inse_school / exec_edu_inse_terr: INSE agregado (Saeb 2019, 2021, 2023): quantidade de alunos com INSE, média ×10000 e distribuição por nível (1–8) ×100.
//    Rede (dep) em todo o schema: 0 total, 1 federal, 2 estadual, 3 municipal, 4 privada, 5 pública (federal+estadual+municipal), 6 estadual+municipal (o Inep numera 5 e 6 do INSE ao contrário; convertido na leitura).
export const EXEC_DDL_V13_FLOW = `
CREATE TABLE civica_exec.exec_edu_flow_school (
  inep integer NOT NULL REFERENCES civica_exec.exec_edu_school (inep),
  year smallint NOT NULL,
  uf smallint NOT NULL,
  dep smallint NOT NULL CHECK (dep BETWEEN 0 AND 5),
  loc smallint NOT NULL CHECK (loc BETWEEN 0 AND 2),
  ${pct(FLOW_COLS)},
  PRIMARY KEY (inep, year)
);
CREATE INDEX exec_edu_flow_school_uf_idx ON civica_exec.exec_edu_flow_school (year, uf);
CREATE TABLE civica_exec.exec_edu_flow_terr (
  year smallint NOT NULL,
  entity_id integer NOT NULL REFERENCES civica_exec.exec_entity (entity_id),
  loc smallint NOT NULL CHECK (loc BETWEEN 0 AND 2),
  dep smallint NOT NULL CHECK (dep BETWEEN 0 AND 5),
  ${pct(FLOW_COLS)},
  PRIMARY KEY (year, entity_id, loc, dep)
);
CREATE INDEX exec_edu_flow_terr_entity_idx ON civica_exec.exec_edu_flow_terr (entity_id, loc, dep, year);
CREATE TABLE civica_exec.exec_edu_trn_terr (
  year smallint NOT NULL,
  entity_id integer NOT NULL REFERENCES civica_exec.exec_entity (entity_id),
  loc smallint NOT NULL CHECK (loc BETWEEN 0 AND 2),
  dep smallint NOT NULL CHECK (dep BETWEEN 0 AND 5),
  ${pct(TRN_COLS)},
  PRIMARY KEY (year, entity_id, loc, dep)
);
CREATE INDEX exec_edu_trn_terr_entity_idx ON civica_exec.exec_edu_trn_terr (entity_id, loc, dep, year);
${COV('exec_edu_flow_cov')}
${COV('exec_edu_trn_cov')}
CREATE TABLE civica_exec.exec_edu_inse_school (
  inep integer NOT NULL REFERENCES civica_exec.exec_edu_school (inep),
  year smallint NOT NULL,
  uf smallint NOT NULL,
  dep smallint NOT NULL CHECK (dep BETWEEN 0 AND 5),
  loc smallint NOT NULL CHECK (loc BETWEEN 0 AND 2),
  qtd integer CHECK (qtd >= 0),                              -- alunos com INSE calculado
  media integer CHECK (media >= 0),                          -- média do INSE ×10000 (o Inep publica até 4 casas)
  cls smallint CHECK (cls BETWEEN 1 AND 8),                  -- classificação em níveis (2019: I–VIII; 2021/2023: 1–8 da escala nova)
  ${pct(INSE_LEVEL_COLS)},
  PRIMARY KEY (inep, year)
);
CREATE INDEX exec_edu_inse_school_uf_idx ON civica_exec.exec_edu_inse_school (year, uf);
CREATE TABLE civica_exec.exec_edu_inse_terr (
  year smallint NOT NULL,
  entity_id integer NOT NULL REFERENCES civica_exec.exec_entity (entity_id),
  dep smallint NOT NULL CHECK (dep BETWEEN 0 AND 6),
  loc smallint NOT NULL CHECK (loc BETWEEN 0 AND 2),
  cap smallint NOT NULL CHECK (cap BETWEEN 0 AND 2),
  qtd integer CHECK (qtd >= 0),
  media integer CHECK (media >= 0),                          -- ×10000
  ${pct(INSE_LEVEL_COLS)},
  PRIMARY KEY (year, entity_id, dep, loc, cap)
);
CREATE INDEX exec_edu_inse_terr_entity_idx ON civica_exec.exec_edu_inse_terr (entity_id, dep, loc, cap, year);
${COV('exec_edu_inse_cov')}
`;

export const EXEC_DDL_V13 = EXEC_DDL_V13_LEARN + EXEC_DDL_V13_FLOW;
