// P13.5.3: o índice tarifário secundário foi removido para manter o envelope de armazenamento;
// a chave primária source_key continua cobrindo replay e reconciliação, e o RAW detalhado está em D:.
export const EXEC_DDL_V32 = `DROP INDEX IF EXISTS civica_exec.exec_energy_tariff_agent_valid_idx;`;
