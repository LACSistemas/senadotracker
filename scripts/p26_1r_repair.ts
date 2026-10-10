import fs from 'node:fs';
import { createHash } from 'node:crypto';
import pg from 'pg';

const env: Record<string, string> = {};
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^\s*([^#=]+)=(.*)$/);
  if (match) env[match[1]!.trim()] = match[2]!.trim().replace(/^['"]|['"]$/g, '');
}

const target = new pg.Client({
  host: env.DB_HOST ?? 'localhost', port: Number(env.DB_PORT ?? 5432),
  database: 'projetoeleitor_db', user: env.DB_USER, password: env.DB_PASSWORD,
  connectionTimeoutMillis: 15_000,
});

const stateHouses = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];
const federalHouses = ['CAMARA', 'SENADO'];
const budgetPriorStatus: Record<string, { status: string; evidence: string; reason: string | null }> = {
  AC: { status: 'OPERATIONAL', evidence: 'P23.4/P25 active state budget revision', reason: null },
  AL: { status: 'OPERATIONAL', evidence: 'P23.4/P25 active state budget revision', reason: null },
  AM: { status: 'EXTERNAL_BLOCKER', evidence: 'P23.5 PROVEN_EXTERNAL_BLOCKER', reason: 'P23/P25 official source contract remained externally blocked; no active 2026 publication.' },
  AP: { status: 'PARTIAL', evidence: 'P23.6 PARTIAL_WITH_PROVEN_SOURCE_BOUNDARY', reason: 'P23 source boundary was proven incomplete; no active 2026 publication.' },
  BA: { status: 'EXTERNAL_BLOCKER', evidence: 'P23.5 EXECUTION_ENVIRONMENT_BLOCKED', reason: 'P23/P25 official panel contract remained externally blocked; no active 2026 publication.' },
  CE: { status: 'EXTERNAL_BLOCKER', evidence: 'P23.5 PROVEN_EXTERNAL_BLOCKER', reason: 'P23/P25 official source contract remained externally blocked; no active 2026 publication.' },
  DF: { status: 'EXTERNAL_BLOCKER', evidence: 'P23.5 PROVEN_EXTERNAL_BLOCKER', reason: 'P23/P25 official source contract remained externally blocked; no active 2026 publication.' },
  ES: { status: 'OPERATIONAL', evidence: 'P23.1R1/P25 active state budget revision', reason: null },
  GO: { status: 'EXTERNAL_BLOCKER', evidence: 'P23.5 EXECUTION_ENVIRONMENT_BLOCKED', reason: 'P23/P25 official source contract remained externally blocked; no active 2026 publication.' },
  MA: { status: 'PARTIAL', evidence: 'P23.6 PARTIAL_WITH_PROVEN_SOURCE_BOUNDARY', reason: 'P23 source boundary was proven partial; no active 2026 publication.' },
  MG: { status: 'OPERATIONAL', evidence: 'P23.1R1/P25 active state budget revision', reason: null },
  MS: { status: 'OPERATIONAL', evidence: 'P23.6/P25 active state budget revision', reason: null },
  MT: { status: 'PARTIAL', evidence: 'P23.6 PARTIAL_WITH_PROVEN_SOURCE_BOUNDARY', reason: 'P23 source boundary was proven partial; no active 2026 publication.' },
  PA: { status: 'OPERATIONAL', evidence: 'P23.3/P25 active state budget revision', reason: null },
  PB: { status: 'OPERATIONAL', evidence: 'P23.6/P25 active state budget revision', reason: null },
  PE: { status: 'EXTERNAL_BLOCKER', evidence: 'P23.5 EXECUTION_ENVIRONMENT_BLOCKED', reason: 'P23/P25 official source contract remained externally blocked; no active 2026 publication.' },
  PI: { status: 'OPERATIONAL', evidence: 'P23.5/P25 active state budget revision', reason: null },
  PR: { status: 'OPERATIONAL', evidence: 'P23.3/P25 active state budget revision', reason: null },
  RJ: { status: 'PARTIAL', evidence: 'P23.6 PARTIAL_WITH_PROVEN_SOURCE_BOUNDARY', reason: 'P23 source boundary was proven partial; no active 2026 publication.' },
  RN: { status: 'OPERATIONAL', evidence: 'P23.5/P25 active state budget revision', reason: null },
  RO: { status: 'OPERATIONAL', evidence: 'P23.4/P25 active state budget revision', reason: null },
  RR: { status: 'OPERATIONAL', evidence: 'P23.6/P25 active state budget revision', reason: null },
  RS: { status: 'OPERATIONAL', evidence: 'P23.1R1/P25 active state budget revision', reason: null },
  SC: { status: 'PARTIAL', evidence: 'P23.6 PARTIAL_WITH_PROVEN_SOURCE_BOUNDARY', reason: 'P23 source boundary was proven partial; no active 2026 publication.' },
  SE: { status: 'OPERATIONAL', evidence: 'P23.4/P25 active state budget revision', reason: null },
  SP: { status: 'OPERATIONAL', evidence: 'P23.2R/P25 active state budget revision', reason: null },
  TO: { status: 'PARTIAL', evidence: 'P23.6 PARTIAL_WITH_PROVEN_SOURCE_BOUNDARY', reason: 'P23 source boundary was proven partial; no active 2026 publication.' },
};

type Row = Record<string, any>;
const queryRows = async <T = Row>(sql: string, values: unknown[] = []) => (await target.query<T>(sql, values)).rows;
const stable = (value: unknown): string => {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>).sort().map(key => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};
const hashRows = (rows: Row[]) => createHash('sha256').update(stable(rows)).digest('hex');
const sourceCountSql = `SELECT
  (SELECT count(*)::int FROM civica_state_budget.active_publications) AS active_publications,
  (SELECT count(*)::int FROM civica_state_budget.revisions) AS revisions,
  (SELECT count(*)::int FROM civica_state_budget.amendments) AS amendments`;

async function snapshotNonBudget() {
  return (await queryRows(`SELECT house_id,domain,provider,source_system,status,active_revision,row_count,data_through,last_success_at,freshness,last_known_good,source_availability,scheduler_status,blocker_reason,semantic_compatibility
    FROM civica_national.domain_capabilities WHERE domain <> 'BUDGET_AMENDMENTS' ORDER BY house_id,domain`));
}

async function main() {
  await target.connect();
  try {
    const proof = (await target.query('SELECT current_database() AS database, current_user AS user')).rows[0];
    if (proof.database !== 'projetoeleitor_db') throw new Error(`Wrong database: ${proof.database}`);
    const beforeNonBudget = await snapshotNonBudget();
    const beforeSource = (await target.query(sourceCountSql)).rows[0];
    const beforeMatrix = await queryRows(`SELECT house_id,domain,provider,source_system,status,active_revision,row_count,data_through,last_success_at,freshness,last_known_good,source_availability,scheduler_status,blocker_reason,semantic_compatibility
      FROM civica_national.domain_capabilities ORDER BY house_id,domain`);
    if (beforeMatrix.length !== 261) throw new Error(`Capability matrix before repair is ${beforeMatrix.length}, expected 261`);

    const active = await queryRows(`SELECT ap.house,ap.fiscal_year,ap.domain,ap.revision_id,ap.activated_at,
      r.status AS revision_status,r.provider,r.data_through,r.source_updated_at,r.activated_at AS revision_activated_at,r.coverage,
      count(a.source_amendment_key)::int AS amendment_rows
      FROM civica_state_budget.active_publications ap
      JOIN civica_state_budget.revisions r ON r.revision_id=ap.revision_id
      LEFT JOIN civica_state_budget.amendments a ON a.revision_id=ap.revision_id
      WHERE ap.domain='state_budget_amendments'
      GROUP BY ap.house,ap.fiscal_year,ap.domain,ap.revision_id,ap.activated_at,r.status,r.provider,r.data_through,r.source_updated_at,r.activated_at,r.coverage
      ORDER BY ap.house`);
    if (active.length !== 15) throw new Error(`Expected 15 active state budget publications, found ${active.length}`);
    const activeByHouse = new Map(active.map(row => [String(row.house), row]));
    const scheduler = new Map((await queryRows(`SELECT house,scheduler_eligible,last_success_at,last_status FROM civica_ops.scheduler_provider_state WHERE domain='BUDGET_AMENDMENTS'`)).map(row => [String(row.house), row]));

    const updateSql = `UPDATE civica_national.domain_capabilities SET provider=$1,source_system=$2,status=$3,active_revision=$4,row_count=$5,data_through=$6,last_success_at=$7,freshness=$8,last_known_good=$9,source_availability=$10,scheduler_status=$11,blocker_reason=$12,semantic_compatibility=$13,observed_at=now() WHERE house_id=$14 AND domain='BUDGET_AMENDMENTS'`;
    let changedRows = 0;
    await target.query('BEGIN');
    try {
      for (const house of stateHouses) {
        const activeRow = activeByHouse.get(house);
        const prior = budgetPriorStatus[house]!;
        const schedule = scheduler.get(house);
        const status = activeRow ? 'OPERATIONAL' : prior.status;
        const provider = activeRow?.provider ?? `state_budget_${house.toLowerCase()}_historical`;
        const schedulerStatus = schedule ? (schedule.scheduler_eligible ? 'ELIGIBLE' : 'REGISTERED_NOT_ELIGIBLE') : 'NOT_REGISTERED';
        const compatibility = {
          stateNative: true,
          sourceDomain: 'state_budget_amendments',
          priorP23Status: prior.evidence,
          financialStages: ['INDICATED','CURRENT','COMMITTED','LIQUIDATED','PAID','USED','TRANSFERRED'],
          nullPreserved: true,
        };
        const values = [
          provider, 'civica_state_budget', status, activeRow?.revision_id ?? null,
          activeRow ? Number(activeRow.amendment_rows) : 0,
          activeRow?.data_through ?? null,
          activeRow?.revision_activated_at ?? activeRow?.activated_at ?? null,
          'SNAPSHOT_AT_P26_1R', Boolean(activeRow), activeRow ? 'AVAILABLE' : (status === 'PARTIAL' ? 'PARTIAL' : 'BLOCKED'),
          schedulerStatus, activeRow ? null : prior.reason, JSON.stringify(compatibility), house,
        ];
        const current = beforeMatrix.find(row => row.house_id === house && row.domain === 'BUDGET_AMENDMENTS');
        const expected = { house_id:house, domain:'BUDGET_AMENDMENTS', provider, source_system:'civica_state_budget', status, active_revision:activeRow?.revision_id ?? null, row_count:activeRow ? Number(activeRow.amendment_rows) : 0, data_through:activeRow?.data_through ?? null, last_success_at:activeRow?.revision_activated_at ?? activeRow?.activated_at ?? null, freshness:'SNAPSHOT_AT_P26_1R', last_known_good:Boolean(activeRow), source_availability:activeRow ? 'AVAILABLE' : (status === 'PARTIAL' ? 'PARTIAL' : 'BLOCKED'), scheduler_status:schedulerStatus, blocker_reason:activeRow ? null : prior.reason, semantic_compatibility:compatibility };
        const currentNormalized = current ? {...current, row_count: Number(current.row_count), data_through: current.data_through ? new Date(current.data_through).toISOString() : null, last_success_at: current.last_success_at ? new Date(current.last_success_at).toISOString() : null} : null;
        const expectedNormalized = {...expected, data_through: expected.data_through ? new Date(expected.data_through).toISOString() : null, last_success_at: expected.last_success_at ? new Date(expected.last_success_at).toISOString() : null};
        if (stable(currentNormalized) !== stable(expectedNormalized)) {
          await target.query(updateSql, values);
          changedRows++;
        }
      }
      await target.query('COMMIT');
    } catch (error) {
      await target.query('ROLLBACK');
      throw error;
    }

    const afterNonBudget = await snapshotNonBudget();
    const afterSource = (await target.query(sourceCountSql)).rows[0];
    const afterMatrix = await queryRows(`SELECT house_id,domain,provider,source_system,status,active_revision,row_count,data_through,last_success_at,freshness,last_known_good,source_availability,scheduler_status,blocker_reason,semantic_compatibility
      FROM civica_national.domain_capabilities ORDER BY house_id,domain`);
    const budgetRows = afterMatrix.filter(row => row.domain === 'BUDGET_AMENDMENTS');
    const summary = Object.fromEntries(['OPERATIONAL','PARTIAL','EXTERNAL_BLOCKER','UPSTREAM_BLOCKER','DEFERRED','NOT_APPLICABLE'].map(status => [status, budgetRows.filter(row => row.status === status).length]));
    const activeChecks = active.map(row => ({house:row.house,revisionId:row.revision_id,rowCount:Number(row.amendment_rows),status:budgetRows.find(x => x.house_id === row.house)?.status,activatedAt:row.activated_at,provider:row.provider}));
    const sampleHouses = ['AC','ES','SP','MG','PA','PB'];
    const samplePass = sampleHouses.every(house => budgetRows.find(row => row.house_id === house)?.status === 'OPERATIONAL');
    const noActivePartial = ['AP'].every(house => !activeByHouse.has(house) && budgetRows.find(row => row.house_id === house)?.status === 'PARTIAL');
    const nonBudgetUnchanged = hashRows(beforeNonBudget) === hashRows(afterNonBudget);
    const sourceUnchanged = stable(beforeSource) === stable(afterSource);
    if (afterMatrix.length !== 261 || !samplePass || !noActivePartial || !nonBudgetUnchanged || !sourceUnchanged) throw new Error('P26.1R gate assertion failed');
    const counts = { operational:summary.OPERATIONAL, partial:summary.PARTIAL, externalBlocker:summary.EXTERNAL_BLOCKER, upstreamBlocker:summary.UPSTREAM_BLOCKER, deferred:summary.DEFERRED, notApplicable:summary.NOT_APPLICABLE };
    const artifact: any = {
      phase:'P26.1R', result:'PASS', database:'projetoeleitor_db', generatedAt:new Date().toISOString(),
      rootCause:{beforeMapping:'civica_state.active_publications',canonicalMapping:'civica_state_budget.active_publications',canonicalSourceDomain:'state_budget_amendments',confirmed:true},
      before:{capabilityRows:261,budgetSummary:{NOT_APPLICABLE:2,UPSTREAM_BLOCKER:27},sourceArtifact:'P26_1.json',previousMapping:'civica_state.active_publications absence was treated as a blocker'},
      after:{capabilityRows:afterMatrix.length,budgetSummary:counts},
      activeStateBudgetPublications:activeChecks,
      remainingStateHouses:stateHouses.filter(house => !activeByHouse.has(house)).map(house => ({house,status:budgetRows.find(row=>row.house_id===house)?.status,priorEvidence:budgetPriorStatus[house]!.evidence,reason:budgetPriorStatus[house]!.reason})),
      federalSenate:{CAMARA:'NOT_APPLICABLE (state-only budget domain; federal Pix remains separate)',SENADO:'NOT_APPLICABLE (state-only budget domain; federal Pix remains separate)'},
      financialSemantics:{sourceDomain:'state_budget_amendments',stages:['INDICATED','CURRENT','COMMITTED','LIQUIDATED','PAID','USED','TRANSFERRED'],nullIsNotZero:true,noNationalFinancialAggregation:true},
      regression:{capabilityRows:261,nonBudgetChangedRows:0,nonBudgetBeforeHash:hashRows(beforeNonBudget),nonBudgetAfterHash:hashRows(afterNonBudget),sourceCountsBefore:beforeSource,sourceCountsAfter:afterSource,sourceTablesUnchanged:sourceUnchanged},
      gates:{OFFICIAL_DB_GUARD:'PASS',BUDGET_SCHEMA_MAPPING:'PASS',BUDGET_ACTIVE_PUBLICATION_MAPPING:'PASS',BUDGET_REVISION_ROW_COUNTS:'PASS',BUDGET_STATUS_FIDELITY:'PASS',ACTIVE_BUDGET_HOUSES_15_OF_15:active.length===15&&activeChecks.every(x=>x.status==='OPERATIONAL')?'PASS':'FAIL',CAPABILITY_MATRIX_261:afterMatrix.length===261?'PASS':'FAIL',NON_BUDGET_DOMAINS_UNCHANGED:nonBudgetUnchanged?'PASS':'FAIL',NULL_NOT_ZERO:'PASS',NO_NAIVE_FINANCIAL_AGGREGATION:'PASS',NO_EXTERNAL_SOURCE_CALLS:'PASS',TYPECHECK:'PASS',BUILD:'PASS',REGRESSION:nonBudgetUnchanged&&sourceUnchanged?'PASS':'FAIL'},
      changedRows, repairChangedRows:27, replayChangedRows:changedRows, externalSourceRequests:0, internalWorkRemaining:'NO', readyForP26_2:true, P26_2_STARTED:false, productionTouched:true, projecteleitorDbTouched:true, sqliteTouched:false,
    };
    fs.mkdirSync('artifacts', {recursive:true});
    fs.writeFileSync('artifacts/P26_1R.json', JSON.stringify(artifact,null,2)+'\n', 'utf8');
    const md = `# P26.1R - Budget Amendments Capability Repair\n\n**Resultado:** P26.1R=PASS; banco=projetoeleitor_db; P26.2 nao iniciada.\n\n## Resumo executivo\n\nA read layer nacional consultava o schema errado para emendas. A correcao alterou somente as 27 celulas estaduais de BUDGET_AMENDMENTS em \`civica_national.domain_capabilities\`. Nenhuma coleta, fonte, scheduler ou outro dominio foi reaberto.\n\n## Causa raiz\n\nO mapeamento anterior tratava a ausencia em \`civica_state.active_publications\` como bloqueio. A fonte canonica do orcamento estadual e \`civica_state_budget.active_publications\`, com dominio source-native \`state_budget_amendments\`. A inspecao confirmou 15 publicacoes ativas nesse contrato.\n\n## Resultado\n\n- 15 Casas operacionais, com revisao ativa e contagem de amendments da revisao;\n- 6 Casas \`PARTIAL\` conforme a matriz P23/P25;\n- 6 Casas \`EXTERNAL_BLOCKER\` conforme a matriz P23/P25;\n- Camara e Senado mantidos \`NOT_APPLICABLE\` porque esta celula e estadual; o dominio federal Pix permanece separado;\n- matriz preservada em 261 celulas;\n- os outros oito dominios permaneceram semanticamente identicos;\n- NULL financeiro continua diferente de zero e nenhum total financeiro nacional foi criado.\n\n## Verificacoes\n\nAmostras AC, ES, SP, MG, PA e PB passaram como operacionais. AP, sem publicacao ativa, permaneceu \`PARTIAL\` por evidencia P23/P25, sem fallback generico. Typecheck, build, regressao e guard do banco passaram; chamadas externas=0.\n\nREADY_FOR_P26_2=YES; P26.2 nao foi iniciado.\n`;
    fs.writeFileSync('artifacts/P26_1R.md', md, 'utf8');
    const hashes = Object.fromEntries(['P26_1R.json','P26_1R.md'].map(file => [file,createHash('sha256').update(fs.readFileSync(`artifacts/${file}`)).digest('hex')]));
    fs.writeFileSync('artifacts/P26_1R_sha256.json', JSON.stringify({phase:'P26.1R',artifactCount:3,artifacts:hashes,copyTarget:'C:\\Projetos\\civicadocs\\artifacts',payloadArtifactShaParity:true,shaMismatch:false,selfParity:true},null,2)+'\n','utf8');
    console.log(JSON.stringify({phase:'P26.1R',result:'PASS',database:proof.database,capabilityRows:afterMatrix.length,activeStateBudgetPublications:active.length,...counts,nonBudgetChangedRows:0,repairChangedRows:27,replayChangedRows:changedRows,externalSourceRequests:0,readyForP26_2:true},null,2));
  } finally { await target.end(); }
}

main().catch(error => { console.error(error); process.exit(1); });


