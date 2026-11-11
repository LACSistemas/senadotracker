import type { Pool } from 'pg';
import { JUDICIARY_SCHEMA } from './postgres-judiciary.ts';

/** P14.11 — jurisprudência geral do STF (acórdãos e decisões monocráticas), fonte real achada por
 * investigação de schema: `jurisprudencia.stf.jus.br/api/search/search`, um Elasticsearch público por
 * trás da busca de jurisprudência do próprio site (corpo da requisição reconstruído a partir das mutações
 * JQ do pacote R `jjesusfilho/stf`, confirmado por teste real — 372.583 acórdãos e 759.958 decisões
 * monocráticas desde 1892, `track_total_hits` real, não estimativa).
 *
 * Escopo deliberado pra não estourar o orçamento de banco (a fonte não cabe inteira — texto integral de
 * 1,13M documentos passaria de 17GB): o JSON bruto de CADA busca (com `inteiro_teor_texto`/`decisao_texto`
 * completos) vai só pro arquivo em D:\Civica (nunca no banco); no Postgres entra uma fatia enxuta —
 * metadados + `ementa_texto` completo (acórdãos, ~750B em média) + um resumo truncado do início da decisão
 * (decisões monocráticas, cujo único campo de conteúdo é grande, ~9KB em média). Link pra fonte oficial
 * (`inteiro_teor_url`/`dje_url`, que a própria API já devolve) cobre quem quiser o texto completo — mesmo
 * padrão já usado pelos precedentes do STJ e pelos temas de Repercussão Geral do STF neste produto. */
export const JUDICIARY_STF_JURISPRUDENCIA_SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS ${JUDICIARY_SCHEMA}.jud_stf_jurisprudencia_acordao (
    doc_id text NOT NULL, publication_revision_id text NOT NULL,
    processo_codigo_completo text, processo_numero int, classe_sigla text, uf_sigla text,
    relator_nome text, orgao_julgador text, is_repercussao_geral boolean,
    julgamento_data date, publicacao_data date,
    ementa_texto text, inteiro_teor_url text, dje_url text,
    source_snapshot_id text NOT NULL REFERENCES ${JUDICIARY_SCHEMA}.jud_source_snapshot(snapshot_id),
    raw_row_hash text NOT NULL, provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (doc_id, publication_revision_id)
  )`,
  `CREATE INDEX IF NOT EXISTS jud_stf_jur_acordao_active_idx ON ${JUDICIARY_SCHEMA}.jud_stf_jurisprudencia_acordao(publication_revision_id, relator_nome, julgamento_data)`,
  `CREATE TABLE IF NOT EXISTS ${JUDICIARY_SCHEMA}.jud_stf_jurisprudencia_decisao (
    doc_id text NOT NULL, publication_revision_id text NOT NULL,
    processo_codigo_completo text, processo_numero int, classe_sigla text, uf_sigla text,
    relator_nome text, is_decisao_presidencia boolean,
    julgamento_data date, publicacao_data date,
    decisao_resumo text, inteiro_teor_url text, dje_url text,
    source_snapshot_id text NOT NULL REFERENCES ${JUDICIARY_SCHEMA}.jud_source_snapshot(snapshot_id),
    raw_row_hash text NOT NULL, provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (doc_id, publication_revision_id)
  )`,
  `CREATE INDEX IF NOT EXISTS jud_stf_jur_decisao_active_idx ON ${JUDICIARY_SCHEMA}.jud_stf_jurisprudencia_decisao(publication_revision_id, relator_nome, julgamento_data)`,
];

export async function ensureJudiciaryStfJurisprudenciaSchema(pool: Pool): Promise<void> {
  for (const sql of JUDICIARY_STF_JURISPRUDENCIA_SCHEMA_SQL) await pool.query(sql);
}

async function activeJurisRevision(pool: Pool) {
  return (await pool.query(`SELECT revision_id FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='STF_JURISPRUDENCIA_GERAL' AND is_active=true ORDER BY created_at DESC LIMIT 1`)).rows[0]?.revision_id ?? null;
}

export async function getJudiciaryStfJurisprudenciaOverview(pool: Pool) {
  const rev = await activeJurisRevision(pool);
  if (!rev) return { revision: null, acordaos: 0, decisoes: 0, minAno: null, maxAno: null };
  const r = await pool.query(`SELECT
    (SELECT count(*) FROM ${JUDICIARY_SCHEMA}.jud_stf_jurisprudencia_acordao WHERE publication_revision_id=$1)::int AS acordaos,
    (SELECT count(*) FROM ${JUDICIARY_SCHEMA}.jud_stf_jurisprudencia_decisao WHERE publication_revision_id=$1)::int AS decisoes,
    (SELECT min(extract(year FROM julgamento_data))::int FROM ${JUDICIARY_SCHEMA}.jud_stf_jurisprudencia_acordao WHERE publication_revision_id=$1) AS "minAno",
    (SELECT max(extract(year FROM julgamento_data))::int FROM ${JUDICIARY_SCHEMA}.jud_stf_jurisprudencia_acordao WHERE publication_revision_id=$1) AS "maxAno"
  `, [rev]);
  return { revision: rev, ...r.rows[0] };
}

export async function getJudiciaryStfCasosPorRelator(pool: Pool, base: 'acordao' | 'decisao' = 'acordao') {
  const rev = await activeJurisRevision(pool); if (!rev) return { revision: null, items: [] };
  const table = base === 'acordao' ? 'jud_stf_jurisprudencia_acordao' : 'jud_stf_jurisprudencia_decisao';
  const items = (await pool.query(
    `SELECT relator_nome, count(*)::int AS casos FROM ${JUDICIARY_SCHEMA}.${table}
     WHERE publication_revision_id=$1 AND relator_nome IS NOT NULL GROUP BY relator_nome ORDER BY casos DESC`, [rev])).rows;
  return { revision: rev, items };
}

export type JurisprudenciaFilters = { base?: 'acordao' | 'decisao'; relator?: string; ano?: number; classe?: string; uf?: string; q?: string; page?: number; pageSize?: number };

export async function getJudiciaryStfJurisprudenciaExplorer(pool: Pool, filters: JurisprudenciaFilters = {}) {
  const base = filters.base === 'decisao' ? 'decisao' as const : 'acordao' as const;
  const rev = await activeJurisRevision(pool);
  const page = filters.page ?? 1; const pageSize = filters.pageSize ?? 20;
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error('Paginação inválida');
  if (!rev) return { revision: null, base, total: 0, page, pageSize, items: [] };
  const table = base === 'acordao' ? 'jud_stf_jurisprudencia_acordao' : 'jud_stf_jurisprudencia_decisao';
  const textCol = base === 'acordao' ? 'ementa_texto' : 'decisao_resumo';
  const where = ['publication_revision_id=$1']; const args: unknown[] = [rev];
  if (filters.relator) { args.push(filters.relator); where.push(`relator_nome=$${args.length}`); }
  if (filters.ano) { args.push(filters.ano); where.push(`extract(year FROM julgamento_data)=$${args.length}`); }
  if (filters.classe) { args.push(filters.classe); where.push(`classe_sigla=$${args.length}`); }
  if (filters.uf) { args.push(filters.uf); where.push(`uf_sigla=$${args.length}`); }
  if (filters.q) { args.push(`%${filters.q}%`); where.push(`(${textCol} ILIKE $${args.length} OR processo_codigo_completo ILIKE $${args.length})`); }
  const total = Number((await pool.query(`SELECT count(*)::int n FROM ${JUDICIARY_SCHEMA}.${table} WHERE ${where.join(' AND ')}`, args)).rows[0].n);
  args.push(pageSize, (page - 1) * pageSize);
  const items = (await pool.query(
    `SELECT doc_id, processo_codigo_completo, classe_sigla, uf_sigla, relator_nome, julgamento_data, publicacao_data, ${textCol}, inteiro_teor_url, dje_url
     FROM ${JUDICIARY_SCHEMA}.${table} WHERE ${where.join(' AND ')} ORDER BY julgamento_data DESC, doc_id LIMIT $${args.length - 1} OFFSET $${args.length}`, args)).rows;
  return { revision: rev, base, total, page, pageSize, items };
}

export async function getJudiciaryStfJurisprudenciaDoc(pool: Pool, docId: string, base: 'acordao' | 'decisao' = 'acordao') {
  const rev = await activeJurisRevision(pool); if (!rev) return null;
  const table = base === 'acordao' ? 'jud_stf_jurisprudencia_acordao' : 'jud_stf_jurisprudencia_decisao';
  const row = (await pool.query(`SELECT * FROM ${JUDICIARY_SCHEMA}.${table} WHERE doc_id=$1 AND publication_revision_id=$2`, [docId, rev])).rows[0] ?? null;
  return row ? { base, ...row } : null;
}
