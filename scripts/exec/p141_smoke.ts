import { openPool } from './db.ts';
import { getCurrentExecutive } from '../../packages/db/src/exec/index.ts';
const pool = openPool(1);
for (const uf of ['ES', 'SP', 'DF']) {
  console.log(uf, JSON.stringify(await getCurrentExecutive(pool, uf), null, 2));
}
await pool.end();
