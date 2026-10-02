import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
const root=process.cwd();
for(const line of fs.readFileSync(path.join(root,'.env'),'utf8').split(/\r?\n/)){const i=line.indexOf('=');if(i>0&&!line.startsWith('#')&&process.env[line.slice(0,i)]===undefined)process.env[line.slice(0,i)]=line.slice(i+1);}
process.env.PROPOSITIONS_PG_SHADOW_ENABLED='false'; process.env.SENADOTRACKER_DB_PATH=path.join(root,'data','senadotracker.sqlite');
const db=new DatabaseSync(process.env.SENADOTRACKER_DB_PATH,{readOnly:true});
const ufs=[...new Set(db.prepare(`SELECT json_extract(p.payload,'$.uf') uf FROM profiles p JOIN active_publications a ON a.batch_id=p.batch_id WHERE json_extract(p.payload,'$.uf') IS NOT NULL AND trim(json_extract(p.payload,'$.uf'))<>'' ORDER BY uf`).all().map(r=>String(r.uf).trim()))];
const legacy=await import('../packages/db/src/web-legacy-contract.ts'); const current=await import('../apps/web/lib/data.ts');
const unwrap=(v)=>v&&typeof v==='object'&&'data' in v?(v.data??{}):v??{};
const labels=(v)=>new Set((Array.isArray(v?.topics)?v.topics:[]).map(x=>String(x?.label??x?.name??x)).filter(Boolean));
const results=[];
for(const uf of ufs){let l,c,le,ce;try{l=unwrap(await legacy.stateRepresentation(uf));}catch(e){le=String(e)}try{c=unwrap(await current.stateRepresentation(uf));}catch(e){ce=String(e)}const ls=labels(l),cs=labels(c); results.push({uf,sqliteTopicCategories:ls.size,postgresTopicCategories:cs.size,onlySqlite:[...ls].filter(x=>!cs.has(x)).sort(),onlyPg:[...cs].filter(x=>!ls.has(x)).sort(),sqliteError:le,postgresError:ce,exact:!le&&!ce&&ls.size===cs.size&&[...ls].every(x=>cs.has(x))});console.log(JSON.stringify(results.at(-1)));}
db.close(); const report={generatedAt:new Date().toISOString(),database:process.env.DB_NAME,contract:'stateRepresentation',ufs:results,summary:{ufs:results.length,exact:results.filter(x=>x.exact).length,mismatches:results.filter(x=>!x.exact).length,errors:results.filter(x=>x.sqliteError||x.postgresError).length}}; fs.writeFileSync('artifacts/state-representation-all-ufs.json',JSON.stringify(report,null,2)+'\n'); console.log(JSON.stringify(report.summary,null,2));
