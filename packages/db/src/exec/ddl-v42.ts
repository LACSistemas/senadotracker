// P14.3: IDHM (PNUD/IPEA/FJP, Atlas do Desenvolvimento Humano), via espelho público do Ipeadata
// (api/odata4, séries ADH_IDHM/ADH_IDHM_E/ADH_IDHM_L/ADH_IDHM_R) — Brasil, UF e município, SÓ anos
// censitários (1991, 2000, 2010). Nunca apresentar como série anual: é decenal por desenho.
export const EXEC_DDL_V42 = `
CREATE TABLE civica_exec.exec_idhm_territory (
  territory_level text NOT NULL CHECK (territory_level IN ('BRASIL','UF','MUNICIPIO')),
  territory_code text NOT NULL,
  year smallint NOT NULL CHECK (year IN (1991, 2000, 2010)),
  idhm numeric(4,3) NOT NULL,
  idhm_renda numeric(4,3),
  idhm_longevidade numeric(4,3),
  idhm_educacao numeric(4,3),
  source_hash bytea NOT NULL,
  collected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (territory_level, territory_code, year)
);
CREATE INDEX exec_idhm_territory_code_idx ON civica_exec.exec_idhm_territory(territory_code, territory_level);
`;
