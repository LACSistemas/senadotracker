import pg from 'pg';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { openDatabase, publishedParticipationRows } from '@senadotracker/db';

type AnyRow = Record<string, any>;
const env = Object.fromEntries((await readFile('.env', 'utf8')).split(/\r?\n/).filter(line => line.includes('=')).map(line => {
  const i = line.indexOf('='); return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
}));
for (const key of ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_SCHEMA']) if (env[key]) process.env[key] = env[key];
const { participation: pgParticipation } = await import('../apps/web/lib/data-postgres-wave4.ts');
const pool = new pg.Pool({ host: env.DB_HOST, port: Number(env.DB_PORT), database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD });
const sqlite = openDatabase('data/senadotracker.sqlite', true);
const source = 'senado';
const year = 2026;
const sqliteIds = (sqlite.prepare("SELECT p.external_id FROM profiles p JOIN active_publications a ON a.batch_id=p.batch_id WHERE a.source='senado' ORDER BY p.external_id").all() as AnyRow[]).map(row => String(row.external_id));
const pgIds = (await pool.query("SELECT p.external_id::text id FROM civica.profiles p JOIN civica.active_publications a ON a.source='senado' AND a.batch_id=p.batch_id ORDER BY p.external_id")).rows.map(row => String(row.id));
const baseline = publishedParticipationRows(sqlite, source, year, sqliteIds) as Record<string, AnyRow>;
const candidate = await pgParticipation(source, year, pgIds);
const metric = (value: AnyRow | undefined) => ({
  availability: value?.availability ?? 'unavailable',
  numerator: value?.numerator ?? null,
  denominator: value?.denominator ?? null,
  ratio: value?.numerator != null && value?.denominator ? value.numerator / value.denominator : null,
});
const sqliteMap = new Map(Object.entries(baseline).map(([id, value]) => [String(id), { presence: metric(value.presence), participation: metric(value.participation) }]));
const pgMap = new Map([...candidate.participation.keys()].map(id => [String(id), { presence: metric(candidate.presence.get(id)), participation: metric(candidate.participation.get(id)) }]));
const ids = [...new Set([...sqliteMap.keys(), ...pgMap.keys()])].sort();
const diffs = ids.filter(id => JSON.stringify(sqliteMap.get(id)) !== JSON.stringify(pgMap.get(id))).map(id => ({ id, sqlite: sqliteMap.get(id) ?? null, postgres: pgMap.get(id) ?? null }));
const onlySqlite = ids.filter(id => sqliteMap.has(id) && !pgMap.has(id));
const onlyPostgres = ids.filter(id => pgMap.has(id) && !sqliteMap.has(id));
const mean = (rows: Map<string, any>, key: 'presence' | 'participation') => {
  const values = [...rows.values()].map(row => row[key].ratio).filter((value): value is number => Number.isFinite(value));
  return { n: values.length, mean: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null };
};
const result = {
  stage: 'R1.5', database: env.DB_NAME, source, year,
  sqliteProfiles: sqliteIds.length, postgresProfiles: pgIds.length,
  sqliteParticipants: [...sqliteMap.values()].filter(row => row.participation.denominator != null).length,
  postgresParticipants: [...pgMap.values()].filter(row => row.participation.denominator != null).length,
  intersection: ids.filter(id => sqliteMap.has(id) && pgMap.has(id)).length,
  onlySqlite, onlyPostgres, mismatchCount: diffs.length, mismatches: diffs.slice(0, 100),
  means: { sqlitePresence: mean(sqliteMap, 'presence'), postgresPresence: mean(pgMap, 'presence'), sqliteParticipation: mean(sqliteMap, 'participation'), postgresParticipation: mean(pgMap, 'participation') },
  eventSetComparison: { status: 'NOT_MATERIALIZED', note: 'The public wrappers expose aggregate metrics; no event IDs are added to the contract artifact.' },
  status: diffs.length === 0 && onlySqlite.length === 0 && onlyPostgres.length === 0 ? 'PASS' : 'MISMATCH',
};
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/r1_5_senate_participation_reconciliation.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
sqlite.close();
await pool.end();
