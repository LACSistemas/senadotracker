import * as pg from '../apps/web/lib/data-postgres.ts';
const x=await pg.profileFull('camara','107283','overview',1); console.log(JSON.stringify(x.data?.participation));
