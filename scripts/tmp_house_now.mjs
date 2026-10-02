import fs from 'fs';for(const l of fs.readFileSync('.env','utf8').split(/\r?\n/)){const m=l.match(/^([A-Z0-9_]+)=(.*)$/);if(m)process.env[m[1]]=m[2];}
import {houseListing} from '../apps/web/lib/data-postgres-wave4.ts';
const x=(await houseListing('senado',{page:1,pageSize:10,sort:'name'})).data; console.log(JSON.stringify(x.result.items.map(i=>({id:i.externalId,name:i.name,cab:i.cabinetFinancialCents,period:i.cabinetPeriod,exp:i.expenseCents})),null,2));

