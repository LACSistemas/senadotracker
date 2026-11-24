import pg from 'pg';

// Pool pequeno e separado do pool principal de `data-postgres.ts`: tráfego de tracking/admin não deve
// disputar conexão com o tráfego público, e o volume aqui é baixo (poucas escritas por pageview, painel
// usado por 2 pessoas).
export const analyticsPool = new pg.Pool({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 5432), database: process.env.DB_NAME,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD, max: 5,
});
