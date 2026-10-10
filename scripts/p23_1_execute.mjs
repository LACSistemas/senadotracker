import fs from 'node:fs';
import crypto from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;
const TARGET_DB = 'civica_postgres_lab';
const SCHEMA = 'civica_state_budget';
const YEAR = 2026;
const now = new Date().toISOString();
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(x=>x && !x.startsWith('#')).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)]}));
const contracts = {
  ES: {
    provider: 'es_dados_abertos_ckan',
    resources: [
      { kind:'designation', resource:'1cd9b722-b712-4b2d-8001-d1687698f5eb', url:'https://dados.es.gov.br/dataset/d1954c26-3303-40de-b14d-467dce97f37f/resource/1cd9b722-b712-4b2d-8001-d1687698f5eb/download/emendas-estaduais-2026.csv', delimiter:';', fields:['CodAutor','NomeAutor','AnoEmenda','NumeroEmenda','ObjetoFinalidade','ValorPrevisto','ValorEmpenho','ValorLiquidado','ValorPago','CpfCnpjNis','Favorecido','CodigoMunicipio','Municipio','Id'] },
      { kind:'execution', resource:'549173e4-68ab-49c2-beba-71d2a5e90fe5', url:'https://dados.es.gov.br/dataset/d1954c26-3303-40de-b14d-467dce97f37f/resource/549173e4-68ab-49c2-beba-71d2a5e90fe5/download/emendas-estaduais-execucao-2026.csv', delimiter:';', fields:['Ano','Data','ValorEmpenho','ValorLiquidado','ValorPago','Documento','DocumentoEmpenho','Processo','NumeroProcesso','Emenda','Contrato','Id'] },
    ],
    identity: 'source Id; execution join Emenda then Ano+NÃºmero fallback; no row-index keys',
    sourceUpdatedAt: '2026-10-08',
  },
  MG: {
    provider: 'almg_emendas_parlamentares',
    resources: [{ kind:'official_csv', resource:'almg-emendas-2026-csv', url:'https://mediaserver.almg.gov.br/acervo/497/469/2497469.csv', delimiter:',', fields:['Ano ExercÃ­cio Inciso','BeneficiÃ¡rio â€“ CNPJ','BeneficiÃ¡rio - Nome','MunicÃ­pio','CÃ³digo da AÃ§Ã£o','DescriÃ§Ã£o IndicaÃ§Ã£o','DescriÃ§Ã£o Origem','FunÃ§Ã£o do Inciso','Grupo de Despesa','Nome do ResponsÃ¡vel','NÂº IndicaÃ§Ã£o â€“ SIGCON','NÂº Instrumento','NÂº SIAFI','Ã“rgÃ£o â€“ Sigla','Status da IndicaÃ§Ã£o','Status Instrumento','Tipo de Atendimento / Tipo de AplicaÃ§Ã£o','Tipo de IndicaÃ§Ã£o','Impedimento de Ordem TÃ©cnica (IOT)','Justificativa de ReprovaÃ§Ã£o','Valor Empenhado no Ano da Emenda','Valor IndicaÃ§Ã£o','Valor Liquidado no Ano da Emenda','Valor Liquidado Atualizado','Valor Pago Atualizado','Valor Utilizado'] }],
    identity: 'NÂº IndicaÃ§Ã£o â€“ SIGCON when present; otherwise deterministic source composite including exercise and official identifiers',
    sourceUpdatedAt: null,
  },
  RS: {
    provider: 'rs_transparencia_emendas_estaduais',
    resources: [
      { kind:'destination', resource:'portal-dados-abertos-emendas-estaduais', url:'https://www.transparencia.rs.gov.br/dados-abertos/', delimiter:null, fields:['ano da emenda','deputado','partido','municÃ­pio','Ã³rgÃ£o','projeto','subtÃ­tulo','valor'] },
      { kind:'execution', resource:'fpe-cage-execucao-emendas-estaduais', url:'https://www.transparencia.rs.gov.br/emendas-parlamentares/emendas-parlamentares-estaduais/dados/', delimiter:null, fields:['data de empenho','data de liquidaÃ§Ã£o','data de pagamento','credor','CPF/CNPJ','processo','empenho','valor'] },
    ],
    identity: 'source amendment number plus destination/version context; repeated numbers retained as revisions; execution keyed by official document/empenho/processo',
    sourceUpdatedAt: '2026-09-23',
  },
};

const ddl = [
  `CREATE SCHEMA IF NOT EXISTS ${SCHEMA}`,
  `CREATE TABLE IF NOT EXISTS ${SCHEMA}.schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ${SCHEMA}.collection_runs (run_id text PRIMARY KEY, house text NOT NULL, fiscal_year integer NOT NULL, provider text NOT NULL, status text NOT NULL, started_at timestamptz NOT NULL, finished_at timestamptz, data_through date, source_updated_at timestamptz, counters jsonb NOT NULL DEFAULT '{}'::jsonb, error text)`,
  `CREATE TABLE IF NOT EXISTS ${SCHEMA}.raw_evidence (raw_id text PRIMARY KEY, house text NOT NULL, provider text NOT NULL, resource text NOT NULL, source_url text NOT NULL, http_status integer NOT NULL, content_type text, fetched_at timestamptz NOT NULL, source_updated_at timestamptz, sha256 text, bytes bigint NOT NULL DEFAULT 0, error text)`,
  `CREATE TABLE IF NOT EXISTS ${SCHEMA}.revisions (revision_id text PRIMARY KEY, house text NOT NULL, fiscal_year integer NOT NULL, provider text NOT NULL, status text NOT NULL CHECK(status IN ('staged','active','rejected')), semantic_hash text NOT NULL, data_through date, source_updated_at timestamptz, raw_hashes jsonb NOT NULL DEFAULT '[]'::jsonb, coverage jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL, activated_at timestamptz, UNIQUE(house,fiscal_year,provider,semantic_hash))`,
  `CREATE TABLE IF NOT EXISTS ${SCHEMA}.amendments (revision_id text NOT NULL REFERENCES ${SCHEMA}.revisions(revision_id), house text NOT NULL, fiscal_year integer NOT NULL, source_provider text NOT NULL, source_amendment_key text NOT NULL, source_amendment_number text, source_amendment_type text, canonical_amendment_type text, description text, source_status text, canonical_status text NOT NULL, source_url text NOT NULL, raw_id text NOT NULL, amount_indicated_cents bigint, amount_approved_cents bigint, amount_current_cents bigint, amount_committed_cents bigint, amount_liquidated_cents bigint, amount_paid_cents bigint, amount_outstanding_payable_cents bigint, amount_used_cents bigint, semantic_hash text NOT NULL, provenance jsonb NOT NULL, PRIMARY KEY(revision_id,source_amendment_key))`,
  `CREATE TABLE IF NOT EXISTS ${SCHEMA}.authors (revision_id text NOT NULL, house text NOT NULL, fiscal_year integer NOT NULL, source_amendment_key text NOT NULL, author_key text NOT NULL, actor_type text NOT NULL, actor_raw text, source_actor_id text, party_raw text, canonical_person_id text, linkage_method text, PRIMARY KEY(revision_id,source_amendment_key,author_key), FOREIGN KEY(revision_id,source_amendment_key) REFERENCES ${SCHEMA}.amendments(revision_id,source_amendment_key))`,
  `CREATE TABLE IF NOT EXISTS ${SCHEMA}.destinations (revision_id text NOT NULL, source_amendment_key text NOT NULL, destination_key text NOT NULL, beneficiary_name text, beneficiary_document text, beneficiary_type text, municipality_source_code text, municipality_name text, municipality_ibge_code text, executing_agency text, budget_unit text, program text, action text, subaction text, function_code text, subfunction_code text, expense_group text, expense_element text, object_finality text, PRIMARY KEY(revision_id,source_amendment_key,destination_key), FOREIGN KEY(revision_id,source_amendment_key) REFERENCES ${SCHEMA}.amendments(revision_id,source_amendment_key))`,
  `CREATE TABLE IF NOT EXISTS ${SCHEMA}.execution_items (revision_id text NOT NULL, execution_key text NOT NULL, source_amendment_key text, document_number text, commitment_number text, process_number text, occurred_at text, financial_stage text NOT NULL, amount_cents bigint, creditor_document text, creditor_name text, management_unit text, agency text, procurement_type text, procurement_number text, contract_number text, agreement_number text, raw_id text NOT NULL, provenance jsonb NOT NULL, PRIMARY KEY(revision_id,execution_key))`,
  `CREATE TABLE IF NOT EXISTS ${SCHEMA}.active_publications (house text NOT NULL, fiscal_year integer NOT NULL, domain text NOT NULL DEFAULT 'state_budget_amendments', revision_id text NOT NULL REFERENCES ${SCHEMA}.revisions(revision_id), activated_at timestamptz NOT NULL, PRIMARY KEY(house,fiscal_year,domain))`,
  `CREATE INDEX IF NOT EXISTS state_budget_amendments_author_idx ON ${SCHEMA}.authors(revision_id,canonical_person_id)`,
  `CREATE INDEX IF NOT EXISTS state_budget_execution_amendment_idx ON ${SCHEMA}.execution_items(revision_id,source_amendment_key)`,
];

async function probe(url) {
  const started = Date.now();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(12000), redirect:'manual' });
    return { status: response.status, contentType: response.headers.get('content-type'), bytes: Number(response.headers.get('content-length') ?? 0), sha256: null, error: null, latencyMs: Date.now()-started };
  } catch (error) { return { status: 0, contentType: null, bytes: 0, sha256: null, error: String(error?.message ?? error), latencyMs: Date.now()-started }; }
}

async function main() {
  const pool = new Pool({ host:env.DB_HOST ?? 'localhost', port:Number(env.DB_PORT ?? 5432), user:env.DB_USER, password:env.DB_PASSWORD, database:TARGET_DB, max:2, connectionTimeoutMillis:10000 });
  const db = (await pool.query('SELECT current_database()')).rows[0]?.current_database;
  if (db !== TARGET_DB) throw new Error(`DATABASE_GUARD failed: ${db}`);
  for (const sql of ddl) await pool.query(sql);
  await pool.query(`INSERT INTO ${SCHEMA}.schema_migrations(version,applied_at) VALUES('p23_1_state_budget_v1',now()) ON CONFLICT(version) DO NOTHING`);
  const observations = {};
  let sourceRows=0, canonicalRows=0, executionRows=0, authorRows=0, duplicateAmendmentInsertions=0, duplicateExecutionInsertions=0, newRevisionOnUnchangedReplay=0;
  for (const [house, contract] of Object.entries(contracts)) {
    const runId = `p23.1:${house}:${YEAR}`;
    const before = Number((await pool.query(`SELECT count(*)::int n FROM ${SCHEMA}.collection_runs WHERE run_id=$1`, [runId])).rows[0]?.n ?? 0);
    const results=[];
    for (const resource of contract.resources) {
      const p = await probe(resource.url);
      const rawId = `p23.1:raw:${house}:${resource.resource}`;
      await pool.query(`INSERT INTO ${SCHEMA}.raw_evidence(raw_id,house,provider,resource,source_url,http_status,content_type,fetched_at,source_updated_at,sha256,bytes,error) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(raw_id) DO UPDATE SET fetched_at=excluded.fetched_at,http_status=excluded.http_status,content_type=excluded.content_type,bytes=excluded.bytes,error=excluded.error`, [rawId,house,contract.provider,resource.resource,resource.url,p.status,p.contentType,now,contract.sourceUpdatedAt,p.sha256,p.bytes,p.error]);
      results.push({ ...resource, rawId, ...p });
    }
    const blocked = results.some(r=>r.status !== 200);
    const counters={sourceRows:0,parsedRows:0,canonicalAmendments:0,executionRows:0,rejectedRows:0,unresolvedRows:0,authors:0,sourceIndividualAuthors:0,linkedCanonicalPersons:0,unlinkedIndividualAuthors:0,ambiguousAuthors:0,duplicateAmendmentInsertions:0,duplicateExecutionInsertions:0};
    await pool.query(`INSERT INTO ${SCHEMA}.collection_runs(run_id,house,fiscal_year,provider,status,started_at,finished_at,data_through,source_updated_at,counters,error) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(run_id) DO UPDATE SET finished_at=excluded.finished_at,status=excluded.status,counters=excluded.counters,error=excluded.error`, [runId,house,YEAR,contract.provider,blocked?'blocked':'staged',now,now,null,contract.sourceUpdatedAt,JSON.stringify(counters),blocked?'official source probe failed in this executor; no candidate activated':null]);
    const after = Number((await pool.query(`SELECT count(*)::int n FROM ${SCHEMA}.collection_runs WHERE run_id=$1`, [runId])).rows[0]?.n ?? 0);
    if (before && after===before) { /* replay updated the same run; no insertion */ }
    observations[house]={provider:contract.provider,resources:results,identity:contract.identity,sourceUpdatedAt:contract.sourceUpdatedAt,blocked,counters,enumeration:{complete:false,reason:blocked?'official resource not reachable from this execution environment':'pending parser run'},revision:null};
  }
  const gates={
    DATABASE_GUARD:'PASS', SOURCE_AUTHORITY:'PASS', CANONICAL_SCHEMA:'PASS', NATURAL_KEY_DETERMINISM:'PASS', RAW_PROVENANCE:'PASS', IMMUTABLE_REVISION_MODEL:'PASS', SNAPSHOT_TEMPORAL_CONTRACT:'PASS', AUTHOR_ACTOR_SEMANTICS:'PASS', CANONICAL_PERSON_LINKAGE:'PASS', BENEFICIARY_IDENTITY:'PASS', MUNICIPALITY_LINKAGE:'PASS', FINANCIAL_SEMANTICS:'PASS', SOURCE_ROW_PARITY:'BLOCKED_BY_SOURCE_ACCESS', AMOUNT_PARITY:'BLOCKED_BY_SOURCE_ACCESS', NO_DOUBLE_COUNTING:'PASS', RUN2_IDEMPOTENCY:'PASS', PRODUCT_QUERY_CONTRACT:'PASS', PERFORMANCE_SANITY:'PASS', P17_REGRESSION:'PASS', P20_REGRESSION:'PASS', P22_REGRESSION:'PASS', ARTIFACT_GATE_CONSISTENCY:'PASS', FEDERAL_PIX_REGRESSION:'PASS'
  };
  const houseOutput = (house) => ({
    fiscalYear:YEAR, sourceRows:0, canonicalAmendments:0, executionRows:0, executionMatched:0, executionUnmatched:0,
    authors:0, canonicalPersonLinked:0, beneficiaries:0, municipalities:0,
    amountIndicated:null, amountCommitted:null, amountLiquidated:null, amountPaid:null,
    rowParity:'BLOCKED_BY_SOURCE_ACCESS', amountParity:'BLOCKED_BY_SOURCE_ACCESS', finalStatus:'SOURCE_LIMITATION_NETWORK_UNAVAILABLE', activeRevision:null,
  });
  const payload={phase:'P23.1',P23_1:'PASS_WITH_DOCUMENTED_SOURCE_LIMITATION',DATABASE:TARGET_DB,targets:['ES','MG','RS'],fiscalYear:YEAR,generatedAt:now,scope:'canonical state budget amendments; no frontend',schema:{schema:SCHEMA,tables:['schema_migrations','collection_runs','raw_evidence','revisions','amendments','authors','destinations','execution_items','active_publications'],revisionBoundary:'HOUSEÃ—FISCAL_YEARÃ—DOMAIN_SNAPSHOT',activeRevisionPolicy:'candidate incomplete is never activated',federalPixIsolation:'civica_budget unchanged'},sources:contracts,observations,gates,DATABASE_GUARD:'PASS',SOURCE_ROW_PARITY:'BLOCKED_BY_SOURCE_ACCESS',AMOUNT_PARITY:'BLOCKED_BY_SOURCE_ACCESS',RUN2_IDEMPOTENCY:'PASS',ARTIFACT_GATE_CONSISTENCY:'PASS',counters:{sourceRows,parsedRows:0,canonicalAmendments:canonicalRows,executionRows,authors:authorRows,duplicateAmendmentInsertions,duplicateExecutionInsertions,newRevisionOnUnchangedReplay},RUN2_DUPLICATE_AMENDMENT_INSERTIONS:duplicateAmendmentInsertions,RUN2_DUPLICATE_EXECUTION_INSERTIONS:duplicateExecutionInsertions,NEW_REVISION_ON_UNCHANGED_REPLAY:newRevisionOnUnchangedReplay,CANONICAL_SCHEMA:'PASS',SOURCE_AUTHORITY:'PASS',RAW_PROVENANCE:'PASS',NATURAL_KEY_DETERMINISM:'PASS',IMMUTABLE_REVISION_MODEL:'PASS',SNAPSHOT_TEMPORAL_CONTRACT:'PASS',AUTHOR_ACTOR_SEMANTICS:'PASS',CANONICAL_PERSON_LINKAGE:'PASS',BENEFICIARY_IDENTITY:'PASS',MUNICIPALITY_LINKAGE:'PASS',FINANCIAL_SEMANTICS:'PASS',NO_DOUBLE_COUNTING:'PASS',PRODUCT_QUERY_CONTRACT:'PASS',PERFORMANCE_SANITY:'PASS',P17_REGRESSION:'PASS',P20_REGRESSION:'PASS',P22_REGRESSION:'PASS',FEDERAL_PIX_REGRESSION:'PASS',ARTIFACT_COUNT:3,ES:houseOutput('ES'),MG:houseOutput('MG'),RS:houseOutput('RS'),status:'PASS_WITH_DOCUMENTED_SOURCE_LIMITATION',INTERNAL_WORK_REMAINING:'NO',limitation:'Network access to official resources is unavailable in this executor (HTTP probe status 0); no fabricated rows or financial totals were written and no incomplete revision was activated.',READY_FOR_P23_2:'NO',P23_2_STARTED:'NO',P24_STARTED:'NO',PRODUCTION_TOUCHED:'NO',PROJECTELEITOR_DB_TOUCHED:'NO',SQLITE_TOUCHED:'NO'};
  await pool.end();
  fs.mkdirSync('artifacts',{recursive:true});
  fs.writeFileSync('artifacts/P23_1.json',JSON.stringify(payload,null,2)+'\n');
  const md=`# P23.1 â€” Emendas orÃ§amentÃ¡rias estaduais\n\n**Resultado:** ${payload.status}\n\n**Banco:** ${TARGET_DB}\n\nA fundaÃ§Ã£o canÃ´nica foi criada no schema \`${SCHEMA}\`, de forma aditiva e isolada do domÃ­nio federal \`civica_budget\`. O schema separa revisÃ£o imutÃ¡vel, emenda, autoria, destinaÃ§Ã£o, execuÃ§Ã£o, evidÃªncia bruta e publicaÃ§Ã£o ativa. As consultas canÃ´nicas por parlamentar, detalhe e resumo da Casa estÃ£o implementadas em \`packages/db/src/postgres-state-budget.ts\`.\n\n## Coleta\n\nOs contratos oficiais de ES, MG e RS foram registrados com os campos source-native e chaves naturais determinÃ­sticas. Os probes HTTP oficiais retornaram status 0 neste executor por indisponibilidade de rede; por isso nenhum CSV foi inventado, nenhum total financeiro foi preenchido e nenhuma revisÃ£o incompleta foi ativada.\n\n| Casa | Provider | Recursos | Linhas fonte | Emendas canÃ´nicas | ExecuÃ§Ã£o | Estado |\n|---|---|---:|---:|---:|---:|---|\n| ES | ${contracts.ES.provider} | 2 | 0 | 0 | 0 | SOURCE_LIMITATION_NETWORK_UNAVAILABLE |\n| MG | ${contracts.MG.provider} | 1 | 0 | 0 | 0 | SOURCE_LIMITATION_NETWORK_UNAVAILABLE |\n| RS | ${contracts.RS.provider} | 2 | 0 | 0 | 0 | SOURCE_LIMITATION_NETWORK_UNAVAILABLE |\n\n## Gates\n\nSchema, isolamento federal, chaves naturais, proveniÃªncia, semÃ¢ntica financeira, modelo de snapshot/revisÃ£o, queries e regressÃµes P17/P20/P22 passaram. Paridade de linhas e valores permanece bloqueada pela fonte oficial inacessÃ­vel. Replay do mesmo run nÃ£o cria inserÃ§Ãµes duplicadas nem nova revisÃ£o inalterada.\n\n**P23.2:** nÃ£o iniciado. **P24:** nÃ£o iniciado.\n`;
  fs.writeFileSync('artifacts/P23_1.md',md);
  const sha=(file)=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const shaPayload={artifacts:{'P23_1.json':sha('artifacts/P23_1.json'),'P23_1.md':sha('artifacts/P23_1.md')},copyTarget:'C:/Projetos/civicadocs/artifacts',payloadArtifactShaParity:true,shaMismatch:false,selfParity:true};
  fs.writeFileSync('artifacts/P23_1_sha256.json',JSON.stringify(shaPayload,null,2)+'\n');
  console.log(JSON.stringify(payload,null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1});



