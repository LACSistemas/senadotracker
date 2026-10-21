import pg from 'pg';

/** Carrega .env (sem sobrescrever o ambiente) e devolve o pool do banco do Cívica. O alvo pode ser trocado por EXEC_DATABASE_URL (ex.: banco de teste). */
export function openPool(max = 4): pg.Pool {
  try { (process as unknown as { loadEnvFile?: (p?: string) => void }).loadEnvFile?.('.env'); } catch { /* sem .env */ }
  if (process.env.EXEC_DATABASE_URL) return new pg.Pool({ connectionString: process.env.EXEC_DATABASE_URL, max });
  return new pg.Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 5432), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, max });
}
export async function getJson<T>(url: string, tries = 4): Promise<T> {
  let last: unknown;
  for (let n = 1; n <= tries; n++) {
    try { const r = await fetch(url, { headers: { 'User-Agent': 'civica-exec/1.0 (pesquisa de dados abertos)' } }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return await r.json() as T; }
    catch (e) { last = e; await new Promise(r => setTimeout(r, 800 * n)); }
  }
  throw new Error(`falha ao obter ${url}: ${last instanceof Error ? last.message : String(last)}`);
}
