import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { getEducationOverview } from '../../packages/db/src/exec/index.ts';
import { openPool } from './db.ts';
const output = process.argv[2] ?? 'docs/executivo-collector-plan/educacao-p1091-execucao/evidencias/cache_cold_warm.json';
const rows=[];
for (const [name,key] of [['brazil',{}],['sp',{ufCode:35}],['sao_paulo',{ibge7:'3550308'}] ] as const) {
  const t0=performance.now(); const p=openPool(4); await p.query('SELECT 1'); const acquired=performance.now()-t0; const t1=performance.now(); const x=await getEducationOverview(p,key,2025); const cold=performance.now()-t1; const t2=performance.now(); await getEducationOverview(p,key,2025); const warm=performance.now()-t2; rows.push({name,poolAcquisitionMs:+acquired.toFixed(2),coldQueryMs:+cold.toFixed(2),warmQueryMs:+warm.toFixed(2),payloadBytesUtf8:Buffer.byteLength(JSON.stringify(x))}); await p.end();
}
const out={generatedAt:new Date().toISOString(),rows}; await writeFile(output,JSON.stringify(out,null,2)); console.log(JSON.stringify(out,null,2));
