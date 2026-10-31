import { openPool } from './db.ts';
import { applyExecMigrations } from '../../packages/db/src/exec/index.ts';
const p=openPool(1); try { console.log(await applyExecMigrations(p)); } finally { await p.end(); }
