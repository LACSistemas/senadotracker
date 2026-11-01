// P14.2: PIB a preços correntes por território (IBGE/SIDRA, tabela 5938, variável 37) — Brasil, UF e município,
// 2002–2023. Per capita é calculado na leitura, juntando com exec_territory_population do mesmo ano (já existente).
export const EXEC_DDL_V40 = `
CREATE TABLE civica_exec.exec_gdp_territory (
  territory_level text NOT NULL CHECK (territory_level IN ('BRASIL','UF','MUNICIPIO')),
  territory_code text NOT NULL,
  territory_name text NOT NULL,
  year smallint NOT NULL,
  gdp_thousand_reais numeric(18,2) NOT NULL,
  source_hash bytea NOT NULL,
  collected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (territory_level, territory_code, year)
);
CREATE INDEX exec_gdp_territory_year_idx ON civica_exec.exec_gdp_territory(year);
CREATE INDEX exec_gdp_territory_code_idx ON civica_exec.exec_gdp_territory(territory_code, territory_level);
`;
