// P13.5.3: chave tarifária compactada como SHA-256 binário; remove REH textual redundante (RAW preserva o original).
export const EXEC_DDL_V33 = `
DROP TABLE IF EXISTS civica_exec.exec_energy_tariff;
CREATE TABLE civica_exec.exec_energy_tariff (
  source_key bytea PRIMARY KEY,
  sig_agente text,
  cnpj_distribuidora text,
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
`;
