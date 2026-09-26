import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { commissionMeetingMoment, publishedCommissionDirectory, publishedCommissionOverview } from '../../packages/db/src/commissions.ts';

const now = new Date('2026-09-26T12:00:00Z');
test('official local time uses Brasilia and a strict future boundary', () => {
  assert.equal(commissionMeetingMoment('2026-09-26', '2026-09-26T09:00:00.000', now).future, false);
  assert.equal(commissionMeetingMoment('2026-09-26', '2026-09-26T09:00:01.000', now).future, true);
  assert.equal(commissionMeetingMoment('2026-09-26', '2026-09-26T12:00:00Z', now).future, false);
  assert.equal(commissionMeetingMoment('2026-09-02', '2026-09-02T14:00:00', now).future, false);
});
function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE legislative_bodies(id TEXT,source TEXT,external_id TEXT,sigla TEXT,name TEXT,house TEXT);
    CREATE TABLE commission_meetings(id TEXT,scheduled_date TEXT,scheduled_start_at TEXT,title TEXT,description TEXT);
    CREATE TABLE commission_meeting_bodies(body_id TEXT,meeting_id TEXT);
    CREATE TABLE commission_membership_snapshots(body_id TEXT,person_external_id TEXT,active INTEGER);
    CREATE TABLE commission_agenda_items(meeting_id TEXT,proposal_id TEXT,active INTEGER);
    CREATE TABLE legislative_appointments(source TEXT,kind TEXT,payload TEXT);
    INSERT INTO legislative_bodies VALUES ('s','senado','1','CMA','Comissão de Meio Ambiente','SENADO'),('c','camara','1','CCJC','Comissão de Constituição','CAMARA');
    INSERT INTO commission_meetings VALUES ('past','2026-09-26','2026-09-26T08:00:00','Past',NULL),('future','2026-09-26','2026-09-26T10:00:00','Future',NULL);
    INSERT INTO commission_meeting_bodies VALUES ('s','past'),('s','future'),('c','future');
    INSERT INTO commission_membership_snapshots VALUES ('c','1',1);
    INSERT INTO legislative_appointments VALUES ('camara','rapporteurship','{"bodyId":"1","proposalId":"p1"}');
  `);
  return db;
}
test('overview changes title mode after exact start and deduplicates joint meetings', () => {
  const db = fixture();
  try {
    const future = publishedCommissionOverview(db, 3, now);
    assert.equal(future.future, true);
    assert.deepEqual(future.items.map(m => m.id), ['future']);
    const past = publishedCommissionOverview(db, 3, new Date('2026-09-26T13:00:00Z'));
    assert.equal(past.future, false);
    assert.deepEqual(past.items.map(m => m.id), ['future', 'past']);
  } finally { db.close(); }
});
test('counts share eligibility, accents normalize and source identities remain separate', () => {
  const db = fixture();
  try {
    const all = publishedCommissionDirectory(db, {}, now);
    assert.deepEqual(all.counts, { total: 2, CAMARA: 1, SENADO: 1, CONGRESSO: 0 });
    assert.equal(all.grouped, true);
    assert.equal(all.items.length, 2);
    const found = publishedCommissionDirectory(db, { query: 'constituicao' }, now);
    assert.deepEqual(found.counts, all.counts);
    assert.equal(found.total, 1);
    assert.equal(found.items[0]?.body.sigla, 'CCJC');
    assert.equal(publishedCommissionDirectory(db, { house: 'SENADO', query: 'CCJC' }, now).total, 0);
    assert.equal(all.items.find(i => i.body.id === 's')?.metadata.some(m => m.label === 'Relatorias identificadas'), false);
  } finally { db.close(); }
});
test('date-only meetings preserve civil day at the UTC day boundary', () => {
  const midnight = new Date('2026-09-27T01:00:00Z');
  assert.equal(commissionMeetingMoment('2026-09-26', null, midnight).future, false);
  assert.equal(commissionMeetingMoment('2026-09-27', null, midnight).future, true);
  assert.equal(commissionMeetingMoment(null, null, midnight).order, 0);
});
