import { applyExecMigrations } from '../../packages/db/src/exec/migrations.ts';
import { openPool } from './db.ts';

const p = openPool(1);
try { console.log(await applyExecMigrations(p)); } finally { await p.end(); }
