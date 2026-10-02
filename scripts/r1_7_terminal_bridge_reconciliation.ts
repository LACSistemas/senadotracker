import pg from 'pg';
import { readFile, mkdir, writeFile } from 'node:fs/promises';

const env = Object.fromEntries((await readFile('.env', 'utf8')).split(/\r?\n/).filter(x => x.includes('=')).map(x => { const i = x.indexOf('='); return [x.slice(0, i), x.slice(i + 1).trim()]; }));
const pool = new pg.Pool({ host: env.DB_HOST, port: Number(env.DB_PORT), database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD });
const eventRows = (await pool.query(`
  SELECT proposal_id::text terminal_proposal_id,kind,occurred_at::text date,payload->>'label' label
  FROM civica_poc.proposal_detail_atoms
  WHERE source='senado' AND proposal_id IS NOT NULL AND kind IN ('movement','situation','resulting_norm')
`)).rows as Array<{ terminal_proposal_id: string; kind: string; date: string | null; label: string | null }>;
const folded = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const terminal = /(transformad[ao].*norma|transforma.*norma|convertid[ao].*norma|promulgad[ao]|sancionad[ao]|vetad[ao]|veto (total|parcial))/i;
const terminalIds = new Set(eventRows.filter(x => String(x.date ?? '').slice(0, 4) === '2026' && (x.kind === 'resulting_norm' || terminal.test(folded(x.label)))).map(x => x.terminal_proposal_id));
const rows = [...terminalIds].sort().map(terminal_proposal_id => ({ terminal_proposal_id }));
const bridge = (await pool.query(`SELECT official_matter_id,pg_proposal_id,match_status,match_level,official_label FROM civica_poc.proposal_identity_bridge WHERE source='senado'`)).rows as any[];
const byPg = new Map(bridge.filter(x => x.pg_proposal_id).map(x => [String(x.pg_proposal_id), x]));
const officialSet = new Set(bridge.map(x => String(x.official_matter_id)));
const reconciled = rows.map(x => { const b = byPg.get(String(x.terminal_proposal_id)); return { terminal_proposal_id: String(x.terminal_proposal_id), official_matter_id: b?.official_matter_id ?? null, bridge_status: b?.match_status ?? 'NO_BRIDGE_ROW', canonical_pg_proposal: b?.pg_proposal_id ?? null, in_official_1398_set: Boolean(b && officialSet.has(String(b.official_matter_id))), match_reason: b?.match_level ? `proposal_identity_bridge:${b.match_level}` : 'no bridge row keyed by pg_proposal_id' }; });
const summary = { terminals: reconciled.length, matchedToOfficialUniverse: reconciled.filter(x => x.in_official_1398_set).length, unmatchedTerminals: reconciled.filter(x => !x.in_official_1398_set).length, byBridgeStatus: Object.fromEntries([...new Set(reconciled.map(x => x.bridge_status))].map(k => [k, reconciled.filter(x => x.bridge_status === k).length])) };
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/r1_7_terminal_bridge_reconciliation.json', JSON.stringify({ database: env.DB_NAME, source: 'senado', summary, rows: reconciled }, null, 2));
console.log(JSON.stringify(summary, null, 2));
await pool.end();
