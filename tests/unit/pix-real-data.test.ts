import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { activeBudgetRun, crosswalkCoverage } from '../../packages/db/src/postgres-budget.ts';
import { parliamentarianPixSummary, pixAmendmentDetail } from '../../packages/db/src/postgres-budget-read.ts';

/** Verificações sobre a carga REAL (somente leitura). Só rodam quando há coleta publicada e crosswalk carregado. */
const hasDb = process.env.DB_NAME === 'projetoeleitor_db' && Boolean(process.env.DB_PASSWORD);
const pool = hasDb ? new pg.Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, max: 2 }) : null!;
test.after(async () => { await pool?.end(); });
const ready = hasDb && Boolean(await pool.query(`SELECT to_regclass('civica_budget.author_code_crosswalk') t`).then(r => r.rows[0].t).catch(() => null))
  && Number((await pool.query(`SELECT count(*) n FROM civica_budget.author_code_crosswalk`)).rows[0].n) > 0;
const skip = !ready && 'requer a carga real de Emendas Pix (npm run pix -- collect / identity)';

test('1270 (João Carlos Bacelar) não tem pessoa e nenhuma emenda dele é atribuída a perfil', { skip }, async () => {
  const rows = (await pool.query(`SELECT person_id, confidence, reviewed FROM civica_budget.author_code_crosswalk WHERE author_code='1270'`)).rows;
  assert.ok(rows.length >= 1);
  for (const r of rows) { assert.equal(r.person_id, null); assert.equal(r.reviewed, false); assert.equal(r.confidence, 'AMBIGUOUS', 'decisão de produto: 1270 permanece AMBIGUOUS'); }
  const attributed = Number((await pool.query(`SELECT count(*) n FROM civica_budget.reviewed_amendment_authors WHERE author_code='1270'`)).rows[0].n);
  assert.equal(attributed, 0);
  const amendment = (await pool.query(`SELECT amendment_code FROM civica_budget.budget_amendments WHERE author_code='1270' ORDER BY amendment_year LIMIT 1`)).rows[0].amendment_code;
  const detail = await pixAmendmentDetail(pool, amendment);
  assert.equal(detail!.author.attributed, false); assert.equal(detail!.author.personId, null);
});

test('só linhas revisadas atribuem: EXACT por regra, HIGH só com revisão humana registrada; AMBIGUOUS/CONFLICT nunca', { skip }, async () => {
  const exact = (await pool.query(`SELECT count(*)::int n FROM civica_budget.author_code_crosswalk WHERE confidence='EXACT' AND reviewed AND person_id IS NOT NULL`)).rows[0].n;
  assert.ok(exact >= 700, `EXACT revisados: ${exact}`);
  const leaked = (await pool.query(`SELECT count(*)::int n FROM civica_budget.reviewed_amendment_authors ra WHERE NOT EXISTS (SELECT 1 FROM civica_budget.author_code_crosswalk cw WHERE cw.author_code=ra.author_code AND cw.person_id=ra.person_id AND cw.reviewed AND cw.confidence IN ('EXACT','HIGH'))`)).rows[0].n;
  assert.equal(leaked, 0);
  const notReviewedAttributed = (await pool.query(`SELECT count(*)::int n FROM civica_budget.reviewed_amendment_authors ra WHERE ra.author_code IN (SELECT author_code FROM civica_budget.author_code_crosswalk WHERE NOT reviewed OR confidence IN ('AMBIGUOUS','CONFLICT','UNMATCHED'))`)).rows[0].n;
  assert.equal(notReviewedAttributed, 0);
  // todo HIGH revisado carrega o registro da revisão (decisão, checagens, exercícios); confiança técnica continua HIGH
  const highReviewed = (await pool.query(`SELECT author_code, review_source, evidence_source->'humanReview'->>'decision' decision FROM civica_budget.author_code_crosswalk WHERE confidence='HIGH' AND reviewed`)).rows;
  for (const r of highReviewed) { assert.equal(r.review_source, 'human'); assert.equal(r.decision, 'CONFIRM'); }
  const highAttributed = Number((await pool.query(`SELECT count(DISTINCT ra.author_code) n FROM civica_budget.reviewed_amendment_authors ra JOIN civica_budget.author_code_crosswalk cw ON cw.author_code=ra.author_code WHERE cw.confidence='HIGH' AND cw.reviewed`)).rows[0].n);
  assert.equal(highAttributed, highReviewed.length, 'HIGH confirmado aparece');
});

test('4454 (Rafael Simões) só atribui se o histórico oficial resolveu; nunca por força', { skip }, async () => {
  const row = (await pool.query(`SELECT person_id, confidence, reviewed FROM civica_budget.author_code_crosswalk WHERE author_code='4454'`)).rows[0];
  if (row.person_id) { assert.equal(row.confidence, 'EXACT'); assert.equal(row.reviewed, true); } else { assert.equal(row.confidence, 'CONFLICT'); assert.equal(row.reviewed, false); }
});

test('troca de Casa real: cada um dos seis tem um código na Câmara e outro no Senado, em pessoas distintas até o link ser confirmado', { skip }, async () => {
  for (const pattern of ['efraim', 'dorinha', 'beto faro', 'laercio', 'alan rick', 'hiran']) {
    const rows = (await pool.query(`SELECT cw.author_code, cw.house, cw.person_id, cw.valid_from::text vf FROM civica_budget.author_code_crosswalk cw JOIN civica.profiles p ON p.person_id=cw.person_id AND p.batch_id LIKE 'pg:roster-historical:%' WHERE p.search_name LIKE $1 AND cw.person_id IS NOT NULL ORDER BY cw.valid_from`, [`%${pattern}%`])).rows;
    const houses = new Set(rows.map(r => r.house));
    assert.ok(houses.has('camara') && houses.has('senado'), `${pattern}: ${JSON.stringify(rows)}`);
    assert.ok(new Set(rows.map(r => r.author_code)).size >= 2, `${pattern}: dois códigos SIOP`);
    const camara = rows.find(r => r.house === 'camara')!, senado = rows.find(r => r.house === 'senado')!;
    assert.notEqual(camara.person_id, senado.person_id);
    assert.ok(camara.vf < senado.vf, `${pattern}: o código da Câmara vem antes do do Senado`);
    // sem link confirmado, o perfil de cada um só enxerga o próprio código
    const link = (await pool.query(`SELECT status FROM civica.identity_links WHERE (person_a=$1 AND person_b=$2) OR (person_a=$2 AND person_b=$1)`, [camara.person_id, senado.person_id])).rows[0];
    if (!link || link.status !== 'confirmed') {
      const s = await parliamentarianPixSummary(pool, senado.person_id);
      assert.ok(s.authorCodes.every(c => c.house === 'senado'), `${pattern}: perfil do senador não herda códigos da Câmara`);
    }
  }
});

test('cobertura real de atribuição e integridade da carga', { skip }, async () => {
  const run = await activeBudgetRun(pool); assert.ok(run, 'há coleta publicada');
  const gates = (run.reconciliation as any).gates;
  assert.equal(gates.TRANSFEREGOV_PLAN_COVERAGE.status, 'PASS'); assert.equal(gates.PORTAL_AMENDMENT_MATCH.status, 'PASS');
  const c = await crosswalkCoverage(pool);
  assert.ok(c.reviewedValueShare > 0.9, `valor atribuível: ${c.reviewedValueShare}`);
  assert.ok(c.unattributedValue >= 0 && Math.abs(c.reviewedValue + c.unattributedValue - c.totalValue) < 1);
  // o lote histórico não é ativo e o domínio não cria linhas em proposals
  assert.equal(Number((await pool.query(`SELECT count(*) n FROM civica.active_publications WHERE batch_id LIKE 'pg:roster-historical:%'`)).rows[0].n), 0);
  assert.equal(Number((await pool.query(`SELECT count(*) n FROM civica_budget.special_action_plans p WHERE p.amendment_code IS NULL`)).rows[0].n), 0);
});
