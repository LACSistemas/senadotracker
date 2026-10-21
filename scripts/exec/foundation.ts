import { applyExecMigrations, buildTerritory, DATASET, seedTerritory, SPECS, publishSlice, sha256, type IbgeEstado, type IbgeMunicipio, type IbgeRegiao, type Row } from '../../packages/db/src/exec/index.ts';
import { getJson, openPool } from './db.ts';

/**
 * Fase 0: migrations do schema civica_exec + território do IBGE + população estimada (SIDRA 6579).
 * Uso: node --import tsx scripts/exec/foundation.ts [--apply]   (sem --apply apenas valida o catálogo e imprime o plano)
 */
const apply = process.argv.includes('--apply');
const IBGE = 'https://servicodados.ibge.gov.br/api/v1/localidades';
const [municipios, estados, regioes] = await Promise.all([getJson<IbgeMunicipio[]>(`${IBGE}/municipios`), getJson<IbgeEstado[]>(`${IBGE}/estados`), getJson<IbgeRegiao[]>(`${IBGE}/regioes`)]);
const territory = buildTerritory(municipios, estados, regioes);
console.log(`catálogo IBGE: ${municipios.length} municípios, ${estados.length} UFs, ${regioes.length} regiões → ${territory.entities.length} entidades; erros: ${territory.errors.length}`);
if (territory.errors.length) { console.error(territory.errors); process.exit(2); }
if (territory.entities.length !== 5631) { console.error(`esperado 5.631 entidades (1 + 5 + 27 + 5.571 + 27; os docs da revisão 2 diziam 5.667 por erro de soma), obtido ${territory.entities.length}`); process.exit(2); }
if (!apply) { console.log('dry-run: nada gravado (use --apply)'); process.exit(0); }

const pool = openPool(4);
try {
  const db = (await pool.query('SELECT current_database() d')).rows[0].d;
  console.log(`banco: ${db}; migrations aplicadas agora:`, await applyExecMigrations(pool));
  const seed = await seedTerritory(pool, territory, 202610);
  console.log('território:', seed.status);

  // População estimada IBGE (SIDRA tabela 6579, variável 9324): municípios (n6) e UFs (n3), último ano disponível.
  const [pm, pu] = await Promise.all([getJson<Array<Record<string, string>>>('https://apisidra.ibge.gov.br/values/t/6579/n6/all/v/9324/p/last'), getJson<Array<Record<string, string>>>('https://apisidra.ibge.gov.br/values/t/6579/n3/all/v/9324/p/last')]);
  const rows: Row[] = []; const known = new Set(territory.entities.map(e => Number(e.entity_id))); const missing: string[] = [];
  let year = 0;
  for (const r of [...pm.slice(1), ...pu.slice(1)]) {
    const id = Number(r.D1C); const v = Number(r.V); year = Number(r.D3C);
    if (!Number.isFinite(v)) continue;
    if (!known.has(id)) { missing.push(r.D1C ?? '?'); continue; }
    rows.push({ entity_id: id, year, source: 1, value: Math.round(v) });
  }
  if (missing.length) { console.error('códigos SIDRA sem entidade:', missing.slice(0, 10)); process.exit(3); }
  const pop = await publishSlice(pool, { datasetId: DATASET.population_sidra, uf: 0, competence: year * 100 + 1, sourceHash: sha256(JSON.stringify(rows)), bootstrap: true, parserVersion: 'sidra-6579-v1', tables: [{ spec: SPECS.population, rows }] });
  console.log(`população ${year}: ${rows.length} linhas →`, pop.status);
} finally { await pool.end(); }
