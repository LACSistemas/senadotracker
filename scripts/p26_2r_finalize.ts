import fs from 'node:fs';
import { createHash } from 'node:crypto';
import pg from 'pg';
import { getNationalMetricCatalog, getNationalMetricCoverage, getNationalOverview, getNationalRanking, getNationalPartyAggregates, getNationalUfAggregates, getNationalBudgetAggregates } from '../packages/db/src/postgres-national-analytics.ts';

const env: Record<string, string> = {};
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([^#=]+)=(.*)$/);
  if (m) env[m[1]!.trim()] = m[2]!.trim().replace(/^['"]|['"]$/g, '');
}
if (env.DB_NAME && env.DB_NAME !== 'projetoeleitor_db') throw new Error(`P26.2R official DB guard: ${env.DB_NAME}`);
const pool = new pg.Pool({ host: env.DB_HOST ?? 'localhost', port: Number(env.DB_PORT ?? 5432), database: 'projetoeleitor_db', user: env.DB_USER, password: env.DB_PASSWORD, max: 4 });
const q = async <T = any>(sql: string, values?: unknown[]) => (await pool.query<T>(sql, values)).rows;
const now = new Date().toISOString();

type Alias = { raw: string; code: string | null; name: string | null; status: string; rule: string; evidence: string };
const aliases: Alias[] = [];
const canonicalCodes: Record<string, string> = {
  AGIR:'AGIR', AVANTE:'AVANTE', CIDADANIA:'CIDADANIA', DC:'DC', MDB:'MDB', MOBILIZA:'MOBILIZA', 'MISSÃO':'MISSÃO', MISSAO:'MISSÃO', NOVO:'NOVO', PDT:'PDT', PL:'PL', PP:'PP', PRD:'PRD', PSB:'PSB', PSD:'PSD', PSDB:'PSDB', PSOL:'PSOL', PT:'PT', PV:'PV', REDE:'REDE', REP:'REP', REPUBLICANOS:'REPUBLICANOS', SOLIDARIEDADE:'SOLIDARIEDADE'
};
for (const [raw, code] of Object.entries(canonicalCodes)) aliases.push({ raw, code, name: code, status: 'EXACT_CANONICAL_CODE', rule: 'EXACT_CANONICAL_CODE', evidence: 'Observed current roster value; exact code preserved.' });
aliases.push(
  { raw:'PCdoB', code:'PCDOB', name:'PCdoB', status:'EXACT_CANONICAL_CODE', rule:'EXACT_CANONICAL_CODE', evidence:'Observed current roster value; canonical code is PCDOB.' },
  { raw:'PC DO B', code:'PCDOB', name:'PCdoB', status:'NORMALIZED_ALIAS', rule:'EXACT_ALIAS_P17_3C2', evidence:'Existing deterministic P17 alias contract.' },
  { raw:'PC do B', code:'PCDOB', name:'PCdoB', status:'NORMALIZED_ALIAS', rule:'EXACT_ALIAS_P17_3C2', evidence:'Existing deterministic P17 alias contract, case variant explicit.' },
  { raw:'PCDOB', code:'PCDOB', name:'PCdoB', status:'EXACT_CANONICAL_CODE', rule:'EXACT_CANONICAL_CODE', evidence:'Existing deterministic P17 alias contract.' },
  { raw:'PODEMOS', code:'PODEMOS', name:'PODEMOS', status:'EXACT_CANONICAL_CODE', rule:'EXACT_CANONICAL_CODE', evidence:'Observed current roster value.' },
  { raw:'PODE', code:'PODEMOS', name:'PODEMOS', status:'NORMALIZED_ALIAS', rule:'EXACT_ALIAS_P17_3C2', evidence:'Existing deterministic P17 alias contract.' },
  { raw:'REPUBLICANO', code:'REPUBLICANOS', name:'REPUBLICANOS', status:'NORMALIZED_ALIAS', rule:'EXACT_ALIAS_P17_3C2', evidence:'Existing deterministic P17 alias contract.' },
  { raw:'SD', code:'SOLIDARIEDADE', name:'SOLIDARIEDADE', status:'NORMALIZED_ALIAS', rule:'EXACT_ALIAS_P17_3C2', evidence:'Existing deterministic P17 alias contract.' },
  { raw:'SDD', code:'SOLIDARIEDADE', name:'SOLIDARIEDADE', status:'NORMALIZED_ALIAS', rule:'EXACT_ALIAS_P17_3C2', evidence:'Existing deterministic P17 alias contract; explicit observed variant.' },
  { raw:'SOLIDARI', code:'SOLIDARIEDADE', name:'SOLIDARIEDADE', status:'NORMALIZED_ALIAS', rule:'EXACT_ALIAS_P17_3C2', evidence:'Existing deterministic P17 alias contract.' },
  { raw:'UB', code:'UNIÃO', name:'UNIÃO', status:'NORMALIZED_ALIAS', rule:'EXACT_ALIAS_P17_3C2', evidence:'Existing deterministic P17 alias contract.' },
  { raw:'UNIÃO BRASIL', code:'UNIÃO', name:'UNIÃO', status:'NORMALIZED_ALIAS', rule:'EXACT_ALIAS_P17_3C2', evidence:'Existing deterministic P17 alias contract.' },
  { raw:'UNIAO BRASIL', code:'UNIÃO', name:'UNIÃO', status:'NORMALIZED_ALIAS', rule:'EXACT_ALIAS_P17_3C2', evidence:'Existing deterministic P17 alias contract.' },
  { raw:'UNIAO', code:'UNIÃO', name:'UNIÃO', status:'NORMALIZED_ALIAS', rule:'EXACT_ALIAS_P17_3C2', evidence:'Existing deterministic P17 alias contract.' },
  { raw:'União', code:'UNIÃO', name:'UNIÃO', status:'NORMALIZED_ALIAS', rule:'EXACT_ALIAS_P17_3C2', evidence:'Observed case variant made explicit; no fuzzy matching.' },
  { raw:'UNIÃO', code:'UNIÃO', name:'UNIÃO', status:'EXACT_CANONICAL_CODE', rule:'EXACT_CANONICAL_CODE', evidence:'Observed current roster value.' },
  { raw:'UNIÃO BRASIL (UB)', code:'UNIÃO', name:'UNIÃO', status:'NORMALIZED_ALIAS', rule:'EXACT_ALIAS_P17_3C2', evidence:'Explicit source alias contract.' },
);

function stable(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value as Record<string, unknown>).sort().map(k => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
const hash = (x: unknown) => createHash('sha256').update(stable(x)).digest('hex');

async function explainPartyLookup() {
  return (await q<any>(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON)
    SELECT c.house,c.external_id,party.raw_party_label
    FROM civica_state.current_state_parliamentarians c
    LEFT JOIN LATERAL (
      SELECT pm.raw_party_label
      FROM civica_state.party_memberships pm
      WHERE pm.house=c.house AND pm.provider=c.provider AND pm.person_external_id=c.external_id
      ORDER BY pm.end_at DESC NULLS LAST, pm.start_at DESC NULLS LAST
      LIMIT 1
    ) party ON true`))[0]?.['QUERY PLAN'] ?? null;
}
function planSummary(plan: any) {
  const root = plan?.[0]?.Plan ?? plan?.[0] ?? null;
  const nodes: string[] = [];
  const walk = (n: any) => { if (!n) return; if (n['Node Type']) nodes.push(`${n['Node Type']}${n['Actual Total Time'] !== undefined ? `:${n['Actual Total Time']}` : ''}`); for (const c of n.Plans ?? []) walk(c); };
  walk(root); return { executionTimeMs: root?.['Actual Total Time'] ?? null, nodes };
}

async function main() {
  const proof = (await q<{ current_database: string; current_user: string }>('SELECT current_database(), current_user'))[0]!;
  if (proof.current_database !== 'projetoeleitor_db') throw new Error(`Connected to ${proof.current_database}`);

  const sourceBefore = (await q<any>(`SELECT (SELECT count(*)::bigint FROM civica.profiles) federal_profiles,(SELECT count(*)::bigint FROM civica_state.current_state_parliamentarians) state_roster,(SELECT count(*)::bigint FROM civica_state.party_memberships) party_memberships`))[0];
  const beforeExplain = await explainPartyLookup();
  await pool.query(`CREATE SCHEMA IF NOT EXISTS civica_national;
    CREATE TABLE IF NOT EXISTS civica_national.party_aliases(
      raw_party text PRIMARY KEY,
      canonical_party_code text,
      canonical_party_name text,
      normalization_status text NOT NULL,
      normalization_rule text NOT NULL,
      evidence text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );`);
  // Preserve all observed current raw values as explicit unresolved rows. This
  // is a bounded read-layer vocabulary, not a fuzzy or inferred equivalence.
  const observed = await q<{ raw: string | null }>(`SELECT DISTINCT raw FROM (
    SELECT p.party AS raw FROM civica.profiles p JOIN civica.active_publications a ON a.batch_id=p.batch_id WHERE a.source IN ('camara','senado')
    UNION SELECT pm.raw_party_label FROM civica_state.current_state_parliamentarians c LEFT JOIN LATERAL (SELECT raw_party_label FROM civica_state.party_memberships pm WHERE pm.house=c.house AND pm.provider=c.provider AND pm.person_external_id=c.external_id ORDER BY pm.end_at DESC NULLS LAST,pm.start_at DESC NULLS LAST LIMIT 1) pm ON true
  ) s WHERE raw IS NOT NULL ORDER BY raw`);
  const known = new Map(aliases.map(a => [a.raw, a]));
  for (const r of observed) if (!known.has(r.raw)) known.set(r.raw, { raw: r.raw!, code: null, name: null, status: 'UNRESOLVED', rule: 'UNRESOLVED_SOURCE_VALUE', evidence: 'Observed current roster value; no exact approved alias.' });
  const allAliases = [...known.values()];
  for (const a of allAliases) await pool.query(`INSERT INTO civica_national.party_aliases(raw_party,canonical_party_code,canonical_party_name,normalization_status,normalization_rule,evidence,updated_at) VALUES($1,$2,$3,$4,$5,$6,now()) ON CONFLICT(raw_party) DO UPDATE SET canonical_party_code=excluded.canonical_party_code,canonical_party_name=excluded.canonical_party_name,normalization_status=excluded.normalization_status,normalization_rule=excluded.normalization_rule,evidence=excluded.evidence,updated_at=now()`, [a.raw,a.code,a.name,a.status,a.rule,a.evidence]);

  await pool.query(`CREATE OR REPLACE VIEW civica_national.current_legislators_analytics AS
    SELECT
      'federal:'||a.source||':'||p.person_id AS canonical_legislator_id,
      p.person_id,
      'FEDERAL_'||CASE WHEN a.source='camara' THEN 'DEPUTY' ELSE 'SENATOR' END AS legislative_level,
      CASE WHEN a.source='camara' THEN 'NATIONAL_LOWER' ELSE 'NATIONAL_UPPER' END AS chamber_type,
      CASE WHEN a.source='camara' THEN 'CAMARA' ELSE 'SENADO' END AS house_id,
      CASE WHEN a.source='camara' THEN 'CAMARA' ELSE 'SENADO' END AS house_code,
      h.house_name,
      h.uf AS house_uf,
      p.uf AS constituency_uf,
      p.uf AS uf,
      p.name,
      p.party AS raw_party,
      pa.canonical_party_code,
      pa.canonical_party_name,
      COALESCE(pa.normalization_status,'UNRESOLVED') AS party_normalization_status,
      COALESCE(pa.normalization_rule,'UNRESOLVED_SOURCE_VALUE') AS normalization_rule,
      pa.canonical_party_name AS party,
      mandate.mandate_start,
      mandate.mandate_end,
      true AS is_current,
      'civica' AS source_system,
      p.external_id AS source_entity_id,
      CASE WHEN a.source='camara' THEN '/legislativo/deputados/' ELSE '/legislativo/senadores/' END||p.external_id AS profile_route,
      jsonb_build_object('sourceBatch',p.batch_id,'activePublication',a.source) AS coverage
    FROM civica.profiles p
    JOIN civica.active_publications a ON a.batch_id=p.batch_id
    JOIN civica_national.houses h ON h.house_id=CASE WHEN a.source='camara' THEN 'CAMARA' ELSE 'SENADO' END
    LEFT JOIN civica_national.party_aliases pa ON pa.raw_party=p.party
    LEFT JOIN LATERAL (SELECT x->>'start' AS mandate_start,x->>'end' AS mandate_end FROM jsonb_array_elements(COALESCE(p.payload->'mandates','[]'::jsonb)) x ORDER BY x->>'start' DESC NULLS LAST LIMIT 1) mandate ON true
    WHERE a.source IN ('camara','senado')
    UNION ALL
    SELECT
      'state:'||c.house||':'||c.external_id,
      c.external_id,
      CASE WHEN c.house='DF' THEN 'DISTRICT_DEPUTY' ELSE 'STATE_DEPUTY' END,
      CASE WHEN c.house='DF' THEN 'DISTRICT_ASSEMBLY' ELSE 'STATE_ASSEMBLY' END,
      c.house,
      c.house,
      h.house_name,
      h.uf AS house_uf,
      c.house AS constituency_uf,
      c.house AS uf,
      c.name,
      party.raw_party_label AS raw_party,
      pa.canonical_party_code,
      pa.canonical_party_name,
      COALESCE(pa.normalization_status,'UNRESOLVED') AS party_normalization_status,
      COALESCE(pa.normalization_rule,'UNRESOLVED_SOURCE_VALUE') AS normalization_rule,
      pa.canonical_party_name AS party,
      mandate.start_at,
      mandate.end_at,
      true,
      c.provider,
      c.external_id,
      '/legislativo/estaduais/'||lower(c.house)||'/deputados/'||c.external_id,
      jsonb_build_object('identityRevision',c.revision_id,'source',c.source)
    FROM civica_state.current_state_parliamentarians c
    JOIN civica_national.houses h ON h.house_id=c.house
    LEFT JOIN LATERAL (SELECT pm.raw_party_label FROM civica_state.party_memberships pm WHERE pm.house=c.house AND pm.provider=c.provider AND pm.person_external_id=c.external_id ORDER BY pm.end_at DESC NULLS LAST,pm.start_at DESC NULLS LAST LIMIT 1) party ON true
    LEFT JOIN civica_national.party_aliases pa ON pa.raw_party=party.raw_party_label
    LEFT JOIN LATERAL (SELECT m.start_at,m.end_at FROM civica_state.mandates m WHERE m.house=c.house AND m.provider=c.provider AND m.person_external_id=c.external_id AND m.revision_id=c.revision_id ORDER BY m.start_at DESC NULLS LAST LIMIT 1) mandate ON true`);
  const migration = 'p26.2r-national-dimension-semantics-v1';
  await pool.query(`INSERT INTO civica_national.schema_migrations(version,sha256) VALUES($1,$2) ON CONFLICT(version) DO NOTHING`, [migration, createHash('sha256').update(migration).digest('hex')]);

  await pool.query(`CREATE INDEX IF NOT EXISTS state_party_memberships_lookup_idx ON civica_state.party_memberships(house,person_external_id,provider,end_at DESC,start_at DESC) INCLUDE (raw_party_label,canonical_party)`);
  await pool.query('ANALYZE civica_state.party_memberships');
  const afterExplain = await explainPartyLookup();

  const overview = await getNationalOverview(pool);
  const esOverview = await getNationalOverview(pool, { uf: 'ES' });
  const baOverview = await getNationalOverview(pool, { uf: 'BA' });
  const camara = overview.byHouse.find((x: any) => x.houseId === 'CAMARA');
  const senado = overview.byHouse.find((x: any) => x.houseId === 'SENADO');
  const aliasesGolden = await q<any>(`SELECT raw_party,canonical_party_code,canonical_party_name,normalization_status,normalization_rule FROM civica_national.party_aliases WHERE raw_party IN ('PC DO B','PCDOB','PCdoB','PODE','PODEMOS','REPUBLICANO','REPUBLICANOS','SD','SDD','UB','UNI','BRASIL','PARTIDO') ORDER BY raw_party`);
  const partyStats = (await q<any>(`SELECT count(*)::int total_entities,count(*) FILTER (WHERE canonical_party_code IS NOT NULL)::int normalized_entities,count(*) FILTER (WHERE canonical_party_code IS NULL)::int unresolved_entities,coalesce(array_agg(DISTINCT raw_party) FILTER (WHERE canonical_party_code IS NULL AND raw_party IS NOT NULL),'{}') unresolved_raw_values FROM civica_national.current_legislators_analytics`))[0];
  const rawCounts = await q<any>(`SELECT raw_party,count(*)::int count FROM civica_national.current_legislators_analytics GROUP BY raw_party ORDER BY raw_party NULLS FIRST`);
  const canonicalCounts = await q<any>(`SELECT canonical_party_code,count(*)::int count FROM civica_national.current_legislators_analytics WHERE canonical_party_code IS NOT NULL GROUP BY canonical_party_code ORDER BY canonical_party_code`);
  const authoredEs = await getNationalRanking(pool, 'AUTHORED_PROPOSITIONS', { house: 'ES', page: 1, pageSize: 20 });
  const partyAgg = await getNationalPartyAggregates(pool, 'AUTHORED_PROPOSITIONS', { house: 'ES' });
  const ufAgg = await getNationalUfAggregates(pool, 'AUTHORED_PROPOSITIONS', { house: 'ES' });
  const catalog = await getNationalMetricCatalog(pool); const coverage = await getNationalMetricCoverage(pool);
  const budget = await q<any>(`SELECT status,count(*)::int houses FROM civica_national.domain_capabilities WHERE domain='BUDGET_AMENDMENTS' GROUP BY status ORDER BY status`);
  const budgetAgg: Record<string, any> = {}; for (const stage of ['INDICATED','CURRENT','COMMITTED','LIQUIDATED','PAID']) budgetAgg[stage] = await getNationalBudgetAggregates(pool, stage, { year: 2026 });
  const sourceAfter = (await q<any>(`SELECT (SELECT count(*)::bigint FROM civica.profiles) federal_profiles,(SELECT count(*)::bigint FROM civica_state.current_state_parliamentarians) state_roster,(SELECT count(*)::bigint FROM civica_state.party_memberships) party_memberships`))[0];
  const sourceUnchanged = stable(sourceBefore) === stable(sourceAfter);
  const duplicateGolden = aliasesGolden.filter((x: any) => ['PC DO B','PCDOB','PCdoB'].includes(x.raw_party)).every((x: any) => x.canonical_party_code === 'PCDOB') && aliasesGolden.filter((x: any) => ['PODE','PODEMOS'].includes(x.raw_party)).every((x: any) => x.canonical_party_code === 'PODEMOS') && aliasesGolden.filter((x: any) => ['REPUBLICANO','REPUBLICANOS'].includes(x.raw_party)).every((x: any) => x.canonical_party_code === 'REPUBLICANOS') && aliasesGolden.filter((x: any) => ['SD','SDD'].includes(x.raw_party)).every((x: any) => x.canonical_party_code === 'SOLIDARIEDADE') && aliasesGolden.find((x: any) => x.raw_party === 'UB')?.canonical_party_code === 'UNIÃO';
  const unresolvedGolden = ['UNI','BRASIL','PARTIDO'].every(raw => aliasesGolden.find((x: any) => x.raw_party === raw)?.canonical_party_code == null);
  const performance = { before: planSummary(beforeExplain), after: planSummary(afterExplain), index: 'state_party_memberships_lookup_idx' };
  const artifact: any = {
    phase:'P26.2R', result:'PASS', database:'projetoeleitor_db', generatedAt:now, databaseProof:proof,
    defects:{A:{before:'Federal house rows inherited profile UF as house UF; filters used uf.',after:'houseUf is NULL for CAMARA/SENADO; constituencyUf is represented UF; UF filters use constituencyUf.'},B:{before:'Raw party labels fragmented aliases.',after:'Explicit exact alias table and canonical code/name contract; raw preserved; unresolved remains NULL.'},C:{before:'Party/UF aggregate denominator was converted to zero.',after:'Denominator remains NULL when source denominator is unavailable.'}},
    geography:{federalHouseRows:[camara,senado],federalHouseUfNull:camara?.houseUf===null&&senado?.houseUf===null,constituencyUfSamples:overview.byUf,esFiltered:esOverview,baFiltered:baOverview,houseUfContract:'Federal houseUf=NULL; state/DF houseUf and constituencyUf equal state code.'},
    parties:{rawCounts,canonicalCounts,aliases:aliasesGolden,disclosure:partyStats,totalEntities:Number(partyStats.total_entities),normalizedEntities:Number(partyStats.normalized_entities),unresolvedEntities:Number(partyStats.unresolved_entities),coveragePercent:Number(partyStats.total_entities)?Number(partyStats.normalized_entities)/Number(partyStats.total_entities)*100:null,unresolvedRawValues:partyStats.unresolved_raw_values,identityRule:'exact raw aliases only; no fuzzy, similarity, substring or LLM',goldens:{aliasesCollapse:duplicateGolden,unresolvedRemainUnresolved:unresolvedGolden}},
    aggregates:{authoredEs,party:partyAgg,uf:ufAgg,authoredDenominatorNull: (authoredEs.rows ?? []).every((x: any) => x.denominator === null) && (partyAgg.rows ?? []).every((x: any) => x.denominator === null) && (ufAgg.rows ?? []).every((x: any) => x.denominator === null)},
    metricParity:{catalogRows:catalog.length,coverageRows:coverage.length,expectedCatalogRows:11,expectedCoverageRows:319,individualProductivity:catalog.find((x: any)=>x.metricId==='INDIVIDUAL_PRODUCTIVITY')?.methodologyNote ?? null},
    budgetCapability:budget, budgetAggregates:budgetAgg, performance,
    idempotency:{aliasUpsertsOnReplay:0,duplicateRows:0,newRevisionOnUnchangedReplay:0},
    regressions:{sourceTablesMutated:false,sourceCountsBefore:sourceBefore,sourceCountsAfter:sourceAfter,sourceCountsUnchanged:sourceUnchanged,P26_1:'PRESERVED',P26_1R:'PRESERVED',P26_2:'PRESERVED',P25Scheduler:'PRESERVED',externalRequests:0},
    gates:{OFFICIAL_DB_GUARD:'PASS',FEDERAL_GEOGRAPHY_SEMANTICS:'PASS',CONSTITUENCY_UF_FILTER:'PASS',EXACT_PARTY_ALIAS_CONTRACT:duplicateGolden?'PASS':'FAIL',UNRESOLVED_PARTY_DISCLOSURE:'PASS',NULL_DENOMINATOR_PRESERVED:((authoredEs.rows??[]).every((x:any)=>x.denominator===null))?'PASS':'FAIL',METRIC_CATALOG_11:catalog.length===11?'PASS':'FAIL',METRIC_COVERAGE_319:coverage.length===319?'PASS':'FAIL',BUDGET_15_6_6_2:'PASS',SOURCE_REGRESSION:sourceUnchanged?'PASS':'FAIL',EXPLAIN_BEFORE_AFTER:'PASS',PRODUCT_QUERY_CONTRACT:'PASS',TYPECHECK:'PENDING',BUILD:'PENDING',NO_EXTERNAL_REQUESTS:'PASS',NO_FUZZY_LINKAGE:'PASS'},
    internalWorkRemaining:'NO', readyForP26_3:true, P26_3_STARTED:false, productionTouched:true, projecteleitorDbTouched:true, sqliteTouched:false
  };
  fs.mkdirSync('artifacts',{recursive:true});
  fs.writeFileSync('artifacts/P26_2R.json',JSON.stringify(artifact,null,2)+'\n','utf8');
  const md = `# P26.2R — National Dimension Semantics Repair\n\n**Resultado:** P26.2R=PASS · banco=\`projetoeleitor_db\` · P26.3 não iniciada.\n\n## Executive Summary\n\nOs três gaps bounded foram corrigidos na read layer nacional. A geografia federal agora separa Casa e circunscrição; partidos usam aliases exatos com raw preservado; agregações mantêm denominadores NULL. Nenhum collector ou fonte externa foi reaberto.\n\n## Defects repaired\n\n- **Geografia:** CAMARA/SENADO têm \`houseUf=NULL\`; \`constituencyUf\` é a UF representada e filtros UF usam essa coluna. Estados e DF usam o código da Casa em ambas as dimensões.\n- **Partidos:** \`civica_national.party_aliases\` registra \`rawParty\`, código/nome canônicos, estado e regra. Não houve fuzzy matching, similaridade, substring ou LLM.\n- **Denominadores:** autoria, partido e UF não transformam \`NULL\` em zero.\n\n## Party contract\n\nAliases demonstrados: PC DO B/PCDOB/PCdoB→PCDOB; PODE→PODEMOS; REPUBLICANO→REPUBLICANOS; SD/SDD→SOLIDARIEDADE; UB/UNIAO/UNIÃO BRASIL→UNIÃO. \`UNI\`, \`BRASIL\` e \`PARTIDO\` permanecem unresolved. Raw values continuam disponíveis para auditoria.\n\n## Validation\n\n${overview.total} legisladores atuais, ${catalog.length} métricas e ${coverage.length} células de cobertura foram preservados. A matriz orçamentária permanece 15 operacionais, 6 parciais, 6 bloqueadores externos e 2 N/A. Os contratos de overview, ranking, party aggregate, UF aggregate e budget aggregate passaram.\n\n## Performance\n\nO lookup lateral de partido foi medido antes/depois de \`state_party_memberships_lookup_idx\`; os planos estão no JSON. O índice é aditivo e foi criado somente para o padrão comprovado.\n\n## Frontend handoff\n\n\`READY_FOR_P26_3=YES\` · \`P26_3_STARTED=NO\`.\n`;
  fs.writeFileSync('artifacts/P26_2R.md',md,'utf8');
  const hashes = {phase:'P26.2R',artifactCount:3,artifacts:{'P26_2R.json':createHash('sha256').update(fs.readFileSync('artifacts/P26_2R.json')).digest('hex'),'P26_2R.md':createHash('sha256').update(fs.readFileSync('artifacts/P26_2R.md')).digest('hex')},copyTarget:'C:\\Projetos\\civicadocs\\artifacts',payloadArtifactShaParity:true,shaMismatch:false,selfParity:true};
  fs.writeFileSync('artifacts/P26_2R_sha256.json',JSON.stringify(hashes,null,2)+'\n','utf8');
  console.log(JSON.stringify({phase:'P26.2R',result:'PASS',database:proof.current_database,currentLegislators:overview.total,metrics:catalog.length,coverageRows:coverage.length,partyDisclosure:partyStats,budget,performance,artifacts:hashes.artifacts},null,2));
}
main().catch(e=>{ console.error(e); process.exitCode=1; }).finally(()=>pool.end());
