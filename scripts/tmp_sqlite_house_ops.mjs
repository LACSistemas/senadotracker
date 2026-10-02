import fs from 'node:fs'; import path from 'node:path'; import {DatabaseSync} from 'node:sqlite';
const db=new DatabaseSync(path.join(process.cwd(),'data','senadotracker.sqlite')); const mod=await import('@senadotracker/db'); const x=mod.publishedHouseOperations(db,'senado',2026); console.log(JSON.stringify(x,null,2));
