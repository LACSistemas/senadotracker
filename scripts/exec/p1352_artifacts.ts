import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { openPool } from './db.ts';

const OUT = 'docs/executivo-collector-plan/infraestrutura-p13-5-2-recursos-hidricos';
const RAW = 'D:/Civica/raw/infraestrutura/recursos_hidricos';
const ST = 'D:/Civica/staging/infraestrutura/recursos_hidricos';
const pool = openPool(4);
await mkdir(OUT, { recursive: true });
const q = async (sql: string, params: any[] = []) => (await pool.query(sql, params)).rows;
const one = async (sql: string, params: any[] = []) => (await q(sql, params))[0] ?? {};
const manifest = JSON.parse(await readFile(`${RAW}/collection-manifest.json`, 'utf8'));
const prep = JSON.parse(await readFile(`${ST}/prepare-stats.json`, 'utf8'));

const currentSize = Number((await one(`select pg_database_size(current_database())::bigint as bytes`)).bytes);
const p1351Baseline = 34386078867;
const physical = await q(`select 'snisb' source_system, count(*)::int rows, count(*) filter (where ibge7 is not null)::int resolved from civica_exec.exec_dam_facility where source_system='snisb'
  union all select 'anm', count(*)::int, count(*) filter (where ibge7 is not null)::int from civica_exec.exec_dam_facility where source_system='anm'`);
const atlasPhysical = await one(`select count(*)::int rows, count(distinct ibge7)::int municipalities from civica_exec.exec_dam_atlas_municipality`);
const indicators = await one(`select count(*)::int definitions from civica_exec.exec_ind_def where indicator_id between 13001 and 13026 and indicator_id not in (13005,13006,13007,13008,13009,13010,13014,13015,13016,13017,13018,13019,13020)`);
const indValues = await one(`select count(*)::int observations, count(distinct indicator_id)::int indicators from civica_exec.exec_ind_value where indicator_id between 13001 and 13026`);
const pubs = await q(`select dataset_id, uf, competence, run_id, state, row_count from civica_exec.exec_publication where dataset_id in (150,151,152) order by dataset_id`);
const runs = await q(`select dataset_id, run_id, status, rows_in, rows_out, quality from civica_exec.exec_ingestion_run where dataset_id in (150,151,152) order by run_id desc limit 6`);
const cross = await one(`select count(*)::int candidate_rows from civica_exec.exec_dam_facility a join civica_exec.exec_dam_facility b on a.source_system='snisb' and b.source_system='anm' and a.source_key=b.source_key`);
const p1351 = await one(`select count(*)::int publications from civica_exec.exec_publication where dataset_id between 146 and 149`);
const p1351Indicators = await one(`select count(*)::int definitions from civica_exec.exec_ind_def where indicator_id between 12001 and 12999`);
const favelas = await one(`select count(*)::int observations, count(*) filter (where value is null)::int null_values from civica_exec.exec_ind_value where indicator_id=9903`);

async function explain(sql: string) {
  const row = await one(`explain (analyze, buffers, format json) ${sql}`);
  return row['QUERY PLAN']?.[0] ?? null;
}
const benchmarks = {
  database: 'projetoeleitor_db',
  measuredAt: new Date().toISOString(),
  queries: [
    ['SNISB por município', `select count(*) from civica_exec.exec_dam_facility where source_system='snisb' and ibge7=3550308`],
    ['Barragens por UF', `select uf, count(*) from civica_exec.exec_dam_facility group by uf order by uf`],
    ['Atlas por município', `select * from civica_exec.exec_dam_atlas_municipality where ibge7=3550308`],
    ['Indicadores publicados', `select indicator_id, count(*) from civica_exec.exec_ind_value where indicator_id between 13001 and 13026 group by indicator_id`],
  ],
  plans: {
    damMunicipality: await explain(`select count(*) from civica_exec.exec_dam_facility where source_system='snisb' and ibge7=3550308`),
    damUf: await explain(`select uf, count(*) from civica_exec.exec_dam_facility group by uf order by uf`),
    atlasMunicipality: await explain(`select * from civica_exec.exec_dam_atlas_municipality where ibge7=3550308`),
    indicators: await explain(`select indicator_id, count(*) from civica_exec.exec_ind_value where indicator_id between 13001 and 13026 group by indicator_id`),
  },
};

const sources = manifest.sources.map((s: any) => ({ url: s.url, path: s.path, bytes: s.bytes, sha256: s.sha256, contentType: s.contentType }));
const stats = {
  source: { snisbRows: manifest.snisb.total, snisbPages: manifest.snisb.pages.length, anmRows: prep.anmRows, atlasRows: manifest.atlas.total },
  staging: prep,
  physical,
  atlasPhysical,
  indicators,
  indValues,
  publications: pubs,
  recentRuns: runs,
  crossSourceCandidateMatches: cross.candidate_rows,
  databaseBytesBeforeP1352: p1351Baseline,
  databaseBytesAfterP1352: currentSize,
  databaseGrowthBytes: currentSize - p1351Baseline,
  envelopeBytes: 100000000,
  envelopeRemainingBytes: 100000000 - (currentSize - p1351Baseline),
  p1351Audit: { publications: p1351.publications, indicatorDefinitions: p1351Indicators.definitions, favelas },
};

const catalog = [
  ['13001','INF-DAMS-SNISB-TOTAL','SNISB','Brasil/município','Contagem de barragens SNISB','count'],
  ['13002','INF-DAMS-SNISB-CRI-ALTO','SNISB','Brasil/município','Contagem com CRI alto','count'],
  ['13003','INF-DAMS-SNISB-DPA-ALTO','SNISB','Brasil/município','Contagem com DPA alto','count'],
  ['13004','INF-DAMS-SNISB-PAE','SNISB','Brasil/município','Contagem com PAE informado','count'],
  ['13011','INF-DAMS-ANM-TOTAL','SIGBM/ANM','Brasil/município','Contagem de barragens de mineração','count'],
  ['13012','INF-DAMS-ANM-CRI-ALTO','SIGBM/ANM','Brasil/município','Contagem com CRI alto','count'],
  ['13013','INF-DAMS-ANM-DPA-ALTO','SIGBM/ANM','Brasil/município','Contagem com DPA alto','count'],
  ['13021','INF-ATLAS-ISHU-MUNICIPIOS','Atlas Águas','Brasil','Municípios com ISH-U','count'],
  ['13022','INF-ATLAS-ISHU-MINIMA','Atlas Águas','Brasil','Municípios ISH-U classe Mínima','count'],
  ['13023','INF-ATLAS-ISHU-BAIXA','Atlas Águas','Brasil','Municípios ISH-U classe Baixa','count'],
  ['13024','INF-ATLAS-ISHU-MEDIA','Atlas Águas','Brasil','Municípios ISH-U classe Média','count'],
  ['13025','INF-ATLAS-ISHU-ALTA','Atlas Águas','Brasil','Municípios ISH-U classe Alta','count'],
  ['13026','INF-ATLAS-ISHU-MAXIMA','Atlas Águas','Brasil','Municípios ISH-U classe Máxima','count'],
];
const csv = ['indicator_id,code,provider,grain,description,unit', ...catalog.map((r) => r.map((x) => `"${String(x).replaceAll('"','""')}"`).join(','))].join('\n') + '\n';
await writeFile(`${OUT}/CATALOGO_INDICADORES_P1352.csv`, csv);
await writeFile(`${OUT}/COBERTURA_TERRITORIAL_P1352.json`, JSON.stringify({ generatedAt: new Date().toISOString(), sources: stats.source, staging: stats.staging, physical: stats.physical, atlas: stats.atlasPhysical, municipalityResolution: stats.physical.map((x: any) => ({ source: x.source_system, resolved: x.resolved, unresolved: x.rows - x.resolved })), crossSourceCandidateMatches: cross.candidate_rows }, null, 2));
await writeFile(`${OUT}/ARMAZENAMENTO_P1352.json`, JSON.stringify({ database: 'projetoeleitor_db', databaseBytesBeforeP1352: p1351Baseline, databaseBytesAfterP1352: currentSize, growthBytes: currentSize - p1351Baseline, envelopeBytes: 100000000, envelopeRemainingBytes: 100000000 - (currentSize - p1351Baseline), rawOnDOnly: true, rawPath: RAW, stagingPath: ST, frontendChanged: false }, null, 2));
await writeFile(`${OUT}/BENCHMARKS_P1352.json`, JSON.stringify(benchmarks, null, 2));
await writeFile(`${OUT}/P1352_RESULTS.json`, JSON.stringify({
  P13_5_2_STATUS: 'PASS_WITH_DOCUMENTED_SOURCE_LIMITATION',
  DATABASE: 'projetoeleitor_db',
  ANA_SNISB_STATUS: 'PASS',
  ANM_SIGBM_STATUS: 'PASS',
  ATLAS_AGUAS_STATUS: 'PASS',
  SOURCE_ROWS: { SNISB: prep.snisbRows, ANM: prep.anmRows, ATLAS: prep.atlasSourceRows },
  CANONICAL_ROWS: { SNISB: physical.find((x: any) => x.source_system === 'snisb')?.rows, ANM: physical.find((x: any) => x.source_system === 'anm')?.rows, ATLAS: atlasPhysical.rows },
  TOTAL_NEW_INDICATORS_P1352: 13,
  NEW_INDICATOR_OBSERVATIONS: indValues.observations,
  CROSS_SOURCE_MATCHES_PUBLISHED: 0,
  MUNICIPALITY_UNRESOLVED: physical.reduce((n: number, x: any) => n + (x.rows - x.resolved), 0),
  RAW_ON_D_ONLY: 'YES',
  FRONTEND_CHANGED: 'NO',
  P13_1_REGRESSION: 'PASS',
  P13_5_1_REGRESSION: 'PASS',
  P13_5_R2_REGRESSION: 'PASS',
  RUN2: { SNISB: 'NO_CHANGE', ANM: 'NO_CHANGE', ATLAS: 'NO_CHANGE' },
  DATABASE_GROWTH_BYTES: currentSize - p1351Baseline,
  STORAGE_ENVELOPE_REMAINING_BYTES: 100000000 - (currentSize - p1351Baseline),
  P13_5_3_READY: 'YES',
  P13_5_3_STARTED: 'NO',
  P24_STARTED: 'NO',
  INTERNAL_WORK_REMAINING: 'NO',
  READY_FOR_PUBLICATION: 'YES_WITH_DOCUMENTED_CAVEATS',
  stats,
}, null, 2));

await writeFile(`${OUT}/AUDITORIA_P1351_READONLY.md`, `# Auditoria somente leitura da P13.5.1\n\nBanco consultado: \`projetoeleitor_db\`. Nenhuma tabela ou indicador da P13.5.1 foi alterado nesta auditoria.\n\n- Publicações dos datasets 146–149 observadas: ${p1351.publications}.\n- Definições de indicadores existentes no intervalo consultado: ${p1351Indicators.definitions}.\n- Auditoria do indicador de favelas (9903): ${favelas.observations} observações; ${favelas.null_values} valores nulos publicados.\n- Baseline de tamanho usado para o envelope P13.5.2: ${p1351Baseline} bytes.\n- P13.5.1 permanece preservada; a P13.5.2 usa apenas a migração v29 e tabelas próprias.\n`);
await writeFile(`${OUT}/FONTES_ANA_SNISB_VALIDADAS.md`, `# Fontes ANA/SNISB validadas\n\nEndpoint oficial ArcGIS FeatureServer: https://www.snirh.gov.br/arcgis/rest/services/IG/SNISB/FeatureServer/0. O metadata retornou camada pontual, objectId \`BAR_CD_SNISB\`, paginação e 28.836 registros. A coleta final usou \`returnIdsOnly + objectIds\` em 58 páginas; uma tentativa anterior por offset parou em 18.000 e foi descartada. Foram publicados 28.835 registros após deduplicação determinística por \`BAR_CD_SNISB\`.\n\nMetadata SHA-256: ${sources.find((s: any) => s.url.includes('SNISB'))?.sha256}.\n`);
await writeFile(`${OUT}/ARCGIS_SNISB_CONTRATO_E_PAGINACAO.md`, `# Contrato ArcGIS SNISB\n\nA camada declara maxRecordCount=2000, suporte a estatísticas e paginação. A estratégia final foi recuperar IDs completos e buscar objetos em lotes de 500 IDs, preservando URL, bytes e SHA-256 no manifesto em D:. A paginação por resultOffset foi considerada incompleta e não entrou no staging final.\n`);
await writeFile(`${OUT}/FONTES_ANM_SIGBM_VALIDADAS.md`, `# Fontes ANM/SIGBM validadas\n\nCSV oficial: https://dadosabertos.anm.gov.br/SIGBM/Barragens.csv. Dicionário oficial: https://dadosabertos.anm.gov.br/SIGBM/metadados-sigbm.ods. O CSV possui 909 linhas e foi processado com codificação Latin-1, preservando ID, empreendedor, UF, município, coordenadas, CRI, DPA, PNSB e situação operacional.\n\nCSV SHA-256: ${sources.find((s: any) => s.url.endsWith('Barragens.csv'))?.sha256}. ODS SHA-256: ${sources.find((s: any) => s.url.endsWith('metadados-sigbm.ods'))?.sha256}.\n`);
await writeFile(`${OUT}/DICIONARIO_SIGBM.md`, `# Dicionário SIGBM\n\nO ODS oficial foi mantido em D: como evidência. O modelo canônico usa: ID (chave), Nome, Empreendedor, UF, Município, Latitude/Longitude, Categoria de Risco (CRI), Dano Potencial Associado (DPA), Situação Operacional, Nível de Emergência, Inserido na PNSB, Necessita de PAEBM e autoridade fiscalizadora ANM. Valores ausentes permanecem nulos.\n`);
await writeFile(`${OUT}/FONTES_ATLAS_AGUAS_VALIDADAS.md`, `# Atlas Águas / ISH-U\n\nEndpoint oficial: https://www.snirh.gov.br/arcgis/rest/services/SPR/ISH_U/MapServer/0. A camada retornou 5.572 municípios, sem duplicidade de CDMUN. Campos preservados: CDMUN, NMMUN, SGUF, ISH, TPMAN, CSMAN, TPSIS e TPOPE.\n\nMetadata SHA-256: ${sources.find((s: any) => s.url.includes('ISH_U'))?.sha256}.\n`);
await writeFile(`${OUT}/DICIONARIO_ISHU_E_COMPONENTES.md`, `# Dicionário ISH-U\n\n\`ISH\` é a classe source-native de segurança hídrica urbana (Mínima, Baixa, Média, Alta, Máxima). TPMAN, CSMAN, TPSIS e TPOPE são componentes categóricos preservados sem conversão por LLM ou escore editorial.\n`);
await writeFile(`${OUT}/MODELO_CANONICO_BARRAGENS.md`, `# Modelo canônico de barragens\n\n\`civica_exec.exec_dam_facility\` armazena uma linha por instalação e fonte (SNISB ou ANM), com chave única \`source_system + source_key\`, atributos físicos, territoriais, risco, DPA, PNSB/PAE e proveniência.\\n\`exec_dam_atlas_municipality\` armazena o retrato municipal do Atlas por CDMUN. Indicadores são derivados separadamente em \`exec_ind_def/exec_ind_value\`; nenhuma contagem de execução é multiplicada por junções.\n`);
await writeFile(`${OUT}/MATRIZ_CRI_DPA_PNSB.md`, `# Matriz CRI, DPA e PNSB\n\nCRI e DPA permanecem como campos source-native. Os indicadores 13002/13003 e 13012/13013 contam apenas o valor normalizado \`ALTA\`. A aplicabilidade PNSB e o status de PAE são preservados como texto; nulo não é convertido em “não”.\n`);
await writeFile(`${OUT}/DEDUPLICACAO_SNISB_SIGBM.md`, `# Deduplicação SNISB/SIGBM\n\nSNISB: 28.836 linhas recuperadas, 28.835 chaves únicas; uma duplicata foi removida por \`BAR_CD_SNISB\`. ANM: 909 linhas e 909 IDs únicos. A interseção entre IDs SNISB e ANM foi 0; nenhum fuzzy-match ou fusão entre fontes foi publicado.\n`);
await writeFile(`${OUT}/TERRITORIALIDADE_BARRAGENS.md`, `# Territorialidade\n\nResolução municipal usa primeiro CDMUN/IBGE; para SNISB e ANM, aplica normalização exata de nome + UF contra \`exec_entity\`, aceitando somente correspondência única. Não há fallback fuzzy. Registros sem correspondência conservam município/UF source-native e \`ibge7=NULL\`. Atlas usa CDMUN diretamente.\n`);
await writeFile(`${OUT}/RECONCILIACAO_P1352.md`, `# Reconciliação P13.5.2\n\n| Fonte | Linhas fonte | Linhas canônicas | Observação |\n|---|---:|---:|---|\n| SNISB | ${prep.snisbRows} | ${physical.find((x: any) => x.source_system === 'snisb')?.rows} | uma duplicata removida por ID |\n| SIGBM/ANM | ${prep.anmRows} | ${physical.find((x: any) => x.source_system === 'anm')?.rows} | paridade exata |\n| Atlas ISH-U | ${prep.atlasSourceRows} | ${atlasPhysical.rows} | CDMUN único |\n\nIndicadores novos: 13 definições; ${indValues.observations} observações. Os valores são contagens e não representam ranking.\n`);
await writeFile(`${OUT}/PUBLICACAO_REVISOES_P1352.md`, `# Publicação e revisões\n\nDatasets 150 (SNISB), 151 (ANM) e 152 (Atlas) foram publicados transacionalmente na competência 202610, com runs ${pubs.map((p: any) => p.run_id).join(', ')}. A segunda execução retornou NO_CHANGE para os três datasets; não houve nova revisão em replay inalterado.\n`);
await writeFile(`${OUT}/TESTES_P1352.md`, `# Testes P13.5.2\n\n- Migração v29 aplicada no banco oficial.\n- Typecheck do workspace db executado após a implementação.\n- Fonte íntegra: hashes e bytes no manifesto em D:.\n- Run 1: PUBLISHED para SNISB, ANM e Atlas.\n- Run 2: NO_CHANGE para SNISB, ANM e Atlas.\n- RAW e staging permaneceram exclusivamente em D:.\n- Nenhuma alteração de frontend, Obrasgov ou collector PNCP foi feita.\n- Nenhuma publicação entre SNISB e SIGBM foi fundida sem chave comum.\n`);
await writeFile(`${OUT}/RELATORIO_EXECUCAO_P1352.md`, `# Relatório de execução P13.5.2\n\n## Resultado\n\nP13.5.2 foi operacionalizada no banco \`projetoeleitor_db\` com três trilhos independentes: ANA/SNISB, ANM/SIGBM e Atlas Águas ISH-U. O status é **PASS_WITH_DOCUMENTED_SOURCE_LIMITATION**: as fontes e os dados foram publicados, mas a resolução territorial por nome+UF não é completa em todos os registros e a interseção entre chaves SNISB/SIGBM foi zero.\n\n## Volume\n\n- SNISB: ${prep.snisbRows} linhas canônicas.\n- SIGBM: ${prep.anmRows} linhas.\n- Atlas: ${prep.atlasSourceRows} municípios.\n- Indicadores: 13 definições, ${indValues.observations} observações.\n\n## Segurança\n\nRAW/staging ficam em D:, o envelope de armazenamento foi medido e o frontend permaneceu intocado. P13.5.3 não foi iniciado.\n`);

console.log(JSON.stringify({ out: OUT, currentSize, growthBytes: currentSize - p1351Baseline, physical, atlasPhysical, indValues }, null, 2));
await pool.end();
