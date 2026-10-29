import assert from 'node:assert/strict';
import test from 'node:test';
import { bars, chart, comparePoint, compareSeries, lastOf, monthlySeries, nameOf, prevOf, pt, stat, table, territoryCompare } from '../../apps/web/lib/wellbeing/build.ts';
import { actionNarrative, conditionsNarrative, digitalNarrative, evolutionNarrative, socialNarrative, workNarrative } from '../../apps/web/lib/wellbeing/narrative.ts';
import type { WbScope } from '../../apps/web/lib/wellbeing/types.ts';

const muni: WbScope = { kind: 'municipio', entityId: 3205309, ufCode: 32, uf: 'ES', name: 'Vitória', stateName: 'Espírito Santo', population: null };
const uf: WbScope = { kind: 'uf', entityId: 32, ufCode: 32, uf: 'ES', name: 'Espírito Santo', stateName: 'Espírito Santo', population: null };

test('bars: valores nulos nunca entram como barra de zero; display default vem de fmt', () => {
  const rows = bars([{ label: 'Água', value: 91.4 }, { label: 'Esgoto', value: null }, { label: 'Lixo', value: 100, display: '100%' }]);
  assert.deepEqual(rows.map(r => r.label), ['Água', 'Lixo'], 'Esgoto sem dado não aparece como 0');
  assert.equal(rows[0]!.display, '91,4'); assert.equal(rows[1]!.display, '100%');
});

test('stat: unidade e nota só entram quando fornecidas; nota ausente é null, não undefined', () => {
  const s1 = stat('Renda', 'R$ 1.100', 'R$/mês'); assert.equal(s1.unit, 'R$/mês'); assert.equal(s1.note, null);
  const s2 = stat('Gini', '0,505'); assert.ok(!('unit' in s2) || s2.unit === undefined);
});

test('table: sem linhas não há tabela (nunca uma tabela vazia com cabeçalho só)', () => {
  assert.equal(table('t', ['a'], []), null);
  const t = table('Despesa', ['Empenhado'], [['2025', ['R$ 100']]])!; assert.equal(t.rows.length, 1); assert.equal(t.rows[0]!.cells[0], 'R$ 100');
});

test('chart: sem nenhum valor não gera gráfico; cobertura reflete só os períodos com dado', () => {
  assert.equal(chart({ id: 'c', title: 't', unit: 'u', digits: 0, series: [{ key: 'a', label: 'a', points: [pt(2020, null)] }], notes: [], source: 's', coverage: 'x' }), null);
  const c = chart({ id: 'c', title: 't', unit: 'u', digits: 0, series: [{ key: 'a', label: 'a', points: [pt(2023, 10), pt(2024, null), pt(2025, 20)] }], notes: [], source: 's', coverage: 'anual' })!;
  assert.equal(c.coverage, '2023–2025 · anual'); assert.equal(c.series[0]!.points[1]!.state, 'absent');
});

test('monthlySeries: converte período ISO em grão AAAA-MM e marca ausência quando não há valor', () => {
  const s = monthlySeries('bal', 'Saldo', [{ periodStart: '2026-04-01', value: -3872 }, { periodStart: '2026-05-01', value: null }, { periodStart: null, value: 10 }]);
  assert.deepEqual(s.points.map(p => p.t), ['2026-04', '2026-05'], 'ponto sem periodStart é descartado, não vira ponto fantasma');
  assert.equal(s.points[0]!.v, -3872); assert.equal(s.points[1]!.state, 'absent');
});

test('comparePoint: nunca inventa valor quando o comparador não é elegível', () => {
  const ok = comparePoint('Brasil', { eligible: true, value: 0.542, reason: null }, v => String(v)); assert.equal(ok.display, '0.542');
  const no = comparePoint('Brasil', { eligible: false, value: null, reason: 'fonte não publica neste recorte' }, v => String(v));
  assert.equal(no.value, null); assert.equal(no.display, '—'); assert.equal(no.reason, 'fonte não publica neste recorte');
  const missing = comparePoint('Brasil', undefined, v => String(v)); assert.equal(missing.reason, 'não disponível');
});

test('territoryCompare: UF não duplica a própria linha de estado (state fica null, não um ponto trivial repetido)', () => {
  const cmp = { municipality: { eligible: true, value: 1100, reason: null }, state: { eligible: true, value: 1050, reason: null }, brazil: { eligible: true, value: 1300, reason: null } };
  const tcMuni = territoryCompare({ ownLabel: 'Vitória', stateLabel: 'Espírito Santo', comparisons: cmp, year: '2022', unit: 'R$/mês', format: v => String(v), restrictions: [] })!;
  assert.ok(tcMuni.state); assert.equal(tcMuni.state!.value, 1050);
  const tcUf = territoryCompare({ ownLabel: 'Espírito Santo', comparisons: cmp, year: '2022', unit: 'R$/mês', format: v => String(v), restrictions: [] })!;
  assert.equal(tcUf.state, null, 'sem stateLabel, o ponto de estado é omitido em vez de repetir o território');
  assert.equal(territoryCompare({ ownLabel: 'x', comparisons: { municipality: { eligible: false, value: null, reason: 'r' } }, year: null, unit: 'u', format: v => String(v), restrictions: [] }), null, 'território não elegível: sem comparação nenhuma');
});

test('compareSeries: município mostra território+UF+Brasil; UF nunca duplica a linha de UF', () => {
  const c = { own: [{ year: 2025, value: 1 }], uf: [{ year: 2025, value: 2 }], br: [{ year: 2025, value: 3 }] };
  assert.deepEqual(compareSeries(muni, c).map(s => s.key), ['own', 'uf', 'br']);
  assert.deepEqual(compareSeries(uf, c).map(s => s.key), ['own', 'br']);
});

test('nameOf: município usa o próprio nome, UF usa o nome do estado', () => {
  assert.equal(nameOf(muni), 'Vitória'); assert.equal(nameOf(uf), 'Espírito Santo');
});

test('lastOf/prevOf: ignoram pontos nulos ao buscar o mais recente e o anterior válido', () => {
  const rows = [{ year: 2023, value: 10 }, { year: 2024, value: null }, { year: 2025, value: 30 }];
  assert.equal(lastOf(rows)!.year, 2025); assert.equal(prevOf(rows, lastOf(rows))!.year, 2023);
});

test('narrativa de condições: Gini só aparece no texto quando foi passado (nunca inferido de município)', () => {
  const withGini = conditionsNarrative({ scope: uf, incomeMedian: 1100, incomeMean: 1300, waterPct: 91, sewerPct: 80, garbagePct: 95, gini: 0.505 });
  assert.match(withGini.answer, /1\.100|1100/); assert.match(withGini.context ?? '', /Gini/);
  const noGini = conditionsNarrative({ scope: muni, incomeMedian: 1100, incomeMean: null, waterPct: null, sewerPct: null, garbagePct: null, gini: null });
  assert.doesNotMatch(noGini.context ?? '', /Gini/);
});

test('narrativa de trabalho: nunca confunde estoque RAIS, estoque de referência do Caged e saldo mensal', () => {
  const n = workNarrative({ scope: muni, raisYear: 2025, raisStock: 1127414, cagedMonth: 'agosto/2026', cagedBal: -3872, cagedStock: 500000 });
  assert.match(n.answer, /RAIS registrou 1\.127\.414/); assert.match(n.answer, /saldo do Novo Caged foi -3\.872/); assert.match(n.context ?? '', /não é taxa de desemprego/);
});

test('narrativa social: sem CRAS respondente, diz explicitamente que não há registro (nunca mostra zero)', () => {
  const none = socialNarrative({ scope: muni, cras: null, creas: null }); assert.match(none.answer, /não registrou CRAS respondente/);
  const some = socialNarrative({ scope: muni, cras: 3, creas: 1 }); assert.match(some.answer, /3 CRAS e 1 CREAS/);
});

test('narrativa digital: muda de pergunta "sim/não" (município) para proporção entre prefeituras (UF)', () => {
  const m = digitalNarrative({ scope: muni, municipalityAnswer: true, ufPositive: null, ufValid: null }); assert.match(m.answer, /declarou oferecer atendimento digital/);
  const u = digitalNarrative({ scope: uf, municipalityAnswer: null, ufPositive: 627, ufValid: 5554 }); assert.match(u.answer, /627 de 5\.554 prefeituras/);
});

test('narrativa de ação pública: nunca soma empenhado, liquidado e pago', () => {
  const n = actionNarrative({ scope: uf, year: 2025, emp: 1000, liq: 900, pag: 850 });
  assert.match(n.answer, /empenhou R\$ 1\.000, liquidou R\$ 900 e pagou R\$ 850/); assert.match(n.context ?? '', /nunca devem ser somados/);
});

test('narrativa de evolução: só cita séries que realmente existem para o território', () => {
  const some = evolutionNarrative({ scope: muni, hasRais: true, hasCaged: false, hasFinance: false }); assert.match(some.answer, /RAIS/); assert.doesNotMatch(some.answer, /Caged/);
  const none = evolutionNarrative({ scope: muni, hasRais: false, hasCaged: false, hasFinance: false }); assert.match(none.answer, /Nenhuma das séries/);
});
