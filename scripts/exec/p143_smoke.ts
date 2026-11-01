import { openPool } from './db.ts';
import { getHdiSeries } from '../../packages/db/src/exec/index.ts';
const pool = openPool(1);
console.log('BRASIL', JSON.stringify(await getHdiSeries(pool, { level: 'BRASIL' })));
console.log('ES', JSON.stringify(await getHdiSeries(pool, { level: 'UF', ufCode: 32 })));
console.log('Vitória', JSON.stringify(await getHdiSeries(pool, { level: 'MUNICIPIO', ibge7: '3205309' })));
await pool.end();
