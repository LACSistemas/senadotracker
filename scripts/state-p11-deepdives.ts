import fs from 'node:crypto';
import fsp from 'node:fs';

type Probe = { house: string; url: string; status: number | null; finalUrl?: string; contentType?: string; bytes?: number; sha256?: string; checkedAt: string; latencyMs: number; snippet?: string; links?: string[]; scripts?: string[]; error?: string };
const targets: Record<string, string[]> = {
  BA: [
    'https://albalegis.nopapercloud.com.br/spl/processo.aspx?id=78524',
    'https://albalegis.nopapercloud.com.br/spl/parlamentares.aspx',
    'https://albalegis.nopapercloud.com.br/spl/consulta-autor.aspx',
    'https://albalegis.nopapercloud.com.br/spl/sessoes.aspx',
    'https://albalegis.nopapercloud.com.br/spl/comissoes.aspx',
  ],
  MG: [
    'https://dadosabertos.almg.gov.br/documentacao/index',
    'https://dadosabertos.almg.gov.br/api/v2/comissoes/1270/composicoes/2025/05/06',
    'https://dadosabertos.almg.gov.br/api/v2/deputados',
    'https://dadosabertos.almg.gov.br/api/v2/parlamentares',
    'https://dadosabertos.almg.gov.br/api/v2/proposicoes',
  ],
  GO: [
    'https://portal.al.go.leg.br/deputados/em-exercicio',
    'https://portal.al.go.leg.br/deputados/liderancas-parlamentares',
    'https://portal.al.go.leg.br/legislaturas',
    'https://alegodigital.al.go.leg.br/',
  ],
  PA: [
    'https://www.alepa.pa.gov.br/Institucional/Deputados',
    'https://www.alepa.pa.gov.br/Legislativo/Proposicoes',
    'https://www.alepa.pa.gov.br/Legislativo/VotacoesNominais',
  ],
  PE: [
    'https://dadosabertos.alepe.pe.gov.br/api/v1/parlamentares',
    'https://dadosabertos.alepe.pe.gov.br/api/v1/cargos',
    'https://dadosabertos.alepe.pe.gov.br/api/v1/lotacoes',
    'https://proposicoes.alepe.pe.gov.br/',
    'https://www.alepe.pe.gov.br/parlamentares/',
  ],
  SP: [
    'https://www.al.sp.gov.br/dados-abertos/catalogo',
    'https://www.al.sp.gov.br/dados-abertos/grupo/1',
    'https://www.al.sp.gov.br/dados-abertos/grupo/2',
    'https://www.al.sp.gov.br/api/deputado',
    'https://www.al.sp.gov.br/dados-abertos/api/deputado',
  ],
};

const absolute = (base: string, raw: string): string | null => { try { return new URL(raw, base).toString(); } catch { return null; } };
const extract = (text: string, base: string, regex: RegExp): string[] => Array.from(text.matchAll(regex), m => absolute(base, m[1] ?? '')).filter((x): x is string => Boolean(x)).slice(0, 120);
const probe = async (house: string, url: string): Promise<Probe> => {
  const started = Date.now(); const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { accept: 'application/json,application/xml,text/html,text/plain,*/*;q=0.5', 'user-agent': 'civica-p11-public-probe/1.0' } });
    const bytes = Buffer.from(await response.arrayBuffer()); const text = bytes.toString('utf8');
    return { house, url, status: response.status, finalUrl: response.url, contentType: response.headers.get('content-type') ?? undefined, bytes: bytes.length, sha256: fs.createHash('sha256').update(bytes).digest('hex'), checkedAt, latencyMs: Date.now() - started, snippet: text.replace(/\s+/g, ' ').slice(0, 1200), links: extract(text, response.url, /(?:href|action)=["']([^"']+)["']/gi), scripts: extract(text, response.url, /<script[^>]+src=["']([^"']+)["']/gi) };
  } catch (error) { return { house, url, status: null, checkedAt, latencyMs: Date.now() - started, error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }; }
};

const probes: Probe[] = [];
for (const [house, urls] of Object.entries(targets)) for (const url of urls) probes.push(await probe(house, url));
fsp.writeFileSync('artifacts/p11_probe_raw.json', `${JSON.stringify({ generatedAt: new Date().toISOString(), database: 'civica_postgres_lab', schema: 'civica_state', scope: 'read-only public capability probes', probes }, null, 2)}\n`);
console.log(JSON.stringify(probes.map(p => ({ house: p.house, url: p.url, status: p.status, finalUrl: p.finalUrl, contentType: p.contentType, bytes: p.bytes, error: p.error })), null, 2));
