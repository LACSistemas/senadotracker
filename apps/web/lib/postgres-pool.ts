import pg from 'pg';

let singleton: pg.Pool | undefined;
export function webPostgresPool(): pg.Pool {
  return singleton ??= new pg.Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: Number(process.env.DB_POOL_MAX ?? 10),
  });
}
