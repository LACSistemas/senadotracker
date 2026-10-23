import { writeFile } from 'node:fs/promises';
import type { Pool } from 'pg';
import { TRA_DEFS, getTrafficMunicipality, getTrafficState, type TrafficOptions } from '../../packages/db/src/exec/index.ts';
import { openPool } from './db.ts';

/** Desempenho dos contratos de leitura de Trânsito: nº de consultas, tempo, payload e planos. Uso: node --import tsx scripts/exec/transito-perf.ts <saida.json> */
const pool = openPool(4); const out = process.argv[2]!;
const counting = (p: Pool) => { const st = { n: 0, ms: 0 }; const wrap = { query: async (...a: unknown[]) => { st.n++; const t = process.hrtime.bigint(); try { return await (p.query as (...x: unknown[]) => Promise<unknown>)(...a); } finally { st.ms += Number(process.hrtime.bigint() - t) / 1e6; } } } as unknown as Pool; return { wrap, st }; };
try {
  const res: Record<string, unknown> = { at: new Date().toISOString() };
  const targets: Array<['estado' | 'municipio', number, string, TrafficOptions?]> = [
    ['estado', 32, 'ES'], ['estado', 35, 'SP'], ['estado', 53, 'DF'], ['estado', 16, 'AP (sem RENAEST)'], ['estado', 35, 'SP — só frota anual', { sources: ['frota'], frequency: 'A' }], ['estado', 35, 'SP — só PRF desde 2024', { sources: ['prf'], from: '2024-01-01' }],
    ['municipio', 3205309, 'Vitória/ES'], ['municipio', 3550308, 'São Paulo/SP'], ['municipio', 3304557, 'Rio de Janeiro/RJ'], ['municipio', 3200359, 'Alto Rio Novo/ES'], ['municipio', 5101837, 'Boa Esperança do Norte/MT'], ['municipio', 5300108, 'Brasília/DF'], ['municipio', 3550308, 'São Paulo — só SIM desde 2020', { sources: ['sim'], from: '2020-01-01' }],
  ];
  const runs: unknown[] = [];
  for (const [kind, id, label, opt] of targets) {
    let last: unknown;
    for (let i = 0; i < 3; i++) {
      const { wrap, st } = counting(pool); const t = process.hrtime.bigint();
      const r = kind === 'estado' ? await getTrafficState(wrap, id, opt) : await getTrafficMunicipality(wrap, id, opt);
      const ms = Number(process.hrtime.bigint() - t) / 1e6;
      if (i === 2) { const j = JSON.stringify(r); const m = r as { sim: unknown[]; renaest: unknown[]; prf: unknown[]; fleet?: { series: unknown[] } }; last = { kind, id, label, filtros: opt ?? null, queries: st.n, wallMs: Number(ms.toFixed(1)), dbMs: Number(st.ms.toFixed(1)), json_bytes: j.length, metricas: { sim: m.sim.length, renaest: m.renaest.length, prf: m.prf.length }, pontosFrota: m.fleet?.series.length ?? 0 }; }
    }
    runs.push(last);
  }
  res.profiles = runs;
  const explain = async (name: string, sql: string, args: unknown[]) => { const r = await pool.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`, args); const p = (r.rows[0] as Record<string, Array<{ Plan: Record<string, unknown>; 'Execution Time': number }>>)['QUERY PLAN']![0]!; const nodes: string[] = []; const walk = (n: Record<string, unknown>) => { nodes.push(`${n['Node Type']}${n['Index Name'] ? ' on ' + n['Index Name'] : n['Relation Name'] ? ' on ' + n['Relation Name'] : ''}`); for (const c of (n.Plans as Array<Record<string, unknown>> | undefined) ?? []) walk(c); }; walk(p.Plan); return { name, executionMs: p['Execution Time'], plan: nodes }; };
  const ids = TRA_DEFS.map(d => d.id);
  res.plans = [
    await explain('séries do território em exec_ind_value (município)', `SELECT indicator_id, period_start, status, numerator, denominator, value, flags FROM civica_exec.exec_ind_value WHERE entity_id = $1 AND indicator_id = ANY($2::smallint[]) ORDER BY indicator_id, period_start`, [3205309, ids]),
    await explain('frota do município (série mensal completa)', `SELECT * FROM civica_exec.exec_tra_frota_mun_mes WHERE entity_id = $1 ORDER BY competence`, [3205309]),
    await explain('frota da UF agregada por competência (SP)', `SELECT f.competence, sum(f.total) FROM civica_exec.exec_tra_frota_mun_mes f JOIN civica_exec.exec_entity e ON e.entity_id = f.entity_id WHERE e.uf_code = $1 AND e.kind IN (4, 5) GROUP BY f.competence ORDER BY f.competence`, [35]),
    await explain('cobertura RENAEST/PRF da UF', `SELECT source, competence, records, fatal_records, municipalities, universe, scope FROM civica_exec.exec_tra_cov WHERE uf = $1 ORDER BY source, competence`, [32]),
    await explain('códigos de infração do último mês da UF', `SELECT cod_infracao, qtde FROM civica_exec.exec_tra_infr_uf_mes WHERE uf = $1 AND competence = (SELECT max(competence) FROM civica_exec.exec_tra_infr_uf_mes WHERE uf = $1) ORDER BY qtde DESC LIMIT 15`, [32]),
  ];
  await writeFile(out, JSON.stringify(res, null, 1)); console.log(JSON.stringify(res, null, 1).slice(0, 5000));
} finally { await pool.end(); }
