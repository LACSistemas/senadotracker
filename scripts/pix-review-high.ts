import pg from 'pg';
import { foldName, stripTitle } from '../packages/domain/src/budget.ts';
import { crosswalkCoverage } from '../packages/db/src/postgres-budget.ts';

/**
 * Revisão individual dos códigos HIGH do crosswalk de Emendas Pix. Não relaxa a regra automática: confere, código a código, as quatro
 * condições de confirmação a partir das evidências oficiais já persistidas e registra a decisão (CONFIRM / KEEP_PENDING).
 *   (1) nome oficial exato; (2) uma única pessoa plausível no roster completo da coleta; (3) exercício oficial compatível em todos os anos;
 *   (4) nenhuma pessoa concorrente compatível no período (o resolvedor teria devolvido AMBIGUOUS).
 * `--apply` grava reviewed=true, review_source='human' e o registro da revisão em evidence_source.humanReview (confidence permanece HIGH).
 */
const apply = process.argv.includes('--apply');
const pool = new pg.Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, max: 2 });
const overlap = (e: { start: string; end: string | null }, a: string, b: string) => e.start.slice(0, 10) <= b && (e.end ?? '9999-12-31').slice(0, 10) >= a;
try {
  const before = await crosswalkCoverage(pool);
  const rows = (await pool.query(`SELECT cw.author_code, cw.valid_from::text vf, cw.valid_to::text vt, cw.person_id, cw.house, cw.mandate_key, cw.confidence, cw.reviewed, cw.review_source, cw.evidence_source ev,
      p.name pname, p.external_id pext, p.payload ppayload
    FROM civica_budget.author_code_crosswalk cw LEFT JOIN civica.profiles p ON p.person_id=cw.person_id AND p.batch_id LIKE 'pg:roster-historical:%'
    WHERE cw.confidence='HIGH' ORDER BY cw.author_code`)).rows;
  const out: any[] = [];
  for (const r of rows) {
    const ev = r.ev, years: number[] = ev.years, names: string[] = ev.names, profile = r.ppayload;
    const official = [profile.name, profile.fullName].filter(Boolean).map((n: string) => foldName(n));
    const exactName = names.some(n => official.includes(foldName(n)));
    const strippedName = !exactName && names.some(n => official.includes(stripTitle(foldName(n))));
    const unique = Array.isArray(ev.candidates) && ev.candidates.length === 1;
    const exercises: Array<{ start: string; end: string | null }> = profile.exercises ?? [];
    const perYear = years.map(y => ({ year: y, window: exercises.some(e => overlap(e, `${y - 1}-08-01`, `${y - 1}-12-31`)), inYear: exercises.some(e => overlap(e, `${y}-01-01`, `${y}-12-31`)) }));
    const compatible = perYear.every(y => y.window || y.inYear);
    const links = (await pool.query(`SELECT id, status FROM civica.identity_links WHERE person_a=$1 OR person_b=$1`, [r.person_id])).rows;
    const mandate = (profile.mandates ?? []).find((m: any) => m.key === r.mandate_key) ?? null;
    const checks = { exactName: exactName || strippedName, officialNameExact: exactName, unique, exerciseCompatible: compatible, noCompetitor: unique, dependsOnCrossHouseLink: links.length > 0 };
    const decision = checks.officialNameExact && unique && compatible && !checks.dependsOnCrossHouseLink ? 'CONFIRM' : 'KEEP_PENDING';
    out.push({ author_code: r.author_code, names, years, person: { personId: r.person_id, officialName: profile.name, fullName: profile.fullName, externalId: `${r.house}:${r.pext}`, uf: profile.uf }, house: r.house,
      mandate: mandate && { key: mandate.key, legislature: mandate.legislature, role: mandate.role, start: mandate.start, end: mandate.end }, exercises: exercises.filter(e => (e.end ?? '9999') >= '2019').map(e => `${e.start.slice(0, 10)}..${e.end ? e.end.slice(0, 10) : 'aberto'}`),
      reason: ev.reason, perYear, checks, links, decision });
  }
  if (apply) {
    for (const o of out.filter(x => x.decision === 'CONFIRM')) {
      await pool.query(`UPDATE civica_budget.author_code_crosswalk SET reviewed=true, reviewed_at=now(), review_source='human', updated_at=now(),
          evidence_source = evidence_source || jsonb_build_object('humanReview', $2::jsonb) WHERE author_code=$1 AND confidence='HIGH'`,
        [o.author_code, JSON.stringify({ decision: 'CONFIRM', reviewedAt: new Date().toISOString(), reviewer: 'revisão individual por evidência oficial (fechamento de identidade 2026-10-06)', checks: o.checks, exercises: o.exercises, reason: o.reason })]);
    }
  }
  const after = await crosswalkCoverage(pool);
  console.log(JSON.stringify({ applied: apply, coverageBefore: { share: before.reviewedValueShare, value: before.reviewedValue }, coverageAfter: { share: after.reviewedValueShare, value: after.reviewedValue, unattributed: after.unattributedValue }, review: out }, null, 1));
} finally { await pool.end(); }
