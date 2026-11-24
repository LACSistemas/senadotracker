// Cria o schema civica_analytics (se ainda não existir) e semeia/atualiza usuários do painel /admin.
// Credenciais NUNCA ficam hardcoded aqui (isso iria pro git) — passe por variáveis de ambiente na hora
// de rodar, uma por par email/senha: ADMIN_SEED_1_EMAIL, ADMIN_SEED_1_PASSWORD, ADMIN_SEED_2_EMAIL, ...
//   ADMIN_SEED_1_EMAIL=... ADMIN_SEED_1_PASSWORD=... node --import tsx scripts/admin-analytics-bootstrap.ts
import pg from 'pg';
import { ensureAnalyticsSchema, upsertAdminUser } from '../packages/db/src/postgres-analytics.ts';
import { hashPassword } from '../apps/web/lib/auth/password.ts';

const pool = new pg.Pool({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 5432), database: process.env.DB_NAME,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
});

function collectSeedsFromEnv(): Array<{ email: string; password: string }> {
  const seeds: Array<{ email: string; password: string }> = [];
  for (let i = 1; ; i++) {
    const email = process.env[`ADMIN_SEED_${i}_EMAIL`];
    const password = process.env[`ADMIN_SEED_${i}_PASSWORD`];
    if (!email || !password) break;
    seeds.push({ email, password });
  }
  return seeds;
}

async function main() {
  const seeds = collectSeedsFromEnv();
  if (!seeds.length) { console.error('Nenhum ADMIN_SEED_N_EMAIL/ADMIN_SEED_N_PASSWORD no ambiente. Nada feito.'); process.exit(1); }
  await ensureAnalyticsSchema(pool);
  for (const u of seeds) {
    await upsertAdminUser(pool, u.email, hashPassword(u.password));
    console.log(`OK: ${u.email}`);
  }
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
