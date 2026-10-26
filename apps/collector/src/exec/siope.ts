import { createHash } from 'node:crypto';
import { createGzip } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Pool } from 'pg';
import { DATASET, SPECS, publishSlice, replaceIndicatorsBulk, sha256 } from '@senadotracker/db';
import { ALL_UFS, isFirstPublication } from './seguranca.ts';
import { UF_CODE } from './cnes.ts';
import type { StorageConfig } from './storage.ts';

const BASE = 'https://www.fnde.gov.br/olinda-ide/servico/DADOS_ABERTOS_SIOPE/versao/v1/odata';
type Obj = Record<string, unknown>;
type Fact = { entity_id: number; exercicio: number; periodo: number; componente: number; codigo: string; estagio: string; valor_cents: number | null; valor_text: string | null; source_key: string; raw_sha256: string };
type Cov = { uf: number; exercicio: number; periodo: number; componente: number; status: number; rows_in: number; valid: number; rejected: number; source_hash: string; source_updated_at: string | null };
const NUMERIC = /^-?\d+(?:[.,]\d+)?$/;
const n = (v: unknown): number | null => { if (v == null || v === '') return null; const x = Number(String(v).replace(',', '.')); return Number.isFinite(x) ? x : null; };
const cents = (v: unknown): number | null => { const x = n(v); return x == null ? null : Math.round(x * 100); };
const isMoney = (k: string) => /^VL_.*_EDU$/.test(k);
const SIOPE_INDICATORS = new Set([24, 27, 28, 29, 30, 40]);
const call = async (fn: string, year: number, period: number, uf: string): Promise<{ rows: Obj[]; body: Buffer; url: string }> => {
  const url = `${BASE}/${fn}(Ano_Consulta=${year},Num_Peri=${period},Sig_UF='${uf}')?$format=json`;
  const r = await fetch(url, { headers: { 'User-Agent': 'civica-exec/1.0 (dados abertos)' } }); const body = Buffer.from(await r.arrayBuffer()); if (!r.ok) throw new Error(`SIOPE ${fn} ${year}/${period}/${uf}: HTTP ${r.status}`);
  const j = JSON.parse(body.toString('utf8')) as { value?: Obj[] }; return { rows: j.value ?? [], body, url };
};
const hash = (b: Buffer) => createHash('sha256').update(b).digest();

export async function collectSiope(pool: Pool, cfg: StorageConfig, years: number[], ufs = ALL_UFS, log: (x: string) => void = console.log): Promise<{ years: number[]; ufs: string[]; slices: number; facts: number; coverage: number; rawBytes: number }> {
  const entityRows = (await pool.query(`SELECT entity_id, kind, uf_code, ibge6 FROM civica_exec.exec_entity WHERE kind IN (3,4)`)).rows;
  const byKey = new Map<string, number>(); for (const e of entityRows) byKey.set(`${e.kind === 3 ? 'UF' : 'MUN'}:${e.kind === 3 ? Number(e.uf_code) : Number(e.ibge6)}`, Number(e.entity_id));
  const allFacts: Fact[] = []; const allCov: Cov[] = []; let rawBytes = 0; const root = join(cfg.rawDir, 'siope'); await mkdir(root, { recursive: true });
  const components: Array<[number, string]> = [[1, 'Dados_Gerais_Siope'], [2, 'Despesas_Funcao_Educacao_Siope'], [3, 'Indicadores_Siope'], [4, 'Informacoes_Complementares_Siope']];
  for (const year of years) for (const uf of ufs) { const ufCode = UF_CODE[uf]!; const period = 6; const sliceFacts: Fact[] = [];
    for (const [component, fn] of components) {
      let got: { rows: Obj[]; body: Buffer; url: string }; try { got = await call(fn, year, period, uf); } catch (e) { log(JSON.stringify({ siope: fn, year, uf, error: String(e) })); allCov.push({ uf: ufCode, exercicio: year, periodo: period, componente: component, status: 5, rows_in: 0, valid: 0, rejected: 0, source_hash: '', source_updated_at: null }); continue; }
      rawBytes += got.body.byteLength; const rawPath = join(root, `${year}`, uf, `${period}-${fn}.json.gz`); await mkdir(join(root, `${year}`, uf), { recursive: true }); await writeFile(rawPath, await new Promise<Buffer>((resolve, reject) => { const z = createGzip(); const chunks: Buffer[] = []; z.on('data', c => chunks.push(c)); z.on('end', () => resolve(Buffer.concat(chunks))); z.on('error', reject); z.end(got.body); }));
      const rh = hash(got.body); let valid = 0; let rejected = 0;
      // O endpoint não promete ordem de linhas. Ordenar a resposta antes de
      // gerar códigos/source_key evita que uma reserialização altere o hash
      // semântico (especialmente no componente de complementos).
      const orderedRows = [...got.rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
      for (const [rowIndex, row] of orderedRows.entries()) {
        const key = row.COD_MUNI == null ? `UF:${ufCode}` : `MUN:${Number(row.COD_MUNI)}`; const entity = byKey.get(key); if (entity == null) { rejected++; continue; }
        const sourceKey = `${uf}/${year}/${period}/${fn}/${row.COD_MUNI ?? 'UF'}/${rowIndex}`;
        if (component === 1) { for (const [k, v] of Object.entries(row)) if (isMoney(k) && n(v) != null) sliceFacts.push({ entity_id: entity, exercicio: year, periodo: period, componente: component, codigo: k, estagio: '', valor_cents: cents(v), valor_text: String(v), source_key: sourceKey, raw_sha256: rh.toString('hex') }); }
        else if (component === 2) { const sub = `${String(row.NUM_ORDE ?? 'X')}_${String(row.DES_SUBF ?? 'UNKNOWN')}`; for (const [k, stage] of [['VAL_DESP_EMPE','EMP'],['VAL_DESP_LIQU','LIQ'],['VAL_DESP_PAGA','PAG']] as const) if (n(row[k]) != null) sliceFacts.push({ entity_id: entity, exercicio: year, periodo: period, componente: component, codigo: `SUB_${sub}`, estagio: stage, valor_cents: cents(row[k]), valor_text: String(row[k]), source_key: sourceKey, raw_sha256: rh.toString('hex') }); }
        else if (component === 3 && SIOPE_INDICATORS.has(Number(row.COD_INDI)) && n(row.VAL_INDI) != null) sliceFacts.push({ entity_id: entity, exercicio: year, periodo: period, componente: component, codigo: `IND_${row.COD_INDI}`, estagio: String(row.NOM_INDI ?? ''), valor_cents: cents(row.VAL_INDI), valor_text: String(row.VAL_INDI), source_key: sourceKey, raw_sha256: rh.toString('hex') });
        else if (component === 4 && n(row.VAL_DECL) != null) sliceFacts.push({ entity_id: entity, exercicio: year, periodo: period, componente: component, codigo: `COMP_${row.COD_EXIB ?? 'UNKNOWN'}_${rowIndex}`, estagio: String(row.NOM_ITEM ?? ''), valor_cents: cents(row.VAL_DECL), valor_text: String(row.VAL_DECL), source_key: sourceKey, raw_sha256: rh.toString('hex') });
        valid++;
      }
      allCov.push({ uf: ufCode, exercicio: year, periodo: period, componente: component, status: 1, rows_in: got.rows.length, valid, rejected, source_hash: rh.toString('hex'), source_updated_at: null });
    }
    allFacts.push(...sliceFacts);
    // A publicação é uma fatia por UF/exercício; o coletor mantém o RAW por recurso e publica somente após os quatro componentes.
    const first = await isFirstPublication(pool, DATASET.fin_edu_siope, ufCode, year * 100 + period);
    // O hash de publicação é semântico: a API pode reserializar/ordenar o mesmo
    // conteúdo e mudar o SHA do payload bruto. O RAW mantém o hash original;
    // idempotência da publicação compara somente os fatos e estados canônicos.
    const semanticFacts = sliceFacts.map(f => [f.entity_id, f.exercicio, f.periodo, f.componente, f.codigo, f.estagio, f.valor_cents, f.valor_text]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))).map(x => JSON.stringify(x)).join('\n');
    const semanticCov = allCov.filter(c => c.uf === ufCode && c.exercicio === year).map(c => [c.uf, c.exercicio, c.periodo, c.componente, c.status, c.rows_in, c.valid, c.rejected, c.source_updated_at]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))).map(x => JSON.stringify(x)).join('\n');
    const fingerprint = sha256(`siope-v3:${year}:${ufCode}\n${semanticFacts}\n--COVERAGE--\n${semanticCov}`);
    const r = await publishSlice(pool, { datasetId: DATASET.fin_edu_siope, uf: ufCode, competence: year * 100 + period, sourceHash: fingerprint, parserVersion: 'siope-v3', bootstrap: first, tables: [{ spec: SPECS.edu_siope_fact, rows: sliceFacts }, { spec: SPECS.edu_siope_cov, rows: allCov.filter(c => c.uf === ufCode && c.exercicio === year) }], inputs: { provider: 'FNDE/SIOPE', year, period, uf, components, retainedIndicators: [...SIOPE_INDICATORS] }, quality: { facts: sliceFacts.length, compact: true }, derive: async () => { /* indicadores SIOPE são source-native na tabela de fatos; não misturar com Siconfi */ } });
    log(JSON.stringify({ siope: 'publish', year, uf, status: r.status, facts: sliceFacts.length }));
  }
  return { years, ufs, slices: years.length * ufs.length, facts: allFacts.length, coverage: allCov.length, rawBytes };
}
