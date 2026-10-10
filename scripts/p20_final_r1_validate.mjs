import fs from 'node:fs';
import pg from 'pg';

const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter((line) => line.includes('=')).map((line) => line.split('=')));
Object.assign(process.env, env, { DB_NAME: 'civica_postgres_lab' });
const { loadStateActivity, explainStateProposalQuery } = await import('../apps/web/lib/state-activity.ts');

const pool = new pg.Pool({ host: env.DB_HOST, port: Number(env.DB_PORT), user: env.DB_USER, password: env.DB_PASSWORD, database: 'civica_postgres_lab', max: 4 });
const q = async (sql, values = []) => (await pool.query(sql, values)).rows;
const samples = {};
for (const house of ['ES', 'BA', 'GO', 'MA', 'MS', 'MT', 'PA', 'SE', 'CE', 'AP', 'RJ', 'RS', 'PB', 'AM', 'AC', 'RO']) {
  const rows = await q(`SELECT p.external_id::text AS id, count(a.proposal_external_id)::int AS authored
    FROM civica_state.current_state_parliamentarians p
    LEFT JOIN civica_state.active_publications ap ON ap.house=p.house AND ap.domain='legislative'
    LEFT JOIN civica_state.proposal_authors a ON a.house=p.house AND a.revision_id=ap.revision_id AND a.person_external_id::text=p.external_id::text
    WHERE p.house=$1 GROUP BY p.external_id ORDER BY authored DESC, p.external_id LIMIT 3`, [house]);
  samples[house] = rows.map((row) => row.id);
}
const result = { database: (await q('SELECT current_database()'))[0].current_database, samples: {}, queryPlan: null };
for (const [house, ids] of Object.entries(samples)) {
  result.samples[house] = [];
  for (const id of ids) {
    const activity = await loadStateActivity(house, id, 2026);
    result.samples[house].push({ id, found: Boolean(activity), proposalStatus: activity?.proposals.coverage.status ?? null, proposalTotal: activity?.proposals.total ?? null, authorshipRelations: activity?.proposals.authoredRelations ?? null, recentCount: activity?.proposals.recent.length ?? null, participation: Object.fromEntries(Object.entries(activity?.participation ?? {}).map(([key, value]) => [key, value.coverage.status])) });
  }
}
result.queryPlan = await explainStateProposalQuery(pool);
console.log(JSON.stringify(result, null, 2));
await pool.end();

