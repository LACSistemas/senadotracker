import { mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { Pool } from 'pg';
import type { PoolClient } from 'pg';
import { DATASET, FLAG, SPECS, publishSlice, sha256, upsertIndicators, ymDate, ymNext, type IndicatorRow, type PublishResult, type Row } from '@senadotracker/db';
import { assertCanDecode, fetchRaw, recordManifest, runPython, type StorageConfig } from './storage.ts';

export const UF_CODE: Record<string, number> = { RO: 11, AC: 12, AM: 13, RR: 14, PA: 15, AP: 16, TO: 17, MA: 21, PI: 22, CE: 23, RN: 24, PB: 25, PE: 26, AL: 27, SE: 28, BA: 29, MG: 31, ES: 32, RJ: 33, SP: 35, PR: 41, SC: 42, RS: 43, MS: 50, MT: 51, GO: 52, DF: 53 };
export type CnesKind = 'st' | 'lt' | 'eq' | 'pf';
const FTP = 'ftp://ftp.datasus.gov.br/dissemin/publicos/CNES/200508_/Dados';
const PY = 'scripts/exec/dbc_extract.py';
const aamm = (c: number) => `${String(Math.floor(c / 100) % 100).padStart(2, '0')}${String(c % 100).padStart(2, '0')}`;

/** ibge6 (CODUFMUN do DATASUS) → entity_id; inclui os códigos xx0000 ("município ignorado"). */
export async function loadEntityMap(pool: Pool): Promise<Map<string, number>> {
  const r = await pool.query(`SELECT code, entity_id FROM civica_exec.exec_entity_external_id WHERE source = 1 AND valid_to IS NULL`);
  return new Map(r.rows.map(x => [String(x.code), Number(x.entity_id)]));
}
/** IND-SAU-05 / 05S (leitos por 1.000 hab.), calculados dos intervalos vigentes na competência; mesma transação e mesmo run do fato. */
export async function deriveBeds(c: PoolClient, runId: number, ufCode: number, comp: number): Promise<number> {
  const year = Math.floor(comp / 100);
  const r = await c.query(`
    WITH ents AS (SELECT entity_id FROM civica_exec.exec_entity WHERE uf_code = $1 AND kind IN (3, 4, 5)),
    estab AS (SELECT DISTINCT entity_id FROM civica_exec.exec_sau_cnes_estab_v WHERE valid_from <= $2 AND (valid_to IS NULL OR valid_to > $2) AND entity_id IN (SELECT entity_id FROM ents))
    SELECT e.entity_id, coalesce(sum(l.qt_exist) FILTER (WHERE l.tp_leito <> 7), 0)::bigint AS exist, coalesce(sum(l.qt_sus) FILTER (WHERE l.tp_leito <> 7), 0)::bigint AS sus, p.value AS pop
    FROM estab e LEFT JOIN civica_exec.exec_sau_cnes_leito_v l ON l.entity_id = e.entity_id AND l.valid_from <= $2 AND (l.valid_to IS NULL OR l.valid_to > $2)
    LEFT JOIN civica_exec.exec_territory_population p ON p.entity_id = e.entity_id AND p.year = $3 AND p.source = 1
    GROUP BY e.entity_id, p.value`, [ufCode, comp, year]);
  const rows: IndicatorRow[] = []; let tExist = 0, tSus = 0;
  const ps = ymDate(comp), pe = ymDate(ymNext(comp));
  for (const x of r.rows) {
    const exist = Number(x.exist), sus = Number(x.sus), pop = x.pop == null ? null : Number(x.pop);
    tExist += exist; tSus += sus;
    const fl = pop == null ? FLAG.noDenominator : 0;
    rows.push({ indicator_id: 5, entity_id: Number(x.entity_id), period_start: ps, period_end: pe, status: 2, numerator: exist, denominator: pop, value: pop ? exist / pop * 1000 : null, flags: fl });
    rows.push({ indicator_id: 6, entity_id: Number(x.entity_id), period_start: ps, period_end: pe, status: 2, numerator: sus, denominator: pop, value: pop ? sus / pop * 1000 : null, flags: fl });
  }
  const up = await c.query(`SELECT value FROM civica_exec.exec_territory_population WHERE entity_id = $1 AND year = $2 AND source = 1`, [ufCode, year]);
  const upop = up.rows[0] ? Number(up.rows[0].value) : null; const fl = upop == null ? FLAG.noDenominator : 0;
  rows.push({ indicator_id: 5, entity_id: ufCode, period_start: ps, period_end: pe, status: 2, numerator: tExist, denominator: upop, value: upop ? tExist / upop * 1000 : null, flags: fl });
  rows.push({ indicator_id: 6, entity_id: ufCode, period_start: ps, period_end: pe, status: 2, numerator: tSus, denominator: upop, value: upop ? tSus / upop * 1000 : null, flags: fl });
  return upsertIndicators(c, runId, rows);
}

export interface CnesLog { (msg: string): void }
export interface CollectOptions { uf: string; competences: number[]; kinds: CnesKind[]; bootstrapFirst?: boolean; maxUnmappedPct?: number; log?: CnesLog; startAfter?: number | null }
export interface CollectSummary { uf: string; competence: number; kind: CnesKind; status: string; rowsRead: number; rowsOut: number; unmapped: number; bytes: number; ms: number; runId?: number | undefined }

async function extract(cfg: StorageConfig, kind: CnesKind, file: string, key: string): Promise<{ rowsRead: number; rows: Row[] }> {
  await mkdir(cfg.stagingDir, { recursive: true });
  const out = join(cfg.stagingDir, `${key}.json`);
  const r = await runPython(PY, [kind, file, out, '--tmp', cfg.stagingDir]);
  if (r.code !== 0) throw new Error(`extração ${kind} falhou: ${r.err.slice(0, 300)}`);
  try { const j = JSON.parse(await readFile(out, 'utf8')) as { rows_read: number; rows: Row[] }; return { rowsRead: j.rows_read, rows: j.rows }; }
  finally { await rm(out, { force: true }); }
}

/** Resolve o código de município do DATASUS. O DF tem um único município (Brasília, 530010): códigos 53xxxx de regiões administrativas (ex.: 530130) pertencem a ele. */
export function resolveMunicipality(code: string, emap: Map<string, number>): number | undefined {
  const e = emap.get(code); if (e !== undefined) return e;
  return /^53\d{4}$/.test(code) && !code.endsWith('0000') ? emap.get('530010') : undefined;
}

function mapRows(rows: Row[], emap: Map<string, number>, maxUnmappedPct: number): { rows: Row[]; unmapped: number } {
  const ok: Row[] = []; let un = 0;
  for (const r of rows) {
    const e = resolveMunicipality(String(r.codufmun), emap);
    if (e === undefined) { un++; continue; }
    const { codufmun: _c, ...rest } = r; ok.push({ ...rest, entity_id: e });
  }
  if (rows.length && un / rows.length * 100 > maxUnmappedPct) throw new Error(`${un} de ${rows.length} registros sem território (${(un / rows.length * 100).toFixed(2)}%): publicação bloqueada`);
  return { rows: ok, unmapped: un };
}

/** Garante a identidade de CNES vistos fora do ST (leitos/equipamentos): inserção idempotente que nunca altera linhas existentes. */
async function ensureStubs(pool: Pool, cnes: number[], entity: Map<number, number>, competence: number): Promise<void> {
  const rows = [...new Set(cnes)].map(c => ({ cnes: c, entity_id: entity.get(c) ?? null, first_seen: competence, origin: 2 }));
  for (let i = 0; i < rows.length; i += 5000) {
    await pool.query(`INSERT INTO civica_exec.exec_sau_cnes_estab (cnes, entity_id, first_seen, origin)
      SELECT cnes, entity_id, first_seen, origin FROM jsonb_populate_recordset(NULL::civica_exec.exec_sau_cnes_estab, $1::jsonb) ON CONFLICT (cnes) DO NOTHING`, [JSON.stringify(rows.slice(i, i + 5000))]);
  }
}

export async function collectCnes(pool: Pool, cfg: StorageConfig, opts: CollectOptions): Promise<CollectSummary[]> {
  const uf = opts.uf.toUpperCase(); const ufCode = UF_CODE[uf]; if (!ufCode) throw new Error(`UF inválida ${opts.uf}`);
  const emap = await loadEntityMap(pool); const log = opts.log ?? (() => undefined); const out: CollectSummary[] = [];
  const maxUn = opts.maxUnmappedPct ?? 0.2;
  for (const [i, comp] of opts.competences.entries()) {
    if (i > 0 && comp !== ymNext(opts.competences[i - 1]!)) throw new Error(`competências não contíguas: ${opts.competences[i - 1]} → ${comp}`);
    for (const kind of opts.kinds) {
      const t0 = Date.now(); const K = kind.toUpperCase();
      const first = i === 0 && !!opts.bootstrapFirst;
      const url = `${FTP}/${K}/${K}${uf}${aamm(comp)}.dbc`;
      const relPath = `datasus/cnes/${K}/${uf}/${Math.floor(comp / 100)}/${K}${uf}${aamm(comp)}.dbc`;
      const f = await fetchRaw(cfg, { url, relPath, competence: comp, uf: ufCode, retention: 1, dataset: `cnes_${kind}` });
      await recordManifest(pool, f);
      await assertCanDecode(cfg, f.bytes);
      const { rowsRead, rows } = await extract(cfg, kind, join(cfg.rawDir, relPath), `${kind}_${uf}_${comp}`);
      const { rows: mapped, unmapped } = mapRows(rows, emap, maxUn);
      let res: PublishResult;
      const hash = f.sha256;
      if (kind === 'st') {
        const ident = mapped.map(r => ({ cnes: r.cnes, entity_id: r.entity_id, first_seen: comp, origin: 1 }));
        res = await publishSlice(pool, { datasetId: DATASET.cnes_st, uf: ufCode, competence: comp, sourceHash: hash, bootstrap: first, parserVersion: 'cnes-st-v1', tables: [{ spec: SPECS.cnes_estab, rows: ident }, { spec: SPECS.cnes_estab_v, rows: mapped }], quality: { unmapped, rowsRead } });
      } else if (kind === 'lt') {
        await ensureStubs(pool, mapped.map(r => Number(r.cnes)), new Map(mapped.map(r => [Number(r.cnes), Number(r.entity_id)])), comp);
        res = await publishSlice(pool, { datasetId: DATASET.cnes_lt, uf: ufCode, competence: comp, sourceHash: hash, bootstrap: first, parserVersion: 'cnes-lt-v1', tables: [{ spec: SPECS.cnes_leito_v, rows: mapped }], quality: { unmapped, rowsRead }, derive: (c, runId) => deriveBeds(c, runId, ufCode, comp).then(() => undefined) });
      } else if (kind === 'eq') {
        await ensureStubs(pool, mapped.map(r => Number(r.cnes)), new Map(mapped.map(r => [Number(r.cnes), Number(r.entity_id)])), comp);
        res = await publishSlice(pool, { datasetId: DATASET.cnes_eq, uf: ufCode, competence: comp, sourceHash: hash, bootstrap: first, parserVersion: 'cnes-eq-v1', tables: [{ spec: SPECS.cnes_equip_v, rows: mapped }], quality: { unmapped, rowsRead } });
      } else {
        const pf = mapped.map(r => ({ entity_id: r.entity_id, cbo_group: r.cbo_group, snapshot_ym: comp, vinculos: r.vinculos, pessoas: r.pessoas }));
        const merged = new Map<string, Row>();   // duas CODUFMUN podem mapear para a mesma entidade (ex.: município ignorado)
        for (const r of pf) { const k = `${r.entity_id}:${r.cbo_group}`; const p = merged.get(k); if (p) { p.vinculos = Number(p.vinculos) + Number(r.vinculos); p.pessoas = Number(p.pessoas) + Number(r.pessoas); } else merged.set(k, { ...r }); }
        res = await publishSlice(pool, { datasetId: DATASET.cnes_pf, uf: ufCode, competence: comp, sourceHash: sha256(`${hash}:pf-v1`), bootstrap: true, contiguity: false, parserVersion: 'cnes-pf-v1', tables: [{ spec: SPECS.prof_mun_cbo, rows: [...merged.values()] }], quality: { unmapped, rowsRead } });
      }
      const s: CollectSummary = { uf, competence: comp, kind, status: res.status, rowsRead, rowsOut: mapped.length, unmapped, bytes: f.bytes, ms: Date.now() - t0, runId: 'runId' in res ? res.runId : undefined };
      out.push(s); log(JSON.stringify(s));
      if (res.status === 'FAILED_SAFE') throw new Error(`publicação bloqueada: ${(res as { reason: string }).reason}`);
    }
  }
  return out;
}
