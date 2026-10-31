import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { openPool } from './db.ts';
import { publishSlice, type IndicatorRow } from '../../packages/db/src/exec/publication.ts';

const STAGING = 'D:\\Civica\\staging\\infraestrutura\\mobilidade\\p134_municip_transport_rows.json';
const DATASET = 141;
const DOMAIN = 5;
const COMPETENCE = 202412;
const PERIOD_START = '2024-12-31';
const PERIOD_END = '2025-01-01';
const FLAG_UNAVAILABLE = 256;
const FLAG_NOT_INFORMED = 512;
const FLAG_REFUSED = 1024;
const FLAG_INEXISTENT = 2048;
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

type Staging = { sourceFiles: any[]; edition: number; sheet: string; rows: any[]; stats: any };
type Def = readonly [number, string, string, string, string, string, string];
const defs: Def[] = [
  [10601, 'IND-MOB-MUNIC-ESTRUTURA-TRANSPORTE', 'Município possui estrutura organizacional de transporte', 'proporção', 'municípios que declararam estrutura específica de transporte', 'municípios com resposta válida sobre estrutura', 'Existência administrativa declarada no MUNIC 2024; não mede qualidade, capacidade operacional ou atendimento da população.'],
  [10602, 'IND-MOB-MUNIC-PLANO-TRANSPORTE', 'Município possui Plano Municipal de Transporte', 'proporção', 'municípios que declararam Sim', 'municípios com resposta Sim ou Não', 'Declaração da prefeitura sobre existência do plano; não valida conteúdo, execução ou vigência.'],
  [10603, 'IND-MOB-MUNIC-CONSELHO-TRANSPORTE', 'Município possui Conselho Municipal de Transporte', 'proporção', 'municípios que declararam Sim', 'municípios com resposta Sim ou Não', 'Existência declarada de conselho; não mede atividade, composição ou efetividade.'],
  [10604, 'IND-MOB-MUNIC-FUNDO-TRANSPORTE', 'Município possui Fundo Municipal de Transporte', 'proporção', 'municípios que declararam Sim', 'municípios com resposta Sim ou Não', 'Existência declarada de fundo; não mede saldo, execução ou ações financiadas.'],
  [10605, 'IND-MOB-MUNIC-ONIBUS-INTRAMUNICIPAL', 'Município possui transporte coletivo por ônibus intramunicipal', 'proporção', 'municípios que declararam Sim', 'municípios com resposta Sim ou Não', 'Serviço declarado no MUNIC; não informa frota operacional, passageiros ou cobertura territorial.'],
  [10606, 'IND-MOB-MUNIC-ONIBUS-INTERMUNICIPAL', 'Município possui transporte coletivo por ônibus intermunicipal', 'proporção', 'municípios que declararam Sim', 'municípios com resposta Sim ou Não', 'Serviço declarado no MUNIC; não atribui operação ao município nem mede frequência.'],
  [10607, 'IND-MOB-MUNIC-CICLOVIA', 'Município possui ciclovia', 'proporção', 'municípios que declararam Sim', 'municípios com resposta Sim ou Não', 'Infraestrutura cicloviária declarada; não mede extensão, qualidade ou uso.'],
  [10608, 'IND-MOB-MUNIC-CICLOFAIXA', 'Município possui ciclofaixa', 'proporção', 'municípios que declararam Sim', 'municípios com resposta Sim ou Não', 'Infraestrutura cicloviária declarada; não mede extensão, qualidade ou uso.'],
  [10609, 'IND-MOB-MUNIC-CICLORROTA', 'Município possui ciclorrota', 'proporção', 'municípios que declararam Sim', 'municípios com resposta Sim ou Não', 'Infraestrutura cicloviária declarada; não mede extensão, qualidade ou uso.'],
  [10610, 'IND-MOB-MUNIC-PLANO-CICLOVIARIO', 'Município possui plano ou plano diretor cicloviário', 'proporção', 'municípios que declararam Sim', 'municípios com resposta Sim ou Não', 'Instrumento declarado no MUNIC; não valida implementação.'],
  [10611, 'IND-MOB-MUNIC-BICICLETARIO', 'Município possui bicicletário público', 'proporção', 'municípios que declararam Sim', 'municípios com resposta Sim ou Não', 'Existência declarada; não mede quantidade, capacidade ou uso.'],
  [10612, 'IND-MOB-MUNIC-INTERMUNICIPAL-DESLOCAMENTO-LOCAL', 'Transporte intermunicipal atende deslocamentos locais', 'proporção', 'municípios que declararam Sim', 'municípios com resposta Sim ou Não', 'Pergunta condicional ao transporte intermunicipal; “-” é não aplicável e permanece ausente.'],
];
const fieldById: Record<number, string> = { 10601: 'Mtra01', 10602: 'Mtra07', 10603: 'Mtra10', 10604: 'Mtra16', 10605: 'Mtra19', 10606: 'Mtra23', 10607: 'Mtra24a1', 10608: 'Mtra24a2', 10609: 'Mtra24a3', 10610: 'Mtra24a4', 10611: 'Mtra25', 10612: 'Mtra231' };
const norm = (v: unknown) => String(v ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
function answer(raw: unknown, id: number): { n: number | null; d: number | null; value: number | null; flags: number } {
  const v = norm(raw);
  if (id === 10601) {
    if (v === 'NAO POSSUI ESTRUTURA') return { n: 0, d: 1, value: 0, flags: 0 };
    if (v && !['RECUSA', 'NAO INFORMOU'].includes(v)) return { n: 1, d: 1, value: 1, flags: 0 };
  } else {
    if (v === 'SIM') return { n: 1, d: 1, value: 1, flags: 0 };
    if (v === 'NAO') return { n: 0, d: 1, value: 0, flags: 0 };
  }
  if (v === '-') return { n: null, d: null, value: null, flags: FLAG_INEXISTENT };
  if (v === 'RECUSA') return { n: null, d: null, value: null, flags: FLAG_REFUSED };
  if (v === 'NAO INFORMOU' || !v) return { n: null, d: null, value: null, flags: FLAG_NOT_INFORMED };
  return { n: null, d: null, value: null, flags: FLAG_UNAVAILABLE };
}

async function bulkIndicators(c: any, runId: number, rows: IndicatorRow[]) {
  await c.query(`CREATE TEMP TABLE stg_p134_ind (indicator_id smallint, entity_id integer, period_start date, period_end date, status smallint, numerator double precision, denominator double precision, value double precision, flags smallint) ON COMMIT DROP`);
  for (let i = 0; i < rows.length; i += 5000) {
    await c.query(`INSERT INTO stg_p134_ind SELECT * FROM jsonb_populate_recordset(NULL::stg_p134_ind, $1::jsonb)`, [JSON.stringify(rows.slice(i, i + 5000))]);
  }
  await c.query(`INSERT INTO civica_exec.exec_ind_value (indicator_id,entity_id,period_start,period_end,status,numerator,denominator,value,flags,run_id)
    SELECT indicator_id,entity_id,period_start,period_end,status,numerator,denominator,value,flags,$1 FROM stg_p134_ind
    ON CONFLICT (indicator_id,entity_id,period_start) DO UPDATE SET period_end=EXCLUDED.period_end,status=EXCLUDED.status,numerator=EXCLUDED.numerator,denominator=EXCLUDED.denominator,value=EXCLUDED.value,flags=EXCLUDED.flags,run_id=EXCLUDED.run_id`, [runId]);
  await c.query(`DELETE FROM civica_exec.exec_ind_latest l USING (SELECT DISTINCT indicator_id,entity_id FROM stg_p134_ind) s WHERE l.indicator_id=s.indicator_id AND l.entity_id=s.entity_id`);
  await c.query(`INSERT INTO civica_exec.exec_ind_latest (indicator_id,entity_id,period_start,status,value,numerator,denominator,flags,run_id,published_at)
    SELECT DISTINCT ON (v.indicator_id,v.entity_id) v.indicator_id,v.entity_id,v.period_start,v.status,v.value,v.numerator,v.denominator,v.flags,v.run_id,now() FROM civica_exec.exec_ind_value v
    JOIN (SELECT DISTINCT indicator_id,entity_id FROM stg_p134_ind) s ON s.indicator_id=v.indicator_id AND s.entity_id=v.entity_id
    ORDER BY v.indicator_id,v.entity_id,(v.status=2) DESC,v.period_start DESC
    ON CONFLICT (indicator_id,entity_id) DO UPDATE SET period_start=EXCLUDED.period_start,status=EXCLUDED.status,value=EXCLUDED.value,numerator=EXCLUDED.numerator,denominator=EXCLUDED.denominator,flags=EXCLUDED.flags,run_id=EXCLUDED.run_id,published_at=EXCLUDED.published_at`);
}

async function main() {
  const st = JSON.parse(await readFile(STAGING, 'utf8')) as Staging;
  const pool = openPool(8);
  const result: any = { phase: 'P13.4', database: 'projetoeleitor_db', dataset: DATASET, competence: COMPETENCE, sourceFiles: st.sourceFiles, sourceStats: st.stats, startedAt: new Date().toISOString(), slices: [] };
  const db = (await pool.query(`select current_database(),pg_database_size(current_database())::bigint bytes`)).rows[0];
  if (db.current_database !== 'projetoeleitor_db') throw new Error(`DATABASE_GUARD:${db.current_database}`);
  const before = Number(db.bytes); result.dbBefore = before;
  const defClient = await pool.connect();
  try {
    await defClient.query('BEGIN');
    for (const [id, code, label, unit, num, den, note] of defs) {
      await defClient.query(`INSERT INTO civica_exec.exec_ind_def(indicator_id,code,method_version,domain,sort_order,label,unit,grain,numerator_desc,denominator_desc,min_denominator,ranking_allowed,aggregation_allowed,null_semantics,methodology_note)
        VALUES($1,$2,1,$3,$1,$4,$5,'A',$6,$7,1,false,true,'missing_not_zero',$8)
        ON CONFLICT(indicator_id) DO UPDATE SET code=EXCLUDED.code,domain=EXCLUDED.domain,label=EXCLUDED.label,unit=EXCLUDED.unit,numerator_desc=EXCLUDED.numerator_desc,denominator_desc=EXCLUDED.denominator_desc,methodology_note=EXCLUDED.methodology_note`, [id, code, DOMAIN, label, unit, num, den, note]);
    }
    await defClient.query('COMMIT');
  } catch (e) { await defClient.query('ROLLBACK'); throw e; } finally { defClient.release(); }

  const entities = (await pool.query(`select entity_id,ibge7,uf_code from civica_exec.exec_entity where kind=4`)).rows as any[];
  const byIbge = new Map<number, any>(entities.map(e => [Number(e.ibge7), e]));
  const byUf = new Map<number, IndicatorRow[]>();
  let unresolved = 0;
  for (const x of st.rows) {
    const e = byIbge.get(Number(x.ibge7));
    if (!e) { unresolved++; continue; }
    const rows = byUf.get(Number(e.uf_code)) ?? [];
    for (const [id] of defs) { const a = answer(x[fieldById[id]], id); rows.push({ indicator_id: id, entity_id: Number(e.entity_id), period_start: PERIOD_START, period_end: PERIOD_END, status: 2, numerator: a.n, denominator: a.d, value: a.value, flags: a.flags }); }
    byUf.set(Number(e.uf_code), rows);
  }
  if (unresolved) throw new Error(`ENTITY_UNRESOLVED:${unresolved}`);
  result.unresolved = unresolved;
  const baseHash = st.sourceFiles[0].sha256 as string;
  for (const [uf, rows] of [...byUf.entries()].sort((a, b) => a[0] - b[0])) {
    const sourceHash = sha(JSON.stringify({ baseHash, tableHash: st.sourceFiles[1].sha256, dataset: DATASET, uf, competence: COMPETENCE, parser: 'p13.4-munic-transport-v1' }));
    const r = await publishSlice(pool, { datasetId: DATASET, uf, competence: COMPETENCE, sourceHash, parserVersion: 'p13.4-munic-transport-v1', bootstrap: true, contiguity: false, tables: [], inputs: { provider: 'IBGE', family: 'MUNIC', edition: 2024, sourceFiles: st.sourceFiles, sheet: st.sheet, indicators: defs.map(d => d[0]) }, quality: { sourceRows: st.stats.sourceRows, canonicalRows: st.stats.mappedRows, unresolved, nullFlags: [FLAG_UNAVAILABLE, FLAG_NOT_INFORMED, FLAG_REFUSED, FLAG_INEXISTENT] }, derive: async (tx, runId) => { await bulkIndicators(tx, runId, rows); } });
    result.slices.push({ uf, rows: rows.length, status: r.status, runId: 'runId' in r ? r.runId : null });
  }
  const manifest = await pool.connect();
  try {
    await manifest.query('BEGIN');
    const firstRun = result.slices.find((x: any) => x.runId)?.runId ?? null;
    for (const f of st.sourceFiles) await manifest.query(`INSERT INTO civica_exec.exec_raw_manifest(run_id,source_url,rel_path,sha256,bytes,competence,fetched_at,state,retention_class) VALUES($1,$2,$3,$4::bytea,$5,$6,now(),2,1) ON CONFLICT(sha256) DO UPDATE SET run_id=EXCLUDED.run_id,source_url=EXCLUDED.source_url,rel_path=EXCLUDED.rel_path,competence=EXCLUDED.competence,state=EXCLUDED.state`, [firstRun, f.url, f.path.replace(/^D:\\Civica\\/i, '').replaceAll('\\', '/'), Buffer.from(f.sha256, 'hex'), f.bytes, COMPETENCE]);
    await manifest.query('COMMIT');
  } catch (e) { await manifest.query('ROLLBACK'); throw e; } finally { manifest.release(); }
  const after = Number((await pool.query(`select pg_database_size(current_database())::bigint bytes`)).rows[0].bytes); result.dbAfter = after; result.dbGrowth = after - before;
  result.indicatorCounts = (await pool.query(`select indicator_id,count(*)::int rows,count(distinct entity_id)::int entities,min(period_start)::text first_period,max(period_start)::text last_period,count(*) filter(where value is null)::int nulls from civica_exec.exec_ind_value where indicator_id between 10601 and 10612 group by indicator_id order by indicator_id`)).rows;
  result.publicationSlices = (await pool.query(`select count(*)::int n from civica_exec.exec_publication where dataset_id=$1 and competence=$2`, [DATASET, COMPETENCE])).rows[0].n;
  result.finishedAt = new Date().toISOString();
  console.log(JSON.stringify(result, null, 2));
  await pool.end();
}
main().catch(e => { console.error(e); process.exitCode = 1; });
