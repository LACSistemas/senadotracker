import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchRaw, recordManifest, storageConfig } from '../../apps/collector/src/exec/storage.ts';
import { openPool } from './db.ts';

/**
 * Piloto APS (e-Gestor, cobertura potencial da APS) de uma UF: preserva as respostas RAW (UF e município, série completa) e reconcilia
 * contra o IBGE e contra o próprio cálculo da fonte. NÃO publica indicadores: a metodologia (cobertura potencial pode passar de 100%) segue pendente.
 * Uso: node --import tsx scripts/exec/aps-pilot.ts ES 202101 202608
 */
const [uf, from, to] = process.argv.slice(2);
const cfg = storageConfig(); const pool = openPool(2);
const API = 'https://relatorioaps-prd.saude.gov.br/cobertura/aps';
const ufCode = (await pool.query(`SELECT entity_id FROM civica_exec.exec_entity WHERE kind = 3 AND uf = $1`, [uf])).rows[0].entity_id as number;
try {
  const got: Record<string, Array<Record<string, unknown>>> = {};
  for (const level of ['UF', 'MUNICIPIO']) {
    const f = await fetchRaw(cfg, { url: `${API}?unidadeGeografica=${level}&coUf=${ufCode}&nuCompInicio=${from}&nuCompFim=${to}`, relPath: `egestor-aps/${uf}/aps_${level.toLowerCase()}_${from}-${to}.json`, competence: Number(to), uf: ufCode, retention: 1, dataset: 'aps', dedupeByHash: true });
    await recordManifest(pool, f);
    got[level] = JSON.parse(await readFile(join(cfg.rawDir, f.relPath), 'utf8'));
    console.log(level, f.reused ? 'reusado' : 'baixado', f.bytes, 'B', f.sha256.slice(0, 12), got[level]!.length, 'linhas');
    await new Promise(r => setTimeout(r, 3000));
  }
  const mun = got.MUNICIPIO!; const num = (v: unknown) => Number(v);
  const months = [...new Set(mun.map(r => String(r.nuComp)))].sort((a, b) => a.slice(3).concat(a.slice(0, 2)).localeCompare(b.slice(3).concat(b.slice(0, 2))));
  const munis = new Set(mun.map(r => String(r.coMunicipioIbge)));
  const ibge = new Map((await pool.query(`SELECT x.code, e.entity_id FROM civica_exec.exec_entity_external_id x JOIN civica_exec.exec_entity e USING (entity_id) WHERE x.source = 1 AND x.valid_to IS NULL AND e.kind = 4 AND e.uf_code = $1`, [ufCode])).rows.map(r => [String(r.code), Number(r.entity_id)]));
  const unknown = [...munis].filter(m => !ibge.has(m));
  const missing = [...ibge.keys()].filter(m => !munis.has(m));
  let recomputeBad = 0, above100 = 0, zeroPop = 0, rows = 0;
  for (const r of mun) { rows++; const pop = num(r.qtPopulacao); if (!pop) { zeroPop++; continue; } const c = num(r.qtCapacidadeEquipe) / pop * 100; if (Math.abs(c - num(r.qtCobertura)) > 0.01) recomputeBad++; if (num(r.qtCobertura) > 100) above100++; }
  // soma municipal × linha da UF no último mês
  const lastM = months.at(-1)!; const sumPop = mun.filter(r => r.nuComp === lastM).reduce((n, r) => n + num(r.qtPopulacao), 0);
  const ufRow = got.UF!.find(r => r.nuComp === lastM);
  const rep = { uf, ufCode, from, to, months: months.length, first: months[0], last: lastM, municipiosNaFonte: munis.size, municipiosIbge: ibge.size, foraDoIbge: unknown, semLinha: missing, linhas: rows, popZero: zeroPop,
    coberturaRecalculadaDivergente: recomputeBad, acima100: above100, pctAcima100: +(above100 / rows * 100).toFixed(1), somaPopMunicipios: sumPop, popLinhaUF: ufRow?.qtPopulacao, origensPop: [...new Set(mun.map(r => r.tpOrigemBasePopulacao))], anosRefPop: [...new Set(mun.map(r => r.nuAnoReferencia))] };
  console.log(JSON.stringify(rep));
  await mkdir('docs/executivo-collector-plan/execucao/saude-nacional-p1', { recursive: true });
  await writeFile(`docs/executivo-collector-plan/execucao/saude-nacional-p1/aps_piloto_${uf}.json`, JSON.stringify(rep, null, 2));
} finally { await pool.end(); }
