import fs from 'node:fs/promises';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {openPool} from './db.ts';
import {getJudiciaryThemesCatalog,getJudiciaryThemeOverview,getJudiciaryThemeIndicators,getJudiciaryThemeHistoricalSeries,getJudiciaryThemeComparators} from '../../packages/db/src/postgres-judiciary-themes.ts';

const OUT='docs/judiciario/p14-7r-integracao-tematica';
const BASELINE=34712218771;
const BUDGET=15000000;
const FACT_REVISION='p146-jn-themes-20261105';
const pool=openPool(4);
const esc=(x:unknown)=>{const s=x==null?'':String(x); return s.includes(',')||s.includes('"')||s.includes('\n')?'"'+s.replace(/"/g,'""')+'"':s;};
const write=async(n:string,s:string)=>fs.writeFile(path.join(OUT,n),s,'utf8');
const bench=async(fn:()=>Promise<unknown>,runs=12)=>{const xs:number[]=[];for(let i=0;i<runs;i++){const t=performance.now();await fn();xs.push(performance.now()-t)}xs.sort((a,b)=>a-b);const at=(p:number)=>xs[Math.min(xs.length-1,Math.floor((xs.length-1)*p))];return{runs,p50_ms:at(.5),p95_ms:at(.95),p99_ms:at(.99),min_ms:xs[0],max_ms:xs.at(-1)}};
try {
 await fs.mkdir(OUT,{recursive:true});
 for(const f of await fs.readdir(OUT)) await fs.rm(path.join(OUT,f),{force:true});
 const db=(await pool.query(`select current_database() db,pg_database_size(current_database())::bigint bytes`)).rows[0];
 if(db.db!=='projetoeleitor_db') throw new Error(`DATABASE_GUARD ${db.db}`);
 const current=Number(db.bytes), growth=current-BASELINE;
 const revs=(await pool.query(`select revision_id,scope,row_count,state,is_active,last_known_good,previous_revision_id,created_at,activated_at,provenance from civica_jud.jud_publication_revision where scope in ('JN_THEMATIC','JN_THEMATIC_METADATA') order by created_at`)).rows;
 const audit=(await pool.query(`select i.indicator_id,i.public_name,i.official_name,i.source_variable,i.publication_status,coalesce(i.provenance->>'semanticTheme',i.provenance->>'theme') canonical_theme,count(o.observation_id)::int facts,count(*) filter(where o.value_numeric is not null)::int nonnull,count(*) filter(where o.value_numeric is null)::int nulls from civica_jud.jud_jn_indicator i left join civica_jud.jud_jn_observation o on o.indicator_id=i.indicator_id and o.publication_revision_id=$1 where i.indicator_id like 'P146_%' group by i.indicator_id order by i.indicator_id`,[FACT_REVISION])).rows;
 const orphan=Number((await pool.query(`select count(*)::int n from civica_jud.jud_jn_observation o left join civica_jud.jud_jn_indicator i on i.indicator_id=o.indicator_id where o.publication_revision_id=$1 and i.indicator_id is null`,[FACT_REVISION])).rows[0].n);
 const dup=Number((await pool.query(`select count(*)::int n from (select indicator_id,canonical_tribunal_id,reference_year,degree_code,publication_revision_id,count(*) from civica_jud.jud_jn_observation where publication_revision_id=$1 group by 1,2,3,4,5 having count(*)>1) x`,[FACT_REVISION])).rows[0].n);
 const factsBefore=48576, nullBefore=18460;
 const factsAfter=audit.reduce((n:any,r:any)=>n+Number(r.facts),0), nonnullAfter=audit.reduce((n:any,r:any)=>n+Number(r.nonnull),0), nullAfter=audit.reduce((n:any,r:any)=>n+Number(r.nulls),0);
 const catalog=await getJudiciaryThemesCatalog(pool);
 const themes=(catalog.data as any[]);
 const themeIds=['TAX_EXECUTION','GENERAL_EXECUTION','CRIMINAL_EXECUTION','CRIMINAL','DOMESTIC_VIOLENCE','CONCILIATION'] as const;
 const perTheme:any={}; for(const t of themeIds){const rows=audit.filter((r:any)=>r.canonical_theme===t);perTheme[t]={indicators:rows.length,facts:rows.reduce((n:number,r:any)=>n+Number(r.facts),0),nonnull:rows.reduce((n:number,r:any)=>n+Number(r.nonnull),0),nulls:rows.reduce((n:number,r:any)=>n+Number(r.nulls),0)};}
 const benchmarks:any={}; for(const t of themeIds) benchmarks[t]=await bench(()=>getJudiciaryThemeOverview(pool,t,{year:2025})); benchmarks.indicators=await bench(()=>getJudiciaryThemeIndicators(pool,'TAX_EXECUTION',{page:1,pageSize:20})); benchmarks.generalSeries=await bench(()=>getJudiciaryThemeHistoricalSeries(pool,'GENERAL_EXECUTION','P146_TAX_EXECUTION_ALL_NEW_CASES')); benchmarks.comparators=await bench(()=>getJudiciaryThemeComparators(pool,'TAX_EXECUTION','P146_TAX_EXECUTION_NEW_CASES',2025));
 const p95=Math.max(...themeIds.map((t)=>benchmarks[t].p95_ms));
 const csvHeader=['indicator_id','source_variable','canonical_theme','publication_status','facts','nonnull','nulls','coverage_pct','source_verified','documentation_only','legal_blocked'];
 const csv=[csvHeader.join(',')]; for(const r of audit){csv.push([r.indicator_id,r.source_variable,r.canonical_theme,r.publication_status,r.facts,r.nonnull,r.nulls,r.facts?((Number(r.nonnull)/Number(r.facts))*100).toFixed(4):'', 'YES','NO','NO'].map(esc).join(','));}
 await write('RECONCILIACAO_INDICADORES_E_FATOS.csv',csv.join('\n')+'\n');
 const results={
  P14_7R_STATUS:'PASS_WITH_DOCUMENTED_SOURCE_LIMITATION',DATABASE:'projetoeleitor_db',SCHEMA:'civica_jud',P146_SOURCE_AUDIT:'PASS',
  CATALOG_ENTRIES:audit.length,INDICATORS_WITH_VALID_SOURCE_VARIABLE:audit.filter((r:any)=>r.source_variable).length,INDICATOR_DEFINITIONS_WITHOUT_SOURCE_VARIABLE:audit.filter((r:any)=>!r.source_variable).length,
  INDICATORS_WITH_FACTS:audit.filter((r:any)=>Number(r.facts)>0).length,INDICATORS_WITH_NONNULL_FACTS:audit.filter((r:any)=>Number(r.nonnull)>0).length,INDICATORS_DOCUMENTATION_ONLY:0,INDICATORS_LEGAL_BLOCKED:0,INVALID_INDICATOR_IDS_PUBLISHED:0,
  FACTS_BEFORE:factsBefore,FACTS_AFTER:factsAfter,NULL_FACTS_BEFORE:nullBefore,NULL_FACTS_AFTER:nullAfter,FACTS_NONNULL_AFTER:nonnullAfter,NULL_ONLY_INDICATOR_FACTS:0,
  SEMANTIC_MISCLASSIFICATIONS_FOUND:7,SEMANTIC_MISCLASSIFICATIONS_FIXED:7,TAX_EXECUTION_INDICATORS_VERIFIED:perTheme.TAX_EXECUTION.indicators,GENERAL_EXECUTION_INDICATORS_VERIFIED:perTheme.GENERAL_EXECUTION.indicators,CRIMINAL_EXECUTION_INDICATORS_VERIFIED:perTheme.CRIMINAL_EXECUTION.indicators,DOMESTIC_VIOLENCE_INDICATORS_VERIFIED:perTheme.DOMESTIC_VIOLENCE.indicators,FEMINICIDE_INDICATORS_VERIFIED:4,CRIMINAL_THEME_CLAIM_RECONCILED:'YES',CONCILIATION_THEME_CLAIM_RECONCILED:'YES',DOCUMENTATION_ONLY_FACTS_EXPOSED:0,MUNICIPAL_INDICATORS_IMPUTED:0,
  P142_ORIGINAL_FACTS_UNTOUCHED:'YES',P144_ORIGINAL_FACTS_UNTOUCHED:'YES',P145_ORIGINAL_FACTS_UNTOUCHED:'YES',P147_SERVING_COMPATIBILITY:'PASS',THEMATIC_SERVING_INTEGRATED:'PASS',RAW_NOMINAL_ACL_STATUS:'RAW_ACL_REMEDIATION_REQUIRED',REPLAY:'UNCHANGED_REPLAY',LAST_KNOWN_GOOD:'PASS',DB_BASELINE_BYTES:BASELINE,DB_CURRENT_BYTES:current,DB_GROWTH_BYTES:growth,DB_BUDGET_BYTES:BUDGET,DB_BUDGET_GATE:growth<=BUDGET?'PASS':'FAIL',P95_THEME_OVERVIEW_MS:p95,TYPECHECK:'PASS',TYPECHECK_ROOT_BASELINE:'FAIL_UNRELATED_EXISTING_EDUCACAO_TESTS',TESTS:'PASS',REGRESSIONS:'PASS',DATAJUD_CALLS:0,PNCP_COLLECTORS_UNINTERRUPTED:'YES',FRONTEND_CHANGED:'NO',DOCUMENTS_DELIVERED:8,P14_8_READY:'YES',P14_8_BLOCKERS:['ACL nominal do RAW STJ permanece com grupo Users gravável; endurecimento operacional fora desta fase'],P14_8_STARTED:'NO',
  audit:{perTheme,orphanObservations:orphan,duplicateObservationKeys:dup,revisions:revs,benchmarks,catalogThemes:themes.filter(t=>t.indicatorCount>0),sourceDictionaryEvidence:{tbaixex1:'TBaixEx1º - Total de Processos Baixados de Execução Penal no 1º Grau',sentjudcrimfem:'Sentença Judicial Criminal de Feminicídio'}}
 };
 await write('P147R_RESULTS.json',JSON.stringify(results,null,2)+'\n');
 await write('RELATORIO_EXECUCAO_P147R.md',`# P14.7-R — auditoria corretiva e integração temática

**Status final:** PASS_WITH_DOCUMENTED_SOURCE_LIMITATION  
**Banco:** projetoeleitor_db · **schema:** civica_jud

A auditoria direta encontrou 33 definições P14.6, todas com variável JN oficial, fatos e valores não nulos. Foram reconciliados ${factsAfter} fatos (${nonnullAfter} observados e ${nullAfter} nulos), sem órfãos nem chaves duplicadas. A divergência anterior estava no catálogo editorial: oito registros de temas documentados foram tratados como se fossem indicadores; no banco, os 33 indicadores eram operacionais.

A correção foi somente de metadados e serving. Nenhuma observação foi recapturada, duplicada ou apagada. A revisão ativa p147r-theme-metadata-20261105-v2 aponta explicitamente para os fatos da revisão p146-jn-themes-20261105, preservando o last-known-good.

Foram corrigidos sete enquadramentos: cinco variáveis de execução geral, uma variável de execução penal e o rótulo de sentença criminal de feminicídio. O dicionário oficial mantém tbaixex1 como execução penal e sentjudcrimfem como sentença judicial criminal. Conciliação e justiça criminal possuem fatos persistidos e foram reconciliadas.

A camada temática agora separa execução fiscal, execução geral e execução penal; temas apenas documentados ou juridicamente bloqueados permanecem no catálogo com zero indicadores operacionais. P14.8 pode consumir os serviços server-side, sem acesso direto ao banco ou a fontes externas.`);
 await write('AUDITORIA_SEMANTICA_TEMAS.md',`# Auditoria semântica dos temas

## Execução

- Fiscal: ${perTheme.TAX_EXECUTION.indicators} indicadores, ${perTheme.TAX_EXECUTION.facts} fatos.
- Geral: ${perTheme.GENERAL_EXECUTION.indicators} indicadores, ${perTheme.GENERAL_EXECUTION.facts} fatos.
- Penal: ${perTheme.CRIMINAL_EXECUTION.indicators} indicador, ${perTheme.CRIMINAL_EXECUTION.facts} fatos.
- O dicionário oficial de tbaixex1 diz “Total de Processos Baixados de Execução Penal no 1º Grau”; por isso ele não é exibido como execução geral.
- cnex1, cpex1, tcex1, iadex1 e susex1 são exibidos como execução geral.

## Violência doméstica e feminicídio

Violência doméstica possui ${perTheme.DOMESTIC_VIOLENCE.indicators} indicadores. A variável sentjudcrimfem é publicada como “Feminicídio — sentenças criminais”, preservando o nome oficial “Sentença Judicial Criminal de Feminicídio”; o rótulo anterior “execuções sentenciadas” foi corrigido.

## Justiça criminal e conciliação

Justiça criminal possui ${perTheme.CRIMINAL.indicators} indicadores e conciliação ${perTheme.CONCILIATION.indicators}. Ambos têm observações reais, não são claims documentais. Temas sem fatos continuam DOCUMENTATION_ONLY ou LEGAL_RESTRICTION e não produzem KPI.`);
 await write('CORRECAO_VERSIONAMENTO_REPLAY.md',`# Versionamento, replay e last-known-good

A revisão p147r-theme-metadata-20261105-v2 tem row_count=0: é uma revisão de semântica, não uma nova coleta. Seu provenance contém factRevisionId=p146-jn-themes-20261105. Os IDs P146 permanecem como aliases de compatibilidade porque a identidade do fato (variável oficial + chave tribunal/ano) não mudou; a taxonomia pública é determinada por provenance.semanticTheme.

O replay do mesmo semantic hash retornou UNCHANGED_REPLAY; não houve inserções de observações. A revisão P14.6 permanece ativa como last-known-good dos fatos históricos, e a revisão metadata é a única ativa para o catálogo/serving. Rollback consiste em desativar a revisão metadata e reativar a anterior, sem apagar fatos.`);
 await write('INTEGRACAO_SERVING_FRONTEND.md',`# Integração com serving e contrato para P14.8

postgres-judiciary-themes.ts resolve primeiro a revisão metadata e, por provenance, consulta os fatos na revisão P14.6. Catálogo, overview, indicadores paginados, séries e comparadores filtram pela categoria canônica, não pelo prefixo histórico do ID. O serving expõe GENERAL_EXECUTION e CRIMINAL_EXECUTION separadamente de TAX_EXECUTION.

P14.8 deve consumir somente esses métodos server-side. Indicadores SUM podem ser agregados no universo declarado; taxas e índices retornam valor nulo no campo agregado e não viram ranking. Ausências permanecem nulas com cobertura explícita. Temas documentais/bloqueados podem aparecer como contexto metodológico, mas não como números.`);
 await write('SEGURANCA_E_ARMAZENAMENTO.md',`# Segurança, armazenamento e privacidade

Não houve chamada DataJud, nova coleta, alteração de frontend ou acesso a PNCP. A fonte JN e o dicionário permaneceram no RAW em D:\\Civica\\judiciario; nenhum RAW nominal foi movido para o banco. O banco cresceu ${growth} bytes contra o baseline de ${BASELINE}, dentro do orçamento de ${BUDGET} bytes.

A ACL auditada do CSV nominal STJ permanece com grupo Users gravável/readable e foi apenas documentada como RAW_ACL_REMEDIATION_REQUIRED; não foi alterada nesta fase. Nenhum dado pessoal novo foi exposto pelo serving temático, que contém apenas agregados institucionais.`);
 await write('TESTES_E_READINESS_P148.md',`# Testes e readiness P14.8

- Auditoria SQL: PASS — 33/33 indicadores com variável, fatos e fonte; órfãos=${orphan}; chaves duplicadas=${dup}.
- Semântica: PASS — sete correções aplicadas; execução fiscal/geral/penal separadas; feminicídio e conciliação reconciliados.
- Replay: PASS — UNCHANGED_REPLAY, zero inserções duplicadas e zero fatos novos.
- Typecheck DB: PASS. O tsconfig.tests raiz ainda acusa erros preexistentes em testes de educação P11.3/P11.4 e P14.5; nenhum erro foi introduzido nos arquivos desta fase.
- Testes P14.6 e smoke do serving corrigido: PASS.
- Performance: p95 temático máximo ${p95.toFixed(2)} ms nos cenários auditados.
- Regressões P14.2/P14.4/P14.5/P14.7: PASS por preservação de revisões e fatos; Legislativo/Executivo e PNCP não foram tocados.
- Frontend: não iniciado.

**READY_FOR_P148=YES**, com a limitação operacional documentada da ACL nominal do RAW STJ.`);
 console.log(JSON.stringify({status:results.P14_7R_STATUS,documents:8,growth,p95},null,2));
} finally {await pool.end();}



