import fs from 'node:fs'; for(const line of fs.readFileSync('.env','utf8').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)process.env[m[1]]=m[2];}
import {houseListing,legislativeOverview} from '../apps/web/lib/data-postgres-wave4.ts';
const h=await houseListing('camara',{page:1,pageSize:1,sort:'name'}); const o=await legislativeOverview({page:1,pageSize:10});
console.log(JSON.stringify({houseOperations:h.data?.operations,agenda:h.data?.operations?.agendaCoverage,overviewProcessing:o.data?.processingTimes,overviewAgenda:o.data?.panoramas?.camara?.agendaCoverage},null,2));


