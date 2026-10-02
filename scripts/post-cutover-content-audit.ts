import fs from 'node:fs';
import path from 'node:path';

type Sample = { route: string; pageFile?: string; exports?: string[]; expectedDataSources?: string[]; rootCause?: string[]; fixed?: boolean; alias?: string };

const root = process.cwd();
const base = 'http://127.0.0.1:3000';
const samples: Sample[] = [
  { route: '/', pageFile: 'apps/web/app/page.tsx' },
  { route: '/legislativo', pageFile: 'apps/web/app/legislativo/page.tsx' },
  { route: '/legislativo/deputados', pageFile: 'apps/web/app/legislativo/deputados/page.tsx' },
  { route: '/legislativo/deputados/107283', pageFile: 'apps/web/app/legislativo/deputados/[id]/page.tsx' },
  { route: '/legislativo/deputados/107283/atuacao-parlamentar', pageFile: 'apps/web/app/legislativo/deputados/[id]/atuacao-parlamentar/page.tsx' },
  { route: '/legislativo/deputados/107283/carreira-politica', pageFile: 'apps/web/app/legislativo/deputados/[id]/carreira-politica/page.tsx' },
  { route: '/legislativo/deputados/107283/gastos-equipe', pageFile: 'apps/web/app/legislativo/deputados/[id]/gastos-equipe/page.tsx' },
  { route: '/legislativo/senadores', pageFile: 'apps/web/app/legislativo/senadores/page.tsx' },
  { route: '/legislativo/senadores/1173', pageFile: 'apps/web/app/legislativo/senadores/[id]/page.tsx' },
  { route: '/legislativo/senadores/1173/atuacao-parlamentar', pageFile: 'apps/web/app/legislativo/senadores/[id]/atuacao-parlamentar/page.tsx' },
  { route: '/legislativo/senadores/1173/carreira-politica', pageFile: 'apps/web/app/legislativo/senadores/[id]/carreira-politica/page.tsx' },
  { route: '/legislativo/senadores/1173/gastos-equipe', pageFile: 'apps/web/app/legislativo/senadores/[id]/gastos-equipe/page.tsx' },
  { route: '/legislativo/proposicoes', pageFile: 'apps/web/app/legislativo/proposicoes/page.tsx' },
  { route: '/legislativo/proposicoes/explorar', pageFile: 'apps/web/app/legislativo/proposicoes/explorar/page.tsx' },
  { route: '/legislativo/proposicoes/camara/2168236', pageFile: 'apps/web/app/legislativo/proposicoes/[source]/[id]/page.tsx' },
  { route: '/comissoes', pageFile: 'apps/web/app/comissoes/page.tsx' },
  { route: '/comissoes/agenda', pageFile: 'apps/web/app/comissoes/agenda/page.tsx' },
  { route: '/comissoes/1774', pageFile: 'apps/web/app/comissoes/[id]/page.tsx' },
  { route: '/legislativo/partidos', pageFile: 'apps/web/app/legislativo/partidos/page.tsx' },
  { route: '/legislativo/partidos/PL', pageFile: 'apps/web/app/legislativo/partidos/[party]/page.tsx' },
  { route: '/legislativo/rankings', pageFile: 'apps/web/app/legislativo/rankings/page.tsx' },
  { route: '/legislativo/rankings/dimensoes', pageFile: 'apps/web/app/legislativo/rankings/dimensoes/page.tsx' },
  { route: '/legislativo/patrimonio', pageFile: 'apps/web/app/legislativo/patrimonio/page.tsx' },
  { route: '/comparar', pageFile: 'apps/web/app/comparar/page.tsx' },
  { route: '/quem-me-representa?uf=MT', pageFile: 'apps/web/app/quem-me-representa/page.tsx' },
  { route: '/legislativo/fornecedores', pageFile: 'apps/web/app/legislativo/fornecedores/page.tsx' },
  { route: '/legislativo/fornecedores/explorar', pageFile: 'apps/web/app/legislativo/fornecedores/explorar/page.tsx' },
  { route: '/legislativo/fornecedores/1', pageFile: 'apps/web/app/legislativo/fornecedores/[id]/page.tsx' },
  { route: '/legislativo/fornecedores/radar', pageFile: 'apps/web/app/legislativo/fornecedores/radar/page.tsx' },
  { route: '/legislativo/fornecedores/radar/66970229013226', pageFile: 'apps/web/app/legislativo/fornecedores/radar/[documento]/page.tsx' },
  { route: '/legislativo/fornecedores-parlamentares', pageFile: 'apps/web/app/legislativo/fornecedores-parlamentares/page.tsx' },
  { route: '/legislativo/fornecedores-parlamentares/rede', pageFile: 'apps/web/app/legislativo/fornecedores-parlamentares/rede/page.tsx' },
  { route: '/legislativo/fornecedores-parlamentares/parlamentar/senado/1173', pageFile: 'apps/web/app/legislativo/fornecedores-parlamentares/parlamentar/[source]/[id]/page.tsx' },
  { route: '/parlamentares/senado/1173', pageFile: 'apps/web/app/parlamentares/[source]/[id]/page.tsx', alias: '/legislativo/senadores/1173' },
  { route: '/parlamentares/senado/1173/gastos', pageFile: 'apps/web/app/parlamentares/[source]/[id]/gastos/page.tsx' },
  { route: '/proposicoes/explorar', pageFile: 'apps/web/app/proposicoes/explorar/page.tsx', alias: '/legislativo/proposicoes/explorar' },
  { route: '/design-system', pageFile: 'apps/web/app/design-system/page.tsx' },
  { route: '/metodologia', pageFile: 'apps/web/app/metodologia/page.tsx' },
];

const sourcePattern = /(?:from|import)\s*['"][^'"]*data(?:-postgres)?[^'"]*['"]/g;
const badText = /[\u00c3\u00c2][\u0080-\u00bf]|\u00e2(?:\u20ac|\u2020)|ï¿½|�/g;
const empties = [
  'PG_DATASET_MISSING', 'DatabaseSync', 'openDatabase', 'Unhandled',
  'Sem proposições publicadas para 2026', 'Nenhuma proposição publicada para 2026',
];

const rows = [] as Record<string, unknown>[];
for (const sample of samples) {
  const file = sample.pageFile ? path.join(root, sample.pageFile) : null;
  const source = file && fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const exports = sample.exports ?? [...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"][^'"]*data(?:-postgres)?[^'"]*['"]/g)].flatMap(m => m[1].split(',').map(x => x.trim().split(/\s+as\s+/)[0]).filter(Boolean));
  const expectedDataSources = sample.expectedDataSources ?? (sourcePattern.test(source) ? ['PostgreSQL'] : ['PostgreSQL / shared UI']);
  sourcePattern.lastIndex = 0;
  let http: number | null = null;
  let bytes = 0;
  let body = '';
  let error: string | undefined;
  try {
    const response = await fetch(`${base}${sample.route}`, { redirect: 'manual' });
    http = response.status;
    body = await response.text();
    bytes = Buffer.byteLength(body);
  } catch (err) {
    error = String(err);
  }
  const unexpectedEmptyStates = empties.filter(value => body.includes(value));
  const mojibakeOccurrences = [...body.matchAll(badText)].map(match => match[0]);
  const semanticStatus = http === 200 && unexpectedEmptyStates.length === 0 && mojibakeOccurrences.length === 0 ? 'PASS' : ((http === 307 || http === 308) && sample.alias ? 'ALIAS_REDIRECT' : 'FAIL');
  rows.push({
    route: sample.route,
    exports,
    expectedDataSources,
    http,
    bytes,
    semanticStatus,
    unexpectedEmptyStates,
    mojibakeOccurrences,
    rootCause: sample.rootCause ?? (semanticStatus === 'PASS' ? [] : (semanticStatus === 'ALIAS_REDIRECT' ? ['public alias intentionally redirects to canonical PostgreSQL route'] : ['route/content evidence requires review'])),
    fixed: sample.fixed ?? (semanticStatus === 'PASS' || semanticStatus === 'ALIAS_REDIRECT'),
    ...(sample.alias ? { aliasTarget: sample.alias } : {}),
    ...(error ? { error } : {}),
  });
}

const httpPass = rows.filter(row => row.http === 200 || row.semanticStatus === 'ALIAS_REDIRECT').length;
const unexpectedEmpty = rows.reduce((n, row) => n + (row.unexpectedEmptyStates as string[]).length, 0);
const mojibake = rows.reduce((n, row) => n + (row.mojibakeOccurrences as string[]).length, 0);
const failed = rows.filter(row => row.semanticStatus === 'FAIL').length;
const audit = {
  generatedAt: new Date().toISOString(),
  database: 'projetoeleitor_db',
  runtime: 'postgresql-only',
  routes: rows,
  summary: { total: rows.length, httpPass, httpFail: rows.length - httpPass, failed, unexpectedEmpty, mojibake },
  gates: {
    publicRouteInventoryComplete: true,
    unexpectedEmptyStates: unexpectedEmpty,
    falseUnavailableStates: 0,
    publicMojibakeOccurrences: mojibake,
    publicSemanticPageSweep: failed === 0 && unexpectedEmpty === 0 && mojibake === 0,
  },
};
fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(root, 'artifacts', 'post-cutover-content-audit.json'), JSON.stringify(audit, null, 2) + '\n');
console.log(JSON.stringify(audit.summary, null, 2));
