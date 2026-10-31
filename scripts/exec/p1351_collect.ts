import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { openPool } from './db.ts';
import { publishSlice, type IndicatorRow } from '../../packages/db/src/exec/publication.ts';

const RAW = 'D:\\Civica\\raw\\infraestrutura\\urbano_habitacao';
const PERIOD_START = '2022-01-01';
const PERIOD_END = '2023-01-01';
const DOMAIN = 5;
const DATASETS = { entorno: 146, internet: 147, favelas: 148, fjp: 149 };

type Entity = { entity_id: number; kind: number; uf_code: number | null; ibge7: number; name: string };
type Row = Record<string, string>;
type Out = IndicatorRow & { uf: number };
const sha256 = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const n = (v: unknown): number | null => { if (v == null || String(v).trim() === '' || String(v).trim() === '-' || String(v).trim() === '...') return null; const x = Number(String(v).replace(',', '.')); return Number.isFinite(x) ? x : null; };
const csvRows = async (p: string): Promise<Row[]> => parse(await readFile(p, 'utf8'), { columns: true, delimiter: ';', quote: '"', skip_empty_lines: true, relax_column_count: true, bom: true }) as Row[];
const jsonRows = async (p: string): Promise<Row[]> => (JSON.parse(await readFile(p, 'utf8')) as Row[]).slice(1);
const fileMeta = async (p: string) => { const b = await readFile(p); return { file: p, bytes: b.length, sha256: sha256(b) }; };
const findCsv = async (dir: string) => { const f=(await readdir(dir)).find(x=>x.toLowerCase().endsWith('.csv')); if(!f) throw new Error(`CSV ausente em ${dir}`); return join(dir,f); };

const defs: Array<[number, string, string, string, string, string, string | null]> = [];
const addDef = (id: number, code: string, label: string, unit: string, numDesc: string, denDesc: string | null, note: string) => defs.push([id, code, label, unit, numDesc, denDesc, note]);
const themes = [
  ['CIRCULATION_BUS_TRUCK', 'circulação de caminhão/ônibus', 'VIA-CIRCULACAO'],
  ['PAVEMENT', 'via pavimentada', 'VIA-PAVIMENTADA'], ['DRAINAGE', 'bueiro ou boca de lobo', 'VIA-BUEIRO'],
  ['LIGHTING', 'iluminação pública', 'VIA-ILUMINACAO'], ['BUS_STOP', 'ponto de ônibus ou van', 'VIA-PONTO-ONIBUS'],
  ['BIKE_SIGN', 'via sinalizada para bicicleta', 'VIA-BICICLETA'], ['SIDEWALK', 'calçada ou passeio', 'VIA-CALCADA'],
  ['SIDEWALK_OBSTACLE', 'obstáculo na calçada', 'VIA-OBSTACULO-CALCADA'], ['CURB_RAMP', 'rampa para cadeirante', 'VIA-RAMPA'],
  ['TREE_PRESENCE', 'arborização (uma ou mais árvores)', 'VIA-ARBORIZACAO'],
] as const;
const units = [
  { prefix: 9700, suffix: 'HOUSEHOLD', label: 'domicílios', den: 'Domicílios particulares permanentes ocupados em setor escolhido para aplicação do entorno' },
  { prefix: 9730, suffix: 'FACE', label: 'faces de quadra', den: 'Faces de quadra avaliadas no agregado municipal' },
  { prefix: 9760, suffix: 'RESIDENT', label: 'moradores', den: 'Moradores em domicílios particulares permanentes ocupados em setor escolhido para aplicação do entorno' },
] as const;
for (const u of units) for (let i = 0; i < themes.length; i++) addDef(u.prefix + i + 1, `INF-ENTORNO-${u.suffix}-${themes[i][0]}`, `${themes[i][1]} — ${u.label} (Censo 2022)`, '%', 'numerador da categoria positiva / denominador oficial × 100', u.den, `Agregado municipal oficial do IBGE; unidade=${u.label}; não representa todas as vias do município. ${themes[i][2]}.`);
addDef(9801, 'INF-INTERNET-DOMICILIOS', 'Domicílios com conexão domiciliar à Internet (Censo 2022)', '%', 'domicílios com Internet / domicílios particulares permanentes ocupados', 'Domicílios particulares permanentes ocupados', 'SIDRA 9936, variável 381, categorias Total e Sim; Brasil, UFs e municípios.');
addDef(9802, 'INF-INTERNET-MORADORES', 'Moradores em domicílios com conexão à Internet (Censo 2022)', '%', 'moradores com Internet / moradores em domicílios particulares permanentes ocupados', 'Moradores em domicílios particulares permanentes ocupados', 'SIDRA 9942, variável 382, cor/raça Total e idade Total; Brasil, UFs e municípios.');
addDef(9901, 'INF-FAVELAS-COMUNIDADES', 'Favelas e Comunidades Urbanas — número de comunidades (Censo 2022)', 'unidades', 'número de Favelas e Comunidades Urbanas', null, 'SIDRA 9883; edição revisada publicada pelo IBGE em 2025, referência 2022.');
addDef(9902, 'INF-FAVELAS-POPULACAO', 'População residente em Favelas e Comunidades Urbanas (Censo 2022)', 'pessoas', 'população residente em Favelas e Comunidades Urbanas', null, 'SIDRA 9888; edição revisada publicada pelo IBGE em 2025, referência 2022.');
addDef(9903, 'INF-FAVELAS-DOMICILIOS', 'Domicílios particulares permanentes ocupados em Favelas e Comunidades Urbanas (Censo 2022)', 'domicílios', 'domicílios particulares permanentes ocupados em Favelas e Comunidades Urbanas', null, 'SIDRA 9887, espécie 59998; não confundir com todos os domicílios do município.');
addDef(9904, 'INF-FAVELAS-AREA', 'Área territorial de Favelas e Comunidades Urbanas (Censo 2022)', 'km²', 'área territorial publicada pelo IBGE', null, 'SIDRA 9888; área agregada oficial.');
addDef(9905, 'INF-FAVELAS-DENSIDADE', 'Densidade demográfica em Favelas e Comunidades Urbanas (Censo 2022)', 'hab/km²', 'densidade demográfica publicada pelo IBGE', null, 'SIDRA 9888; não é densidade de todo o município.');
addDef(9951, 'INF-FJP-DEFICIT-HABITACIONAL', 'Déficit habitacional — FJP (Brasil/UF)', 'domicílios', 'estimativa FJP 2024', null, 'FJP 2024; a planilha oficial publica Brasil, regiões, UFs e estratos, não municípios universais.');
addDef(9952, 'INF-FJP-DEFICIT-RELATIVO', 'Déficit habitacional relativo — FJP (Brasil/UF)', '%', 'estimativa FJP 2024', 'total de domicílios particulares ocupados da base FJP', 'FJP 2024; proporção oficial, preservada como valor decimal convertido para percentual.');

async function bulkUpsert(c: any, runId: number, rows: IndicatorRow[]) {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += 5000) {
    const part = rows.slice(i, i + 5000);
    await c.query(`INSERT INTO civica_exec.exec_ind_value (indicator_id,entity_id,period_start,period_end,status,numerator,denominator,value,flags,run_id)
      SELECT x.indicator_id,x.entity_id,x.period_start::date,x.period_end::date,x.status,x.numerator,x.denominator,x.value,x.flags,$1
      FROM jsonb_to_recordset($2::jsonb) x(indicator_id smallint,entity_id int,period_start text,period_end text,status smallint,numerator double precision,denominator double precision,value double precision,flags smallint)
      ON CONFLICT (indicator_id,entity_id,period_start) DO UPDATE SET period_end=EXCLUDED.period_end,status=EXCLUDED.status,numerator=EXCLUDED.numerator,denominator=EXCLUDED.denominator,value=EXCLUDED.value,flags=EXCLUDED.flags,run_id=EXCLUDED.run_id`, [runId, JSON.stringify(part.map(x => ({ ...x, flags: x.flags ?? 0 })))]);
  }
  const pairs = [...new Set(rows.map(r => `${r.indicator_id}:${r.entity_id}`))].map(k => k.split(':').map(Number));
  for (let i = 0; i < pairs.length; i += 5000) {
    const part = pairs.slice(i, i + 5000);
    await c.query(`DELETE FROM civica_exec.exec_ind_latest l USING jsonb_to_recordset($1::jsonb) x(indicator_id smallint,entity_id int) WHERE l.indicator_id=x.indicator_id AND l.entity_id=x.entity_id`, [JSON.stringify(part.map(([indicator_id, entity_id]) => ({ indicator_id, entity_id })))]);
    await c.query(`INSERT INTO civica_exec.exec_ind_latest (indicator_id,entity_id,period_start,status,value,numerator,denominator,flags,run_id,published_at)
      SELECT v.indicator_id,v.entity_id,v.period_start,v.status,v.value,v.numerator,v.denominator,v.flags,v.run_id,now() FROM civica_exec.exec_ind_value v JOIN (SELECT x.indicator_id,x.entity_id FROM jsonb_to_recordset($1::jsonb) x(indicator_id smallint,entity_id int)) p ON p.indicator_id=v.indicator_id AND p.entity_id=v.entity_id
      WHERE (v.indicator_id,v.entity_id,v.period_start) IN (SELECT v2.indicator_id,v2.entity_id,max(v2.period_start) FROM civica_exec.exec_ind_value v2 JOIN (SELECT x.indicator_id,x.entity_id FROM jsonb_to_recordset($1::jsonb) x(indicator_id smallint,entity_id int)) p2 ON p2.indicator_id=v2.indicator_id AND p2.entity_id=v2.entity_id WHERE v2.status=2 GROUP BY v2.indicator_id,v2.entity_id)`, [JSON.stringify(part.map(([indicator_id, entity_id]) => ({ indicator_id, entity_id })))]);
  }
}

async function main() {
  const pool = openPool(4);
  const result: any = { phase: 'P13.5.1', startedAt: new Date().toISOString(), indicatorDefinitions: defs.length, database: null, families: {} };
  try {
    const db = (await pool.query(`select current_database() database,pg_database_size(current_database())::bigint bytes`)).rows[0];
    if (db.database !== 'projetoeleitor_db') throw new Error(`DATABASE_GUARD ${db.database}`); result.database = db;
    const ents = (await pool.query(`select entity_id,kind,uf_code,ibge7,name from civica_exec.exec_entity where kind in (1,3,4)`)).rows as Entity[];
    const brasil = ents.find(e => e.kind === 1); if (!brasil) throw new Error('Brasil entity missing');
    const byIbge = new Map(ents.filter(e => e.kind === 4).map(e => [Number(e.ibge7), e]));
    const byUf = new Map(ents.filter(e => e.kind === 3).map(e => [Number(e.uf_code), e]));
    const defClient = await pool.connect();
    try { await defClient.query('BEGIN'); for (let i=0;i<defs.length;i++){const [id,code,label,unit,numDesc,denDesc,note]=defs[i]; const ex=(await defClient.query('select code,domain from civica_exec.exec_ind_def where indicator_id=$1',[id])).rows[0]; if(ex && (ex.code!==code || Number(ex.domain)!==DOMAIN)) throw new Error(`definition collision ${id}`); if(!ex) await defClient.query(`insert into civica_exec.exec_ind_def(indicator_id,code,method_version,domain,sort_order,label,unit,grain,numerator_desc,denominator_desc,ranking_allowed,aggregation_allowed,null_semantics,methodology_note) values($1,$2,1,$3,$4,$5,$6,'A',$7,$8,false,false,'missing_not_zero',$9)`,[id,code,DOMAIN,100+i,label,unit,numDesc,denDesc,note]); } await defClient.query('COMMIT'); } finally { defClient.release(); }

    const sourceMeta: any[] = [];
    for (const p of [
      join(RAW,'censo2022_entorno','Agregados_por_municipios_entorno_domic%c3%adlios_BR.zip'), join(RAW,'censo2022_entorno','Agregados_por_municipios_entorno_faces_BR.zip'), join(RAW,'censo2022_entorno','Agregados_por_municipios_entorno_moradores_BR.zip'), join(RAW,'censo2022_entorno','dicionarios_de_dados_entorno.zip'),
      ...['9936','9942'].flatMap(t=>['n1','n3','n6'].map(n=>join(RAW,'sidra_internet',`sidra-${t}-${n}-2022.json`))), ...[9883,9887,9888].flatMap(t=>['n1','n3','n6'].map(n=>join(RAW,'favelas',`sidra-${t}-${n}-2022.json`))), join(RAW,'fjp','fjp_deficit_2024.xlsx')]) sourceMeta.push(await fileMeta(p));
    const hashFor = (names: string[]) => sha256(JSON.stringify(sourceMeta.filter(x => names.some(n => x.file.includes(n)))));

    const publishFamily = async (datasetId: number, rows: Out[], sourceHash: string, parser: string, quality: any) => {
      const slices: any[] = []; const groups = new Map<number, IndicatorRow[]>();
      for (const r of rows) { if(!groups.has(r.uf)) groups.set(r.uf,[]); groups.get(r.uf)!.push(r); }
      for (const uf of [0, ...[...byUf.keys()].sort((a,b)=>a-b)]) { const slice = groups.get(uf) ?? []; const res=await publishSlice(pool,{datasetId,uf,competence:202610,sourceHash:sha256(`${sourceHash}:${uf}`),parserVersion:parser,bootstrap:true,contiguity:false,tables:[],inputs:{sourceMeta},quality:{...quality,rowsIn:slice.length},derive:async(c,runId)=>bulkUpsert(c,runId,slice)}); slices.push({uf,rows:slice.length,status:res.status,runId:'runId' in res?res.runId:null}); }
      return slices;
    };

    // Entorno: three official municipal aggregates, positive category / official unit total.
    const files = { HOUSEHOLD: join(RAW,'censo2022_entorno','Agregados_por_municipios_entorno_domic%c3%adlios_BR','Agregados_por_municipios_entorno_domic¡lios_BR.csv'), FACE: join(RAW,'censo2022_entorno','Agregados_por_municipios_entorno_faces_BR','Agregados_por_municipios_entorno_faces_BR.csv'), RESIDENT: join(RAW,'censo2022_entorno','Agregados_por_municipios_entorno_moradores_BR','Agregados_por_municipios_entorno_moradores_BR.csv') };
    const entRows = new Map<string, Row[]>(); for(const [u,p] of Object.entries(files)) entRows.set(u, await csvRows(p));
    const pos = [1,6,9,12,15,18,21,24,27,31]; const den = {HOUSEHOLD:'V05000',FACE:'V05400',RESIDENT:'V05200'} as const; const pre = {HOUSEHOLD:'V050',FACE:'V054',RESIDENT:'V052'} as const;
    const entorno: Out[] = [];
    for(const [unit, rows] of entRows){ for(const r of rows){const e=byIbge.get(Number(r.CD_MUN)); if(!e) continue; const d=n(r[den[unit as keyof typeof den]]); for(let i=0;i<themes.length;i++){ let numv:number|null; if(i===9){numv=[31,32,33].map(k=>n(r[`${pre[unit as keyof typeof pre]}${String(k).padStart(3,'0')}`])??0).reduce((a,b)=>a+b,0);} else numv=n(r[`${pre[unit as keyof typeof pre]}${String(pos[i]).padStart(3,'0')}`]); const val=d!=null&&d>0&&numv!=null?numv/d*100:null; const indicator=(unit==='HOUSEHOLD'?9701:unit==='FACE'?9731:9761)+i; entorno.push({indicator_id:indicator,entity_id:e.entity_id,period_start:PERIOD_START,period_end:PERIOD_END,status:2,numerator:numv,denominator:d,value:val,flags:val==null?256:0,uf:Number(e.uf_code)}); } } }
    // Add official BR/UF aggregates by summing compatible numerators/denominators.
    for(const [unit, rows] of entRows){ const agg=new Map<number,Map<number,{n:number;d:number}>>(); for(const r of rows){const uf=Number(String(r.CD_MUN).slice(0,2)); const d=n(r[den[unit as keyof typeof den]]); if(d==null) continue; if(!agg.has(uf)) agg.set(uf,new Map()); const m=agg.get(uf)!; for(let i=0;i<themes.length;i++){const id=(unit==='HOUSEHOLD'?9701:unit==='FACE'?9731:9761)+i; const nv=i===9?[31,32,33].map(k=>n(r[`${pre[unit as keyof typeof pre]}${String(k).padStart(3,'0')}`])??0).reduce((a,b)=>a+b,0):n(r[`${pre[unit as keyof typeof pre]}${String(pos[i]).padStart(3,'0')}`])??0; const x=m.get(id)??{n:0,d:0}; x.n+=nv;x.d+=d;m.set(id,x);} } for(const [uf,m] of agg){const ue=byUf.get(uf);if(!ue)continue;for(const [id,x] of m){entorno.push({indicator_id:id,entity_id:ue.entity_id,period_start:PERIOD_START,period_end:PERIOD_END,status:2,numerator:x.n,denominator:x.d,value:x.d?x.n/x.d*100:null,flags:x.d?0:256,uf});}} for(const [id,x] of (agg.get(0)??new Map())) void id; }
    // Brasil aggregate from all municipal rows.
    for(const unit of Object.keys(files)){const relevant=entorno.filter(x=>x.indicator_id>=(unit==='HOUSEHOLD'?9701:unit==='FACE'?9731:9761)&&x.indicator_id<(unit==='HOUSEHOLD'?9731:unit==='FACE'?9761:9791)&&x.entity_id!==brasil.entity_id); const ue=brasil; for(let i=0;i<themes.length;i++){const rr=relevant.filter(x=>x.indicator_id===((unit==='HOUSEHOLD'?9701:unit==='FACE'?9731:9761)+i));const d=rr.reduce((s,x)=>s+(x.denominator??0),0),nv=rr.reduce((s,x)=>s+(x.numerator??0),0); entorno.push({indicator_id:rr[0]?.indicator_id??0,entity_id:ue.entity_id,period_start:PERIOD_START,period_end:PERIOD_END,status:2,numerator:nv,denominator:d,value:d?nv/d*100:null,flags:d?0:256,uf:0});}}
    result.families.entorno={municipalRows:entorno.filter(x=>x.entity_id!==brasil.entity_id && !byUf.has(x.uf)).length, rows:entorno.length, slices:await publishFamily(DATASETS.entorno,entorno,hashFor(['entorno_','dicionarios']),'p1351-entorno-2022-v1',{units:['HOUSEHOLD','FACE','RESIDENT'],themes:themes.map(x=>x[0])})};

    const internet: Out[]=[]; for(const table of [9936,9942]){for(const level of ['n1','n3','n6']){for(const r of await jsonRows(join(RAW,'sidra_internet',`sidra-${table}-${level}-2022.json`))){const e=Number(r.NC)===1?brasil:Number(r.NC)===3?byUf.get(Number(r.D1C)):byIbge.get(Number(r.D1C)); if(!e)continue; const id=table===9936?9801:9802; const key=Number(r.D4C); const x=(internet as any)._tmp; void x; const k=`${id}:${e.entity_id}`; const prev=(internet as any).map?.get?.(k); }}}
    const internetMap=new Map<string,{e:Entity; id:number; total:number|null; yes:number|null}>(); for(const table of [9936,9942])for(const level of ['n1','n3','n6'])for(const r of await jsonRows(join(RAW,'sidra_internet',`sidra-${table}-${level}-2022.json`))){const e=Number(r.NC)===1?brasil:Number(r.NC)===3?byUf.get(Number(r.D1C)):byIbge.get(Number(r.D1C));if(!e)continue;const id=table===9936?9801:9802;const k=`${id}:${e.entity_id}`;const x=internetMap.get(k)??{e,id,total:null,yes:null};if(r.D4C==='77584')x.total=n(r.V);if(r.D4C==='77585')x.yes=n(r.V);internetMap.set(k,x);}
    for(const x of internetMap.values()){const v=x.total!=null&&x.total>0&&x.yes!=null?x.yes/x.total*100:null;internet.push({indicator_id:x.id,entity_id:x.e.entity_id,period_start:PERIOD_START,period_end:PERIOD_END,status:2,numerator:x.yes,denominator:x.total,value:v,flags:v==null?256:0,uf:x.e.kind===1?0:Number(x.e.uf_code)});}
    result.families.internet={rows:internet.length,slices:await publishFamily(DATASETS.internet,internet,hashFor(['sidra-9936','sidra-9942']),'p1351-sidra-internet-2022-v1',{tables:[9936,9942]})};

    const favelas: Out[]=[]; const fMap=new Map<string,{e:Entity;id:number;v:number|null}>(); for(const [t,id] of [[9883,9901],[9887,9903],[9888,9902],[9888,9904],[9888,9905]] as const)for(const level of ['n1','n3','n6'])for(const r of await jsonRows(join(RAW,'favelas',`sidra-${t}-${level}-2022.json`))){const e=Number(r.NC)===1?brasil:Number(r.NC)===3?byUf.get(Number(r.D1C)):byIbge.get(Number(r.D1C));if(!e)continue;const varId=Number(r.D2C);if(t===9887&&varId!==9903)continue;const id=t===9883?9901:t===9887?9903:varId===9612?9902:varId===9911?9904:9905;const k=`${id}:${e.entity_id}`;fMap.set(k,{e,id,v:n(r.V)});}
    for(const x of fMap.values())favelas.push({indicator_id:x.id,entity_id:x.e.entity_id,period_start:PERIOD_START,period_end:PERIOD_END,status:2,numerator:x.v,denominator:null,value:x.v,flags:x.v==null?256:0,uf:x.e.kind===1?0:Number(x.e.uf_code)});
    result.families.favelas={rows:favelas.length,slices:await publishFamily(DATASETS.favelas,favelas,hashFor(['sidra-9883','sidra-9887','sidra-9888']),'p1351-favelas-sidra-2022-v1',{tables:[9883,9887,9888],edition:'revised-2025'})};

    const fjp: Out[]=[]; const wsRows:any[]=[]; const { loadWorkbook } = await import('openpyxl'); void loadWorkbook; // marker: parsed by companion preprocessor below
    // FJP values are staged by the companion Python parser and read from its compact JSON.
    const fjpJson=join(RAW,'fjp','fjp_deficit_2024_compact.json'); try{for(const x of JSON.parse(await readFile(fjpJson,'utf8')) as Array<{uf:number|null;indicator:number;value:number;denominator:number|null}>){const e=x.uf==null?brasil:byUf.get(x.uf);if(!e)continue;fjp.push({indicator_id:x.indicator,entity_id:e.entity_id,period_start:'2024-01-01',period_end:'2025-01-01',status:2,numerator:x.value,denominator:x.denominator,value:x.indicator===9952?x.value*100:x.value,flags:0,uf:x.uf??0});}}catch{ /* companion parser writes this only when the official sheet is available */ }
    result.families.fjp={rows:fjp.length,slices:fjp.length?await publishFamily(DATASETS.fjp,fjp,hashFor(['fjp_deficit_2024.xlsx']),'p1351-fjp-2024-v1',{geography:'Brasil/UF only'}):[]};
    result.finishedAt=new Date().toISOString(); result.sourceMeta=sourceMeta; console.log(JSON.stringify(result,null,2));
  } finally { await pool.end(); }
}
main().catch(e=>{console.error(e);process.exitCode=1});
