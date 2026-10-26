import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { openPool } from './db.ts';
import { applyExecMigrations, publishSlice, sha256, SPECS, type Row } from '../../packages/db/src/exec/index.ts';
import { storageConfig, fetchRaw, assertZipIntact, recordManifest, registerLocalRaw, runPython, assertPgHeadroom } from '../../apps/collector/src/exec/storage.ts';

const cfg = storageConfig();
const pool = openPool(3);
const ufCode: Record<string, number> = { AC:12, AL:27, AP:16, AM:13, BA:29, CE:23, DF:53, ES:32, GO:52, MA:21, MT:51, MS:50, MG:31, PA:15, PB:25, PR:41, PE:26, PI:22, RJ:33, RN:24, RS:43, RO:11, RR:14, SC:42, SP:35, SE:28, TO:17 };
const portalUrl = (ym: number) => `https://portaldatransparencia.gov.br/download-de-dados/transferencias/${ym}`;
const rawPortal = (ym: number) => `federal/transferencias/${ym}.zip`;
const staging = join(cfg.stagingDir, 'p106');
const q = async (sql: string, args: unknown[] = []) => (await pool.query(sql, args)).rows;
const lines = async (path: string) => (await readFile(path, 'utf8')).split('\n').filter(Boolean).map(x => JSON.parse(x) as Row);

function portalRows(raw: Row[], manifest: { sha256: string; url: string }, ym: number): Row[] {
  const seen = new Map<string, number>();
  const sorted = [...raw].sort((a, b) => String(a.raw_id).localeCompare(String(b.raw_id)));
  return sorted.map((r) => {
    const key = String(r.raw_id); const n = seen.get(key) ?? 0; seen.set(key, n + 1);
    const code = String(r.program_code); const value = Number(r.amount_cents);
    return {
      source_key: `portal:${ym}:${key}:${n}`, source_dataset: 'portal_transferencias', competence: ym, year: Math.floor(ym / 100), month: ym % 100,
      program_code: code, program_name: String(r.program_name ?? ''), financial_stage: 'TRANSFERRED', amount_cents: value,
      uf: ufCode[String(r.uf ?? '').toUpperCase()] ?? 0, municipality_siafi: r.municipality_siafi ?? null,
      beneficiary_type: r.beneficiary_type ?? null, beneficiary_code: r.beneficiary_code ?? null, beneficiary_name: r.beneficiary_name ?? r.municipality_name ?? null,
      entity_id: null, school_inep: null, uex_cnpj: null, eex_cnpj: null, action: code, plan: r.plan ?? null, source_status: r.transfer_type ?? null,
      raw_id: r.raw_id, source_url: manifest.url, raw_sha256: Buffer.from(manifest.sha256, 'hex'), provenance: { municipality_name: r.municipality_name ?? null, function: r.function, subfunction: r.subfunction, occurrence: r.occurrence },
    };
  });
}

async function publishPortal(ym: number): Promise<{ rows: number; status: string }> {
  const rel = rawPortal(ym); const e = await fetchRaw(cfg, { url: portalUrl(ym), relPath: rel, competence: ym, uf: 0, retention: 2, dataset: 'p106-portal-transferencias', userAgent: 'civica-exec/1.0 (dados abertos)', accept: h => h.subarray(0, 2).toString('ascii') === 'PK', retries: 3 });
  await assertZipIntact(cfg, rel); await recordManifest(pool, e);
  const out = join(staging, `portal-${ym}.jsonl`); await mkdir(staging, { recursive: true });
  const p = await runPython('scripts/exec/p106_portal_extract.py', [join(cfg.rawDir, rel), out]); if (p.code !== 0) throw new Error(p.err || p.out);
  const rows = portalRows(await lines(out), e, ym);
  const result = await publishSlice(pool, { datasetId: 112, uf: 0, competence: ym, bootstrap: true, sourceHash: sha256(JSON.stringify(rows.map(r => [r.source_key, r.amount_cents, r.program_code]))), parserVersion: 'p106-portal-v1', tables: [{ spec: SPECS.edu_program_portal, rows }], inputs: { provider: 'Portal da Transparência', resource: rel, programs: ['0515','00PI','0969','00SB'] }, quality: { sourceRows: rows.length, parsedRows: rows.length, programs: [...new Set(rows.map(r => r.program_code))] } });
  for (const code of ['0515','00PI','0969','00SB']) await pool.query(`INSERT INTO civica_exec.exec_edu_program_cov (source_dataset,competence,uf,program_code,status,source_rows,parsed_rows,published_rows,rejected_rows,source_hash,notes) SELECT 'portal_transferencias',$1::integer,0,$2,'PUBLISHED',count(*) FILTER (WHERE program_code=$2),count(*) FILTER (WHERE program_code=$2),count(*) FILTER (WHERE program_code=$2),0,$3,$4::jsonb FROM civica_exec.exec_edu_program_fact WHERE source_dataset='portal_transferencias' AND competence=$1::integer ON CONFLICT (source_dataset,competence,uf,program_code) DO UPDATE SET status=EXCLUDED.status,source_rows=EXCLUDED.source_rows,parsed_rows=EXCLUDED.parsed_rows,published_rows=EXCLUDED.published_rows,rejected_rows=EXCLUDED.rejected_rows,source_hash=EXCLUDED.source_hash,notes=EXCLUDED.notes`, [ym, code, e.sha256, JSON.stringify({ scope: 'funcao 12; source-native transferido' })]);
  return { rows: rows.length, status: result.status };
}

async function publishPdde(): Promise<{ rows: number; status: string }> {
  const path = join(cfg.rawDir, 'federal/pdde/pdde_excelall_2025_320035.xlsx');
  const e = await registerLocalRaw(cfg, { url: 'https://www.fnde.gov.br/pddeinfo/pddeinfo/escola/excelall?ano=2025&SG_UF=ES&CO_MUNICIPIO_FNDE=320035', relPath: 'federal/pdde/pdde_excelall_2025_320035.xlsx', competence: 202512, uf: 32, retention: 2, dataset: 'p106-pdde-info' });
  await recordManifest(pool, e); const out = join(staging, 'pdde-2025-320035.jsonl'); const p = await runPython('scripts/exec/p106_pdde_extract.py', [path, out]); if (p.code !== 0) throw new Error(p.err || p.out);
  const raw = await lines(out); const schoolCodes = [...new Set(raw.map(r => Number(r.school_inep)).filter(n => Number.isInteger(n)))];
  const known = new Set((await q('select inep from civica_exec.exec_edu_school where inep = any($1::int[])', [schoolCodes])).map(r => Number(r.inep)));
  const rows = raw.map((r, i) => ({ source_key: `pdde:2025:320035:${String(r.raw_id)}:${i}`, source_dataset: 'pdde_info', competence: 202512, year: 2025, month: null, program_code: 'PDDE', program_name: String(r.destination ?? 'PDDE'), financial_stage: String(r.financial_stage), amount_cents: Number(r.amount_cents), uf: 32, municipality_siafi: '320035', beneficiary_type: 'SCHOOL', beneficiary_code: r.school_inep, beneficiary_name: r.school_name ?? null, entity_id: null, school_inep: known.has(Number(r.school_inep)) ? Number(r.school_inep) : null, uex_cnpj: r.uex_cnpj ?? null, eex_cnpj: r.eex_cnpj ?? null, action: '0515', plan: null, source_status: r.status ?? null, raw_id: r.raw_id, source_url: e.url, raw_sha256: Buffer.from(e.sha256, 'hex'), provenance: { municipality_name: r.municipality_name, unresolved_school: !known.has(Number(r.school_inep)), destination: r.destination, cadastro_status: r.cadastro_status } }));
  const result = await publishSlice(pool, { datasetId: 113, uf: 32, competence: 202512, bootstrap: true, sourceHash: sha256(JSON.stringify(rows.map(r => [r.source_key, r.amount_cents, r.financial_stage]))), parserVersion: 'p106-pdde-v1', tables: [{ spec: SPECS.edu_program_pdde, rows }], inputs: { provider: 'FNDE PDDE Info', municipality: '320035', year: 2025 }, quality: { sourceRows: raw.length, parsedRows: rows.length, knownSchools: rows.filter(r => r.school_inep !== null).length } });
  await pool.query(`INSERT INTO civica_exec.exec_edu_program_cov (source_dataset,competence,uf,program_code,status,source_rows,parsed_rows,published_rows,rejected_rows,unresolved_school_rows,source_hash,notes) VALUES ('pdde_info',202512,32,'PDDE','PUBLISHED',$1,$2,$2,0,$3,$4,$5::jsonb) ON CONFLICT (source_dataset,competence,uf,program_code) DO UPDATE SET source_rows=EXCLUDED.source_rows,parsed_rows=EXCLUDED.parsed_rows,published_rows=EXCLUDED.published_rows,unresolved_school_rows=EXCLUDED.unresolved_school_rows,source_hash=EXCLUDED.source_hash,notes=EXCLUDED.notes`, [raw.length, rows.length, rows.filter(r => r.school_inep === null).length, e.sha256, JSON.stringify({ scope: 'ES municipality 320035 only; financial PDDE Info export' })]);
  return { rows: rows.length, status: result.status };
}


await applyExecMigrations(pool); await assertPgHeadroom(cfg);
const months = (process.env.P106_MONTHS ? process.env.P106_MONTHS.split(',').map(Number) : Array.from({ length: 12 }, (_, i) => 202501 + i));
const portal: Record<string, unknown> = {}; for (const ym of months) { portal[String(ym)] = await publishPortal(ym); }
const pdde = process.env.P106_SKIP_PDDE === '1' ? { rows: 0, status: 'SKIPPED' } : await publishPdde();
const totals = await q("select program_code,financial_stage,count(*)::int rows,sum(amount_cents)::bigint amount_cents,count(distinct beneficiary_code)::int beneficiaries,count(distinct school_inep)::int schools from civica_exec.exec_edu_program_fact group by 1,2 order by 1,2");
console.log(JSON.stringify({ database: (await q('select current_database() db,pg_database_size(current_database())::bigint bytes'))[0], portal, pdde, totals }, null, 2));
await pool.end();
