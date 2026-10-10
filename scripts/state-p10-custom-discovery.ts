import fs from 'node:fs';
import crypto from 'node:crypto';

type Probe = {
  house: string;
  url: string;
  finalUrl?: string;
  method: string;
  params?: null;
  body?: null;
  status: number | null;
  contentType?: string;
  bytes?: number;
  sha256?: string;
  checkedAt: string;
  latencyMs: number;
  snippet?: string;
  links?: string[];
  scripts?: string[];
  structuredHints?: string[];
  error?: string;
};

const targets = {
  BA: { provider: 'alba_nopapercloud', urls: ['https://www.al.ba.gov.br/', 'https://www.al.ba.gov.br/atividade-legislativa', 'https://albalegis.nopapercloud.com.br/spl/consulta-producao.aspx?metadadoCampos=3&metadadoValores=Sim', 'https://sapl.al.ba.gov.br/'] },
  CE: { provider: 'alce_custom_portal', urls: ['https://www.al.ce.gov.br/', 'https://www2.al.ce.gov.br/', 'https://sapl.al.ce.gov.br/'] },
  GO: { provider: 'alego_custom_portal', urls: ['https://portal.al.go.leg.br/', 'https://portal.al.go.leg.br/deputados/em-exercicio', 'https://www.al.go.leg.br/', 'https://sapl.al.go.leg.br/'] },
  MS: { provider: 'alms_sgpl', urls: ['https://al.ms.gov.br/', 'https://www.al.ms.gov.br/', 'http://sgpl.consulta.al.ms.gov.br/sgpl-publico/', 'https://sapl.al.ms.gov.br/'] },
  PA: { provider: 'alepa_devexpress', urls: ['https://www.alepa.pa.gov.br/', 'https://www.alepa.pa.gov.br/Home/Page/Deputados', 'https://www.alepa.pa.gov.br/Home/Page/Proposicoes', 'https://www.alepa.pa.gov.br/Home/Page/VotacoesNominais', 'https://sapl.alepa.pa.gov.br/'] },
  PE: { provider: 'alepe_data_portal', urls: ['https://www.alepe.pe.gov.br/', 'https://www.alepe.pe.gov.br/parlamentares/', 'https://proposicoes.alepe.pe.gov.br/', 'https://dadosabertos.alepe.pe.gov.br/', 'https://dadosabertos.alepe.pe.gov.br/api/v1/parlamentares', 'https://dadosabertos.alepe.pe.gov.br/api/v1/cargos', 'https://dadosabertos.alepe.pe.gov.br/api/v1/lotacoes', 'https://www2.alepe.pe.gov.br/', 'https://sapl.alepe.pe.gov.br/'] },
  RJ: { provider: 'alerj_legacy_portal', urls: ['https://www.alerj.rj.gov.br/', 'https://www.alerj.rj.gov.br/Deputados/QuemSao', 'https://www.alerj.rj.gov.br/Deputados/RepresentacaoPartidaria', 'https://www.alerj.rj.gov.br/atividade-parlamentar', 'https://sapl.alerj.rj.gov.br/'] },
  RN: { provider: 'alrn_portal', urls: ['https://www.al.rn.leg.br/', 'https://www.al.rn.leg.br/deputados', 'https://al.rn.leg.br/', 'https://sapl.al.rn.leg.br/'] },
  RS: { provider: 'alrs_ww4_portal', urls: ['https://www.al.rs.gov.br/', 'https://ww4.al.rs.gov.br/', 'https://ww4.al.rs.gov.br/atividadeparlamentar/', 'https://sapl.al.rs.gov.br/'] },
} as const;

const abs = (base: string, raw: string): string | null => {
  try { return new URL(raw, base).toString(); } catch { return null; }
};
const extract = (html: string, base: string, pattern: RegExp): string[] => Array.from(html.matchAll(pattern), m => abs(base, m[1] ?? '')).filter((x): x is string => Boolean(x)).slice(0, 80);
const probe = async (house: string, url: string): Promise<Probe> => {
  const checkedAt = new Date().toISOString();
  const started = Date.now();
  try {
    const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { accept: 'text/html,application/xhtml+xml,application/xml,application/json,text/plain;q=0.8,*/*;q=0.5', 'user-agent': 'civica-p10-public-probe/1.0' } });
    const bytes = Buffer.from(await response.arrayBuffer());
    const text = bytes.toString('utf8');
    const links = extract(text, response.url, /(?:href|action)=["']([^"']+)["']/gi);
    const scripts = extract(text, response.url, /<script[^>]+src=["']([^"']+)["']/gi);
    const lower = text.toLowerCase();
    const structuredHints = ['json', 'xml', 'graphql', 'api', 'csv', 'xlsx', 'download', 'webservice', 'soap', 'sapl'].filter(x => lower.includes(x));
    return { house, url, finalUrl: response.url, method: 'GET', params: null, body: null, status: response.status, contentType: response.headers.get('content-type') ?? undefined, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), checkedAt, latencyMs: Date.now() - started, snippet: text.replace(/\s+/g, ' ').slice(0, 700), links, scripts, structuredHints };
  } catch (error) {
    return { house, url, method: 'GET', params: null, body: null, status: null, checkedAt, latencyMs: Date.now() - started, error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) };
  }
};

const run = async (): Promise<void> => {
  const probes: Probe[] = [];
  for (const [house, config] of Object.entries(targets)) for (const url of config.urls) probes.push(await probe(house, url));
  fs.writeFileSync('artifacts/p10_probe_raw.json', `${JSON.stringify({ generatedAt: new Date().toISOString(), database: 'civica_postgres_lab', schema: 'civica_state', scope: 'read-only direct HTTP probes', probes }, null, 2)}\n`);
  console.log(JSON.stringify(probes.map(x => ({ house: x.house, url: x.url, status: x.status, finalUrl: x.finalUrl, contentType: x.contentType, bytes: x.bytes, error: x.error, structuredHints: x.structuredHints })), null, 2));
};
await run();
