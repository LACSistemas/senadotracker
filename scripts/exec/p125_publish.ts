import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { openPool } from './db.ts';
import { publishSlice, upsertIndicators, type IndicatorRow } from '../../packages/db/src/exec/publication.ts';

const STAGING = 'D:\\Civica\\staging\\bem-estar\\trabalho\\p125_rows.json';
const RAIS_DATASET = 122;
const CAGED_DATASET = 123;
const DOMAIN = 4;
const MAX_ENVELOPE = 500_000_000;
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
type Staging = { sourceFiles: any[]; rais: any[]; raisRem: any[]; caged: any[]; stats: any };

const defs = [
  [9401, 'WB-LABOR-RAIS-STOCK', 'Vínculos formais ativos', 'vínculos', 'Quantidade de vínculos ativos em 31/12 na RAIS; local do estabelecimento; não representa pessoas nem residência.', 'vínculos formais ativos em 31/12', 'não aplicável'],
  [9402, 'WB-LABOR-RAIS-REMUNERATION-MEAN-DEC', 'Remuneração média real de dezembro — RAIS', 'BRL/mês', 'Remuneração real média dos vínculos em dezembro, publicação oficial por Brasil/UF.', 'remuneração real média de dezembro', 'não aplicável'],
  [9500, 'WB-LABOR-CAGED-STOCK', 'Estoque formal de referência — Novo Caged', 'vínculos', 'Estoque mensal ajustado publicado pelo Novo Caged; não é estimativa por soma de saldos.', 'estoque de vínculos de referência', 'não aplicável'],
  [9501, 'WB-LABOR-CAGED-ADM', 'Admissões — Novo Caged', 'movimentações', 'Admissões formais da competência, série mensal com ajustes.', 'admissões declaradas/ajustadas', 'não aplicável'],
  [9502, 'WB-LABOR-CAGED-DIS', 'Desligamentos — Novo Caged', 'movimentações', 'Desligamentos formais da competência, série mensal com ajustes.', 'desligamentos declarados/ajustados', 'não aplicável'],
  [9503, 'WB-LABOR-CAGED-BAL', 'Saldo — Novo Caged', 'movimentações', 'Saldo oficial de admissões menos desligamentos no mesmo universo e competência.', 'saldo de admissões menos desligamentos', 'não aplicável'],
] as const;

function periodFor(family: 'rais' | 'caged', period: number): [string, string] {
  if (family === 'rais') return [`${period}-01-01`, `${period + 1}-01-01`];
  const y = Math.floor(period / 100), m = period % 100;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return [`${y}-${String(m).padStart(2, '0')}-01`, next];
}

async function main() {
  const st = JSON.parse(await readFile(STAGING, 'utf8')) as Staging;
  const pool = openPool(4);
  const result: any = { phase: 'P12.5', startedAt: new Date().toISOString(), database: 'projetoeleitor_db', sourceStats: st.stats, sourceFiles: st.sourceFiles, datasets: {}, regressions: {}, gates: {} };
  const before = Number((await pool.query(`SELECT current_database(), pg_database_size(current_database())::bigint bytes`)).rows[0].bytes);
  const dbname = (await pool.query(`SELECT current_database()`)).rows[0].current_database;
  if (dbname !== 'projetoeleitor_db') throw new Error(`DATABASE_GUARD:${dbname}`);
  result.dbBefore = before;

  // Definitions are additive and checked for semantic compatibility on replay.
  const dc = await pool.connect();
  try { await dc.query('BEGIN'); for (let i=0;i<defs.length;i++) { const [id,code,label,unit,note,num,den]=defs[i]; const e=(await dc.query(`SELECT code,method_version,domain FROM civica_exec.exec_ind_def WHERE indicator_id=$1`,[id])).rows[0]; if (e && (e.code!==code || e.method_version!==1 || e.domain!==DOMAIN)) throw new Error(`DEF_CONFLICT:${id}`); if (!e) await dc.query(`INSERT INTO civica_exec.exec_ind_def(indicator_id,code,method_version,domain,sort_order,label,unit,grain,numerator_desc,denominator_desc,min_denominator,ranking_allowed,aggregation_allowed,null_semantics,methodology_note) VALUES($1,$2,1,$3,$4,$5,$6,'A',$7,$8,NULL,false,true,'missing_not_zero',$9)`,[id,code,DOMAIN,40+i,label,unit,num,den,note]); } await dc.query('COMMIT'); } catch(e){await dc.query('ROLLBACK'); throw e} finally {dc.release();}

  const ents=(await pool.query(`SELECT entity_id,kind,uf_code,ibge7 FROM civica_exec.exec_entity WHERE kind IN (1,3,4)`)).rows as any[];
  const byIbge=new Map<number,any>(); for(const e of ents){ byIbge.set(Number(e.ibge7),e); if(e.kind===4) byIbge.set(Math.floor(Number(e.ibge7)/10),e); if(e.kind===1) byIbge.set(0,e); if(e.kind===3 && e.uf_code!=null) byIbge.set(Number(e.uf_code)*100000,e); }
  const getEntity=(code:number)=>{const e=byIbge.get(Number(code)) ?? byIbge.get(Number(code)%100000===0 ? Number(code)/100000 : -1); if(!e) throw new Error(`ENTITY_UNRESOLVED:${code}`); return e};
  const mk=(family:'rais'|'caged', x:any, id:number, period:number, value:number|null): IndicatorRow => { const [start,end]=periodFor(family,period); const e=getEntity(Number(x.ibge7)); return {indicator_id:id,entity_id:Number(e.entity_id),period_start:start,period_end:end,status:2,numerator:value,denominator:null,value,flags:value==null?256:0}; };
  const raisRows: IndicatorRow[]=[]; for(const x of st.rais) raisRows.push(mk('rais',x,9401,Number(x.year),x.value)); for(const x of st.raisRem) raisRows.push(mk('rais',x,9402,2025,x.value));
  const cagedRows: IndicatorRow[]=[]; for(const x of st.caged){ const id=Number(x.indicator==='WB-LABOR-CAGED-STOCK'?9500:x.indicator==='WB-LABOR-CAGED-ADM'?9501:x.indicator==='WB-LABOR-CAGED-DIS'?9502:9503); cagedRows.push(mk('caged',x,id,Number(x.year_month),x.value)); }
  const publishFamily=async(datasetId:number,family:'rais'|'caged',rows:IndicatorRow[],comps:number[],source:any[])=>{
    const by=new Map<string,IndicatorRow[]>(); for(const r of rows){const comp=family==='rais'?Number(r.period_start.slice(0,4))*100+12:Number(r.period_start.slice(0,7).replace('-','')); const uf=Number((ents.find(e=>e.entity_id===r.entity_id)?.uf_code)??0); const k=`${uf}:${comp}`; if(!by.has(k))by.set(k,[]);by.get(k)!.push(r)}
    const out:any[]=[]; for(const [k,rs] of by){const [ufS,compS]=k.split(':'); const uf=Number(ufS),comp=Number(compS); const h=sha(JSON.stringify({datasetId,uf,comp,source,rows:rs})); const r=await publishSlice(pool,{datasetId,uf,competence:comp,sourceHash:h,parserVersion:`p12.5-${family}-xlsx-v1`,bootstrap:false,contiguity:false,tables:[],inputs:{provider:'MTE',family,sourceFiles:source},quality:{rowsIn:rs.length,territorialRows:rs.length,adjusted:family==='caged'},derive:async(c,runId)=>{await upsertIndicators(c,runId,rs)}}); out.push({uf,competence:comp,rows:rs.length,status:r.status,runId:'runId' in r?r.runId:null}); }
    return out;
  };
  result.datasets.rais=await publishFamily(RAIS_DATASET,'rais',raisRows,[202312,202412,202512],st.sourceFiles.filter(x=>x.family==='RAIS'));
  result.datasets.caged=await publishFamily(CAGED_DATASET,'caged',cagedRows,[...new Set(st.caged.map(x=>Number(x.year_month)))],st.sourceFiles.filter(x=>x.family==='CAGED'));

  // Raw provenance (payload remains on D:). Identity is supplied by the table's identity column.
  const rc=await pool.connect(); try { await rc.query('BEGIN'); for(const f of st.sourceFiles){ const exists=(await rc.query(`SELECT 1 FROM civica_exec.exec_raw_manifest WHERE sha256=$1::bytea LIMIT 1`,[Buffer.from(f.sha256,'hex')])).rowCount; if(!exists) await rc.query(`INSERT INTO civica_exec.exec_raw_manifest(source_url,rel_path,sha256,bytes,competence,fetched_at,state,retention_class) VALUES($1,$2,$3,$4,$5,now(),2,1)`,[f.url, f.path.replace(/^D:\\Civica\\/i,'').replaceAll('\\','/'),Buffer.from(f.sha256,'hex'),f.bytes,f.family==='RAIS'?202512:202608]); } await rc.query('COMMIT'); } catch(e){await rc.query('ROLLBACK');throw e} finally {rc.release();}
  const after=Number((await pool.query(`SELECT pg_database_size(current_database())::bigint bytes`)).rows[0].bytes); result.dbAfter=after; result.dbGrowth=after-before; result.indicatorCounts=(await pool.query(`SELECT indicator_id,count(*)::int rows,count(DISTINCT entity_id)::int entities,min(period_start) first_period,max(period_start) last_period FROM civica_exec.exec_ind_value WHERE indicator_id BETWEEN 9401 AND 9503 GROUP BY indicator_id ORDER BY indicator_id`)).rows; result.publications=(await pool.query(`SELECT dataset_id,count(*)::int slices FROM civica_exec.exec_publication WHERE dataset_id IN(122,123) GROUP BY dataset_id ORDER BY dataset_id`)).rows; result.finishedAt=new Date().toISOString(); console.log(JSON.stringify(result,null,2)); await pool.end();
}
main().catch(e=>{console.error(e);process.exitCode=1});
