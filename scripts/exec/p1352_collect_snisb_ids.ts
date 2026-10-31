import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const ROOT='D:/Civica/raw/infraestrutura/recursos_hidricos/snisb';
const base='https://www.snirh.gov.br/arcgis/rest/services/IG/SNISB/FeatureServer/0';
async function get(url:string){for(let i=0;i<3;i++){try{const r=await fetch(url,{signal:AbortSignal.timeout(60000)});if(r.ok)return await r.json() as any;}catch{} await new Promise(r=>setTimeout(r,1500*(i+1)));}throw Error(url)}
await mkdir(ROOT,{recursive:true});
const ids=(await get(`${base}/query?where=1%3D1&returnIdsOnly=true&f=json`)).objectIds as number[];
ids.sort((a,b)=>a-b);
const pages:any[]=[];
for(let i=0;i<ids.length;i+=500){const chunk=ids.slice(i,i+500);const q=new URLSearchParams({objectIds:chunk.join(','),outFields:'*',returnGeometry:'true',f:'json'});const u=`${base}/query?${q}`;const d=await get(u);const path=`${ROOT}/ids-page-${String(pages.length+1).padStart(3,'0')}.json`;const body=JSON.stringify(d);await writeFile(path,body);pages.push({url:u,path,rows:d.features?.length??0,sha256:createHash('sha256').update(body).digest('hex')});}
const manPath='D:/Civica/raw/infraestrutura/recursos_hidricos/collection-manifest.json';const m=JSON.parse(await readFile(manPath,'utf8'));m.snisb={total:ids.length,method:'returnIdsOnly+objectIds',pages};m.finishedAt=new Date().toISOString();m.manifestSha256=createHash('sha256').update(JSON.stringify(m)).digest('hex');await writeFile(manPath,JSON.stringify(m,null,2));console.log(JSON.stringify({total:ids.length,pages:pages.length},null,2));
