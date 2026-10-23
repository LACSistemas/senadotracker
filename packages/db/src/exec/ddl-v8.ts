// DDL v8 do schema civica_exec: catálogo canônico da criminalidade ESTADUAL municipalizada (P9.6). Uma tabela, sem dado pessoal:
//  - exec_crime_indicator: para cada indicador publicado (exec_ind_def.indicator_id 8000+), o código ORIGINAL da fonte, o grupo editorial, a UNIDADE de contagem
//    (vítima, caso/ocorrência, autor...), se é composto (e de quais componentes), a abrangência temporal, a semântica de zero/ausência e o estado de comparabilidade.
// Os valores ficam em exec_ind_value; a cobertura em exec_seg_cov (a mesma da P9.1, em faixas de indicador próprias de cada fonte). Reversível: DROP da tabela.
export const EXEC_DDL_V8 = `
CREATE TABLE civica_exec.exec_crime_indicator (
  indicator_id   smallint PRIMARY KEY REFERENCES civica_exec.exec_ind_def,
  source         text     NOT NULL,                                   -- 'ISP-RJ', 'SEJUSP-MG', ...
  source_slot    smallint NOT NULL,                                   -- faixa de indicadores da fonte (8000 + 100 × slot)
  uf             smallint NOT NULL,                                   -- UF da fonte (código IBGE)
  source_code    text     NOT NULL,                                   -- código/rótulo ORIGINAL (coluna, natureza, tipo de ocorrência)
  source_label   text     NOT NULL,
  group_code     text     NOT NULL,                                   -- LETAL | SEXUAL | PATRIMONIAL | PESSOA | POLICIAL | TRANSITO | OUTROS
  canonical      text,                                                -- candidato canônico (ex.: homicidio_doloso); NULL = sem equivalente nacional
  unit           text     NOT NULL,                                   -- vitima | caso | ocorrencia | autor | adolescente | evento
  composite_of   text[],                                              -- códigos originais dos componentes quando o indicador é soma de outros (NUNCA somar com eles)
  comparability  text     NOT NULL,                                   -- SAME_SOURCE_COMPARABLE | OFFICIAL_EQUIVALENCE_PROVEN | SIMILAR_LABEL_NOT_PROVEN | NOT_COMPARABLE
  temporal       text     NOT NULL,                                   -- semântica da data: comunicação | fato | registro | publicação
  zero_semantics text     NOT NULL,                                   -- como ausência/zero devem ser lidos nesta fonte
  derived_from_microdata boolean NOT NULL DEFAULT false,              -- agregado calculado pelo Cívica a partir de microdados (aplica supressão de pequenas contagens em categorias sensíveis)
  sensitive      boolean  NOT NULL DEFAULT false,
  note           text     NOT NULL
);
CREATE INDEX ON civica_exec.exec_crime_indicator (uf, source_slot);
CREATE INDEX ON civica_exec.exec_crime_indicator (group_code, canonical);
`;
