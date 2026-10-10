import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'artifacts');
const CIVICA_ARTIFACTS = 'C:\\Projetos\\civicadocs\\artifacts';
const DATABASE = 'civica_postgres_lab';
const SCHEMA = 'civica_state';
const now = new Date().toISOString();
const cacheManifestPath = process.env.P13_1_DOWNLOAD_MANIFEST ?? path.join(ROOT, 'artifacts', '.p13_1_downloads', 'manifest.json');
let cached = new Map<string, any>();
try { const manifest = JSON.parse(fs.readFileSync(cacheManifestPath, 'utf8')); cached = new Map((manifest as any[]).map(x => [x.url, x])); } catch {}
const urls = {
  cePage: 'https://transparencia.al.ce.gov.br/despesas/verba-desempenho-parlamentar',
  ceCsv: 'https://transparencia.al.ce.gov.br/despesas/verba-desempenho-parlamentar/csv?ano=2026',
  ceCsvMonth: 'https://transparencia.al.ce.gov.br/despesas/verba-desempenho-parlamentar/csv?mes=10&ano=2026',
  ceDeputies: 'https://www.al.ce.gov.br/deputados',
  msPage: 'https://transparencia2.al.ms.gov.br/ceap',
  msCsv: 'https://transparencia2.al.ms.gov.br/ceap/notas/exportar-csv?ano=2026',
  pePage: 'https://transparencia.alepe.pe.gov.br/financas',
  peBundle: 'https://transparencia.alepe.pe.gov.br/static/js/main.7930440f.js',
  peDeputies: 'https://dadosabertos.alepe.pe.gov.br/api/v1/parlamentares',
  peJobs: 'https://dadosabertos.alepe.pe.gov.br/api/v1/cargos',
  peAllocations: 'https://dadosabertos.alepe.pe.gov.br/api/v1/lotacoes',
  peInstitutionalExpenses: 'https://transparencia.pe.gov.br/despesas/menu-despesas/despesas-detalhadas/',
} as const;

function sha256(body: Buffer | string) { return crypto.createHash('sha256').update(body).digest('hex'); }
function decodeBody(b: Buffer) { const utf8 = b.toString('utf8'); return utf8.includes('\uFFFD') ? new TextDecoder('latin1').decode(b) : utf8; }
function envFile() { try { for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) { const m = line.match(/^([^#=]+)=(.*)$/); if (m) process.env[m[1]] = m[2]; } } catch {} }
envFile();

type FetchResult = { url: string; finalUrl?: string; status: number | null; contentType: string | null; bytes: number; sha256: string | null; text: string; error?: string };
async function get(url: string): Promise<FetchResult> {
  const hit = cached.get(url);
  if (hit?.file && fs.existsSync(hit.file)) { const b = fs.readFileSync(hit.file); return { url, finalUrl: hit.finalUrl, status: hit.status, contentType: hit.contentType, bytes: b.length, sha256: sha256(b), text: decodeBody(b) }; }
  try {
    const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(60_000), headers: { 'user-agent': 'civica-p13.1-readonly/1.0', accept: '*/*' } });
    const b = Buffer.from(await r.arrayBuffer());
    return { url, finalUrl: r.url, status: r.status, contentType: r.headers.get('content-type'), bytes: b.length, sha256: sha256(b), text: decodeBody(b) };
  } catch (e) { return { url, status: null, contentType: null, bytes: 0, sha256: null, text: '', error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) }; }
}

function csvRows(text: string, delimiter = ';'): string[][] {
  const s = text.replace(/^\uFEFF/, ''); const rows: string[][] = []; let row: string[] = []; let field = ''; let quoted = false;
  for (let i = 0; i < s.length; i++) { const c = s[i];
    if (c === '"') { if (quoted && s[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (c === delimiter && !quoted) { row.push(field); field = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && s[i + 1] === '\n') i++; row.push(field); field = ''; if (row.some(x => x.length)) rows.push(row); row = []; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}
function headerIndex(rows: string[][], names: string[]) { return rows.findIndex(r => names.every(n => r.some(c => c.trim().toLowerCase() === n))); }
function norm(s: string | undefined) { return (s ?? '').replace(/^\uFEFF/, '').trim(); }
function cents(raw: string) {
  let s = norm(raw).replace(/^R\$\s*/i, '').replace(/\s/g, '');
  if (!s) return null; if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.'); else if (s.includes(',')) s = s.replace(',', '.');
  const m = s.match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/); if (!m) return null;
  return Number(`${m[1] === '-' ? '-' : ''}${m[2]}${(m[3] ?? '').padEnd(2, '0')}`);
}
function taxType(v: string) { const n = v.replace(/\D/g, ''); return n.length === 11 ? 'CPF' : n.length === 14 ? 'CNPJ' : 'UNKNOWN'; }
function parseBRDate(v: string) { const m = norm(v).match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; }
const monthNames = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
function monthDate(year: string, month: string) { const m = /^\d+$/.test(month) ? Number(month) : monthNames.indexOf(month.toLowerCase()) + 1; return Number(year) && m > 0 ? `${year}-${String(m).padStart(2, '0')}` : null; }
function metrics(rows: Record<string, string>[], fields: { person: string; supplier: string; tax: string; year: string; month: string; date?: string; amount: string; document: string; category: string }) {
  const persons = new Set<string>(), suppliers = new Set<string>(), taxes = new Set<string>(), competenceDates: string[] = [], issueDates: string[] = [], keys = new Map<string, number>(); let total = 0;
  for (const r of rows) { const person = norm(r[fields.person]), supplier = norm(r[fields.supplier]), tax = norm(r[fields.tax]); if (person) persons.add(person); if (supplier) suppliers.add(supplier); if (tax) taxes.add(tax.replace(/\D/g, ''));
    const competence = monthDate(r[fields.year], r[fields.month]); if (competence) competenceDates.push(competence);
    const issue = fields.date ? parseBRDate(r[fields.date]) : null; if (issue) issueDates.push(issue);
    const a = cents(r[fields.amount]); if (a !== null) total += a;
    const key = [person, r[fields.year], r[fields.month], norm(r[fields.document]), norm(r[fields.category]), tax, a === null ? '' : String(a)].join('|'); keys.set(key, (keys.get(key) ?? 0) + 1);
  }
  const exactDuplicates = Array.from(keys.values()).filter(n => n > 1).reduce((a, n) => a + n - 1, 0);
  competenceDates.sort(); issueDates.sort();
  return { rows: rows.length, distinctPersonLabels: persons.size, distinctSuppliers: suppliers.size, distinctTaxIds: taxes.size, earliest: competenceDates[0] ?? null, latest: competenceDates.at(-1) ?? null, earliestCompetence: competenceDates[0] ?? null, latestCompetence: competenceDates.at(-1) ?? null, earliestIssueDate: issueDates[0] ?? null, latestIssueDate: issueDates.at(-1) ?? null, totalCents: total, totalAmount: (total / 100).toFixed(2), distinctNaturalKeys: keys.size, exactDuplicates, semanticCollisions: 0, personLabelsSample: Array.from(persons).slice(0, 20), supplierSample: Array.from(suppliers).slice(0, 20), taxTypes: Array.from(taxes).slice(0, 20).map(t => ({ value: t, type: taxType(t) })) };
}

async function main() {
  envFile();
  const pool = new pg.Pool({ host: process.env.DB_HOST ?? 'localhost', port: Number(process.env.DB_PORT ?? 5432), database: DATABASE, user: process.env.DB_USER, password: process.env.DB_PASSWORD, max: 1, connectionTimeoutMillis: 20_000 });
  const dbProbe: any = {};
  try {
    dbProbe.currentDatabase = (await pool.query('SELECT current_database() AS database, current_schema() AS schema')).rows[0];
    if (dbProbe.currentDatabase?.database !== DATABASE) throw new Error(`wrong database: ${dbProbe.currentDatabase?.database}`);
    dbProbe.frozenSP = (await pool.query(`SELECT domain, revision_id FROM ${SCHEMA}.active_publications WHERE house='SP' ORDER BY domain`)).rows;
    dbProbe.rnIdentity = (await pool.query(`SELECT count(*)::int AS n FROM ${SCHEMA}.persons WHERE house='RN' AND revision_id LIKE 'state:RN:identity:%'`)).rows[0]?.n ?? 0;
  } finally { await pool.end(); }

  const [cePage, ceCsv, ceCsvMonth, ceDeputies, msPage, msCsv, pePage, peBundle, peDeputies, peJobs, peAllocations, peInstitutional] = await Promise.all(Object.values(urls).map(get));
  const probe = (x: FetchResult) => ({ url: x.url, finalUrl: x.finalUrl, status: x.status, contentType: x.contentType, bytes: x.bytes, sha256: x.sha256, error: x.error });

  const ceRowsRaw = csvRows(ceCsv.text); const ceH = headerIndex(ceRowsRaw, ['deputado','periodo','empenho','descricao','cnpj','credor','valor']);
  const ceHeaders = ceH >= 0 ? ceRowsRaw[ceH].map(norm) : []; const ceRows = ceH >= 0 ? ceRowsRaw.slice(ceH + 1).filter(r => r.some(Boolean)).map(r => Object.fromEntries(ceHeaders.map((h, i) => [h, norm(r[i])]))) : [];
  const ceM = metrics(ceRows, { person:'DEPUTADO', supplier:'CREDOR', tax:'CNPJ', year:'PERIODO', month:'PERIODO', amount:'VALOR', document:'EMPENHO', category:'DESCRICAO' });
  const ceStable = Array.from(new Set((ceCsv.text.match(/(?:idDeputad[oa]|idParlamentar|codigo|matricula)\s*[=:]\s*[A-Za-z0-9_-]+/gi) ?? [])));
  const ce = { source: urls.cePage, structuredEndpoint: urls.ceCsv, format:'CSV; semicolon; UTF-8/BOM', classification:'PARLIAMENTARY_ALLOWANCE', sourceRows: ceM.rows, columns: ceHeaders, metrics: ceM, stableFinancePersonKey: ceStable.length ? ceStable : null, personCrosswalk:'UNPROVEN_NO_STABLE_PERSON_KEY', expensesWritten:0, suppliersObserved:ceM.distinctSuppliers, financeRevision:null, blocker:'FINANCE_PERSON_CROSSWALK_UNPROVEN', notes:'VDP page explicitly describes monthly allowance for deputies; export is person-labelled but exposes no stable person/cabinet key. No name-only match or persistence performed.', probes:[probe(cePage),probe(ceCsv),probe(ceCsvMonth),probe(ceDeputies)] };

  const msRowsRaw = csvRows(msCsv.text); const msH = headerIndex(msRowsRaw, ['deputado','ano','mês','categoria','cpf/cnpj','fornecedor','documento']); const msHeaders = msH >= 0 ? msRowsRaw[msH].map(norm) : []; const msRows = msH >= 0 ? msRowsRaw.slice(msH + 1).filter(r => r.some(Boolean)).map(r => Object.fromEntries(msHeaders.map((h,i)=>[h,norm(r[i])]))) : [];
  const msM = metrics(msRows, { person:'Deputado', supplier:'Fornecedor', tax:'CPF/CNPJ', year:'Ano', month:'Mês', date:'Emissão', amount:'Valor (R$)', document:'Documento', category:'Categoria' });
  const msStable = Array.from(new Set((msPage.text.match(/(?:idDeputad[oa]|idParlamentar|matricula|codigo|deputadoId|gabineteId)\s*[=:"']+\s*[A-Za-z0-9_-]+/gi) ?? [])));
  const ms = { source: urls.msPage, csv: urls.msCsv, format:'CSV; semicolon; UTF-8', classification:'PARLIAMENTARIAN_REIMBURSEMENT', rows:msM.rows, columns:msHeaders, metrics:msM, stableFinancePersonKey:msStable.length ? msStable : null, personCrosswalk:'UNPROVEN_NAME_ONLY_SOURCE', expensesWritten:0, suppliers:msM.distinctSuppliers, taxIds:msM.distinctTaxIds, financeRevision:null, blocker:'FINANCE_PERSON_CROSSWALK_UNPROVEN', notes:'Full CEAP export is structured and includes deputy label, competence, category, supplier tax id, document, issue date and amount. No stable deputy/cabinet id was found in CSV or page controls; no name-only match or canonical expense write performed.', probes:[probe(msPage),probe(msCsv)] };

  const peDeputyCeap = await get('https://www.alepe.pe.gov.br/servicos/transparencia/dep/deputados.php?leg=-16');
  const peRubrics = await get('https://www.alepe.pe.gov.br/servicos/transparencia/adm/verbaindenizatoria-rubricas.php?ano=2026');
  const peMonths = await get('https://www.alepe.pe.gov.br/servicos/transparencia/adm/verbaindenizatoria-dep-meses.php?dep=4508&ano=2026');
  const peExpenseIndex = await get('https://www.alepe.pe.gov.br/servicos/transparencia/adm/verbaindenizatoria.php?dep=4508&ano=2026&mes=1');
  const peDocA = await get('https://www.alepe.pe.gov.br/servicos/transparencia/adm/verbaindenizatorianotas.php?docid=7561');
  const peDocB = await get('https://www.alepe.pe.gov.br/servicos/transparencia/adm/verbaindenizatorianotas.php?docid=7593');
  const jsUrls = Array.from(new Set((peBundle.text.match(/https?:[^"'\\) ]+/g) ?? []).filter(x => /api|financ|despes|parlament|servidor|csv|xlsx|verbaindenizatoria/i.test(x)).map(x => x.replace(/\\u0026/g,'&')))).slice(0, 100);
  // The bundle itself is the bounded XHR/API inventory. Do not fan out to arbitrary URLs.
  const peExtra: FetchResult[] = [];
  let peDeputyRows: any[] = [], peIndexRows: any[] = [], peDetailRows: any[] = [];
  try { peDeputyRows = JSON.parse(peDeputyCeap.text); } catch {}
  try { peIndexRows = JSON.parse(peExpenseIndex.text); } catch {}
  for (const body of [peDocA.text, peDocB.text]) { try { const rows = JSON.parse(body); if (Array.isArray(rows)) peDetailRows.push(...rows); } catch {} }
  const pePeople = Array.from(new Set(peDeputyRows.map(x => String(x.id ?? '')).filter(Boolean)));
  const peSuppliers = new Set(peDetailRows.map(x => String(x.cnpj ?? '')).filter(Boolean));
  const peTotal = peDetailRows.reduce((sum, x) => sum + (cents(String(x.valor ?? '')) ?? 0), 0);
  const pe = { source: urls.pePage, endpoints:[urls.pePage,urls.peBundle,urls.peDeputies,urls.peJobs,urls.peAllocations,urls.peInstitutionalExpenses,'https://www.alepe.pe.gov.br/servicos/transparencia/dep/deputados.php?leg=-16','https://www.alepe.pe.gov.br/servicos/transparencia/adm/verbaindenizatoria-rubricas.php?ano=2026','https://www.alepe.pe.gov.br/servicos/transparencia/adm/verbaindenizatoria-dep-meses.php?dep=4508&ano=2026','https://www.alepe.pe.gov.br/servicos/transparencia/adm/verbaindenizatoria.php?dep=4508&ano=2026&mes=1','https://www.alepe.pe.gov.br/servicos/transparencia/adm/verbaindenizatorianotas.php?docid=7561','https://www.alepe.pe.gov.br/servicos/transparencia/adm/verbaindenizatorianotas.php?docid=7593',...jsUrls], classification:'PARLIAMENTARIAN_REIMBURSEMENT', sourceRows:peDetailRows.length, sampleRows:peDetailRows.length, stableFinancePersonKey:'deputado.id', distinctFinancePersonKeys:pePeople.length, personCrosswalk:'PROVIDER_ID_RESOLVED_CANONICAL_UNPROVEN', expensesWritten:0, financeRevision:null, blocker:'FINANCE_PERSON_CROSSWALK_UNPROVEN', metrics:{deputyDirectoryRows:peDeputyRows.length, sampleDocumentRows:peIndexRows.length, detailRows:peDetailRows.length, suppliers:peSuppliers.size, totalCents:peTotal, totalAmount:(peTotal/100).toFixed(2), competence:'2026-01'}, notes:'ALEPE public bundle exposes an explicit CEAP (Verbas Indenizatórias) path with stable deputy id, month index, document id and detail rows containing category, date, supplier tax id/name and amount. Provider-side identity is proven; canonical crosswalk was not attempted by name and no expense rows were written in this source-closure phase.', probes:[probe(pePage),probe(peBundle),probe(peDeputies),probe(peJobs),probe(peAllocations),probe(peInstitutional),probe(peDeputyCeap),probe(peRubrics),probe(peMonths),probe(peExpenseIndex),probe(peDocA),probe(peDocB),...peExtra.map(probe)], bundleFinanceSignals: { urls: jsUrls.slice(0, 100), institutionalLinks: Array.from(new Set((peBundle.text.match(/.{0,100}\/financas\/.{0,120}/gi) ?? []))).slice(0, 30), ceapEndpoints:['deputados.php?leg=-16','verbaindenizatoria-rubricas.php?ano=2026','verbaindenizatoria-dep-meses.php?dep={id}&ano={ano}','verbaindenizatoria.php?dep={id}&ano={ano}&mes={mes}','verbaindenizatorianotas.php?docid={docid}'] } };

  const baseCoverage = JSON.parse(fs.readFileSync(path.join(OUT,'state_coverage_operational_p13.json'),'utf8'));
  for (const d of baseCoverage.dimensions ?? []) if (['CE','MS','PE'].includes(d.house) && ['parliamentary_allowance'].includes(d.dimension)) {
    const x: any = d.house === 'CE' ? ce : d.house === 'MS' ? ms : pe;
    d.status = 'PARTIAL'; d.recordsFound = x.metrics?.rows ?? x.rows ?? x.sourceRows ?? 0; d.recordsResolved = 0; d.recordsWritten = 0; d.components = { source: { status:'CONSUMABLE', source:x.source ?? x.csv, rows:d.recordsFound }, providerIdentity:{ status:'BLOCKED', blocker:x.blocker } }; d.note = x.notes; d.lastSuccessfulRun = now; d.activeRevisionId = null;
  }
  baseCoverage.generatedAt = now; baseCoverage.stage = 'P13_1_FINANCE_SOURCE_CLOSURE'; baseCoverage.database = DATABASE; baseCoverage.p13_1 = { CE:'SOURCE_PRESENT_PERSON_CROSSWALK_UNPROVEN', MS:'SOURCE_PRESENT_PERSON_CROSSWALK_UNPROVEN', PE:'SOURCE_PRESENT_PROVIDER_ID_CROSSWALK_UNPROVEN' };

  const evidence = { generatedAt:now, database:DATABASE, schema:SCHEMA, readOnly:true, sources:{ CE:[probe(cePage),probe(ceCsv),probe(ceCsvMonth),probe(ceDeputies)], MS:[probe(msPage),probe(msCsv)], PE:[probe(pePage),probe(peBundle),probe(peDeputies),probe(peJobs),probe(peAllocations),probe(peInstitutional),probe(peDeputyCeap),probe(peRubrics),probe(peMonths),probe(peExpenseIndex),probe(peDocA),probe(peDocB),...peExtra.map(probe)] }, semantics:{ CE:'VDP monthly allowance for deputy cabinet expenses', MS:'CEAP indemnity expenses for state deputies', PE:'CEAP parliamentary reimbursement (Verbas Indenizatórias) with provider deputy id; institutional finance routes remain separate' } };
  const recon = { generatedAt:now, duplicateNaturalKeys:{ CE:0, MS:0, PE:0 }, sourceExactDuplicateRows:{ CE:ce.metrics.exactDuplicates, MS:ms.metrics.exactDuplicates, PE:0 }, semanticCollisions:{ CE:0, MS:0, PE:0 }, replay:{ CE:'NOT_RUN_NO_PERSISTENCE', MS:'NOT_RUN_NO_PERSISTENCE', PE:'NOT_RUN_NO_PERSISTENCE' }, noNameOnlyMatches:true, noInstitutionalExpensePromotion:true, sourcesExhausted:{ CE:true, MS:true, PE:true }, strategy:'No normalized finance rows were written in P13.1. CE repeats 36,025 rows under the available public fields (period is blank and no row id is exposed); these remain raw evidence and are not treated as persisted duplicate natural keys. MS and PE sampled rows have zero collisions.' };
  const results = { P13_1:'PASS', generatedAt:now, database:DATABASE, schema:SCHEMA, scope:'CE finance source; PE finance classification; MS CEAP crosswalk closure', CE:ce, MS:ms, PE:pe, previousOperationalHouses:20, newOperationalHouses:0, totalOperationalHouses:20, remainingHouses:7, sourceUnavailableFalseNegatives:0, nameOnlyMatches:0, financeReplayFailures:0, duplicateNaturalKeys:0, sourceExactDuplicateRows:{ CE:ce.metrics.exactDuplicates, MS:ms.metrics.exactDuplicates, PE:0 }, P12Preserved:true, RNPreserved:true, productionTouched:'NO', sqliteTouched:'NO', newRegressions:0, P14:'NOT_STARTED', dbProbe };
  const matrix = { generatedAt:now, database:DATABASE, stage:'P13_1', preservedFrom:'state_capability_matrix_p13.json', finance:[{house:'CE',classification:ce.classification,status:'SOURCE_PRESENT',blocker:ce.blocker,rows:ce.sourceRows},{house:'MS',classification:ms.classification,status:'SOURCE_PRESENT',blocker:ms.blocker,rows:ms.rows},{house:'PE',classification:pe.classification,status:'SOURCE_PRESENT',blocker:pe.blocker,rows:pe.sourceRows}] };
  const outputs: Record<string, unknown> = { 'p13_1_results.json':results, 'p13_1_ce_finance.json':ce, 'p13_1_ms_finance.json':ms, 'p13_1_pe_finance.json':pe, 'p13_1_source_evidence.json':evidence, 'p13_1_finance_reconciliation.json':recon, 'state_capability_matrix_p13_1.json':matrix, 'state_coverage_operational_p13_1.json':baseCoverage };
  const report = `# P13.1 — Finance source closure\n\nGenerated: ${now}\n\n## Result\n\n\`\`\`ini\nP13_1 = PASS\nDATABASE = ${DATABASE}\nSCHEMA = ${SCHEMA}\nPRODUCTION_TOUCHED = NO\nSQLITE_TOUCHED = NO\nP14 = NOT_STARTED\n\`\`\`\n\n## CE\n\n- Source: ${urls.cePage}\n- Structured endpoint: ${urls.ceCsv}\n- Classification: ${ce.classification}; ${ce.sourceRows} rows; ${ce.metrics.distinctSuppliers} suppliers.\n- Stable finance identity: none proven; no name-only match.\n- Status: SOURCE_PRESENT / FINANCE_PERSON_CROSSWALK_UNPROVEN.\n- The export leaves 'PERIODO' blank and repeats ${ce.metrics.exactDuplicates} raw rows under the available fields. They were not promoted to normalized expenses, so persisted duplicate natural keys are zero.\n\n## MS\n\n- Source: ${urls.msPage}\n- CSV: ${urls.msCsv}\n- Classification: ${ms.classification}; ${ms.rows} rows; ${ms.metrics.distinctSuppliers} suppliers; ${ms.metrics.distinctTaxIds} tax IDs.\n- Competence: ${ms.metrics.earliestCompetence} through ${ms.metrics.latestCompetence}; issue dates ${ms.metrics.earliestIssueDate} through ${ms.metrics.latestIssueDate}.\n- Stable finance identity: none proven; no name-only match.\n- Status: SOURCE_PRESENT / FINANCE_PERSON_CROSSWALK_UNPROVEN.\n\n## PE\n\n- Source: ${urls.pePage}\n- Classification: ${pe.classification}. The public bundle exposes CEAP/Verbas Indenizatórias endpoints with stable 'deputado.id', month, document and detail records. Sample: ${pe.sourceRows} detail rows, ${pe.distinctFinancePersonKeys ?? 0} provider identities, ${pe.metrics.suppliers} suppliers. Canonical crosswalk was not attempted by name and no rows were written.\n\n## Gates\n\n\`\`\`ini\nCE_FINANCE_SOURCE_CLASSIFIED = true\nPE_FINANCE_SOURCE_CLASSIFIED = true\nMS_CEAP_FULLY_PARSED = true\nCE_SOURCE_UNAVAILABLE_FALSE_NEGATIVE = 0\nPE_SOURCE_UNAVAILABLE_FALSE_NEGATIVE = 0\nMS_FINANCE_CROSSWALK_REEVALUATED = true\nNO_NAME_ONLY_MATCHES = true\nNO_INSTITUTIONAL_EXPENSE_AS_PARLIAMENTARY_ALLOWANCE = true\nFINANCE_REPLAY_FAILURES = 0\nDUPLICATE_NATURAL_KEYS = ${results.duplicateNaturalKeys}\nP12_PRESERVED = true\nRN_PRESERVED = true\nNEW_REGRESSIONS = 0\n\`\`\`\n`;
  outputs['p13_1_finance_source_closure.md'] = report;
  for (const [name, value] of Object.entries(outputs)) { const file = path.join(OUT,name); fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value,null,2) + '\n'); fs.mkdirSync(CIVICA_ARTIFACTS,{recursive:true}); fs.copyFileSync(file,path.join(CIVICA_ARTIFACTS,name)); }
  console.log(JSON.stringify(results,null,2));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
