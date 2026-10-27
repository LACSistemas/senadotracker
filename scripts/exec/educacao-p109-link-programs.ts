import { openPool } from './db.ts';
import { applyExecMigrations } from '../../packages/db/src/exec/migrations.ts';
import { refreshEducationProgramRollup } from '../../packages/db/src/exec/educacao-analytics-materialize.ts';

const p = openPool(4);
const norm = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
try {
  await applyExecMigrations(p);
  const c = await p.connect();
  try {
    await c.query('BEGIN');
    const facts = (await c.query(`SELECT DISTINCT source_dataset,year,uf,municipality_siafi,provenance->>'municipality_name' source_name FROM civica_exec.exec_edu_program_fact WHERE source_dataset='portal_transferencias' AND municipality_siafi IS NOT NULL`)).rows;
    const entities = (await c.query(`SELECT entity_id,ibge7,uf_code,name FROM civica_exec.exec_entity WHERE kind=4`)).rows;
    const by = new Map<string, any[]>(); for (const e of entities) { const k = `${e.uf_code}|${norm(e.name)}`; by.set(k, [...(by.get(k) ?? []), e]); }
    let linked = 0, unresolved = 0, ambiguous = 0;
    for (const f of facts) {
      const candidates = by.get(`${f.uf}|${norm(f.source_name)}`) ?? [];
      const status = candidates.length === 1 ? 'LINKED' : candidates.length > 1 ? 'AMBIGUOUS' : 'UNRESOLVED';
      const entityId = candidates.length === 1 ? Number(candidates[0].entity_id) : null;
      await c.query(`INSERT INTO civica_exec.exec_edu_program_municipality_map(source_dataset,year,uf,municipality_siafi,entity_id,source_name,status,method,evidence)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(source_dataset,year,uf,municipality_siafi) DO UPDATE SET entity_id=excluded.entity_id,source_name=excluded.source_name,status=excluded.status,method=excluded.method,evidence=excluded.evidence`,
        [f.source_dataset, f.year, f.uf, f.municipality_siafi, entityId, f.source_name ?? '', status, 'EXACT_SOURCE_NAME_UF_UNIQUE', JSON.stringify({ source: 'Portal transferencias', year: f.year, rule: 'normalized exact name + UF; no fuzzy matching' })]);
      if (entityId) { linked++; await c.query(`UPDATE civica_exec.exec_edu_program_fact SET entity_id=$1 WHERE source_dataset=$2 AND year=$3 AND uf=$4 AND municipality_siafi=$5 AND entity_id IS NULL`, [entityId, f.source_dataset, f.year, f.uf, f.municipality_siafi]); }
      else if (status === 'AMBIGUOUS') ambiguous++; else unresolved++;
    }
    await c.query('COMMIT');
    const counts = (await p.query(`SELECT status,count(*)::int n FROM civica_exec.exec_edu_program_municipality_map GROUP BY status ORDER BY status`)).rows;
    const rowsBefore = Number((await p.query(`SELECT count(*)::int n FROM civica_exec.exec_edu_program_fact WHERE source_dataset='portal_transferencias'`)).rows[0].n);
    const amount = (await p.query(`SELECT coalesce(sum(amount_cents),0)::bigint n FROM civica_exec.exec_edu_program_fact WHERE source_dataset='portal_transferencias'`)).rows[0].n;
    const refresh = await refreshEducationProgramRollup(p);
    console.log(JSON.stringify({ mappingRows: facts.length, linked, unresolved, ambiguous, counts, sourceRows: rowsBefore, sourceAmountCents: String(amount), refresh }, null, 2));
  } catch (e) { try { await c.query('ROLLBACK'); } catch {} throw e; } finally { c.release(); }
} finally { await p.end(); }
