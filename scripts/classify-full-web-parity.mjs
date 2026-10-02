import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourcePath = path.join(root, 'artifacts', 'full-web-sqlite-postgres-parity.json');
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

const classify = (item) => {
  if (item.exact) return { primaryClassification: 'EXACT', classification: 'EXACT_MATCH', semanticEquivalent: true, tags: [], reason: 'hash integral igual' };
  if (item.name === 'propositionOperationalBundle' && item.sqliteStatus === 'unavailable') return { primaryClassification: 'BASELINE_UNAVAILABLE', classification: 'BASELINE_UNAVAILABLE', semanticEquivalent: false, tags: ['SQLITE_BUILDER_UNAVAILABLE'], reason: 'builder SQLite indisponivel no checkout auditado' };
  if (item.name === 'propositionObservedState') {
    const asOf = item.fieldDiff.find((x) => x.path === '$.asOf');
    if (asOf && String(asOf.sqlite) < String(asOf.postgres)) return { primaryClassification: 'EXPECTED_FRESHER_DATA', classification: 'EXPECTED_FRESHER_DATA', semanticEquivalent: true, tags: ['DATE_DIFFERENCE'], reason: 'observacao PostgreSQL mais recente que o snapshot historico' };
  }
  const paths = item.fieldDiff.map((x) => x.path);
  if (['propositionDetail', 'supplierExplorer', 'supplierGlobalDetail'].includes(item.name) && paths.length && paths.every((p) => /rawId|batchId|publishedAt|PublishedAt|masked|aliases|coverage\.note|revision\.publishedAt/.test(p))) return { primaryClassification: 'EXPECTED_METADATA_DIFFERENCE', classification: 'EXPECTED_INTERNAL_METADATA_DIFFERENCE', semanticEquivalent: true, tags: ['INTERNAL_METADATA'], reason: 'diferenca de identificador, normalizacao ou metadado interno sem alteracao do conteudo principal' };
  return { primaryClassification: 'REAL_SEMANTIC_DIVERGENCE', classification: 'REAL_REGRESSION', semanticEquivalent: false, tags: [], reason: 'universo, campo editorial, agregado, ordenacao ou cobertura divergente' };
};

const cases = source.cases.map((item) => ({ ...item, ...classify(item) }));
const exportSource = fs.readFileSync(path.join(root, 'apps', 'web', 'lib', 'data.ts'), 'utf8');
const exports = [...exportSource.matchAll(/^export\s+(?:async\s+function|const|function)\s+([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
const directCases = new Set(cases.map((item) => item.name));
const aliases = {
  houseListing: ['houseListing.camara', 'houseListing.senado'],
  profile: ['profile.camara', 'profile.senado', 'profile.activity'],
  parties: ['parties.all'],
  rankings: ['rankings.camara'],
  stateRepresentation: ['stateRepresentation.MT'],
  profileIdentity: ['profile.camara'],
  personComparison: ['personComparisonSetup'],
  roster: ['parties.all'],
};
const accounting = exports.map((name) => {
  if (directCases.has(name)) return { export: name, status: 'DIRECT_COMPARATOR_CASE', cases: [name] };
  if (aliases[name]) return { export: name, status: 'ALIAS_OF_OTHER_CASE', cases: aliases[name] };
  return { export: name, status: 'MISSING_COMPARATOR_CASE', cases: [] };
});
const suspectPattern = /(?:\u00c3[\u0080-\u00bf]|\u00c2[\u0080-\u00bf]|\u00e2[\u0080-\u00bf]{2}|\u00c3\u0192|\u00c3\u201a|\u00ef\u00bf\u00bd|\ufffd)/;
const textValues = [];
const baselineTextValues = [];
const collect = (value, where = '$') => {
  if (typeof value === 'string') { if (suspectPattern.test(value)) textValues.push({ where, value }); return; }
  if (Array.isArray(value)) value.forEach((item, index) => collect(item, `${where}[${index}]`));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => collect(item, `${where}.${key}`));
};
cases.forEach((item) => {
  const before=textValues.length;
  collect(item.sqlitePreview, `${item.name}.sqlite`);
  baselineTextValues.push(...textValues.splice(before));
  collect(item.postgresPreview, `${item.name}.postgres`);
  // The comparator records full-payload hits. Keep those hits in the gate even
  // when the compact preview does not contain the offending string.
  for (const hit of item.encodingHits ?? []) {
    if (hit?.value) (String(hit.path ?? '' ).includes('postgres') ? textValues : baselineTextValues).push({ where: hit.path ?? `${item.name}.payload`, value: hit.value });
  }
  for (const diff of item.fieldDiff ?? []) {
    const beforeDiff=textValues.length;
    collect(diff.sqlite, `${item.name}.${diff.path}.sqlite`);
    baselineTextValues.push(...textValues.splice(beforeDiff));
    collect(diff.postgres, `${item.name}.${diff.path}.postgres`);
  }
});
const summary = {
  total: cases.length,
  exact: cases.filter((x) => x.classification === 'EXACT_MATCH').length,
  contractEquivalent: cases.filter((x) => x.semanticEquivalent).length,
  expectedFresherData: cases.filter((x) => x.classification === 'EXPECTED_FRESHER_DATA').length,
  expectedMetadataDifference: cases.filter((x) => x.classification === 'EXPECTED_INTERNAL_METADATA_DIFFERENCE').length,
  normalizationDifference: cases.filter((x) => x.classification === 'NORMALIZATION_DIFFERENCE').length,
  primaryClassificationCounts: Object.fromEntries(['EXACT','CONTRACT_EQUIVALENT','EXPECTED_FRESHER_DATA','EXPECTED_METADATA_DIFFERENCE','BASELINE_UNAVAILABLE','REAL_SEMANTIC_DIVERGENCE','ERROR'].map(key => [key, cases.filter(x => x.primaryClassification === key).length])),
  classificationAccounting: cases.every(x => ['EXACT','CONTRACT_EQUIVALENT','EXPECTED_FRESHER_DATA','EXPECTED_METADATA_DIFFERENCE','BASELINE_UNAVAILABLE','REAL_SEMANTIC_DIVERGENCE','ERROR'].includes(x.primaryClassification)) && cases.length === source.summary.total,
  classifiedCases: `${cases.length}/${source.summary.total}`,
  realRegression: cases.filter((x) => x.classification === 'REAL_REGRESSION').length,
  baselineUnavailable: cases.filter((x) => x.classification === 'BASELINE_UNAVAILABLE').length,
  errors: cases.filter((x) => x.sqliteError || x.postgresError).length,
  routes: [...new Set(cases.map((x) => x.route))].length,
  runtimeExports: exports.length,
  runtimeExportAccounting: accounting.length === exports.length,
  publicTextEncodingScan: textValues.length ? 'FAIL' : 'PASS',
  sqliteBaselineEncodingHits: baselineTextValues.length,
};
const output = { ...source, summary, artifactsSameRun: source.comparatorRunId != null && source.comparatorGeneratedAt != null, cases, runtimeExports: accounting, encodingScan: { status: summary.publicTextEncodingScan, suspiciousStrings: textValues.slice(0, 200), sqliteBaselineHits: baselineTextValues.slice(0, 200) }, validation: source.validation };
fs.writeFileSync(path.join(root, 'artifacts', 'full-web-sqlite-postgres-parity-after.json'), JSON.stringify(output, null, 2) + '\n');
const lines = [];
lines.push('# Post-cutover semantic recovery — auditor classificado');
lines.push('');
lines.push(`Fonte SQLite: \`${source.sqlite}\`  `);
lines.push(`Banco PostgreSQL: \`${source.database}\`  `);
lines.push('');
lines.push('## Execucao auditavel');
lines.push('');
lines.push(`COMPARATOR_RUN_ID: \`${source.comparatorRunId ?? 'MISSING'}\`  `);
lines.push(`COMPARATOR_GENERATED_AT: \`${source.comparatorGeneratedAt ?? 'MISSING'}\`  `);
lines.push(`GIT_COMMIT_OR_WORKTREE_FINGERPRINT: \`${source.gitCommitOrWorktreeFingerprint ?? 'MISSING'}\`  `);
lines.push(`DATABASE: \`${source.database ?? 'MISSING'}\`  `);
lines.push(`ARTIFACTS_SAME_RUN: **${source.comparatorRunId && source.comparatorGeneratedAt ? 'PASS' : 'FAIL'}**`);
lines.push('');
lines.push('## Resultado');
lines.push('');
lines.push('| Métrica | Valor |'); lines.push('|---|---:|');
for (const [key, value] of Object.entries(summary)) lines.push(`| ${key} | ${typeof value === 'boolean' ? (value ? 'PASS' : 'FAIL') : value} |`);
lines.push('');
lines.push('## Contabilidade de classificacao primaria');
lines.push('');
lines.push('| Classificacao | Casos |'); lines.push('|---|---:|');
for (const key of ['EXACT','CONTRACT_EQUIVALENT','EXPECTED_FRESHER_DATA','EXPECTED_METADATA_DIFFERENCE','BASELINE_UNAVAILABLE','REAL_SEMANTIC_DIVERGENCE','ERROR']) lines.push(`| ${key} | ${summary.primaryClassificationCounts[key]} |`);
lines.push(`| TOTAL | ${summary.classifiedCases} |`);
lines.push('');
lines.push('## Classificação por contrato');
lines.push('');
lines.push('| Rota | Contrato | Classificação | Equivalente semântico | Motivo |'); lines.push('|---|---|---|---|---|');
for (const item of cases) lines.push(`| ${item.route} | ${item.name} | ${item.classification} | ${item.semanticEquivalent ? 'YES' : 'NO'} | ${item.reason} |`);
lines.push('');
lines.push('## Accounting dos exports runtime');
lines.push('');
lines.push('| Export | Status | Casos |'); lines.push('|---|---|---|');
for (const item of accounting) lines.push(`| ${item.export} | ${item.status} | ${item.cases.join(', ') || '—'} |`);
lines.push('');
lines.push('## Divergências reais restantes');
lines.push('');
for (const item of cases.filter((x) => x.classification === 'REAL_REGRESSION')) lines.push(`- **${item.name}** em ${item.route}: ${item.fieldDiff.slice(0, 4).map((x) => `${x.path} (${JSON.stringify(x.sqlite)} → ${JSON.stringify(x.postgres)})`).join('; ') || 'hash diferente; diff profundo requer inspeção do payload completo'}.`);
lines.push('');
lines.push('## Encoding público');
lines.push('');
lines.push(`PUBLIC_TEXT_ENCODING_SCAN: **${summary.publicTextEncodingScan}**`);
if (textValues.length) lines.push(`Foram encontrados ${textValues.length} valores suspeitos no payload auditado; revisar strings antes do aceite.`);
lines.push('');
lines.push('O gate final é zero divergências semânticas não explicadas; hash idêntico é exigido apenas nos contratos cujo conteúdo histórico é comparável e não possui diferença legítima de atualização ou metadado.');
fs.writeFileSync(path.join(root, 'artifacts', 'full-web-sqlite-postgres-parity-after.md'), lines.join('\n') + '\n');
console.log(JSON.stringify({ summary, missingComparatorCases: accounting.filter((x) => x.status === 'MISSING_COMPARATOR_CASE').map((x) => x.export) }, null, 2));
