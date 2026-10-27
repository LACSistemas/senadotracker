import type { Pool } from 'pg';

export async function getEducationProgramSummary(pool: Pool, year: number, programCode?: string) {
  const params: unknown[] = [year]; const where = programCode ? 'AND program_code = $2' : ''; if (programCode) params.push(programCode);
  return (await pool.query(`SELECT program_code, financial_stage, month, sum(rows)::int AS rows, sum(amount_cents)::bigint AS amount_cents, sum(beneficiaries)::int AS beneficiaries, sum(schools)::int AS schools FROM civica_exec.exec_edu_program_rollup WHERE scope=1 AND scope_key='BRASIL' AND year=$1 ${where} GROUP BY 1,2,3 ORDER BY 1,2,3`, params)).rows;
}

export async function getEducationProgramMunicipal(pool: Pool, year: number, programCode: string) {
  return (await pool.query(`SELECT e.uf_code::smallint AS uf, r.scope_key AS municipality_siafi, e.name AS municipality_name, r.financial_stage, sum(r.rows)::int AS rows, sum(r.amount_cents)::bigint AS amount_cents, sum(r.beneficiaries)::int AS beneficiaries FROM civica_exec.exec_edu_program_rollup r JOIN civica_exec.exec_entity e ON e.kind=4 AND e.ibge7=r.scope_key::int WHERE r.scope=4 AND r.year=$1 AND r.program_code=$2 AND r.source_dataset='portal_transferencias' GROUP BY 1,2,3,4 ORDER BY 1,2,4`, [year, programCode])).rows;
}

export async function getPddeSchools(pool: Pool, year: number, uf: number) {
  return (await pool.query(`SELECT school_inep, beneficiary_name AS school_name, financial_stage, count(*)::int AS rows, sum(amount_cents)::bigint AS amount_cents, count(DISTINCT uex_cnpj)::int AS uex_count FROM civica_exec.exec_edu_program_fact WHERE year=$1 AND uf=$2 AND source_dataset='pdde_info' AND school_inep IS NOT NULL GROUP BY 1,2,3 ORDER BY 1,3`, [year, uf])).rows;
}

export async function getEducationProgramCoverage(pool: Pool, year: number) {
  return (await pool.query(`SELECT source_dataset,competence,uf,program_code,status,source_rows,parsed_rows,published_rows,rejected_rows,unresolved_entity_rows,unresolved_school_rows,source_hash,notes FROM civica_exec.exec_edu_program_cov WHERE competence BETWEEN $1*100+1 AND $1*100+12 ORDER BY source_dataset,competence,uf,program_code`, [year])).rows;
}
