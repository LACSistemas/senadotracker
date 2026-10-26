import { IND_SCHOOL_COLS, IND_TERR_COLS } from './educacao-ind-catalog.ts';
import { DOC_COLS } from './educacao-doc-catalog.ts';

// DDL v12 do schema civica_exec: Indicadores Educacionais OFICIAIS do INEP (P10.3) — ATU, HAD, DSU, AFD, IED, IRD, ICG. O Cívica guarda o valor publicado pelo INEP (×10 em smallint; ird_media ×1000; icg_nivel inteiro);
// nunca recalcula nem faz média de percentuais. NULL = célula oficial vazia, suprimida ("--") ou etapa que não se aplica à escola/território; 0 é um zero publicado.
//  - exec_edu_ind_school: UMA linha por escola × edição com pelo menos um valor oficial. FK composta para o cadastro da P10.1.
//  - exec_edu_ind_terr: Brasil (entity 76), região (1–5), UF (código IBGE) e município (código IBGE de 7 dígitos) × edição × dependência × localização, como o INEP publica. dep: 0 = total, 1 federal, 2 estadual,
//    3 municipal, 4 privada, 5 pública (federal + estadual + municipal); loc: 0 = total, 1 urbana, 2 rural.
//  - exec_edu_doc_terr: DOCENTES distintos oficiais (Sinopse Estatística, tabelas 2.1 e 2.2) por Brasil, UF e município × edição. Um docente é contado uma vez em cada nível de agregação e em cada recorte: o total NÃO é a soma das etapas nem
//    das redes (quem leciona em duas redes ou etapas conta nas duas). Por isso o total territorial vem da Sinopse e nunca da soma das escolas.
//  - exec_edu_ind_cov: cobertura por edição × UF (0 = nacional) × família × nível (1 escola, 2 território).
// Reversível: DROP das três tabelas (nenhuma tabela existente depende delas).
const sm = (c: string) => `${c} smallint CHECK (${c} >= 0)`;
export const EXEC_DDL_V12 = `
CREATE TABLE civica_exec.exec_edu_ind_school (
  inep integer NOT NULL,
  year smallint NOT NULL,
  ${IND_SCHOOL_COLS.map(sm).join(',\n  ')},
  PRIMARY KEY (inep, year),
  FOREIGN KEY (inep, year) REFERENCES civica_exec.exec_edu_school_year (inep, year)
);
CREATE TABLE civica_exec.exec_edu_ind_terr (
  year smallint NOT NULL,
  entity_id integer NOT NULL REFERENCES civica_exec.exec_entity (entity_id),
  dep smallint NOT NULL CHECK (dep BETWEEN 0 AND 5),
  loc smallint NOT NULL CHECK (loc BETWEEN 0 AND 2),
  ${IND_TERR_COLS.map(sm).join(',\n  ')},
  PRIMARY KEY (year, entity_id, dep, loc)
);
CREATE INDEX exec_edu_ind_terr_entity_idx ON civica_exec.exec_edu_ind_terr (entity_id, year);
CREATE TABLE civica_exec.exec_edu_doc_terr (
  year smallint NOT NULL,
  entity_id integer NOT NULL REFERENCES civica_exec.exec_entity (entity_id),
  ${DOC_COLS.map(c => `${c} integer CHECK (${c} >= 0)`).join(',\n  ')},
  PRIMARY KEY (year, entity_id)
);
CREATE TABLE civica_exec.exec_edu_ind_cov (
  year smallint NOT NULL,
  uf smallint NOT NULL,                              -- 0 = fatia nacional (Brasil e regiões)
  family smallint NOT NULL CHECK (family BETWEEN 1 AND 7),   -- 1 ATU, 2 HAD, 3 DSU, 4 AFD, 5 IED, 6 IRD, 7 ICG
  lvl smallint NOT NULL CHECK (lvl IN (1, 2)),       -- 1 escola, 2 território
  rows_in integer NOT NULL,                          -- linhas do arquivo oficial na fatia
  valid integer NOT NULL,                            -- linhas com pelo menos um valor, publicadas
  rejected integer NOT NULL,
  no_value integer NOT NULL,                         -- linhas do arquivo sem nenhum valor (tudo suprimido ou fora de aplicação)
  cells_num integer NOT NULL,
  cells_dash integer NOT NULL,                       -- "--" (suprimido ou não se aplica)
  PRIMARY KEY (year, uf, family, lvl)
);
`;
