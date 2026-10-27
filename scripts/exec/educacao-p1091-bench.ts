import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { openPool } from './db.ts';
import { getEducationComparison, getEducationList, getEducationOverview, getEducationSection, getEducationSeries } from '../../packages/db/src/exec/index.ts';

const output = process.argv[2] ?? 'docs/executivo-collector-plan/educacao-p1091-execucao/BENCHMARK_READ_MODELS_P1091.json';
const reps = Math.max(100, Number(process.argv[3] ?? 100)); const p = openPool(12);
const pct = (xs: number[], p: number) => [...xs].sort((a,b)=>a-b)[Math.min(xs.length-1, Math.ceil(xs.length*p)-1)];
const size = (x: unknown) => Buffer.byteLength(JSON.stringify(x), 'utf8');
const scenarios: Array<{name:string; budgetMs:number; queries:number; work:()=>Promise<unknown>}> = [
  { name:'overview_brasil', budgetMs:150, queries:1, work:()=>getEducationOverview(p,{},2025) },
  { name:'overview_uf_sp', budgetMs:100, queries:1, work:()=>getEducationOverview(p,{ufCode:35},2025) },
  { name:'overview_municipio_grande', budgetMs:100, queries:1, work:()=>getEducationOverview(p,{ibge7:'3550308'},2025) },
  { name:'overview_municipio_pequeno', budgetMs:75, queries:1, work:()=>getEducationOverview(p,{ibge7:'3200201'},2025) },
  { name:'overview_escola_list', budgetMs:200, queries:1, work:()=>getEducationList(p,{ibge7:'3205309',limit:25}) },
  { name:'comparison_vitoria', budgetMs:100, queries:3, work:()=>getEducationComparison(p,'3205309',2025) },
  { name:'section_finance_sp', budgetMs:150, queries:1, work:()=>getEducationSection(p,{ufCode:35,section:'finance',year:2025}) },
  { name:'series_brasil', budgetMs:200, queries:1, work:()=>getEducationSeries(p,{indicator:'edu.enrollment.total',limit:25}) },
  { name:'section_programs_municipio', budgetMs:150, queries:1, work:()=>getEducationSection(p,{ibge7:'3550308',section:'programs',year:2025}) },
];
try {
  const result=[];
  for (const s of scenarios) { await s.work(); const times:number[]=[]; let payloadBytes=0; for(let i=0;i<reps;i++){const t=performance.now(); const x=await s.work(); times.push(performance.now()-t); payloadBytes=size(x);} result.push({name:s.name,budgetMs:s.budgetMs,queries:s.queries,repetitions:reps,p50Ms:+pct(times,.5).toFixed(2),p90Ms:+pct(times,.9).toFixed(2),p95Ms:+pct(times,.95).toFixed(2),p99Ms:+pct(times,.99).toFixed(2),maxMs:+Math.max(...times).toFixed(2),payloadBytesUtf8:payloadBytes,pass:pct(times,.95)<=s.budgetMs&&payloadBytes<=100000}); }
  const out={generatedAt:new Date().toISOString(),method:{repetitions:reps,warmup:1,cache:'warm',poolMax:12},scenarios:result,summary:{pass:result.every(x=>x.pass),failures:result.filter(x=>!x.pass).map(x=>x.name)}}; await writeFile(output,JSON.stringify(out,null,2)); console.log(JSON.stringify(out,null,2));
} finally { await p.end(); }
