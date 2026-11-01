// P14.1: executivo eleito (governador/vice-governador) por UF e mandato, via TSE (candidatos, CD_SIT_TOT_TURNO=1
// ELEITO em qualquer turno — não depende do turno em que a eleição foi decidida). Prefeito fica para depois.
export const EXEC_DDL_V41 = `
CREATE TABLE civica_exec.exec_executive_mandate (
  role text NOT NULL CHECK (role IN ('GOVERNADOR','VICE_GOVERNADOR')),
  uf text NOT NULL,
  election_year smallint NOT NULL,
  mandate_start date NOT NULL,
  mandate_end date NOT NULL,
  sq_candidato text NOT NULL,
  candidate_name text NOT NULL,
  ballot_name text NOT NULL,
  party text NOT NULL,
  elected_round smallint NOT NULL,
  photo_url text,
  source_hash bytea NOT NULL,
  collected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, uf, election_year)
);
CREATE INDEX exec_executive_mandate_uf_idx ON civica_exec.exec_executive_mandate(uf, role);
`;
