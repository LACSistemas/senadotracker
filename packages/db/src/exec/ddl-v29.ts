// P13.5.2: cadastros físicos de barragens e diagnóstico municipal Atlas Águas.
export const EXEC_DDL_V29 = `
CREATE TABLE civica_exec.exec_dam_facility (
  facility_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_system text NOT NULL,
  source_key text NOT NULL,
  name text,
  entrepreneur text,
  uf char(2),
  municipality text,
  ibge7 integer,
  latitude numeric(10,7),
  longitude numeric(10,7),
  primary_use text,
  category_risk text,
  potential_damage text,
  operational_status text,
  emergency_level text,
  pnsb_applicability text,
  pae_status text,
  inspection_date date,
  fiscal_authority text,
  raw_run_id integer,
  source_hash bytea NOT NULL,
  collected_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_system, source_key)
);
CREATE INDEX exec_dam_facility_ibge_idx ON civica_exec.exec_dam_facility(ibge7) WHERE ibge7 IS NOT NULL;
CREATE INDEX exec_dam_facility_uf_idx ON civica_exec.exec_dam_facility(uf);
CREATE INDEX exec_dam_facility_source_idx ON civica_exec.exec_dam_facility(source_system);

CREATE TABLE civica_exec.exec_dam_atlas_municipality (
  ibge7 integer PRIMARY KEY,
  municipality text,
  uf char(2),
  ish_class text,
  source_water_type text,
  producer_system_class text,
  distribution_system_class text,
  operator_type text,
  source_hash bytea NOT NULL,
  collected_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX exec_dam_atlas_uf_idx ON civica_exec.exec_dam_atlas_municipality(uf);
`;
