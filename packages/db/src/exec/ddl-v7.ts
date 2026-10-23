// DDL v7 do schema civica_exec: reinicia a sequência de exec_ref_code.ref_id (smallint, máx. 32.767) logo após o maior código em uso.
// Motivo: a primeira versão de ensureRefCodes (P9.5) usava INSERT ... ON CONFLICT DO NOTHING e consumia um valor por tentativa, esgotando a sequência com ~107 códigos
// existentes. Nenhum dado é alterado; ref_id já emitidos permanecem. O código passou a só inserir o que falta.
export const EXEC_DDL_V7 = `
DO $$ BEGIN
  EXECUTE format('ALTER TABLE civica_exec.exec_ref_code ALTER COLUMN ref_id RESTART WITH %s', (SELECT coalesce(max(ref_id), 0) + 1 FROM civica_exec.exec_ref_code));
END $$;
`;
