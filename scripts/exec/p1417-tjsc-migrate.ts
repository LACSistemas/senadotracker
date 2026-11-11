import { openPool } from './db.ts';

/** P14.17 — alarga `jud_supplier_payment` com `supplier_cnpj` (nullable, aditivo): o arquivo de
 * fornecedores do TJSC publica CNPJ real junto do credor (o do TJCE não publicava), vale preservar. */
const pool = openPool(2);
try {
  const db = (await pool.query<{ current_database: string }>('SELECT current_database()')).rows[0]?.current_database;
  if (db !== 'projetoeleitor_db') throw new Error(`DATABASE_GUARD failed: ${db}`);
  await pool.query(`ALTER TABLE civica_jud.jud_supplier_payment ADD COLUMN IF NOT EXISTS supplier_cnpj text`);
  console.log(JSON.stringify({ database: db, version: 'p14.17-tjsc-supplier-cnpj-v1', column: 'supplier_cnpj added to jud_supplier_payment' }));
} catch (e) { console.error(e); process.exitCode = 1 } finally { await pool.end() }
