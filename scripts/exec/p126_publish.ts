import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { openPool } from './db.ts';
import { publishSlice, upsertIndicators, type IndicatorRow } from '../../packages/db/src/exec/publication.ts';

const STAGING = 'D:\\Civica\\staging\\bem-estar\\cotidiano\\p126_municip_rows.json';
const DATASET = 124;
const DOMAIN = 4;
const COMPETENCE = 202412;
const PERIOD_START = '2024-12-31';
const PERIOD_END = '2025-01-01';
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

type Staging = { sourceFiles: any[]; edition: number; sheet: string; rows: any[]; stats: any };
type Def = readonly [number, string, string, string, string, string, string];
const defs: Def[] = [
  [9601, 'WB-MUNIC-DIGITAL-SERVICE', 'Prefeitura oferece atendimento digital', 'proporção', 'Existência declarada de canal digital de atendimento à sociedade pela prefeitura; não mede uso, qualidade ou acesso da população.', 'municípios que responderam Sim', 'municípios com resposta Sim ou Não'],
  [9602, 'WB-MUNIC-WEBSITE-ACTIVE', 'Prefeitura mantém página ativa', 'proporção', 'Situação declarada da página da prefeitura na internet; mede existência administrativa, não efetividade do serviço.', 'municípios com página Ativa', 'municípios com resposta válida sobre situação da página'],
  [9603, 'WB-MUNIC-MOBILE-WEBSITE', 'Prefeitura possui website adaptado para celular', 'proporção', 'Website municipal declarado adaptado a dispositivos móveis; não mede acesso efetivo.', 'municípios que responderam Sim', 'municípios com resposta Sim ou Não'],
  [9604, 'WB-MUNIC-WIFI-PUBLIC', 'Município disponibiliza Wi-Fi público', 'proporção', 'Existência declarada de acesso por conexão Wi-Fi disponibilizado pelo município; não mede cobertura ou uso.', 'municípios que responderam Sim', 'municípios com resposta Sim ou Não'],
  [9605, 'WB-MUNIC-WIFI-WHOLE-MUNICIPALITY', 'Wi-Fi público declarado para todo o município', 'proporção', 'Entre municípios com pergunta aplicável, existência declarada de Wi-Fi cobrindo todo o município; “-” é não aplicável e permanece ausente.', 'municípios que responderam Sim', 'municípios com resposta Sim ou Não'],
];

function binary(v: string | null, yes = 'Sim', no = 'Não'): { n: number; d: number; value: number } | null {
  if (v === yes) return { n: 1, d: 1, value: 1 };
  if (v === no) return { n: 0, d: 1, value: 0 };
  return null;
}
function rowFor(id: number, entityId: number, x: any): IndicatorRow {
  const field = ({ 9601: 'digital_service', 9602: 'website_active', 9603: 'mobile_website', 9604: 'wifi_public', 9605: 'wifi_whole_municipality' } as any)[id];
  const raw = x[field] as string | null;
  const b = id === 9602 ? (raw === 'Ativa' ? { n: 1, d: 1, value: 1 } : ['Em manutenção ou reestruturação', 'Não possui página', 'Em elaboração'].includes(raw) ? { n: 0, d: 1, value: 0 } : null) : binary(raw);
  return { indicator_id: id, entity_id: entityId, period_start: PERIOD_START, period_end: PERIOD_END, status: 2, numerator: b?.n ?? null, denominator: b?.d ?? null, value: b?.value ?? null, flags: b ? 0 : 256 };
}

async function main() {
  const st = JSON.parse(await readFile(STAGING, 'utf8')) as Staging;
  const pool = openPool(8);
  const result: any = { phase: 'P12.6', database: 'projetoeleitor_db', dataset: DATASET, competence: COMPETENCE, sourceFiles: st.sourceFiles, sourceStats: st.stats, startedAt: new Date().toISOString(), slices: [], gates: {} };
  const db = (await pool.query(`select current_database(),pg_database_size(current_database())::bigint bytes`)).rows[0];
  if (db.current_database !== 'projetoeleitor_db') throw new Error(`DATABASE_GUARD:${db.current_database}`);
  const before = Number(db.bytes); result.dbBefore = before;

  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    for (let i = 0; i < defs.length; i++) {
      const [id, code, label, unit, note, num, den] = defs[i];
      const old = (await c.query(`select code,method_version,domain from civica_exec.exec_ind_def where indicator_id=$1`, [id])).rows[0];
      if (old && (old.code !== code || old.method_version !== 1 || old.domain !== DOMAIN)) throw new Error(`DEF_CONFLICT:${id}`);
      if (!old) await c.query(`insert into civica_exec.exec_ind_def(indicator_id,code,method_version,domain,sort_order,label,unit,grain,numerator_desc,denominator_desc,min_denominator,ranking_allowed,aggregation_allowed,null_semantics,methodology_note) values($1,$2,1,$3,$4,$5,$6,'A',$7,$8,1,false,true,'missing_not_zero',$9)`, [id, code, DOMAIN, 60 + i, label, unit, num, den, note]);
    }
    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK'); c.release(); throw e; } finally { c.release(); }

  const entities = (await pool.query(`select entity_id,kind,ibge7,uf_code from civica_exec.exec_entity where kind=4`)).rows as any[];
  const byIbge = new Map<number, any>(entities.map(e => [Number(e.ibge7), e]));
  const ufRows = new Map<number, IndicatorRow[]>();
  const unresolved: any[] = [];
  for (const x of st.rows) {
    const e = byIbge.get(Number(x.ibge7));
    if (!e) { unresolved.push(x); continue; }
    const uf = Number(e.uf_code);
    const arr = ufRows.get(uf) ?? [];
    for (const [id] of defs) arr.push(rowFor(id, Number(e.entity_id), x));
    ufRows.set(uf, arr);
  }
  if (unresolved.length) throw new Error(`ENTITY_UNRESOLVED:${unresolved.length}`);
  result.unresolved = 0;
  const sourceHash = st.sourceFiles[0].sha256 as string;
  for (const [uf, rows] of [...ufRows.entries()].sort((a, b) => a[0] - b[0])) {
    const h = sha(JSON.stringify({ sourceHash, dataset: DATASET, uf, competence: COMPETENCE, parser: 'p12.6-munic-xlsx-v1', rows }));
    const r = await publishSlice(pool, { datasetId: DATASET, uf, competence: COMPETENCE, sourceHash: h, parserVersion: 'p12.6-munic-xlsx-v1', bootstrap: true, contiguity: false, tables: [], inputs: { provider: 'IBGE', family: 'MUNIC', edition: 2024, sourceFiles: st.sourceFiles, sheet: st.sheet }, quality: { sourceRows: st.stats.sourceRows, canonicalRows: st.stats.mappedRows, indicators: defs.map(d => d[0]), nullFlag: 256 }, derive: async (tx, runId) => { await upsertIndicators(tx, runId, rows); } });
    result.slices.push({ uf, rows: rows.length, status: r.status, runId: 'runId' in r ? r.runId : null });
  }
  const rc = await pool.connect();
  try {
    await rc.query('BEGIN');
    const f = st.sourceFiles[0];
    const exists = (await rc.query(`select 1 from civica_exec.exec_raw_manifest where sha256=$1::bytea limit 1`, [Buffer.from(f.sha256, 'hex')])).rowCount;
    if (!exists) await rc.query(`insert into civica_exec.exec_raw_manifest(source_url,rel_path,sha256,bytes,competence,fetched_at,state,retention_class) values($1,$2,$3,$4,$5,now(),2,1)`, [f.url, f.path.replace(/^D:\\Civica\\/i, '').replaceAll('\\', '/'), Buffer.from(f.sha256, 'hex'), f.bytes, COMPETENCE]);
    await rc.query('COMMIT');
  } catch (e) { await rc.query('ROLLBACK'); throw e; } finally { rc.release(); }
  const after = Number((await pool.query(`select pg_database_size(current_database())::bigint bytes`)).rows[0].bytes); result.dbAfter = after; result.dbGrowth = after - before;
  result.indicatorCounts = (await pool.query(`select indicator_id,count(*)::int rows,count(distinct entity_id)::int entities,min(period_start)::text first_period,max(period_start)::text last_period,count(*) filter(where value is null)::int nulls from civica_exec.exec_ind_value where indicator_id between 9601 and 9605 group by indicator_id order by indicator_id`)).rows;
  result.publicationSlices = (await pool.query(`select count(*)::int n from civica_exec.exec_publication where dataset_id=$1 and competence=$2`, [DATASET, COMPETENCE])).rows[0].n;
  result.finishedAt = new Date().toISOString();
  console.log(JSON.stringify(result, null, 2));
  await pool.end();
}
main().catch(e => { console.error(e); process.exitCode = 1; });
