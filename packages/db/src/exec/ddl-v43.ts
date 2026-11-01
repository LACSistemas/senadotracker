// P14.1b: executivo eleito (prefeito/vice-prefeito) por município e mandato, via TSE (candidatos, eleição
// municipal 2024). Mesma regra de vencedor que o governador: CD_SIT_TOT_TURNO=1 ELEITO em qualquer turno.
// Chave municipal pelo entity_id canônico (IBGE7) — a correspondência SG_UE (código TSE do município) ↔ IBGE
// vem da tabela oficial do TSE, carregada em exec_entity_external_id com source = 3.
export const EXEC_DDL_V43 = `
CREATE TABLE civica_exec.exec_executive_mandate_municipal (
  role text NOT NULL CHECK (role IN ('PREFEITO','VICE_PREFEITO')),
  entity_id integer NOT NULL REFERENCES civica_exec.exec_entity,
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
  PRIMARY KEY (role, entity_id, election_year)
);
CREATE INDEX exec_executive_mandate_municipal_entity_idx ON civica_exec.exec_executive_mandate_municipal(entity_id, role);
`;
