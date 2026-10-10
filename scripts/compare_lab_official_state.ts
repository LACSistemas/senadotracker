import fs from 'node:fs';
import pg from 'pg';

const env: Record<string, string> = {};
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) { const m = line.match(/^\s*([^#=]+)=(.*)$/); if (m) env[m[1]!.trim()] = m[2]!.trim().replace(/^['"]|['"]$/g, ''); }
const base = { host: env.DB_HOST ?? 'localhost', port: Number(env.DB_PORT ?? 5432), user: env.DB_USER, password: env.DB_PASSWORD, connectionTimeoutMillis: 15_000 };
async function readDb(database: string) {
  const c = new pg.Client({ ...base, database }); await c.connect();
  try {
    const active = (await c.query(`SELECT house,domain,revision_id,activated_at FROM civica_state.active_publications ORDER BY house,domain`)).rows;
    const budget = (await c.query(`SELECT house,fiscal_year,domain,revision_id,activated_at FROM civica_state_budget.active_publications ORDER BY house,fiscal_year,domain`)).rows;
    const identity = (await c.query(`SELECT p.* FROM civica_state.persons p JOIN civica_state.active_publications ap ON ap.house=p.house AND ap.domain='identity' AND ap.revision_id=p.revision_id ORDER BY p.house,p.external_id`)).rows;
    const profile = (await c.query(`SELECT revision_id,house,external_id FROM civica_state.state_profile_metadata ORDER BY house,external_id`)).rows;
    const raw = (await c.query(`SELECT raw_id,house,provider,resource,sha256,octet_length(body)::bigint AS body_bytes FROM civica_state.raw_objects ORDER BY raw_id`)).rows;
    return { database, active, budget, identity, profile, raw };
  } finally { await c.end(); }
}
async function main() {
  const [lab, official] = await Promise.all([readDb('civica_postgres_lab'), readDb('projetoeleitor_db')]);
  const key = (x: any) => `${x.house}|${x.domain}|${x.revision_id}`;
  const activeDiff = [...lab.active.filter((x: any) => !official.active.some((y: any) => key(x) === key(y))), ...official.active.filter((x: any) => !lab.active.some((y: any) => key(x) === key(y)))];
  const budgetDiff = [...lab.budget.filter((x: any) => !official.budget.some((y: any) => `${y.house}|${y.fiscal_year}|${y.domain}|${y.revision_id}` === `${x.house}|${x.fiscal_year}|${x.domain}|${x.revision_id}`)), ...official.budget.filter((x: any) => !lab.budget.some((y: any) => `${y.house}|${y.fiscal_year}|${y.domain}|${y.revision_id}` === `${x.house}|${x.fiscal_year}|${x.domain}|${x.revision_id}`))];
  const identityOnlyLab = lab.identity.filter((x: any) => !official.identity.some((y: any) => `${y.house}|${y.external_id}` === `${x.house}|${x.external_id}`));
  const profileOnlyLab = lab.profile.filter((x: any) => !official.profile.some((y: any) => `${y.house}|${y.external_id}` === `${x.house}|${x.external_id}`));
  const rawOnlyLab = lab.raw.filter((x: any) => !official.raw.some((y: any) => y.raw_id === x.raw_id));
  const missingOfficialRows = { persons: [] as any[], partyMemberships: [] as any[], profileMetadata: [] as any[] };
  const driftRevisions = activeDiff.filter((x: any) => lab.active.some((y: any) => y.house === x.house && y.domain === x.domain && y.revision_id === x.revision_id)).map((x: any) => x.revision_id);
  const labClient = new pg.Client({ ...base, database: 'civica_postgres_lab' }); await labClient.connect();
  try {
    for (const revision of driftRevisions) {
      missingOfficialRows.persons.push(...(await labClient.query(`SELECT to_jsonb(p) AS row FROM civica_state.persons p WHERE p.revision_id=$1`, [revision])).rows.map((x: any) => x.row));
      missingOfficialRows.partyMemberships.push(...(await labClient.query(`SELECT to_jsonb(p) AS row FROM civica_state.party_memberships p WHERE p.revision_id=$1`, [revision])).rows.map((x: any) => x.row));
      missingOfficialRows.profileMetadata.push(...(await labClient.query(`SELECT to_jsonb(p) AS row FROM civica_state.state_profile_metadata p WHERE p.revision_id=$1`, [revision])).rows.map((x: any) => x.row));
    }
  } finally { await labClient.end(); }
  const rawClient = new pg.Client({ ...base, database: 'civica_postgres_lab' }); await rawClient.connect();
  let rawArchive: any[] = [];
  try {
    const ids = rawOnlyLab.map((x: any) => x.raw_id);
    rawArchive = (await rawClient.query(`SELECT raw_id,house,provider,resource,sha256,encode(convert_to(body,'UTF8'),'base64') AS body_base64 FROM civica_state.raw_objects WHERE raw_id=ANY($1::text[]) ORDER BY raw_id`, [ids])).rows;
  } finally { await rawClient.end(); }
  const out = { generatedAt: new Date().toISOString(), activeDiff, budgetDiff, labIdentityRows: lab.identity.length, officialIdentityRows: official.identity.length, identityOnlyLab, labProfileRows: lab.profile.length, officialProfileRows: official.profile.length, profileOnlyLab, rawOnlyLab, missingOfficialRows, rawArchive };
  fs.writeFileSync('artifacts/P26_1R_lab_official_state_compare.json', JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ activeDiff, budgetDiff, labIdentityRows: lab.identity.length, officialIdentityRows: official.identity.length, identityOnlyLab, profileOnlyLab, rawOnlyLab, driftRows: Object.fromEntries(Object.entries(missingOfficialRows).map(([k, v]) => [k, (v as any[]).length])), report: 'artifacts/P26_1R_lab_official_state_compare.json' }, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); });
