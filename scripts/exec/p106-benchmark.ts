import { writeFile, mkdir } from 'node:fs/promises';
import { openPool } from './db.ts';
const out = process.argv[2] ?? 'docs/executivo-collector-plan/educacao-p106-execucao/BENCHMARK_READ_MODELS_P106.json';
const p = openPool(2); const result: Record<string, unknown> = { generatedAt: new Date().toISOString(), database: (await p.query('select current_database() db,pg_database_size(current_database())::bigint bytes')).rows[0], queries: {} };
const qs: Record<string,string> = {
  program_summary: "select program_code,financial_stage,month,count(*)::int rows,sum(amount_cents)::bigint amount_cents from civica_exec.exec_edu_program_fact where year=2025 group by 1,2,3",
  municipal_transfer: "select uf,municipality_siafi,program_code,sum(amount_cents)::bigint amount_cents from civica_exec.exec_edu_program_fact where year=2025 and source_dataset='portal_transferencias' and program_code='0515' group by 1,2,3",
  pdde_school: "select school_inep,financial_stage,sum(amount_cents)::bigint amount_cents from civica_exec.exec_edu_program_fact where year=2025 and source_dataset='pdde_info' and school_inep is not null group by 1,2",
};
for (const [name, sql] of Object.entries(qs)) (result.queries as Record<string,unknown>)[name] = (await p.query(`explain (analyze,format json) ${sql}`)).rows[0]['QUERY PLAN'];
await p.end(); await mkdir(new URL('.', `file:///${out.replace(/\\/g,'/')}`).pathname, { recursive: true }).catch(() => undefined); await writeFile(out, JSON.stringify(result, null, 2)); console.log(out);
