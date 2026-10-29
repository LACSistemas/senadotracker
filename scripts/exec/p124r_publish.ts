import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { openPool } from './db.ts';
import { publishSlice, type IndicatorRow } from '../../packages/db/src/exec/publication.ts';

const DATASET_ID = 121;
const COMPETENCE = 202412;
const PERIOD_START = '2024-01-01';
const PERIOD_END = '2025-01-01';
const RAW_BASE = 'D:\\Civica\\raw\\bem-estar\\censo-suas\\2024\\github';
const STAGING = 'D:\\Civica\\staging\\bem-estar\\censo-suas\\2024\\p124r_rows.json';

const defs = [
  [9101, 'WB-SUAS-CRAS', 'CRAS respondentes no Censo SUAS 2024', 'unidades', 'Número de linhas CRAS finais do Censo SUAS 2024 por município; um CRAS é contado uma vez pelo identificador source-native.', 'unidades CRAS', null],
  [9102, 'WB-SUAS-CRAS-CAP-2500', 'CRAS com capacidade de referenciamento até 2.500 famílias', 'unidades', 'Contagem source-native de CRAS com q1=2.500 no Censo SUAS 2024.', 'unidades CRAS q1=2.500', null],
  [9103, 'WB-SUAS-CRAS-CAP-3500', 'CRAS com capacidade de referenciamento até 3.500 famílias', 'unidades', 'Contagem source-native de CRAS com q1=3.500 no Censo SUAS 2024.', 'unidades CRAS q1=3.500', null],
  [9104, 'WB-SUAS-CRAS-CAP-5000', 'CRAS com capacidade de referenciamento até 5.000 famílias', 'unidades', 'Contagem source-native de CRAS com q1=5.000 no Censo SUAS 2024.', 'unidades CRAS q1=5.000', null],
  [9105, 'WB-SUAS-IDCRAS-MEAN', 'IDCRAS médio municipal', 'índice', 'Valor oficial divulgado na planilha municipal do IDCRAS 2024; não é recalculado a partir do RH.', 'valor publicado', null],
  [9106, 'WB-SUAS-IDCRAS-RESPONDENTS', 'CRAS respondentes do IDCRAS 2024', 'unidades', 'Número oficial de CRAS que respondeu ao Censo SUAS 2024 na planilha municipal do IDCRAS.', 'unidades respondentes', null],
  [9201, 'WB-SUAS-CREAS', 'CREAS com sede no município', 'unidades', 'Contagem de unidades CREAS da planilha oficial por município-sede (IBGE7); CREAS regionais não são multiplicados por municípios atendidos.', 'unidades CREAS com sede', null],
  [9202, 'WB-SUAS-IDCREAS-MEAN', 'IDCREAS médio municipal', 'índice', 'Valor oficial divulgado na planilha municipal do IDCREAS 2024; não é recalculado a partir do RH.', 'valor publicado', null],
  [9203, 'WB-SUAS-IDCREAS-RESPONDENTS', 'CREAS respondentes do IDCREAS 2024', 'unidades', 'Número oficial de CREAS que respondeu ao Censo SUAS 2024 na planilha municipal do IDCREAS.', 'unidades respondentes', null],
  [9301, 'WB-SUAS-IDCONSELHO-MEAN', 'IDConselho municipal', 'índice', 'Valor oficial divulgado na planilha municipal do IDConselho 2024.', 'valor publicado', null],
] as const;

type E = { entity_id: number; kind: number; ibge7: number | null; ibge6: number | null; uf_code: number | null; name: string };
type Prepared = { sourceFiles: Array<{name:string; relPath:string; bytes:number; sha256:string}>; sourceHash:string; cras:{rows:Array<{id:string;ibge7:string;ibge6:string;q1:string|null;q_incompleto:string|null}>}; idcras:{units:Array<{id:string;ibge7:string;ibge6:string;score:number|null}>;municipal:Array<{ibge7:string;respondents:number|null;mean:number|null}>}; idcreas:{units:Array<{id:string;ibge7:string;ibge6:string;score:number|null}>;municipal:Array<{ibge6:string;respondents:number|null;mean:number|null}>}; idconselho:Array<{ibge7:string;score:number|null}>; counts:Record<string,number> };
const sha = (x: string) => createHash('sha256').update(x).digest('hex');
const normQ = (x: string | null) => {
  if (!x) return null;
  const m = x.match(/(2|3|5)\.500/);
  return m ? `${m[1]}.5` : null;
};

async function bulkUpsert(c: any, runId: number, rows: IndicatorRow[]) {
  if (!rows.length) return;
  await c.query(`CREATE TEMP TABLE stg_p124r_ind (LIKE civica_exec.exec_ind_value INCLUDING DEFAULTS) ON COMMIT DROP`);
  for (let i = 0; i < rows.length; i += 5000) {
    const part = rows.slice(i, i + 5000);
    await c.query(`INSERT INTO stg_p124r_ind (indicator_id,entity_id,period_start,period_end,status,numerator,denominator,value,flags,run_id) SELECT indicator_id,entity_id,period_start,period_end,status,numerator,denominator,value,flags,$2 FROM jsonb_populate_recordset(NULL::civica_exec.exec_ind_value,$1::jsonb)`, [JSON.stringify(part), runId]);
  }
  await c.query(`INSERT INTO civica_exec.exec_ind_value (indicator_id,entity_id,period_start,period_end,status,numerator,denominator,value,flags,run_id)
    SELECT indicator_id,entity_id,period_start,period_end,status,numerator,denominator,value,flags,run_id FROM stg_p124r_ind
    ON CONFLICT (indicator_id,entity_id,period_start) DO UPDATE SET period_end=EXCLUDED.period_end,status=EXCLUDED.status,numerator=EXCLUDED.numerator,denominator=EXCLUDED.denominator,value=EXCLUDED.value,flags=EXCLUDED.flags,run_id=EXCLUDED.run_id`);
  await c.query(`DELETE FROM civica_exec.exec_ind_latest l USING (SELECT DISTINCT indicator_id,entity_id FROM stg_p124r_ind) s WHERE l.indicator_id=s.indicator_id AND l.entity_id=s.entity_id`);
  await c.query(`INSERT INTO civica_exec.exec_ind_latest (indicator_id,entity_id,period_start,status,value,numerator,denominator,flags,run_id,published_at)
    SELECT DISTINCT ON (v.indicator_id,v.entity_id) v.indicator_id,v.entity_id,v.period_start,v.status,v.value,v.numerator,v.denominator,v.flags,v.run_id,now()
    FROM civica_exec.exec_ind_value v JOIN (SELECT DISTINCT indicator_id,entity_id FROM stg_p124r_ind) s ON s.indicator_id=v.indicator_id AND s.entity_id=v.entity_id
    ORDER BY v.indicator_id,v.entity_id,(v.status=2) DESC,v.period_start DESC`);
}

async function main() {
  const prepared = JSON.parse(await readFile(STAGING, 'utf8')) as Prepared;
  const pool = openPool(3);
  const effectiveSourceHash = sha(`${prepared.sourceHash}:p124r-parser-v3`);
  const result: any = { phase: 'P12.4-R', database: null, datasetId: DATASET_ID, competence: COMPETENCE, sourceHash: effectiveSourceHash, rawSourceHash: prepared.sourceHash, startedAt: new Date().toISOString(), sourceFiles: prepared.sourceFiles };
  try {
    result.database = (await pool.query(`SELECT current_database() AS database, current_user AS current_user, pg_database_size(current_database())::bigint AS bytes`)).rows[0];
    if (result.database.database !== 'projetoeleitor_db') throw new Error(`DATABASE_GUARD ${result.database.database}`);
    const entities = (await pool.query(`SELECT entity_id,kind,ibge7,ibge6,uf_code,name FROM civica_exec.exec_entity WHERE kind IN (1,3,4)`)).rows as E[];
    const by7 = new Map(entities.filter(e => e.ibge7 != null).map(e => [String(e.ibge7), e]));
    const by6 = new Map(entities.filter(e => e.kind === 4 && e.ibge6 != null).map(e => [String(e.ibge6), e]));
    const brasil = entities.find(e => e.kind === 1)!;
    const ufs = [...new Set(entities.filter(e => e.kind === 3).map(e => Number(e.uf_code)))].sort((a,b)=>a-b);
    const rowsByUf = new Map<number, IndicatorRow[]>();
    const add = (e: E, r: Omit<IndicatorRow,'entity_id'>) => { const uf = e.kind === 1 ? 0 : Number(e.uf_code); const arr = rowsByUf.get(uf) ?? []; arr.push({ ...r, entity_id: e.entity_id }); rowsByUf.set(uf, arr); };
    const mk = (indicator_id:number, e:E, value:number|null, numerator:number|null=null, flags=0): Omit<IndicatorRow,'entity_id'> => ({ indicator_id,period_start:PERIOD_START,period_end:PERIOD_END,status:2,numerator,denominator:null,value,flags });
    const crasBy7 = new Map<string, any>();
    for (const x of prepared.cras.rows) { const a = crasBy7.get(x.ibge7) ?? { total:0, cap:new Map<string,number>(), incomplete:false }; a.total++; const q=normQ(x.q1); if(q) a.cap.set(q,(a.cap.get(q)??0)+1); if(x.q_incompleto && x.q_incompleto.toLowerCase() !== 'completo') a.incomplete=true; crasBy7.set(x.ibge7,a); }
    for (const [ibge7,a] of crasBy7) { const e=by7.get(ibge7); if(!e || e.kind!==4) continue; const f=a.incomplete?4:0; add(e,mk(9101,e,a.total,a.total,f)); add(e,mk(9102,e,a.cap.get('2.5')??0,(a.cap.get('2.5')??0),f)); add(e,mk(9103,e,a.cap.get('3.5')??0,(a.cap.get('3.5')??0),f)); add(e,mk(9104,e,a.cap.get('5')??0,(a.cap.get('5')??0),f)); }
    const nationalCras = prepared.cras.rows.length; const nationalCap = new Map<string,number>(); for (const x of prepared.cras.rows) { const q=normQ(x.q1); if(q) nationalCap.set(q,(nationalCap.get(q)??0)+1); }
    add(brasil,mk(9101,brasil,nationalCras,nationalCras)); add(brasil,mk(9102,brasil,nationalCap.get('2.5')??0,nationalCap.get('2.5')??0)); add(brasil,mk(9103,brasil,nationalCap.get('3.5')??0,nationalCap.get('3.5')??0)); add(brasil,mk(9104,brasil,nationalCap.get('5')??0,nationalCap.get('5')??0));
    for (const x of prepared.idcras.municipal) { const e=by7.get(x.ibge7); if(!e || e.kind!==4) continue; if(x.mean!=null) add(e,mk(9105,e,x.mean)); if(x.respondents!=null) add(e,mk(9106,e,x.respondents,x.respondents)); }
    const creasBy7 = new Map<string,number>(); for (const x of prepared.idcreas.units) creasBy7.set(x.ibge7,(creasBy7.get(x.ibge7)??0)+1);
    for (const [ibge7,n] of creasBy7) { const e=by7.get(ibge7); if(e && e.kind===4) add(e,mk(9201,e,n,n)); }
    for (const x of prepared.idcreas.municipal) { const e=by6.get(x.ibge6); if(!e) continue; if(x.mean!=null) add(e,mk(9202,e,x.mean)); if(x.respondents!=null) add(e,mk(9203,e,x.respondents,x.respondents)); }
    for (const x of prepared.idconselho) { const e=by7.get(x.ibge7); if(e && e.kind===4 && x.score!=null) add(e,mk(9301,e,x.score)); }
    const allRows = [...rowsByUf.values()].flat(); const seen=new Set<string>(); for(const r of allRows){const k=`${r.indicator_id}:${r.entity_id}:${r.period_start}`;if(seen.has(k))throw new Error(`DUPLICATE ${k}`);seen.add(k);}
    result.rowsPrepared = allRows.length; result.rowsByUf = Object.fromEntries([...rowsByUf.entries()].map(([uf,rs])=>[uf,rs.length])); result.entities = { total:entities.length, municipalities:entities.filter(e=>e.kind===4).length, ufs:ufs.length };
    const c0 = await pool.connect(); try { await c0.query('BEGIN'); for(let i=0;i<defs.length;i++){const [id,code,label,unit,note,numDesc,denDesc]=defs[i]; const ex=(await c0.query(`SELECT code,method_version,domain FROM civica_exec.exec_ind_def WHERE indicator_id=$1`,[id])).rows[0]; if(ex && (ex.code!==code || ex.method_version!==1 || ex.domain!==4)) throw new Error(`definition conflict ${id}`); if(!ex) await c0.query(`INSERT INTO civica_exec.exec_ind_def (indicator_id,code,method_version,domain,sort_order,label,unit,grain,numerator_desc,denominator_desc,min_denominator,ranking_allowed,aggregation_allowed,null_semantics,methodology_note) VALUES ($1,$2,1,4,$3,$4,$5,'A',$6,$7,NULL,false,true,'missing_not_zero',$8)`,[id,code,i+1,label,unit,numDesc,denDesc,note]); } await c0.query('COMMIT'); } finally {c0.release();}
    const sourceFiles = prepared.sourceFiles.map(x=>({name:x.name,bytes:x.bytes,sha256:x.sha256,sourceUrl:`https://github.com/Sagicad-MDS/indicadores-de-desenvolvimento/blob/main/${encodeURIComponent(x.relPath).replace(/%2F/g,'/')}`}));
    const slices:any[]=[]; const firstRows=rowsByUf.get(0)??[]; const publish=(uf:number, rows:IndicatorRow[])=>publishSlice(pool,{datasetId:DATASET_ID,uf,competence:COMPETENCE,sourceHash:sha(`${effectiveSourceHash}:${uf}`),parserVersion:'p12.4r-censo-suas-2024-v3',bootstrap:true,contiguity:false,tables:[],inputs:{provider:'SAGICAD-MDS GitHub',sourceFiles},quality:{rowsIn:rows.length,rowsOutExpected:rows.length,productA:'municipal aggregate indicators',productB:'unit identifiers validated but no unit inventory table published'},derive:async(client,runId)=>bulkUpsert(client,runId,rows)});
    slices.push({uf:0,result:await publish(0,firstRows)}); for(const uf of ufs) slices.push({uf,result:await publish(uf,rowsByUf.get(uf)??[])}); result.slices=slices;
    const firstRun = slices.find(x=>x.result.runId)?.result.runId; const manifestClient=await pool.connect(); try { await manifestClient.query('BEGIN'); for(const x of prepared.sourceFiles){ const url=`https://raw.githubusercontent.com/Sagicad-MDS/indicadores-de-desenvolvimento/main/${x.relPath.split('\\').map(encodeURIComponent).join('/')}`; await manifestClient.query(`INSERT INTO civica_exec.exec_raw_manifest (run_id,source_url,rel_path,sha256,bytes,competence,uf,fetched_at,state,retention_class) VALUES ($1,$2,$3,$4::bytea,$5,$6,0,now(),2,1) ON CONFLICT (sha256) DO UPDATE SET run_id=EXCLUDED.run_id,source_url=EXCLUDED.source_url,competence=EXCLUDED.competence,uf=EXCLUDED.uf,state=EXCLUDED.state`,[firstRun??null,url,`raw/bem-estar/censo-suas/2024/github/${x.name}`,Buffer.from(x.sha256,'hex'),x.bytes,COMPETENCE]); } await manifestClient.query('COMMIT'); } finally {manifestClient.release();}
    const replay:any[]=[]; replay.push({uf:0,result:await publish(0,firstRows)}); for(const uf of ufs) replay.push({uf,result:await publish(uf,rowsByUf.get(uf)??[])}); result.replay=replay;
    result.counts=(await pool.query(`SELECT d.code,d.indicator_id,count(v.*)::int rows,count(DISTINCT v.entity_id)::int entities,count(*) FILTER (WHERE v.value IS NULL)::int nulls FROM civica_exec.exec_ind_def d LEFT JOIN civica_exec.exec_ind_value v USING(indicator_id) WHERE d.indicator_id BETWEEN 9101 AND 9301 GROUP BY d.code,d.indicator_id ORDER BY d.indicator_id`)).rows;
    result.publications=(await pool.query(`SELECT count(*)::int AS total, count(*) FILTER (WHERE dataset_id=$1)::int AS p124r FROM civica_exec.exec_publication`,[DATASET_ID])).rows[0];
    result.rawManifest=(await pool.query(`SELECT count(*)::int AS files FROM civica_exec.exec_raw_manifest WHERE competence=$1`,[COMPETENCE])).rows[0];
    result.finishedAt=new Date().toISOString(); console.log(JSON.stringify(result,null,2));
  } finally { await pool.end(); }
}
main().catch(e=>{console.error(e);process.exitCode=1});
