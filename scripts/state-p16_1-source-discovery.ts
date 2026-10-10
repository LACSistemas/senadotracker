import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const ARTIFACTS = path.join(ROOT, 'artifacts');
const P16 = path.join(ARTIFACTS, 'p16');
const OUT = path.join(ARTIFACTS, 'p16_1');
const houses = fs.readdirSync(P16).filter((name) => /^[A-Z]{2}\.json$/.test(name)).sort();
const knownLateral: Record<string, string[]> = {
  CE: ['https://transparencia.al.ce.gov.br/despesas/verba-desempenho-parlamentar'],
  MS: ['https://transparencia2.al.ms.gov.br/ceap', 'https://al.ms.gov.br/contato', 'https://al.ms.gov.br/Transparencia'],
  SP: ['https://www.al.sp.gov.br/transparencia/'],
};
const sha = (body: string) => crypto.createHash('sha256').update(body).digest('hex');
const fetchOne = async (url: string) => {
  const started = Date.now();
  try {
    const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'Civica-P16.1-source-discovery/1.0' } });
    const body = await response.text();
    const limited = body.slice(0, 350_000);
    const links = [...limited.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]).filter((href) => /transpar|despes|gabinete|servid|folha|remun|di[aá]ri|contrat|licita|pessoal|dados|open/i.test(href)).slice(0, 50);
    const terms = [...limited.matchAll(/(?:transpar[êe]ncia|despesas?|gabinete|servidores?|folha|remunera[çc][ãa]o|di[aá]rias?|contratos?|licita[çc][õo]es?|dados abertos)/gi)].map((m) => m[0].toLowerCase());
    return { url, finalUrl: response.url, status: response.status, contentType: response.headers.get('content-type'), bytes: Buffer.byteLength(body), sha256: sha(body), checkedAt: new Date().toISOString(), latencyMs: Date.now() - started, keywordHits: [...new Set(terms)].slice(0, 30), linkedLateralSurfaces: links };
  } catch (error) {
    return { url, finalUrl: null, status: null, contentType: null, bytes: 0, sha256: null, checkedAt: new Date().toISOString(), latencyMs: Date.now() - started, keywordHits: [], linkedLateralSurfaces: [], error: error instanceof Error ? error.message : String(error) };
  }
};

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const targets: Array<{ house: string; url: string; surface: string }> = [];
  for (const file of houses) {
    const row = JSON.parse(fs.readFileSync(path.join(P16, file), 'utf8'));
    const house = row.house as string;
    const official = row.officialSources.map((x: any) => x.url).filter(Boolean);
    const urls = [...new Set([official[0], ...(knownLateral[house] ?? [])].filter(Boolean))];
    for (const url of urls) targets.push({ house, url, surface: knownLateral[house]?.includes(url) ? 'lateral_source' : 'official_system_landing' });
  }
  const results: any[] = [];
  for (let i = 0; i < targets.length; i += 5) {
    const part = targets.slice(i, i + 5);
    results.push(...await Promise.all(part.map(async (target) => ({ ...target, ...(await fetchOne(target.url)) }))));
  }
  const byHouse: Record<string, any[]> = {};
  for (const row of results) (byHouse[row.house] ??= []).push(row);
  const output = { generatedAt: new Date().toISOString(), stage: 'P16.1_BOUNDED_OFFICIAL_SOURCE_DISCOVERY', readOnly: true, boundedRule: 'one landing/source request per known system plus previously evidenced lateral URLs; no speculative API calls', housesReviewed: houses.map((name) => name.slice(0, 2)), unaccountedHouses: [], results, byHouse };
  fs.writeFileSync(path.join(ARTIFACTS, 'p16_1_source_discovery_http.json'), JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ targets: targets.length, houses: houses.length, http200: results.filter((x) => x.status === 200).length, failures: results.filter((x) => x.status === null).length }, null, 2));
}
main().catch((error) => { console.error(error); process.exit(1); });
