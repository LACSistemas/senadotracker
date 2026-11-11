// P14 (reeleição): coluna aditiva em exec_executive_mandate/exec_executive_mandate_municipal para o
// autodeclarado ST_REELEICAO do TSE (arquivo "Candidatos - Informações complementares", consulta_cand_
// complementar_<ano>, casado por sq_candidato) — o próprio candidato marca se está concorrendo à reeleição
// no ato da candidatura. NULL até o backfill rodar (nunca false por omissão: ausência ≠ "não é reeleição").
export const EXEC_DDL_V44 = `
ALTER TABLE civica_exec.exec_executive_mandate ADD COLUMN is_reelection boolean;
ALTER TABLE civica_exec.exec_executive_mandate_municipal ADD COLUMN is_reelection boolean;
`;
