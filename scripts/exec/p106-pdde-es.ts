import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { openPool } from './db.ts';
import { publishSlice, sha256, SPECS, applyExecMigrations, type Row } from '../../packages/db/src/exec/index.ts';
import { storageConfig, fetchRaw, assertPgHeadroom, recordManifest, runPython } from '../../apps/collector/src/exec/storage.ts';

const cfg = storageConfig(); const pool = openPool(3); const stage = join(cfg.stagingDir, 'p106'); await mkdir(stage, { recursive: true });
const q = async (sql: string, args: unknown[] = []) => (await pool.query(sql, args)).rows;
const entities = await q("select ibge7 from civica_exec.exec_entity where kind=4 and uf_code=32 order by ibge7");
const municipalities = (process.env.P106_PDDE_CODES ? process.env.P106_PDDE_CODES.split(',') : entities.map(r => String(r.ibge7).slice(0, 6)));
const files: Array<{ code: string; path: string; sha: string; url: string }> = []; const failures: Array<{ code: string; error: string }> = [];
for (const code of municipalities) {
  await assertPgHeadroom(cfg);
  const url = `https://www.fnde.gov.br/pddeinfo/pddeinfo/escola/excelall?ano=2025&SG_UF=ES&CO_MUNICIPIO_FNDE=${code}`;
  const rel = `federal/pdde/pdde_excelall_2025_${code}.xlsx`;
  try {
    const e = await fetchRaw(cfg, { url, relPath: rel, competence: 202512, uf: 32, retention: 2, dataset: 'p106-pdde-info', userAgent: 'Mozilla/5.0', accept: h => h.subarray(0, 2).toString('ascii') === 'PK', retries: 2 });
    await recordManifest(pool, e); files.push({ code, path: join(cfg.rawDir, rel), sha: e.sha256, url });
  } catch (err) { failures.push({ code, error: String(err).slice(0, 250) }); }
}
console.log(JSON.stringify({ phase: 'downloads', municipalities: municipalities.length, downloaded: files.length, failures: failures.length }));
if (failures.length) { console.log(JSON.stringify({ status: 'SOURCE_INCOMPLETE_LAST_KNOWN_GOOD_RETAINED', municipalities: municipalities.length, downloaded: files.length, failures }, null, 2)); await pool.end(); process.exit(0); }
const all: Row[] = [];
for (const f of files) {
  const out = join(stage, `pdde-2025-${f.code}.jsonl`); const p = await runPython('scripts/exec/p106_pdde_extract.py', [f.path, out]); if (p.code !== 0) throw new Error(p.err || p.out);
  const raw = (await readFile(out, 'utf8')).split('\n').filter(Boolean).map(x => JSON.parse(x) as Row); const schools = [...new Set(raw.map(r => Number(r.school_inep)).filter(Number.isInteger))];
  const known = new Set((await q('select inep from civica_exec.exec_edu_school where inep = any($1::int[])', [schools])).map(r => Number(r.inep)));
  raw.forEach((r, i) => all.push({ source_key: `pdde:2025:${f.code}:${String(r.raw_id)}:${i}`, source_dataset: 'pdde_info', competence: 202512, year: 2025, month: null, program_code: 'PDDE', program_name: String(r.destination ?? 'PDDE'), financial_stage: String(r.financial_stage), amount_cents: Number(r.amount_cents), uf: 32, municipality_siafi: f.code, beneficiary_type: 'SCHOOL', beneficiary_code: r.school_inep, beneficiary_name: r.school_name ?? null, entity_id: null, school_inep: known.has(Number(r.school_inep)) ? Number(r.school_inep) : null, uex_cnpj: r.uex_cnpj ?? null, eex_cnpj: r.eex_cnpj ?? null, action: '0515', plan: null, source_status: r.status ?? null, raw_id: r.raw_id, source_url: f.url, raw_sha256: Buffer.from(f.sha, 'hex'), provenance: { municipality_name: r.municipality_name, unresolved_school: !known.has(Number(r.school_inep)), destination: r.destination, cadastro_status: r.cadastro_status } }));
}
console.log(JSON.stringify({ phase: 'parsed', files: files.length, rows: all.length }));
if (process.env.P106_PDDE_DRY === '1') { console.log(JSON.stringify({ status: 'DRY_RUN', files: files.length, rows: all.length })); await pool.end(); process.exit(0); }
all.sort((a, b) => String(a.source_key).localeCompare(String(b.source_key)));
const result = await publishSlice(pool, { datasetId: 113, uf: 32, competence: 202512, bootstrap: true, sourceHash: sha256(JSON.stringify(all.map(r => [r.source_key, r.amount_cents, r.financial_stage]))), parserVersion: 'p106-pdde-v1', tables: [{ spec: SPECS.edu_program_pdde, rows: all }], inputs: { provider: 'FNDE PDDE Info', year: 2025, uf: 'ES', municipalities: municipalities.length }, quality: { sourceRows: all.length, parsedRows: all.length, sourceFiles: files.length, knownSchools: all.filter(r => r.school_inep !== null).length } });
await pool.query(`INSERT INTO civica_exec.exec_edu_program_cov (source_dataset,competence,uf,program_code,status,source_rows,parsed_rows,published_rows,rejected_rows,unresolved_school_rows,source_hash,notes) VALUES ('pdde_info',202512,32,'PDDE',$1,$2,$2,$3,0,$4,$5,$6::jsonb) ON CONFLICT (source_dataset,competence,uf,program_code) DO UPDATE SET status=EXCLUDED.status,source_rows=EXCLUDED.source_rows,parsed_rows=EXCLUDED.parsed_rows,published_rows=EXCLUDED.published_rows,unresolved_school_rows=EXCLUDED.unresolved_school_rows,source_hash=EXCLUDED.source_hash,notes=EXCLUDED.notes`, [result.status, all.length, all.length, all.filter(r => r.school_inep === null).length, sha256(JSON.stringify(all.map(r => r.source_key))), JSON.stringify({ scope: 'ES all municipalities 2025', files: files.length })]);
console.log(JSON.stringify({ result, municipalities: municipalities.length, files: files.length, rows: all.length, schools: new Set(all.map(r => r.school_inep).filter(x => x !== null)).size }, null, 2)); await pool.end();
