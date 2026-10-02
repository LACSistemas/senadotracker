import fs from 'node:fs'; for(const line of fs.readFileSync('.env','utf8').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)process.env[m[1]]=m[2];}
import {houseListing,legislativeOverview,rankingsDashboard,stateRepresentation,homeHighlights} from '../apps/web/lib/data-postgres-wave4.ts';
import {profileFull} from '../apps/web/lib/data-postgres.ts';
for(const [name,fn] of Object.entries({houseListing:()=>houseListing('senado',{page:1,pageSize:2}),overview:()=>legislativeOverview({}),rank:()=>rankingsDashboard({page:1,pageSize:2}),state:()=>stateRepresentation('MT'),home:()=>homeHighlights()})){try{const x:any=await (fn as any)(); console.log(name,JSON.stringify(x.data??x,null,2).slice(0,7000));}catch(e){console.error(name,e);}}
try{const x:any=await profileFull('senado','1173');console.log('profileFull',JSON.stringify(x.data??x,null,2).slice(0,9000));}catch(e){console.error('profileFull',e)}
