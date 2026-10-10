import fs from 'node:fs';
const base = 'http://127.0.0.1:3000';
const urls = [
  ['/legislativo/estaduais/ES/deputados/45/atuacao-parlamentar', 'ES', 'SSR'],
  ['/legislativo/estaduais/BA/deputados/927093/atuacao-parlamentar', 'BA', 'SSR'],
  ['/legislativo/estaduais/GO/deputados/131/atuacao-parlamentar', 'GO', 'SSR'],
  ['/legislativo/estaduais/AP/deputados/79/atuacao-parlamentar', 'AP', 'SSR'],
  ['/api/estaduais/ES/parlamentares/45/atividade', 'ES', 'API'],
  ['/api/estaduais/BA/parlamentares/927093/atividade', 'BA', 'API'],
  ['/api/estaduais/GO/parlamentares/131/atividade', 'GO', 'API'],
  ['/api/estaduais/AP/parlamentares/79/atividade', 'AP', 'API'],
  ['/api/estaduais/RS/parlamentares/13/atividade', 'RS', 'API'],
  ['/api/estaduais/PB/parlamentares/101/atividade', 'PB', 'API'],
  ['/api/estaduais/AM/parlamentares/12/atividade', 'AM', 'API'],
];
const checks = [];
for (const [path, house, kind] of urls) {
  const response = await fetch(base + path);
  const body = await response.text();
  let json = null; try { json = JSON.parse(body); } catch { /* SSR HTML */ }
  checks.push({ path, house, kind, status: response.status, httpOk: response.status === 200, contentLength: body.length, contractStatus: json?.proposals?.coverage?.status ?? null, proposalTotal: json?.proposals?.total ?? null, hasCoverage: Boolean(json?.coverage) || (kind === 'SSR' && body.includes('Cobertura do contrato')) });
}
const output = { base, checks, allExpectedHttp200: checks.every((x) => x.status === 200), ssrExpectedPass: checks.filter((x) => x.kind === 'SSR').every((x) => x.status === 200), blockerContractsExplicit: checks.filter((x) => ['PB', 'AM'].includes(x.house)).every((x) => x.status === 200 && x.contractStatus === 'EXTERNAL_BLOCKER') };
fs.writeFileSync('artifacts/P20_FINAL_R1_route_validation.json', JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(output, null, 2));

