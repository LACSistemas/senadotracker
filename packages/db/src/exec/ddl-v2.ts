// DDL v2 do schema civica_exec: cobertura do Sinesp VDE (P9.1). Única estrutura nova da Segurança Pública; os valores usam exec_ind_def/exec_ind_value.
// Necessidade: o VDE republica o arquivo do ano inteiro e a fonte não distingue "zero reportado" de "sem relato"; sem este registro, a ausência de linha
// em exec_ind_value não permitiria reconstruir o significado dos zeros. Reversível: DROP TABLE civica_exec.exec_seg_cov (nenhuma outra tabela depende dela).
export const EXEC_DDL_V2 = `
CREATE TABLE civica_exec.exec_seg_cov (
  uf          smallint NOT NULL,                                                     -- código IBGE da UF
  indicator_id smallint NOT NULL REFERENCES civica_exec.exec_ind_def,
  competence  civica_exec.competence NOT NULL,                                       -- mês
  mun_pairs   integer NOT NULL,                                                      -- nomes municipais distintos no arquivo para (UF, evento, abrangência, mês); inclui "NÃO INFORMADO"
  src_lines   integer NOT NULL,                                                      -- linhas do XLSX na chave
  dup_lines   integer NOT NULL,                                                      -- linhas repetidas na mesma chave (somadas; ex.: DF por região administrativa)
  nz_rows     integer NOT NULL,                                                      -- chaves município×evento com valor ≠ 0
  uf_total    double precision NOT NULL,                                             -- soma de TODAS as linhas da UF no mês (inclui município não informado)
  unassigned  double precision NOT NULL,                                             -- parte atribuída ao "município ignorado" da UF
  status      smallint NOT NULL CHECK (status IN (1, 2)),                            -- 1 há valor ≠ 0 no mês; 2 zero em todas as linhas (zero reportado OU ausência de relato: a fonte não distingue)
  PRIMARY KEY (uf, indicator_id, competence)
);
CREATE INDEX ON civica_exec.exec_seg_cov (indicator_id, competence);
`;
