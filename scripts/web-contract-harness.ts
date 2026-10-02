export type ContractDiff = { equal: boolean; sqliteShape: unknown; postgresShape: unknown; differences: string[] };

export type PostgresProbe = {
  query: (sql: string, values?: readonly unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

/** Fails closed when a contract run is pointed at a non-Civica target database. */
export async function assertPostgresTarget(client: PostgresProbe, expectedDatabase = 'projetoeleitor_db') {
  const result = await client.query('SELECT current_database() AS database, current_schema() AS schema, current_setting(\'search_path\') AS search_path');
  const identity = result.rows[0];
  if (!identity || identity.database !== expectedDatabase) {
    throw new Error(`WRONG_POSTGRES_TARGET: expected=${expectedDatabase} actual=${String(identity?.database ?? 'unknown')}`);
  }
  return identity;
}

const shape = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value as object).sort().map(key => [key, shape((value as Record<string, unknown>)[key])]));
  return typeof value;
};

export function compareFacadeContracts(sqliteValue: unknown, postgresValue: unknown): ContractDiff {
  const sqliteShape = shape(sqliteValue), postgresShape = shape(postgresValue);
  const differences: string[] = [];
  const walk = (left: unknown, right: unknown, path: string) => {
    if (JSON.stringify(left) === JSON.stringify(right)) return;
    if (Array.isArray(left) || Array.isArray(right)) {
      if (!Array.isArray(left) || !Array.isArray(right)) { differences.push(path || '$'); return; }
      if (left.length !== right.length) differences.push(`${path || '$'}.length`);
      const length = Math.min(left.length, right.length);
      for (let index = 0; index < length; index += 1) walk(left[index], right[index], `${path || '$'}[${index}]`);
      return;
    }
    if (left && right && typeof left === 'object' && typeof right === 'object') {
      const keys = new Set([...Object.keys(left as object), ...Object.keys(right as object)]);
      for (const key of [...keys].sort()) walk((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key], `${path || '$'}.${key}`);
      return;
    }
    differences.push(path || '$');
  };
  walk(sqliteShape, postgresShape, '');
  return { equal: differences.length === 0, sqliteShape, postgresShape, differences };
}
