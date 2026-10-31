// P13.5.4: logística nacional (modelo compacto; fatos derivados, sem dados brutos).
export const EXEC_DDL_V34 = `
CREATE TABLE civica_exec.exec_log_facility (
  source_system text NOT NULL,
  source_key text NOT NULL,
  facility_type text NOT NULL,
  name text,
  uf char(2),
  municipality text,
  ibge7 integer,
  municipality_served text,
  oaci text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  status text,
  competence integer,
  source_hash bytea NOT NULL,
  collected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_system, source_key)
);
CREATE INDEX exec_log_facility_ibge_idx ON civica_exec.exec_log_facility(ibge7) WHERE ibge7 IS NOT NULL;
CREATE INDEX exec_log_facility_uf_idx ON civica_exec.exec_log_facility(uf);

CREATE TABLE civica_exec.exec_log_network_segment (
  source_system text NOT NULL,
  source_key text NOT NULL,
  network_type text NOT NULL,
  route text,
  uf char(2),
  segment text,
  length_km numeric(14,3),
  paved_km numeric(14,3),
  surface text,
  condition_index numeric(14,4),
  competence integer,
  source_hash bytea NOT NULL,
  collected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_system, source_key)
);
CREATE INDEX exec_log_network_uf_idx ON civica_exec.exec_log_network_segment(uf);

CREATE TABLE civica_exec.exec_log_air_operation_month (
  source_system text NOT NULL,
  source_key text NOT NULL,
  competence integer NOT NULL,
  airport_code text,
  uf char(2),
  municipality text,
  passenger_count numeric(18,2),
  cargo_kg numeric(18,2),
  departures numeric(18,2),
  source_hash bytea NOT NULL,
  collected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_system, source_key, competence)
);
CREATE INDEX exec_log_air_op_uf_idx ON civica_exec.exec_log_air_operation_month(uf, competence);
`;
