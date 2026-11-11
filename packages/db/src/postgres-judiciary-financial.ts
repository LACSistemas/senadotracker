import type { Pool } from 'pg';
import { JUDICIARY_SCHEMA } from './postgres-judiciary.ts';

export const JUDICIARY_FINANCIAL_SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS ${JUDICIARY_SCHEMA}.jud_fin_indicator (
    indicator_id text PRIMARY KEY, public_name text NOT NULL, description text NOT NULL, unit text NOT NULL,
    budget_stage text, source_scope text NOT NULL, formula text, coverage text NOT NULL, comparability text NOT NULL,
    provenance jsonb NOT NULL DEFAULT '{}'::jsonb
  )`,
  `CREATE TABLE IF NOT EXISTS ${JUDICIARY_SCHEMA}.jud_fin_fact (
    fact_id text NOT NULL, publication_revision_id text NOT NULL, tribunal_id text REFERENCES ${JUDICIARY_SCHEMA}.jud_tribunal(tribunal_id),
    source_institution text NOT NULL, reference_year integer NOT NULL, reference_month integer,
    account text NOT NULL, budget_stage text NOT NULL, expense_category text, beneficiary_type text,
    document_id text, amount_cents bigint NOT NULL, record_count integer,
    source_snapshot_id text NOT NULL REFERENCES ${JUDICIARY_SCHEMA}.jud_source_snapshot(snapshot_id),
    raw_row_hash text NOT NULL, provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (fact_id, publication_revision_id),
    CHECK (reference_month IS NULL OR reference_month BETWEEN 1 AND 12),
    CHECK (budget_stage IN ('EXPENSE_REPORTED','AUTHORIZED_BUDGET','COMMITTED','LIQUIDATED','PAID','REVENUE','TRANSFER'))
  )`,
  `CREATE INDEX IF NOT EXISTS jud_fin_fact_lookup_idx ON ${JUDICIARY_SCHEMA}.jud_fin_fact(publication_revision_id, tribunal_id, reference_year, reference_month, budget_stage)`,
  `CREATE TABLE IF NOT EXISTS ${JUDICIARY_SCHEMA}.jud_fin_payroll_aggregate (
    aggregate_id text NOT NULL, publication_revision_id text NOT NULL, tribunal_id text NOT NULL REFERENCES ${JUDICIARY_SCHEMA}.jud_tribunal(tribunal_id),
    reference_year integer NOT NULL, reference_month integer NOT NULL, tipo_servidor text, categoria_vinculo text, situacao text,
    record_count integer NOT NULL, remuneracao_paradigma_cents bigint NOT NULL, vantagens_pessoais_cents bigint NOT NULL,
    subsidio_funcao_cents bigint NOT NULL, indenizacoes_cents bigint NOT NULL, vantagens_eventuais_cents bigint NOT NULL,
    gratificacoes_cents bigint NOT NULL, previdencia_publica_cents bigint NOT NULL, imposto_renda_cents bigint NOT NULL,
    descontos_diversos_cents bigint NOT NULL, retencao_teto_cents bigint NOT NULL, diarias_cents bigint NOT NULL,
    total_creditos_cents bigint NOT NULL, total_debitos_cents bigint NOT NULL, rendimento_liquido_cents bigint NOT NULL,
    remuneracao_orgao_origem_cents bigint NOT NULL, source_snapshot_id text NOT NULL REFERENCES ${JUDICIARY_SCHEMA}.jud_source_snapshot(snapshot_id),
    raw_row_hash text NOT NULL, provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (aggregate_id, publication_revision_id), CHECK (reference_month BETWEEN 1 AND 12)
  )`,
  `CREATE INDEX IF NOT EXISTS jud_fin_payroll_lookup_idx ON ${JUDICIARY_SCHEMA}.jud_fin_payroll_aggregate(publication_revision_id, tribunal_id, reference_year, reference_month)`,
  `CREATE TABLE IF NOT EXISTS ${JUDICIARY_SCHEMA}.jud_fin_coverage (
    coverage_id text PRIMARY KEY, publication_revision_id text NOT NULL, source_provider text NOT NULL, scope text NOT NULL,
    status text NOT NULL, first_period text, last_period text, row_count integer NOT NULL DEFAULT 0, limitation text,
    provenance jsonb NOT NULL DEFAULT '{}'::jsonb
  )`,
  `CREATE INDEX IF NOT EXISTS jud_fin_coverage_lookup_idx ON ${JUDICIARY_SCHEMA}.jud_fin_coverage(publication_revision_id, source_provider, scope)`,
];

export async function ensureJudiciaryFinancialSchema(pool: Pool): Promise<void> { for (const sql of JUDICIARY_FINANCIAL_SCHEMA_SQL) await pool.query(sql); }

async function activeRevision(pool: Pool) { return (await pool.query(`SELECT revision_id FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='JUD_FINANCE' AND is_active=true ORDER BY created_at DESC LIMIT 1`)).rows[0]?.revision_id ?? null; }

export async function getJudiciaryFinancialOverview(pool: Pool, tribunalId?: string, year?: number) {
  const rev = await activeRevision(pool); if (!rev) return { revision: null, facts: [], payroll: [] };
  const args: unknown[] = [rev]; const where = ['publication_revision_id=$1'];
  if (tribunalId) { args.push(tribunalId); where.push(`tribunal_id=$${args.length}`); }
  if (year) { args.push(year); where.push(`reference_year=$${args.length}`); }
  const [facts, payroll] = await Promise.all([
    pool.query(`SELECT tribunal_id,reference_year,reference_month,account,budget_stage,expense_category,amount_cents,record_count FROM ${JUDICIARY_SCHEMA}.jud_fin_fact WHERE ${where.join(' AND ')} ORDER BY reference_year,reference_month,budget_stage,account`, args),
    pool.query(`SELECT tribunal_id,reference_year,reference_month,tipo_servidor,categoria_vinculo,situacao,record_count,total_creditos_cents,total_debitos_cents,rendimento_liquido_cents,diarias_cents FROM ${JUDICIARY_SCHEMA}.jud_fin_payroll_aggregate WHERE ${where.join(' AND ')} ORDER BY reference_year,reference_month,tipo_servidor`, args),
  ]); return { revision: rev, facts: facts.rows, payroll: payroll.rows };
}
export async function getJudiciaryAnnualExpenses(pool: Pool, tribunalId: string, year: number) { return (await pool.query(`SELECT budget_stage,expense_category,sum(amount_cents)::bigint amount_cents FROM ${JUDICIARY_SCHEMA}.jud_fin_fact WHERE publication_revision_id=(SELECT revision_id FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='JUD_FINANCE' AND is_active=true) AND tribunal_id=$1 AND reference_year=$2 GROUP BY budget_stage,expense_category ORDER BY budget_stage,expense_category`, [tribunalId,year])).rows; }
export async function getJudiciaryFinancialHistory(pool: Pool, tribunalId: string, account?: string) { const args: unknown[]=[tribunalId]; const filter=account?' AND account=$2':''; if(account) args.push(account); return (await pool.query(`SELECT reference_year,reference_month,budget_stage,account,amount_cents FROM ${JUDICIARY_SCHEMA}.jud_fin_fact WHERE publication_revision_id=(SELECT revision_id FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='JUD_FINANCE' AND is_active=true) AND tribunal_id=$1${filter} ORDER BY reference_year,reference_month`,args)).rows; }
export async function getJudiciaryBudgetExecution(pool: Pool, tribunalId: string, year: number) { return (await pool.query(`SELECT budget_stage,sum(amount_cents)::bigint amount_cents FROM ${JUDICIARY_SCHEMA}.jud_fin_fact WHERE publication_revision_id=(SELECT revision_id FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='JUD_FINANCE' AND is_active=true) AND tribunal_id=$1 AND reference_year=$2 GROUP BY budget_stage ORDER BY budget_stage`,[tribunalId,year])).rows; }
export async function getJudiciaryPersonnelCostOverview(pool: Pool, tribunalId: string, year: number) { return (await pool.query(`SELECT reference_year,reference_month,sum(total_creditos_cents)::bigint total_creditos_cents,sum(total_debitos_cents)::bigint total_debitos_cents,sum(rendimento_liquido_cents)::bigint rendimento_liquido_cents,sum(record_count)::int record_count FROM ${JUDICIARY_SCHEMA}.jud_fin_payroll_aggregate WHERE publication_revision_id=(SELECT revision_id FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='JUD_FINANCE' AND is_active=true) AND tribunal_id=$1 AND reference_year=$2 GROUP BY reference_year,reference_month ORDER BY reference_month`,[tribunalId,year])).rows; }
export async function getJudiciaryPayrollAggregate(pool: Pool, tribunalId: string, year?: number) { const args: unknown[]=[tribunalId]; const f=year?' AND reference_year=$2':''; if(year) args.push(year); return (await pool.query(`SELECT * FROM ${JUDICIARY_SCHEMA}.jud_fin_payroll_aggregate WHERE publication_revision_id=(SELECT revision_id FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='JUD_FINANCE' AND is_active=true) AND tribunal_id=$1${f} ORDER BY reference_year,reference_month,tipo_servidor`,args)).rows; }
export async function getJudiciaryFinancialCoverage(pool: Pool) { return (await pool.query(`SELECT * FROM ${JUDICIARY_SCHEMA}.jud_fin_coverage WHERE publication_revision_id=(SELECT revision_id FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='JUD_FINANCE' AND is_active=true) ORDER BY source_provider,scope`)).rows; }
export async function getJudiciaryFinancialMethodology(pool: Pool) { return (await pool.query(`SELECT * FROM ${JUDICIARY_SCHEMA}.jud_fin_indicator ORDER BY indicator_id`)).rows; }
