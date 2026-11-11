// P14.13: HDI global (PNUD, Human Development Report, via espelho público da Our World in Data) — Brasil,
// média da América do Sul e média mundial, 1990 em diante. Indicador PARALELO ao IDHM nacional
// (civica_exec.exec_idhm_territory, ddl-v42, PNUD/IPEA/FJP, decenal 1991/2000/2010) — metodologias
// diferentes, nunca tratar como a mesma série nem somar/misturar os dois.
export const EXEC_DDL_V46 = `
CREATE TABLE civica_exec.exec_hdi_global (
  entity text NOT NULL CHECK (entity IN ('BRASIL','AMERICA_DO_SUL','MUNDO')),
  year smallint NOT NULL,
  hdi numeric(4,3) NOT NULL,
  source_hash bytea NOT NULL,
  collected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity, year)
);
`;
