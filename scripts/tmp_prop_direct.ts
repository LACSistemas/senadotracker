import fs from 'node:fs'; for (const line of fs.readFileSync('.env','utf8').split(/\r?\n/)) { const i=line.indexOf('='); if(i>0&&!line.startsWith('#')) process.env[line.slice(0,i)]=line.slice(i+1); }
const d=await import('../apps/web/lib/data-postgres.ts'); const x=await d.propositionListing({year:2026,page:1,pageSize:20}); console.log(JSON.stringify(x.data.dashboard.houses,null,2));
