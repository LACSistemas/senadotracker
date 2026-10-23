import assert from 'node:assert/strict';
import test from 'node:test';
import { buildQuotaExplorer, prettyCategory, type ExpenseLike } from '../../apps/web/lib/quota-explorer.ts';

const row = (month: number, category: string, netCents: number, refundCents = 0, year = 2026): ExpenseLike => ({ year, month, category, supplier: 'F', documentUrl: null, issuedAt: null, netCents, refundCents });

test('mês sem registro é null (não zero); mês com registro soma líquido menos reembolso', () => {
  const data = buildQuotaExplorer([row(1, 'A', 1000, 200), row(1, 'B', 500), row(3, 'A', 300)]);
  const months = data.years[0]!.months;
  assert.equal(months[1], null);
  assert.equal(months[0]!.cents, 1300);
  assert.equal(months[0]!.records, 2);
  assert.equal(data.years[0]!.totalCents, 1600);
});

test('categorias ordenadas por valor, só positivas; anos do mais novo ao mais antigo', () => {
  const data = buildQuotaExplorer([row(1, 'Pequena', 100), row(1, 'Grande', 900), row(2, 'Zerada', 100, 100), row(1, 'X', 10, 0, 2025)]);
  assert.deepEqual(data.years.map(y => y.year), [2026, 2025]);
  assert.deepEqual(data.years[0]!.categories.map(c => c.label), ['Grande', 'Pequena']);
});

test('prettyCategory só muda a apresentação de CAIXA ALTA', () => {
  assert.equal(prettyCategory('TELEFONIA.'), 'Telefonia');
  assert.equal(prettyCategory('Passagens aéreas'), 'Passagens aéreas');
});
