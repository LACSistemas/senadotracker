import type { Pool, PoolClient } from 'pg';

/**
 * Esquema temporal de `civica_poc.proposals` / `proposal_support`.
 * A coluna física `year` mantém o nome por compatibilidade, mas significa `identifierYear` (ano do número) e é NULL quando a
 * fonte não informa ano (Câmara: `ano = 0`). `presented_year` é derivado de `presented_at` em America/Sao_Paulo.
 */
type Queryable = Pick<Pool | PoolClient, 'query'>;

export const TEMPORAL_SCHEMA_SQL = [
  `ALTER TABLE civica_poc.proposals ADD COLUMN IF NOT EXISTS presented_year integer GENERATED ALWAYS AS (extract(year from (presented_at AT TIME ZONE 'America/Sao_Paulo'))::int) STORED`,
  `ALTER TABLE civica_poc.proposal_support ADD COLUMN IF NOT EXISTS presented_year integer GENERATED ALWAYS AS (extract(year from (presented_at AT TIME ZONE 'America/Sao_Paulo'))::int) STORED`,
  `CREATE INDEX IF NOT EXISTS proposals_presented_year_idx ON civica_poc.proposals (source, batch_id, presented_year, functional_group)`,
  `COMMENT ON COLUMN civica_poc.proposals.year IS 'identifierYear: ano oficial do número da proposição. NULL = a fonte não informa ano (Câmara ano=0). NUNCA 0 e NUNCA "ano em que foi apresentada".'`,
  `COMMENT ON COLUMN civica_poc.proposals.presented_at IS 'presentedAt: data oficial de apresentação da entidade naquela Casa (Senado: apresentação no Senado).'`,
  `COMMENT ON COLUMN civica_poc.proposals.presented_year IS 'presentedYear: ano civil de presented_at em America/Sao_Paulo (derivado).'`,
  `COMMENT ON COLUMN civica_poc.proposal_support.year IS 'identifierYear (ver civica_poc.proposals.year).'`,
  // origem do vínculo de autoria (entrada da taxonomia `classifyAuthorship`): tipo do autor e indicador de proponente
  `ALTER TABLE civica_poc.proposal_authors ADD COLUMN IF NOT EXISTS author_kind text`,
  `ALTER TABLE civica_poc.proposal_authors ADD COLUMN IF NOT EXISTS proponent boolean`,
  `COMMENT ON COLUMN civica_poc.proposal_authors.author_kind IS 'Câmara: tipoAutor oficial; Senado: siglaTipo da autoria (SENADOR, DEPUTADO, CAMARA…). NULL = não coletado.'`,
  `COMMENT ON COLUMN civica_poc.proposal_authors.proponent IS 'Câmara: proponente (true) ou apoio/coautoria (false). NULL = não informado.'`,
  // guarda contra regressão: nenhum carregador pode voltar a gravar 0
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='proposals_identifier_year_not_zero') THEN ALTER TABLE civica_poc.proposals ADD CONSTRAINT proposals_identifier_year_not_zero CHECK (year IS NULL OR year > 0) NOT VALID; END IF; END $$`,
];

/** DDL com `IF NOT EXISTS` ainda toma lock na tabela: só executa quando algo falta. */
export async function ensureTemporalSchema(db: Queryable) {
  const done = (await db.query(`SELECT (to_regclass('civica_poc.proposals_presented_year_idx') IS NOT NULL AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname='proposals_identifier_year_not_zero') AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='civica_poc' AND table_name='proposal_authors' AND column_name='proponent')) ok`)).rows[0]?.ok;
  if (done) return;
  for (const sql of TEMPORAL_SCHEMA_SQL) await db.query(sql);
}

export interface IdentifierYearMigrationResult { zeroBefore: number; updated: number; zeroAfter: number; nullAfter: number; vectorsRebuilt: number; constraintValidated: boolean }

/** 0 → NULL, idempotente. Reconstrói o vetor de busca das linhas alteradas (sem o token "/0"). Valida a guarda ao final. */
export async function migrateIdentifierYearZeroToNull(db: Queryable): Promise<IdentifierYearMigrationResult> {
  await ensureTemporalSchema(db);
  const count = async (sql: string) => Number((await db.query(sql)).rows[0].n);
  const zeroBefore = await count(`SELECT count(*)::int n FROM civica_poc.proposals WHERE year=0`);
  const updated = (await db.query(`UPDATE civica_poc.proposals SET year=NULL,
      search_vector=setweight(to_tsvector('simple',coalesce(type||' '||number::text,'')),'A') || setweight(to_tsvector('portuguese',coalesce(label,'')),'B') || setweight(to_tsvector('portuguese',coalesce(summary,'')),'C')
    WHERE year=0`)).rowCount ?? 0;
  await db.query(`ALTER TABLE civica_poc.proposals VALIDATE CONSTRAINT proposals_identifier_year_not_zero`);
  return { zeroBefore, updated, zeroAfter: await count(`SELECT count(*)::int n FROM civica_poc.proposals WHERE year=0`), nullAfter: await count(`SELECT count(*)::int n FROM civica_poc.proposals WHERE year IS NULL`), vectorsRebuilt: updated, constraintValidated: true };
}
