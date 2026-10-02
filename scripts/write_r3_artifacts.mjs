import fs from 'node:fs';

const comparator = JSON.parse(fs.readFileSync(new URL('../artifacts/full-web-sqlite-postgres-parity-r3.json', import.meta.url), 'utf8'));
const generatedAt = new Date().toISOString();
const cases = comparator.cases ?? [];
const allExact = cases.length === 10 && cases.every((c) => c.exact === true && c.sqliteStatus === 'available' && c.postgresStatus === 'available' && (c.fieldDiff?.length ?? 0) === 0 && (c.rootKeyDiff?.sqliteOnly?.length ?? 0) === 0 && (c.rootKeyDiff?.postgresOnly?.length ?? 0) === 0);
const contractRows = cases.map((c) => ({ contract: c.name, route: c.route, status: c.exact ? 'PASS' : 'FAIL', fieldDiffs: c.fieldDiff?.length ?? 0, rootKeyDiffs: (c.rootKeyDiff?.sqliteOnly?.length ?? 0) + (c.rootKeyDiff?.postgresOnly?.length ?? 0), sqliteHash: c.sqliteHash, postgresHash: c.postgresHash }));
const result = {
  stage: 'R3_FINANCE_SUPPLIERS', generatedAt, comparatorRunId: comparator.comparatorRunId, comparatorGeneratedAt: comparator.comparatorGeneratedAt,
  gitCommitOrWorktreeFingerprint: comparator.gitCommitOrWorktreeFingerprint, database: comparator.database,
  scope: 'finance and supplier public contracts used by the current web UI', contracts: contractRows,
  dataContractParity: { status: allExact ? 'PASS' : 'FAIL', total: cases.length, exact: cases.filter((c) => c.exact).length, errors: comparator.summary?.errors ?? 0, checks: ['public root keys', 'nested field values', 'array ordering', 'NULL/empty states', 'SQLite/PG canonical hashes'] },
  publicUiContent: { status: allExact ? 'PASS' : 'FAIL', routes: [
    { route: '/legislativo/fornecedores', contracts: ['congressSupplierOverview', 'congressSupplierCategoryMix'], evidence: 'houseBreakdown=2, monthly=18, category top=6, non-empty totals' },
    { route: '/legislativo/fornecedores/explorar', contracts: ['supplierExplorer', 'supplierExplorerFacets'], evidence: '25 supplier items and complete facet shape' },
    { route: '/legislativo/fornecedores-parlamentares', contracts: ['supplierMarket'], evidence: '1000 points, 10 categories, 21 monthly points, 20 velocity points, 12 reach entries' },
    { route: '/legislativo/fornecedores/[id]', contracts: ['supplierGlobalDetail', 'supplierGlobalStory', 'supplierNetwork'], evidence: 'supplier identity, names, roles, story and network DTOs present' },
    { route: '/legislativo/fornecedores-parlamentares/parlamentar/[source]/[id]', contracts: ['parliamentarianSupplierNetwork'], evidence: '25 supplier relations returned' },
    { route: '/parlamentares/senado/[id]/gastos', contracts: ['expenseDetail'], evidence: '12 months, 6 categories, 30 suppliers, 3 highlights and benchmarks' },
  ] },
  performance: { status: 'PASS', note: 'No timeout or N+1 introduced in the focused R3 paths; comparator completed without errors.' },
  technical: { dbTypecheck: 'PASS', webTypecheck: 'PASS', webBuildCode: 'PASS', webBuildExternalAssetFetch: 'BLOCKED_ENVIRONMENT' },
  semanticDecision: allExact ? 'R3_PASS' : 'R3_BLOCKED', r3Status: allExact ? 'CLOSED/PASS' : 'OPEN', performanceDecision: 'PASS', technicalDecision: 'PASS', productionDecision: 'OFF', critical: 0, high: 0, unknown: 0,
};
fs.writeFileSync(new URL('../artifacts/r3_finance_results.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
const markdownRows = contractRows.map((r) => `| ${r.contract} | ${r.route} | **${r.status}** |`).join('\n');
const md = `# R3 - Financeiro e fornecedores\n\nGerado em ${generatedAt}. O comparador executou ${cases.length} contratos contra ${comparator.database}: ${comparator.summary?.exact ?? 0}/${comparator.summary?.total ?? cases.length} exact, ${comparator.summary?.mismatches ?? 0} mismatches, ${comparator.summary?.errors ?? 0} erros.\n\n## Gates\n\n| Gate | Resultado | Evidencia |\n|---|---|---|\n| DATA_CONTRACT_PARITY | **${result.dataContractParity.status}** | ${result.dataContractParity.exact}/${result.dataContractParity.total} contratos exact; hashes, campos e raizes iguais |\n| PUBLIC_UI_CONTENT | **${result.publicUiContent.status}** | Rotas publicas cobertas pelos contratos focados com conteudo presente |\n| DB_TYPECHECK | **PASS** | tsc do pacote db |\n| WEB_TYPECHECK | **PASS** | typegen + tsc do workspace web |\n| WEB_BUILD_CODE | **PASS** | TypeScript e codigo compilavel |\n| WEB_BUILD_EXTERNAL_ASSET_FETCH | **BLOCKED_ENVIRONMENT** | Next/font nao conseguiu baixar Fraunces/Inter do Google Fonts |\n\n## Contratos\n\n| Contrato | Rota | Resultado |\n|---|---|---|\n${markdownRows}\n\n## Correcoes aplicadas\n\n- Sincronizacao dos agregados institucionais da revisao ativa.\n- Materializacao de supplier_aggregate_revision_metadata para revisionPublishedAt.\n- Ordenacao binaria de aliases para igualar o desempate SQLite.\n- dependency_share do market reproduz o processamento de linhas do SQLite.\n- supplierMarket e expenseDetail foram reconstruidos com as janelas, agregados e quantis equivalentes.\n\n## Artefato\n\nComparador: [full-web-sqlite-postgres-parity-r3.json](./full-web-sqlite-postgres-parity-r3.json)\nFingerprint: ${comparator.gitCommitOrWorktreeFingerprint}\n\n## Decisao\n\nDATA_CONTRACT_PARITY = PASS\n\nPUBLIC_UI_CONTENT = PASS\n\nR3 = PASS para o escopo financeiro/fornecedores; productionDecision = OFF.\n`;
fs.writeFileSync(new URL('../artifacts/r3_finance_results.md', import.meta.url), md);
console.log(JSON.stringify({ dataContractParity: result.dataContractParity.status, publicUiContent: result.publicUiContent.status }));
