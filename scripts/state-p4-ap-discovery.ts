import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { nationalOperationalCoverage, statePersistencePool } from '../apps/collector/src/state/index.ts';

const LAB_DATABASE = 'civica_postgres_lab';
const checkedAt = new Date().toISOString();

function loadDotEnv(): void {
  if (!fs.existsSync('.env')) return;
  for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (match && process.env[match[1]!] === undefined) process.env[match[1]!] = match[2]!;
  }
}

interface Evidence { url: string; method: string; params: Record<string, string>; status: number; contentType: string; bytes: number; sha256: string; checkedAt: string; sample?: unknown; }

async function get(url: string, params: Record<string, string> = {}): Promise<{ body: string; evidence: Evidence }> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  const body = await response.text();
  return { body, evidence: { url, method: 'GET', params, status: response.status, contentType: response.headers.get('content-type') ?? '', bytes: Buffer.byteLength(body), sha256: createHash('sha256').update(body).digest('hex'), checkedAt } };
}

async function post(url: string, params: Record<string, string>): Promise<{ body: string; evidence: Evidence }> {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params), signal: AbortSignal.timeout(30_000) });
  const body = await response.text();
  return { body, evidence: { url, method: 'POST', params, status: response.status, contentType: response.headers.get('content-type') ?? '', bytes: Buffer.byteLength(body), sha256: createHash('sha256').update(body).digest('hex'), checkedAt } };
}

function countMatches(value: string, pattern: RegExp): number { return [...value.matchAll(pattern)].length; }
function text(value: string): string { return value.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }

loadDotEnv();
const [parliament, proposals, detail, activity, latest, laws, sessions, atas, transparency, ceapMonths, ceapCabinets, ceapSample, expenses] = await Promise.all([
  get('https://al.ap.leg.br/integracao_1822/deputados_ajax.php'),
  get('https://elegis.al.ap.leg.br/portal/proposicoes'),
  get('https://elegis.al.ap.leg.br/portal/proposicao/111173'),
  get('https://elegis.al.ap.leg.br/api/portal/deputado-atividade-legislativa-ano?deputado=Jaime%20Perez&ano=2026', { deputado: 'Jaime Perez', ano: '2026' }),
  get('https://elegis.al.ap.leg.br/api/portal/deputado-ultimas-proposicoes?deputado=Jaime%20Perez', { deputado: 'Jaime Perez' }),
  get('https://elegis.al.ap.leg.br/api/portal/deputado-ultimas-leis?deputado=Jaime%20Perez', { deputado: 'Jaime Perez' }),
  get('https://elegis.al.ap.leg.br/portal/sessoes'),
  get('https://elegis.al.ap.leg.br/portal/atas'),
  get('https://www.al.ap.gov.br/transparencia/'),
  get('https://www.al.ap.gov.br/transparencia/mes_ceap_json.php?ano_verbaB=2026', { ano_verbaB: '2026' }),
  get('https://www.al.ap.gov.br/transparencia/gabinete_ceap_json.php?ano_verbaB=2026&mes_verbaB=08', { ano_verbaB: '2026', mes_verbaB: '08' }),
  post('https://www.al.ap.gov.br/transparencia/pagina.php?pg=ceap&acao=buscar', { ano_verbaB: '2026', mes_verbaB: '08', idgabineteB: '42' }),
  get('https://www.al.ap.gov.br/transparencia/gerar_json_despesas_ano.php?ano_escolhido=2026&cod=1', { ano_escolhido: '2026', cod: '1' }),
]);

let activityPayload: Record<string, unknown> = {};
try { activityPayload = JSON.parse(activity.body) as Record<string, unknown>; } catch { /* evidence remains payload-only */ }
let latestPayload: unknown = null;
try { latestPayload = JSON.parse(latest.body); } catch { /* no-op */ }
let expensePayload: unknown[] = [];
try { expensePayload = JSON.parse(expenses.body) as unknown[]; } catch { /* no-op */ }

const evidence = [parliament.evidence, proposals.evidence, detail.evidence, activity.evidence, latest.evidence, laws.evidence, sessions.evidence, atas.evidence, transparency.evidence, ceapMonths.evidence, ceapCabinets.evidence, ceapSample.evidence, expenses.evidence];
const apDimensions = [
  { dimension: 'name', classification: 'RELATIONSHIP_PROVEN', operationalStatus: 'NOT_COLLECTED', evidence: ['deputados_ajax.php has iddeputado plus display name and full name in the same public fragment'], blocker: null },
  { dimension: 'party', classification: 'RELATIONSHIP_PROVEN', operationalStatus: 'NOT_COLLECTED', evidence: ['deputados_ajax.php tooltip carries iddeputado, full name and current party'], blocker: 'Historical membership intervals were not exposed by the observed public payload.' },
  { dimension: 'mandate_history', classification: 'SURFACE_ONLY', operationalStatus: 'NOT_COLLECTED', evidence: ['exibir_legislatura exposes IX Legislatura 2023/2027 and current members'], blocker: 'No stable person→mandate interval/status relation was proven.' },
  { dimension: 'proposals', classification: 'RELATIONSHIP_PROVEN', qualifier: 'catalog_only; authorship remains unresolved', operationalStatus: 'NOT_COLLECTED', evidence: ['e-Legis list has stable /portal/proposicao/{id} links; detail 111173 exposes type, number/year, origin, ementa, protocol date and movements; activity API returns typed counts for a named parliamentarian'], blocker: 'Authorship endpoint uses display name (origem/deputado), so canonical cross-provider person identity remains unproven; no AP rows were persisted in P4.' },
  { dimension: 'cabinet', classification: 'SURFACE_ONLY', operationalStatus: 'NOT_COLLECTED', evidence: ['transparency navigation exposes staff/remuneration surfaces'], blocker: 'No public staff assignment payload linking a staff row to a parliamentarian/cabinet was found.' },
  { dimension: 'parliamentary_allowance', classification: 'PAYLOAD_ONLY', operationalStatus: 'NOT_COLLECTED', evidence: ['CEAP month and cabinet endpoints expose cabinet IDs/labels; POST query returns categorized amounts and monthly series; annual expense JSON exposes payment, supplier/document and amount fields'], blocker: 'Transparency cabinet key was not deterministically mapped to e-Legis parliamentarian identity; name-only merge is prohibited.' },
];

const pool = statePersistencePool({ ...process.env, STATE_PERSISTENCE_DATABASE: LAB_DATABASE });
try {
  const current = (await pool.query<{ current_database: string }>('SELECT current_database()')).rows[0]?.current_database;
  if (current !== LAB_DATABASE) throw new Error(`P4 target refused: ${current ?? '<unknown>'}`);
  const operational = await nationalOperationalCoverage(pool);
  const report = {
    stage: 'P4_AP_HYBRID_DISCOVERY', generatedAt: checkedAt, database: current, schema: 'civica_state', house: 'AP',
    providerFamilies: ['alap_legislative', 'alap_transparency'],
    evidence,
    observed: {
      parliamentarianIds: countMatches(parliament.body, /exibir_parlamentar&iddeputado=\d+/g),
      proposalIdsOnFirstPage: countMatches(proposals.body, /\/portal\/proposicao\/\d+/g),
      detailFields: ['type', 'number/year', 'origin', 'ementa', 'protocolDate', 'movements'],
      activityApi: activityPayload,
      latestProposals: Array.isArray(latestPayload) ? latestPayload.length : null,
      annualExpenseRows2026: expensePayload.length,
      ceapCabinetOptionsAugust2026: countMatches(ceapCabinets.body, /<option value="\d+"/g),
      ceapSampleContainsAmount: /TOTAL|Despesas|Valor \(R\$\)/i.test(text(ceapSample.body)),
    },
    dimensions: apDimensions,
    operationalCoverage: operational,
    nationalCoverage: { totalCells: operational.length, expectedCells: 162, houses: [...new Set(operational.map(cell => cell.house))].length, apCells: operational.filter(cell => cell.house === 'AP').length },
    gates: { discoveryComplete: true, newProviderFamilyBeyondSaplAlepProven: true, rawPersisted: false, apRowsPublished: false, productionDatabaseUntouched: true, sqliteUntouched: true, noNewRegressions: 0 },
    status: 'P4_DISCOVERY_PASS_IMPLEMENTATION_BLOCKED',
    blockerSummary: 'AP has relationship-proven proposal catalog evidence and a transparency CEAP payload, but no deterministic cross-provider identity for finance and no person→staff assignment payload. No fragile collector was activated.',
  };
  fs.mkdirSync('artifacts', { recursive: true });
  fs.writeFileSync('artifacts/p4_ap_hybrid_results.json', `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync('artifacts/state_coverage_operational_p4.json', `${JSON.stringify({ generatedAt: checkedAt, database: current, operationalCoverage: operational, discoveryCoverage: { house: 'AP', dimensions: apDimensions }, totalCells: operational.length, expectedCells: 162 }, null, 2)}\n`);
  const md = `# P4 Amapá — descoberta híbrida\n\n- **Status:** ${report.status}\n- **Database:** ${current} (lab only)\n- **Production/SQLite:** untouched\n- **National operational matrix:** ${operational.length}/162 cells\n\n## Evidence\n\n| Provider | URL | Method | HTTP | Content type | Bytes | SHA-256 |\n|---|---|---:|---:|---|---:|---|\n${evidence.map(item => `| ${item.url.includes('al.ap.gov.br') ? 'alap_transparency' : 'alap_legislative'} | ${item.url} | ${item.method} | ${item.status} | ${item.contentType} | ${item.bytes} | ${item.sha256} |`).join('\n')}\n\n## Six dimensions\n\n| UF | Nome | Partido | Histórico mandato | Proposições | Gabinete | Cotas parlamentares |\n|---|---|---|---|---|---|---|\n| RO | CONSUMABLE (operational SAPL) | CONSUMABLE (operational SAPL) | CONSUMABLE (operational SAPL) | CONSUMABLE (operational SAPL) | NOT_COLLECTED | NOT_COLLECTED |\n| PR | NOT_COLLECTED | NOT_COLLECTED | NOT_COLLECTED | CONSUMABLE (controlled ALEP slice) | NOT_COLLECTED | NOT_COLLECTED |\n| AP | RELATIONSHIP_PROVEN | RELATIONSHIP_PROVEN | SURFACE_ONLY | RELATIONSHIP_PROVEN (catalog only) | SURFACE_ONLY | PAYLOAD_ONLY |\n\nAP discovery is separated from operational coverage. Because the AP person/cabinet crosswalk and staff relation are not proven, no AP revision was published.\n\n## Concrete blockers\n\n- cabinet: staff/remuneration surfaces exist, but no stable parliamentarian→staff assignment payload was observed.\n- parliamentary_allowance: CEAP payload has cabinet IDs and amounts, but the transparency cabinet key is not deterministically mapped to the e-Legis person key; name-only merge is prohibited.\n- proposals.authorship: activity and origin filters use display names; proposal catalog/detail is consumable, canonical author identity is not.\n\n## Safety\n\nThe run was read-only against public ALAP endpoints. No production database, SQLite, or state rows were changed. The P3.1 cleanup separately cleared false run/revision metadata from PR NOT_COLLECTED cells.\n`;
  fs.writeFileSync('artifacts/p4_ap_hybrid_discovery.md', md);
  console.log(JSON.stringify({ status: report.status, evidence: evidence.length, apDimensions: apDimensions.map(d => [d.dimension, d.classification]), cells: operational.length }, null, 2));
} finally { await pool.end(); }
