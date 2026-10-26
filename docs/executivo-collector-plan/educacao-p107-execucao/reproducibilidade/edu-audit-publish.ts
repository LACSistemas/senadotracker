import { readFile, writeFile } from 'node:fs/promises';
import { DATASET, SPECS, publishSlice, sha256, type Row } from '../../packages/db/src/exec/index.ts';
import { isFirstPublication } from '../../apps/collector/src/exec/seguranca.ts';
import { openPool } from './db.ts';

/**
 * Persiste os veredictos da revisão amostral (exec_edu_contract_audit, dataset 118) e calcula a precisão por faixa com intervalo de Wilson 95%.
 *   npx tsx scripts/exec/edu-audit-publish.ts <veredictos.json> <amostras_v6.json> <delta_new_detail.json> <delta2_new_detail.json> <saida_stats.json> [--publish]
 * Sem --publish só calcula e grava as estatísticas (somente leitura). Publicação: fatia única (uf 0, competência = mês da revisão), idempotente por hash do conteúdo.
 */
const [verdictsFile, samplesFile, deltaFile, delta9File, statsOut] = process.argv.slice(2); const doPublish = process.argv.includes('--publish');
const V = JSON.parse(await readFile(verdictsFile!, 'utf8')) as { data: string; regras_auditadas: string; faixas: Record<string, Record<string, unknown>>; delta_v5: { n: number; fp: number[]; indeterminado: number[]; cat_errada: number[] }; delta_v9: { n: number; fp: number[]; indeterminado: number[]; cat_errada: number[] } };
const S = JSON.parse(await readFile(samplesFile!, 'utf8')) as { faixas: Record<string, { universo: number; amostra: Array<{ id: string }> }> };
const delta = Object.keys(JSON.parse(await readFile(deltaFile!, 'utf8')) as Record<string, unknown>);
const delta9 = Object.keys(JSON.parse(await readFile(delta9File!, 'utf8')) as Record<string, unknown>);
const wilson = (k: number, n: number, z = 1.96): [number, number] => { if (!n) return [0, 0]; const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), r = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [(c - r) / d, (c + r) / d]; };
const idx = (a: unknown): Set<number> => new Set((a as number[] | undefined) ?? []);
const rows: Row[] = []; const stats: Record<string, unknown> = {}; const reviewed = V.data;
for (const [band, x] of Object.entries(V.faixas)) {
  const n = Number(x.n); const items = S.faixas[band]!.amostra.slice(0, n); const neg = band.startsWith('NEG_'); const poss = band === 'POSSIBLE';
  const fp = idx(x.fp), unk = idx(x.indeterminado), cat = idx(x.cat_errada), fn = idx(x.falso_negativo), good = idx(x.educacional), bad = idx(x.nao_educacional);
  items.forEach((it, i) => {
    const verdict = neg ? (fn.has(i) ? 1 : unk.has(i) ? 2 : 0) : poss ? (good.has(i) ? 1 : bad.has(i) ? 0 : 2) : (fp.has(i) ? 0 : unk.has(i) ? 2 : 1);
    rows.push({ pncp_id: it.id, band, verdict, cat_ok: neg || poss || verdict !== 1 ? null : (cat.has(i) ? 0 : 1), note: '', rules: V.regras_auditadas, reviewed_on: reviewed });
  });
  if (neg) { const k = fn.size, u = unk.size; const [lo, hi] = wilson(k, n); stats[band] = { n, universo: x.universo_v7, falsos_negativos: k, indeterminados: u, taxa: k / n, ic95: [lo, hi] }; }
  else if (poss) { const e = good.size, w = bad.size; stats[band] = { n, universo: x.universo_v7, educacional: e, nao_educacional: w, indeterminado: n - e - w, precisao_entre_decididos: e / (e + w), limites_precisao: [e / n, (n - w) / n] }; }
  else { const k = fp.size, u = unk.size, ce = cat.size; const dec = n - u; const [lo, hi] = wilson(dec - k, dec); stats[band] = { n, universo: x.universo_v7, nao_educacional: k, indeterminado: u, precisao: (dec - k) / dec, ic95: [lo, hi], categoria_primaria_correta: 1 - ce / (n - k - u) }; }
}
const d = V.delta_v5; delta.slice(0, d.n).forEach((id, i) => rows.push({ pncp_id: id, band: 'DELTA_V5_NOVOS', verdict: d.fp.includes(i) ? 0 : d.indeterminado.includes(i) ? 2 : 1, cat_ok: d.fp.includes(i) || d.indeterminado.includes(i) ? null : (d.cat_errada.includes(i) ? 0 : 1), note: '', rules: 'edu-ctr-v5', reviewed_on: reviewed }));
const d9 = V.delta_v9; delta9.slice(0, d9.n).forEach((id, i) => rows.push({ pncp_id: id, band: 'DELTA_V9_NOVOS', verdict: d9.fp.includes(i) ? 0 : d9.indeterminado.includes(i) ? 2 : 1, cat_ok: d9.fp.includes(i) || d9.indeterminado.includes(i) ? null : (d9.cat_errada.includes(i) ? 0 : 1), note: '', rules: 'edu-ctr-v7', reviewed_on: reviewed }));
const hi = Object.entries(stats).filter(([b]) => !b.startsWith('NEG_') && b !== 'POSSIBLE') as Array<[string, { universo: number; precisao: number; categoria_primaria_correta: number }]>;
const W = hi.reduce((a, [, s]) => a + s.universo, 0);
stats.ESTRATIFICADO_ALTA_CONFIANCA = { universo: W, precisao_ponderada: hi.reduce((a, [, s]) => a + s.universo * s.precisao, 0) / W, categoria_primaria_ponderada: hi.reduce((a, [, s]) => a + s.universo * s.categoria_primaria_correta, 0) / W,
  categoria_primaria_sem_institucional: (() => { const t = hi.filter(([b]) => b !== 'INSTITUCIONAL_SEM_TEMA'); const w = t.reduce((a, [, s]) => a + s.universo, 0); return t.reduce((a, [, s]) => a + s.universo * s.categoria_primaria_correta, 0) / w; })() };
stats.DELTA_V5_NOVOS = { n: d.n, nao_educacional: d.fp.length, categoria_errada: d.cat_errada.length };
stats.DELTA_V9_NOVOS = { n: d9.n, nao_educacional: d9.fp.length, categoria_errada: d9.cat_errada.length };
stats.itens_persistidos = rows.length;
const uniq = new Map(rows.map(r => [String(r.pncp_id), r])); const final = [...uniq.values()].sort((a, b) => String(a.pncp_id) < String(b.pncp_id) ? -1 : 1);
await writeFile(statsOut!, JSON.stringify({ ...stats, duplicados_descartados: rows.length - final.length }, null, 1));
console.log(JSON.stringify({ itens: final.length, descartados: rows.length - final.length, estratificado: stats.ESTRATIFICADO_ALTA_CONFIANCA }));
if (doPublish) {
  const pool = openPool(2);
  try {
    const comp = Number(reviewed.slice(0, 4)) * 100 + Number(reviewed.slice(5, 7)); const first = await isFirstPublication(pool, DATASET.edu_audit, 0, comp);
    const r = await publishSlice(pool, { datasetId: DATASET.edu_audit, uf: 0, competence: comp, stage: 2, sourceHash: sha256(JSON.stringify(final)), parserVersion: 'edu-audit-1', bootstrap: first, tables: [{ spec: SPECS.edu_audit, rows: final }], inputs: { samples: samplesFile, verdicts: verdictsFile }, quality: { rowsIn: final.length, valid: final.length, rejected: 0, pendingPages: 0 } });
    console.log(JSON.stringify({ status: r.status }));
  } finally { await pool.end(); }
}
