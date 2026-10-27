import { openPool } from './db.ts';
import { applyExecMigrations } from '../../packages/db/src/exec/migrations.ts';
import { refreshEducationProgramRollup } from '../../packages/db/src/exec/educacao-analytics-materialize.ts';
const p = openPool(4);
const norm = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
try {
  await applyExecMigrations(p);
  const facts = (await p.query(`SELECT DISTINCT source_dataset,year,uf,municipality_siafi,provenance->>'municipality_name' source_name FROM civica_exec.exec_edu_program_fact WHERE source_dataset='portal_transferencias' AND municipality_siafi IS NOT NULL`)).rows;
  const entities = (await p.query(`SELECT entity_id,ibge7,uf_code,name FROM civica_exec.exec_entity WHERE kind=4`)).rows;
  const by = new Map<string, any[]>(); for (const e of entities) { const k = `${e.uf_code}|${norm(e.name)}`; by.set(k, [...(by.get(k) ?? []), e]); }
  const rows = facts.map(f => { const c = by.get(`${f.uf}|${norm(f.source_name)}`) ?? []; return { ...f, entity_id: c.length === 1 ? Number(c[0].entity_id) : null, status: c.length === 1 ? 'LINKED' : c.length > 1 ? 'AMBIGUOUS' : 'UNRESOLVED' }; });
  const c = await p.connect();
  try {
    await c.query(`CREATE INDEX IF NOT EXISTS exec_edu_program_fact_municipality_map_idx ON civica_exec.exec_edu_program_fact(source_dataset,year,uf,municipality_siafi) WHERE municipality_siafi IS NOT NULL`);
    await c.query('BEGIN');
    for (let i = 0; i < rows.length; i += 400) {
      const part = rows.slice(i, i + 400); const vals: unknown[] = []; const marks = part.map((r, j) => { const b=j*9; vals.push(r.source_dataset,r.year,r.uf,r.municipality_siafi,r.entity_id,r.source_name??'',r.status,'EXACT_SOURCE_NAME_UF_UNIQUE',JSON.stringify({source:'Portal transferencias',year:r.year,rule:'normalized exact name + UF; no fuzzy matching'})); return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9})`; }).join(',');
      await c.query(`INSERT INTO civica_exec.exec_edu_program_municipality_map(source_dataset,year,uf,municipality_siafi,entity_id,source_name,status,method,evidence) VALUES ${marks} ON CONFLICT(source_dataset,year,uf,municipality_siafi) DO UPDATE SET entity_id=excluded.entity_id,source_name=excluded.source_name,status=excluded.status,method=excluded.method,evidence=excluded.evidence`, vals);
    }
    await c.query('COMMIT');
  } catch (e) { try { await c.query('ROLLBACK'); } catch {} throw e; } finally { c.release(); }
  const refresh = await refreshEducationProgramRollup(p);
  const counts = (await p.query(`SELECT status,count(*)::int n FROM civica_exec.exec_edu_program_municipality_map GROUP BY status ORDER BY status`)).rows;
  const linkedFacts = Number((await p.query(`SELECT count(*)::int n FROM civica_exec.exec_edu_program_fact f JOIN civica_exec.exec_edu_program_municipality_map m ON m.source_dataset=f.source_dataset AND m.year=f.year AND m.uf=f.uf AND m.municipality_siafi=f.municipality_siafi WHERE f.source_dataset='portal_transferencias' AND m.status='LINKED'`)).rows[0].n);
  const municipalities = Number((await p.query(`SELECT count(DISTINCT entity_id)::int n FROM civica_exec.exec_edu_program_municipality_map WHERE status='LINKED'`)).rows[0].n);
  const amount = String((await p.query(`SELECT coalesce(sum(amount_cents),0)::bigint n FROM civica_exec.exec_edu_program_fact WHERE source_dataset='portal_transferencias'`)).rows[0].n);
  console.log(JSON.stringify({mappingRows: rows.length, counts, linkedFacts, municipalities, sourceAmountCents: amount, refresh}, null, 2));
} finally { await p.end(); }
