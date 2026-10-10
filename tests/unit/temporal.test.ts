import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIdentifierYear, normalizeProposalNumber, presentedYearOf, brasiliaTimestamp, temporalPhrase, describeTemporalBasis } from '../../packages/domain/src/temporal.ts';
import { PostgresCollectorStore } from '../../apps/collector/src/postgres-collector.ts';

test('identifierYear: 0, nulo e lixo viram null; anos reais passam', () => {
  for (const bad of [0, '0', null, undefined, '', 'abc', NaN, 12, -1, 99999]) assert.equal(normalizeIdentifierYear(bad), null, String(bad));
  assert.equal(normalizeIdentifierYear(2026), 2026); assert.equal(normalizeIdentifierYear('2019'), 2019);
});

test('regressão do carregador: Number(null) era 0; a normalização devolve null (ano e número)', () => {
  const buggy = (v: unknown) => Number.isFinite(Number(v)) ? Number(v) : null;
  assert.equal(buggy(null), 0, 'o padrão antigo transformava null em 0');
  assert.equal(normalizeIdentifierYear(null), null); assert.equal(normalizeProposalNumber(null), null); assert.equal(normalizeProposalNumber(''), null);
  assert.equal(normalizeProposalNumber('1234'), 1234);
});

test('presentedYear usa America/Sao_Paulo: a meia-noite BRT (03:00Z) é o novo ano', () => {
  assert.equal(presentedYearOf('2026-01-01T02:59:59Z'), 2025);
  assert.equal(presentedYearOf('2026-01-01T03:00:00Z'), 2026);
  assert.equal(presentedYearOf('2026-05-28'), 2026);
  assert.equal(presentedYearOf(null), null); assert.equal(presentedYearOf('lixo'), null);
});

test('Câmara: data local sem fuso é interpretada em Brasília', () => {
  assert.equal(brasiliaTimestamp('2026-02-03T00:00'), '2026-02-03T00:00:00-03:00');
  assert.equal(brasiliaTimestamp('2026-02-03T10:25:11'), '2026-02-03T10:25:11-03:00');
  assert.equal(brasiliaTimestamp('2026-02-03'), '2026-02-03T00:00:00-03:00');
  assert.equal(brasiliaTimestamp('2026-02-03T10:00:00Z'), '2026-02-03T10:00:00Z');
  assert.equal(presentedYearOf(brasiliaTimestamp('2025-12-31T23:59')), 2025);
});

test('temporalBasis: identifier_year nunca é descrita como "apresentadas"', () => {
  assert.doesNotMatch(temporalPhrase('identifier_year', 2026), /apresentad/i);
  assert.doesNotMatch(describeTemporalBasis('identifier_year', 2026), /apresentad/i);
  assert.match(temporalPhrase('presented_at', 2026), /apresentadas em 2026/);
  assert.match(temporalPhrase('activity', 2026), /atividade/);
});

const hasDb = process.env.DB_NAME === 'projetoeleitor_db' && Boolean(process.env.DB_PASSWORD);
test('banco: a guarda impede gravar year = 0 e presented_year acompanha o fuso (transação revertida)', { skip: !hasDb && 'requer o PostgreSQL local (DB_*)' }, async () => {
  const store = new PostgresCollectorStore(); const client = await store.pool.connect();
  try {
    await client.query('BEGIN');
    const batch = (await client.query(`SELECT batch_id FROM civica_poc.active_publications WHERE source='camara'`)).rows[0].batch_id;
    const insert = (id: string, year: number | null, at: string) => client.query(`INSERT INTO civica_poc.proposals(batch_id,source,external_id,type,number,year,functional_group,label,presented_at,payload) VALUES($1,'camara',$2,'PRL',1,$3,'pareceres_relatorios','PRL 1 (teste)',$4,'{}')`, [batch, id, year, at]);
    await client.query('SAVEPOINT zero');
    await assert.rejects(insert('999800001', 0, '2026-01-01T03:00:00Z'), /proposals_identifier_year_not_zero/);
    await client.query('ROLLBACK TO SAVEPOINT zero');
    await insert('999800002', null, '2026-01-01T02:00:00Z'); await insert('999800003', null, '2026-01-01T03:00:00Z');
    const rows = (await client.query(`SELECT external_id,year,presented_year FROM civica_poc.proposals WHERE external_id IN ('999800002','999800003') ORDER BY external_id`)).rows;
    assert.deepEqual(rows.map(r => [r.year, r.presented_year]), [[null, 2025], [null, 2026]]);
  } finally { try { await client.query('ROLLBACK'); } finally { client.release(); await store.pool.end(); } }
});
