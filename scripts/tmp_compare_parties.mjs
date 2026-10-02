import {openDatabase} from '@senadotracker/db'; import path from 'node:path'; import {parties as legacy} from '../packages/db/src/web-legacy-contract.ts'; import fs from 'node:fs';
for(const l of fs.readFileSync('.env','utf8').split(/\r?\n/)){const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(m)process.env[m[1]]=m[2];}
const db=openDatabase(path.join(process.cwd(),'data','senadotracker.sqlite'),true); const s=legacy('all',2026); console.error('S',JSON.stringify(s)); const sd=s.status==='available'?s.data:s; const g=(await import('../apps/web/lib/data-postgres.ts')).parties; const p=(await g('all',2026)).data; console.log(JSON.stringify({sql:{topics:sd.topics?.length,options:sd.voteOptions?.slice(0,3),vote:sd.vote?.parties},pg:{topics:p.topics?.length,options:p.voteOptions?.slice(0,3),vote:p.vote?.parties}},null,2));



