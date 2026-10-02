import pg from 'pg';
import { collectExpensesPostgres, refreshSupplierDerivedPostgres, collectElectionsPostgres } from '../apps/collector/src/postgres-collector.ts';

const env = process.env;
const pool = new pg.Pool({ host: env.DB_HOST ?? 'localhost', port: Number(env.DB_PORT ?? 5432), database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD });
const target = (await pool.query<{ current_database: string }>('select current_database()')).rows[0]?.current_database;
if (target !== 'projetoeleitor_db') throw new Error(`Unexpected collector target: ${target ?? '<empty>'}`);
const finance = (await pool.query<{ source: string; max_year: number }>(`select source,max(year)::int as max_year from civica_finance_poc.active_expense_publications group by source order by source`)).rows;
const elections = (await pool.query<{ max_year: number }>(`select max(e.year)::int as max_year from civica_elections_poc.elections e join civica_elections_poc.active_electoral_publications a on a.election_id=e.id`)).rows[0]?.max_year ?? 2022;
await pool.end();

const source = (finance.find(row => row.source === 'camara') ?? finance[0])?.source as 'camara'|'senado'|undefined;
const expenseYear = Number((finance.find(row => row.source === source)?.max_year) ?? 2026);
if (!source) throw new Error('No active financial publication available');

const expense1 = await collectExpensesPostgres(source, expenseYear, { limit: 2, smoke: true });
const expense2 = await collectExpensesPostgres(source, expenseYear, { limit: 2, smoke: true });
const derived1 = await refreshSupplierDerivedPostgres();
const derived2 = await refreshSupplierDerivedPostgres();
const election1 = await collectElectionsPostgres(elections, { limit: 2, smoke: true });
const election2 = await collectElectionsPostgres(elections, { limit: 2, smoke: true });

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const report = {
  currentDatabase: target,
  p5: { source, year: expenseYear, first: expense1, retry: expense2, idempotent: same(expense1, expense2) },
  p5Derived: { first: derived1, retry: derived2, idempotent: same(derived1, derived2) },
  p6: { year: elections, first: election1, retry: election2, idempotent: same(election1, election2) },
  gates: {
    P5_COLLECTOR_SMOKE: expense1.status === 'published' && expense2.status === 'published' ? 'PASS' : 'FAIL',
    P5_IDEMPOTENCY: same(expense1, expense2) ? 'PASS' : 'FAIL',
    P5_DERIVED_REFRESH_POSTGRES_ONLY: derived1.deterministic && same(derived1, derived2) ? 'PASS' : 'FAIL',
    SUPPLIER_MARKET_ALL_POINTS_REFRESH_POSTGRES_ONLY: derived1.rowCount > 0 ? 'PASS' : 'FAIL',
    P6_COLLECTOR_SMOKE: election1.status === 'published' && election2.status === 'published' ? 'PASS' : 'FAIL',
    P6_IDEMPOTENCY: same(election1, election2) ? 'PASS' : 'FAIL',
  },
};
console.log(JSON.stringify(report, null, 2));
