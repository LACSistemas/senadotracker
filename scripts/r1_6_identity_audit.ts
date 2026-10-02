import pg from 'pg';
import { readFile, mkdir, writeFile } from 'node:fs/promises';

type Row = Record<string, any>;
const env = Object.fromEntries((await readFile('.env', 'utf8')).split(/\r?\n/).filter(x => x.includes('=')).map(x => { const i = x.indexOf('='); return [x.slice(0, i).trim(), x.slice(i + 1).trim()]; }));
const pool = new pg.Pool({ host: env.DB_HOST, port: Number(env.DB_PORT), database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD });
const q = async (sql: string, values: unknown[] = []) => (await pool.query(sql, values)).rows as Row[];
const clean = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
const num = (v: unknown) => { const m = clean(v).replace(/^0+/, '').match(/^\d+$/); return m ? m[0] : null; };
const typeNorm = (v: unknown) => clean(v).toUpperCase().replace(/[^A-Z0-9]/g, '');
const key = (type: unknown, number: unknown, year: unknown) => { const n = num(number), y = num(year); return typeNorm(type) && n && y ? `${typeNorm(type)}|${n}|${y}` : null; };
const parseLabel = (value: unknown) => {
  const text = clean(value).toUpperCase();
  const m = text.match(/\b([A-Z]{2,8})\s*(?:N[ºO°.]?\s*)?(\d{1,8})\s*[/ -]\s*(\d{4})\b/);
  return m ? { type: typeNorm(m[1]), number: num(m[2]), year: num(m[3]), pattern: 'TYPE_NUMBER_YEAR' } : null;
};
const parseProcess = (value: unknown) => {
  const text = clean(value);
  const label = parseLabel(text);
  if (label) return { ...label, raw: text };
  if (/^\d+$/.test(text)) return { type: null, number: null, year: null, processId: text, pattern: 'NUMERIC_PROCESS_ID', raw: text };
  return { type: null, number: null, year: null, pattern: text ? 'UNPARSED_TEXT' : 'EMPTY', raw: text };
};
const aliases: Record<string, string[]> = { PL: ['PL', 'PLS', 'PLC'], PLS: ['PLS', 'PL'], PLC: ['PLC', 'PL'], REQ: ['REQ', 'RQS'], RQS: ['RQS', 'REQ'], PDL: ['PDL', 'DLG'], DLG: ['DLG', 'PDL'] };
const officialRoot = JSON.parse(await readFile('data/cache/senate-active-matters.json', 'utf8'));
const officials = (officialRoot.PesquisaBasicaMateria?.Materias?.Materia ?? []).map((x: Row, row: number) => ({ row, officialMatterId: clean(x.Codigo), processId: clean(x.IdentificacaoProcesso), sigla: clean(x.Sigla), number: clean(x.Numero), year: clean(x.Ano), label: clean(x.DescricaoIdentificacao), summary: clean(x.Ementa), url: clean(x.UrlDetalheMateria), date: clean(x.Data) }));
const pgActive = await q(`SELECT p.external_id,p.type,p.number::text number,p.year,p.label,p.summary,p.payload,p.raw_id,p.batch_id
  FROM civica_poc.proposals p JOIN civica_poc.active_publications a ON a.source=p.source AND a.batch_id=p.batch_id
  WHERE p.source='senado' ORDER BY p.external_id`);
const pgAll = await q(`SELECT p.external_id,p.type,p.number::text number,p.year,p.label,p.summary,p.payload,p.raw_id,p.batch_id
  FROM civica_poc.proposals p WHERE p.source='senado' ORDER BY p.external_id`);
const pgById = new Map(pgAll.map(x => [clean(x.external_id), x]));
const index = (rows: Row[]) => { const m = new Map<string, Row[]>(); for (const x of rows) { const k = key(x.type, x.number, x.year); if (k) m.set(k, [...(m.get(k) ?? []), x]); } return m; };
const activeByKey = index(pgActive), allByKey = index(pgAll);
const officialByType = new Map<string, number>();
const unmatched = officials.filter(x => !pgById.has(x.officialMatterId));
const patterns = new Map<string, { count: number; examples: string[]; parseable: number }>();
for (const x of officials) { const parsed = parseProcess(x.processId); const p = patterns.get(parsed.pattern) ?? { count: 0, examples: [], parseable: 0 }; p.count++; if (p.examples.length < 10) p.examples.push(x.processId); if (parsed.type || parsed.processId) p.parseable++; patterns.set(parsed.pattern, p); const t = typeNorm(x.sigla); officialByType.set(t, (officialByType.get(t) ?? 0) + 1); }
const pgTypeSet = new Set(pgAll.map(x => typeNorm(x.type)).filter(Boolean));
const categories: Row[] = [];
const diagnostics: Row[] = [];
const missingNormIds = new Set(['171682', '172696', '173235', '173649', '173694', '175446']);
for (const x of unmatched) {
  const exactKey = key(x.sigla, x.number, x.year);
  const directCandidates = exactKey ? (activeByKey.get(exactKey) ?? []) : [];
  const allCandidates = exactKey ? (allByKey.get(exactKey) ?? []) : [];
  const officialLabel = clean(x.label).toUpperCase();
  const labelCandidates = allCandidates.filter(c => clean(c.label).toUpperCase() === officialLabel);
  const aliasesForType = aliases[typeNorm(x.sigla)] ?? [typeNorm(x.sigla)];
  const aliasCandidates = pgAll.filter(c => aliasesForType.includes(typeNorm(c.type)) && num(c.number) === num(x.number) && num(c.year) === num(x.year));
  const parsed = parseProcess(x.processId);
  const hasAtom = (await q(`SELECT 1 FROM civica_poc.proposal_detail_atoms WHERE source='senado' AND proposal_id=$1 LIMIT 1`, [x.officialMatterId])).length > 0;
  const hasAnyRelation = (await q(`SELECT 1 FROM civica_poc.proposal_parent_context WHERE (child_source='senado' AND child_external_id=$1) OR (parent_source='senado' AND parent_external_id=$1) LIMIT 1`, [x.officialMatterId])).length > 0;
  let category = 'OFFICIAL_SOURCE_ONLY';
  let reason = 'official list row has no canonical PG proposal';
  if (directCandidates.length === 1 || labelCandidates.length === 1) { category = 'MATCHABLE_BY_OFFICIAL_PROCESS_LABEL'; reason = 'deterministic type+number+year or exact label candidate exists'; }
  else if (directCandidates.length > 1 || labelCandidates.length > 1 || aliasCandidates.length > 1) { category = 'IDENTITY_NORMALIZATION_ERROR'; reason = 'key resolves to multiple PG candidates; no safe choice'; }
  else if (allCandidates.length === 0 && !hasAtom && !hasAnyRelation) category = 'MISSING_FROM_PG_CATALOG';
  else if (aliasCandidates.length === 1 && !directCandidates.length) { category = 'IDENTITY_NORMALIZATION_ERROR'; reason = `official type ${x.sigla} requires verified alias ${aliasCandidates[0].type}`; }
  else if (!pgTypeSet.has(typeNorm(x.sigla))) category = 'TYPE_NOT_COLLECTED';
  const rec = { officialMatterId: x.officialMatterId, processId: x.processId, sigla: x.sigla, number: x.number, year: x.year, label: x.label, officialUrl: x.url, parsedProcess: parsed, pgExternalId: labelCandidates[0]?.external_id ?? directCandidates[0]?.external_id ?? null, pgCandidates: [...new Map([...directCandidates, ...aliasCandidates].map(c => [String(c.external_id), { external_id: c.external_id, type: c.type, number: c.number, year: c.year, label: c.label, batch_id: c.batch_id }])).values()], category, reason, hasAtom, hasAnyRelation, missingNorm: missingNormIds.has(x.officialMatterId) };
  categories.push(rec); diagnostics.push(rec);
}
const counts = Object.fromEntries([...new Set(categories.map(x => x.category))].map(c => [c, categories.filter(x => x.category === c).length]));
const byType = Object.fromEntries([...new Set(unmatched.map(x => typeNorm(x.sigla)))].map(type => [type, unmatched.filter(x => typeNorm(x.sigla) === type).length]));
const byYear = Object.fromEntries([...new Set(unmatched.map(x => x.year))].map(year => [year, unmatched.filter(x => x.year === year).length]));
const byTypeYear = Object.fromEntries([...new Set(unmatched.map(x => `${typeNorm(x.sigla)}|${x.year}`))].map(k => [k, unmatched.filter(x => `${typeNorm(x.sigla)}|${x.year}` === k).length]));
const bridgeRows = await q(`SELECT official_matter_id,pg_proposal_id,match_status,match_level FROM civica_poc.proposal_identity_bridge WHERE source='senado' AND (official_matter_id=ANY($1::text[]) OR pg_proposal_id=ANY($1::text[]))`, [[...missingNormIds]]);
const bridgeById = new Map(bridgeRows.flatMap(x => [x.official_matter_id, x.pg_proposal_id].filter(Boolean).map(id => [String(id), x] as const)));
const normRows = await q(`SELECT proposal_id,count(*)::int n FROM civica_poc.proposal_detail_atoms WHERE source='senado' AND kind='resulting_norm' AND proposal_id=ANY($1::text[]) GROUP BY proposal_id`, [[...missingNormIds]]);
const normById = new Map(normRows.map(x => [String(x.proposal_id), Number(x.n)]));
const missingNormCrosscheck = [...missingNormIds].map(id => { const row = categories.find(x => x.officialMatterId === id); const bridge = bridgeById.get(id); const canonical = pgById.get(id); return { missingNormProposalId: id, inUnmatchedIdentitySet: Boolean(row), bridgeStatus: bridge?.match_status ?? (canonical ? 'NOT_IN_ACTIVE_OFFICIAL_BRIDGE' : 'NO_CANONICAL_PROPOSAL'), bridgeLevel: bridge?.match_level ?? null, canonicalPgProposal: bridge?.pg_proposal_id ?? canonical?.external_id ?? null, normRowPresent: Boolean(normById.get(id)), normRows: normById.get(id) ?? 0, relationPresent: row?.hasAnyRelation ?? false, category: row?.category ?? null }; });
const result = { source: 'senado', database: env.DB_NAME, officialTotal: officials.length, matchedById: officials.length - unmatched.length, unmatched: unmatched.length, activePgRows: pgActive.length, allPgRows: pgAll.length, parsePatterns: Object.fromEntries(patterns), unmatchedByType: byType, unmatchedByYear: byYear, unmatchedByTypeYear: byTypeYear, categoryCounts: counts, identityStrategy: { whyLevelBZero: 'The 352 rows have no unique type+number+year candidate in the active PG catalog; colliding REQ keys are committee-scoped and labels differ. Numeric IdentificacaoProcesso values are process IDs, not proposal keys.', whyLevelCZero: 'No unresolved row has a unique exact normalized official label in all PG proposals; label-only candidates are absent or collide.', aliasesConsidered: aliases } };
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/r1_6_identity_strategy_diagnostics.json', JSON.stringify({ ...result, rows: diagnostics }, null, 2));
await writeFile('artifacts/r1_6_unmatched_classification.json', JSON.stringify({ source: 'senado', total: categories.length, counts, rows: categories }, null, 2));
await writeFile('artifacts/r1_6_missing_norm_crosscheck.json', JSON.stringify({ total: missingNormCrosscheck.length, linkedToUnmatched: missingNormCrosscheck.filter(x => x.inUnmatchedIdentitySet).length, rows: missingNormCrosscheck }, null, 2));
console.log(JSON.stringify({ ...result, missingNormCrosscheck }, null, 2));
await pool.end();
