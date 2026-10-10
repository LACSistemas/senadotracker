import pg from 'pg';
import * as data from '../apps/web/lib/data-postgres.ts';

/** Compara os recortes anuais da UI (year = ano do número) com a data de apresentação. Somente leitura. */
const pool = new pg.Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
const ACTIVE = `JOIN civica_poc.active_publications ap ON ap.source=p.source AND ap.batch_id=p.batch_id`;
const SP = `extract(year from p.presented_at at time zone 'America/Sao_Paulo')`;
try {
  const bundle: any = (await data.propositionOperationalBundle(2026)).data;
  const sql = (await pool.query(`SELECT p.source, p.functional_group g,
      count(*) FILTER (WHERE p.year=2026)::int by_year, count(*) FILTER (WHERE ${SP}=2026)::int by_presented,
      count(*) FILTER (WHERE p.year IS NULL)::int year_zero, count(*) FILTER (WHERE p.year=2026 AND ${SP}<>2026)::int year_not_presented
    FROM civica_poc.proposals p ${ACTIVE} GROUP BY 1,2 ORDER BY 1,2`)).rows;
  const yearZero = (await pool.query(`SELECT p.type,count(*)::int n FROM civica_poc.proposals p ${ACTIVE} WHERE p.source='camara' AND p.year IS NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 12`)).rows;
  const yearsPresented = (await pool.query(`SELECT p.year,count(*)::int n FROM civica_poc.proposals p ${ACTIVE} WHERE p.source='camara' AND ${SP}=2026 AND p.year<>2026 GROUP BY 1 ORDER BY 2 DESC LIMIT 5`)).rows;
  const ov = bundle.overview;
  console.log(JSON.stringify({
    ui: { year: bundle.year, years: bundle.years, overviewKeys: Object.keys(ov), congressTotal: ov.congress?.total, views: Object.fromEntries(Object.entries(ov.views ?? ov).filter(([, v]: any) => v && typeof v === 'object' && 'total' in v).map(([k, v]: any) => [k, v.total])),
      flowUniverse: Object.fromEntries(Object.entries(bundle.flow ?? {}).map(([k, v]: any) => [k, v?.universe ?? v?.[0]?.universe ?? null])),
      rhythmPresentedTotals: Object.fromEntries(Object.entries(bundle.rhythm?.presented?.houses ?? {}).map(([k, v]: any) => [k, v.total])),
      rhythmEventsTotals: Object.fromEntries(Object.entries(bundle.rhythm?.events?.houses ?? {}).map(([k, v]: any) => [k, v.total])) },
    sqlByGroup: sql, yearZeroTypesCamara: yearZero, camaraPresented2026ButOtherYear: yearsPresented }));
} finally { await pool.end(); }
