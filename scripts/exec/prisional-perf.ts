import { writeFile } from 'node:fs/promises';
import type { Pool } from 'pg';
import { PRI_DEFS, PRI_IDS, getPrisonMunicipality, getPrisonNational, getPrisonState } from '../../packages/db/src/exec/index.ts';
import { openPool } from './db.ts';

/** Desempenho dos contratos de leitura de prisional (G13): nº de consultas, tempo real, bytes de JSON e planos das consultas principais. Uso: node --import tsx scripts/exec/prisional-perf.ts <saida.json> */
const pool = openPool(4); const out = process.argv[2];
const counting = (p: Pool) => { const st = { n: 0, ms: 0 }; const wrap = { query: async (...a: unknown[]) => { st.n++; const t = process.hrtime.bigint(); try { return await (p.query as (...x: unknown[]) => Promise<unknown>)(...a); } finally { st.ms += Number(process.hrtime.bigint() - t) / 1e6; } } } as unknown as Pool; return { wrap, st }; };
const time = async <T>(f: () => Promise<T>) => { const t = process.hrtime.bigint(); const r = await f(); return { r, ms: Number(process.hrtime.bigint() - t) / 1e6 }; };
try {
  const res: Record<string, unknown> = { at: new Date().toISOString() };
  const targets: Array<['estado' | 'municipio' | 'brasil', number, string]> = [['estado', 32, 'ES'], ['estado', 35, 'SP'], ['estado', 11, 'RO'], ['estado', 53, 'DF'], ['municipio', 3205309, 'Vitória/ES'], ['municipio', 3550308, 'São Paulo/SP'], ['municipio', 3304557, 'Rio de Janeiro/RJ'], ['municipio', 3200359, 'Alto Rio Novo/ES'], ['municipio', 1100015, 'Alta Floresta D\'Oeste/RO'], ['brasil', 0, 'Brasil']];
  const runs: unknown[] = [];
  for (const [kind, id, label] of targets) {
    const walls: number[] = []; let last: { queries: number; dbMs: number; bytes: number; points: number } | null = null;
    for (let i = 0; i < 7; i++) {
      const { wrap, st } = counting(pool);
      const { r, ms } = await time(() => kind === 'estado' ? getPrisonState(wrap, id) : kind === 'municipio' ? getPrisonMunicipality(wrap, id) : getPrisonNational(wrap));
      walls.push(ms); const json = JSON.stringify(r);
      last = { queries: st.n, dbMs: Number(st.ms.toFixed(1)), bytes: Buffer.byteLength(json), points: (json.match(/"value"/g) ?? []).length };
    }
    const sorted = [...walls.slice(1)].sort((a, b) => a - b);   // descarta a 1ª (aquecimento)
    runs.push({ kind, id, label, ...last, wallMsMedian: Number(sorted[Math.floor(sorted.length / 2)]!.toFixed(1)), wallMsMax: Number(sorted.at(-1)!.toFixed(1)), wallMsFirst: Number(walls[0]!.toFixed(1)) });
  }
  res.profiles = runs;
  const explain = async (name: string, sql: string, args: unknown[]) => { const r = await pool.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`, args); const p = (r.rows[0] as Record<string, Array<{ Plan: Record<string, unknown>; 'Execution Time': number }>>)['QUERY PLAN']![0]!;
    return { name, executionMs: p['Execution Time'], node: p.Plan['Node Type'], index: p.Plan['Index Name'] ?? null, rows: p.Plan['Actual Rows'], sharedHit: p.Plan['Shared Hit Blocks'], sharedRead: p.Plan['Shared Read Blocks'] }; };
  const ids = PRI_IDS; const munEnt = (await pool.query(`SELECT entity_id FROM civica_exec.exec_entity WHERE ibge7 = 3550308 AND kind = 4`)).rows[0].entity_id;
  res.plans = [
    await explain('UF: série de todos os indicadores prisionais de uma UF (entidade × indicadores × períodos)', `SELECT indicator_id, period_start, period_end, value, numerator, denominator, flags FROM civica_exec.exec_ind_value WHERE entity_id = $1 AND indicator_id = ANY($2::smallint[]) ORDER BY indicator_id, period_start`, [(await pool.query(`SELECT entity_id FROM civica_exec.exec_entity WHERE kind = 3 AND uf_code = 35`)).rows[0].entity_id, ids]),
    await explain('município: observações das unidades de São Paulo (índice parcial entity_id, competence)', `SELECT unit_id, competence, source_name, tipo, ambito FROM civica_exec.exec_pri_obs WHERE entity_id = $1 ORDER BY unit_id, competence`, [munEnt]),
    await explain('município: fatos de capacidade/população das unidades de um município (3 medidas)', `SELECT f.unit_id, f.competence, f.measure_id, f.value FROM civica_exec.exec_pri_fact f WHERE f.measure_id = ANY($2::smallint[]) AND f.unit_id IN (SELECT unit_id FROM civica_exec.exec_pri_obs WHERE entity_id = $1)`, [munEnt, [122, 123, 243]]),
    await explain('cobertura por UF e ciclo', `SELECT * FROM civica_exec.exec_pri_cov WHERE uf = $1 ORDER BY competence`, [35]),
    await explain('publicações do sistema prisional', `SELECT dataset_id, count(*), max(competence), max(activated_at) FROM civica_exec.exec_publication WHERE dataset_id IN (28, 29) AND (uf = $1 OR uf = 0) GROUP BY dataset_id`, [35]),
  ];
  res.contract = { indicators: PRI_DEFS.length };
  await writeFile(out!, JSON.stringify(res, null, 1)); console.log(JSON.stringify(res, null, 1).slice(0, 5000));
} finally { await pool.end(); }
