import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { DATASET, SPECS, publishSlice, sha256, type Row } from '../../packages/db/src/exec/index.ts';
import { UF_CODE } from '../../apps/collector/src/exec/cnes.ts';
import { recordManifest, registerLocalRaw, storageConfig } from '../../apps/collector/src/exec/storage.ts';
import { getJson, openPool } from './db.ts';

/**
 * População residente estimada (IBGE SIDRA 6579, variável 9324) por UF e ano: uma fatia (dataset população × UF × ano).
 * A resposta bruta de cada UF é preservada em raw/ibge/sidra-6579/ com SHA-256 no manifesto.
 * Uso: node --import tsx scripts/exec/population.ts ES [MG SP ... | ALL]
 */
const arg = process.argv.slice(2).map(u => u.toUpperCase());
const ufs = (arg.includes('ALL') ? Object.keys(UF_CODE) : arg).filter(u => UF_CODE[u]);
const cfg = storageConfig();
const pool = openPool(3);
try {
  const known = new Set((await pool.query('SELECT entity_id FROM civica_exec.exec_entity')).rows.map(r => Number(r.entity_id)));
  for (const uf of ufs) {
    const code = UF_CODE[uf]!;
    const urlM = `https://apisidra.ibge.gov.br/values/t/6579/n6/in%20n3%20${code}/v/9324/p/all`;
    const urlU = `https://apisidra.ibge.gov.br/values/t/6579/n3/${code}/v/9324/p/all`;
    const [m, u] = await Promise.all([getJson<Array<Record<string, string>>>(urlM), getJson<Array<Record<string, string>>>(urlU)]);
    const rel = `ibge/sidra-6579/${uf}_${new Date().toISOString().slice(0, 10)}.json`;
    await mkdir(dirname(join(cfg.rawDir, rel)), { recursive: true });
    await writeFile(join(cfg.rawDir, rel), JSON.stringify({ urls: [urlM, urlU], municipios: m, uf: u }));
    await recordManifest(pool, await registerLocalRaw(cfg, { url: urlM, relPath: rel, competence: null, uf: code, retention: 1, dataset: 'population_sidra' }));
    const byYear = new Map<number, Row[]>();
    for (const r of [...m.slice(1), ...u.slice(1)]) {
      const id = Number(r.D1C), v = Number(r.V), y = Number(r.D3C);
      if (!Number.isFinite(v) || !known.has(id)) continue;
      (byYear.get(y) ?? byYear.set(y, []).get(y)!).push({ entity_id: id, year: y, source: 1, value: Math.round(v) });
    }
    for (const [y, rows] of [...byYear].sort((a, b) => a[0] - b[0])) {
      const res = await publishSlice(pool, { datasetId: DATASET.population_sidra, uf: code, competence: y * 100 + 1, sourceHash: sha256(JSON.stringify(rows)), bootstrap: true, parserVersion: 'sidra-6579-v1', tables: [{ spec: SPECS.population, rows }] });
      if (res.status === 'FAILED_SAFE') throw new Error(res.reason);
    }
    console.log(`${uf}: anos ${[...byYear.keys()].sort().join(',')}`);
    await new Promise(r => setTimeout(r, 1500));
  }
} finally { await pool.end(); }
