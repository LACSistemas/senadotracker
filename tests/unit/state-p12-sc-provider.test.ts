import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { parseCatalog, parseDetail } from '../../apps/collector/src/state/providers/alesc-elegis/index.ts';

const catalog = fs.readFileSync('artifacts/p12_sc_page1.html', 'utf8');
const detail = fs.readFileSync('artifacts/p12_sc_proposicoes_5GyY2_tramitacoes.html', 'utf8');
const raw = { rawId: 'raw:test', endpoint: 'https://example.test', fetchedAt: '2026-01-01T00:00:00.000Z', sha256: 'sha' } as any;

test('P12 SC catalog exposes stable slugs and controlled cards', () => {
  const cards = parseCatalog(catalog);
  assert.ok(cards.length >= 10);
  assert.equal(cards[0].path, '/proposicoes/5GyY2');
  assert.equal(cards[0].year, 2026);
});

test('P12 SC tramitation parser materializes timeline movements', () => {
  const card = parseCatalog(catalog)[0];
  const parsed = parseDetail(detail, card, raw);
  assert.equal(parsed.proposal.key.externalId, '5GyY2');
  assert.ok(parsed.movements.length > 0);
  assert.ok(parsed.movements.every((movement) => movement.proposal.externalId === '5GyY2'));
});
