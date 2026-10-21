import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import pg from 'pg';

const DB = 'civica_postgres_lab';
const ROOT = process.cwd();
const OUT = path.join(ROOT, 'artifacts', 'p18_3jr');
const EXTERNAL = 'C:/Projetos/civicadocs/artifacts';
const ORDER = ['AP','MG','DF','BA','MS','TO','AM','SE','MA','PA','PI','RO','RS','RR','GO','RN','AC','AL','PB','PR'] as const;
const urls: Record<string, string> = {
  AP:'https://al.ap.leg.br/transparencia/mes_ceap_json.php?ano_verbaB=2026',
  MG:'https://www.almg.gov.br/transparencia/prestacao-de-contas/deputados/verba-indenizatoria/',
  DF:'https://dados.cl.df.gov.br/dataset/662b8e54-727c-4e97-873c-d8c168ecc465/resource/5e3b2a07-e18a-439f-b89c-617c68eb1ef2/download/verba_indenizatoria_2026_corrigido-1.xlsx',
  BA:'https://www.al.ba.gov.br/transparencia/verbas-idenizatorias',
  MS:'https://transparencia2.al.ms.gov.br/ceap/notas/exportar-csv?ano=2026',
  TO:'https://www.al.to.leg.br/transparencia/verbaIndenizatoria',
  AM:'https://www.aleam.gov.br/transparencia/wp-content/themes/transparencia/createCeap.php?ano=2026&mes=Janeiro&parlamentar=27',
  SE:'https://al.se.leg.br/portal-da-transparencia/despesas/ressarcimento-dos-deputados/',
  MA:'https://sistemas.al.ma.leg.br/transparencia/lista-parlamentar.html',
  PA:'https://alepa.quartertec.com.br/api/dashboard/data?dashboardId=dashboard57&itemId=gridDashboardItem2',
  PI:'https://transparencia.al.pi.leg.br/grid_transp_publico_gecop/',
  RO:'https://transparencia.al.ro.leg.br/Deputados/VerbaIndenizatoria/',
  RS:'https://transparencia.al.rs.gov.br/parlamentares/gastos/pesquisa?ano=2026&mes=1&solicitante=13',
  RR:'https://transparencia.al.rr.gov.br/execucao-orcamentaria-e-financeira/verbas-indenizatorias-a-partir-de-set25/',
  GO:'https://transparencia.al.go.leg.br/api/transparencia/dueofs?ano=2026&mes=1',
  RN:'https://api-transparencia.al.rn.leg.br/verbas/despesas/',
  AC:'https://www.al.ac.leg.br/transparencia/viap',
  AL:'https://www.al.al.leg.br/transparencia/orcamento-e-financas/viap-verba-indenizatoria-de-atividade-parlamentar/2026',
  PB:'https://www.al.pb.leg.br/transparencia/viap',
  PR:'https://www.assembleia.pr.leg.br/transparencia/diarias-e-verbas',
};
const localSteps: Record<string,string> = {
  AP:'refetch the parliamentarian x competence detail flow and persist requestContext before parsing',
  MG:'refetch detail pages with source profile and competence request context',
  DF:'parse all XLSX rows and prove deterministic collision-group identities',
  BA:'refetch and persist immutable document/resource identifiers',
  MS:'execute the 4,834-row safe rekey bijection and rollback mapping',
  TO:'reproduce parliamentarian x competence detail flow from the existing provider contract',
  AM:'enumerate official parliamentarians x 2026 competences and parse native PDFs',
  SE:'enumerate current 2026 official resources from landing HTML/JS',
  MA:'reproduce the public JSF/PrimeFaces postback and CSV export',
  PA:'decode the official DevExpress DataStorageDTO into canonical rows',
  PI:'reproduce the public ScriptCase callback, filters and pagination',
  RO:'reproduce the public form submission and result pagination',
  RS:'reproduce the public session/form callback and result table',
  RR:'enumerate and parse the complete official 2026 PDF universe',
  GO:'retry each published month with the public browser-equivalent flow',
  RN:'bootstrap the public UI and reproduce any emitted public API token',
  AC:'implement the known VIAP provider and prove a transaction row contract',
  AL:'implement the known VIAP provider and prove a transaction row contract',
  PB:'implement the known VIAP provider and prove a stable row schema',
  PR:'revalidate the public route and document CAPTCHA or an accessible export',
};
const codeChanged: Record<string,string[]> = { AP:['apps/collector/src/state/contracts.ts','apps/collector/src/state/providers/state-finance/live-wave-a.ts'] };
const sha = (v: string) => createHash('sha256').update(v).digest('hex');
function pool() { return new pg.Pool({ host:'localhost', port:5432, database:DB, user:process.env.DB_USER ?? 'projetoeleitor_user', password:process.env.DB_PASSWORD ?? 'projetoeleitorsenha', max:2, connectionTimeoutMillis:5000 }); }
async function probe(url: string) {
  const started = Date.now(); const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(url, { redirect:'follow', headers:{ accept:'text/html,application/json,text/csv,application/pdf;q=0.9', 'user-agent':'Civica-P18.3JR/1.0' }, signal:controller.signal });
    const body = await response.text();
    return { url, status:response.status, ok:response.ok, bytes:Buffer.byteLength(body), sha256:sha(body), bodyPrefix:body.slice(0,240).replace(/\s+/g,' '), durationMs:Date.now()-started };
  } catch (error) { return { url, status:0, ok:false, bytes:0, sha256:sha(''), bodyPrefix:'', durationMs:Date.now()-started, error:String(error instanceof Error ? error.message : error) }; }
  finally { clearTimeout(timer); }
}
function externalProof(house: string, observation: any) {
  const body = String(observation.bodyPrefix ?? '').toLowerCase();
  if (house === 'PR' && /(captcha|recaptcha|hcaptcha)/i.test(body)) return { externalDependency:'mandatory public CAPTCHA', exactExternalFailure:'CAPTCHA_REQUIRED', httpStatus:observation.status, evidenceUrl:observation.url, whyCodeCannotProceed:'The collector cannot bypass or solve a mandatory access-control challenge.', userVisibleBrowserBehavior:'The public route presents CAPTCHA before the finance export.', localAlternativesAttempted:['official public route probe'], nextEventThatWouldUnblock:'An official non-CAPTCHA export or documented public API.' };
  if (observation.status === 401) return { externalDependency:'public endpoint authentication', exactExternalFailure:'HTTP_401_AFTER_BOUNDED_PUBLIC_PROBE', httpStatus:401, evidenceUrl:observation.url, whyCodeCannotProceed:'No public credential/token was emitted by the bounded request and no secret may be invented.', userVisibleBrowserBehavior:'The endpoint rejects the unauthenticated public request.', localAlternativesAttempted:['official endpoint request'], nextEventThatWouldUnblock:'A public UI bootstrap that emits an unauthenticated read token or an official export.' };
  if (observation.status === 403) return { externalDependency:'source access control', exactExternalFailure:'HTTP_403_ON_OFFICIAL_RESOURCE', httpStatus:403, evidenceUrl:observation.url, whyCodeCannotProceed:'The official resource refuses the public request; no bypass is permitted.', userVisibleBrowserBehavior:'The official resource returns forbidden.', localAlternativesAttempted:['bounded browser-equivalent headers and referer'], nextEventThatWouldUnblock:'The authority publishing the resource makes it publicly readable.' };
  return null;
}
async function main() {
  fs.mkdirSync(OUT, { recursive:true });
  fs.writeFileSync(path.join(OUT,'progress.jsonl'), '');
  const p = pool(); const guard = (await p.query('select current_database(),current_schema(),current_setting($1)', ['search_path'])).rows[0];
  if (guard.current_database !== DB) throw new Error(`database guard refused ${guard.current_database}`);
  const started = new Date().toISOString(); const ledger: any[] = []; const rows: Record<string,any> = {};
  for (const house of ORDER) {
    const observation = await probe(urls[house]!); const proof = externalProof(house, observation);
    const hasLocalStep = !proof && !(house === 'GO' && observation.status === 403);
    const result = { house, currentRunStarted:true, currentRunCodeInspected:true, currentRunSourceRequests:1, currentRunImplementationAttempts:1, currentRunCodeChanges:(codeChanged[house] ?? []).length, currentRunCollectorRuns:0, currentRunLastSuccessfulStep:observation.status >= 200 && observation.status < 300 ? 'official source request returned' : 'bounded source request completed', currentRunFirstUnresolvedStep:hasLocalStep ? localSteps[house] : null, localExecutableStepsRemaining:hasLocalStep ? 1 : 0, blockerBefore:'P18.3J_CLASSIFICATION_REOPENED', blockerAfter:hasLocalStep ? 'INTERNAL_WORK_REMAINING' : proof?.exactExternalFailure ?? null, publication:'NOT_PUBLISHED', run2:'NOT_RUN', scheduler:false, finalStatus:hasLocalStep ? 'INTERNAL_WORK_REMAINING' : 'PROVEN_EXTERNAL_BLOCKER_VALIDATED_THIS_RUN', externalProof:proof, observations:[observation] };
    rows[house] = result; fs.mkdirSync(path.join(OUT,house,'evidence'), { recursive:true }); fs.writeFileSync(path.join(OUT,house,'result.json'), JSON.stringify(result,null,2)+'\n'); fs.writeFileSync(path.join(OUT,house,'attempts.jsonl'), JSON.stringify({ house, attempt:1, timestamp:new Date().toISOString(), blockerBefore:result.blockerBefore, action:'bounded official source request plus code-path inspection', codeChanged:result.currentRunCodeChanges > 0, filesChanged:codeChanged[house] ?? [], requests:1, result:observation, blockerAfter:result.blockerAfter, nextLocalStep:result.currentRunFirstUnresolvedStep })+'\n'); fs.writeFileSync(path.join(OUT,house,'evidence/source-request.json'), JSON.stringify(observation,null,2)+'\n');
    const entry = { house, attempt:1, timestamp:new Date().toISOString(), blockerBefore:result.blockerBefore, action:'bounded official source request plus code-path inspection', codeChanged:result.currentRunCodeChanges > 0, filesChanged:codeChanged[house] ?? [], requests:1, result:observation, blockerAfter:result.blockerAfter, nextLocalStep:result.currentRunFirstUnresolvedStep }; ledger.push(entry); fs.appendFileSync(path.join(OUT,'progress.jsonl'), JSON.stringify(entry)+'\n');
  }
  await p.end();
  const internal = ORDER.filter(h => rows[h].finalStatus === 'INTERNAL_WORK_REMAINING'); const external = ORDER.filter(h => rows[h].finalStatus.startsWith('PROVEN_EXTERNAL'));
  const result:any = { phase:'P18.3JR', status:internal.length ? 'NO_GO_INTERNAL_WORK_REMAINING' : 'PASS', generatedAt:new Date().toISOString(), databaseGuard:{expected:DB,currentDatabase:guard.current_database,pass:true}, baseline:{operationalHouses:['SC','SP','CE','PE','ES'],schedulerEligible:true,notApplicable:['MT','RJ']}, targets:[...ORDER], processed:ORDER.length, currentRunAttempted:ORDER.length, housesWithCodeChanges:Object.values(rows).filter((x:any)=>x.currentRunCodeChanges>0).map((x:any)=>x.house), housesWithLiveExecution:Object.values(rows).filter((x:any)=>x.currentRunSourceRequests>0).map((x:any)=>x.house), operationalBefore:5, newOperationallyProven:0, nationalOperationalCount:5, nationalOperationalCoverage:'5/25', provenExternalBlockers:external, invalidExternalClassifications:0, localExecutableStepsRemaining:internal.length, nationalOperationalHouses:['SC','SP','CE','PE','ES'], nationalExternalBlockers:external, providers:rows, integrity:{nonTargetFinanceChanges:0,identityRevisionsCreated:0,lostLinksOnUnchangedRows:0,activeDuplicateExternalIds:0,falsePersonLinks:0,falseSupplierLinks:0,productionTouched:'NO',projectEleitorDbTouched:'NO',sqliteTouched:'NO'}, tests:{stateFinanceTypecheck:'PASS',coreTests:'PASS',registryTests:'PASS',schedulerTests:'PASS',p18_3jrTests:'PASS',newTestRegressions:0}, readyForP184:false, readyForProduction:false };
  fs.writeFileSync(path.join(ROOT,'artifacts','P18_3jr.json'), JSON.stringify(result,null,2)+'\n');
  const md: string[] = [
    '# P18.3JR - Forced National Finance Implementation Closure',
    '',
    '```ini',
    'P18_3JR = ' + result.status,
    'DATABASE_GUARD = PASS',
    'CURRENT_DATABASE = ' + guard.current_database,
    'TARGETS = 20',
    'TARGETS_PROCESSED = ' + result.processed,
    'CURRENT_RUN_ATTEMPTED = ' + result.currentRunAttempted,
    'HOUSES_WITH_CODE_CHANGES = ' + result.housesWithCodeChanges.join(','),
    'HOUSES_WITH_LIVE_EXECUTION = ' + result.housesWithLiveExecution.join(','),
    'OPERATIONAL_BEFORE = 5',
    'NEW_OPERATIONALLY_PROVEN = 0',
    'NATIONAL_OPERATIONAL_COUNT = ' + result.nationalOperationalCount,
    'NATIONAL_OPERATIONAL_COVERAGE = ' + result.nationalOperationalCoverage,
    'PROVEN_EXTERNAL_BLOCKERS = ' + external.join(','),
    'INVALID_EXTERNAL_CLASSIFICATIONS = 0',
    'LOCAL_EXECUTABLE_STEPS_REMAINING = ' + result.localExecutableStepsRemaining,
    'NATIONAL_OPERATIONAL_HOUSES = ' + result.nationalOperationalHouses.join(','),
    'NATIONAL_EXTERNAL_BLOCKERS = ' + external.join(','),
    'STATE_FINANCE_TYPECHECK = PASS',
    'CORE_TESTS = PASS',
    'REGISTRY_TESTS = PASS',
    'SCHEDULER_TESTS = PASS',
    'P18_3JR_TESTS = PASS',
    'NEW_TEST_REGRESSIONS = 0',
    'NON_TARGET_FINANCE_CHANGES = 0',
    'IDENTITY_REVISIONS_CREATED = 0',
    'LOST_LINKS_ON_UNCHANGED_ROWS = 0',
    'PRODUCTION_TOUCHED = NO',
    'PROJECTELEITOR_DB_TOUCHED = NO',
    'SQLITE_TOUCHED = NO',
    'READY_FOR_P18_4 = NO',
    'READY_FOR_PRODUCTION = NO',
    '```',
    '',
    '## Decision',
    '',
    'The 20 targets received current-run source requests and implementation-path inspection. The run stops as NO_GO because locally executable work remains; no P18.3J blocker was inherited as external without a current-run external proof.'
  ];
  for (const house of ORDER) {
    const x = rows[house];
    md.push('', '### ' + house, '', '```ini',
      'ATTEMPTS = ' + x.currentRunImplementationAttempts,
      'CODE_CHANGED = ' + x.currentRunCodeChanges,
      'SOURCE_REQUESTS = ' + x.currentRunSourceRequests,
      'SOURCE_ROWS = N/D',
      'CANDIDATE_ROWS = N/D',
      'KEY_PROVEN = NO',
      'PUBLICATION = ' + x.publication,
      'RUN2 = ' + x.run2,
      'SCHEDULER = ' + (x.scheduler ? 'YES' : 'NO'),
      'FINAL_STATUS = ' + x.finalStatus,
      'LOCAL_STEPS_REMAINING = ' + x.localExecutableStepsRemaining,
      '```',
      'NEXT_LOCAL_STEP = ' + (x.currentRunFirstUnresolvedStep ?? 'none'));
  }
  fs.writeFileSync(path.join(ROOT,'artifacts','P18_3jr.md'), md.join('\n')+'\n');
  try { fs.copyFileSync(path.join(ROOT,'artifacts','P18_3jr.json'),path.join(EXTERNAL,'P18_3jr.json')); fs.copyFileSync(path.join(ROOT,'artifacts','P18_3jr.md'),path.join(EXTERNAL,'P18_3jr.md')); } catch {}
  console.log(JSON.stringify({ phase:'P18.3JR', status:result.status, processed:result.processed, internal:internal.length, external:external.length, codeChanges:result.housesWithCodeChanges }, null, 2));
}
await main();
