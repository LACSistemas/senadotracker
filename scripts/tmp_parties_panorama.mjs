import fs from 'node:fs'; import {openDatabase} from '@senadotracker/db'; import {publishedPartyPanorama} from '../packages/db/src/parties.ts';
for(const l of fs.readFileSync('.env','utf8').split(/\r?\n/)){const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(m)process.env[m[1]]=m[2];}
const db=openDatabase('data/senadotracker.sqlite',true); const s=publishedPartyPanorama(db,'all',2026); const {parties}=await import('../apps/web/lib/data-postgres.ts'); const p=(await parties('all',2026)).data; console.log('SQL',JSON.stringify(s.rows,null,2)); console.log('PG',JSON.stringify(p.panorama.rows,null,2));
