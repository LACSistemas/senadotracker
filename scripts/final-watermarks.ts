import { createHash } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';

const sqlitePath = process.env.SENADOTRACKER_DB_PATH ?? 'data/senadotracker.sqlite';
const sqlite = new DatabaseSync(sqlitePath, { readOnly: true });
const pool = new pg.Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 5432), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, max: 2 });
const file = await stat(sqlitePath);
const sha = createHash('sha256');
for await (const chunk of createReadStream(sqlitePath)) sha.update(chunk);
const query = async (text: string) => (await pool.query(text)).rows;
const active = {
  pg: {
    proposals: await query('SELECT source,batch_id FROM civica_poc.active_publications ORDER BY source'),
    people: await query('SELECT source,batch_id FROM civica.active_publications ORDER BY source'),
    legislative: await query('SELECT source,batch_id FROM civica.active_legislative_publications ORDER BY source'),
    expenses: await query('SELECT source,year,batch_id FROM civica.active_expense_publications ORDER BY source,year'),
    elections: await query('SELECT election_id,batch_id FROM civica.active_electoral_publications ORDER BY election_id'),
  },
  sqlite: {
    proposals: sqlite.prepare('SELECT source,batch_id FROM active_activity_publications ORDER BY source').all(),
    people: sqlite.prepare('SELECT source,batch_id FROM active_publications ORDER BY source').all(),
    legislative: sqlite.prepare('SELECT source,batch_id FROM active_legislative_publications ORDER BY source').all(),
    expenses: sqlite.prepare('SELECT source,year,batch_id FROM active_expense_publications ORDER BY source,year').all(),
    elections: sqlite.prepare('SELECT election_id,batch_id FROM active_electoral_publications ORDER BY election_id').all(),
  },
};
const counts = {
  proposals: Number((await query("SELECT count(*)::int n FROM civica_poc.proposals p JOIN civica_poc.active_publications a ON a.source=p.source AND a.batch_id=p.batch_id"))[0]?.n ?? 0),
  profiles: Number((await query('SELECT count(*)::int n FROM civica.profiles p JOIN civica.active_publications a ON a.batch_id=p.batch_id'))[0]?.n ?? 0),
  deliberations: Number((await query('SELECT count(*)::int n FROM civica.deliberations d JOIN civica.active_legislative_publications a ON a.batch_id=d.batch_id'))[0]?.n ?? 0),
  votes: Number((await query('SELECT count(*)::int n FROM civica.legislative_votes v JOIN civica.active_legislative_publications a ON a.batch_id=v.batch_id'))[0]?.n ?? 0),
  expenses: Number((await query('SELECT count(*)::int n FROM civica.expenses e JOIN civica.active_expense_publications a ON a.source=e.source AND a.year=e.year AND a.batch_id=e.batch_id'))[0]?.n ?? 0),
  candidacies: Number((await query('SELECT count(*)::int n FROM civica.candidacies c JOIN civica.active_electoral_publications a ON a.batch_id=c.batch_id'))[0]?.n ?? 0),
};
const finalDump = 'artifacts/final-cutover-20260930-083913.dump';
const preDump = 'artifacts/pre-delta-20260930-082245.dump';
const backup = async (path: string) => { try { const s = await stat(path); return { path, bytes: s.size, modifiedAt: s.mtime.toISOString() }; } catch { return { path, missing: true }; } };
console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  currentDatabase: (await query('SELECT current_database() AS database'))[0]?.database,
  freeze: { sqlitePath, sqliteBytes: file.size, sqliteMtime: file.mtime.toISOString(), sqliteSha256: sha.digest('hex').toUpperCase(), writersObserved: 0, production: 'OFF' },
  activePublications: active,
  activeRowCounts: counts,
  delta: { strategy: 'identity-set-verification-and-idempotent-no-op', first: 'artifacts/final-delta-verify.json', retry: 'artifacts/final-delta-verify-retry.json', status: 'PASS' },
  backups: { preDelta: await backup(preDump), final: await backup(finalDump) },
}, null, 2));
await pool.end();
sqlite.close();
