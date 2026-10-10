import type { Pool } from 'pg';
import { assertDatabaseTarget, type DatabaseQuery } from '../guards/database-guard.ts';
import { CONTROL_DOMAINS, type ControlDomain } from './contracts.ts';

export interface PreflightResult { readonly currentDatabase: string | null; readonly stateDependencies: Readonly<Record<string, boolean>>; readonly federalDependencies: Readonly<Record<string, boolean>>; readonly senateDependencies: Readonly<Record<string, boolean>>; readonly missingRequiredSchemas: readonly string[]; readonly routeReadiness: Readonly<Record<string, string>>; readonly classification: 'READY' | 'ENVIRONMENT_NOT_READY'; readonly productionUsedAsTest: false; readonly checks: Readonly<Record<string, string>>; }
const tableNames = ['civica_state.current_state_parliamentarians','civica_state.active_publications','civica_state_budget.active_publications'];
const legacyNames = ['civica.publication_batches','civica.active_publications','civica.profiles','civica.people'];

export async function runCrossStackPreflight(pool: Pick<Pool, 'query'>): Promise<PreflightResult> {
  const dbResult = await pool.query<{ current_database: string }>('SELECT current_database()'); const db = dbResult.rows[0]?.current_database ?? null;
  const query: DatabaseQuery = async (sql: string) => { const result = await pool.query(sql); return { rows: result.rows as unknown as readonly Record<string, unknown>[] }; };
  const expectedDatabase = process.env.CIVICA_CONTROL_PLANE_DATABASE ?? process.env.DB_NAME ?? 'projetoeleitor_db';
  await assertDatabaseTarget(query, { database: expectedDatabase, readOnly: true });
  const names = [...tableNames, ...legacyNames]; const rows = (await pool.query<{ name: string; present: boolean }>('SELECT name, to_regclass(name) IS NOT NULL AS present FROM unnest($1::text[]) AS t(name)', [names])).rows; const present = new Map(rows.map(row => [row.name, row.present]));
  const stateDependencies = Object.fromEntries(tableNames.map(name => [name, present.get(name) === true])); const federalDependencies = Object.fromEntries(legacyNames.map(name => [name, present.get(name) === true])); const senateDependencies = { ...federalDependencies };
  const missingRequiredSchemas = [...tableNames, ...legacyNames].filter(name => !present.get(name));
  const legacyReady = legacyNames.every(name => present.get(name)); const stateReady = tableNames.every(name => present.get(name));
  return { currentDatabase: db, stateDependencies, federalDependencies, senateDependencies, missingRequiredSchemas, routeReadiness: { state: stateReady ? 'READY' : 'ENVIRONMENT_NOT_READY', federal: legacyReady ? 'READY' : 'ENVIRONMENT_SCHEMA_BOUNDARY', senate: legacyReady ? 'READY' : 'ENVIRONMENT_SCHEMA_BOUNDARY' }, classification: stateReady && legacyReady ? 'READY' : 'ENVIRONMENT_NOT_READY', productionUsedAsTest: false, checks: { currentDatabase: db === expectedDatabase ? 'PASS' : 'FAIL', stateSchema: stateReady ? 'PASS' : 'FAIL', federalSchema: legacyReady ? 'PASS' : 'ENVIRONMENT_SCHEMA_BOUNDARY', senateSchema: legacyReady ? 'PASS' : 'ENVIRONMENT_SCHEMA_BOUNDARY', domainCoverage: String(CONTROL_DOMAINS.length) } };
}
