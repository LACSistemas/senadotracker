import { openPool } from './db.ts';
import { getCurrentMayor } from '../../packages/db/src/exec/index.ts';
const pool = openPool(1);
// Vitória/ES, São Paulo/SP, Cachoeirinha/RS (eleição suplementar em 2026, substitui a ordinária anulada), Brasília/DF (sem prefeito)
for (const [name, entityId] of [['Vitória', 3205309], ['São Paulo', 3550308], ['Cachoeirinha', 4303103], ['Brasília', 5300108]] as const) {
  console.log(name, JSON.stringify(await getCurrentMayor(pool, entityId), null, 2));
}
await pool.end();
