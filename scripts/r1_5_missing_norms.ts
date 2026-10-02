import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const env = Object.fromEntries((await readFile('.env', 'utf8')).split(/\r?\n/).filter(x => x.includes('=')).map(x => { const i = x.indexOf('='); return [x.slice(0, i), x.slice(i + 1).trim()]; }));
const sqlite = new DatabaseSync('data/senadotracker.sqlite', { readOnly: true });
const pool = new pg.Pool({ host: env.DB_HOST, port: Number(env.DB_PORT), database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD });
const sRows = sqlite.prepare(`SELECT DISTINCT c.proposal_id, c.occurred_at, json_extract(c.payload,'$.label') label, json_extract(c.payload,'$.value') value, c.raw_id, c.external_key
  FROM legislative_complements c JOIN active_complement_publications a ON a.batch_id=c.batch_id
  WHERE a.source='senado' AND c.kind='resulting_norm' AND c.proposal_id IS NOT NULL AND c.occurred_at >= '2026-01-01' AND c.occurred_at < '2027-01-01' ORDER BY c.proposal_id`).all() as any[];
const pRows = (await pool.query(`SELECT DISTINCT a.proposal_id,a.occurred_at,a.payload->>'label' label,a.payload->>'value' value,a.raw_id,a.external_key
  FROM civica_poc.proposal_detail_atoms a
  WHERE a.source='senado' AND a.kind='resulting_norm' AND a.proposal_id IS NOT NULL AND a.occurred_at >= '2026-01-01' AND a.occurred_at < '2027-01-01' ORDER BY a.proposal_id`)).rows;
const s = new Map(sRows.map(x => [String(x.proposal_id), x])); const p = new Map(pRows.map(x => [String(x.proposal_id), x]));
const missing = [...s.keys()].filter(id => !p.has(id)).map(id => ({ proposalOfficialIdentity: id, sqlite: s.get(id), pgProposalId: id, normIdentity: s.get(id)?.label ?? null, normDate: s.get(id)?.occurred_at ?? null, relation: 'resulting_norm', baseRowExists: p.has(id), relationExists: false, rawEvidenceExists: Boolean(s.get(id)?.raw_id) }));
const extra = [...p.keys()].filter(id => !s.has(id)).map(id => ({ proposalId: id, pg: p.get(id) }));
const out = { year: 2026, sqlite: { rows: sRows.length, distinctProposals: s.size }, postgres: { rows: pRows.length, distinctProposals: p.size }, missingCount: missing.length, missing, postgresOnlyCount: extra.length, postgresOnly: extra.slice(0, 100), status: missing.length === 0 ? 'PASS' : 'BLOCKED_IDENTITY_OR_RELATION_MISSING' };
await mkdir('artifacts', { recursive: true }); await writeFile('artifacts/r1_5_missing_senate_norms.json', JSON.stringify(out, null, 2)); console.log(JSON.stringify(out, null, 2)); await pool.end(); sqlite.close();
