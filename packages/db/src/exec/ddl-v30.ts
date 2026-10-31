// P13.5.3: envelope compacto de energia distribuída, tarifas e estabelecimentos ANP.
export const EXEC_DDL_V30 = `
CREATE TABLE civica_exec.exec_energy_mmgd_municipality (
  competence integer NOT NULL,
  ibge7 integer NOT NULL,
  uf char(2) NOT NULL,
  municipality text NOT NULL,
  enterprise_count integer NOT NULL,
  total_installed_kw numeric(18,3) NOT NULL,
  solar_enterprise_count integer NOT NULL,
  solar_installed_kw numeric(18,3) NOT NULL,
  source_rows integer NOT NULL,
  source_hash bytea NOT NULL,
  collected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (competence, ibge7)
);
CREATE INDEX exec_energy_mmgd_mun_uf_idx ON civica_exec.exec_energy_mmgd_municipality(uf);

CREATE TABLE civica_exec.exec_energy_mmgd_source (
  competence integer NOT NULL,
  source_code text NOT NULL,
  source_name text NOT NULL,
  enterprise_count integer NOT NULL,
  installed_kw numeric(18,3) NOT NULL,
  source_rows integer NOT NULL,
  source_hash bytea NOT NULL,
  collected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (competence, source_code)
);

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
  detail text,
  tariff_post text,
  tertiary_unit text,
  sig_agente_acessante text,
  tusd numeric(18,8),
  te numeric(18,8),
  source_hash bytea NOT NULL,
  collected_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX exec_energy_tariff_agent_valid_idx ON civica_exec.exec_energy_tariff(sig_agente, valid_from, valid_to);

CREATE TABLE civica_exec.exec_anp_establishment (
  source_system text NOT NULL,
  source_key text NOT NULL,
  uf char(2),
  municipality text,
  establishment_type text NOT NULL,
  source_status text,
  source_hash bytea NOT NULL,
  collected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_system, source_key)
);
CREATE INDEX exec_anp_estab_territory_idx ON civica_exec.exec_anp_establishment(uf, municipality, establishment_type);

CREATE TABLE civica_exec.exec_anp_price (
  reference_week date NOT NULL,
  product text NOT NULL,
  uf char(2),
  ibge7 integer,
  municipality text,
  average_price numeric(18,6),
  unit text,
  observations integer,
  min_price numeric(18,6),
  max_price numeric(18,6),
  source_hash bytea NOT NULL,
  collected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (reference_week, product, uf, municipality)
);
CREATE INDEX exec_anp_price_mun_idx ON civica_exec.exec_anp_price(ibge7, product, reference_week);
`;
