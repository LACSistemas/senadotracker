import assert from 'node:assert/strict';
import test from 'node:test';
import { computeStateNumbers } from '../../apps/web/lib/state-numbers-compute.ts';

const month = (m: string, cents: number, n: number) => ({ month: m, cents, n });
const house = (h: string, deputies: number, extra: Record<string, unknown> = {}) => ({ house: h, deputies, proposals: 1000, proposalsYear: 2026, parties: [], finance: null, ...extra }) as never;
const sub = (h: string, cents = 3_477_464, from = '2025-02-01', to: string | null = null, position = 'STATE_DEPUTY') => ({ house: h, position, cents, from, to });

test('custo = subsídio × parlamentares + cotas do mês comum; sem gabinete; mesmo universo na média', () => {
  const input = {
    houses: [
      house('AA', 10, { finance: { reliable: true, monthly: [month('2026-07', 1_000_000, 8), month('2026-08', 2_000_000, 9)] } }),
      house('BB', 20, { finance: { reliable: true, monthly: [month('2026-07', 4_000_000, 30), month('2026-08', 6_000_000, 25)] } }),
      house('CC', 30, { finance: { reliable: true, monthly: [month('2026-07', 9_000_000, 40)] } }),
    ],
    subsidies: [sub('AA'), sub('BB'), sub('CC')], legislativeOperational: ['AA', 'BB', 'CC'], canonicalPartyCount: 7,
  };
  const r = computeStateNumbers(input);
  // 70% de 3 Casas = 3: só julho tem as 3; agosto tem 2 (CC não publicou)
  assert.equal(r.cost?.month, '2026-07');
  assert.deepEqual(r.cost?.houses, ['AA', 'BB', 'CC']);
  assert.equal(r.cost?.deputies, 60);
  assert.equal(r.cost?.totalCents, (1_000_000 + 4_000_000 + 9_000_000) + 3_477_464 * 60);
  assert.equal(r.cost?.meanCents, Math.round(r.cost!.totalCents / 60));
  assert.equal(r.parties, 7);
});

test('Casa com saldos misturados a despesas e Casa com poucos lançamentos ficam fora, com motivo', () => {
  const input = {
    houses: [
      house('AA', 10, { finance: { reliable: true, monthly: [month('2026-08', 1_000_000, 9)] } }),
      house('BB', 10, { finance: { reliable: false, monthly: [month('2026-08', 900_000_000, 50)] } }),
      house('CC', 10, { finance: { reliable: true, monthly: [month('2026-08', 5_000, 2)] } }),
      house('DD', 10, { finance: { reliable: true, monthly: [month('2026-08', 3_000_000, 10)] } }),
      house('EE', 10, { finance: { reliable: true, monthly: [month('2026-08', 2_000_000, 8)] } }),
      house('FF', 10, { finance: { reliable: true, monthly: [month('2026-08', 2_500_000, 9)] } }),
    ],
    subsidies: [sub('AA'), sub('BB'), sub('CC'), sub('DD'), sub('EE'), sub('FF')], legislativeOperational: [], canonicalPartyCount: 0,
  };
  const r = computeStateNumbers(input);
  assert.deepEqual(r.cost?.houses, ['AA', 'DD', 'EE', 'FF'], '4 de 5 Casas confiáveis (70% = 4) atendem ao volume mínimo');
  assert.ok(r.cost?.excluded.some(item => item.house === 'BB' && /saldos/.test(item.reason)));
  assert.ok(r.cost?.excluded.some(item => item.house === 'CC' && /sem lançamentos suficientes/.test(item.reason)));
  assert.equal(r.cost!.totalCents, (1_000_000 + 3_000_000 + 2_000_000 + 2_500_000) + 3_477_464 * 40, 'o saldo de BB (R$ 9 mi) não entra na soma');
});

test('subsídio vigente no mês: troca de tabela e referência judicial não entram', () => {
  const input = {
    houses: [house('AA', 10, { finance: { reliable: true, monthly: [month('2026-08', 0, 10)] } })],
    subsidies: [sub('AA', 3_000_000, '2025-02-01', '2026-01-31'), sub('AA', 3_500_000, '2026-02-01'), sub('AA', 2_500_000, '2025-11-29', null, 'STATE_DEPUTY_JUDICIAL_REFERENCE')], legislativeOperational: [], canonicalPartyCount: 0,
  };
  assert.equal(computeStateNumbers(input).cost?.totalCents, 3_500_000 * 10);
  const sem = computeStateNumbers({ ...input, subsidies: [] });
  assert.equal(sem.cost, null, 'sem subsídio vigente nenhuma Casa é incluída');
});

test('proposições por Assembleia: só Casas operacionais com volume mínimo; média sobre essas Casas', () => {
  const input = {
    houses: [house('AA', 10, { proposals: 9000 }), house('BB', 10, { proposals: 3000 }), house('CC', 10, { proposals: 10 }), house('DD', 10, { proposals: 5000 })],
    subsidies: [], legislativeOperational: ['AA', 'BB', 'CC'], canonicalPartyCount: 0,
  };
  const r = computeStateNumbers(input);
  assert.deepEqual(r.proposals, { year: 2026, total: 12000, houses: 2, perHouse: 6000 }, 'CC tem 10 (bloqueada) e DD não é operacional');
  assert.equal(r.deputies, 40);
});

test('deputados: total e distritais; sem Casas devolve zeros sem quebrar', () => {
  const r = computeStateNumbers({ houses: [house('DF', 24), house('MG', 77)], subsidies: [], legislativeOperational: [], canonicalPartyCount: 2 });
  assert.deepEqual([r.deputies, r.districtDeputies, r.houses], [101, 24, 2]);
  assert.equal(r.cost, null);
  assert.equal(computeStateNumbers({ houses: [], subsidies: [], legislativeOperational: [], canonicalPartyCount: 0 }).deputies, 0);
});
