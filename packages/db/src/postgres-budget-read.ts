import type { Pool, PoolClient } from 'pg';
import { PIX_FINANCIAL_NOTES, type PixFinancials } from '@senadotracker/domain';
import { crosswalkCoverage } from './postgres-budget.ts';

/**
 * Read models das Emendas Pix. Sem UI: contratos para revisão de números.
 * REGRA: valor só é atribuído a uma pessoa pela view `reviewed_amendment_authors` (crosswalk revisado EXACT|HIGH).
 * Autor não revisado/não resolvido aparece como "autoria não vinculada" e nunca é somado ao perfil de ninguém.
 */
type Queryable = Pick<Pool | PoolClient, 'query'>;
const nn = (v: unknown) => v === null || v === undefined ? 0 : Number(v);
const nz = (v: unknown) => v === null || v === undefined ? null : Number(v);

/** A pessoa + pessoas ligadas por `identity_links` CONFIRMADO (mesma pessoa em Câmara e Senado). `candidate` nunca une. */
export async function linkedPersonIds(db: Queryable, personId: string): Promise<string[]> {
  const rows = (await db.query(`SELECT person_a, person_b FROM civica.identity_links WHERE status='confirmed' AND (person_a=$1 OR person_b=$1)`, [personId])).rows;
  return [...new Set([personId, ...rows.flatMap(r => [r.person_a as string, r.person_b as string])])];
}

export interface PixAuthorCodeUse { authorCode: string; house: string | null; confidence: string; years: number[] }
export interface ParliamentarianPixSummary {
  personId: string; personIds: string[]; authorCodes: PixAuthorCodeUse[];
  financials: PixFinancials & { amendmentsWithoutPortal: number }; counts: { amendments: number; plans: number; beneficiaries: number; ufs: number };
  ufs: string[]; byYear: Array<{ year: number; amendments: number; plans: number; destinedAmount: number; committedAmount: number | null; liquidatedAmount: number | null; paidAmount: number | null }>;
  byExpenseKind: { custeio: number; investimento: number };
  /** `plans` conta planos que tocam a função; `exclusiveDestinedAmount` soma só os planos com UMA função (valor não é repartido por heurística). */
  byFunction: Array<{ functionCode: number; functionName: string; plans: number; exclusivePlans: number; exclusiveDestinedAmount: number }>;
  functionCoverage: { plansWithFunction: number; singleFunctionPlans: number; singleFunctionAmount: number; multiFunctionPlans: number; multiFunctionAmount: number; plansWithoutFunction: number; plansWithoutFunctionAmount: number };
  byUf: Array<{ uf: string; plans: number; beneficiaries: number; destinedAmount: number }>;
  topBeneficiaries: Array<{ cnpj: string | null; name: string | null; uf: string | null; enteType: string | null; /** nome do município com acentos, quando o Portal o informa para o CNPJ do beneficiário (não é código IBGE) */ municipalityName: string | null; plans: number; destinedAmount: number }>;
  amendments: Array<{ amendmentCode: string; year: number; authorCode: string; plans: number; beneficiaries: number; impededPlans: number; destinedAmount: number; committedAmount: number | null; paidAmount: number | null; topBeneficiary: { cnpj: string | null; name: string | null; uf: string | null; enteType: string | null; municipalityName: string | null; destinedAmount: number } | null }>;
  /** Corte da coleta que alimenta o resumo (null se não houver execução publicada). */
  run: { runId: string; finishedAt: string | null } | null;
  notes: typeof PIX_FINANCIAL_NOTES; attribution: 'reviewed_crosswalk_only';
}

/** Resumo por parlamentar: SOMENTE emendas cujo `author_code` está revisado no crosswalk para esta pessoa (ou pessoa confirmada igual). */
export async function parliamentarianPixSummary(db: Queryable, personId: string, options: { year?: number; topBeneficiaries?: number; amendmentsLimit?: number } = {}): Promise<ParliamentarianPixSummary> {
  const personIds = await linkedPersonIds(db, personId);
  const year = options.year ?? null;
  const base = `FROM civica_budget.reviewed_amendment_authors ra JOIN civica_budget.budget_amendments a ON a.amendment_code=ra.amendment_code WHERE ra.person_id = ANY($1::text[]) AND ($2::int IS NULL OR a.amendment_year=$2)`;
  const args = [personIds, year];
  const codes = (await db.query(`SELECT ra.author_code, ra.house, ra.confidence, array_agg(DISTINCT a.amendment_year ORDER BY a.amendment_year) years ${base} GROUP BY 1,2,3 ORDER BY 1`, args)).rows
    .map(r => ({ authorCode: r.author_code as string, house: r.house as string | null, confidence: r.confidence as string, years: (r.years as number[]).map(Number) }));
  const plans = (await db.query(`SELECT a.amendment_code, a.amendment_year, p.plan_id, p.situation, p.ente_type, p.beneficiary_cnpj, p.beneficiary_name, p.beneficiary_uf, p.custeio_amount, p.investimento_amount
    ${base.replace('WHERE', 'JOIN civica_budget.special_action_plans p ON p.amendment_code=a.amendment_code WHERE')}`, args)).rows;
  const amends = (await db.query(`SELECT a.amendment_code, a.amendment_year, a.author_code, a.portal_committed, a.portal_liquidated, a.portal_paid, a.portal_outstanding_payables, a.in_portal ${base} ORDER BY a.amendment_year DESC, a.amendment_code`, args)).rows;
  const commitments = (await db.query(`SELECT coalesce(sum(c.amount),0) committed ${base.replace('WHERE', 'JOIN civica_budget.special_action_plans p ON p.amendment_code=a.amendment_code JOIN civica_budget.special_commitments c ON c.plan_id=p.plan_id WHERE')}`, args)).rows[0];
  const paidDocs = (await db.query(`SELECT coalesce(sum(d.apportioned_amount),0) paid ${base.replace('WHERE', 'JOIN civica_budget.special_action_plans p ON p.amendment_code=a.amendment_code JOIN civica_budget.special_commitments c ON c.plan_id=p.plan_id JOIN civica_budget.special_payment_documents d ON d.commitment_id=c.commitment_id WHERE EXISTS (SELECT 1 FROM civica_budget.special_payment_orders o WHERE o.dh_id=d.dh_id) AND')}`, args)).rows[0];
  const executed = (await db.query(`SELECT coalesce(sum(r.executed_amount),0) executed, count(*)::int n ${base.replace('WHERE', "JOIN civica_budget.special_action_plans p ON p.amendment_code=a.amendment_code JOIN LATERAL (SELECT executed_amount FROM civica_budget.special_management_reports r WHERE r.plan_id=p.plan_id ORDER BY reported_at DESC NULLS LAST LIMIT 1) r ON true WHERE")}`, args)).rows[0];
  const planScope = base.replace('WHERE', 'JOIN civica_budget.special_action_plans p ON p.amendment_code=a.amendment_code WHERE');
  const functionRows = (await db.query(`WITH sp AS (SELECT p.plan_id, p.custeio_amount+p.investimento_amount v ${planScope}),
      pf AS (SELECT DISTINCT f.plan_id, f.function_code, f.function_name FROM civica_budget.special_plan_functions f JOIN sp ON sp.plan_id=f.plan_id),
      nf AS (SELECT plan_id, count(*) n FROM pf GROUP BY 1)
    SELECT pf.function_code, pf.function_name, count(*)::int plans, (count(*) FILTER (WHERE nf.n=1))::int exclusive_plans, coalesce(sum(sp.v) FILTER (WHERE nf.n=1),0) exclusive_amount
      FROM pf JOIN nf ON nf.plan_id=pf.plan_id JOIN sp ON sp.plan_id=pf.plan_id GROUP BY 1,2 ORDER BY 5 DESC, 3 DESC, 1`, args)).rows;
  const coverageRow = (await db.query(`WITH sp AS (SELECT p.plan_id, p.custeio_amount+p.investimento_amount v ${planScope}),
      nf AS (SELECT plan_id, count(DISTINCT function_code) n FROM civica_budget.special_plan_functions WHERE plan_id IN (SELECT plan_id FROM sp) GROUP BY 1)
    SELECT (count(*) FILTER (WHERE nf.n IS NOT NULL))::int with_function, (count(*) FILTER (WHERE nf.n=1))::int single_plans, coalesce(sum(sp.v) FILTER (WHERE nf.n=1),0) single_amount,
      (count(*) FILTER (WHERE nf.n>1))::int multi_plans, coalesce(sum(sp.v) FILTER (WHERE nf.n>1),0) multi_amount, (count(*) FILTER (WHERE nf.n IS NULL))::int none_plans, coalesce(sum(sp.v) FILTER (WHERE nf.n IS NULL),0) none_amount
    FROM sp LEFT JOIN nf ON nf.plan_id=sp.plan_id`, args)).rows[0];
  const runRow = (await db.query(`SELECT run_id, finished_at FROM civica_budget.budget_ingestion_runs WHERE status='published' ORDER BY finished_at DESC NULLS LAST LIMIT 1`)).rows[0];

  const destinedOf = (r: any) => nn(r.custeio_amount) + nn(r.investimento_amount);
  const byBeneficiary = new Map<string, { cnpj: string | null; name: string | null; uf: string | null; enteType: string | null; plans: number; destinedAmount: number }>();
  for (const p of plans) { const k = p.beneficiary_cnpj ?? `name:${p.beneficiary_name}`; const cur = byBeneficiary.get(k) ?? { cnpj: p.beneficiary_cnpj ?? null, name: p.beneficiary_name ?? null, uf: p.beneficiary_uf ?? null, enteType: p.ente_type ?? null, plans: 0, destinedAmount: 0 }; cur.plans++; cur.destinedAmount += destinedOf(p); byBeneficiary.set(k, cur); }
  const planCountByAmendment = new Map<string, { plans: number; destined: number; impeded: number; beneficiaries: Map<string, { cnpj: string | null; name: string | null; uf: string | null; enteType: string | null; destined: number }> }>();
  for (const p of plans) {
    const c = planCountByAmendment.get(p.amendment_code) ?? { plans: 0, destined: 0, impeded: 0, beneficiaries: new Map() };
    c.plans++; c.destined += destinedOf(p); if (String(p.situation ?? '').startsWith('IMPEDIDO')) c.impeded++;
    const k = p.beneficiary_cnpj ?? `name:${p.beneficiary_name}`; const b = c.beneficiaries.get(k) ?? { cnpj: p.beneficiary_cnpj ?? null, name: p.beneficiary_name ?? null, uf: p.beneficiary_uf ?? null, enteType: p.ente_type ?? null, destined: 0 }; b.destined += destinedOf(p); c.beneficiaries.set(k, b);
    planCountByAmendment.set(p.amendment_code, c);
  }
  const byUfMap = new Map<string, { uf: string; plans: number; beneficiaries: Set<string>; destinedAmount: number }>();
  for (const p of plans) { const uf = p.beneficiary_uf ?? '—'; const c = byUfMap.get(uf) ?? { uf, plans: 0, beneficiaries: new Set<string>(), destinedAmount: 0 }; c.plans++; c.destinedAmount += destinedOf(p); c.beneficiaries.add(p.beneficiary_cnpj ?? `name:${p.beneficiary_name}`); byUfMap.set(uf, c); }
  const years = [...new Set(amends.map(a => Number(a.amendment_year)))].sort((x, y) => x - y);
  const sumPortal = (rows: any[], field: string) => rows.every(r => r[field] === null) ? null : rows.reduce((s, r) => s + nn(r[field]), 0);
  const destined = plans.reduce((s, p) => s + destinedOf(p), 0);
  const ufs = [...new Set(plans.map(p => p.beneficiary_uf).filter(Boolean))].sort() as string[];
  const topList = [...byBeneficiary.values()].sort((a, b) => b.destinedAmount - a.destinedAmount).slice(0, options.topBeneficiaries ?? 10);
  const pageAmendments = amends.slice(0, options.amendmentsLimit ?? 200);
  const wantedCnpjs = new Set<string>(topList.map(b => b.cnpj).filter(Boolean) as string[]);
  for (const a of pageAmendments) { const c = planCountByAmendment.get(a.amendment_code); const top = c ? [...c.beneficiaries.values()].sort((x, y) => y.destined - x.destined)[0] : undefined; if (top?.cnpj) wantedCnpjs.add(top.cnpj); }
  const municipalityByCnpj = new Map<string, string>();
  if (wantedCnpjs.size) for (const r of (await db.query(`SELECT favored_code, mode() WITHIN GROUP (ORDER BY favored_municipality) municipality FROM civica_budget.portal_beneficiary_payments WHERE favored_code = ANY($1::text[]) AND favored_municipality IS NOT NULL GROUP BY 1`, [[...wantedCnpjs]])).rows) municipalityByCnpj.set(r.favored_code as string, r.municipality as string);
  return {
    personId, personIds, authorCodes: codes,
    financials: { destinedAmount: destined, committedAmount: sumPortal(amends, 'portal_committed'), liquidatedAmount: sumPortal(amends, 'portal_liquidated'), paidAmount: sumPortal(amends, 'portal_paid'), outstandingPayables: sumPortal(amends, 'portal_outstanding_payables'),
      plansCommittedAmount: nn(commitments.committed), paidByPlanDocumentsAmount: nn(paidDocs.paid), executedByEnteAmount: executed.n ? nn(executed.executed) : null, amendmentsWithoutPortal: amends.filter(a => !a.in_portal).length },
    counts: { amendments: amends.length, plans: plans.length, beneficiaries: byBeneficiary.size, ufs: ufs.length }, ufs,
    byYear: years.map(y => { const rows = amends.filter(a => Number(a.amendment_year) === y); const pl = plans.filter(p => Number(p.amendment_year) === y); return { year: y, amendments: rows.length, plans: pl.length, destinedAmount: pl.reduce((s, p) => s + destinedOf(p), 0), committedAmount: sumPortal(rows, 'portal_committed'), liquidatedAmount: sumPortal(rows, 'portal_liquidated'), paidAmount: sumPortal(rows, 'portal_paid') }; }),
    byExpenseKind: { custeio: plans.reduce((s, p) => s + nn(p.custeio_amount), 0), investimento: plans.reduce((s, p) => s + nn(p.investimento_amount), 0) },
    byFunction: functionRows.map(f => ({ functionCode: Number(f.function_code), functionName: f.function_name as string, plans: Number(f.plans), exclusivePlans: Number(f.exclusive_plans), exclusiveDestinedAmount: nn(f.exclusive_amount) })),
    functionCoverage: { plansWithFunction: Number(coverageRow.with_function), singleFunctionPlans: Number(coverageRow.single_plans), singleFunctionAmount: nn(coverageRow.single_amount), multiFunctionPlans: Number(coverageRow.multi_plans), multiFunctionAmount: nn(coverageRow.multi_amount), plansWithoutFunction: Number(coverageRow.none_plans), plansWithoutFunctionAmount: nn(coverageRow.none_amount) },
    byUf: [...byUfMap.values()].map(c => ({ uf: c.uf, plans: c.plans, beneficiaries: c.beneficiaries.size, destinedAmount: c.destinedAmount })).sort((a, b) => b.destinedAmount - a.destinedAmount),
    run: runRow ? { runId: runRow.run_id as string, finishedAt: runRow.finished_at ? new Date(runRow.finished_at).toISOString() : null } : null,
    topBeneficiaries: topList.map(b => ({ ...b, municipalityName: b.enteType === 'municipio' && b.cnpj ? municipalityByCnpj.get(b.cnpj) ?? null : null })),
    amendments: pageAmendments.map(a => { const c = planCountByAmendment.get(a.amendment_code); const top = c ? [...c.beneficiaries.values()].sort((x, y) => y.destined - x.destined)[0] : undefined;
      return { amendmentCode: a.amendment_code as string, year: Number(a.amendment_year), authorCode: a.author_code as string, plans: c?.plans ?? 0, beneficiaries: c?.beneficiaries.size ?? 0, impededPlans: c?.impeded ?? 0, destinedAmount: c?.destined ?? 0, committedAmount: nz(a.portal_committed), paidAmount: nz(a.portal_paid), topBeneficiary: top ? { cnpj: top.cnpj, name: top.name, uf: top.uf, enteType: top.enteType, municipalityName: top.enteType === 'municipio' && top.cnpj ? municipalityByCnpj.get(top.cnpj) ?? null : null, destinedAmount: top.destined } : null }; }),
    notes: PIX_FINANCIAL_NOTES, attribution: 'reviewed_crosswalk_only',
  };
}

export interface PixPlanView {
  planId: number; planCode: string; situation: string | null; workPlanSituation: string | null; beneficiary: { cnpj: string | null; name: string | null; uf: string | null; enteType: string; ibgeCode: string | null };
  custeioAmount: number; investimentoAmount: number; destinedAmount: number; impedimentReason: string | null;
  objects: string[]; functions: Array<{ functionCode: number; functionName: string; subfunctionCode: number; subfunctionName: string }>; areas: Array<{ code: number; name: string | null; type: string | null }>;
  commitments: Array<{ commitmentId: number; number: string | null; status: string | null; category: string | null; amount: number; documents: Array<{ dhId: number; number: string | null; status: string | null; amount: number | null; apportionedAmount: number | null; orders: Array<{ opObId: number; obNumber: string | null; obIssuedOn: string | null; status: string | null }> }> }>;
  committedAmount: number; paidByDocumentsAmount: number; executedByEnteAmount: number | null;
}
export interface PixAmendmentDetail {
  amendmentCode: string; year: number; authorCode: string; authorName: string | null; kind: string;
  author: { attributed: boolean; personId: string | null; house: string | null; confidence: string | null; reason: string };
  portal: { present: boolean; committed: number | null; liquidated: number | null; paid: number | null; outstandingPayables: number | null; uf: string | null; location: string | null };
  destinedAmount: number; plans: PixPlanView[]; notes: typeof PIX_FINANCIAL_NOTES;
}

export async function pixAmendmentDetail(db: Queryable, amendmentCode: string): Promise<PixAmendmentDetail | null> {
  const a = (await db.query(`SELECT * FROM civica_budget.budget_amendments WHERE amendment_code=$1`, [amendmentCode])).rows[0]; if (!a) return null;
  const attr = (await db.query(`SELECT person_id, house, confidence FROM civica_budget.reviewed_amendment_authors WHERE amendment_code=$1`, [amendmentCode])).rows[0];
  const cw = attr ? null : (await db.query(`SELECT confidence, reviewed, person_id FROM civica_budget.author_code_crosswalk WHERE author_code=$1 ORDER BY valid_from DESC LIMIT 1`, [a.author_code])).rows[0];
  const reason = attr ? 'reviewed_crosswalk' : !cw ? 'no_crosswalk_entry' : !cw.person_id ? `unresolved:${cw.confidence}` : !cw.reviewed ? `pending_review:${cw.confidence}` : 'outside_validity_period';
  const plans = (await db.query(`SELECT * FROM civica_budget.special_action_plans WHERE amendment_code=$1 ORDER BY plan_id`, [amendmentCode])).rows;
  const ids = plans.map(p => p.plan_id);
  const q = async (sql: string) => ids.length ? (await db.query(sql, [ids])).rows : [];
  const [executors, functions, areas, commitments, documents, orders, reports] = await Promise.all([
    q(`SELECT * FROM civica_budget.special_plan_executors WHERE plan_id = ANY($1::bigint[])`),
    q(`SELECT * FROM civica_budget.special_plan_functions WHERE plan_id = ANY($1::bigint[]) ORDER BY function_code, subfunction_code`),
    q(`SELECT e.plan_id, a.* FROM civica_budget.special_plan_areas a JOIN civica_budget.special_plan_executors e ON e.executor_id=a.executor_id WHERE e.plan_id = ANY($1::bigint[]) ORDER BY a.area_code`),
    q(`SELECT * FROM civica_budget.special_commitments WHERE plan_id = ANY($1::bigint[]) ORDER BY commitment_id`),
    q(`SELECT d.* FROM civica_budget.special_payment_documents d JOIN civica_budget.special_commitments c ON c.commitment_id=d.commitment_id WHERE c.plan_id = ANY($1::bigint[]) ORDER BY d.dh_id`),
    q(`SELECT o.* FROM civica_budget.special_payment_orders o JOIN civica_budget.special_payment_documents d ON d.dh_id=o.dh_id JOIN civica_budget.special_commitments c ON c.commitment_id=d.commitment_id WHERE c.plan_id = ANY($1::bigint[]) ORDER BY o.op_ob_id`),
    q(`SELECT DISTINCT ON (plan_id) plan_id, executed_amount FROM civica_budget.special_management_reports WHERE plan_id = ANY($1::bigint[]) ORDER BY plan_id, reported_at DESC NULLS LAST`),
  ]);
  const planViews: PixPlanView[] = plans.map(p => {
    const pc = commitments.filter(c => c.plan_id === p.plan_id);
    const commitViews = pc.map(c => ({ commitmentId: Number(c.commitment_id), number: c.commitment_number, status: c.status, category: c.expense_category, amount: nn(c.amount),
      documents: documents.filter(d => d.commitment_id === c.commitment_id).map(d => ({ dhId: Number(d.dh_id), number: d.document_number, status: d.status, amount: nz(d.amount), apportionedAmount: nz(d.apportioned_amount),
        orders: orders.filter(o => o.dh_id === d.dh_id).map(o => ({ opObId: Number(o.op_ob_id), obNumber: o.ob_number, obIssuedOn: o.ob_issued_on ? String(o.ob_issued_on).slice(0, 10) : null, status: o.status })) })) }));
    const report = reports.find(r => r.plan_id === p.plan_id);
    return {
      planId: Number(p.plan_id), planCode: p.plan_code, situation: p.situation, workPlanSituation: p.work_plan_situation, beneficiary: { cnpj: p.beneficiary_cnpj, name: p.beneficiary_name, uf: p.beneficiary_uf, enteType: p.ente_type, ibgeCode: p.ibge_code },
      custeioAmount: nn(p.custeio_amount), investimentoAmount: nn(p.investimento_amount), destinedAmount: nn(p.custeio_amount) + nn(p.investimento_amount), impedimentReason: p.impediment_reason,
      objects: executors.filter(e => e.plan_id === p.plan_id).map(e => e.object_text).filter(Boolean),
      functions: functions.filter(f => f.plan_id === p.plan_id).map(f => ({ functionCode: f.function_code, functionName: f.function_name, subfunctionCode: f.subfunction_code, subfunctionName: f.subfunction_name })),
      areas: areas.filter(x => x.plan_id === p.plan_id).map(x => ({ code: x.area_code, name: x.area_name, type: x.area_type })),
      commitments: commitViews, committedAmount: commitViews.reduce((s, c) => s + c.amount, 0),
      paidByDocumentsAmount: commitViews.flatMap(c => c.documents).filter(d => d.orders.length).reduce((s, d) => s + nn(d.apportionedAmount), 0),
      executedByEnteAmount: report ? nn(report.executed_amount) : null,
    };
  });
  return {
    amendmentCode, year: Number(a.amendment_year), authorCode: a.author_code, authorName: a.author_name, kind: a.kind,
    author: { attributed: !!attr, personId: attr?.person_id ?? null, house: attr?.house ?? null, confidence: attr?.confidence ?? null, reason },
    portal: { present: !!a.in_portal, committed: nz(a.portal_committed), liquidated: nz(a.portal_liquidated), paid: nz(a.portal_paid), outstandingPayables: nz(a.portal_outstanding_payables), uf: a.portal_uf, location: a.portal_location },
    destinedAmount: planViews.reduce((s, p) => s + p.destinedAmount, 0), plans: planViews, notes: PIX_FINANCIAL_NOTES,
  };
}

export interface PixBeneficiaryDetail {
  cnpj: string; names: string[]; ufs: string[]; enteTypes: string[]; plans: number; amendments: number; destinedAmount: number; years: number[];
  authors: Array<{ authorCode: string; authorNames: string[]; personId: string | null; attributed: boolean; amendments: number; destinedAmount: number }>;
  objects: string[]; functions: Array<{ functionCode: number; functionName: string; plans: number }>; portalReceivedAmount: number;
}
export async function pixBeneficiaryDetail(db: Queryable, cnpj: string, options: { objectsLimit?: number } = {}): Promise<PixBeneficiaryDetail | null> {
  const plans = (await db.query(`SELECT p.*, ra.person_id FROM civica_budget.special_action_plans p LEFT JOIN civica_budget.reviewed_amendment_authors ra ON ra.amendment_code=p.amendment_code WHERE p.beneficiary_cnpj=$1`, [cnpj])).rows;
  if (!plans.length) return null;
  const byAuthor = new Map<string, { authorCode: string; names: Set<string>; personId: string | null; amendments: Set<string>; destined: number }>();
  for (const p of plans) { const k = `${p.author_code}|${p.person_id ?? ''}`; const c = byAuthor.get(k) ?? { authorCode: p.author_code, names: new Set(), personId: p.person_id ?? null, amendments: new Set(), destined: 0 }; if (p.author_name_in_plan) c.names.add(p.author_name_in_plan); c.amendments.add(p.amendment_code); c.destined += nn(p.custeio_amount) + nn(p.investimento_amount); byAuthor.set(k, c); }
  const ids = plans.map(p => p.plan_id);
  const objects = (await db.query(`SELECT DISTINCT object_text FROM civica_budget.special_plan_executors WHERE plan_id = ANY($1::bigint[]) AND object_text IS NOT NULL LIMIT $2`, [ids, options.objectsLimit ?? 20])).rows.map(r => r.object_text as string);
  const functions = (await db.query(`SELECT function_code, function_name, count(DISTINCT plan_id)::int plans FROM civica_budget.special_plan_functions WHERE plan_id = ANY($1::bigint[]) GROUP BY 1,2 ORDER BY 3 DESC, 1`, [ids])).rows;
  const received = (await db.query(`SELECT coalesce(sum(amount),0) total FROM civica_budget.portal_beneficiary_payments WHERE favored_code=$1`, [cnpj])).rows[0];
  const uniq = <T>(xs: T[]) => [...new Set(xs.filter(x => x !== null && x !== undefined))] as T[];
  return {
    cnpj, names: uniq<string>(plans.map(p => p.beneficiary_name)), ufs: uniq<string>(plans.map(p => p.beneficiary_uf)), enteTypes: uniq<string>(plans.map(p => p.ente_type)), plans: plans.length, amendments: new Set(plans.map(p => p.amendment_code)).size,
    destinedAmount: plans.reduce((s, p) => s + nn(p.custeio_amount) + nn(p.investimento_amount), 0), years: uniq<number>(plans.map(p => Number(p.amendment_year))).sort((a, b) => a - b),
    authors: [...byAuthor.values()].map(c => ({ authorCode: c.authorCode, authorNames: [...c.names], personId: c.personId, attributed: !!c.personId, amendments: c.amendments.size, destinedAmount: c.destined })).sort((a, b) => b.destinedAmount - a.destinedAmount),
    objects, functions: functions.map(f => ({ functionCode: Number(f.function_code), functionName: f.function_name, plans: Number(f.plans) })), portalReceivedAmount: nn(received.total),
  };
}

/** PROFILE_PIX_VALUE_COVERAGE: % do valor destinado que pode ser atribuído a perfis (reviewed=true, EXACT|HIGH, com pessoa). */
export async function pixProfileCoverage(db: Queryable) {
  const c = await crosswalkCoverage(db);
  return { codes: c.codes, reviewedCodes: c.reviewedCodes, totalValue: c.totalValue, attributableValue: c.reviewedValue, unattributedValue: c.unattributedValue, profileValueCoverage: c.reviewedValueShare, unresolvedOrPending: c.codesWithoutReviewedList, byConfidence: c.byConfidence };
}
