import assert from 'node:assert/strict';
import test from 'node:test';
import type { BenchSeriesStory, EvolutionPoint, HospitalShare, ResidentSummary } from '@senadotracker/db';
import { EVOLUTION_TABS, buildEvolutionTab, buildHospitalStory, buildResidentStory, heatBand, relChange, smooth3 } from '../../apps/web/lib/health-story.ts';

const pt = (year: number, value: number | null, over: Partial<EvolutionPoint> = {}): EvolutionPoint => ({ year, periodStart: `${year}-01-01`, value, numerator: value === null ? null : value, denominator: value === null ? null : 1000, flags: 0, partial: false, ...over });
const emptyBench = (): BenchSeriesStory => ({ municipalitiesByUf: {}, brazilMunicipalities: {}, ufs: {} });

test('média móvel de 3 anos soma numeradores e denominadores e respeita o mínimo de denominador', () => {
  const pts = [pt(2020, 10, { numerator: 10, denominator: 1000 }), pt(2021, 20, { numerator: 20, denominator: 1000 }), pt(2022, 30, { numerator: 30, denominator: 1000 })];
  const s = smooth3(pts, 1000, 100);
  assert.equal(s[1]!.v, 20);                         // (10+20+30)/3000 × 1000
  assert.equal(s[1]!.raw, 20);
  assert.equal(smooth3(pts, 1000, 5000)[1]!.v, null); // denominador somado < mínimo
  assert.equal(smooth3([pt(2020, 5)], 1000, 0)[0]!.v, null); // um único ponto não é média móvel
});

test('variação relativa usa o ponto de 5 anos antes e ignora lacunas', () => {
  const r = relChange([{ year: 2019, v: 10 }, { year: 2020, v: null }, { year: 2024, v: 12 }], 5)!;
  assert.deepEqual([r.from, r.to, Math.round(r.pct)], [2019, 2024, 20]);
  assert.equal(relChange([{ year: 2024, v: 12 }], 5), null);
});

test('aba de evolução compara com a mediana do estado e do Brasil e marca anos sem população', () => {
  const series = { 'IND-SAU-05': [pt(2019, 4), pt(2021, 5), pt(2022, null, { flags: 64 }), pt(2024, 6)], 'IND-SAU-05S': [pt(2024, 3)] };
  const bench = emptyBench();
  const band = (v: number): Record<string, [number, number, number, number]> => Object.fromEntries([2019, 2021, 2024].map(y => [String(y), [78, v - 1, v, v + 1]]));
  bench.municipalitiesByUf['32'] = { 'IND-SAU-05': band(2) }; bench.brazilMunicipalities['IND-SAU-05'] = band(1.5);
  const tab = buildEvolutionTab({ spec: EVOLUTION_TABS[0]!, series, scope: 'Vitória', kind: 'municipio', ufName: 'Espírito Santo', ufCode: 32, bench });
  assert.deepEqual(tab.gapYears, [2022]);
  assert.match(tab.story, /subiu 50%/);
  assert.match(tab.story, /a mediana dos municípios de Espírito Santo/);
  assert.equal(tab.extra?.points.length, 1);
  assert.ok(tab.chips.some(c => /Entre municípios/.test(c.label)));
});

test('hospitais: concentração, parcela e índice de polo regional', () => {
  const h = (cnes: number, aih: number): HospitalShare => ({ cnes, name: `Hosp ${cnes}`, typeLabel: 'HOSPITAL GERAL', sus: true, aih, valueCents: 0, days: aih * 5, deaths: Math.round(aih * 0.04), icsap: 0, bedsExisting: 100, bedsSus: 60 });
  const s = buildHospitalStory({ hs: { hospitals: [h(1, 600), h(2, 300), h(3, 100)], hospitalsTotalAih: 1000, residentsAih: 500 }, scope: 'Vitória', kind: 'municipio' })!;
  assert.equal(s.poloWord, 'polo'); assert.equal(Math.round(s.ratio! * 10), 20);
  assert.equal(Math.round(s.top3Share * 100), 100); assert.equal(s.rows[0]!.stay, 5);
  assert.equal(s.rows[2]!.lethality, 4);              // 100 internações: letalidade aparece
  const parteFora = buildHospitalStory({ hs: { hospitals: [h(1, 100)], hospitalsTotalAih: 100, residentsAih: 500 }, scope: 'X', kind: 'municipio' })!;
  assert.equal(parteFora.poloWord, 'parte-fora');
  assert.equal(buildHospitalStory({ hs: { hospitals: [], hospitalsTotalAih: 0, residentsAih: 0 }, scope: 'X', kind: 'uf' }), null);
});

test('residentes: janela de 12 meses, calendário por índice e fallback para município pequeno', () => {
  const months = Array.from({ length: 24 }, (_, i) => { const c = (2024 + Math.floor(i / 12)) * 100 + (i % 12) + 1; return { competence: c, aih: 100, icsap: 10, outside: 20, valueCents: 100000, days: 500, deaths: 3 }; });
  const summary: ResidentSummary = { months, population: { '2024': 10000, '2025': 10000 } };
  const s = buildResidentStory({ summary, scope: 'X', kind: 'municipio', ufName: 'UF', ufCode: 32, bench: emptyBench() })!;
  assert.equal(s.window.aih, 1200); assert.equal(Math.round(s.window.inMun!), 80); assert.equal(s.window.stay, 5); assert.equal(s.window.rate, 120);
  assert.equal(s.heatOk, true); assert.equal(s.heat.length, 2); assert.equal(s.heat[0]![0]!.index, 100);
  const small = buildResidentStory({ summary: { months: months.map(m => ({ ...m, aih: 3 })), population: {} }, scope: 'Y', kind: 'municipio', ufName: 'UF', ufCode: 32, bench: emptyBench() })!;
  assert.equal(small.heatOk, false); assert.equal(small.window.rate, null);
  assert.equal(buildResidentStory({ summary: { months: [], population: {} }, scope: 'Z', kind: 'uf', ufName: 'UF', ufCode: 32, bench: emptyBench() }), null);
});

test('faixas do calendário', () => {
  assert.deepEqual([null, 10, 70, 100, 120, 300].map(heatBand), [-1, 0, 1, 2, 3, 4]);
});
