import fs from 'node:fs'; for (const line of fs.readFileSync('.env','utf8').split(/\r?\n/)) { const i=line.indexOf('='); if(i>0 && !line.startsWith('#')) process.env[line.slice(0,i)]=line.slice(i+1); }
import { operationCosts } from '../apps/web/lib/data-postgres-wave4.ts'; for (const s of ['camara','senado']) console.log(s, await operationCosts(s,2026,'batch'));
