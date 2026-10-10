import fs from 'node:fs';
import pg from 'pg';

const env: Record<string, string> = {};
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^\s*([^#=]+)=(.*)$/);
  if (match) env[match[1]!.trim()] = match[2]!.trim().replace(/^['"]|['"]$/g, '');
}

const base = { host: env.DB_HOST ?? 'localhost', port: Number(env.DB_PORT ?? 5432), user: env.DB_USER, password: env.DB_PASSWORD, connectionTimeoutMillis: 15_000 };
const databases = ['civica_postgres_lab', 'projetoeleitor_db'];
type TableRow = { schema_name: string; table_name: string; relkind: string; estimated_rows: number; size_bytes: number };
type Snapshot = { database: string; currentUser: string; sizeBytes: number; tables: TableRow[]; counts: Record<string, number> };

async function snapshot(database: string): Promise<Snapshot> {
  const client = new pg.Client({ ...base, database });
  await client.connect();
  try {
    const proof = (await client.query<{ database: string; current_user: string; size_bytes: string }>(`SELECT current_database() AS database,current_user,pg_database_size(current_database())::bigint AS size_bytes`)).rows[0]!;
    const tables = (await client.query<TableRow>(`SELECT n.nspname AS schema_name,c.relname AS table_name,c.relkind,c.reltuples::bigint AS estimated_rows,pg_total_relation_size(c.oid)::bigint AS size_bytes FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p') AND n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_%' ORDER BY n.nspname,c.relname`)).rows;
    const counts: Record<string, number> = {};
    for (const table of tables) {
      const qualified = `"${table.schema_name.replaceAll('"', '""')}"."${table.table_name.replaceAll('"', '""')}"`;
      const row = (await client.query<{ n: string }>(`SELECT count(*)::bigint AS n FROM ${qualified}`)).rows[0]!;
      counts[`${table.schema_name}.${table.table_name}`] = Number(row.n);
    }
    return { database: proof.database, currentUser: proof.current_user, sizeBytes: Number(proof.size_bytes), tables, counts };
  } finally { await client.end(); }
}

async function main() {
  const [lab, official] = await Promise.all(databases.map(snapshot));
  const keys = [...new Set([...Object.keys(lab.counts), ...Object.keys(official.counts)])].sort();
  const tableDiffs = keys.map(key => ({ table: key, lab: lab.counts[key] ?? null, official: official.counts[key] ?? null, deltaLabMinusOfficial: (lab.counts[key] ?? 0) - (official.counts[key] ?? 0) })).filter(x => x.lab !== x.official);
  const result = {
    generatedAt: new Date().toISOString(),
    lab,
    official,
    checks: {
      officialDatabase: official.database === 'projetoeleitor_db',
      labDatabase: lab.database === 'civica_postgres_lab',
      tableCountLab: lab.tables.length,
      tableCountOfficial: official.tables.length,
      differingTableCounts: tableDiffs.length,
      labLargerTables: tableDiffs.filter(x => x.deltaLabMinusOfficial > 0).length,
      officialLargerTables: tableDiffs.filter(x => x.deltaLabMinusOfficial < 0).length,
    },
    tableDiffs,
  };
  fs.writeFileSync('artifacts/P26_1R_lab_removal_preflight.json', JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({
    checks: result.checks,
    labSizeBytes: lab.sizeBytes,
    officialSizeBytes: official.sizeBytes,
    labSizeGiB: +(lab.sizeBytes / 1024 ** 3).toFixed(3),
    officialSizeGiB: +(official.sizeBytes / 1024 ** 3).toFixed(3),
    differingTableCounts: tableDiffs.slice(0, 80),
    report: 'artifacts/P26_1R_lab_removal_preflight.json',
  }, null, 2));
}

main().catch(error => { console.error(error); process.exit(1); });
