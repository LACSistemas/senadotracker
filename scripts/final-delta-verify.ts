import { createHash } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';

const sqlitePath = process.env.SENADOTRACKER_DB_PATH ?? 'data/senadotracker.sqlite';
const required = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'] as const;
for (const key of required) if (!process.env[key]) throw new Error(`${key} not configured`);

const sqlite = new DatabaseSync(sqlitePath, { readOnly: true });
const pool = new pg.Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, max: 2 });

type Domain = { name: string; sqlite: string; postgres: string; identity: string[]; sqliteParams?: unknown[]; postgresParams?: unknown[] };
const domains: Domain[] = [
  { name: 'P1 proposals', identity: ['source','external_id'], sqlite: `SELECT p.source,p.batch_id,p.external_id,p.payload FROM proposals p JOIN active_activity_publications a ON a.batch_id=p.batch_id ORDER BY p.source,p.external_id`, postgres: `SELECT p.source,p.batch_id,p.external_id,p.payload::text payload FROM civica_poc.proposals p JOIN civica_poc.active_publications a ON a.source=p.source AND a.batch_id=p.batch_id ORDER BY p.source,p.external_id` },
  { name: 'P2 profiles', identity: ['person_id','external_id'], sqlite: `SELECT p.batch_id,p.person_id,p.external_id,p.payload FROM profiles p JOIN active_publications a ON a.batch_id=p.batch_id ORDER BY p.person_id,p.external_id`, postgres: `SELECT p.batch_id,p.person_id,p.external_id,p.payload::text payload FROM civica.profiles p JOIN civica.active_publications a ON a.batch_id=p.batch_id ORDER BY p.person_id,p.external_id` },
  { name: 'P3 deliberations', identity: ['source','external_id'], sqlite: `SELECT d.batch_id,d.source,d.external_id,d.payload FROM deliberations d JOIN active_legislative_publications a ON a.batch_id=d.batch_id ORDER BY d.source,d.external_id`, postgres: `SELECT d.batch_id,d.source,d.external_id,d.payload::text payload FROM civica.deliberations d JOIN civica.active_legislative_publications a ON a.batch_id=d.batch_id ORDER BY d.source,d.external_id` },
  { name: 'P4 votes', identity: ['source','deliberation_id','external_id'], sqlite: `SELECT v.batch_id,v.source,v.deliberation_id,v.external_id,v.payload FROM legislative_votes v JOIN active_legislative_publications a ON a.batch_id=v.batch_id ORDER BY v.source,v.deliberation_id,v.external_id`, postgres: `SELECT v.batch_id,v.source,v.deliberation_id,v.external_id,v.payload::text payload FROM civica.legislative_votes v JOIN civica.active_legislative_publications a ON a.batch_id=v.batch_id ORDER BY v.source,v.deliberation_id,v.external_id` },
  { name: 'P5 expenses', identity: ['source','external_id','year','month'], sqlite: `SELECT e.batch_id,e.source,e.external_id,e.year,e.month,e.net_cents,e.refund_cents FROM expenses e JOIN active_expense_publications a ON a.source=e.source AND a.year=e.year AND a.batch_id=e.batch_id ORDER BY e.source,e.external_id,e.year,e.month`, postgres: `SELECT e.batch_id,e.source,e.external_id,e.year,e.month,e.net_cents,e.refund_cents FROM civica.expenses e JOIN civica.active_expense_publications a ON a.source=e.source AND a.year=e.year AND a.batch_id=e.batch_id ORDER BY e.source,e.external_id,e.year,e.month` },
  { name: 'P6 candidacies', identity: ['sequence_id','person_id','year'], sqlite: `SELECT c.batch_id,c.sequence_id,c.person_id,c.year,c.uf,c.office,c.payload FROM candidacies c JOIN active_electoral_publications a ON a.batch_id=c.batch_id ORDER BY c.sequence_id`, postgres: `SELECT c.batch_id,c.sequence_id,c.person_id,c.year,c.uf,c.office,c.payload::text payload FROM civica.candidacies c JOIN civica.active_electoral_publications a ON a.batch_id=c.batch_id ORDER BY c.sequence_id` },
];

const normalize = (value: unknown): unknown => {
  if (typeof value === 'string') {
    const text = value.trim();
    if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) try { return normalize(JSON.parse(text)); } catch { /* scalar text */ }
    return value;
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, normalize(item)]));
  return value === null ? null : typeof value === 'number' ? value : value === undefined ? null : String(value);
};
const canonical = (row: Record<string, unknown>, identityOnly = false) => JSON.stringify(normalize(Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'batch_id' && (!identityOnly || !['payload','net_cents','refund_cents'].includes(key))))));
const digestRows = (rows: Record<string, unknown>[], identityOnly = false) => { const hash = createHash('sha256'); for (const value of rows.map(row => canonical(row, identityOnly)).sort()) hash.update(value + '\n'); return hash.digest('hex'); };

const result: Record<string, unknown> = { generatedAt: new Date().toISOString(), currentDatabase: (await pool.query('SELECT current_database() database')).rows[0].database, domains: {} };
for (const domain of domains) {
  const sqliteRows = sqlite.prepare(domain.sqlite).all() as Record<string, unknown>[];
  const pgRows = (await pool.query(domain.postgres, domain.postgresParams ?? [])).rows as Record<string, unknown>[];
  const sqliteHash = digestRows(sqliteRows);
  const postgresHash = digestRows(pgRows);
  const identityKey = (row: Record<string, unknown>) => JSON.stringify(domain.identity.map(key => row[key] === null || row[key] === undefined ? null : String(row[key])));
  const sqliteIdentity = new Map<string, number>(); const postgresIdentity = new Map<string, number>();
  for (const row of sqliteRows) sqliteIdentity.set(identityKey(row), (sqliteIdentity.get(identityKey(row)) ?? 0) + 1);
  for (const row of pgRows) postgresIdentity.set(identityKey(row), (postgresIdentity.get(identityKey(row)) ?? 0) + 1);
  const identityDiff = [...new Set([...sqliteIdentity.keys(), ...postgresIdentity.keys()])].filter(key => (sqliteIdentity.get(key) ?? 0) !== (postgresIdentity.get(key) ?? 0));
  const status = sqliteRows.length === pgRows.length && identityDiff.length === 0 ? 'PASS' : 'MISMATCH';
  (result.domains as Record<string, unknown>)[domain.name] = { sqliteCount: sqliteRows.length, postgresCount: pgRows.length, identityDiffCount: identityDiff.length, identityDiff: identityDiff.slice(0, 10), sqlitePayloadHash: sqliteHash, postgresPayloadHash: postgresHash, payloadComparison: sqliteHash === postgresHash ? 'MATCH' : 'EXPECTED_STRUCTURAL_DIFFERENCE', status };
  if (status !== 'PASS') throw new Error(`${domain.name} delta mismatch: SQLite ${sqliteRows.length}, PostgreSQL ${pgRows.length}, identity diff ${identityDiff.length}`);
}
result.status = 'PASS';
console.log(JSON.stringify(result, null, 2));
await pool.end();
sqlite.close();
