import type { Pool } from 'pg';
import { JUDICIARY_SCHEMA } from './postgres-judiciary.ts';

/**
 * Quadro de pessoal por tribunal (P14.16): "quantas pessoas trabalham e em que situação" — nunca
 * remuneração individual. Uma única tabela longa/estreita (mesmo padrão de `jud_fin_fact`, dimensão
 * `budget_stage` lá vira `status` aqui) cobre os vários Anexos da Resolução CNJ 102/2009 que publicam
 * quantitativo de cargos: cada Anexo tem colunas próprias na fonte, mas todos descrevem contagens de
 * pessoas/cargos por categoria e situação — por isso um fato genérico, não uma tabela por Anexo.
 */
export const JUDICIARY_PERSONNEL_SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS ${JUDICIARY_SCHEMA}.jud_personnel_fact (
    fact_id text NOT NULL, publication_revision_id text NOT NULL, tribunal_id text NOT NULL REFERENCES ${JUDICIARY_SCHEMA}.jud_tribunal(tribunal_id),
    source_institution text NOT NULL, reference_year integer NOT NULL, reference_month integer NOT NULL,
    source_annex text NOT NULL, career_track text, position_title text, class_level text, status text NOT NULL, headcount integer NOT NULL,
    source_snapshot_id text NOT NULL REFERENCES ${JUDICIARY_SCHEMA}.jud_source_snapshot(snapshot_id),
    raw_row_hash text NOT NULL, provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (fact_id, publication_revision_id), CHECK (reference_month BETWEEN 1 AND 12), CHECK (headcount >= 0)
  )`,
  `CREATE INDEX IF NOT EXISTS jud_personnel_fact_lookup_idx ON ${JUDICIARY_SCHEMA}.jud_personnel_fact(publication_revision_id, tribunal_id, reference_year, reference_month, source_annex)`,
  `CREATE TABLE IF NOT EXISTS ${JUDICIARY_SCHEMA}.jud_supplier_payment (
    payment_id text NOT NULL, publication_revision_id text NOT NULL, tribunal_id text NOT NULL REFERENCES ${JUDICIARY_SCHEMA}.jud_tribunal(tribunal_id),
    source_institution text NOT NULL, reference_year integer NOT NULL, reference_month integer NOT NULL,
    funding_source text, document_number text, supplier_name text NOT NULL, supplier_cnpj text, bidding_type text, process_number text,
    expense_description text, amount_cents bigint NOT NULL,
    source_snapshot_id text NOT NULL REFERENCES ${JUDICIARY_SCHEMA}.jud_source_snapshot(snapshot_id),
    raw_row_hash text NOT NULL, provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (payment_id, publication_revision_id), CHECK (reference_month BETWEEN 1 AND 12)
  )`,
  `CREATE INDEX IF NOT EXISTS jud_supplier_payment_lookup_idx ON ${JUDICIARY_SCHEMA}.jud_supplier_payment(publication_revision_id, tribunal_id, reference_year, reference_month)`,
  `CREATE INDEX IF NOT EXISTS jud_supplier_payment_supplier_idx ON ${JUDICIARY_SCHEMA}.jud_supplier_payment(publication_revision_id, tribunal_id, supplier_name)`,
];

export async function ensureJudiciaryPersonnelSchema(pool: Pool): Promise<void> { for (const sql of JUDICIARY_PERSONNEL_SCHEMA_SQL) await pool.query(sql); }

/** Escopo PRÓPRIO ('JUD_PERSONNEL'), separado de 'JUD_FINANCE': quadro de pessoal não é dinheiro — uma
 * atualização só de um dos dois não deveria invalidar a revisão publicada do outro. */
async function activePersonnelRevision(pool: Pool) { return (await pool.query(`SELECT revision_id FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='JUD_PERSONNEL' AND is_active=true ORDER BY created_at DESC LIMIT 1`)).rows[0]?.revision_id ?? null; }
async function activeFinanceRevision(pool: Pool) { return (await pool.query(`SELECT revision_id FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='JUD_FINANCE' AND is_active=true ORDER BY created_at DESC LIMIT 1`)).rows[0]?.revision_id ?? null; }

/** Quadro de pessoal mais recente de um tribunal, somado por status (ex.: quantos ativos, vagos, terceirizados) — não por cargo individual. */
export async function getJudiciaryPersonnelOverview(pool: Pool, tribunalId: string) {
  const rev = await activePersonnelRevision(pool); if (!rev) return { revision: null, latestPeriod: null, byAnnexStatus: [] };
  const latest = (await pool.query(`SELECT reference_year,reference_month FROM ${JUDICIARY_SCHEMA}.jud_personnel_fact WHERE publication_revision_id=$1 AND tribunal_id=$2 ORDER BY reference_year DESC,reference_month DESC LIMIT 1`, [rev, tribunalId])).rows[0];
  if (!latest) return { revision: rev, latestPeriod: null, byAnnexStatus: [] };
  const rows = (await pool.query(`SELECT source_annex,status,sum(headcount)::int headcount FROM ${JUDICIARY_SCHEMA}.jud_personnel_fact WHERE publication_revision_id=$1 AND tribunal_id=$2 AND reference_year=$3 AND reference_month=$4 GROUP BY source_annex,status ORDER BY source_annex,status`,
    [rev, tribunalId, latest.reference_year, latest.reference_month])).rows;
  return { revision: rev, latestPeriod: { year: latest.reference_year, month: latest.reference_month }, byAnnexStatus: rows };
}

/** Detalhamento por carreira/cargo de um Anexo específico, no período mais recente — para a tabela "quem trabalha, em que cargo". */
export async function getJudiciaryPersonnelByCareer(pool: Pool, tribunalId: string, sourceAnnex: string) {
  const rev = await activePersonnelRevision(pool); if (!rev) return [];
  const latest = (await pool.query(`SELECT reference_year,reference_month FROM ${JUDICIARY_SCHEMA}.jud_personnel_fact WHERE publication_revision_id=$1 AND tribunal_id=$2 AND source_annex=$3 ORDER BY reference_year DESC,reference_month DESC LIMIT 1`, [rev, tribunalId, sourceAnnex])).rows[0];
  if (!latest) return [];
  return (await pool.query(`SELECT career_track,position_title,class_level,status,sum(headcount)::int headcount FROM ${JUDICIARY_SCHEMA}.jud_personnel_fact WHERE publication_revision_id=$1 AND tribunal_id=$2 AND source_annex=$3 AND reference_year=$4 AND reference_month=$5 GROUP BY career_track,position_title,class_level,status ORDER BY career_track,position_title`,
    [rev, tribunalId, sourceAnnex, latest.reference_year, latest.reference_month])).rows;
}

/** Top fornecedores pagos de um tribunal, somado em TODO o período publicado na revisão ativa — nunca só o
 * mês mais recente: algumas fontes publicam 1 mês por revisão (TJCE), outras publicam vários meses de uma vez
 * num único arquivo (TJSC, formato largo jan-set) — somar só "o mês mais recente" mostraria ~1/9 do valor
 * real disponível pra essa última. `period` reporta a janela real (from/to), nunca um único mês fixo, pra
 * cobrir os dois casos sem distorcer nenhum. Soma por fornecedor, nunca o valor individual de um único
 * documento como se fosse o total do contrato. */
export async function getJudiciarySupplierPayments(pool: Pool, tribunalId: string, limit = 20) {
  const rev = await activeFinanceRevision(pool); if (!rev) return { revision: null, period: null, topSuppliers: [], total: null };
  const range = (await pool.query(`SELECT min(reference_year*12+reference_month) lo,max(reference_year*12+reference_month) hi FROM ${JUDICIARY_SCHEMA}.jud_supplier_payment WHERE publication_revision_id=$1 AND tribunal_id=$2`, [rev, tribunalId])).rows[0];
  if (range?.lo == null) return { revision: rev, period: null, topSuppliers: [], total: null };
  const toYm = (ym: number) => ({ year: Math.floor((ym - 1) / 12), month: ((ym - 1) % 12) + 1 });
  const period = { from: toYm(Number(range.lo)), to: toYm(Number(range.hi)) };
  const [topSuppliers, total] = await Promise.all([
    pool.query(`SELECT supplier_name,max(supplier_cnpj) supplier_cnpj,count(*)::int payments,sum(amount_cents)::bigint amount_cents FROM ${JUDICIARY_SCHEMA}.jud_supplier_payment WHERE publication_revision_id=$1 AND tribunal_id=$2 GROUP BY supplier_name ORDER BY amount_cents DESC LIMIT $3`,
      [rev, tribunalId, limit]),
    pool.query(`SELECT count(*)::int payments,sum(amount_cents)::bigint amount_cents FROM ${JUDICIARY_SCHEMA}.jud_supplier_payment WHERE publication_revision_id=$1 AND tribunal_id=$2`,
      [rev, tribunalId]),
  ]);
  return { revision: rev, period, topSuppliers: topSuppliers.rows, total: total.rows[0] ?? null };
}
