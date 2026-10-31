import fs from 'node:fs';
import path from 'node:path';
import { openPool } from './db.ts';
import { publishSlice, replaceIndicatorsBulk, type IndicatorRow } from '../../packages/db/src/exec/index.ts';

const parsedPath = String.raw`D:\Civica\staging\infraestrutura\sinisa\2024\parsed\sinisa_2024.json`;
const COMP = 202412;
const FROM = '2024-01-01';
const TO = '2025-01-01';
const DATASETS: Record<string, number> = { water: 130, sewage: 131, waste: 132, drainage: 133, management: 134 };
const CODE_TO_ID: Record<string, number> = {
  IAG0001: 10001, IAG0002: 10002, IAG2006: 10003, IAG2013: 10004,
  IES0001: 10101, IES0002: 10102, IES0007: 10103, IES0008: 10104,
  IRS0001: 10201, IRS0002: 10202, IRS0005: 10203, IRS3002: 10204,
  IAP0001: 10301, IAP0002: 10302, IGR0001: 10303, IGR0002: 10304,
  OGM3004: 10401, OGM3013: 10402, OGM3201: 10403, OGM3301: 10404,
};
const URLS: Record<string, string> = {
  water: 'https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/saneamento/sinisa/resultados-sinisa/SINISA_Resultados_Ref2024.zip',
  sewage: 'https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/saneamento/sinisa/resultados-sinisa/SINISA_ESGOTO_Planilhas_2024.zip',
  waste: 'https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/saneamento/sinisa/resultados-sinisa/SINISA_RESIDUOS_planilhas_2024.zip',
  drainage: 'https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/saneamento/sinisa/resultados-sinisa/SINISA_AGUASPLUVIAIS_Informacoes_Indicadores_2025.zip',
  management: 'https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/saneamento/sinisa/resultados-sinisa/copy_of_SINISA_GESTAO_MUNICIPAL_Informacoes_2024.xlsx',
};
const HASHES: Record<string, string> = {
  water: '777EB5F8DCD1483DF76823A3BEDE1D77F40B177ADAC1C330C5A611B4C4AB6D74',
  sewage: '66CD24D0ABBC81A95DA4E41D2B89E287AAFCD2C18F1C3AD2B7D7CF9EE011CA67',
  waste: 'CAA7A0FE02219368A26C1C65A718DFE14B5BD06DDC6DA95F89B9EDDBBADBF4C1',
  drainage: '3B9EB2D28E66DB7D93A2E1CF7504BE13CA70916CBAC9CF01305CAB87655CC07B',
  management: '1401AE309E5171F2F686456563001ECEEC09B88653E6F7B34A4442C12431D99E',
};
type Family = { file: string; definitions: Record<string, { label: string; unit: string; column: number }>; records: any[]; aggregates?: any[] };
type Payload = { families: Record<string, Family> };
const val = (raw: unknown, v: unknown, code: string): { value: number | null; flags: number } => {
  const s = String(raw ?? '').trim().toLowerCase();
  if (code.startsWith('OGM')) {
    if (s === 'sim' || s === 's') return { value: 1, flags: 0 };
    if (s === 'não' || s === 'nao' || s === 'n') return { value: 0, flags: 0 };
  }
  if (typeof v === 'number' && Number.isFinite(v)) return { value: v, flags: 0 };
  return { value: null, flags: raw ? 1 : 0 };
};
const q = (name: string) => `civica_exec.${name}`;

async function seedDefs(pool: any, payload: Payload) {
  for (const family of Object.values(payload.families)) {
    for (const [code, d] of Object.entries(family.definitions)) {
      const id = CODE_TO_ID[code]; if (!id) throw new Error(`indicator id missing for ${code}`);
      await pool.query(`INSERT INTO ${q('exec_ind_def')} (indicator_id, code, method_version, domain, sort_order, label, unit, grain, numerator_desc, denominator_desc, min_denominator, ranking_allowed, aggregation_allowed, null_semantics, methodology_note)
        VALUES ($1,$2,1,5,$1,$3,$4,'A',NULL,NULL,NULL,false,true,'NULL quando a fonte não calcula ou não responde','SINISA referência 2024; valor source-native; não converter ausência em zero')
        ON CONFLICT (indicator_id) DO UPDATE SET code=EXCLUDED.code,label=EXCLUDED.label,unit=EXCLUDED.unit,domain=5,grain='A',aggregation_allowed=true,null_semantics=EXCLUDED.null_semantics,methodology_note=EXCLUDED.methodology_note`,
        [id, code, d.label || code, d.unit || null]);
    }
  }
}

async function main() {
  const payload = JSON.parse(fs.readFileSync(parsedPath, 'utf8')) as Payload;
  const pool = openPool(3);
  try {
    const entRows = (await pool.query(`SELECT entity_id, kind, ibge7, uf_code, uf, name FROM ${q('exec_entity')} WHERE kind IN (1,3,4,5)`)).rows;
    const byIbge = new Map(entRows.map((e: any) => [String(e.ibge7), e]));
    const byUf = new Map(entRows.filter((e: any) => e.kind === 3).map((e: any) => [String(e.uf).toUpperCase(), e]));
    const br = entRows.find((e: any) => e.kind === 1);
    await seedDefs(pool, payload);
    const results: any[] = [];
    for (const [family, data] of Object.entries(payload.families)) {
      const ids = Object.keys(data.definitions).map(c => CODE_TO_ID[c]);
      const rows: IndicatorRow[] = [];
      const seen = new Set<string>();
      let unresolved = 0, duplicates = 0, nulls = 0;
      const add = (entity: any, rec: any) => {
        if (!entity) { unresolved++; return; }
        for (const item of rec.values ?? []) {
          const iid = CODE_TO_ID[item.code]; if (!iid) continue;
          const k = `${iid}:${entity.entity_id}`;
          if (seen.has(k)) { duplicates++; continue; }
          seen.add(k);
          const p = val(item.raw, item.value, item.code); if (p.value === null) nulls++;
          rows.push({ indicator_id: iid, entity_id: entity.entity_id, period_start: FROM, period_end: TO, status: 2, numerator: null, denominator: null, value: p.value, flags: p.flags });
        }
      };
      for (const rec of data.records ?? []) add(byIbge.get(String(rec.ibge7)), rec);
      for (const rec of data.aggregates ?? []) add(rec.sigla === 'BR' ? br : byUf.get(String(rec.sigla).toUpperCase()), rec);
      if (duplicates) throw new Error(`${family}: duplicate indicator/entity keys ${duplicates}`);
      const sourceHash = HASHES[family].toLowerCase();
      const result = await publishSlice(pool, { datasetId: DATASETS[family], uf: 0, competence: COMP, stage: 2, sourceHash, parserVersion: 'sinisa-p131-1', bootstrap: true, contiguity: false, tables: [], inputs: { sourceUrl: URLS[family], rawPath: data.file, rawSha256: HASHES[family], referenceYear: 2024, staging: parsedPath }, quality: { family, sourceRows: (data.records?.length ?? 0) + (data.aggregates?.length ?? 0), indicatorRows: rows.length, unresolvedEntities: unresolved, duplicateKeys: duplicates, nullValues: nulls, municipalRows: data.records?.length ?? 0, aggregateRows: data.aggregates?.length ?? 0 }, derive: async (c, runId) => { await replaceIndicatorsBulk(c, runId, { indicatorIds: ids, ufCode: 0, from: FROM, to: TO, includeNational: true }, rows, true); }, verify: async (c) => { const r = await c.query(`SELECT count(*)::int AS n, count(DISTINCT entity_id)::int AS e FROM ${q('exec_ind_value')} WHERE indicator_id = ANY($1::smallint[]) AND period_start=$2::date`, [ids, FROM]); if (Number(r.rows[0].n) !== rows.length) throw new Error(`${family}: persisted rows ${r.rows[0].n} != expected ${rows.length}`); } });
      await pool.query(`UPDATE ${q('exec_ingestion_run')} SET rows_in=$2, rows_out=$2 WHERE run_id=$1`, [result.runId, rows.length]);
      await pool.query(`UPDATE ${q('exec_publication')} SET row_count=$2 WHERE run_id=$1`, [result.runId, rows.length]);
      if (result.status === 'PUBLISHED' || result.status === 'NO_CHANGE') {
        const runId = result.runId;
        const rawPath = path.relative(String.raw`D:\Civica`, data.file).replaceAll('\\','/');
        await pool.query(`INSERT INTO ${q('exec_raw_manifest')} (run_id, source_url, rel_path, sha256, bytes, fetched_at, competence, uf, state, retention_class) VALUES ($1,$2,$3,decode($4,'hex'),$5,now(),$6,0,1,2) ON CONFLICT (sha256) DO NOTHING`, [runId, URLS[family], rawPath, HASHES[family], fs.statSync(data.file).size, COMP]);
      }
      results.push({ family, result, indicatorRows: rows.length, unresolved, nulls, sourceRows: (data.records?.length ?? 0) + (data.aggregates?.length ?? 0) });
    }
    const audit = await pool.query(`SELECT r.dataset_id,r.run_id,r.status,r.rows_in,r.rows_out,r.quality,p.state,p.row_count FROM ${q('exec_ingestion_run')} r LEFT JOIN ${q('exec_publication')} p ON p.run_id=r.run_id WHERE r.dataset_id BETWEEN 130 AND 134 AND r.competence=$1 ORDER BY r.dataset_id`, [COMP]);
    console.log(JSON.stringify({ results, audit: audit.rows }, null, 2));
    fs.writeFileSync(path.join(process.cwd(), 'docs', 'executivo-collector-plan', 'infraestrutura-p13-1-sinisa', 'publish_results.json'), JSON.stringify({ results, audit: audit.rows }, null, 2));
  } finally { await pool.end(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
