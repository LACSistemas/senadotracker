import { seedIndicatorDefs } from '../../packages/db/src/exec/index.ts';
import { openPool } from './db.ts';
const pool = openPool(2);
try { console.log('definições de indicadores gravadas:', await seedIndicatorDefs(pool)); } finally { await pool.end(); }
