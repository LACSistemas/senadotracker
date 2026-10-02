import fs from 'node:fs'; for (const l of fs.readFileSync('.env','utf8').split(/\r?\n/)) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m) process.env[m[1]]=m[2]; }
import {houseListing} from '../apps/web/lib/data-postgres-wave4.ts';
const x=await houseListing('senado',{page:1,pageSize:1,sort:'name'}); console.log(Object.keys(x.data||{})); console.log(JSON.stringify(x.data,null,2).slice(0,12000));
