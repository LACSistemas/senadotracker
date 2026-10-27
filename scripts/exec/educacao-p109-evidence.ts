import { writeFile } from 'node:fs/promises';
import { openPool } from './db.ts';

const output = process.argv[2] ?? 'docs/executivo-collector-plan/educacao-p109-execucao/evidencias/p109_database.json';
const p = openPool(8);
try {
  const q = async (sql: string, args: unknown[] = []) => (await p.query(sql, args)).rows;
  const db = (await q(`SELECT current_database() database,current_user db_user,pg_database_size(current_database())::bigint database_bytes`))[0];
  const migration = (await q(`SELECT max(version)::int max_migration,count(*)::int migration_count FROM civica_exec.schema_migrations`))[0];
  const mapping = await q(`SELECT status,count(*)::int rows,count(DISTINCT entity_id)::int entities FROM civica_exec.exec_edu_program_municipality_map GROUP BY status ORDER BY status`);
  const facts = (await q(`SELECT count(*)::int source_rows,count(DISTINCT municipality_siafi)::int source_municipalities,sum(amount_cents)::bigint source_amount_cents,count(*) FILTER (WHERE municipality_siafi IS NOT NULL)::int rows_with_source_municipality FROM civica_exec.exec_edu_program_fact WHERE source_dataset='portal_transferencias'`))[0];
  const linked = (await q(`SELECT count(*)::int linked_rows,count(DISTINCT m.entity_id)::int linked_entities,sum(f.amount_cents)::bigint linked_amount_cents FROM civica_exec.exec_edu_program_fact f JOIN civica_exec.exec_edu_program_municipality_map m ON m.source_dataset=f.source_dataset AND m.year=f.year AND m.uf=f.uf AND m.municipality_siafi=f.municipality_siafi WHERE f.source_dataset='portal_transferencias' AND m.status='LINKED'`))[0];
  const rollup = (await q(`SELECT count(*)::int rows,count(DISTINCT scope_key)::int scopes,sum(amount_cents)::bigint amount_cents FROM civica_exec.exec_edu_program_rollup WHERE source_dataset='portal_transferencias'`))[0];
  const coverage = await q(`SELECT source_dataset,competence,status,source_rows,parsed_rows,published_rows,rejected_rows,unresolved_entity_rows,unresolved_school_rows FROM civica_exec.exec_edu_program_cov WHERE source_dataset='portal_transferencias' ORDER BY competence DESC LIMIT 24`);
  const result = { generatedAt: new Date().toISOString(), database: db, migration, mapping, facts, linked, rollup, coverage, rules: { linkage: 'EXACT_SOURCE_NAME_UF_UNIQUE', fuzzyMatching: false, unresolvedRemainNull: true, rawOnD: 'NOT_VERIFIABLE_FROM_CURRENT_SHELL' } };
  await writeFile(output, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally { await p.end(); }
