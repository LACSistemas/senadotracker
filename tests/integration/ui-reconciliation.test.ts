import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { openDatabase, publishedExpenseComparison, publishedExpenseYears, publishedHousePanorama, publishedPartyPanorama, publishedStateRepresentation } from '@senadotracker/db';
import { distribution, type Source } from '@senadotracker/domain';

const databasePath = resolve('data/senadotracker.sqlite');

test('KPIs, tabelas e distribuições da interface reconciliam com o SQLite publicado', { skip: !existsSync(databasePath) }, () => {
  const db = openDatabase(databasePath, true);
  try {
    for (const source of ['senado', 'camara'] as Source[]) {
      const year = publishedExpenseYears(db, source)[0]!;
      const panorama = publishedHousePanorama(db, source, year);
      const roster = db.prepare(`SELECT count(*) people,count(DISTINCT p.uf) states,count(DISTINCT p.party) parties FROM profiles p JOIN active_publications a ON a.batch_id=p.batch_id WHERE a.source=?`).get(source)!;
      assert.deepEqual(
        [panorama.roster.parliamentarians, panorama.roster.states, panorama.roster.parties],
        [Number(roster.people), Number(roster.states), Number(roster.parties)],
      );

      const directExpenses = db.prepare(`SELECT sum(e.net_cents-e.refund_cents) value FROM expenses e JOIN active_expense_publications x ON x.batch_id=e.batch_id JOIN active_publications a ON a.source=e.source JOIN profiles p ON p.batch_id=a.batch_id AND p.external_id=e.external_id WHERE e.source=? AND e.year=? GROUP BY p.person_id`).all(source, year).map((row) => Number(row.value));
      assert.deepEqual(panorama.expenses.distributionCents, distribution(directExpenses));

      const comparison = publishedExpenseComparison(db, source, year);
      assert.equal(comparison.items.length, directExpenses.length);
      assert.equal(comparison.items.reduce((sum, item) => sum + item.valueCents, 0), directExpenses.reduce((sum, value) => sum + value, 0));
    }

    const year = Math.max(...(['senado', 'camara'] as Source[]).flatMap((source) => publishedExpenseYears(db, source)));
    const parties = publishedPartyPanorama(db, 'all', year);
    const counts = db.prepare(`SELECT a.source,count(*) count FROM profiles p JOIN active_publications a ON a.batch_id=p.batch_id GROUP BY a.source`).all();
    const expected = Object.fromEntries(counts.map((row) => [String(row.source), Number(row.count)]));
    assert.equal(parties.rows.reduce((sum, row) => sum + row.senators, 0), expected.senado);
    assert.equal(parties.rows.reduce((sum, row) => sum + row.deputies, 0), expected.camara);

    const acre = publishedStateRepresentation(db, 'AC', year);
    assert.equal(acre.summary.representatives, acre.senators.length + acre.deputies.length);
    assert.equal(acre.coverage.sampleSize, acre.summary.representatives);
  } finally {
    db.close();
  }
});
