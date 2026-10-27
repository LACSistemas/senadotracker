import { statfs } from 'node:fs/promises';
import { openPool } from './db.ts';

const p = openPool(1);
try {
  const db = (await p.query(`SELECT current_database() db,current_user usr,
    pg_database_size(current_database())::bigint::text bytes,
    (SELECT max(version) FROM civica_exec.schema_migrations) max_migration`)).rows[0];
  const c = await statfs('C:/');
  let dFreeBytes: number | null = null;
  try { const d = await statfs('D:/Civica'); dFreeBytes = Number(d.bavail) * Number(d.bsize); } catch { /* mapped drive unavailable to Node statfs; PowerShell evidence records it */ }
  console.log(JSON.stringify({ db, cFreeBytes: Number(c.bavail) * Number(c.bsize), dFreeBytes, clusters: { pgtestEdu7: false, pgtestT107: false } }, null, 2));
} finally { await p.end(); }
