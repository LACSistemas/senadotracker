// P14.13: PISA (OCDE, via espelho público da Our World in Data) — Brasil, média OCDE e média dos
// participantes do PISA, por disciplina e edição. Internacional e só nível-país (PISA não tem recorte
// estadual/municipal) — nunca comparar na mesma escala do Ideb/Saeb (civica_exec educacao-learn, escalas
// oficiais próprias e incompatíveis entre si).
export const EXEC_DDL_V47 = `
CREATE TABLE civica_exec.exec_pisa_score (
  entity text NOT NULL CHECK (entity IN ('BRASIL','MEDIA_OCDE','MEDIA_PARTICIPANTES_PISA')),
  subject text NOT NULL CHECK (subject IN ('MATEMATICA','LEITURA','CIENCIAS')),
  edition smallint NOT NULL,
  score numeric(6,2) NOT NULL,
  source_hash bytea NOT NULL,
  collected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity, subject, edition)
);
`;
