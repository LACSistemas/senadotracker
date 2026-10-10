import pg from 'pg';
import { parliamentarianPixWith } from '../apps/web/lib/data-postgres-pix.ts';
import { buildPixStory } from '../apps/web/lib/pix-profile-model.ts';

/** Confere, em perfis reais, que o resumo do perfil = soma coerente das emendas/planos e que nada não revisado entra (somente leitura). */
const pool = new pg.Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, max: 2 });
const cases: Array<[string, 'camara' | 'senado', string]> = [['muitos (senador)', 'senado', '1186'], ['muitos (deputado)', 'camara', '204494'], ['poucos (deputado)', 'camara', '178937'], ['HIGH confirmado (deputada)', 'camara', '204374'], ['trocou de Casa: código do Senado', 'senado', '4642'], ['trocou de Casa: código da Câmara', 'camara', '141422'], ['sem Pix (senador)', 'senado', '1173']];
try {
  for (const [label, source, id] of cases) {
    const t = performance.now(); const r = await parliamentarianPixWith(pool, source, id); const ms = Math.round(performance.now() - t);
    if (r.status !== 'available') { console.log(JSON.stringify({ label, source, id, status: r.status, reason: (r as any).reason, ms })); continue; }
    const s = r.summary, codes = s.authorCodes.map(c => c.authorCode);
    const sql = (await pool.query(`SELECT count(DISTINCT a.amendment_code)::int amendments, count(p.plan_id)::int plans, coalesce(sum(p.custeio_amount+p.investimento_amount),0) destined, coalesce(sum(DISTINCT 0),0) z,
       count(DISTINCT p.beneficiary_cnpj)::int beneficiaries FROM civica_budget.budget_amendments a JOIN civica_budget.special_action_plans p ON p.amendment_code=a.amendment_code
       JOIN civica_budget.reviewed_amendment_authors ra ON ra.amendment_code=a.amendment_code WHERE ra.person_id = ANY($1::text[])`, [s.personIds])).rows[0];
    const paid = (await pool.query(`SELECT coalesce(sum(a.portal_paid),0) paid FROM civica_budget.budget_amendments a JOIN civica_budget.reviewed_amendment_authors ra ON ra.amendment_code=a.amendment_code WHERE ra.person_id = ANY($1::text[])`, [s.personIds])).rows[0];
    const foreign = (await pool.query(`SELECT count(*)::int n FROM civica_budget.budget_amendments a WHERE a.amendment_code = ANY($1::text[]) AND a.author_code <> ALL($2::text[])`, [s.amendments.map(a => a.amendmentCode), codes])).rows[0].n;
    const unreviewed = (await pool.query(`SELECT count(*)::int n FROM civica_budget.budget_amendments a WHERE a.amendment_code = ANY($1::text[]) AND NOT EXISTS (SELECT 1 FROM civica_budget.reviewed_amendment_authors ra WHERE ra.amendment_code=a.amendment_code AND ra.person_id = ANY($2::text[]))`, [s.amendments.map(a => a.amendmentCode), s.personIds])).rows[0].n;
    const sumAmend = s.amendments.reduce((t, a) => t + a.destinedAmount, 0), sumPlans = s.amendments.reduce((t, a) => t + a.plans, 0), sumYears = s.byYear.reduce((t, y) => t + y.destinedAmount, 0), sumKind = s.byExpenseKind.custeio + s.byExpenseKind.investimento, sumUf = s.byUf.reduce((t, u) => t + u.destinedAmount, 0);
    const story = buildPixStory(s);
    console.log(JSON.stringify({ label, source, id, ms, codes, destined: Math.round(s.financials.destinedAmount), paid: Math.round(s.financials.paidAmount ?? 0), counts: s.counts,
      coherent: { amendments: s.counts.amendments === sql.amendments, plans: s.counts.plans === sql.plans && sumPlans === s.counts.plans, destinedVsSql: Math.abs(Number(sql.destined) - s.financials.destinedAmount) < 1, amendmentsSum: Math.abs(sumAmend - s.financials.destinedAmount) < 1, yearsSum: Math.abs(sumYears - s.financials.destinedAmount) < 1, kindSum: Math.abs(sumKind - s.financials.destinedAmount) < 1, ufSum: Math.abs(sumUf - s.financials.destinedAmount) < 1, paidVsSql: Math.abs(Number(paid.paid) - (s.financials.paidAmount ?? 0)) < 1, beneficiaries: s.counts.beneficiaries === sql.beneficiaries },
      leaks: { otherAuthorCodes: foreign, unreviewed }, amendmentsListed: s.amendments.length, headline: story.headline }));
  }
} finally { await pool.end(); }
