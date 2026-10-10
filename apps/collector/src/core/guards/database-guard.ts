export interface DatabaseGuardOptions { readonly database: string; readonly host?: string; readonly readOnly?: boolean; }
export type DatabaseQuery = (sql: string) => Promise<{ rows: readonly Record<string, unknown>[] }>;
export async function assertDatabaseTarget(query: DatabaseQuery, options: DatabaseGuardOptions): Promise<void> { const row = (await query('SELECT current_database()')).rows[0]; const actual = String(row?.current_database ?? ''); if (actual !== options.database) throw new Error(`DATABASE_GUARD_ERROR expected=${options.database} actual=${actual}`); }
