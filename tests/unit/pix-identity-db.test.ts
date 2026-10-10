import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import type { Profile } from '../../packages/domain/src/index.ts';
import { ensureBudgetSchema } from '../../packages/db/src/postgres-budget.ts';
import { deriveChamberExercises, persistCrosswalk, persistHistoricalRoster, persistIdentityCandidates, planIdentity, type HistoricalPerson } from '../../apps/collector/src/postgres-pix-identity.ts';

/** Identidade: roster sintético → pessoa/mandato → crosswalk, tudo em transação revertida (sem tocar nos dados reais). */
const hasDb = process.env.DB_NAME === 'projetoeleitor_db' && Boolean(process.env.DB_PASSWORD);
const skip = !hasDb && 'requer o PostgreSQL local (DB_*)';
const pool = hasDb ? new pg.Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, max: 2 }) : null!;
test.after(async () => { await pool?.end(); });
if (hasDb) await ensureBudgetSchema(pool);

async function inTx<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { await client.query('BEGIN'); return await work(client); } finally { await client.query('ROLLBACK'); client.release(); }
}
async function rawObject(client: pg.PoolClient) {
  await client.query(`INSERT INTO civica.ingestion_runs(id,source,started_at,status,parser_version,roster_complete) VALUES('pix-test-raw-run','camara',now()::text,'running','t',0)`);
  await client.query(`INSERT INTO civica.raw_objects(id,run_id,url,fetched_at,status,content_type,sha256,path,bytes) VALUES('pix-test-raw','pix-test-raw-run','https://x',now()::text,200,'application/json','00','/dev/null',0)`);
  return 'pix-test-raw';
}
function person(house: 'camara' | 'senado', externalId: string, name: string, civil: string, uf: string, exercises: Array<[string, string | null]>, rawId: string): HistoricalPerson {
  const mandateKey = house === 'camara' ? 'legislatura:57' : 'm1';
  const profile: Profile = { source: house, externalId, name, fullName: civil, uf, party: 'TST', photoUrl: null, officialUrl: 'https://x', observedAt: '2026-10-06T00:00:00Z', rawId, historyAvailability: 'available',
    mandates: exercises.length ? [{ key: mandateKey, officialId: null, legislature: '57', uf, role: 'Titular', titularId: null, start: exercises[0]![0], end: exercises.at(-1)![1], rawId }] : [],
    exercises: exercises.map(([start, end], i) => ({ key: `${externalId}:e${i}`, mandateKey, start, end, endReason: end ? 'reported' : 'not_reported', precision: 'date', basis: 'official', state: 'Exercício', cause: null, rawId })), parties: [], events: [] } as Profile;
  return { house, externalId, profile, names: [name, civil], civilName: civil };
}
const input = (authorCode: string, name: string, years: number[], uf = 'PB') => ({ authorCode, names: [name], years, ufs: [uf] });

test('roster histórico + crosswalk: troca de Casa gera dois códigos, EXACT revisado, HIGH não, sem pessoa para o não resolvido; idempotente', { skip }, () => inTx(async client => {
  const raw = await rawObject(client);
  const people = [
    person('camara', 'pixt-c1', 'Pixt Efraim', 'PIXT EFRAIM DE TESTE FILHO', 'PB', [['2019-02-01', '2023-01-31']], raw),
    person('senado', 'pixt-s1', 'Pixt Efraim', 'Pixt Efraim de Teste Filho', 'PB', [['2023-02-01', null]], raw),
    person('camara', 'pixt-c2', 'Pixt Suplente', 'PIXT SUPLENTE DA SILVA', 'BA', [['2021-03-01', null]], raw),
    person('camara', 'pixt-c3', 'Pixt Bacelar', 'PIXT BACELAR FILHO', 'BA', [], raw),
  ];
  const inputs = [input('7801', 'Pixt Efraim', [2020, 2021, 2022, 2023]), input('7802', 'Pixt Efraim', [2024, 2025]), input('7803', 'Pixt Suplente', [2021], 'BA'), input('7804', 'Pixt Bacelar', [2020, 2021], 'BA'), input('7805', 'Ninguém Conhecido', [2024])];
  const plan = planIdentity(inputs, people);
  assert.deepEqual(plan.summary, { EXACT: 2, HIGH: 1, CONFLICT: 1, UNMATCHED: 1 });
  assert.equal(plan.crossHouse.length, 1);

  const first = await persistHistoricalRoster(client, people, plan.persistKeys);
  assert.equal(first.created, 3, 'Efraim (Câmara), Efraim (Senado) e Suplente; Bacelar sem exercício não é persistido'); assert.equal(first.people, 3);
  const links = await persistIdentityCandidates(client, plan.crossHouse, people, first.personIdByRecord); assert.equal(links, 1);
  const walk = await persistCrosswalk(client, plan, people, first.personIdByRecord);
  assert.deepEqual(walk, { exact: 2, high: 1, unresolved: 2 });

  const rows = Object.fromEntries((await client.query(`SELECT author_code, person_id, house, confidence, reviewed, mandate_key FROM civica_budget.author_code_crosswalk WHERE author_code IN ('7801','7802','7803','7804','7805')`)).rows.map(r => [r.author_code, r]));
  assert.equal(rows['7801'].house, 'camara'); assert.equal(rows['7802'].house, 'senado'); assert.notEqual(rows['7801'].person_id, rows['7802'].person_id, 'mesma pessoa civil, dois person_ids até a revisão do link');
  assert.equal(rows['7801'].reviewed, true); assert.equal(rows['7801'].confidence, 'EXACT'); assert.equal(rows['7801'].mandate_key, 'legislatura:57');
  assert.equal(rows['7803'].confidence, 'HIGH'); assert.equal(rows['7803'].reviewed, false, 'HIGH nasce não revisado');
  assert.equal(rows['7804'].person_id, null); assert.equal(rows['7804'].reviewed, false);
  assert.equal(rows['7805'].person_id, null); assert.equal(rows['7805'].confidence, 'UNMATCHED');

  const link = (await client.query(`SELECT status, evidence FROM civica.identity_links WHERE id='pix-identity:camara:pixt-c1:senado:pixt-s1'`)).rows[0];
  assert.equal(link.status, 'candidate'); assert.equal(link.evidence.method, 'civil_name_exact'); assert.equal(link.evidence.camara.externalId, 'pixt-c1'); assert.ok(link.evidence.senado.exercises.length);

  // reexecução: nada duplica, pessoas reutilizadas, revisão humana preservada
  await client.query(`UPDATE civica.identity_links SET status='confirmed' WHERE id='pix-identity:camara:pixt-c1:senado:pixt-s1'`);
  await client.query(`UPDATE civica_budget.author_code_crosswalk SET reviewed=true, reviewed_at=now(), review_source='human' WHERE author_code='7803'`);
  const second = await persistHistoricalRoster(client, people, plan.persistKeys);
  assert.equal(second.created, 0); assert.equal(second.reused, 3); assert.deepEqual([...second.personIdByRecord.entries()].sort(), [...first.personIdByRecord.entries()].sort());
  await persistIdentityCandidates(client, plan.crossHouse, people, second.personIdByRecord); await persistCrosswalk(client, plan, people, second.personIdByRecord);
  assert.equal((await client.query(`SELECT status FROM civica.identity_links WHERE id='pix-identity:camara:pixt-c1:senado:pixt-s1'`)).rows[0].status, 'confirmed', 'candidato reexecutado não rebaixa status revisado');
  assert.equal((await client.query(`SELECT reviewed FROM civica_budget.author_code_crosswalk WHERE author_code='7803'`)).rows[0].reviewed, true, 'revisão humana sobrevive à recarga');
  assert.equal(Number((await client.query(`SELECT count(*) n FROM civica_budget.author_code_crosswalk WHERE author_code IN ('7801','7802','7803','7804','7805')`)).rows[0].n), 5);
  assert.equal(Number((await client.query(`SELECT count(*) n FROM civica.profiles WHERE external_id LIKE 'pixt-%'`)).rows[0].n), 3);
}));

test('o lote histórico nunca é publicado como ativo (telas atuais seguem vendo só o roster ativo)', { skip }, () => inTx(async client => {
  const raw = await rawObject(client);
  const people = [person('camara', 'pixt-c9', 'Pixt Nove', 'PIXT NOVE DA SILVA', 'SP', [['2023-02-01', null]], raw)];
  const plan = planIdentity([input('7809', 'Pixt Nove', [2024], 'SP')], people);
  await persistHistoricalRoster(client, people, plan.persistKeys);
  assert.equal(Number((await client.query(`SELECT count(*) n FROM civica.active_publications WHERE batch_id LIKE 'pg:roster-historical:%'`)).rows[0].n), 0);
  const visible = Number((await client.query(`SELECT count(*) n FROM civica.profiles p JOIN civica.active_publications a ON a.batch_id=p.batch_id WHERE p.external_id='pixt-c9'`)).rows[0].n);
  assert.equal(visible, 0);
}));

test('exercício da Câmara: eventos simultâneos de mesma situação não criam lacuna; licença e fim de mandato fecham', () => {
  const e = (at: string, state: string | null, legislature = '56') => ({ legislature, at, state });
  const out = deriveChamberExercises([
    e('2019-03-28T11:51', 'Exercício'), e('2019-06-11T15:10', 'Licença'), e('2019-10-22T18:45', 'Exercício'),
    e('2020-07-08T09:49', 'Exercício'), e('2020-07-08T09:49', 'Exercício'), // posse + efetivação no mesmo instante
    e('2023-01-31T23:59', 'FIM_MANDATO'), e('2023-02-01T00:00', null),
    e('2023-02-01T12:05', 'Exercício', '57'),
  ], 'raw', '188097');
  assert.deepEqual(out.map(x => [x.start, x.end, x.mandateKey]), [['2019-03-28', '2019-06-11', 'legislatura:56'], ['2019-10-22', '2023-01-31', 'legislatura:56'], ['2023-02-01', null, 'legislatura:57']]);
});

test('revisão humana positiva sobrevive a nova execução mesmo que a resolução automática piore; CONFLICT não atribui', { skip }, () => inTx(async client => {
  const raw = await rawObject(client);
  const people = [person('camara', 'pixt-c20', 'Pixt Revisado', 'PIXT REVISADO DA SILVA', 'SP', [['2021-03-01', null]], raw)];
  const first = planIdentity([input('7820', 'Pixt Revisado', [2021], 'SP')], people); // HIGH: exercício só no ano
  const persisted = await persistHistoricalRoster(client, people, first.persistKeys);
  await persistCrosswalk(client, first, people, persisted.personIdByRecord);
  const row = async () => (await client.query(`SELECT person_id, confidence, reviewed, review_source FROM civica_budget.author_code_crosswalk WHERE author_code='7820'`)).rows[0];
  assert.equal((await row()).reviewed, false);
  await client.query(`UPDATE civica_budget.author_code_crosswalk SET reviewed=true, reviewed_at=now(), review_source='human' WHERE author_code='7820'`);
  const before = await row();
  // nova coleta em que o histórico da Câmara veio vazio (sem exercício): a resolução vira CONFLICT, mas a linha revisada não é tocada
  const degraded = [{ ...people[0]!, profile: { ...people[0]!.profile, exercises: [], historyAvailability: 'unavailable' as const } }];
  const second = planIdentity([input('7820', 'Pixt Revisado', [2021], 'SP')], degraded);
  assert.equal(second.resolutions[0]!.resolution.cls, 'CONFLICT');
  await persistCrosswalk(client, second, degraded, persisted.personIdByRecord);
  assert.deepEqual(await row(), before);
  assert.equal((await row()).confidence, 'HIGH'); assert.equal((await row()).review_source, 'human');
}));
