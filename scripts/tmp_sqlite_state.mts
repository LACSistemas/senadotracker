import {openDatabase,publishedStateRepresentation} from '@senadotracker/db';
const db=openDatabase('data/senadotracker.sqlite',true);
const x=publishedStateRepresentation(db,'MT',2026);
console.log(x.senators.map((p:any)=>[p.externalId,p.name]));
console.log(x.deputies.map((p:any)=>[p.externalId,p.name]));
