// P14.13: amplia exec_executive_mandate (P14.1) pro nível federal — presidente/vice-presidente, uf='BR'.
// Nenhuma tabela nova, nenhuma coluna nova: só o CHECK de `role` passa a aceitar os 2 papéis federais.
export const EXEC_DDL_V45 = `
ALTER TABLE civica_exec.exec_executive_mandate DROP CONSTRAINT exec_executive_mandate_role_check;
ALTER TABLE civica_exec.exec_executive_mandate ADD CONSTRAINT exec_executive_mandate_role_check
  CHECK (role IN ('GOVERNADOR','VICE_GOVERNADOR','PRESIDENTE','VICE_PRESIDENTE'));
`;
