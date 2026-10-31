import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { openPool } from './db.ts';

const DIR = process.argv[2] ?? 'D:/Civica/staging/infraestrutura/obras/obrasgov/pilot-2026-10-30';
const DATASET = 143;
const UF_NATIONAL = 0;
const COMPETENCE = 202610;
const SOURCE_UPDATED = '2026-10-30T00:00:00Z';
const UF: Record<string, number> = { AC:12, AL:27, AP:16, AM:13, BA:29, CE:23, DF:53, ES:32, GO:52, MA:21, MT:51, MS:50, MG:31, PA:15, PB:25, PR:41, PE:26, PI:22, RJ:33, RN:24, RS:43, RO:11, RR:14, SC:42, SP:35, SE:28, TO:17 };
const load = (f: string) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) as { data: any[], total_items: number, total_pages: number, page_size: number };
const files: Record<string, string> = { projects:'projetos.json', physical:'execucao_fisica.json', contracts:'contratos.json', locations:'geometrias.json', history:'historico_situacao.json', commitments:'empenhos.json' };
const sha = (p: string) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const asDate = (x: any) => x == null || x === '' ? null : String(x).slice(0, 10);
const cnpj = (x: any) => { const s = String(x ?? '').replace(/\D/g, ''); return s && s.length <= 18 ? s : null; };
const cents = (x: any) => { const n = Number(x); return Number.isFinite(n) ? Math.round(n * 100) : null; };
const jsonb = (x: unknown) => JSON.stringify(x);

const pool = openPool(2);
const client = await pool.connect();
try {
  const hashes = Object.values(files).map(f => sha(path.join(DIR, f)));
  const sourceHash = crypto.createHash('sha256').update(hashes.join('|')).digest('hex');
  const projects = load(files.projects).data;
  const physical = load(files.physical).data;
  const contracts = load(files.contracts).data;
  const locations = load(files.locations).data;
  const history = load(files.history).data;
  const commitments = load(files.commitments).data;
  const result: any = { database: null, sourceHash, dataset: DATASET, competence: COMPETENCE, sourceUpdatedAt: SOURCE_UPDATED, inputRows: {}, inserted: {}, rejected: {}, replay: false };
  result.inputRows = { projects: projects.length, physical: physical.length, contracts: contracts.length, locations: locations.length, history: history.length, commitments: commitments.length };
  result.sourceTotals = { projects: load(files.projects).total_items, physical: load(files.physical).total_items, contracts: load(files.contracts).total_items, locations: load(files.locations).total_items, history: load(files.history).total_items, commitments: load(files.commitments).total_items };
  result.database = (await client.query('select current_database() as db, pg_database_size(current_database())::bigint as bytes')).rows[0];
  if (result.database.db !== 'projetoeleitor_db') throw new Error(`DATABASE_GUARD:${result.database.db}`);
  await client.query('BEGIN');
  let run = (await client.query('select run_id from civica_exec.exec_ingestion_run where dataset_id=$1 and uf=$2 and competence=$3 and source_hash=decode($4,\'hex\')', [DATASET, UF_NATIONAL, COMPETENCE, sourceHash])).rows[0];
  if (run) { result.replay = true; result.existingRunId = Number(run.run_id); }
  else {
    run = (await client.query(`insert into civica_exec.exec_ingestion_run(dataset_id,uf,competence,stage,status,bootstrap,started_at,parser_version,rows_in,source_hash,inputs,quality)
      values($1,$2,$3,2,9,true,now(),'p13.5-obrasgov-pilot-v1',$4,decode($5,'hex'),$6::jsonb,$7::jsonb) returning run_id`, [DATASET, UF_NATIONAL, COMPETENCE, projects.length, sourceHash, jsonb({ provider:'obrasgov', directory:DIR, files }), jsonb({ sourceTotals:result.sourceTotals, sampleRows:result.inputRows })])).rows[0];
  }
  const runId = Number(run.run_id);
  const q = async (sql: string, params: any[]) => (await client.query(sql, params)).rowCount ?? 0;
  result.inserted.projects = 0; result.rejected.projects = 0;
  for (const p of projects) {
    const id = String(p.id_projeto_investimento ?? ''); if (!id) { result.rejected.projects++; continue; }
    const vals = [id, p.desc_nome ?? p.desc_projeto ?? id, p.desc_projeto ?? '', p.desc_funcao_social, p.desc_meta_global, p.id_natureza_intervencao, p.natureza_intervencao, p.id_especie_intervencao, p.especie_intervencao, p.situacao, UF[String(p.uf_principal ?? '').toUpperCase()] ?? 0, p.organizacao_resp, cnpj(p.cnpj_organizacao_resp), asDate(p.dt_inicial_prevista), asDate(p.dt_final_prevista), asDate(p.dt_inicial_efetiva), asDate(p.dt_final_efetiva), asDate(p.dt_cadastro), p.ano_cadastro, p.populacao_beneficiada, p.qtd_empregos_gerados, cents((p.investimentos_previstos ?? []).reduce((s: number, x: any) => s + (Number(x.vl_investimento_previsto) || 0), 0)), p.sistema_resp, SOURCE_UPDATED, runId];
    result.inserted.projects += await q(`insert into civica_exec.exec_work_project(source_project_id,name,description,function_social,meta_global,nature_id,nature,species_id,species,situation,uf,org_resp,org_resp_cnpj,d_start_prev,d_end_prev,d_start_eff,d_end_eff,d_cadastro,cadastro_year,population_benefited,jobs_generated,planned_amount,system_resp,last_source_update,run_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25) on conflict(source_project_id) do nothing`, vals);
  }
  const exists = async (id: string) => (await client.query('select 1 from civica_exec.exec_work_project where source_project_id=$1',[id])).rowCount! > 0;
  const ins = async (table: string, cols: string, vals: any[], conflict: string) => q(`insert into civica_exec.${table}(${cols}) values(${vals.map((_,i)=>'$'+(i+1)).join(',')}) on conflict ${conflict} do nothing`, vals);
  result.inserted.locations = 0; result.rejected.locations = 0;
  const locSeq = new Map<string, number>();
  for (const l of locations) { const id=String(l.id_projeto_investimento??''); if (!(await exists(id))) { result.rejected.locations++; continue; } const seq=(locSeq.get(id)??0)+1; locSeq.set(id,seq); result.inserted.locations += await ins('exec_work_location','source_project_id,location_seq,location_kind,geometry_id,ibge7,uf,municipality,source_precision',[id,seq,'GEOMETRY',l.id_geometria,l.cod_ibge,UF[String(l.sg_uf??'').toUpperCase()]??null,l.no_municipio,l.origem_geometria],'(source_project_id,location_seq)'); }
  result.inserted.physical = 0; result.rejected.physical = 0;
  for (const x of physical) { const id=String(x.id_projeto_investimento??''); if (!(await exists(id)) || x.id_execucao_fisica==null) { result.rejected.physical++; continue; } result.inserted.physical += await ins('exec_work_physical','source_project_id,execution_id,percent,start_date,end_date,instrument,execution_form,created_at,updated_at,run_id',[id,x.id_execucao_fisica,x.percentual_execucao_fisica,asDate(x.dt_inicial_execucao),asDate(x.dt_final_execucao),x.tipo_instrumento,x.tipo_forma_execucao,x.dt_criacao_instrumento,asDate(x.dt_atualizacao_execucao),runId],'(source_project_id,execution_id)'); }
  result.inserted.contracts = 0; result.rejected.contracts = 0;
  for (const x of contracts) { const id=String(x.id_projeto_investimento??''); if (!(await exists(id)) || x.id_contrato==null) { result.rejected.contracts++; continue; } result.inserted.contracts += await ins('exec_work_contract','contract_id,source_project_id,contract_number,signed,vig_start,vig_end,supplier_cnpj,supplier_name,amount_global,amount_accumulated,object,status,transparency_url,run_id',[x.id_contrato,id,x.numero_contrato,asDate(x.data_assinatura_contrato),asDate(x.vigencia_inicio_contrato),asDate(x.vigencia_fim_contrato),cnpj(x.cnpj_fornecedor_contrato),x.fornecedor_contrato,cents(x.valor_global_contrato),cents(x.valor_acumulado_contrato),x.objeto_contrato,x.situacao_contrato,x.link_transparencia,runId],'(contract_id)'); }
  result.inserted.history = 0; result.rejected.history = 0;
  for (const x of history) { const id=String(x.id_projeto_investimento??''); if (!(await exists(id)) || x.id_historico_situacao_investimento==null) { result.rejected.history++; continue; } result.inserted.history += await ins('exec_work_status_event','source_project_id,history_id,status,status_date,justification,treatments,run_id',[id,x.id_historico_situacao_investimento,x.descricao_historico_situacao_investimento,asDate(x.data_historico_situacao_investimento),x.justificativa_cancelada_paralisada,[x.possui_tratativas_situacao_investimento,x.fase_tratativas_situacao_investimento].filter(Boolean).join(' | ')||null,runId],'(source_project_id,history_id)'); }
  result.inserted.commitments = 0; result.rejected.commitments = 0;
  for (const x of commitments) { const id=String(x.id_projeto_investimento??''); const key=`${id}|${x.nr_empenho??''}|${x.ug_emitente??''}`; if (!(await exists(id)) || !key) { result.rejected.commitments++; continue; } result.inserted.commitments += await ins('exec_work_commitment','commitment_key,source_project_id,ug_emitente,nr_empenho,emission_date,value_cents,source_system,source_database,nature,source,liquidation,paid,run_id',[key,id,String(x.ug_emitente??''),x.nr_empenho,asDate(x.data_emissao),cents(x.valor_empenho),x.sistema_origem_empenho,x.bd_origem_empenho,x.natureza_despesa,x.fonte,x.liquidado,x.pago,runId],'(commitment_key)'); }
  result.coverage = [];
  for (const [name,file] of Object.entries(files)) { const m=load(file); const meta=JSON.parse(fs.readFileSync(path.join(DIR,file.replace('.json','.meta.json')),'utf8')); const table = name==='projects'?'exec_work_project': name==='physical'?'exec_work_physical': name==='contracts'?'exec_work_contract': name==='locations'?'exec_work_location': name==='history'?'exec_work_status_event':'exec_work_commitment'; const keyCount = Number((await client.query(`select count(*)::int n from civica_exec.${table}${table==='exec_work_location'?'':' where run_id=$1'}`,table==='exec_work_location'?[]:[runId])).rows[0]?.n ?? 0); const pub = result.replay ? keyCount : (name==='projects'?result.inserted.projects: name==='physical'?result.inserted.physical: name==='contracts'?result.inserted.contracts: name==='locations'?result.inserted.locations: name==='history'?result.inserted.history: result.inserted.commitments); await client.query(`insert into civica_exec.exec_work_cov(dataset,source_updated_at,pages,source_rows,published_rows,rejected,status,run_id) values($1,$2,$3,$4,$5,$6,'PILOT_PUBLISHED',$7) on conflict(dataset,source_updated_at) do update set published_rows=excluded.published_rows,rejected=excluded.rejected,status=excluded.status,run_id=excluded.run_id`,[name,SOURCE_UPDATED,Number(meta.totalPages),Number(m.total_items),pub,(m.data?.length??0)-pub,runId]); result.coverage.push({dataset:name,pages:meta.totalPages,sourceRows:m.total_items,publishedRows:pub}); }
  const manifestValues: any[] = [runId];
  const manifestSql = Object.values(files).map((f, i) => { const b = 2 + i * 7; manifestValues.push(...(() => { const m=JSON.parse(fs.readFileSync(path.join(DIR,f.replace('.json','.meta.json')),'utf8')); return [m.url, path.join(DIR,f), sha(path.join(DIR,f)), fs.statSync(path.join(DIR,f)).size, SOURCE_UPDATED, COMPETENCE, UF_NATIONAL]; })()); return `($1,$${b},$${b+1},decode($${b+2},'hex'),$${b+3},$${b+4},$${b+5},$${b+6},now(),1,2)`; }).join(',');
  await client.query(`insert into civica_exec.exec_raw_manifest(run_id,source_url,rel_path,sha256,bytes,source_modified_at,competence,uf,fetched_at,state,retention_class) values ${manifestSql} on conflict(sha256) do nothing`, manifestValues);
  const rowCount = result.inserted.projects;
  await client.query(`insert into civica_exec.exec_publication(dataset_id,uf,competence,run_id,previous_run_id,state,stage,row_count,source_hash,activated_at) values($1,$2,$3,$4,null,1,2,$5,decode($6,'hex'),now()) on conflict(dataset_id,uf,competence) do update set run_id=excluded.run_id,state=1,stage=2,row_count=excluded.row_count,source_hash=excluded.source_hash,activated_at=now()`, [DATASET,UF_NATIONAL,COMPETENCE,runId,rowCount,sourceHash]);
  await client.query(`update civica_exec.exec_ingestion_run set status=9,finished_at=now(),rows_out=$2,slice_hash=decode($3,'hex'),quality=$4::jsonb where run_id=$1`,[runId,rowCount,sourceHash,jsonb(result)]);
  await client.query('COMMIT');
  result.runId=runId; result.databaseAfter=(await client.query('select pg_database_size(current_database())::bigint as bytes')).rows[0];
  console.log(JSON.stringify(result,null,2));
} catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); await pool.end(); }
