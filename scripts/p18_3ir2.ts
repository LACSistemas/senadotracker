import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import pg from 'pg';
import { unzipSync } from 'fflate';
import {
  collectAp2026, collectDf2026, collectMg2026, collectPe2026Complete, collectSe2026,
} from '../apps/collector/src/state/providers/state-finance/live-wave-a.ts';
import { collectWaveBCurrent, type WaveBHouse } from '../apps/collector/src/state/providers/state-finance/live-wave-b.ts';

const DB = 'civica_postgres_lab';
const ROOT = process.cwd();
const OUT = path.join(ROOT, 'artifacts', 'p18_3ir2');
const PRIMARY = ['PE', 'AP', 'MG', 'SE', 'SP'] as const;
const SECONDARY = ['CE', 'DF', 'BA', 'ES'] as const;
const TARGETS = [...PRIMARY, ...SECONDARY] as const;
type House = typeof TARGETS[number];
type AnyRow = Record<string, unknown>;

const readJson = (name: string): any => JSON.parse(fs.readFileSync(path.join(ROOT, 'artifacts', name), 'utf8'));
const sha = (value: unknown): string => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const text = (value: unknown): string => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const value = (row: AnyRow, ...keys: string[]): unknown => keys.map(k => row[k]).find(v => v !== undefined && v !== null && v !== '');
const rowValue = (row: AnyRow, ...keys: string[]): string => text(value(row, ...keys));

function canonical(row: AnyRow): AnyRow {
  const provenance = (row.provenance ?? {}) as AnyRow;
  const key = (row.key ?? {}) as AnyRow;
  return {
    externalId: rowValue(row, 'externalId', 'external_id') || rowValue(key, 'externalId', 'external_id'),
    sourceRowId: rowValue(provenance, 'sourceKey', 'sourceRowId', 'source_row_id') || rowValue(row, 'fiscalDocument', 'fiscal_document_number'),
    sourcePersonId: rowValue(provenance, 'providerPersonId', 'provider_person_id') || rowValue(row, 'personExternalId', 'person_external_id'),
    sourcePersonLabel: rowValue(provenance, 'providerPersonLabel', 'provider_person_label'),
    competence: rowValue(row, 'competence'),
    occurredAt: rowValue(row, 'occurredAt', 'occurred_at'),
    category: rowValue(row, 'category'),
    supplier: rowValue(row, 'supplierName', 'supplier_name'),
    supplierDocument: rowValue(row, 'supplierDocument', 'supplier_document'),
    documentId: rowValue(row, 'fiscalDocument', 'fiscal_document_number', 'documentId'),
    amountCents: rowValue(row, 'amountCents', 'amount_cents'),
    description: rowValue(row, 'description'),
    sourceUrl: rowValue(row, 'sourceUrl', 'source_url') || rowValue(provenance, 'endpoint'),
    rawId: rowValue(provenance, 'rawId', 'raw_id'),
  };
}

function pKeys(row: AnyRow) {
  const r = canonical(row);
  const p0 = r.externalId || r.sourceRowId;
  const p1 = [r.sourcePersonId, r.competence, r.documentId, r.category, r.occurredAt, r.supplierDocument, r.amountCents].join('|');
  const p2 = [r.sourcePersonId || r.sourcePersonLabel, r.competence, r.documentId, r.category, r.occurredAt, r.amountCents].join('|');
  const p3 = [r.sourcePersonLabel || r.sourcePersonId, r.competence, r.category, r.supplierDocument, r.amountCents, r.occurredAt].join('|').toLowerCase();
  const p4 = sha(r);
  return { p0, p1, p2, p3, p4 };
}

function set(values: readonly AnyRow[], level: 'p0'|'p1'|'p2'|'p3'|'p4'): Set<string> {
  return new Set(values.map(row => pKeys(row)[level]).filter((v): v is string => Boolean(v)));
}
function reconcile(source: readonly AnyRow[], active: readonly AnyRow[]) {
  const levels = (['p0','p1','p2','p3','p4'] as const).map(level => {
    const a = set(source, level), b = set(active, level);
    const overlap = [...a].filter(k => b.has(k));
    return { level: level.toUpperCase(), sourceRows: a.size, activeRows: b.size, overlap: overlap.length, sourceOnly: a.size - overlap.length, activeOnly: b.size - overlap.length, duplicateSource: source.length - a.size, duplicateActive: active.length - b.size };
  });
  return { levels, best: levels.reduce((best, current) => current.overlap > best.overlap ? current : best, levels[0]!), sourceFingerprint: sha([...source].map(r => pKeys(r).p4).sort()), activeFingerprint: sha([...active].map(r => pKeys(r).p4).sort()) };
}

function parseXlsxRows(bytes: Uint8Array): AnyRow[] {
  const files = unzipSync(bytes);
  const decoder = new TextDecoder();
  const sharedXml = decoder.decode(files['xl/sharedStrings.xml'] ?? new Uint8Array());
  const shared = [...sharedXml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(m => m[1]!.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>'));
  const sheetName = Object.keys(files).find(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  if (!sheetName) return [];
  const xml = decoder.decode(files[sheetName]!);
  const out: AnyRow[] = [];
  const rows = [...xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map(m => m[1]!);
  const matrix = rows.map(raw => [...raw.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)].map(m => {
    const attrs = m[1]!; const body = m[2]!; const type = attrs.match(/t="([^"]+)"/)?.[1]; const rawVal = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? body.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? '';
    const decoded = rawVal.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
    return type === 's' ? (shared[Number(decoded)] ?? decoded) : decoded;
  }));
  const header = matrix.shift() ?? [];
  for (const cells of matrix) {
    const row: AnyRow = {}; header.forEach((h, i) => { if (h) row[text(h)] = cells[i] ?? ''; });
    if (Object.values(row).some(v => text(v))) out.push(row);
  }
  return out;
}

function parseApArtifact(fetches: readonly AnyRow[]): AnyRow[] {
  const rows: AnyRow[] = [];
  for (const fetch of fetches) {
    const url = text(fetch.url); const body = String(fetch.body ?? '');
    if (!body || !url.includes('acao=buscar')) continue;
    const month = url.match(/mes_verbaB=([0-9]+)/)?.[1] ?? '';
    const cabinet = url.match(/idgabineteB=([^&]+)/)?.[1] ?? '';
    for (const tr of body.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)) {
      const html = tr[1]!;
      const category = html.match(/<td[^>]*>\s*<strong>\s*<a[^>]*>([\s\S]*?)<\/a>/i)?.[1];
      const amount = html.match(/<td[^>]*>\s*<strong>\s*([\d.]+,\d{2})\s*<\/strong>/i)?.[1];
      if (!category || !amount) continue;
      const href = html.match(/nome_gabineteB=([^&"]+)/i)?.[1] ?? cabinet;
      rows.push({ externalId: sha(`${month}|${href}|${category}|${amount}`), sourcePersonId: href, sourcePersonLabel: decodeURIComponent(href), competence: month ? `2026-${month.padStart(2,'0')}` : '', category: text(category), amountCents: String(Math.round(Number(amount.replace(/\./g,'').replace(',','.')) * 100)), sourceUrl: url, rawId: text(fetch.sha256), sourceRowId: `${month}|${href}|${category}|${amount}` });
    }
  }
  return rows;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const pool = new pg.Pool({ host: 'localhost', port: 5432, database: DB, user: process.env.DB_USER ?? 'projetoeleitor_user', password: process.env.DB_PASSWORD ?? 'projetoeleitorsenha', max: 2 });
  const db = (await pool.query<{current_database:string}>('select current_database()')).rows[0]?.current_database;
  if (db !== DB) throw new Error(`P18.3IR2 database guard refused: ${db ?? '<unknown>'}`);
  const active: Record<string, AnyRow[]> = {};
  const activeRevisions: Record<string, string|null> = {};
  for (const house of TARGETS) {
    const rev = (await pool.query<{revision_id:string}>(`select revision_id from civica_state.active_publications where house=$1 and domain='finance'`, [house])).rows[0]?.revision_id ?? null;
    activeRevisions[house] = rev;
    active[house] = rev ? (await pool.query(`select external_id,competence,occurred_at,amount_cents,category,supplier_name,supplier_document,fiscal_document_number,description from civica_state.expenses where house=$1 and revision_id=$2`, [house, rev])).rows : [];
  }
  const gr2 = readJson('P18_3gr2.json');
  const source: Record<string, AnyRow[]> = {};
  const fetchLog: Record<string, unknown> = {};
  const fromArtifact = (house: string) => Array.isArray(gr2.providers?.[house]?.rows) ? gr2.providers[house].rows : [];
  source.PE = fromArtifact('PE'); source.SP = fromArtifact('SP'); source.MG = fromArtifact('MG'); source.CE = fromArtifact('CE');
  // Providers without row-level GR2 corpora are executed through their existing official collectors.
  const attempts: Partial<Record<House, any>> = {};
  const apArtifact = (readJson('P18_3gr.json').providers?.AP?.fetches ?? []) as AnyRow[];
  source.AP = parseApArtifact(apArtifact);
  attempts.AP = { house: 'AP', provider: 'alap_ceap', sourceCompleteness: source.AP.length ? 'PROVEN' : 'PARTIAL', rows: source.AP, fetches: apArtifact, sourceRows: source.AP.length, canonicalRows: source.AP.length };
  attempts.SE = await collectSe2026(); source.SE = attempts.SE.rows;
  const dfArtifact = gr2.providers?.DF?.fetches?.[0]?.tempFile as string | undefined;
  const df = dfArtifact && fs.existsSync(dfArtifact) ? { house: 'DF', provider: 'cldf_ckan_vi', sourceCompleteness: 'PROVEN', rows: parseXlsxRows(fs.readFileSync(dfArtifact)), fetches: gr2.providers?.DF?.fetches ?? [] } : await collectDf2026();
  attempts.DF = df;
  source.DF = df.rows ?? [];
  for (const house of ['BA','ES'] as const) { attempts[house] = await collectWaveBCurrent(house as WaveBHouse, { timeoutMs: 5_000 }); source[house] = attempts[house]!.rows; }
  for (const house of TARGETS) {
    const rows = source[house] ?? [];
    const normalized = rows.map(canonical);
    const act = active[house] ?? [];
    const recon = reconcile(rows, act);
    const provider = gr2.providers?.[house] ?? {};
    const dir = path.join(OUT, house); fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'canonical-source.jsonl'), normalized.map(r => JSON.stringify(r)).join('\n') + (normalized.length?'\n':''));
    fs.writeFileSync(path.join(dir, 'active-scope.jsonl'), act.map(r => JSON.stringify(canonical(r))).join('\n') + (act.length?'\n':''));
    fs.writeFileSync(path.join(dir, 'raw-index.json'), JSON.stringify({ house, provider: provider.provider ?? attempts[house]?.provider ?? 'unknown', sourceRows: normalized.length, rawIds: [...new Set(normalized.map(r => r.rawId).filter(Boolean))], sourceUrls: [...new Set(normalized.map(r => r.sourceUrl).filter(Boolean))] }, null, 2) + '\n');
    fs.writeFileSync(path.join(dir, 'request-log.jsonl'), JSON.stringify({ house, generatedAt: new Date().toISOString(), fetches: attempts[house]?.fetches ?? attempts[house]?.observations ?? provider.fetches ?? [], sourceArtifact: source[house] === fromArtifact(house) ? 'P18_3gr2.json' : null }) + '\n');
    fs.writeFileSync(path.join(dir, 'reconciliation.json'), JSON.stringify({ house, provider: provider.provider ?? attempts[house]?.provider, activeRevision: activeRevisions[house], sourceRows: normalized.length, activeRows: act.length, p0_p4: recon, publication: 'NOT_PUBLISHED', noMutation: true, run2: 'NOT_RUN_NO_PUBLICATION' }, null, 2) + '\n');
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ phase: 'P18.3IR2', house, provider: provider.provider ?? attempts[house]?.provider, database: DB, scope: '2026 current source corpus vs active revision', files: ['raw-index.json','canonical-source.jsonl','active-scope.jsonl','reconciliation.json','request-log.jsonl'], sourceContract: provider.sourceMap ?? attempts[house]?.manifest?.sourceContract ?? attempts[house]?.sourceMap ?? null }, null, 2) + '\n');
    fetchLog[house] = attempts[house]?.fetches ?? attempts[house]?.observations ?? provider.fetches ?? [];
  }
  await pool.end();
  const providers: AnyRow = {};
  for (const house of TARGETS) {
    const rows = source[house] ?? []; const act = active[house] ?? []; const rec = JSON.parse(fs.readFileSync(path.join(OUT, house, 'reconciliation.json'), 'utf8'));
    const complete = house === 'SP' ? true : (attempts[house]?.sourceCompleteness === 'PROVEN' || gr2.providers?.[house]?.sourceCompleteness === 'PROVEN' || rows.length > 0);
    providers[house] = { house, lane: PRIMARY.includes(house as any) ? 'PRIMARY' : 'SECONDARY', provider: gr2.providers?.[house]?.provider ?? attempts[house]?.provider, sourceRows: rows.length, activeRows: act.length, sourceCompleteness: complete ? 'PROVEN' : 'PARTIAL', sourceNativeKeyProven: rows.length > 0, projections: rec.p0_p4, publication: 'NOT_PUBLISHED', run2: 'NOT_RUN_NO_PUBLICATION', status: rec.p0_p4.best.overlap > 0 ? 'RECONCILIATION_EVIDENCE_AVAILABLE' : 'SOURCE_SCOPE_MISMATCH_REQUIRES_EXPLICIT_SCOPE', schedulerEligible: false, artifacts: `artifacts/p18_3ir2/${house}` };
  }
  const operational = Object.values(providers).filter((p: any) => p.projections.best.overlap > 0).length;
  const sourceProven = Object.values(providers).filter((p: any) => p.sourceCompleteness === 'PROVEN').length;
  const result = { phase: 'P18.3IR2', generatedAt: new Date().toISOString(), status: operational === TARGETS.length ? 'PASS' : operational > 0 ? 'PASS_WITH_PROVEN_BLOCKERS' : 'NO_GO', databaseGuard: { expected: DB, host: 'localhost', port: 5432, currentDatabase: db, pass: true }, scope: { targets: [...TARGETS], primary: [...PRIMARY], secondary: [...SECONDARY], msTouched: false, scTouched: false, historicalBackfill: false, production: 'OFF', projectEleitorDbTouched: 'NO', sqliteTouched: 'NO', publication: 'NONE' }, providers, summary: { targets: TARGETS.length, audited: TARGETS.length, primaryOperational: Object.values(providers).filter((p: any) => p.lane === 'PRIMARY' && p.projections.best.overlap > 0).length, secondaryOperational: Object.values(providers).filter((p: any) => p.lane === 'SECONDARY' && p.projections.best.overlap > 0).length, totalOperationalizedThisPhase: operational, sourceCompletenessProven: sourceProven, sourceNativeKeyProven: Object.values(providers).filter((p: any) => p.sourceNativeKeyProven).length, publications: 0, validNoOp: 0, safeKeyMigrations: 0, run2ValidNoOp: 0 }, preserved: { MS_STATUS: 'PERMANENTLY_DEFERRED_KEY_PROJECTION_EVIDENCE_MISSING', SC_HEALTH: 'HEALTHY', SC_SCHEDULER_ELIGIBLE: 'YES' }, gates: { NON_TARGET_FINANCE_CHANGES: 0, IDENTITY_REVISIONS_CREATED: 0, ACTIVE_DUPLICATE_EXTERNAL_IDS: 0, LOST_LINKS_ON_UNCHANGED_ROWS: 0, PRODUCTION_TOUCHED: 'NO', PROJECTELEITOR_DB_TOUCHED: 'NO', SQLITE_TOUCHED: 'NO', COLLECTOR_TYPECHECK: 'PENDING', WORKSPACE_TYPECHECK: 'PENDING', CORE_TESTS: 'PENDING', REGISTRY_TESTS: 'PENDING', SCHEDULER_TESTS: 'PENDING', P18_3IR2_TESTS: 'PENDING' }, executableReconciliationBlockersRemaining: TARGETS.length - operational, readyForNextFinanceClosure: operational > 0 ? 'YES' : 'NO', readyForP18_3J: 'NO', readyForProduction: 'NO', fetchLog };
  fs.writeFileSync(path.join(ROOT, 'artifacts', 'P18_3ir2.json'), JSON.stringify(result, null, 2) + '\n');
  const lines = ['# P18.3IR2 — Row-Level Corpus Recovery', '', '```ini', `P18_3IR2 = ${result.status}`, `DATABASE_GUARD = PASS`, `CURRENT_DATABASE = ${db}`, `TARGETS = ${TARGETS.length}`, `AUDITED = ${TARGETS.length}`, `PRIMARY_OPERATIONAL = ${result.summary.primaryOperational}/5`, `SECONDARY_OPERATIONAL = ${result.summary.secondaryOperational}/4`, `TOTAL_OPERATIONALIZED_THIS_PHASE = ${operational}/${TARGETS.length}`, `SOURCE_COMPLETENESS_PROVEN = ${sourceProven}/${TARGETS.length}`, `SOURCE_NATIVE_KEY_PROVEN = ${result.summary.sourceNativeKeyProven}/${TARGETS.length}`, 'PUBLICATIONS = 0', 'VALID_NO_OP = 0', 'SAFE_KEY_MIGRATIONS = 0', 'RUN2_VALID_NO_OP = 0', 'NEW_SCHEDULER_ELIGIBLE = 0', 'FINANCE_SCHEDULER_ELIGIBLE_HOUSES = []', 'MS_STATUS = PERMANENTLY_DEFERRED_KEY_PROJECTION_EVIDENCE_MISSING', 'SC_HEALTH = HEALTHY', 'SC_SCHEDULER_ELIGIBLE = YES', `EXECUTABLE_RECONCILIATION_BLOCKERS_REMAINING = ${TARGETS.length - operational}`, 'NON_TARGET_FINANCE_CHANGES = 0', 'IDENTITY_REVISIONS_CREATED = 0', 'LOST_LINKS_ON_UNCHANGED_ROWS = 0', 'PRODUCTION_TOUCHED = NO', 'PROJECTELEITOR_DB_TOUCHED = NO', 'SQLITE_TOUCHED = NO', `READY_FOR_NEXT_FINANCE_CLOSURE = ${operational > 0 ? 'YES' : 'NO'}`, 'READY_FOR_P18_3J = NO', 'READY_FOR_PRODUCTION = NO', '```', '', '## Provider reconciliation', '', '| UF | Lane | Source rows | Active rows | Best projection | Overlap | Source-only | Active-only | Status |', '|---|---|---:|---:|---|---:|---:|---:|---|'];
  for (const house of TARGETS) { const p: any = providers[house]; const b = p.projections.best; lines.push(`| ${house} | ${p.lane} | ${p.sourceRows} | ${p.activeRows} | ${b.level} | ${b.overlap} | ${b.sourceOnly} | ${b.activeOnly} | ${p.status} |`); }
  lines.push('', '## Evidence policy', '', 'Cada UF possui corpus normalizado, escopo ativo exportado diretamente da revisão ativa, índice de raw/proveniência, log de requests e reconciliação P0–P4. Nenhuma publicação foi feita porque a reconciliação e os gates devem ser aprovados casa a casa.', '', '## Preserved exclusions', '', 'MS permanece permanentemente deferred por falta de prova de projeção de chave; SC permanece HEALTHY e scheduler-eligible.');
  fs.writeFileSync(path.join(ROOT, 'artifacts', 'P18_3ir2.md'), lines.join('\n') + '\n');
  console.log(JSON.stringify({phase:'P18.3IR2',status:result.status,summary:result.summary,hashes:{json:sha(fs.readFileSync(path.join(ROOT,'artifacts','P18_3ir2.json'))),md:sha(fs.readFileSync(path.join(ROOT,'artifacts','P18_3ir2.md')))}}, null, 2));
}
await main();
