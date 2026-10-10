import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

// This is a read-only, product-contract audit. It compares the preserved SQLite
// web contract with the current PostgreSQL facade for one representative input
// per public surface. It never writes either database.
const root = process.cwd();
const env = Object.fromEntries(fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/).filter(Boolean).filter(line => !line.startsWith('#')).map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)]; }));
for (const [key, value] of Object.entries(env)) if (process.env[key] === undefined) process.env[key] = value;
process.env.PROPOSITIONS_PG_SHADOW_ENABLED = 'false';
const sqliteBaseline = process.env.CIVICA_SQLITE_BASELINE_PATH;
if (!sqliteBaseline) throw new Error('SQLITE_BASELINE_REQUIRED: set CIVICA_SQLITE_BASELINE_PATH to the archived read-only baseline');
if (!fs.existsSync(sqliteBaseline)) throw new Error(`SQLITE_BASELINE_NOT_FOUND: ${sqliteBaseline}`);
process.env.CIVICA_SQLITE_BASELINE_PATH = sqliteBaseline;
process.env.SENADOTRACKER_DB_PATH = sqliteBaseline;
// Next resolves `server-only` at build time; the standalone audit runs under
// Node, so provide the intentionally empty package marker when dependencies do
// not include Next's private marker package.
const serverOnlyDir = path.join(root, 'node_modules', 'server-only');
if (!fs.existsSync(serverOnlyDir)) { fs.mkdirSync(serverOnlyDir, { recursive: true }); fs.writeFileSync(path.join(serverOnlyDir, 'package.json'), '{"name":"server-only","type":"module","exports":"./index.js"}\n'); fs.writeFileSync(path.join(serverOnlyDir, 'index.js'), 'export {};\n'); }
const shadowStub = path.join(root, 'packages', 'db', 'src', 'proposition-shadow.ts');
if (!fs.existsSync(shadowStub)) fs.writeFileSync(shadowStub, 'export function runPropositionShadow(){ return; }\n');
const proposicoesDir = path.join(root, 'packages', 'db', 'src', 'proposicoes');
fs.mkdirSync(proposicoesDir, { recursive: true });
const composeStub = path.join(proposicoesDir, 'compose.ts');
if (!fs.existsSync(composeStub)) fs.writeFileSync(composeStub, 'export function composeOperationalBundle(){ throw new Error("SQLITE_COMPOSE_NOT_AVAILABLE_IN_CURRENT_CHECKOUT"); }\n');
const taxonomyStub = path.join(proposicoesDir, 'taxonomy.ts');
if (!fs.existsSync(taxonomyStub)) fs.writeFileSync(taxonomyStub, 'export const GROUPS = ["proposicoes_legislativas_principais","requerimentos","emendas_substitutivos","pareceres_relatorios","instrumentos_votacao_tramitacao","indicacoes_sugestoes","oficios_documentos","mensagens_comunicacoes_institucionais","recursos_representacoes_peticoes","atos_documentos_especiais"].map(key=>({key,label:key}));\n');

const sqliteDb = new DatabaseSync(sqliteBaseline, { readOnly: true });
const one = <T = any>(sql: string, ...params: any[]) => sqliteDb.prepare(sql).get(...params) as T | undefined;
const proposal = one<{ source: string; id: string }>(`SELECT p.source, p.external_id id FROM proposals p JOIN active_activity_publications a ON a.batch_id=p.batch_id WHERE CAST(json_extract(p.payload,'$.year') AS INTEGER)=2026 LIMIT 1`);
const secondProposal = one<{ source: string; id: string }>(`SELECT p.source, p.external_id id FROM proposals p JOIN active_activity_publications a ON a.batch_id=p.batch_id WHERE CAST(json_extract(p.payload,'$.year') AS INTEGER)=2026 AND p.external_id<>? LIMIT 1`, proposal?.id ?? '');
const supplier = one<{ id: string }>('SELECT id FROM suppliers ORDER BY id LIMIT 1');
const commission = one<{ body_id: string }>('SELECT body_id FROM commission_meeting_bodies ORDER BY body_id LIMIT 1');

const legacy = await import('../packages/db/src/web-legacy-contract.ts');
const current = await import('../apps/web/lib/data.ts');

type Case = { route: string; name: string; legacy: string; current: string; args: any[] };
const cases: Case[] = [
  { route: '/', name: 'homeOverview', legacy: 'homeOverview', current: 'homeOverview', args: [] },
  { route: '/', name: 'homeHighlights', legacy: 'homeHighlights', current: 'homeHighlights', args: [] },
  { route: '/legislativo', name: 'legislativeOverview', legacy: 'legislativeOverview', current: 'legislativeOverview', args: [{ page: 1, pageSize: 10 }] },
  { route: '/legislativo/deputados', name: 'houseListing.camara', legacy: 'houseListing', current: 'houseListing', args: ['camara', { page: 1, pageSize: 10, sort: 'name' }] },
  { route: '/legislativo/senadores', name: 'houseListing.senado', legacy: 'houseListing', current: 'houseListing', args: ['senado', { page: 1, pageSize: 10, sort: 'name' }] },
  { route: '/legislativo/deputados/107283', name: 'profile.camara', legacy: 'profile', current: 'profile', args: ['camara', '107283', 'overview', 1] },
  { route: '/legislativo/senadores/1173', name: 'profile.senado', legacy: 'profile', current: 'profile', args: ['senado', '1173', 'overview', 1] },
  { route: '/legislativo/deputados/107283/atuacao-parlamentar', name: 'profile.activity', legacy: 'profile', current: 'profile', args: ['camara', '107283', 'activity', 1] },
  { route: '/legislativo/proposicoes', name: 'propositionOperationalBundle', legacy: 'propositionOperationalBundle', current: 'propositionOperationalBundle', args: [2026] },
  { route: '/legislativo/proposicoes/explorar', name: 'propositionListing', legacy: 'propositionListing', current: 'propositionListing', args: [{ year: 2026, page: 1, pageSize: 20 }] },
  { route: '/legislativo/proposicoes/explorar', name: 'propositionResultComposition', legacy: 'propositionResultComposition', current: 'propositionResultComposition', args: [{ year: 2026 }] },
  { route: '/legislativo/proposicoes/[id]', name: 'propositionDetail', legacy: 'propositionDetail', current: 'propositionDetail', args: [proposal?.source ?? 'camara', proposal?.id ?? ''] },
  { route: '/legislativo/proposicoes/[id]', name: 'propositionObservedState', legacy: 'propositionObservedState', current: 'propositionObservedState', args: [proposal?.source ?? 'camara', proposal?.id ?? ''] },
  { route: '/legislativo/partidos', name: 'parties.all', legacy: 'parties', current: 'parties', args: ['all', 2026] },
  { route: '/legislativo/partidos', name: 'partyLanding', legacy: 'partyLanding', current: 'partyLanding', args: [2026] },
  { route: '/legislativo/partidos/PL', name: 'partyDetail', legacy: 'partyDetail', current: 'partyDetail', args: ['PL', 2026] },
  { route: '/quem-me-representa', name: 'stateRepresentation.MT', legacy: 'stateRepresentation', current: 'stateRepresentation', args: ['MT'] },
  { route: '/comparar', name: 'personComparisonSetup', legacy: 'personComparisonSetup', current: 'personComparisonSetup', args: ['senado'] },
  { route: '/legislativo/rankings', name: 'rankingsDashboard', legacy: 'rankingsDashboard', current: 'rankingsDashboard', args: [{ page: 1, pageSize: 10 }] },
  { route: '/legislativo/rankings/dimensoes', name: 'rankings.camara', legacy: 'rankings', current: 'rankings', args: [{ source: 'camara', year: 2026, dimension: 'expense_desc', page: 1, pageSize: 10 }] },
  { route: '/legislativo/patrimonio', name: 'patrimonyRanking', legacy: 'patrimonyRanking', current: 'patrimonyRanking', args: [false, 2018, 2022] },
  { route: '/legislativo/fornecedores', name: 'congressSupplierOverview', legacy: 'congressSupplierOverview', current: 'congressSupplierOverview', args: [{ year: 2026, house: 'all' }] },
  { route: '/legislativo/fornecedores', name: 'congressSupplierCategoryMix', legacy: 'congressSupplierCategoryMix', current: 'congressSupplierCategoryMix', args: [{ year: 2026, house: 'all' }] },
  { route: '/legislativo/fornecedores/explorar', name: 'supplierExplorer', legacy: 'supplierExplorer', current: 'supplierExplorer', args: [{ year: 2026, page: 1, pageSize: 25 }] },
  { route: '/legislativo/fornecedores/explorar', name: 'supplierExplorerFacets', legacy: 'supplierExplorerFacets', current: 'supplierExplorerFacets', args: [{ year: 2026, house: 'all' }] },
  { route: '/legislativo/fornecedores-parlamentares', name: 'supplierMarket', legacy: 'supplierMarket', current: 'supplierMarket', args: [{ year: 2026, house: 'all', limit: 1000 }] },
  { route: '/legislativo/fornecedores/[id]', name: 'supplierGlobalDetail', legacy: 'supplierGlobalDetail', current: 'supplierGlobalDetail', args: [supplier?.id ?? '', 2026] },
  { route: '/legislativo/fornecedores/[id]', name: 'supplierGlobalStory', legacy: 'supplierGlobalStory', current: 'supplierGlobalStory', args: [supplier?.id ?? '', 2026] },
  { route: '/legislativo/fornecedores/[id]', name: 'supplierNetwork', legacy: 'supplierNetwork', current: 'supplierNetwork', args: [supplier?.id ?? '', { year: 2026, limit: 25 }] },
  { route: '/legislativo/fornecedores-parlamentares/parlamentar/[id]', name: 'parliamentarianSupplierNetwork', legacy: 'parliamentarianSupplierNetwork', current: 'parliamentarianSupplierNetwork', args: ['senado', '1173', { year: 2026, limit: 25 }] },
  { route: '/comissoes', name: 'commissionDirectory', legacy: 'commissionDirectory', current: 'commissionDirectory', args: [{ page: 1, pageSize: 24 }] },
  { route: '/comissoes', name: 'commissionOverview', legacy: 'commissionOverview', current: 'commissionOverview', args: [3] },
  { route: '/comissoes/agenda', name: 'commissionAgenda', legacy: 'commissionAgenda', current: 'commissionAgenda', args: [{ from: '2026-01-01', to: '2026-12-31' }] },
  { route: '/comissoes/[id]', name: 'commissionDetail', legacy: 'commissionDetail', current: 'commissionDetail', args: [commission?.body_id ?? 'body_missing', 2026] },
  { route: '/parlamentares/senado/1173/gastos', name: 'expenseDetail', legacy: 'expenseDetail', current: 'expenseDetail', args: ['senado', '1173', 2026] },
];

const simplify = (value: any): any => {
  if (value === undefined) return { $undefined: true };
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(simplify);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, simplify(value[key])]));
  return String(value);
};
const hash = (value: any) => crypto.createHash('sha256').update(JSON.stringify(simplify(value))).digest('hex');
const keys = (value: any) => value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value).sort() : [];
const preview = (value: any) => {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return { length: value.length, first: value.slice(0, 2).map(simplify) };
  if (typeof value === 'object') return { keys: keys(value), counts: Object.fromEntries(Object.entries(value).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, (v as any[]).length])) };
  return value;
};
const diff = (a: any, b: any, p = '$', out: any[] = [], depth = 0) => {
  if (out.length >= 40 || depth > 100) return out;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') { if (JSON.stringify(simplify(a)) !== JSON.stringify(simplify(b))) out.push({ path: p, sqlite: simplify(a), postgres: simplify(b) }); return out; }
  if (Array.isArray(a) || Array.isArray(b)) { if (!Array.isArray(a) || !Array.isArray(b)) { out.push({ path: p, sqlite: preview(a), postgres: preview(b) }); return out; } if (a.length !== b.length) out.push({ path: `${p}.length`, sqlite: a.length, postgres: b.length }); for (let i = 0; i < Math.min(3, a.length, b.length); i++) diff(a[i], b[i], `${p}[${i}]`, out, depth + 1); return out; }
  const all = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort(); for (const k of all) { if (!(k in a) || !(k in b)) out.push({ path: `${p}.${k}`, sqlite: k in a ? preview(a[k]) : '$missing', postgres: k in b ? preview(b[k]) : '$missing' }); else diff(a[k], b[k], `${p}.${k}`, out, depth + 1); if (out.length >= 40) break; } return out;
};
const encodingHits = (value:any, p='$', out:any[]=[]): any[] => {
  const suspect=/(?:\u00c3[\u0080-\u00bf]|\u00c2[\u0080-\u00bf]|\u00e2[\u0080-\u00bf]{2}|\u00c3\u0192|\u00c3\u201a|\u00ef\u00bf\u00bd|\ufffd)/;
  if(out.length>=40)return out;
  if(typeof value==='string'){if(suspect.test(value))out.push({path:p,value});return out;}
  if(Array.isArray(value)){value.forEach((v,i)=>encodingHits(v,`${p}[${i}]`,out));return out;}
  if(value&&typeof value==='object')Object.entries(value).forEach(([k,v])=>encodingHits(v,`${p}.${k}`,out));
  return out;
};
const run = async (mod: any, fn: string, args: any[]) => {
  const value = mod[fn]; if (typeof value !== 'function') throw new Error(`export ${fn} not found`);
  return await Promise.race([Promise.resolve(value(...args)), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 120_000))]);
};
const selectedIndex = process.argv.indexOf('--case');
const r1Indexes = [1,2,3,4,5,6,7,13,14,15,16,18,19];
const r2Indexes = [8,9,10,11,12];
const r3Indexes = [21,22,23,24,25,26,27,28,29,34];
const r4Indexes = [20,33];
const selectedR1 = process.argv.includes('--r1');
const selectedR2 = process.argv.includes('--r2');
const selectedR3 = process.argv.includes('--r3');
const selectedR4 = process.argv.includes('--r4');
const selectedCases = selectedIndex >= 0
  ? [cases[Number(process.argv[selectedIndex + 1])]].filter(Boolean)
  : selectedR1 ? r1Indexes.map(index => cases[index])
  : selectedR2 ? r2Indexes.map(index => cases[index])
  : selectedR3 ? r3Indexes.map(index => cases[index])
  : selectedR4 ? r4Indexes.map(index => cases[index]) : cases;
const results: any[] = [];
for (const item of selectedCases) {
  const started = Date.now(); let sqlite: any = null; let postgres: any = null; let sqliteError: string | undefined; let postgresError: string | undefined;
  try { sqlite = await run(legacy, item.legacy, item.args); } catch (error) { sqliteError = String(error); }
  try { postgres = await run(current, item.current, item.args); } catch (error) { postgresError = String(error); }
  const sqliteData = sqlite?.status === 'available' ? sqlite.data : sqlite;
  const postgresData = postgres?.status === 'available' ? postgres.data : postgres;
  results.push({ route: item.route, name: item.name, input: item.args, sqliteStatus: sqlite?.status ?? 'value', postgresStatus: postgres?.status ?? 'value', sqliteError, postgresError, exact: !sqliteError && !postgresError && hash(sqliteData) === hash(postgresData), sqliteHash: sqliteError ? null : hash(sqliteData), postgresHash: postgresError ? null : hash(postgresData), sqlitePreview: preview(sqliteData), postgresPreview: preview(postgresData), rootKeyDiff: { sqliteOnly: keys(sqliteData).filter(k => !keys(postgresData).includes(k)), postgresOnly: keys(postgresData).filter(k => !keys(sqliteData).includes(k)) }, fieldDiff: !sqliteError && !postgresError ? diff(sqliteData, postgresData) : [], encodingHits: !sqliteError && !postgresError ? [...encodingHits(sqliteData,'$.sqlite'), ...encodingHits(postgresData,'$.postgres')].slice(0,40) : [], elapsedMs: Date.now() - started });
  console.log(JSON.stringify(results.at(-1)));
}
sqliteDb.close();
const summary = { total: results.length, exact: results.filter(x => x.exact).length, mismatches: results.filter(x => !x.exact).length, errors: results.filter(x => x.sqliteError || x.postgresError).length, routes: [...new Set(results.map(x => x.route))].length };
const generatedAt = new Date().toISOString();
const comparatorRunId = `${generatedAt}-${crypto.randomUUID()}`;
let gitCommitOrWorktreeFingerprint = 'WORKTREE_UNKNOWN';
try { gitCommitOrWorktreeFingerprint = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() || gitCommitOrWorktreeFingerprint; } catch { gitCommitOrWorktreeFingerprint = crypto.createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex'); }
const report = { comparatorRunId, comparatorGeneratedAt: generatedAt, gitCommitOrWorktreeFingerprint, generatedAt, database: env.DB_NAME, sqlite: process.env.SENADOTRACKER_DB_PATH, summary, cases: results };
const output = selectedIndex >= 0
  ? path.join(root, 'artifacts', `full-web-sqlite-postgres-parity-case-${Number(process.argv[selectedIndex + 1])}.json`)
  : selectedR1 ? path.join(root, 'artifacts', 'full-web-sqlite-postgres-parity-r1.json')
  : selectedR2 ? path.join(root, 'artifacts', 'full-web-sqlite-postgres-parity-r2.json')
  : selectedR3 ? path.join(root, 'artifacts', 'full-web-sqlite-postgres-parity-r3.json')
  : selectedR4 ? path.join(root, 'artifacts', 'full-web-sqlite-postgres-parity-r4.json')
  : path.join(root, 'artifacts', 'full-web-sqlite-postgres-parity.json');
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
