import pg from 'pg';
import { refreshStateHouseStory } from '@senadotracker/db';

/**
 * Recalcula os agregados de leitura das páginas das Assembleias (civica_state_story.house_story).
 * Uso: npm run state:story -- [UF ...]   (sem argumentos: as 27 Casas). Idempotente; só lê civica_state.
 */
const HOUSES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];
const pool = new pg.Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 5432), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, max: 2 });
const targets = process.argv.slice(2).map(value => value.toUpperCase()).filter(value => HOUSES.includes(value));
try {
  for (const house of targets.length ? targets : HOUSES) {
    const result = await refreshStateHouseStory(pool, house);
    console.log(`${house} ${result.sections.join(',')} ${result.ms}ms`);
  }
} finally { await pool.end(); }
