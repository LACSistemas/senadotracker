import type { Pool, PoolClient } from 'pg';
import { amendmentCodeOf, authorCodeOfAmendment, classifyEnte, SPECIAL_TRANSFER_KIND } from '@senadotracker/domain';

/**
 * Schema `civica_budget`: Transferências Especiais ("Emenda Pix") — domínio SEPARADO de `civica_poc.proposals`.
 *
 * Publicação: cada linha guarda o `run_id` da última coleta que a viu. A carga completa roda numa transação única
 * (upsert + remoção do que sumiu da fonte); a coleta ativa é a última `budget_ingestion_runs` com status 'published'.
 * O vínculo com pessoas NUNCA é gravado nas tabelas de fatos: vem de `author_code_crosswalk` (revisado) na leitura.
 */
type Queryable = Pick<Pool | PoolClient, 'query'>;

export const BUDGET_SCHEMA_SQL = [
  `CREATE SCHEMA IF NOT EXISTS civica_budget`,
  `CREATE TABLE IF NOT EXISTS civica_budget.budget_ingestion_runs (
    run_id text PRIMARY KEY, dataset text NOT NULL DEFAULT 'transferencias_especiais',
    started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
    status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','published','failed')),
    source_cutoff jsonb NOT NULL DEFAULT '{}', counts jsonb NOT NULL DEFAULT '{}', reconciliation jsonb NOT NULL DEFAULT '{}', error text)`,
  `CREATE TABLE IF NOT EXISTS civica_budget.budget_programs (
    program_id integer PRIMARY KEY, program_year integer, program_code text, modality text, superior_agency text, agency text,
    needed_amount numeric(18,2), made_available_amount numeric(18,2), blocked_amount numeric(18,2), run_id text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS civica_budget.budget_amendments (
    amendment_code text PRIMARY KEY CHECK (amendment_code ~ '^[0-9]{12}$'), amendment_year integer NOT NULL, author_code text NOT NULL,
    author_name text, kind text NOT NULL DEFAULT '${SPECIAL_TRANSFER_KIND}',
    in_transferegov boolean NOT NULL DEFAULT false, in_portal boolean NOT NULL DEFAULT false,
    portal_committed numeric(18,2), portal_liquidated numeric(18,2), portal_paid numeric(18,2), portal_outstanding_payables numeric(18,2),
    portal_outstanding_payables_cancelled numeric(18,2), portal_outstanding_payables_paid numeric(18,2),
    portal_uf text, portal_location text, portal_ibge_code text, portal_function text, portal_subfunction text,
    run_id text NOT NULL, portal_run_id text)`,
  `CREATE TABLE IF NOT EXISTS civica_budget.special_action_plans (
    plan_id bigint PRIMARY KEY, plan_code text NOT NULL, plan_year integer, modality text, situation text,
    amendment_code text, amendment_year integer, author_code text NOT NULL, author_name_in_plan text, amendment_number text, amendment_sequence text,
    beneficiary_cnpj text, beneficiary_name text, beneficiary_uf text, ente_type text NOT NULL, ibge_code text,
    custeio_amount numeric(18,2) NOT NULL DEFAULT 0, investimento_amount numeric(18,2) NOT NULL DEFAULT 0,
    policy_areas_text text, budget_programming text, impediment_reason text, program_id integer,
    work_plan_situation text, work_plan_start date, work_plan_end date, run_id text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS civica_budget.special_plan_functions (
    plan_id bigint NOT NULL, function_code integer NOT NULL, function_name text NOT NULL, subfunction_code integer NOT NULL, subfunction_name text NOT NULL,
    run_id text NOT NULL, PRIMARY KEY (plan_id, function_code, subfunction_code))`,
  `CREATE TABLE IF NOT EXISTS civica_budget.special_plan_executors (
    executor_id bigint PRIMARY KEY, plan_id bigint NOT NULL, executor_cnpj text, executor_name text, object_text text,
    custeio_amount numeric(18,2), investimento_amount numeric(18,2), run_id text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS civica_budget.special_plan_areas (
    executor_id bigint NOT NULL, area_code integer NOT NULL, area_type_code integer, area_type text, area_name text, run_id text NOT NULL,
    PRIMARY KEY (executor_id, area_code))`,
  `CREATE TABLE IF NOT EXISTS civica_budget.special_commitments (
    commitment_id bigint PRIMARY KEY, plan_id bigint NOT NULL, commitment_number text, status text, document_type text, expense_category text,
    natural_expense text, amount numeric(18,2) NOT NULL, issued_on date, issuer_unit integer, beneficiary_cnpj text, run_id text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS civica_budget.special_payment_documents (
    dh_id bigint PRIMARY KEY, commitment_id bigint NOT NULL, document_number text, status text, document_type text,
    issued_on date, due_on date, amount numeric(18,2), apportioned_amount numeric(18,2), run_id text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS civica_budget.special_payment_orders (
    op_ob_id bigint PRIMARY KEY, dh_id bigint NOT NULL, op_number text, ob_number text, status text,
    op_issued_on date, ob_issued_on date, status_on date, run_id text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS civica_budget.special_management_reports (
    report_id bigint PRIMARY KEY, plan_id bigint NOT NULL, report_kind text, report_status text, executed_amount numeric(18,2), pending_amount numeric(18,2),
    reported_at timestamptz, run_id text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS civica_budget.portal_beneficiary_payments (
    amendment_code text NOT NULL, payment_month text NOT NULL, favored_code text NOT NULL, row_seq integer NOT NULL,
    favored_name text, legal_nature text, favored_type text, favored_uf text, favored_municipality text, amount numeric(18,2) NOT NULL, run_id text NOT NULL,
    PRIMARY KEY (amendment_code, payment_month, favored_code, row_seq))`,
  // crosswalk SIOP → pessoa. `person_id` NULL = não resolvido (nunca escolher entre homônimos). Código SIOP é TEXT.
  `CREATE TABLE IF NOT EXISTS civica_budget.author_code_crosswalk (
    author_code text NOT NULL CHECK (author_code ~ '^[0-9]+$'), valid_from date NOT NULL, valid_to date,
    person_id text REFERENCES civica.people(id), house text CHECK (house IN ('camara','senado')), mandate_key text,
    method text, confidence text NOT NULL CHECK (confidence IN ('EXACT','HIGH','AMBIGUOUS','CONFLICT','UNMATCHED')),
    evidence_source jsonb NOT NULL DEFAULT '{}', reviewed boolean NOT NULL DEFAULT false, reviewed_at timestamptz,
    review_source text NOT NULL DEFAULT 'rule' CHECK (review_source IN ('rule','human')),
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (author_code, valid_from),
    CONSTRAINT crosswalk_reviewed_needs_person CHECK (NOT reviewed OR (person_id IS NOT NULL AND confidence IN ('EXACT','HIGH'))),
    CONSTRAINT crosswalk_house_needs_person CHECK (person_id IS NOT NULL OR house IS NULL))`,
  // única porta de atribuição: autor REVISADO (EXACT|HIGH) com pessoa e dentro da validade datada do código
  `CREATE OR REPLACE VIEW civica_budget.reviewed_amendment_authors AS
    SELECT a.amendment_code, a.amendment_year, a.author_code, cw.person_id, cw.house, cw.confidence
      FROM civica_budget.budget_amendments a
      JOIN civica_budget.author_code_crosswalk cw ON cw.author_code = a.author_code AND cw.reviewed AND cw.person_id IS NOT NULL AND cw.confidence IN ('EXACT','HIGH')
       AND a.amendment_year BETWEEN extract(year FROM cw.valid_from) AND coalesce(extract(year FROM cw.valid_to), 9999)`,
  `CREATE INDEX IF NOT EXISTS special_action_plans_amendment_idx ON civica_budget.special_action_plans (amendment_code)`,
  `CREATE INDEX IF NOT EXISTS special_action_plans_beneficiary_idx ON civica_budget.special_action_plans (beneficiary_cnpj)`,
  `CREATE INDEX IF NOT EXISTS special_action_plans_author_idx ON civica_budget.special_action_plans (author_code, amendment_year)`,
  `CREATE INDEX IF NOT EXISTS budget_amendments_author_idx ON civica_budget.budget_amendments (author_code, amendment_year)`,
  `CREATE INDEX IF NOT EXISTS special_commitments_plan_idx ON civica_budget.special_commitments (plan_id)`,
  `CREATE INDEX IF NOT EXISTS special_payment_documents_commitment_idx ON civica_budget.special_payment_documents (commitment_id)`,
  `CREATE INDEX IF NOT EXISTS special_payment_orders_dh_idx ON civica_budget.special_payment_orders (dh_id)`,
  `CREATE INDEX IF NOT EXISTS special_plan_executors_plan_idx ON civica_budget.special_plan_executors (plan_id)`,
  `CREATE INDEX IF NOT EXISTS special_management_reports_plan_idx ON civica_budget.special_management_reports (plan_id)`,
  `CREATE INDEX IF NOT EXISTS portal_beneficiary_payments_favored_idx ON civica_budget.portal_beneficiary_payments (favored_code)`,
  `CREATE INDEX IF NOT EXISTS author_code_crosswalk_person_idx ON civica_budget.author_code_crosswalk (person_id)`,
];

/** DDL com `IF NOT EXISTS` ainda trava tabela: só executa quando algo falta. */
export async function ensureBudgetSchema(db: Queryable) {
  const done = (await db.query(`SELECT (to_regclass('civica_budget.author_code_crosswalk_person_idx') IS NOT NULL AND to_regclass('civica_budget.portal_beneficiary_payments_favored_idx') IS NOT NULL AND to_regclass('civica_budget.reviewed_amendment_authors') IS NOT NULL) ok`)).rows[0]?.ok;
  if (done) return;
  for (const sql of BUDGET_SCHEMA_SQL) await db.query(sql);
}

// ------------------------------------------------------------------------------------------------ carga em lote
type Row = unknown[];
export async function bulkUpsert(db: Queryable, table: string, columns: string[], conflict: string[], rows: Row[], chunk = Math.floor(60000 / columns.length)) {
  if (!rows.length) return 0;
  const update = columns.filter(c => !conflict.includes(c)).map(c => `${c}=EXCLUDED.${c}`).join(',');
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk); const values: unknown[] = [];
    const placeholders = slice.map(row => `(${row.map(v => { values.push(v ?? null); return `$${values.length}`; }).join(',')})`).join(',');
    await db.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES ${placeholders} ON CONFLICT (${conflict.join(',')}) DO ${update ? `UPDATE SET ${update}` : 'NOTHING'}`, values);
  }
  return rows.length;
}

export type SourceRow = Record<string, unknown>;
export interface TransferegovTables {
  programa_especial: SourceRow[]; plano_acao_especial: SourceRow[]; empenho_especial: SourceRow[]; documento_habil_especial: SourceRow[];
  ordem_pagamento_ordem_bancaria_especial: SourceRow[]; executor_especial: SourceRow[]; plano_trabalho_especial: SourceRow[];
  finalidade_especial: SourceRow[]; relatorio_gestao_novo_especial: SourceRow[];
}
export interface PortalAmendmentRow {
  amendmentCode: string; year: number; authorCode: string; authorName: string; kind: string; uf: string | null; location: string | null; ibgeCode: string | null;
  functionName: string | null; subfunctionName: string | null; committed: number | null; liquidated: number | null; paid: number | null;
  outstanding: number | null; outstandingCancelled: number | null; outstandingPaid: number | null;
}
export interface PortalPaymentRow { amendmentCode: string; month: string; favoredCode: string; favoredName: string | null; legalNature: string | null; favoredType: string | null; uf: string | null; municipality: string | null; amount: number }
export interface BudgetLoadInput { tables: TransferegovTables; portalAmendments: PortalAmendmentRow[]; portalPayments: PortalPaymentRow[] }

const text = (v: unknown) => v === null || v === undefined || v === '' ? null : String(v);
const num = (v: unknown) => v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
const date = (v: unknown) => { const s = text(v); return s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null; };
const int = (v: unknown) => { const n = num(v); return n === null ? null : Math.trunc(n); };

/** "15-Urbanismo / 451-Infraestrutura Urbana , 10-Saúde / 301-Atenção Básica" → pares função/subfunção. */
export function parsePolicyAreas(value: unknown) {
  return String(value ?? '').split(/\s,\s|,\s(?=\d+-)/).map(part => /^\s*(\d+)-(.+?)\s*\/\s*(\d+)-(.+?)\s*$/.exec(part)).filter((m): m is RegExpExecArray => !!m)
    .map(m => ({ functionCode: Number(m[1]), functionName: m[2]!.trim(), subfunctionCode: Number(m[3]), subfunctionName: m[4]!.trim() }));
}
const dedupe = <T>(rows: T[], key: (row: T) => string) => { const m = new Map<string, T>(); for (const r of rows) m.set(key(r), r); return { rows: [...m.values()], duplicates: rows.length - m.size }; };

export interface BudgetLoadResult { runId: string; counts: Record<string, number>; warnings: Record<string, number> }

/**
 * Carga completa e atômica (uma transação). Reexecutável: upsert por PK natural + remoção do que a fonte deixou de ter.
 * Linhas órfãs da fonte (filho sem pai) NÃO são descartadas: ficam preservadas e contadas na reconciliação.
 */
export async function loadBudgetRun(client: PoolClient, runId: string, input: BudgetLoadInput, options: { purgeStale?: boolean } = {}): Promise<BudgetLoadResult> {
  const t = input.tables; const counts: Record<string, number> = {}; const warnings: Record<string, number> = {};
  const T = (name: string) => `civica_budget.${name}`;

  const programs = dedupe(t.programa_especial, r => String(r.id_programa));
  counts.budget_programs = await bulkUpsert(client, T('budget_programs'), ['program_id','program_year','program_code','modality','superior_agency','agency','needed_amount','made_available_amount','blocked_amount','run_id'], ['program_id'],
    programs.rows.map(r => [int(r.id_programa), int(r.ano_programa), text(r.codigo_programa), text(r.modalidade_programa), text(r.sigla_orgao_superior_programa), text(r.sigla_orgao_programa), num(r.valor_necessidade_financeira_programa), num(r.valor_total_disponibilizado_programa), num(r.valor_impedido_programa), runId]));

  // plano de trabalho por plano (1:1 na fonte; se houver mais de um, vale o de maior id)
  const workPlan = new Map<number, SourceRow>(); for (const w of t.plano_trabalho_especial) { const id = Number(w.id_plano_acao); const cur = workPlan.get(id); if (!cur || Number(w.id_plano_trabalho) > Number(cur.id_plano_trabalho)) workPlan.set(id, w); }

  // emendas = união Transferegov (planos) ∪ Portal (especiais)
  interface A { code: string; year: number; authorCode: string; names: Map<string, number>; inTge: boolean; portal?: PortalAmendmentRow }
  const amendments = new Map<string, A>();
  let plansWithoutCode = 0;
  for (const p of t.plano_acao_especial) {
    const code = amendmentCodeOf(p.codigo_emenda_parlamentar_formatado_plano_acao); if (!code) { plansWithoutCode++; continue; }
    const a = amendments.get(code) ?? { code, year: Number(code.slice(0, 4)), authorCode: authorCodeOfAmendment(code), names: new Map(), inTge: true };
    const name = text(p.nome_parlamentar_emenda_plano_acao); if (name) a.names.set(name, (a.names.get(name) ?? 0) + 1);
    amendments.set(code, a);
  }
  warnings.plans_without_amendment_code = plansWithoutCode;
  for (const p of input.portalAmendments) { const a: A = amendments.get(p.amendmentCode) ?? { code: p.amendmentCode, year: p.year, authorCode: p.authorCode, names: new Map(), inTge: false }; a.portal = p; if (!a.names.size && p.authorName) a.names.set(p.authorName, 1); amendments.set(p.amendmentCode, a); }
  const topName = (a: A) => [...a.names.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
  counts.budget_amendments = await bulkUpsert(client, T('budget_amendments'),
    ['amendment_code','amendment_year','author_code','author_name','kind','in_transferegov','in_portal','portal_committed','portal_liquidated','portal_paid','portal_outstanding_payables','portal_outstanding_payables_cancelled','portal_outstanding_payables_paid','portal_uf','portal_location','portal_ibge_code','portal_function','portal_subfunction','run_id','portal_run_id'], ['amendment_code'],
    [...amendments.values()].map(a => [a.code, a.year, a.authorCode, topName(a), SPECIAL_TRANSFER_KIND, a.inTge, !!a.portal, a.portal?.committed ?? null, a.portal?.liquidated ?? null, a.portal?.paid ?? null, a.portal?.outstanding ?? null, a.portal?.outstandingCancelled ?? null, a.portal?.outstandingPaid ?? null, a.portal?.uf ?? null, a.portal?.location ?? null, a.portal?.ibgeCode ?? null, a.portal?.functionName ?? null, a.portal?.subfunctionName ?? null, runId, a.portal ? runId : null]));

  const plans = dedupe(t.plano_acao_especial, r => String(r.id_plano_acao));
  warnings.duplicate_plans = plans.duplicates;
  counts.special_action_plans = await bulkUpsert(client, T('special_action_plans'),
    ['plan_id','plan_code','plan_year','modality','situation','amendment_code','amendment_year','author_code','author_name_in_plan','amendment_number','amendment_sequence','beneficiary_cnpj','beneficiary_name','beneficiary_uf','ente_type','ibge_code','custeio_amount','investimento_amount','policy_areas_text','budget_programming','impediment_reason','program_id','work_plan_situation','work_plan_start','work_plan_end','run_id'], ['plan_id'],
    plans.rows.map(p => { const w = workPlan.get(Number(p.id_plano_acao)); return [int(p.id_plano_acao), text(p.codigo_plano_acao), int(p.ano_plano_acao), text(p.modalidade_plano_acao), text(p.situacao_plano_acao), amendmentCodeOf(p.codigo_emenda_parlamentar_formatado_plano_acao), int(p.ano_emenda_parlamentar_plano_acao), String(p.codigo_parlamentar_emenda_plano_acao), text(p.nome_parlamentar_emenda_plano_acao), text(p.numero_emenda_parlamentar_plano_acao), text(p.sequencial_emenda_parlamentar_plano_acao), text(p.cnpj_beneficiario_plano_acao), text(p.nome_beneficiario_plano_acao), text(p.uf_beneficiario_plano_acao), classifyEnte(text(p.nome_beneficiario_plano_acao)), null, num(p.valor_custeio_plano_acao) ?? 0, num(p.valor_investimento_plano_acao) ?? 0, text(p.codigo_descricao_areas_politicas_publicas_plano_acao), text(p.descricao_programacao_orcamentaria_plano_acao), text(p.motivo_impedimento_plano_acao), int(p.id_programa), text(w?.situacao_plano_trabalho), date(w?.data_inicio_execucao_plano_trabalho), date(w?.data_fim_execucao_plano_trabalho), runId]; }));

  const functions = dedupe(plans.rows.flatMap(p => parsePolicyAreas(p.codigo_descricao_areas_politicas_publicas_plano_acao).map(f => ({ planId: Number(p.id_plano_acao), ...f }))), r => `${r.planId}:${r.functionCode}:${r.subfunctionCode}`);
  counts.special_plan_functions = await bulkUpsert(client, T('special_plan_functions'), ['plan_id','function_code','function_name','subfunction_code','subfunction_name','run_id'], ['plan_id','function_code','subfunction_code'], functions.rows.map(f => [f.planId, f.functionCode, f.functionName, f.subfunctionCode, f.subfunctionName, runId]));

  const executors = dedupe(t.executor_especial, r => String(r.id_executor));
  counts.special_plan_executors = await bulkUpsert(client, T('special_plan_executors'), ['executor_id','plan_id','executor_cnpj','executor_name','object_text','custeio_amount','investimento_amount','run_id'], ['executor_id'],
    executors.rows.map(e => [int(e.id_executor), int(e.id_plano_acao), text(e.cnpj_executor), text(e.nome_executor), text(e.objeto_executor), num(e.vl_custeio_executor), num(e.vl_investimento_executor), runId]));
  const areas = dedupe(t.finalidade_especial, r => `${r.id_executor}:${r.cd_area_politica_publica_pt}`); warnings.duplicate_areas = areas.duplicates;
  counts.special_plan_areas = await bulkUpsert(client, T('special_plan_areas'), ['executor_id','area_code','area_type_code','area_type','area_name','run_id'], ['executor_id','area_code'],
    areas.rows.map(a => [int(a.id_executor), int(a.cd_area_politica_publica_pt), int(a.cd_area_politica_publica_tipo_pt), text(a.area_politica_publica_tipo_pt), text(a.area_politica_publica_pt), runId]));
  const commitments = dedupe(t.empenho_especial, r => String(r.id_empenho));
  counts.special_commitments = await bulkUpsert(client, T('special_commitments'), ['commitment_id','plan_id','commitment_number','status','document_type','expense_category','natural_expense','amount','issued_on','issuer_unit','beneficiary_cnpj','run_id'], ['commitment_id'],
    commitments.rows.map(e => [int(e.id_empenho), int(e.id_plano_acao), text(e.numero_empenho), text(e.descricao_situacao_empenho), text(e.descricao_tipo_documento_empenho), text(e.categoria_despesa_empenho), text(e.natureza_despesa_empenho), num(e.valor_empenho) ?? 0, date(e.data_emissao_empenho), int(e.ug_emitente_empenho), text(e.cnpj_beneficiario_empenho), runId]));
  const documents = dedupe(t.documento_habil_especial, r => String(r.id_dh));
  counts.special_payment_documents = await bulkUpsert(client, T('special_payment_documents'), ['dh_id','commitment_id','document_number','status','document_type','issued_on','due_on','amount','apportioned_amount','run_id'], ['dh_id'],
    documents.rows.map(d => [int(d.id_dh), int(d.id_empenho), text(d.numero_documento_habil), text(d.descricao_situacao_dh), text(d.tipo_documento_dh), date(d.data_emissao_dh), date(d.data_vencimento_dh), num(d.valor_dh), num(d.valor_rateio_dh), runId]));
  const orders = dedupe(t.ordem_pagamento_ordem_bancaria_especial, r => String(r.id_op_ob));
  counts.special_payment_orders = await bulkUpsert(client, T('special_payment_orders'), ['op_ob_id','dh_id','op_number','ob_number','status','op_issued_on','ob_issued_on','status_on','run_id'], ['op_ob_id'],
    orders.rows.map(o => [int(o.id_op_ob), int(o.id_dh), text(o.numero_ordem_pagamento), text(o.numero_ordem_bancaria), text(o.descricao_situacao_op), date(o.data_emissao_op), date(o.data_emissao_ob), date(o.data_situacao_op), runId]));
  const reports = dedupe(t.relatorio_gestao_novo_especial, r => String(r.id_relatorio_gestao_novo));
  counts.special_management_reports = await bulkUpsert(client, T('special_management_reports'), ['report_id','plan_id','report_kind','report_status','executed_amount','pending_amount','reported_at','run_id'], ['report_id'],
    reports.rows.map(r => [int(r.id_relatorio_gestao_novo), int(r.id_plano_acao), text(r.tipo_relatorio_gestao_novo), text(r.situacao_relatorio_gestao_novo), num(r.valor_executado_relatorio_gestao_novo), num(r.valor_pendente_relatorio_gestao_novo), text(r.data_e_hora_relatorio_gestao_novo), runId]));

  const seq = new Map<string, number>();
  counts.portal_beneficiary_payments = await bulkUpsert(client, T('portal_beneficiary_payments'), ['amendment_code','payment_month','favored_code','row_seq','favored_name','legal_nature','favored_type','favored_uf','favored_municipality','amount','run_id'], ['amendment_code','payment_month','favored_code','row_seq'],
    input.portalPayments.map(p => { const k = `${p.amendmentCode}|${p.month}|${p.favoredCode}`; const n = (seq.get(k) ?? 0) + 1; seq.set(k, n); return [p.amendmentCode, p.month, p.favoredCode, n, p.favoredName, p.legalNature, p.favoredType, p.uf, p.municipality, p.amount, runId]; }));

  Object.assign(warnings, { duplicate_programa_especial: programs.duplicates, duplicate_plano_acao_especial: plans.duplicates, duplicate_executor_especial: executors.duplicates, duplicate_finalidade_especial: areas.duplicates,
    duplicate_empenho_especial: commitments.duplicates, duplicate_documento_habil_especial: documents.duplicates, duplicate_ordem_pagamento_ordem_bancaria_especial: orders.duplicates, duplicate_relatorio_gestao_novo_especial: reports.duplicates });

  // o que a fonte deixou de ter sai (mesma transação); filhos antes dos pais
  if (options.purgeStale ?? true) for (const table of ['portal_beneficiary_payments','special_management_reports','special_payment_orders','special_payment_documents','special_commitments','special_plan_areas','special_plan_executors','special_plan_functions','special_action_plans','budget_amendments','budget_programs'])
    await client.query(`DELETE FROM ${T(table)} WHERE run_id <> $1`, [runId]);
  return { runId, counts, warnings };
}

// ------------------------------------------------------------------------------------------------ reconciliação
export type GateStatus = 'PASS' | 'WARN' | 'FAIL';
export interface BudgetGate { status: GateStatus; detail: Record<string, unknown> }
export interface BudgetReconciliation {
  runId: string; gates: Record<string, BudgetGate>;
  totals: Record<string, number | null>; rowsPerTable: Record<string, number>;
  unmatchedPortal: string[]; unmatchedTransferegov: string[]; authorCodesWithoutReviewedCrosswalk: number;
}
const one = async (db: Queryable, sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows[0] ?? {};
const n = (v: unknown) => v === null || v === undefined ? 0 : Number(v);

/** Gates operacionais da carga. `official` = contagens oficiais (content-range) por tabela, `fetched` = linhas baixadas. */
export async function reconcileBudget(db: Queryable, runId: string, source: { official: Record<string, number>; fetched: Record<string, number>; duplicates?: Record<string, number> }): Promise<BudgetReconciliation> {
  const rowsPerTable: Record<string, number> = {};
  for (const table of ['budget_programs','budget_amendments','special_action_plans','special_plan_functions','special_plan_executors','special_plan_areas','special_commitments','special_payment_documents','special_payment_orders','special_management_reports','portal_beneficiary_payments'])
    rowsPerTable[table] = n((await one(db, `SELECT count(*)::int n FROM civica_budget.${table}`)).n);
  const loadedFor: Record<string, number> = { programa_especial: rowsPerTable.budget_programs!, plano_acao_especial: rowsPerTable.special_action_plans!, empenho_especial: rowsPerTable.special_commitments!, documento_habil_especial: rowsPerTable.special_payment_documents!, ordem_pagamento_ordem_bancaria_especial: rowsPerTable.special_payment_orders!, executor_especial: rowsPerTable.special_plan_executors!, finalidade_especial: rowsPerTable.special_plan_areas!, relatorio_gestao_novo_especial: rowsPerTable.special_management_reports! };
  const tableCoverage = Object.fromEntries(Object.keys(source.official).map(k => [k, { official: source.official[k], fetched: source.fetched[k] ?? 0, identicalDuplicateRows: source.duplicates?.[k] ?? 0, loaded: loadedFor[k] ?? null }]));
  const coverageOk = Object.values(tableCoverage).every(c => c.official === c.fetched && (c.loaded === null || c.loaded === c.fetched - c.identicalDuplicateRows));
  const unmatchedPortal = (await db.query(`SELECT amendment_code FROM civica_budget.budget_amendments WHERE in_portal AND NOT in_transferegov ORDER BY 1`)).rows.map(r => r.amendment_code as string);
  const unmatchedTge = (await db.query(`SELECT amendment_code FROM civica_budget.budget_amendments WHERE in_transferegov AND NOT in_portal ORDER BY 1`)).rows.map(r => r.amendment_code as string);
  const portalCount = n((await one(db, `SELECT count(*)::int n FROM civica_budget.budget_amendments WHERE in_portal`)).n);
  const orphans = await one(db, `SELECT
    (SELECT count(*)::int FROM civica_budget.special_action_plans p WHERE p.amendment_code IS NULL OR NOT EXISTS (SELECT 1 FROM civica_budget.budget_amendments a WHERE a.amendment_code=p.amendment_code)) plans_without_amendment,
    (SELECT count(*)::int FROM civica_budget.special_commitments c WHERE NOT EXISTS (SELECT 1 FROM civica_budget.special_action_plans p WHERE p.plan_id=c.plan_id)) commitments_without_plan,
    (SELECT count(*)::int FROM civica_budget.special_payment_documents d WHERE NOT EXISTS (SELECT 1 FROM civica_budget.special_commitments c WHERE c.commitment_id=d.commitment_id)) documents_without_commitment,
    (SELECT count(*)::int FROM civica_budget.special_payment_orders o WHERE NOT EXISTS (SELECT 1 FROM civica_budget.special_payment_documents d WHERE d.dh_id=o.dh_id)) orders_without_document,
    (SELECT count(*)::int FROM civica_budget.special_plan_executors e WHERE NOT EXISTS (SELECT 1 FROM civica_budget.special_action_plans p WHERE p.plan_id=e.plan_id)) executors_without_plan`);
  const orphanTotal = Object.values(orphans).reduce<number>((a, v) => a + n(v), 0);
  const money = await one(db, `SELECT
    (SELECT coalesce(sum(custeio_amount+investimento_amount),0) FROM civica_budget.special_action_plans) destined,
    (SELECT coalesce(sum(amount),0) FROM civica_budget.special_commitments) plans_committed,
    (SELECT coalesce(sum(portal_committed),0) FROM civica_budget.budget_amendments) portal_committed,
    (SELECT coalesce(sum(portal_liquidated),0) FROM civica_budget.budget_amendments) portal_liquidated,
    (SELECT coalesce(sum(portal_paid),0) FROM civica_budget.budget_amendments) portal_paid,
    (SELECT coalesce(sum(portal_outstanding_payables),0) FROM civica_budget.budget_amendments) portal_outstanding,
    (SELECT coalesce(sum(d.apportioned_amount),0) FROM civica_budget.special_payment_documents d WHERE EXISTS (SELECT 1 FROM civica_budget.special_payment_orders o WHERE o.dh_id=d.dh_id)) paid_by_documents,
    (SELECT count(DISTINCT beneficiary_cnpj)::int FROM civica_budget.special_action_plans) beneficiaries,
    (SELECT count(DISTINCT author_code)::int FROM civica_budget.special_action_plans) author_codes,
    (SELECT min(amendment_year) FROM civica_budget.budget_amendments) first_year, (SELECT max(amendment_year) FROM civica_budget.budget_amendments) last_year`);
  const portalVsPlans = await one(db, `WITH c AS (SELECT p.amendment_code, sum(c.amount) tge FROM civica_budget.special_action_plans p JOIN civica_budget.special_commitments c ON c.plan_id=p.plan_id GROUP BY 1)
    SELECT count(*) FILTER (WHERE abs(a.portal_committed-coalesce(c.tge,0))<1)::int equal, count(*) FILTER (WHERE a.portal_committed-coalesce(c.tge,0)<-1)::int portal_lower, count(*) FILTER (WHERE a.portal_committed-coalesce(c.tge,0)>1)::int portal_higher
    FROM civica_budget.budget_amendments a LEFT JOIN c ON c.amendment_code=a.amendment_code WHERE a.in_portal`);
  const crosswalk = await crosswalkCoverage(db);
  const destined = n(money.destined), planCommitted = n(money.plans_committed);
  const gates: Record<string, BudgetGate> = {
    TRANSFEREGOV_PLAN_COVERAGE: { status: coverageOk ? 'PASS' : 'FAIL', detail: { tables: tableCoverage } },
    PORTAL_AMENDMENT_MATCH: { status: unmatchedPortal.length === 0 && portalCount > 0 ? 'PASS' : 'FAIL', detail: { portalAmendments: portalCount, unmatchedPortal: unmatchedPortal.length, transferegovOnly: unmatchedTge.length } },
    REFERENTIAL_INTEGRITY: { status: orphanTotal === 0 ? 'PASS' : 'WARN', detail: orphans },
    FINANCIAL_RECONCILIATION: { status: destined > 0 && Math.abs(destined - planCommitted) / destined < 0.005 ? 'PASS' : 'WARN', detail: { destined, plansCommitted: planCommitted, portalCommitted: n(money.portal_committed), portalVsPlansPerAmendment: portalVsPlans } },
    CROSSWALK_COVERAGE: { status: crosswalk.reviewedValueShare >= 0.95 ? 'PASS' : crosswalk.codes === 0 ? 'WARN' : 'WARN', detail: crosswalk },
  };
  return { runId, gates, rowsPerTable, unmatchedPortal, unmatchedTransferegov: unmatchedTge, authorCodesWithoutReviewedCrosswalk: crosswalk.codesWithoutReviewed,
    totals: { destined, plansCommitted: planCommitted, portalCommitted: n(money.portal_committed), portalLiquidated: n(money.portal_liquidated), portalPaid: n(money.portal_paid), portalOutstandingPayables: n(money.portal_outstanding), paidByPlanDocuments: n(money.paid_by_documents), amendments: rowsPerTable.budget_amendments!, plans: rowsPerTable.special_action_plans!, authorCodes: n(money.author_codes), beneficiaries: n(money.beneficiaries), firstYear: n(money.first_year), lastYear: n(money.last_year) } };
}

/** Cobertura do crosswalk sobre o valor destinado: o que PODE ser atribuído a perfis (reviewed=true, EXACT|HIGH, com pessoa). */
export async function crosswalkCoverage(db: Queryable) {
  const r = await one(db, `WITH plan AS (SELECT p.author_code, p.amendment_year yr, p.custeio_amount+p.investimento_amount v FROM civica_budget.special_action_plans p),
    tagged AS (SELECT plan.*, EXISTS (SELECT 1 FROM civica_budget.author_code_crosswalk c WHERE c.author_code=plan.author_code AND c.reviewed AND c.person_id IS NOT NULL AND c.confidence IN ('EXACT','HIGH')
        AND plan.yr BETWEEN extract(year FROM c.valid_from) AND coalesce(extract(year FROM c.valid_to),9999)) reviewed_ok FROM plan)
    SELECT count(DISTINCT author_code)::int codes, count(DISTINCT author_code) FILTER (WHERE reviewed_ok)::int reviewed_codes,
      coalesce(sum(v),0) total_value, coalesce(sum(v) FILTER (WHERE reviewed_ok),0) reviewed_value FROM tagged`);
  const unresolved = (await db.query(`SELECT confidence, count(*)::int n FROM civica_budget.author_code_crosswalk GROUP BY 1 ORDER BY 1`)).rows;
  const codes = n(r.codes), reviewedCodes = n(r.reviewed_codes), total = n(r.total_value), reviewed = n(r.reviewed_value);
  const withoutReviewed = (await db.query(`SELECT DISTINCT p.author_code FROM civica_budget.special_action_plans p WHERE NOT EXISTS (SELECT 1 FROM civica_budget.author_code_crosswalk c WHERE c.author_code=p.author_code AND c.reviewed AND c.person_id IS NOT NULL AND c.confidence IN ('EXACT','HIGH') AND p.amendment_year BETWEEN extract(year FROM c.valid_from) AND coalesce(extract(year FROM c.valid_to),9999)) ORDER BY 1`)).rows.map(x => x.author_code as string);
  return { codes, reviewedCodes, codesWithoutReviewed: codes - reviewedCodes, totalValue: total, reviewedValue: reviewed, unattributedValue: total - reviewed, reviewedValueShare: total ? reviewed / total : 0, byConfidence: unresolved, codesWithoutReviewedList: withoutReviewed };
}

export async function startBudgetRun(db: Queryable, runId: string, sourceCutoff: unknown) {
  await db.query(`INSERT INTO civica_budget.budget_ingestion_runs(run_id, source_cutoff) VALUES ($1,$2) ON CONFLICT (run_id) DO UPDATE SET status='running', started_at=now(), finished_at=NULL, error=NULL, source_cutoff=EXCLUDED.source_cutoff`, [runId, JSON.stringify(sourceCutoff ?? {})]);
}
export async function finishBudgetRun(db: Queryable, runId: string, status: 'published' | 'failed', counts: unknown, reconciliation: unknown, error?: string) {
  await db.query(`UPDATE civica_budget.budget_ingestion_runs SET status=$2, finished_at=now(), counts=$3, reconciliation=$4, error=$5 WHERE run_id=$1`, [runId, status, JSON.stringify(counts ?? {}), JSON.stringify(reconciliation ?? {}), error ?? null]);
}
export async function activeBudgetRun(db: Queryable) {
  return (await db.query(`SELECT run_id, finished_at, source_cutoff, counts, reconciliation FROM civica_budget.budget_ingestion_runs WHERE status='published' ORDER BY finished_at DESC NULLS LAST LIMIT 1`)).rows[0] ?? null;
}
