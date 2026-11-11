import { openPool } from './db.ts';
import { fetchHdiGlobal, writeHdiGlobal } from '../../apps/collector/src/hdi-global.ts';
import { fetchPisaAll, writePisa } from '../../apps/collector/src/pisa.ts';

const pool = openPool(1);
try {
  const hdi = await fetchHdiGlobal();
  console.log(`HDI global: ${hdi.length} pontos (Brasil/América do Sul/Mundo)`);
  await writeHdiGlobal(pool, hdi);

  const pisa = await fetchPisaAll();
  console.log(`PISA: ${pisa.length} pontos (3 disciplinas x 3 entidades)`);
  await writePisa(pool, pisa);
} finally {
  await pool.end();
}
