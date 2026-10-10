import pg from 'pg';
import { mirrorPendingPortraits, listPortraitSources } from '@senadotracker/db';

/**
 * Baixa e reduz os retratos oficiais para data/portraits (ou PORTRAIT_DIR). Idempotente: só busca o que falta ou está velho.
 * Uso: npm run portraits:mirror [-- --all] [-- --limit 50]   (--all ignora a idade e revalida tudo)
 */
const args = process.argv.slice(2), all = args.includes('--all'), limitArg = args.indexOf('--limit');
const pool = new pg.Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 5432), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, max: 4 });
try {
  const sources = await listPortraitSources(pool);
  console.log(`retratos em uso: ${sources.length}`);
  const result = await mirrorPendingPortraits(pool, { allSources: sources, ...(all ? { staleDays: 0 } : {}), ...(limitArg >= 0 ? { limit: Number(args[limitArg + 1]) } : {}) });
  console.log(JSON.stringify({ ...result, errors: result.errors.slice(0, 10), errorCount: result.errors.length }, null, 2));
} finally { await pool.end(); }
