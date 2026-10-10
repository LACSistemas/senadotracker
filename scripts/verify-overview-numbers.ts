import assert from 'node:assert/strict';
import pg from 'pg';
import * as data from '../apps/web/lib/data-postgres.ts';

/**
 * Confere os números de /proposicoes contra o SQL do catálogo (verificações relacionais, que valem todos os dias) e imprime um resumo em JSON.
 * Com OVERVIEW_FROZEN_CUT=1 confere também os valores validados no corte de 2026-10-06 (que mudam com a coleta diária).
 * Somente leitura.
 */
const pool = new pg.Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
const YEAR = 2026;
const one = async (q: string, v: unknown[] = []) => (await pool.query(q, v)).rows[0];
const all = async (q: string, v: unknown[] = []) => (await pool.query(q, v)).rows;
const ACTIVE = `JOIN civica_poc.active_publications ap ON ap.source=p.source AND ap.batch_id=p.batch_id`;
const bundle: any = (await data.propositionOperationalBundle(YEAR)).data;
const ov = bundle.overview, c = ov.houses.camara, s = ov.houses.senado;
const byGroup = (v: any) => Object.fromEntries(v.groups.map((g: any) => [g.group, g.count]));
const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
const out: any = {
  basis: { top: bundle.temporalBasis, overview: ov.temporalBasis, composition: c.temporalBasis, flow: bundle.flow.camara.temporalBasis, rhythmPresented: bundle.rhythm.presented.temporalBasis, rhythmEvents: bundle.rhythm.events.temporalBasis, dna: bundle.dna.party.temporalBasis, recent: bundle.recent.camara.temporalBasis },
  congress: ov.congress.total, camara: c.total, senado: s.total, camaraGroups: byGroup(c), senadoGroups: byGroup(s), updatedThrough: bundle.updatedThrough, overviewUpdated: ov.updatedThrough, years: bundle.years,
  rhythm: { camara: bundle.rhythm.presented.houses.camara.months.map((m: any) => [m.month, m.total]), senado: bundle.rhythm.presented.houses.senado.months.map((m: any) => [m.month, m.total]), totals: [bundle.rhythm.presented.houses.camara.total, bundle.rhythm.presented.houses.senado.total] },
  eventsTotals: [bundle.rhythm.events.houses.camara.total, bundle.rhythm.events.houses.senado.total], flowUniverse: [bundle.flow.camara.universe, bundle.flow.senado.universe],
  facts: bundle.facts.map((f: any) => `${f.before}${f.emphasis}${f.after}`),
};

// --- relacionais (valem sempre)
const catalog = await all(`SELECT p.source,p.functional_group g,count(*)::int n FROM civica_poc.proposals p ${ACTIVE} WHERE p.presented_year=$1 GROUP BY 1,2`, [YEAR]);
const sqlTotal = (source: string) => catalog.filter(r => r.source === source).reduce((a, r) => a + r.n, 0);
const sqlGroups = (source: string) => Object.fromEntries(catalog.filter(r => r.source === source).map(r => [r.g, r.n]));
out.sql = { camara: sqlTotal('camara'), senado: sqlTotal('senado'), identifierNullPresented: (await one(`SELECT count(*)::int n FROM civica_poc.proposals p ${ACTIVE} WHERE p.presented_year=$1 AND p.year IS NULL`, [YEAR])).n, pareceresByIdentifier: (await one(`SELECT count(*)::int n FROM civica_poc.proposals p ${ACTIVE} WHERE p.year=$1 AND p.source='camara' AND p.functional_group='pareceres_relatorios'`, [YEAR])).n };
out.checks = {
  duplicates: (await one(`SELECT count(*)::int n FROM (SELECT p.source,p.external_id FROM civica_poc.proposals p ${ACTIVE} GROUP BY 1,2 HAVING count(*)>1) x`)).n,
  supportIdsInCatalog: (await one(`SELECT count(*)::int n FROM civica_poc.proposal_support s JOIN civica_poc.proposals p ON p.source=s.source AND p.external_id=s.external_id ${ACTIVE}`)).n,
  supportRows: (await one(`SELECT count(*)::int n FROM civica_poc.proposal_support`)).n,
};
assert.equal(out.camara, out.sql.camara, 'Câmara = catálogo por presentedYear'); assert.equal(out.senado, out.sql.senado, 'Senado = catálogo por presentedYear');
assert.equal(out.congress, out.camara + out.senado, 'Câmara + Senado = Congresso');
assert.deepEqual(out.camaraGroups, sqlGroups('camara')); assert.deepEqual(out.senadoGroups, sqlGroups('senado'));
assert.equal(sum(out.camaraGroups), out.camara, 'a composição soma o total da Câmara'); assert.equal(sum(out.senadoGroups), out.senado, 'a composição soma o total do Senado');
assert.deepEqual(out.rhythm.totals, [out.camara, out.senado], 'o ritmo mensal reconcilia com os totais');
assert.equal(out.rhythm.camara.reduce((a: number, m: any) => a + m[1], 0), out.camara); assert.equal(out.rhythm.senado.reduce((a: number, m: any) => a + m[1], 0), out.senado);
assert.ok(out.sql.identifierNullPresented > 0, 'há entidades sem ano do número apresentadas no ano');
assert.ok((out.camaraGroups.pareceres_relatorios ?? 0) > out.sql.pareceresByIdentifier * 10, 'pareceres sem ano entram pelo ano de apresentação');
assert.equal(out.checks.duplicates, 0); assert.equal(out.checks.supportIdsInCatalog, 0);
assert.deepEqual([out.basis.top, out.basis.overview, out.basis.composition, out.basis.rhythmPresented, out.basis.dna, out.basis.recent], Array(6).fill('presented_at'));
assert.deepEqual([out.basis.flow, out.basis.rhythmEvents], ['identifier_year', 'identifier_year']);

// --- autoria do DNA: nenhuma relatoria/parecer/ato procedimental entra (índices de grupo: 3 = pareceres, 4 = instrumentos de votação)
const dnaRows: any[] = bundle.dna.member.rows;
out.dna = { rows: dnaRows.length, rowsWithPareceres: dnaRows.filter(r => r.counts[3] > 0).length, rowsWithInstrumentos: dnaRows.filter(r => r.counts[4] > 0).length,
  altineu: dnaRows.filter(r => r.source === 'camara' && /altineu/i.test(r.name)).map(r => r.distinctProposals), maxCamara: Math.max(...dnaRows.filter(r => r.source === 'camara').map(r => r.distinctProposals)) };
assert.equal(out.dna.rowsWithPareceres, 0); assert.equal(out.dna.rowsWithInstrumentos, 0);
for (const n of out.dna.altineu) assert.ok(n < out.dna.maxCamara / 10, 'Altineu não lidera por causa dos pareceres a RIC');

// --- desempenho: a composição por presentedYear usa o índice
const batch = (await one(`SELECT batch_id FROM civica_poc.active_publications WHERE source='camara'`)).batch_id;
const plan = (await all(`EXPLAIN (ANALYZE) SELECT functional_group,count(*) FROM civica_poc.proposals WHERE source='camara' AND batch_id=$1 AND presented_year=$2 GROUP BY 1`, [batch, YEAR])).map(r => r['QUERY PLAN']).join('\n');
out.plan = { usesPresentedYearIndex: /proposals_presented_year_idx/.test(plan), execution: /Execution Time: ([\d.]+) ms/.exec(plan)?.[1] ?? null };
assert.ok(out.plan.usesPresentedYearIndex);

if (process.env.OVERVIEW_FROZEN_CUT === '1') {
  assert.equal(out.congress, 48603); assert.equal(out.camara, 45117); assert.equal(out.senado, 3486);
  assert.deepEqual(out.camaraGroups, { pareceres_relatorios: 11021, requerimentos: 9535, instrumentos_votacao_tramitacao: 6822, proposicoes_legislativas_principais: 6485, emendas_substitutivos: 4899, oficios_documentos: 2593, atos_documentos_especiais: 1720, indicacoes_sugestoes: 1633, mensagens_comunicacoes_institucionais: 381, recursos_representacoes_peticoes: 28 });
  assert.deepEqual(out.senadoGroups, { requerimentos: 1903, proposicoes_legislativas_principais: 1301, atos_documentos_especiais: 129, mensagens_comunicacoes_institucionais: 58, recursos_representacoes_peticoes: 57, indicacoes_sugestoes: 32, oficios_documentos: 6 });
  assert.deepEqual(out.rhythm.camara.map((m: any) => m[1]), [50, 5243, 7780, 7430, 8256, 5810, 5687, 3015, 1803, 43]);
  assert.deepEqual(out.rhythm.senado.map((m: any) => m[1]), [107, 343, 608, 401, 519, 517, 409, 299, 261, 22]);
}
console.log(JSON.stringify(out));
await pool.end(); process.exit(0);
