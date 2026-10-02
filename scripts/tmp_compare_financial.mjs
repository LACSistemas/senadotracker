import fs from 'node:fs';
for(const line of fs.readFileSync('.env','utf8').split(/\r?\n/)){const i=line.indexOf('=');if(i>0)process.env[line.slice(0,i)]=line.slice(i+1)}
const legacy=await import('../packages/db/src/web-legacy-contract.ts');const current=await import('../apps/web/lib/data.ts');
const [a,b]=await Promise.all([legacy.partyDetail('PL',2026),current.partyDetail('PL',2026)]);
console.log(JSON.stringify({sqlite:a.data?.financial??a.financial,postgres:b.data?.financial??b.financial,sqliteStatus:a.status,postgresStatus:b.status},null,2));
