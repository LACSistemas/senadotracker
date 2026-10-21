import { SPECS, publishSlice, sha256, type Row } from '../../packages/db/src/exec/index.ts';
import { getJson, openPool } from './db.ts';

/** Dicionários oficiais: tipos de unidade do CNES (DEMAS /cnes/tipounidades) e tipos de leito (layout CNES). */
const t = await getJson<{ tipos_unidade: Array<{ codigo_tipo_unidade: number; descricao_tipo_unidade: string }> }>('https://apidadosabertos.saude.gov.br/cnes/tipounidades');
const rows: Row[] = t.tipos_unidade.map(x => ({ domain: 3, code: String(x.codigo_tipo_unidade), valid_from: '1900-01-01', valid_to: null, canonical_code: String(x.codigo_tipo_unidade), label: x.descricao_tipo_unidade, attrs: { source: 'DEMAS /cnes/tipounidades' } }));
const beds: Array<[number, string]> = [[1, 'Cirúrgico'], [2, 'Clínico'], [3, 'Complementar (UTI/UCI e outros)'], [4, 'Obstétrico'], [5, 'Pediátrico'], [6, 'Outras especialidades'], [7, 'Hospital-dia']];
for (const [c, l] of beds) rows.push({ domain: 4, code: String(c), valid_from: '1900-01-01', valid_to: null, canonical_code: String(c), label: l, attrs: { source: 'layout CNES-LT (TP_LEITO); a conferir no dicionário TAB_CNES' } });
const pool = openPool(2);
try {
  const r = await publishSlice(pool, { datasetId: 1, uf: 0, competence: 202611, sourceHash: sha256(JSON.stringify(rows)), bootstrap: true, parserVersion: 'refcodes-v1', tables: [{ spec: SPECS.ref_code, rows }] });
  console.log(r.status, rows.length);
} finally { await pool.end(); }
