import { mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { Pool } from 'pg';
import { DATASET, FLAG, SPECS, publishSlice, sha256, upsertIndicators, ymDate, ymNext, VAC_BASE_ID, type IndicatorRow, type Row } from '@senadotracker/db';
import { UF_CODE, loadEntityMap, resolveMunicipality } from './cnes.ts';
import { assertCanDecode, fetchRaw, recordManifest, runPython, type StorageConfig } from './storage.ts';

const FTP = 'ftp://ftp.datasus.gov.br/dissemin/publicos';
const PY = 'scripts/exec/epi_extract.py';
export type Log = (m: string) => void;
const aamm = (c: number) => `${String(Math.floor(c / 100) % 100).padStart(2, '0')}${String(c % 100).padStart(2, '0')}`;

async function extract(cfg: StorageConfig, kind: string, file: string, key: string, extra: string[] = []): Promise<Record<string, unknown> & { rows_read: number }> {
  await mkdir(cfg.stagingDir, { recursive: true });
  const out = join(cfg.stagingDir, `${key}.json`);
  const r = await runPython(PY, [kind, file, out, '--tmp', cfg.stagingDir, ...extra]);
  if (r.code !== 0) throw new Error(`extração ${kind} falhou: ${r.err.slice(0, 400)}`);
  try { return JSON.parse(await readFile(out, 'utf8')); } finally { await rm(out, { force: true }); }
}
const ratio = (n: number, d: number, k: number) => d > 0 ? n / d * k : null;
function mapMun(rows: Array<Record<string, unknown>>, emap: Map<string, number>, maxPct = 0.2): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = []; let un = 0; const sample: string[] = [];
  for (const r of rows) { const e = resolveMunicipality(String(r.codufmun), emap); if (e === undefined) { un++; if (sample.length < 6) sample.push(`${r.codufmun}${r.n_aih != null ? `(${r.n_aih} AIH)` : ''}`); continue; } out.push({ ...r, entity_id: e }); }
  if (rows.length && un / rows.length * 100 > maxPct) throw new Error(`${un}/${rows.length} registros sem território: publicação bloqueada [${sample.join(', ')}]`);
  return out;
}

/** SINASC + SIM de uma UF e um ano → IND-11, IND-12 (SINASC) e IND-08 (SIM + SINASC). Preliminar (2025+) leva o sinal de preliminar. */
export async function collectVital(pool: Pool, cfg: StorageConfig, o: { uf: string; year: number; log?: Log }): Promise<{ sinasc: string; sim: string; municipalities: number; births: number; infantDeaths: number }> {
  const uf = o.uf.toUpperCase(); const ufCode = UF_CODE[uf]!; const prelim = o.year >= 2025; const stage = prelim ? 1 : 2; const comp = o.year * 100 + 1;
  const emap = await loadEntityMap(pool);
  const vint = prelim ? `${new Date().toISOString().slice(0, 10)}/` : '';
  const dnUrl = prelim ? `${FTP}/SINASC/PRELIM/DNRES/DN${uf}${o.year}.dbc` : `${FTP}/SINASC/1996_/Dados/DNRES/DN${uf}${o.year}.dbc`;
  const doUrl = prelim ? `${FTP}/SIM/PRELIM/DORES/DO${uf}${o.year}.dbc` : `${FTP}/SIM/CID10/DORES/DO${uf}${o.year}.dbc`;
  const dn = await fetchRaw(cfg, { url: dnUrl, relPath: `datasus/sinasc/${prelim ? 'prelim' : 'definitivo'}/${vint}DN${uf}${o.year}.dbc`, competence: comp, uf: ufCode, retention: 1, dataset: 'sinasc' });
  const dob = await fetchRaw(cfg, { url: doUrl, relPath: `datasus/sim/${prelim ? 'prelim' : 'definitivo'}/${vint}DO${uf}${o.year}.dbc`, competence: comp, uf: ufCode, retention: 1, dataset: 'sim' });
  await recordManifest(pool, dn); await recordManifest(pool, dob);
  await assertCanDecode(cfg, Math.max(dn.bytes, dob.bytes));
  const sn = await extract(cfg, 'sinasc', join(cfg.rawDir, dn.relPath), `sinasc_${uf}_${o.year}`) as { rows: Array<Record<string, unknown>>; rows_read: number };
  const sm = await extract(cfg, 'sim', join(cfg.rawDir, dob.relPath), `sim_${uf}_${o.year}`) as { rows: Array<Record<string, unknown>>; rows_read: number };
  const births = mapMun(sn.rows, emap); const deaths = mapMun(sm.rows, emap);
  const ps = `${o.year}-01-01`, pe = `${o.year + 1}-01-01`; const baseFlag = prelim ? FLAG.preliminary : 0;
  const nvBy = new Map<number, number>(births.map(r => [Number(r.entity_id), Number(r.nascidos)]));

  const sinascRows = (): IndicatorRow[] => {
    const rows: IndicatorRow[] = []; const tot = { nv: 0, pv: 0, ces: 0, pnv: 0, pn6: 0 };
    for (const r of births) {
      const nv = Number(r.nascidos), pv = Number(r.partos_validos), ces = Number(r.cesareas), pnv = Number(r.pn_validos), pn6 = Number(r.pn6);
      tot.nv += nv; tot.pv += pv; tot.ces += ces; tot.pnv += pnv; tot.pn6 += pn6;
      const e = Number(r.entity_id);
      rows.push({ indicator_id: 12, entity_id: e, period_start: ps, period_end: pe, status: stage, numerator: ces, denominator: pv, value: ratio(ces, pv, 100), flags: baseFlag | (pv < 100 ? FLAG.smallN : 0) });
      rows.push({ indicator_id: 11, entity_id: e, period_start: ps, period_end: pe, status: stage, numerator: pn6, denominator: pnv, value: ratio(pn6, pnv, 100), flags: baseFlag | (pnv < 100 ? FLAG.smallN : 0) });
    }
    rows.push({ indicator_id: 12, entity_id: ufCode, period_start: ps, period_end: pe, status: stage, numerator: tot.ces, denominator: tot.pv, value: ratio(tot.ces, tot.pv, 100), flags: baseFlag });
    rows.push({ indicator_id: 11, entity_id: ufCode, period_start: ps, period_end: pe, status: stage, numerator: tot.pn6, denominator: tot.pnv, value: ratio(tot.pn6, tot.pnv, 100), flags: baseFlag });
    return rows;
  };
  const simRows = (): IndicatorRow[] => {
    const rows: IndicatorRow[] = []; let td = 0, tn = 0;
    const ents = new Set<number>([...nvBy.keys(), ...deaths.map(r => Number(r.entity_id))]);
    const dBy = new Map<number, number>(deaths.map(r => [Number(r.entity_id), Number(r.obitos_menor1)]));
    for (const e of ents) {
      const nv = nvBy.get(e) ?? 0, d = dBy.get(e) ?? 0; td += d; tn += nv;
      if (nv === 0) continue;       // sem nascidos no ano: sem denominador, sem linha
      rows.push({ indicator_id: 8, entity_id: e, period_start: ps, period_end: pe, status: stage, numerator: d, denominator: nv, value: ratio(d, nv, 1000), flags: baseFlag | (nv < 100 ? FLAG.smallN : 0) });
    }
    rows.push({ indicator_id: 8, entity_id: ufCode, period_start: ps, period_end: pe, status: stage, numerator: td, denominator: tn, value: ratio(td, tn, 1000), flags: baseFlag });
    return rows;
  };
  const r1 = await publishSlice(pool, { datasetId: DATASET.sinasc, uf: ufCode, competence: comp, stage, sourceHash: dn.sha256, parserVersion: 'sinasc-v1', tables: [], quality: { rowsRead: sn.rows_read }, derive: (c, runId) => upsertIndicators(c, runId, sinascRows()).then(() => undefined) });
  const r2 = await publishSlice(pool, { datasetId: DATASET.sim, uf: ufCode, competence: comp, stage, sourceHash: sha256(`${dob.sha256}:${dn.sha256}`), parserVersion: 'sim-v1', tables: [], inputs: { sim: dob.sha256, sinasc: dn.sha256 }, quality: { rowsRead: sm.rows_read }, derive: (c, runId) => upsertIndicators(c, runId, simRows()).then(() => undefined) });
  return { sinasc: r1.status, sim: r2.status, municipalities: births.length, births: births.reduce((n, r) => n + Number(r.nascidos), 0), infantDeaths: deaths.reduce((n, r) => n + Number(r.obitos_menor1), 0) };
}

/** Cobertura vacinal (SIPNIBD): um indicador por rótulo canônico; fatia por UF; competência = mês da carga do arquivo. */
export type PniResult = { uf: string; status: string; rows: number; labels: number; years: number[] };
/** Cobertura vacinal (SIPNIBD): o arquivo oficial é NACIONAL (um download). `uf: 'ALL'` publica as 27 fatias; `uf: 'ES'` só uma. Cada versão do arquivo é preservada (pasta por data de download); versão idêntica não duplica. */
export async function collectPni(pool: Pool, cfg: StorageConfig, o: { uf: string; log?: Log }): Promise<PniResult[]> {
  const emap = await loadEntityMap(pool);
  const today = new Date().toISOString().slice(0, 10);
  const f = await fetchRaw(cfg, { url: `${FTP}/Dados_Abertos/SIPNIBD/Cobertura_Residencia.parquet`, relPath: `datasus/pni/${today}/Cobertura_Residencia.parquet`, competence: null, uf: 0, retention: 1, dataset: 'pni', dedupeByHash: true });
  await recordManifest(pool, f);
  const all = await extract(cfg, 'pni', join(cfg.rawDir, f.relPath), `pni_${o.uf}`, ['--uf', 'all']) as { rows: Array<Record<string, unknown>>; rows_read: number };
  const ufs = o.uf.toUpperCase() === 'ALL' ? Object.keys(UF_CODE) : [o.uf.toUpperCase()];
  const out: PniResult[] = [];
  for (const uf of ufs) {
    const ufCode = UF_CODE[uf]!;
    const j = { ...all, rows: all.rows.filter(r => String(r.codufmun).slice(0, 2) === String(ufCode)) };
    if (!j.rows.length) throw new Error(`PNI sem linhas para ${uf}`);
    out.push({ uf, ...(await publishPniUf(pool, f, j, emap, ufCode, today)) });
    o.log?.(JSON.stringify(out.at(-1)));
  }
  return out;
}
async function publishPniUf(pool: Pool, f: { sha256: string }, j: { rows: Array<Record<string, unknown>>; rows_read: number }, emap: Map<string, number>, ufCode: number, today: string): Promise<{ status: string; rows: number; labels: number; years: number[] }> {
  const mapped = mapMun(j.rows, emap);
  const carga = String(j.rows[0]!.dt_carga);             // dd/mm/aaaa
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(carga); const comp = m ? Number(m[3]) * 100 + Number(m[2]) : Number(today.slice(0, 4)) * 100 + Number(today.slice(5, 7));
  const loadYear = Math.floor(comp / 100);
  // ids de indicador estáveis por rótulo canônico
  const lock = await pool.connect();
  const idBySlug = new Map<string, number>();
  try {
    await lock.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', ['civica_exec:pni-defs']);
    const have = await lock.query(`SELECT indicator_id, code FROM civica_exec.exec_ind_def WHERE code LIKE 'IND-SAU-07:%'`);
    for (const r of have.rows) idBySlug.set(String(r.code).slice(11), Number(r.indicator_id));
    let next = Math.max(VAC_BASE_ID, ...[...idBySlug.values()]) + (idBySlug.size ? 1 : 0);
    const labels = new Map<string, string>(); for (const r of mapped) labels.set(String(r.slug), String(r.label));
    for (const [slug, label] of [...labels].sort()) {
      if (idBySlug.has(slug)) continue;
      await lock.query(`INSERT INTO civica_exec.exec_ind_def (indicator_id, code, method_version, domain, sort_order, label, unit, grain, numerator_desc, denominator_desc, min_denominator, ranking_allowed, aggregation_allowed, null_semantics, methodology_note)
        VALUES ($1,$2,1,1,$3,$4,'% (doses ÷ população-alvo)','A','doses aplicadas (SI-PNI), município de residência','população-alvo (denominador SINASC do arquivo oficial)',0,false,true,'sem linha = sem registro','Cobertura de DOSES, não de indivíduos vacinados. Pode passar de 100%. O rótulo é o do arquivo oficial; rótulos diferentes são definições diferentes.')`,
        [next, `IND-SAU-07:${slug}`, 700 + (next - VAC_BASE_ID), `Cobertura vacinal — ${label}`]);
      idBySlug.set(slug, next++);
    }
  } finally { try { await lock.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', ['civica_exec:pni-defs']); } catch { /* */ } lock.release(); }
  const rows: IndicatorRow[] = []; const uf = new Map<string, { doses: number; pop: number }>();
  for (const r of mapped) {
    const y = Number(r.year), doses = Number(r.doses), pop = Number(r.pop); const id = idBySlug.get(String(r.slug))!;
    const v = ratio(doses, pop, 100);
    rows.push({ indicator_id: id, entity_id: Number(r.entity_id), period_start: `${y}-01-01`, period_end: `${y + 1}-01-01`, status: y >= loadYear ? 1 : 2, numerator: doses, denominator: pop, value: v,
      flags: (pop === 0 ? FLAG.noDenominator : 0) | (v !== null && v > 100 ? FLAG.above100 : 0) | (y >= loadYear ? FLAG.partialCoverage : 0) });
    const k = `${id}:${y}`; const a = uf.get(k) ?? { doses: 0, pop: 0 }; a.doses += doses; a.pop += pop; uf.set(k, a);
  }
  for (const [k, a] of uf) { const [id, y] = k.split(':').map(Number) as [number, number]; const v = ratio(a.doses, a.pop, 100); rows.push({ indicator_id: id, entity_id: ufCode, period_start: `${y}-01-01`, period_end: `${y + 1}-01-01`, status: y >= loadYear ? 1 : 2, numerator: a.doses, denominator: a.pop, value: v, flags: (v !== null && v > 100 ? FLAG.above100 : 0) | (y >= loadYear ? FLAG.partialCoverage : 0) }); }
  const res = await publishSlice(pool, { datasetId: DATASET.pni, uf: ufCode, competence: comp, sourceHash: f.sha256, parserVersion: 'pni-v1', tables: [], quality: { rowsRead: j.rows_read }, derive: (c, runId) => upsertIndicators(c, runId, rows).then(() => undefined) });
  return { status: res.status, rows: rows.length, labels: idBySlug.size, years: [...new Set(mapped.map(r => Number(r.year)))].sort() };
}

type SihAgg = { competence: number; duplicates_dropped: number; hosp: Array<Record<string, unknown>>; mun: Array<Record<string, unknown>>; rows_read: number };
async function sihFile(pool: Pool, cfg: StorageConfig, uf: string, comp: number): Promise<{ agg: SihAgg; sha: string; bytes: number }> {
  const f = await fetchRaw(cfg, { url: `${FTP}/SIHSUS/200801_/Dados/RD${uf}${aamm(comp)}.dbc`, relPath: `datasus/sih-rd/${uf}/${Math.floor(comp / 100)}/RD${uf}${aamm(comp)}.dbc`, competence: comp, uf: UF_CODE[uf]!, retention: 2, dataset: 'sih_rd' });
  await recordManifest(pool, f); await assertCanDecode(cfg, f.bytes);
  const agg = await extract(cfg, 'sih', join(cfg.rawDir, f.relPath), `sih_${uf}_${comp}`) as unknown as SihAgg;
  return { agg, sha: f.sha256, bytes: f.bytes };
}

/** SIH-RD por hospital (UF do estabelecimento): hospital × mês × subgrupo. Competência de PROCESSAMENTO, valores APROVADOS (não pagos). */
async function publishHospUf(pool: Pool, uf: string, comp: number, agg: SihAgg, sha: string): Promise<{ competence: number; status: string; aih: number; hospitals: number; duplicates: number }> {
  const ufCode = UF_CODE[uf]!;
  if (agg.competence !== comp) throw new Error(`arquivo RD${uf}${aamm(comp)} traz competência ${agg.competence}`);
  const stubs = [...new Set(agg.hosp.map(h => Number(h.cnes)))].map(c => ({ cnes: c, entity_id: null, first_seen: comp, origin: 2 }));
  await pool.query(`INSERT INTO civica_exec.exec_sau_cnes_estab (cnes, entity_id, first_seen, origin) SELECT cnes, entity_id, first_seen, origin FROM jsonb_populate_recordset(NULL::civica_exec.exec_sau_cnes_estab, $1::jsonb) ON CONFLICT (cnes) DO NOTHING`, [JSON.stringify(stubs)]);
  const rows: Row[] = agg.hosp.map(h => ({ cnes: h.cnes, competence: comp, subgrupo: h.subgrupo, uf: ufCode, n_aih: h.n_aih, valor_cents: h.valor_cents, dias_perm: h.dias_perm, obitos: h.obitos, n_icsap: h.n_icsap }));
  const res = await publishSlice(pool, { datasetId: DATASET.sih_rd, uf: ufCode, competence: comp, sourceHash: sha, parserVersion: 'sih-rd-v1', tables: [{ spec: SPECS.hosp_mes_subgrupo, rows }], quality: { rowsRead: agg.rows_read, duplicatesDropped: agg.duplicates_dropped } });
  return { competence: comp, status: res.status, aih: rows.reduce((n, r) => n + Number(r.n_aih), 0), hospitals: new Set(rows.map(r => r.cnes)).size, duplicates: agg.duplicates_dropped };
}

/** SIH-RD por hospital (UF do estabelecimento): hospital × mês × subgrupo. Competência de PROCESSAMENTO, valores APROVADOS (não pagos). */
export async function collectSihHospital(pool: Pool, cfg: StorageConfig, o: { uf: string; competences: number[]; log?: Log }): Promise<Array<{ competence: number; status: string; aih: number; hospitals: number; duplicates: number }>> {
  const uf = o.uf.toUpperCase(); const out = [];
  for (const comp of o.competences) {
    const { agg, sha } = await sihFile(pool, cfg, uf, comp);
    out.push(await publishHospUf(pool, uf, comp, agg, sha));
    o.log?.(JSON.stringify(out.at(-1)));
  }
  return out;
}

/** SIH-RD nacional (27 arquivos) → internações de residentes por município e IND-10 (proporção ICSAP). Só publica com os 27 arquivos. */
export async function collectSihResidents(pool: Pool, cfg: StorageConfig, o: { competence: number; log?: Log; withHospital?: boolean }): Promise<{ status: string; aih: number; icsap: number; valorCents: number; municipalities: number; duplicates: number; rowsRead: number; bytes: number }> {
  const emap = await loadEntityMap(pool); const agg = new Map<number, { n: number; ic: number; fora: number; val: number; dias: number; ob: number }>();
  let dup = 0, read = 0, bytes = 0, reassigned = 0, dropped = 0; const shas: string[] = [];
  for (const uf of Object.keys(UF_CODE)) {
    const { agg: a, sha, bytes: b } = await sihFile(pool, cfg, uf, o.competence);
    dup += a.duplicates_dropped; read += a.rows_read; bytes += b; shas.push(sha);
    if (o.withHospital) { const h = await publishHospUf(pool, uf, o.competence, a, sha); o.log?.(JSON.stringify({ uf, ...h })); }
    // Código de residência fora do catálogo do IBGE: se o prefixo é de uma UF, vira "município ignorado" da UF (xx0000); senão (exterior/inválido) é descartado e contado.
    const resolved: Array<Record<string, unknown>> = [];
    for (const m of a.mun) {
      const code = String(m.codufmun); let e = resolveMunicipality(code, emap);
      if (e === undefined) { const ign = emap.get(`${code.slice(0, 2)}0000`); if (ign !== undefined && /^\d{6}$/.test(code)) { e = ign; reassigned += Number(m.n_aih); } else { dropped += Number(m.n_aih); continue; } }
      resolved.push({ ...m, entity_id: e });
    }
    for (const m of resolved) {
      const e = Number(m.entity_id); const x = agg.get(e) ?? { n: 0, ic: 0, fora: 0, val: 0, dias: 0, ob: 0 };
      x.n += Number(m.n_aih); x.ic += Number(m.n_icsap); x.fora += Number(m.n_fora_mun); x.val += Number(m.valor_cents); x.dias += Number(m.dias_perm); x.ob += Number(m.obitos); agg.set(e, x);
    }
    o.log?.(`${uf} ok`);
  }
  const totalAih = [...agg.values()].reduce((n, x) => n + x.n, 0) + dropped;
  if (totalAih && dropped / totalAih > 0.001) throw new Error(`${dropped} de ${totalAih} AIH sem território utilizável (>0,1%): publicação bloqueada`);
  const rows: Row[] = [...agg].map(([e, x]) => ({ entity_id: e, competence: o.competence, n_aih: x.n, n_icsap: x.ic, n_fora_mun: x.fora, valor_cents: x.val, dias_perm: x.dias, obitos: x.ob }));
  const ps = ymDate(o.competence), pe = ymDate(ymNext(o.competence));
  const ufOf = new Map<number, number>((await pool.query(`SELECT entity_id, uf_code FROM civica_exec.exec_entity WHERE kind IN (4, 5)`)).rows.map(r => [Number(r.entity_id), Number(r.uf_code)]));
  const ind: IndicatorRow[] = []; const ufTot = new Map<number, { n: number; ic: number }>(); let bn = 0, bic = 0;
  for (const [e, x] of agg) {
    ind.push({ indicator_id: 10, entity_id: e, period_start: ps, period_end: pe, status: 2, numerator: x.ic, denominator: x.n, value: ratio(x.ic, x.n, 100), flags: x.n < 30 ? FLAG.smallN : 0 });
    const u = ufOf.get(e)!; const t = ufTot.get(u) ?? { n: 0, ic: 0 }; t.n += x.n; t.ic += x.ic; ufTot.set(u, t); bn += x.n; bic += x.ic;
  }
  for (const [u, t] of ufTot) ind.push({ indicator_id: 10, entity_id: u, period_start: ps, period_end: pe, status: 2, numerator: t.ic, denominator: t.n, value: ratio(t.ic, t.n, 100), flags: 0 });
  ind.push({ indicator_id: 10, entity_id: 76, period_start: ps, period_end: pe, status: 2, numerator: bic, denominator: bn, value: ratio(bic, bn, 100), flags: 0 });
  const res = await publishSlice(pool, { datasetId: DATASET.sih_mun, uf: 0, competence: o.competence, sourceHash: sha256(`${shas.join(',')}:resid-v3`), parserVersion: 'sih-resid-v3', tables: [{ spec: SPECS.sih_mun_mes, rows }],
    inputs: { files: shas.length }, quality: { rowsRead: read, duplicatesDropped: dup, aihReassignedToIgnoredMunicipality: reassigned, aihDroppedNoTerritory: dropped }, derive: (c, runId) => upsertIndicators(c, runId, ind).then(() => undefined) });
  return { status: res.status, aih: bn, icsap: bic, valorCents: [...agg.values()].reduce((n, x) => n + x.val, 0), municipalities: agg.size, duplicates: dup, rowsRead: read, bytes };
}
