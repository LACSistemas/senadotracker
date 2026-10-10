import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { layoutHemicycle, rowsFor, summarizeSeats } from '../../apps/web/lib/hemicycle.ts';
import { NEUTRAL_PARTY_COLOR, partyColor } from '../../apps/web/lib/party-colors.ts';

/** Hemiciclo de composição partidária: geometria, agrupamento por partido, cores estáveis e custo zero de consulta. */
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

test('layout: uma cadeira por parlamentar, contagem exata por partido, tudo dentro do semicírculo', () => {
  for (const counts of [[98, 64, 52, 46, 48, 38, 42, 27, 18, 17, 13, 11, 9, 6, 5, 5, 4, 3, 3, 2, 1, 1], [16, 14, 9, 9, 7, 7, 6, 4, 3, 3, 2, 1], [1], [3, 2], [40]]) {
    const total = sum(counts), layout = layoutHemicycle(counts);
    assert.equal(layout.seats.length, total);
    counts.forEach((n, party) => assert.equal(layout.seats.filter(s => s.party === party).length, n, `partido ${party}`));
    for (const s of layout.seats) { assert.ok(Math.hypot(s.x, s.y) <= layout.outer + 1e-6 && s.y <= 1e-6, 'dentro do semicírculo superior'); }
    assert.ok(layout.dotRadius > 0);
  }
  assert.deepEqual(layoutHemicycle([]).seats, []); assert.equal(layoutHemicycle([0, 0]).total, 0);
});

test('layout: cadeiras não se sobrepõem em nenhuma fileira (513, 81 e casos pequenos)', () => {
  for (const total of [513, 81, 7, 2]) {
    const layout = layoutHemicycle([total]), d = layout.dotRadius * 2;
    let min = Infinity;
    for (let i = 0; i < layout.seats.length; i++) for (let j = i + 1; j < layout.seats.length; j++) min = Math.min(min, Math.hypot(layout.seats[i]!.x - layout.seats[j]!.x, layout.seats[i]!.y - layout.seats[j]!.y));
    if (layout.seats.length > 1) assert.ok(min >= d * 0.999, `${total}: menor distância ${min.toFixed(3)} < diâmetro ${d.toFixed(3)}`);
  }
});

test('layout: cada partido ocupa uma fatia contínua, da esquerda para a direita, na ordem dada', () => {
  const counts = [98, 64, 52, 46, 38, 17, 9, 1], layout = layoutHemicycle(counts);
  const meanAngle = (party: number) => { const a = layout.seats.filter(s => s.party === party).map(s => s.angle); return sum(a) / a.length; };
  for (let p = 1; p < counts.length; p++) assert.ok(meanAngle(p) < meanAngle(p - 1), `partido ${p} fica à direita do ${p - 1}`);
  // sem "ilhas": nenhuma cadeira de um partido fica à esquerda de uma do partido anterior
  for (let p = 1; p < counts.length; p++) { const prevMin = Math.min(...layout.seats.filter(s => s.party === p - 1).map(s => s.angle)), curMax = Math.max(...layout.seats.filter(s => s.party === p).map(s => s.angle)); assert.ok(curMax <= prevMin + 1e-9, `fatia ${p} começa onde a ${p - 1} termina`); }
  assert.ok(rowsFor(513) > rowsFor(81) && rowsFor(81) >= 4 && rowsFor(1) === 1);
});

test('composição: contagem por partido a partir do cadastro, ordenada, sem partido agrupado', () => {
  const c = summarizeSeats([{ party: 'PT' }, { party: 'PL' }, { party: 'PL' }, { party: ' ' }, { party: null }, { party: 'MDB' }, { party: 'MDB' }]);
  assert.equal(c.total, 7); assert.deepEqual(c.parties, [{ party: 'MDB', seats: 2 }, { party: 'PL', seats: 2 }, { party: 'Sem partido', seats: 2 }, { party: 'PT', seats: 1 }]);
});

test('cores: estáveis por partido, distintas entre os partidos da Câmara e neutras para "Sem partido"', () => {
  const parties = ['PL', 'PT', 'UNIÃO', 'PP', 'PSD', 'MDB', 'REPUBLICANOS', 'PSB', 'PDT', 'PSDB', 'PODE', 'PSOL', 'AVANTE', 'SOLIDARIEDADE', 'PCdoB', 'PV', 'CIDADANIA', 'NOVO', 'REDE', 'PRD', 'DC', 'MISSÃO'];
  assert.equal(new Set(parties.map(partyColor)).size, parties.length, 'nenhuma cor repetida');
  assert.equal(partyColor('PL'), partyColor('PL')); assert.equal(partyColor('Sem partido'), NEUTRAL_PARTY_COLOR); assert.equal(partyColor('PARTIDO NOVO XYZ'), partyColor('PARTIDO NOVO XYZ'));
  const hue = (c: string) => Number(/hsl\(([\d.]+)/.exec(c)![1]);
  for (let i = 1; i < parties.length; i++) { const d = Math.abs(hue(partyColor(parties[i]!)) - hue(partyColor(parties[i - 1]!))); assert.ok(Math.min(d, 360 - d) > 25, `${parties[i - 1]} × ${parties[i]} vizinhos muito parecidos`); }
});

test('custo zero: a composição reaproveita o cadastro já carregado, sem consulta nova', () => {
  const src = readFileSync('apps/web/lib/data-postgres-wave4.ts', 'utf8');
  const start = src.indexOf('export async function houseListing'), end = src.indexOf('type PersonMonthCost');
  const body = src.slice(start, end);
  assert.equal((body.match(/await profiles\(source\)/g) ?? []).length, 1, 'cadastro carregado uma única vez');
  assert.match(body, /const composition=summarizeSeats\(allProfiles\)/);
  const compositionLine = body.slice(body.indexOf('const composition='), body.indexOf('return ok('));
  assert.doesNotMatch(compositionLine, /pool\(\)|query\(|await /, 'a composição não consulta o banco');
  const component = readFileSync('apps/web/components/party-hemicycle.tsx', 'utf8');
  assert.doesNotMatch(component, /fetch\(|useEffect/, 'o componente não busca dados no cliente');
  const page = readFileSync('apps/web/components/parliamentary-house-page.tsx', 'utf8');
  assert.match(page, /<PartyHemicycle composition=\{composition\} house=\{source\}\/>/);
});

const hasDb = process.env.DB_NAME === 'projetoeleitor_db' && Boolean(process.env.DB_PASSWORD);
test('dados reais: cadeiras do hemiciclo = parlamentares em exercício do cadastro ativo (uma consulta)', { skip: !hasDb && 'requer o PostgreSQL local (DB_*)' }, async () => {
  const pool = new pg.Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, max: 1 });
  try {
    const rows = (await pool.query(`SELECT a.source, p.party FROM civica.profiles p JOIN civica.active_publications a ON a.batch_id=p.batch_id WHERE a.source IN ('camara','senado')`)).rows;
    for (const [source, seats] of [['camara', 513], ['senado', 81]] as const) {
      const composition = summarizeSeats(rows.filter(r => r.source === source));
      assert.equal(composition.total, seats, `${source}: ${composition.total} cadeiras`);
      assert.equal(sum(composition.parties.map(p => p.seats)), composition.total);
      const layout = layoutHemicycle(composition.parties.map(p => p.seats));
      assert.equal(layout.seats.length, composition.total);
    }
  } finally { await pool.end(); }
});
