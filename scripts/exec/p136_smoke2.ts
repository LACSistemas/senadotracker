import {openPool} from './db.ts';
import {getInfrastructureOverview,getInfrastructureIndicators,getInfrastructureIndicatorDetail,getInfrastructureWorksOverview,getInfrastructureWorksList,getInfrastructureWorkDetail,getInfrastructureWorkFinancialEvidence,getInfrastructureFacilities,getInfrastructureLogistics,getInfrastructureCoverage} from '../../packages/db/src/exec/index.ts';
const p=openPool(2);
async function run(name:string,fn:()=>Promise<any>){const t=Date.now();try{const x=await fn();console.log(name,JSON.stringify({ms:Date.now()-t,summary:Array.isArray(x)?{rows:x.length,first:x[0]}:x&&typeof x==='object'?{keys:Object.keys(x),projects:x.projects,total:x.total,kpis:x.editorialKpis?.length}:x},null,2))}catch(e){console.log(name,'ERROR',String(e))}}
await run('overview_vitoria',()=>getInfrastructureOverview(p,{level:'MUNICIPIO',ibge7:'3205309'}));
await run('overview_es',()=>getInfrastructureOverview(p,{level:'UF',ufCode:32}));
await run('overview_br',()=>getInfrastructureOverview(p,{level:'BRASIL'}));
await run('indicators_vitoria',()=>getInfrastructureIndicators(p,{level:'MUNICIPIO',ibge7:'3205309'},{limit:8}));
await run('detail_vitoria',()=>getInfrastructureIndicatorDetail(p,{level:'MUNICIPIO',ibge7:'3205309'},'INF-INTERNET-DOMICILIOS'));
await run('works_vitoria',()=>getInfrastructureWorksOverview(p,{level:'MUNICIPIO',ibge7:'3205309'}));
await run('works_list_br',()=>getInfrastructureWorksList(p,{level:'BRASIL'},{page:1,pageSize:5}));
await run('work_detail_contracts',()=>getInfrastructureWorkDetail(p,89442));
await run('work_finance',()=>getInfrastructureWorkFinancialEvidence(p,102404,1,10));
await run('facilities_br',()=>getInfrastructureFacilities(p,{level:'BRASIL'},undefined,1,5));
await run('logistics_es',()=>getInfrastructureLogistics(p,{level:'UF',ufCode:32}));
await run('coverage_br',()=>getInfrastructureCoverage(p,{level:'BRASIL'}));
await p.end();
