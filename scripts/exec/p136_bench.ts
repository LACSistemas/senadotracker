import {openPool} from './db.ts';
import {getInfrastructureOverview,getInfrastructureWorkDetail,getInfrastructureWorkFinancialEvidence,getInfrastructureWorksList,getInfrastructureCoverage,getInfrastructureIndicatorDetail} from '../../packages/db/src/exec/index.ts';
const pool=openPool(4);
const small=String((await pool.query("select territory_key from civica_exec.exec_work_territory_rollup where territory_level='MUNICIPIO' order by project_count,territory_key limit 1")).rows[0].territory_key);
const cases:any[]=[
 ['overview_municipio_vitoria',(q:any)=>getInfrastructureOverview(q,{level:'MUNICIPIO',ibge7:'3205309'})],
 ['overview_municipio_sao_paulo',(q:any)=>getInfrastructureOverview(q,{level:'MUNICIPIO',ibge7:'3550308'})],
 ['overview_municipio_small',(q:any)=>getInfrastructureOverview(q,{level:'MUNICIPIO',ibge7:small})],
 ['overview_uf_es',(q:any)=>getInfrastructureOverview(q,{level:'UF',ufCode:32})],
 ['overview_brasil',(q:any)=>getInfrastructureOverview(q,{level:'BRASIL'})],
 ['work_detail_contract_rich',(q:any)=>getInfrastructureWorkDetail(q,89442)],
 ['work_detail_commitment_rich',(q:any)=>getInfrastructureWorkDetail(q,102404)],
 ['work_detail_multiterritory',(q:any)=>getInfrastructureWorkDetail(q,1963)],
 ['work_financial_evidence',(q:any)=>getInfrastructureWorkFinancialEvidence(q,102404,1,100)],
 ['works_list_brasil',(q:any)=>getInfrastructureWorksList(q,{level:'BRASIL'},{page:1,pageSize:25})],
 ['coverage_brasil',(q:any)=>getInfrastructureCoverage(q,{level:'BRASIL'})],
 ['indicator_detail_vitoria',(q:any)=>getInfrastructureIndicatorDetail(q,{level:'MUNICIPIO',ibge7:'3205309'},'INF-INTERNET-DOMICILIOS')]
];
const out:any={generatedAt:new Date().toISOString(),smallMunicipality:small,cases:{}};
for(const [name,fn] of cases){const ms:number[]=[];const qcounts:number[]=[];let queries=0;let bytes=0;for(let i=0;i<10;i++){queries=0;const q={query:async(...args:any[])=>{queries++;return pool.query(...args)}};const t=performance.now();const value=await (fn as any)(q);ms.push(performance.now()-t);qcounts.push(queries);bytes=Buffer.byteLength(JSON.stringify(value));} const sorted=[...ms].sort((a,b)=>a-b); const pct=(p:number)=>sorted[Math.min(sorted.length-1,Math.ceil(p*sorted.length)-1)];out.cases[name]={runs:ms.length,p50Ms:Number(pct(.5).toFixed(2)),p95Ms:Number(pct(.95).toFixed(2)),maxMs:Number(Math.max(...ms).toFixed(2)),queryCount:{min:Math.min(...qcounts),max:Math.max(...qcounts)},payloadBytes:bytes}; console.log(name,out.cases[name]);}
await pool.end(); await import('node:fs/promises').then(fs=>fs.writeFile('p136_bench_out.json',JSON.stringify(out,null,2)));
