import type { Pool } from 'pg';
import { JUDICIARY_SCHEMA } from './postgres-judiciary.ts';

/** P14.9 — repercussão geral do STF (temas), análogo aos precedentes qualificados do STJ (P14.4), mas
 * mais simples: a fonte (`portal.stf.jus.br/jurisprudenciaRepercussao/exportarDados.asp`, achado real —
 * um botão "Exportar Dados" público na página de temas, sem JavaScript, HTML servido direto, confirmado
 * por fetch simples com User-Agent genérico) entrega UMA tabela achatada, não processos/espelhos/decisões
 * separados como o STJ. Cada linha já é "tema completo": leading case, relator, título, descrição,
 * assuntos, tese fixada, situação e datas — sem vínculo de processos individuais detalhado.
 * O STF não tem jurisdição/súmulas vinculantes coletadas nesta fase (não investigado — ver relatório). */
export const JUDICIARY_STF_SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS ${JUDICIARY_SCHEMA}.jud_stf_rg_tema (
    tema_number text NOT NULL, publication_revision_id text NOT NULL,
    leading_case text, relator_name text, titulo text, descricao text, assuntos text,
    manifestacao_url text, acordao_search_url text, plenario_virtual text,
    has_repercussion boolean, judgment_date date, situation text,
    thesis text, thesis_date date, observation text,
    source_snapshot_id text NOT NULL REFERENCES ${JUDICIARY_SCHEMA}.jud_source_snapshot(snapshot_id),
    raw_row_hash text NOT NULL, provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (tema_number, publication_revision_id)
  )`,
  `CREATE INDEX IF NOT EXISTS jud_stf_rg_tema_active_idx ON ${JUDICIARY_SCHEMA}.jud_stf_rg_tema(publication_revision_id, situation, judgment_date)`,
  /** P14.10 — remuneração de ministros do STF (ativos e aposentados) e de quem ocupa o cargo comissionado
   * "Assessor de Ministro" — fonte real: `egesp-portal.stf.jus.br/transparencia/rendimento_folha`, o
   * Portal da Transparência de pessoal do próprio STF (divulgação voluntária desde 2012, resolução
   * administrativa), achado por investigação (não é `transparencia.stf.jus.br`, que bloqueia fetch simples
   * com 403 — este é outro domínio, público, sem bloqueio). Escopo deliberadamente restrito a estes dois
   * grupos — não ao quadro de pessoal inteiro (milhares de nomes) — porque só eles foram pedidos e porque
   * expor nominalmente a remuneração de milhares de servidores não eleitos extrapolaria o que o produto se
   * propõe a mostrar. `rubricas` guarda o detalhamento oficial (A-S: vencimentos, vantagens, descontos,
   * benefícios) exatamente como a própria fonte explica cada parcela — nunca um resumo nosso. */
  `CREATE TABLE IF NOT EXISTS ${JUDICIARY_SCHEMA}.jud_stf_rendimento_mensal (
    matricula text NOT NULL, ano int NOT NULL, mes int NOT NULL, publication_revision_id text NOT NULL,
    nome text NOT NULL, role text NOT NULL,
    cargo_efetivo text, cargo_comissionado text, nome_funcao text, lotacao text, situacao_funcional text,
    remuneracao_bruta numeric, remuneracao_liquida numeric, data_admissao date,
    rubricas jsonb NOT NULL DEFAULT '{}'::jsonb, detail_source_id text,
    source_snapshot_id text NOT NULL REFERENCES ${JUDICIARY_SCHEMA}.jud_source_snapshot(snapshot_id),
    raw_row_hash text NOT NULL, provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (matricula, ano, mes, publication_revision_id)
  )`,
  `CREATE INDEX IF NOT EXISTS jud_stf_rendimento_active_idx ON ${JUDICIARY_SCHEMA}.jud_stf_rendimento_mensal(publication_revision_id, role, nome)`,
];

export async function ensureJudiciaryStfSchema(pool: Pool): Promise<void> {
  for (const sql of JUDICIARY_STF_SCHEMA_SQL) await pool.query(sql);
}

async function activeRevision(pool: Pool) {
  return (await pool.query(`SELECT revision_id FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='STF_REPERCUSSAO_GERAL' AND is_active=true ORDER BY created_at DESC LIMIT 1`)).rows[0]?.revision_id ?? null;
}

export async function getJudiciaryStfOverview(pool: Pool) {
  const revision = await activeRevision(pool);
  if (!revision) return { revision: null, temas: 0, withThesis: 0, withRepercussion: 0 };
  const r = await pool.query(`SELECT
    count(*)::int AS temas,
    count(*) FILTER (WHERE thesis IS NOT NULL)::int AS "withThesis",
    count(*) FILTER (WHERE has_repercussion)::int AS "withRepercussion"
    FROM ${JUDICIARY_SCHEMA}.jud_stf_rg_tema WHERE publication_revision_id=$1`, [revision]);
  return { revision, ...r.rows[0] };
}

export async function getJudiciaryStfTemas(pool: Pool, filters: { situation?: string; hasRepercussion?: boolean; page?: number; pageSize?: number } = {}) {
  const rev = await activeRevision(pool); if (!rev) return { total: 0, page: 1, pageSize: 20, items: [] };
  const page = filters.page ?? 1; const pageSize = filters.pageSize ?? 20;
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error('Paginação STF inválida');
  const where = ['publication_revision_id=$1']; const args: unknown[] = [rev];
  if (filters.situation) { args.push(filters.situation); where.push(`situation=$${args.length}`); }
  if (filters.hasRepercussion !== undefined) { args.push(filters.hasRepercussion); where.push(`has_repercussion=$${args.length}`); }
  const total = Number((await pool.query(`SELECT count(*)::int n FROM ${JUDICIARY_SCHEMA}.jud_stf_rg_tema WHERE ${where.join(' AND ')}`, args)).rows[0].n);
  args.push(pageSize, (page - 1) * pageSize);
  const items = (await pool.query(`SELECT * FROM ${JUDICIARY_SCHEMA}.jud_stf_rg_tema WHERE ${where.join(' AND ')} ORDER BY tema_number::int LIMIT $${args.length - 1} OFFSET $${args.length}`, args)).rows;
  return { total, page, pageSize, items };
}

export async function getJudiciaryStfTemaDetail(pool: Pool, temaNumber: string) {
  const rev = await activeRevision(pool); if (!rev) return null;
  return (await pool.query(`SELECT * FROM ${JUDICIARY_SCHEMA}.jud_stf_rg_tema WHERE tema_number=$1 AND publication_revision_id=$2`, [temaNumber, rev])).rows[0] ?? null;
}

export async function getJudiciaryStfSourceCoverage(pool: Pool) {
  return (await pool.query(`SELECT revision_id,scope,row_count,state,is_active,last_known_good,created_at,snapshot_ids FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='STF_REPERCUSSAO_GERAL' ORDER BY created_at DESC`)).rows;
}

async function activePayrollRevision(pool: Pool) {
  return (await pool.query(`SELECT revision_id FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='STF_MINISTER_PAYROLL' AND is_active=true ORDER BY created_at DESC LIMIT 1`)).rows[0]?.revision_id ?? null;
}

export async function getJudiciaryStfPayrollOverview(pool: Pool) {
  const revision = await activePayrollRevision(pool);
  if (!revision) return { revision: null, ano: null, mes: null, ministros: 0, assessores: 0, totalBrutoMinistros: null, totalLiquidoMinistros: null };
  const r = await pool.query(`SELECT ano, mes,
    count(*) FILTER (WHERE role='MINISTRO')::int AS ministros,
    count(*) FILTER (WHERE role='ASSESSOR_MINISTRO')::int AS assessores,
    sum(remuneracao_bruta) FILTER (WHERE role='MINISTRO') AS "totalBrutoMinistros",
    sum(remuneracao_liquida) FILTER (WHERE role='MINISTRO') AS "totalLiquidoMinistros"
    FROM ${JUDICIARY_SCHEMA}.jud_stf_rendimento_mensal WHERE publication_revision_id=$1 GROUP BY ano, mes`, [revision]);
  return { revision, ...(r.rows[0] ?? { ano: null, mes: null, ministros: 0, assessores: 0, totalBrutoMinistros: null, totalLiquidoMinistros: null }) };
}

export async function getJudiciaryStfPayrollRoster(pool: Pool, filters: { role?: 'MINISTRO' | 'ASSESSOR_MINISTRO' } = {}) {
  const rev = await activePayrollRevision(pool); if (!rev) return { revision: null, items: [] };
  const where = ['publication_revision_id=$1']; const args: unknown[] = [rev];
  if (filters.role) { args.push(filters.role); where.push(`role=$${args.length}`); }
  const items = (await pool.query(
    `SELECT matricula, ano, mes, nome, role, cargo_efetivo, cargo_comissionado, nome_funcao, lotacao, situacao_funcional, remuneracao_bruta, remuneracao_liquida, data_admissao
     FROM ${JUDICIARY_SCHEMA}.jud_stf_rendimento_mensal WHERE ${where.join(' AND ')} ORDER BY role, nome`, args)).rows;
  return { revision: rev, items };
}

export async function getJudiciaryStfPayrollDetail(pool: Pool, matricula: string) {
  const rev = await activePayrollRevision(pool); if (!rev) return null;
  return (await pool.query(`SELECT * FROM ${JUDICIARY_SCHEMA}.jud_stf_rendimento_mensal WHERE matricula=$1 AND publication_revision_id=$2`, [matricula, rev])).rows[0] ?? null;
}
