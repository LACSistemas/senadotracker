// P13.5.3: compactação da tabela tarifária; o detalhamento integral permanece no RAW em D:.
export const EXEC_DDL_V31 = `
DROP TABLE IF EXISTS civica_exec.exec_energy_tariff;
CREATE TABLE civica_exec.exec_energy_tariff (
  source_key text PRIMARY KEY,
  sig_agente text,
  cnpj_distribuidora text,
  reh text,
  valid_from date,
  valid_to date,
  base_tarifaria text,
  sub_group text,
  modality text,
  tariff_class text,
  tariff_subclass text,
  tusd numeric(18,8),
  te numeric(18,8),
  source_hash bytea NOT NULL,
  collected_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX exec_energy_tariff_agent_valid_idx ON civica_exec.exec_energy_tariff(sig_agente, valid_from, valid_to);
`;
