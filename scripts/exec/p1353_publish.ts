import fs from 'node:fs';
import crypto from 'node:crypto';
import { openPool } from './db.ts';
import { publishSlice, upsertIndicators, type IndicatorRow } from '../../packages/db/src/exec/publication.ts';

const STAGE = 'D:/Civica/staging/infraestrutura/energia_expandida';
const COMP = 202610; const PERIOD_START = '2026-10-01'; const PERIOD_END = '2026-11-01';
const read = (n:string) => JSON.parse(fs.readFileSync(`${STAGE}/${n}`,'utf8'));
const hash = (s:string) => crypto.createHash('sha256').update(s).digest('hex');
const norm = (s:string) => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
async function insertChunks(c:any, table:string, rows:any[], cols:string[], conflict:string, chunk=3000) {
  for(let i=0;i<rows.length;i+=chunk) {
    const part=rows.slice(i,i+chunk);
    await c.query(`INSERT INTO civica_exec.${table} (${cols.join(',')}) SELECT ${cols.join(',')} FROM jsonb_populate_recordset(NULL::civica_exec.${table},$1::jsonb) ON CONFLICT ${conflict} DO UPDATE SET ${cols.filter(x=>!['competence','ibge7','source_code','source_key','source_system'].includes(x)).map(x=>`${x}=EXCLUDED.${x}`).join(', ')}`,[JSON.stringify(part)]);
  }
}
async function ensureDefs(pool:any){
 const defs=[
  [14001,'ENERGY-MMGD-ENTERPRISES','Empreendimentos de geração distribuída','count','M'],[14002,'ENERGY-MMGD-INSTALLED-KW','Potência instalada de geração distribuída','kW','M'],[14003,'ENERGY-MMGD-SOLAR-ENTERPRISES','Empreendimentos solares de geração distribuída','count','M'],[14004,'ENERGY-MMGD-SOLAR-KW','Potência solar instalada de geração distribuída','kW','M'],
  [14011,'ANP-FUEL-STATIONS','Postos revendedores de combustíveis','count','M'],[14012,'ANP-GLP-RESELLERS','Revendedores de GLP','count','M']
 ];
 for(const d of defs) await pool.query(`INSERT INTO civica_exec.exec_ind_def (indicator_id,code,method_version,domain,sort_order,label,unit,grain,numerator_desc,denominator_desc,min_denominator,ranking_allowed,aggregation_allowed,null_semantics,methodology_note) VALUES ($1,$2,1,13,$1,$3,$4,$5,'contagem ou soma source-native',NULL,NULL,false,true,'NULL quando fonte não cobre o território','P13.5.3; snapshot 2026-10; sem imputação') ON CONFLICT (indicator_id) DO NOTHING`,d);
}
async function entityMaps(pool:any){
 const rs=await pool.query(`SELECT entity_id,kind,ibge7,uf,uf_code,name FROM civica_exec.exec_entity WHERE kind IN (1,3,4)`); const mun=new Map<string,any>(), uf=new Map<string,any>(); let br:any;
 for(const e of rs.rows){ if(e.kind===4) mun.set(`${e.uf}|${norm(e.name)}`,e); if(e.kind===3) uf.set(String(e.uf),e); if(e.kind===1) br=e; } return {mun,uf,br};
}
async function publish(pool:any, datasetId:number, sourceHash:string, derive:(c:any,runId:number)=>Promise<void>, quality:any){
 return publishSlice(pool,{datasetId,uf:0,competence:COMP,sourceHash,parserVersion:'p1353-v1',bootstrap:true,contiguity:false,tables:[],inputs:{stage:STAGE},quality,derive});
}
async function main(){
 const pool=openPool(2); const db=await pool.query('select current_database() database, pg_database_size(current_database())::bigint size'); if(db.rows[0].database!=='projetoeleitor_db') throw new Error('DATABASE_GUARD'); const before=Number(db.rows[0].size); console.log('DB_BEFORE',before); await ensureDefs(pool); const maps=await entityMaps(pool);
 const mm=read('mmgd.json');
 const mmHash=mm.source_sha256;
 const mmRes=await publish(pool,160,mmHash,async(c,runId)=>{
  const mh=`\\x${mmHash}`; const rows=mm.municipal_rows.map((r:any)=>({...r,source_hash:mh})); await insertChunks(c,'exec_energy_mmgd_municipality',rows,['competence','ibge7','uf','municipality','enterprise_count','total_installed_kw','solar_enterprise_count','solar_installed_kw','source_rows','source_hash'],'(competence,ibge7)');
  const src=mm.source_rows_by_distributor.map((r:any)=>({...r,source_hash:mh})); await insertChunks(c,'exec_energy_mmgd_source',src,['competence','source_code','source_name','enterprise_count','installed_kw','source_rows','source_hash'],'(competence,source_code)');
  const ind:IndicatorRow[]=[]; for(const r of mm.municipal_rows){const e=maps.mun.get(`${r.uf}|${norm(r.municipality)}`); if(!e) continue; for(const [id,val] of [[14001,r.enterprise_count],[14002,r.total_installed_kw],[14003,r.solar_enterprise_count],[14004,r.solar_installed_kw]]) ind.push({indicator_id:id,entity_id:e.entity_id,period_start:PERIOD_START,period_end:PERIOD_END,status:2,numerator:Number(val),denominator:null,value:Number(val)}); }
  const byUf=new Map<string,any>(); for(const r of mm.municipal_rows){const x=byUf.get(r.uf)||{n:0,kw:0,solar:0,skw:0}; x.n+=r.enterprise_count;x.kw+=Number(r.total_installed_kw);x.solar+=r.solar_enterprise_count;x.skw+=Number(r.solar_installed_kw);byUf.set(r.uf,x);} for(const [u,x] of byUf){const e=maps.uf.get(u); if(!e) continue; for(const [id,val] of [[14001,x.n],[14002,x.kw],[14003,x.solar],[14004,x.skw]]) ind.push({indicator_id:id,entity_id:e.entity_id,period_start:PERIOD_START,period_end:PERIOD_END,status:2,numerator:val,denominator:null,value:val}); }
  if(maps.br) {const sums=mm.municipal_rows.reduce((a:any,r:any)=>(a.n+=r.enterprise_count,a.kw+=Number(r.total_installed_kw),a.solar+=r.solar_enterprise_count,a.skw+=Number(r.solar_installed_kw),a),{n:0,kw:0,solar:0,skw:0}); for(const [id,val] of [[14001,sums.n],[14002,sums.kw],[14003,sums.solar],[14004,sums.skw]]) ind.push({indicator_id:id,entity_id:maps.br.entity_id,period_start:PERIOD_START,period_end:PERIOD_END,status:2,numerator:val,denominator:null,value:val}); }
  await upsertIndicators(c,runId,ind); },{source_rows:mm.source_rows,unique_enterprises:mm.unique_enterprises,municipalities:mm.municipal_rows.length}); console.log('MMGD',mmRes);
 const ta=read('tariffs.json'); const taHash=hash(ta.source_sha256+'compact-v3'); const taRes=await publish(pool,161,taHash,async(c)=>{const rows=ta.rows.map((r:any)=>({...r,source_key:`\\x${r.source_key}`,source_hash:`\\x${ta.source_sha256}`})); await insertChunks(c,'exec_energy_tariff',rows,['source_key','sig_agente','cnpj_distribuidora','valid_from','valid_to','base_tarifaria','sub_group','modality','tariff_class','tariff_subclass','tusd','te','source_hash'],'(source_key)');},{source_rows:ta.source_rows,unique_rows:ta.unique_rows,municipal_crosswalk:'NOT_AVAILABLE',storage:'compact-v3'}); console.log('TARIFF',taRes);
 async function anp(ds:number,file:string,typ:string){const d=read(file); const h=hash(JSON.stringify(d)); const rows=d.rows.map((r:any)=>({...r,source_system:'ANP',source_hash:`\\x${h}`})); const res=await publish(pool,ds,h,async(c,runId)=>{await insertChunks(c,'exec_anp_establishment',rows,['source_system','source_key','uf','municipality','establishment_type','source_status','source_hash'],'(source_system,source_key)'); const byM=new Map<string,number>(),byU=new Map<string,number>(); for(const r of d.rows){byM.set(`${r.uf}|${norm(r.municipality)}`,(byM.get(`${r.uf}|${norm(r.municipality)}`)||0)+1);byU.set(r.uf,(byU.get(r.uf)||0)+1);} const id=typ==='POSTO'?14011:14012; const ind:IndicatorRow[]=[]; for(const [k,v] of byM){const [u,n]=k.split('|');const e=maps.mun.get(`${u}|${n}`);if(e) ind.push({indicator_id:id,entity_id:e.entity_id,period_start:PERIOD_START,period_end:PERIOD_END,status:2,numerator:v,denominator:null,value:v});} for(const [u,v] of byU){const e=maps.uf.get(u);if(e) ind.push({indicator_id:id,entity_id:e.entity_id,period_start:PERIOD_START,period_end:PERIOD_END,status:2,numerator:v,denominator:null,value:v});} if(maps.br) ind.push({indicator_id:id,entity_id:maps.br.entity_id,period_start:PERIOD_START,period_end:PERIOD_END,status:2,numerator:d.rows.length,denominator:null,value:d.rows.length}); await upsertIndicators(c,runId,ind);},{source_rows:d.expected_total,rows_collected:d.unique_rows,complete:d.complete}); console.log(typ,res,d.complete,d.unique_rows,d.expected_total); }
 await anp(162,'anp_postos.json','POSTO'); await anp(163,'anp_glp.json','GLP');
 const after=await pool.query('select pg_database_size(current_database())::bigint size'); console.log('DB_AFTER',after.rows[0].size,'GROWTH',Number(after.rows[0].size)-before); await pool.end();
}
main().catch(e=>{console.error(e);process.exit(1)});
