import pg from 'pg';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { openDatabase } from '@senadotracker/db';

type Row = Record<string, any>;
const env = Object.fromEntries((await readFile('.env', 'utf8')).split(/\r?\n/).filter(x => x.includes('=')).map(x => { const i = x.indexOf('='); return [x.slice(0, i).trim(), x.slice(i + 1).trim()]; }));
const pool = new pg.Pool({ host: env.DB_HOST, port: Number(env.DB_PORT), database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD });
const sqlite = openDatabase('data/senadotracker.sqlite', true);
const parse = (value: any) => { try { return JSON.parse(String(value ?? '{}')) as Row; } catch { return {}; } };
const natural = (x: Row) => [x.proposalId, x.personExternalId, x.bodyId, x.role, x.start, x.end, x.status].map(v => String(v ?? '')).join('|');
const baseline = (sqlite.prepare(`SELECT payload,external_id FROM legislative_appointments WHERE source='senado' AND kind='rapporteurship' AND batch_id IN (SELECT batch_id FROM active_activity_publications WHERE source='senado')`).all() as Row[]).map(x => ({ ...parse(x.payload), externalId: String(x.external_id) }));
const pgRows = (await pool.query(`SELECT payload,external_id FROM civica.legislative_appointments WHERE source='senado' AND kind='rapporteurship'`)).rows.map(x => ({ ...x.payload, externalId: String(x.external_id) }));
const group = (rows: Row[]) => { const m = new Map<string, Row[]>(); for (const x of rows) { const k = natural(x); m.set(k, [...(m.get(k) ?? []), x]); } return m; };
const bGroups = group(baseline), pGroups = group(pgRows);
const bMap = new Map([...bGroups].map(([k, v]) => [k, v[0]!])) as Map<string, Row>;
const pMap = new Map([...pGroups].map(([k, v]) => [k, v[0]!])) as Map<string, Row>;
const baselineOnly = [...bMap.keys()].filter(k => !pMap.has(k)).map(k => bMap.get(k));
const pgOnly = [...pMap.keys()].filter(k => !bMap.has(k)).map(k => pMap.get(k));
const byProposal = new Map<string, { baseline: Row[]; pg: Row[] }>();
for (const x of baseline) { const v = byProposal.get(String(x.proposalId)) ?? { baseline: [], pg: [] }; v.baseline.push(x); byProposal.set(String(x.proposalId), v); }
for (const x of pgRows) { const v = byProposal.get(String(x.proposalId)) ?? { baseline: [], pg: [] }; v.pg.push(x); byProposal.set(String(x.proposalId), v); }
const classify = (x: Row, side: 'baseline' | 'pg') => {
  const v = byProposal.get(String(x.proposalId))!;
  const other = side === 'baseline' ? v.pg : v.baseline;
  if (!other.length) return 'ONLY_' + side.toUpperCase();
  if (other.some(y => String(y.personExternalId) === String(x.personExternalId) && String(y.bodyId) === String(x.bodyId) && String(y.role) === String(x.role))) return 'SAME_NATURAL_KEY_DIFFERENT_REVISION';
  if (other.some(y => String(y.personExternalId) === String(x.personExternalId))) return 'ROLE_OR_BODY_VARIATION';
  return 'IDENTITY_OR_PROPOSAL_MISMATCH';
};
const rows = [...baselineOnly.map(x => ({ side: 'baseline', classification: classify(x, 'baseline'), row: x })), ...pgOnly.map(x => ({ side: 'pg', classification: classify(x, 'pg'), row: x }))];
const counts = Object.fromEntries([...new Set(rows.map(x => x.classification))].map(c => [c, rows.filter(x => x.classification === c).length]));
const duplicateBaseline = [...bGroups].filter(([, v]) => v.length > 1).map(([key, values]) => ({ key, count: values.length, externalIds: values.map(x => x.externalId) }));
const duplicatePostgres = [...pGroups].filter(([, v]) => v.length > 1).map(([key, values]) => ({ key, count: values.length, externalIds: values.map(x => x.externalId) }));
const result = { source: 'senado', baselineRows: baseline.length, postgresRows: pgRows.length, baselineNaturalKeys: bGroups.size, postgresNaturalKeys: pGroups.size, baselineOnly: baselineOnly.length, postgresOnly: pgOnly.length, duplicateBaselineRows: baseline.length - bGroups.size, duplicatePostgresRows: pgRows.length - pGroups.size, duplicateBaseline: duplicateBaseline.slice(0, 100), duplicatePostgres: duplicatePostgres.slice(0, 100), naturalKey: 'proposalId + personExternalId + bodyId + role + start + end + status', counts, sample: rows.slice(0, 100) };
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/r1_6_rapporteur_reconciliation.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
sqlite.close(); await pool.end();
