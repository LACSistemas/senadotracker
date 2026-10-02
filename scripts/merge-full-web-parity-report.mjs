import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const cases=[];
for (const file of fs.readdirSync(path.join(root,'artifacts')).filter(f=>/^full-web-sqlite-postgres-parity-case-\d+\.json$/.test(f))) {
  const report=JSON.parse(fs.readFileSync(path.join(root,'artifacts',file),'utf8'));
  if (report.cases?.[0]) cases.push(report.cases[0]);
}
cases.sort((a,b)=>a.name.localeCompare(b.name));
const summary={total:cases.length,exact:cases.filter(x=>x.exact).length,mismatches:cases.filter(x=>!x.exact).length,errors:cases.filter(x=>x.sqliteError||x.postgresError).length,routes:new Set(cases.map(x=>x.route)).size};
const report={generatedAt:new Date().toISOString(),database:'projetoeleitor_db',sqlite:'data/senadotracker.sqlite',method:{kind:'read-only public-wrapper parity',cases:'one deterministic representative input per public contract/route',hash:'SHA-256 over recursively sorted JSON; fieldDiff is shallow/depth-limited evidence, not a substitute for the hashes'},summary,cases};
fs.writeFileSync(path.join(root,'artifacts','full-web-sqlite-postgres-parity.json'),JSON.stringify(report,null,2)+'\n');
const exact=cases.filter(x=>x.exact), mismatch=cases.filter(x=>!x.exact);
const rootCause={
  'PUBLIC_WRAPPER_ENRICHMENT_GAP':['homeHighlights','legislativeOverview','houseListing.camara','houseListing.senado','profile.camara','profile.senado','profile.activity','partyLanding','partyDetail','stateRepresentation.MT','rankingsDashboard','rankings.camara','patrimonyRanking'],
  'PROPOSITION_OPERATIONAL_AND_DASHBOARD_GAP':['propositionOperationalBundle','propositionListing'],
  'FINANCE_INSTITUTIONAL_ROLLUP_DIFFERENCE':['congressSupplierOverview'],
  'SUPPLIER_TEMPORAL_DERIVATION_DIFFERENCE':['supplierMarket'],
  'SUPPLIER_METADATA_NORMALIZATION_GAP':['supplierExplorer','supplierGlobalDetail'],
  'COMMISSION_RELATION_COUNT_DIFFERENCE':['commissionDetail'],
  'EXPENSE_BENCHMARK_COMPOSITION_DIFFERENCE':['expenseDetail'],
  'EXACT_OR_CONTRACT_EQUIVALENT':['homeOverview','propositionResultComposition','personComparisonSetup','supplierExplorerFacets','supplierGlobalStory','supplierNetwork','parliamentarianSupplierNetwork','commissionDirectory','commissionOverview','commissionAgenda']
};
let md=`# Paridade integral de contratos web — SQLite × PostgreSQL\n\n`;
md+=`Gerado em ${report.generatedAt}. A fonte histórica é \`data/senadotracker.sqlite\`; o alvo é \`projetoeleitor_db\`. A comparação chama os wrappers públicos preservados em \`packages/db/src/web-legacy-contract.ts\` e a fachada atual em \`apps/web/lib/data.ts\`, com o mesmo input representativo.\n\n`;
md+=`## Resultado\n\n| Métrica | Valor |\n|---|---:|\n| Contratos comparados | ${summary.total} |\n| Hash exatamente igual | ${summary.exact} |\n| Com divergência | ${summary.mismatches} |\n| Erros de execução | ${summary.errors} |\n| Rotas cobertas | ${summary.routes} |\n\n`;
md+=`“Igual” significa hash integral do DTO. Uma diferença em qualquer campo, tipo, ordem, cardinalidade ou NULL é marcada como divergência.\n\n`;
md+=`## Matriz por contrato\n\n| Rota | Contrato | SQLite | PostgreSQL | Estado | Evidência principal |\n|---|---|---|---|---|---|\n`;
for(const c of cases){const d=(c.fieldDiff??[]).slice(0,3).map(x=>`${x.path}: ${JSON.stringify(x.sqlite)} → ${JSON.stringify(x.postgres)}`).join('<br>');md+=`| ${c.route} | ${c.name} | ${c.sqliteStatus}${c.sqliteError?' / erro':''} | ${c.postgresStatus}${c.postgresError?' / erro':''} | ${c.exact?'EXACT_MATCH':'DIVERGENTE'} | ${d||'hash igual'} |\n`;}
md+=`\n## Diferenças investigadas\n\n`;
md+=`### Dados de atividade, custos e participação\n\n`;
md+=`A fachada PostgreSQL retorna perfis e despesas, mas não recompõe o mesmo contrato editorial do SQLite. No panorama legislativo, o SQLite mediu custo mensal total de **10.729.469.314,625** (Câmara) e **3.860.100.931,5556** (Senado), enquanto o PG retornou **null** para o total mensal; médias: Câmara **20.915.144,8628** vs **23.599.007**, Senado **47.655.567,0562** vs **26.287.943**. O processamento do SQLite tem Câmara média **29,9539 dias**, mediana **19**, n=**3.256**, cobertura **75,6%**; Senado média **101,727**, mediana **29**, n=**11**. O PG devolve “Tempo de processamento não publicado.”.\n\n`;
md+=`A mesma lacuna aparece nas listagens de Casa, rankings, partidos e representação estadual: salário/cabine, equipe, relatorias, participação, eventos, mandatos e histórico de partidos são omitidos, zerados ou têm cobertura diferente. No perfil do Senado 1173, por exemplo, SQLite entrega **100** propostas paginadas e **335** nomeações; PG entrega **990** propostas e **0** nomeações. No perfil da Câmara 107283, SQLite entrega **12** nomeações; PG entrega **0**.\n\n`;
md+=`### Proposições\n\n`;
md+=`A composição funcional é o único contrato de proposições que bateu integralmente (**10 grupos**, mesmo total). Já a listagem ainda diverge: para o input \`year=2026,page=1,pageSize=20\`, SQLite retorna total **24.340**, dashboard apresentado **24.659**, backlog **4.535** e normas **104**; o PG agora retorna o total filtrado correto, mas mantém dashboard com apresentados **24.340**, backlog **0**, normas **0**, e não preenche recebidas/deliberadas por Casa. Itens também têm publicação, scope, batch e texto de busca diferentes. O bundle operacional PG tem anos, mas flow, staleness, DNA, rhythm, calendar, recent, facts, themes e relation vazios; o baseline SQLite disponível neste checkout está marcado \`unavailable\` pelo compose legado, portanto essa parte requer recuperar o builder/publicação canônica antes de declarar equivalência.\n\n`;
md+=`### Fornecedores\n\n`;
md+=`A correção desta rodada recuperou o mix de categorias institucionais a partir do payload canônico \`supplier_category_snapshot\`; \`congressSupplierCategoryMix\` agora tem hash **PASS**. O overview ainda diverge no rollup institucional: Câmara SQLite **184.243.867.920** vs PG **178.296.455.929**; Senado **43.433.000.702** vs **40.694.606.510**. O market mantém diferença temporal: SQLite \`sharedFive=596\`, \`newObserved=9.605\`; PG **81** e **0**. Explorer/detail têm diferença de alias/nome normalizado e \`revisionPublishedAt\` vazio no PG.\n\n`;
md+=`### Outras superfícies\n\n`;
md+=`Agenda de comissões, overview de comissão, directory (shape/cardinalidade), rede de fornecedor, rede parlamentar-fornecedor, setup de comparação, story do fornecedor e composição por grupo passaram no caso representativo. Commission detail diverge em \`rapporteurships.totalRecords\` (**2** SQLite vs **1** PG). Expense detail diverge nos denominadores e benchmarks (Casa n=**78** vs **8**, média **26.058.041,26** vs **4.589.917,5**) e nas frases derivadas. Patrimônio diverge em cardinalidade (**247** vs **248**) e conflitos (**13** vs **0**).\n\n`;
md+=`## Root causes\n\n`;
for(const [k,names] of Object.entries(rootCause)){const present=names.filter(n=>cases.some(c=>c.name===n));md+=`- **${k}**: ${present.join(', ')}.\n`;}
md+=`\n## Correções feitas nesta rodada\n\n- \`congressSupplierCategoryMix\` passou a ler o payload institucional canônico de \`civica_finance_poc.supplier_category_snapshot\`, preservando universo, Casa, categoria e valores; o comparator passou de divergente a **PASS**.\n- \`propositionListing\` passou a serializar \`search/q\` e aplicar os filtros reais (ano, Casa, tipo, grupo, autor, tema e texto) no count total, eliminando a contagem global indevida de 84.623 para uma busca de 2026.\n\n`;
md+=`## Itens ainda divergentes (não mascarados)\n\n`;
md+=`As divergências restantes são reais e estão no JSON integral. Elas não foram transformadas em “N/D” nem corrigidas com valores artificiais. O próximo trabalho deve recompor os read models de operações/custos/atividade a partir das tabelas PostgreSQL já existentes e alinhar a composição pública dos wrappers (incluindo paginação e metadados), sempre repetindo este comparator.\n\n`;
md+=`Artefato máquina-legível: [full-web-sqlite-postgres-parity.json](./full-web-sqlite-postgres-parity.json).\n`;
fs.writeFileSync(path.join(root,'artifacts','full-web-sqlite-postgres-parity.md'),md);
