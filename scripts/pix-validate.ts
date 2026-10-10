import pg from 'pg';
import { activeBudgetRun, crosswalkCoverage, parliamentarianPixSummary, pixAmendmentDetail, pixBeneficiaryDetail, pixProfileCoverage } from '../packages/db/src/index.ts';

/** Validação final (somente leitura): números reais da carga, cobertura de atribuição a perfis e tempos dos read models. */
const pool = new pg.Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, max: 2 });
const one = async (sql: string, v: unknown[] = []) => (await pool.query(sql, v)).rows[0];
const all = async (sql: string, v: unknown[] = []) => (await pool.query(sql, v)).rows;
const timed = async <T>(label: string, fn: () => Promise<T>) => { const t = performance.now(); const value = await fn(); return { label, ms: Math.round(performance.now() - t), value }; };
try {
  const run = await activeBudgetRun(pool);
  const totals = await one(`SELECT (SELECT count(*)::int FROM civica_budget.budget_amendments) amendments, (SELECT count(*)::int FROM civica_budget.special_action_plans) plans,
    (SELECT count(DISTINCT author_code)::int FROM civica_budget.budget_amendments) author_codes, (SELECT count(DISTINCT beneficiary_cnpj)::int FROM civica_budget.special_action_plans) beneficiaries,
    (SELECT sum(custeio_amount+investimento_amount) FROM civica_budget.special_action_plans) destined, (SELECT sum(amount) FROM civica_budget.special_commitments) plans_committed,
    (SELECT sum(portal_committed) FROM civica_budget.budget_amendments) portal_committed, (SELECT sum(portal_liquidated) FROM civica_budget.budget_amendments) portal_liquidated,
    (SELECT sum(portal_paid) FROM civica_budget.budget_amendments) portal_paid, (SELECT sum(portal_outstanding_payables) FROM civica_budget.budget_amendments) portal_outstanding,
    (SELECT min(amendment_year) FROM civica_budget.budget_amendments) first_year, (SELECT max(amendment_year) FROM civica_budget.budget_amendments) last_year`);
  const attributed = await one(`SELECT count(DISTINCT ra.author_code)::int reviewed_codes, count(DISTINCT ra.person_id)::int reviewed_people, count(DISTINCT ra.amendment_code)::int amendments FROM civica_budget.reviewed_amendment_authors ra`);
  const byConfidence = await all(`SELECT confidence, reviewed, count(*)::int codes FROM civica_budget.author_code_crosswalk GROUP BY 1,2 ORDER BY 1,2`);
  const byYear = await all(`WITH t AS (SELECT a.amendment_year y, p.custeio_amount+p.investimento_amount v, ra.person_id FROM civica_budget.special_action_plans p JOIN civica_budget.budget_amendments a ON a.amendment_code=p.amendment_code LEFT JOIN civica_budget.reviewed_amendment_authors ra ON ra.amendment_code=a.amendment_code)
    SELECT y, round(sum(v)/1e6)::int total_mi, round(sum(v) FILTER (WHERE person_id IS NOT NULL)/1e6)::int attributable_mi, round(100*sum(v) FILTER (WHERE person_id IS NOT NULL)/sum(v),2) pct FROM t GROUP BY 1 ORDER BY 1`);
  const houses = await all(`SELECT ra.house, count(DISTINCT ra.author_code)::int codes, round(sum(p.custeio_amount+p.investimento_amount)/1e9,2) bi FROM civica_budget.reviewed_amendment_authors ra JOIN civica_budget.special_action_plans p ON p.amendment_code=ra.amendment_code GROUP BY 1 ORDER BY 1`);
  const people = await one(`SELECT (SELECT count(*)::int FROM civica.people) people, (SELECT count(*)::int FROM civica.external_identifiers) external_ids,
    (SELECT count(*)::int FROM civica.profiles WHERE batch_id LIKE 'pg:roster-historical:%') historical_profiles, (SELECT count(*)::int FROM civica.mandates WHERE batch_id LIKE 'pg:roster-historical:%') historical_mandates,
    (SELECT count(*)::int FROM civica.exercise_periods WHERE batch_id LIKE 'pg:roster-historical:%') historical_exercises, (SELECT count(*)::int FROM civica.party_memberships WHERE batch_id LIKE 'pg:roster-historical:%') historical_parties,
    (SELECT count(*)::int FROM civica.identity_links WHERE id LIKE 'pix-identity:%') identity_candidates, (SELECT count(*)::int FROM civica.identity_links WHERE id LIKE 'pix-identity:%' AND status='candidate') still_candidate,
    (SELECT count(*)::int FROM civica.active_publications WHERE batch_id LIKE 'pg:roster-historical:%') historical_in_active`);
  const unresolved = await all(`SELECT author_code, confidence, reviewed, evidence_source->>'reason' reason, evidence_source->'candidates' candidates FROM civica_budget.author_code_crosswalk WHERE NOT (confidence='EXACT' AND reviewed) ORDER BY author_code`);
  const names = ['efraim', 'dorinha', 'beto faro', 'laercio', 'alan rick', 'hiran'];
  const switchers = [];
  for (const n of names) switchers.push({ name: n, rows: await all(`SELECT cw.author_code, cw.house, cw.confidence, cw.reviewed, p.name, p.external_id, cw.valid_from::text vf, cw.valid_to::text vt FROM civica_budget.author_code_crosswalk cw JOIN civica.profiles p ON p.person_id=cw.person_id AND p.batch_id LIKE 'pg:roster-historical:%' WHERE p.search_name LIKE $1 ORDER BY cw.valid_from`, [`%${n}%`]) });
  const sample = await all(`SELECT ra.person_id, sum(p.custeio_amount+p.investimento_amount) v FROM civica_budget.reviewed_amendment_authors ra JOIN civica_budget.special_action_plans p ON p.amendment_code=ra.amendment_code GROUP BY 1 ORDER BY 2 DESC LIMIT 3`);
  const topAmendment = (await one(`SELECT amendment_code FROM civica_budget.budget_amendments ORDER BY (SELECT count(*) FROM civica_budget.special_action_plans p WHERE p.amendment_code=budget_amendments.amendment_code) DESC LIMIT 1`)).amendment_code;
  const topBeneficiary = (await one(`SELECT beneficiary_cnpj c FROM civica_budget.special_action_plans GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`)).c;
  const timings = [
    ...await Promise.all(sample.map(s => timed(`parliamentarianPixSummary(${s.person_id.slice(0, 8)})`, () => parliamentarianPixSummary(pool, s.person_id)))),
    await timed(`pixAmendmentDetail(${topAmendment})`, () => pixAmendmentDetail(pool, topAmendment)),
    await timed(`pixBeneficiaryDetail(${topBeneficiary})`, () => pixBeneficiaryDetail(pool, topBeneficiary)),
    await timed('pixProfileCoverage', () => pixProfileCoverage(pool)),
  ].map(t => ({ label: t.label, ms: t.ms }));
  const detail = await pixAmendmentDetail(pool, topAmendment);
  const summary = await parliamentarianPixSummary(pool, sample[0].person_id);
  const coverage = await crosswalkCoverage(pool);
  const reconciliation = (run?.reconciliation ?? {}) as any;
  console.log(JSON.stringify({ run: { id: run?.run_id, finishedAt: run?.finished_at, gates: Object.fromEntries(Object.entries(reconciliation.gates ?? {}).map(([k, v]: any) => [k, v.status])), rowsPerTable: reconciliation.rowsPerTable },
    totals, attributed, PROFILE_PIX_VALUE_COVERAGE: { share: coverage.reviewedValueShare, attributable: coverage.reviewedValue, unattributed: coverage.unattributedValue, total: coverage.totalValue, reviewedCodes: coverage.reviewedCodes, codes: coverage.codes }, byConfidence, byYear, houses, people, unresolved,
    switchers, timings, sampleSummary: { personId: summary.personId, authorCodes: summary.authorCodes, counts: summary.counts, financials: summary.financials, years: summary.byYear.map(y => [y.year, Math.round(y.destinedAmount)]) },
    sampleAmendment: { code: detail?.amendmentCode, plans: detail?.plans.length, author: detail?.author } }, null, 1));
} finally { await pool.end(); }
