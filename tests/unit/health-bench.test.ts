import assert from 'node:assert/strict';
import test from 'node:test';
import type { DistStat, PanelValue, VaccineValue } from '@senadotracker/db';
import { FLAG, MIN_COMPARABLE, benchFor, healthLede, quintileOf, trendOf, vaccineRows, vaccineSummary } from '../../apps/web/lib/health-bench.ts';
import { VACCINE_PRIORITY } from '../../apps/web/lib/health-targets.ts';

const stat = (over: Partial<DistStat> = {}): DistStat => ({ n: 78, p10: 1, p20: 2, p40: 4, p50: 5, p60: 6, p80: 8, p90: 9, periodStart: '2026-09-01', ...over });
const val = (over: Partial<PanelValue> = {}): PanelValue => ({ code: 'IND-SAU-05', periodStart: '2026-09-01', grain: 'M', status: 'final', value: 7, numerator: 10, denominator: 1000, flags: 0, prev: null, ...over });

test('quintil descreve a posição na distribuição pelos cortes p20/p40/p60/p80', () => {
  const s = stat();
  assert.deepEqual([0.5, 2, 4, 6, 8, 100].map(v => quintileOf(v, s)), [1, 2, 3, 4, 5, 5]);
});

test('benchmark só compara valor elegível, no mesmo período e com grupo de tamanho mínimo', () => {
  const ok = benchFor(val(), stat(), 'municípios do ES', stat({ n: 5571 }), 'Brasil');
  assert.equal(ok.kind, 'ok'); if (ok.kind === 'ok') assert.equal(ok.quintile, 4);
  for (const [v, g, why] of [
    [val({ value: null }), stat(), /Sem registro/],
    [val({ flags: FLAG.smallN }), stat(), /Pequeno número/],
    [val({ flags: FLAG.noDenominator }), stat(), /denominador/],
    [val(), stat({ n: MIN_COMPARABLE - 1 }), /Menos de/],
    [val(), stat({ periodStart: '2025-09-01' }), /Período diferente/],
    [val(), undefined, /Menos de/],
  ] as const) {
    const b = benchFor(v, g, 'grupo', stat(), 'Brasil');
    assert.equal(b.kind, 'none'); if (b.kind === 'none') { assert.match(b.reason, why); assert.ok(b.ref, 'mantém a referência nacional'); }
  }
});

test('tendência exige os dois pontos e ignora pequeno número; variação < 0,5 % é estável', () => {
  assert.equal(trendOf(val()), null);
  assert.equal(trendOf(val({ prev: { periodStart: '2025-09-01', value: 6, flags: 0 } }))?.dir, 'up');
  assert.equal(trendOf(val({ value: 5, prev: { periodStart: '2025-09-01', value: 6, flags: 0 } }))?.dir, 'down');
  assert.equal(trendOf(val({ value: 6.01, prev: { periodStart: '2025-09-01', value: 6, flags: 0 } }))?.dir, 'flat');
  assert.equal(trendOf(val({ flags: FLAG.smallN, prev: { periodStart: '2025-09-01', value: 6, flags: 0 } })), null);
});

test('vacinas: metas do PNI, acima de 100 % conta como na meta e ausente fica fora da contagem', () => {
  const v = (slug: string, value: number | null, flags = 0): VaccineValue => ({ slug, label: slug, year: 2025, value, numerator: null, denominator: null, flags, status: 'final' });
  const rows = vaccineRows([v('bcg', 90.0), v('varicela', 94.99), v('poliomielite', 103, FLAG.above100), v('penta_dtp_hepb_hib', null)]);
  const by = Object.fromEntries(rows.map(r => [r.slug, r.status]));
  assert.equal(rows.length, VACCINE_PRIORITY.length);
  assert.deepEqual([by.bcg, by.varicela, by.poliomielite, by.penta_dtp_hepb_hib, by.bcg === 'met' && by.hepatite_a_infantil], ['met', 'below', 'met', 'none', 'none']);
  const s = vaccineSummary(rows);
  assert.deepEqual([s.met, s.below, s.withData, s.total, s.year], [2, 1, 3, 8, 2025]);
});

test('lede usa só fatos comparativos e cita vacinas abaixo da meta', () => {
  const b = benchFor(val({ value: 20 }), stat(), 'municípios do ES', undefined, 'Brasil');
  const text = healthLede({ scope: 'Vitória', groupLabel: 'municípios do ES', cards: [{ title: 'Leitos por mil habitantes', bench: b, value: 20 }], vaccines: vaccineRows([{ slug: 'bcg', label: 'BCG', year: 2025, value: 80, numerator: null, denominator: null, flags: 0, status: 'final' }]) });
  assert.match(text ?? '', /faixa mais alta entre 78 municípios do ES/);
  assert.match(text ?? '', /1 de 1 vacinas prioritárias estão abaixo da meta/);
  assert.equal(healthLede({ scope: 'X', groupLabel: 'g', cards: [], vaccines: vaccineRows([]) }), null);
});
