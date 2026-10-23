import { writeFile } from 'node:fs/promises';
import type { Pool } from 'pg';
import { SEG_DEFS, SIM_OCC_IDS, SIM_RES_IDS, getSegMunicipality, getSegState } from '../../packages/db/src/exec/index.ts';
import { openPool } from './db.ts';

/** Desempenho dos contratos de leitura de Segurança (G12): nº de consultas, tempo real e planos das consultas principais. Uso: node --import tsx scripts/exec/seguranca-perf.ts <saida.json> */
const pool = openPool(4); const out = process.argv[2];
const counting = (p: Pool) => { const st = { n: 0, ms: 0 }; const wrap = { query: async (...a: unknown[]) => { st.n++; const t = process.hrtime.bigint(); try { return await (p.query as (...x: unknown[]) => Promise<unknown>)(...a); } finally { st.ms += Number(process.hrtime.bigint() - t) / 1e6; } } } as unknown as Pool; return { wrap, st }; };
const time = async <T>(f: () => Promise<T>) => { const t = process.hrtime.bigint(); const r = await f(); return { r, ms: Number(process.hrtime.bigint() - t) / 1e6 }; };
try {
  const res: Record<string, unknown> = { at: new Date().toISOString() };
  const targets = [['estado', 32, 'ES'], ['estado', 35, 'SP'], ['estado', 53, 'DF'], ['estado', 14, 'RR'], ['municipio', 3205309, 'Vitória/ES'], ['municipio', 3550308, 'São Paulo/SP'], ['municipio', 3304557, 'Rio de Janeiro/RJ'], ['municipio', 3200359, 'Alto Rio Novo/ES (pequeno)'], ['municipio', 5101837, 'Boa Esperança do Norte/MT'], ['municipio', 5300108, 'Brasília/DF']] as const;
  const runs: unknown[] = [];
  for (const [kind, id, label] of targets) {
    for (let i = 0; i < 3; i++) {
      const { wrap, st } = counting(pool);
      const { r, ms } = await time(() => kind === 'estado' ? getSegState(wrap, id) : getSegMunicipality(wrap, id));
      if (i === 2) runs.push({ kind, id, label, queries: st.n, wallMs: Number(ms.toFixed(1)), dbMs: Number(st.ms.toFixed(1)), metrics: r ? (r as { metrics: unknown[] }).metrics.length : null, points: r ? (r as { metrics: Array<{ series: unknown[] }> }).metrics.reduce((n, m) => n + m.series.length, 0) : null, json_bytes: r ? JSON.stringify(r).length : null });
    }
  }
  res.profiles = runs;
  const explain = async (name: string, sql: string, args: unknown[]) => { const r = await pool.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`, args); const p = (r.rows[0] as Record<string, Array<{ Plan: Record<string, unknown>; 'Execution Time': number; 'Planning Time': number }>>)['QUERY PLAN']![0]!; const nodes: string[] = []; const walk = (n: Record<string, unknown>) => { nodes.push(`${n['Node Type']}${n['Index Name'] ? ' on ' + n['Index Name'] : n['Relation Name'] ? ' on ' + n['Relation Name'] : ''}`); for (const c of (n.Plans as Array<Record<string, unknown>> | undefined) ?? []) walk(c); }; walk(p.Plan); return { name, executionMs: p['Execution Time'], planningMs: p['Planning Time'], plan: nodes }; };
  const ids = SEG_DEFS.map(d => d.id);
  res.plans = [
    await explain('série de um território (estado ou município): todos os indicadores de Segurança', `SELECT indicator_id, period_start, status, numerator, denominator, value, flags FROM civica_exec.exec_ind_value WHERE entity_id = $1 AND indicator_id = ANY($2::smallint[]) ORDER BY indicator_id, period_start`, [3205309, ids]),
    await explain('série de uma UF (município de grande porte ou UF)', `SELECT indicator_id, period_start, status, numerator, denominator, value, flags FROM civica_exec.exec_ind_value WHERE entity_id = $1 AND indicator_id = ANY($2::smallint[]) ORDER BY indicator_id, period_start`, [35, ids]),
    await explain('cobertura mensal do VDE da UF', `SELECT indicator_id, competence, mun_pairs, status FROM civica_exec.exec_seg_cov WHERE uf = $1 AND indicator_id = ANY($2::smallint[]) ORDER BY indicator_id, competence`, [32, ids]),
    await explain('fontes publicadas (SIM e VDE)', `SELECT dataset_id, max(competence), max(stage), max(activated_at) FROM civica_exec.exec_publication WHERE dataset_id = ANY($1::smallint[]) AND (uf = $2 OR uf = 0) GROUP BY dataset_id`, [[15, 16, 17], 32]),
    await explain('último valor (exec_ind_latest) de um indicador para todos os municípios de uma UF', `SELECT l.entity_id, l.value FROM civica_exec.exec_ind_latest l JOIN civica_exec.exec_entity e ON e.entity_id = l.entity_id WHERE l.indicator_id = 3001 AND e.uf_code = $1 AND e.kind = 4`, [32]),
  ];
  res.contractIds = { sim: [...SIM_RES_IDS, ...SIM_OCC_IDS].length, vde: SEG_DEFS.filter(d => d.source === 'VDE').length };
  await writeFile(out!, JSON.stringify(res, null, 1)); console.log(JSON.stringify(res, null, 1).slice(0, 6000));
} finally { await pool.end(); }
