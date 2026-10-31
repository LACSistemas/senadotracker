import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { openPool } from './db.ts';
import { publishSlice, upsertIndicators } from '../../packages/db/src/exec/index.ts';

const ST = 'D:/Civica/staging/infraestrutura/recursos_hidricos';
const COMPETENCE = 202610;
const PERIOD = '2026-10-01';
const PERIOD_END = '2026-11-01';
const pool = openPool(4);

type AnyRow = Record<string, any>;
const readJson = async (name: string): Promise<any> => JSON.parse(await readFile(`${ST}/${name}`, 'utf8'));
const fileHash = async (name: string): Promise<string> => createHash('sha256').update(await readFile(`${ST}/${name}`)).digest('hex');
const normalize = (value: unknown): string => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const sourceValue = (value: unknown): string | null => value == null || String(value).trim() === '' ? null : String(value).trim();
const dateValue = (value: unknown): string | null => {
  if (value == null || String(value).trim() === '') return null;
  const text = String(value).trim();
  if (/^\d{8}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  if (/^\d{9,13}$/.test(text)) {
    const ms = Number(text) < 10_000_000_000 ? Number(text) * 1000 : Number(text);
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

const defs = [
  [13001, 'INF-DAMS-SNISB-TOTAL', 'Barragens cadastradas no SNISB'],
  [13002, 'INF-DAMS-SNISB-CRI-ALTO', 'Barragens SNISB com CRI alto'],
  [13003, 'INF-DAMS-SNISB-DPA-ALTO', 'Barragens SNISB com DPA alto'],
  [13004, 'INF-DAMS-SNISB-PAE', 'Barragens SNISB com PAE informado'],
  [13011, 'INF-DAMS-ANM-TOTAL', 'Barragens de mineração cadastradas no SIGBM'],
  [13012, 'INF-DAMS-ANM-CRI-ALTO', 'Barragens SIGBM com CRI alto'],
  [13013, 'INF-DAMS-ANM-DPA-ALTO', 'Barragens SIGBM com DPA alto'],
  [13021, 'INF-ATLAS-ISHU-MUNICIPIOS', 'Municípios com classificação ISH-U'],
  [13022, 'INF-ATLAS-ISHU-MINIMA', 'Municípios ISH-U classe Mínima'],
  [13023, 'INF-ATLAS-ISHU-BAIXA', 'Municípios ISH-U classe Baixa'],
  [13024, 'INF-ATLAS-ISHU-MEDIA', 'Municípios ISH-U classe Média'],
  [13025, 'INF-ATLAS-ISHU-ALTA', 'Municípios ISH-U classe Alta'],
  [13026, 'INF-ATLAS-ISHU-MAXIMA', 'Municípios ISH-U classe Máxima'],
] as const;

for (const [id, code, label] of defs) {
  await pool.query(`INSERT INTO civica_exec.exec_ind_def
    (indicator_id, code, method_version, domain, sort_order, label, unit, grain,
     numerator_desc, denominator_desc, min_denominator, ranking_allowed,
     aggregation_allowed, null_semantics, methodology_note)
    VALUES ($1,$2,1,5,$1,$3,'count','A',$3,'not_applicable',1,false,true,
      'missing_not_zero','Contagem source-native; classes categóricas não são convertidas em escore')
    ON CONFLICT (indicator_id) DO UPDATE SET code=EXCLUDED.code, label=EXCLUDED.label,
      methodology_note=EXCLUDED.methodology_note`, [id, code, label]);
}

const entities = (await pool.query(`SELECT entity_id, kind, ibge7, uf, name
  FROM civica_exec.exec_entity WHERE kind IN (1,3,4)`)).rows as AnyRow[];
const byIbge = new Map<number, AnyRow>();
const byNameUf = new Map<string, AnyRow[]>();
for (const entity of entities.filter((e) => Number(e.kind) === 4)) {
  if (entity.ibge7 != null) byIbge.set(Number(entity.ibge7), entity);
  const key = `${normalize(entity.name)}|${String(entity.uf ?? '').trim().toUpperCase()}`;
  const list = byNameUf.get(key) ?? [];
  list.push(entity);
  byNameUf.set(key, list);
}
const brazil = entities.find((e) => Number(e.kind) === 1);
const resolveMunicipality = (row: AnyRow): AnyRow | null => {
  if (row.ibge7 != null && byIbge.has(Number(row.ibge7))) return byIbge.get(Number(row.ibge7))!;
  const key = `${normalize(row.municipality)}|${String(row.uf ?? '').trim().toUpperCase()}`;
  const list = byNameUf.get(key) ?? [];
  return list.length === 1 ? list[0]! : null;
};

const snisb = await readJson('snisb_facilities.json') as AnyRow[];
const anm = await readJson('anm_facilities.json') as AnyRow[];
const atlas = await readJson('atlas_municipalities.json') as AnyRow[];

const aggregateDams = (rows: AnyRow[]) => {
  const result = new Map<number, { total: number; cri: number; dpa: number; pae: number }>();
  for (const row of rows) {
    const entity = resolveMunicipality(row);
    if (!entity) continue;
    const current = result.get(Number(entity.entity_id)) ?? { total: 0, cri: 0, dpa: 0, pae: 0 };
    current.total += 1;
    if (normalize(row.categoryRisk) === 'ALTA') current.cri += 1;
    if (normalize(row.potentialDamage) === 'ALTA') current.dpa += 1;
    if (['SIM', 'POSSUI PAE'].includes(normalize(row.pae))) current.pae += 1;
    result.set(Number(entity.entity_id), current);
  }
  return result;
};

const indicatorRows = (runId: number, aggregate: Map<number, { total: number; cri: number; dpa: number; pae: number }>, ids: number[]) => {
  const fields = ['total', 'cri', 'dpa', 'pae'] as const;
  const rows: AnyRow[] = [];
  for (const [entityId, values] of aggregate) {
    ids.forEach((indicatorId, index) => rows.push({
      indicator_id: indicatorId,
      entity_id: entityId,
      period_start: PERIOD,
      period_end: PERIOD_END,
      status: 2,
      numerator: values[fields[index]!],
      denominator: 1,
      value: values[fields[index]!],
    }));
  }
  return rows;
};

async function publishDamFamily(datasetId: number, source: string, file: string, rows: AnyRow[], ids: number[]) {
  const hash = await fileHash(file);
  const aggregate = aggregateDams(rows);
  return publishSlice(pool, {
    datasetId,
    uf: 0,
    competence: COMPETENCE,
    sourceHash: hash,
    parserVersion: 'p13.5.2-v2',
    bootstrap: true,
    contiguity: false,
    inputs: { provider: source, sourceFile: file, edition: '2026-10', municipalityResolution: 'ibge7-or-exact-name-uf' },
    quality: { sourceRows: rows.length, resolvedMunicipalities: [...aggregate.keys()].length },
    tables: [],
    derive: async (c: PoolClient, runId: number) => {
      await c.query('DELETE FROM civica_exec.exec_dam_facility WHERE source_system = $1', [source]);
      for (const row of rows) {
        const entity = resolveMunicipality(row);
        await c.query(`INSERT INTO civica_exec.exec_dam_facility
          (source_system,source_key,name,entrepreneur,uf,municipality,ibge7,latitude,longitude,
           primary_use,category_risk,potential_damage,operational_status,emergency_level,
           pnsb_applicability,pae_status,inspection_date,fiscal_authority,raw_run_id,source_hash)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,decode($20,'hex'))
          ON CONFLICT (source_system,source_key) DO UPDATE SET
            name=EXCLUDED.name, entrepreneur=EXCLUDED.entrepreneur, uf=EXCLUDED.uf,
            municipality=EXCLUDED.municipality, ibge7=EXCLUDED.ibge7, latitude=EXCLUDED.latitude,
            longitude=EXCLUDED.longitude, primary_use=EXCLUDED.primary_use,
            category_risk=EXCLUDED.category_risk, potential_damage=EXCLUDED.potential_damage,
            operational_status=EXCLUDED.operational_status, emergency_level=EXCLUDED.emergency_level,
            pnsb_applicability=EXCLUDED.pnsb_applicability, pae_status=EXCLUDED.pae_status,
            inspection_date=EXCLUDED.inspection_date, fiscal_authority=EXCLUDED.fiscal_authority,
            raw_run_id=EXCLUDED.raw_run_id, source_hash=EXCLUDED.source_hash`, [
          source, sourceValue(row.sourceKey), row.name, row.entrepreneur, row.uf, row.municipality,
          entity?.ibge7 ?? null, row.latitude, row.longitude, row.primaryUse, row.categoryRisk,
          row.potentialDamage, row.operationalStatus, row.emergencyLevel, row.pnsb, row.pae,
          dateValue(row.inspectionDate), row.fiscalAuthority,
          runId, hash,
        ]);
      }
      await upsertIndicators(c, runId, indicatorRows(runId, aggregate, ids));
    },
  });
}

async function publishAtlas() {
  const hash = await fileHash('atlas_municipalities.json');
  const classes = new Map<string, number>();
  for (const row of atlas) if (row.ish) classes.set(normalize(row.ish), (classes.get(normalize(row.ish)) ?? 0) + 1);
  const values = [[13021, atlas.filter((r) => r.ish).length], [13022, classes.get('MINIMA') ?? 0], [13023, classes.get('BAIXA') ?? 0], [13024, classes.get('MEDIA') ?? 0], [13025, classes.get('ALTA') ?? 0], [13026, classes.get('MAXIMA') ?? 0]];
  return publishSlice(pool, {
    datasetId: 152,
    uf: 0,
    competence: COMPETENCE,
    sourceHash: hash,
    parserVersion: 'p13.5.2-v2',
    bootstrap: true,
    contiguity: false,
    inputs: { provider: 'atlas-aguas', sourceFile: 'atlas_municipalities.json', edition: '2026-10' },
    quality: { sourceRows: atlas.length, uniqueMunicipalities: new Set(atlas.map((r) => r.ibge7)).size },
    tables: [],
    derive: async (c: PoolClient, runId: number) => {
      await c.query('DELETE FROM civica_exec.exec_dam_atlas_municipality');
      for (const row of atlas) await c.query(`INSERT INTO civica_exec.exec_dam_atlas_municipality
        (ibge7,municipality,uf,ish_class,source_water_type,producer_system_class,distribution_system_class,operator_type,source_hash)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,decode($9,'hex'))
        ON CONFLICT (ibge7) DO UPDATE SET municipality=EXCLUDED.municipality,uf=EXCLUDED.uf,
          ish_class=EXCLUDED.ish_class,source_water_type=EXCLUDED.source_water_type,
          producer_system_class=EXCLUDED.producer_system_class,
          distribution_system_class=EXCLUDED.distribution_system_class,
          operator_type=EXCLUDED.operator_type,source_hash=EXCLUDED.source_hash`,
        [row.ibge7, row.municipality, row.uf, row.ish, row.tpm, row.csm, row.tpsis, row.tpope, hash]);
      if (brazil) await upsertIndicators(c, runId, values.map(([indicatorId, value]) => ({ indicator_id: indicatorId, entity_id: Number(brazil.entity_id), period_start: PERIOD, period_end: PERIOD_END, status: 2 as const, numerator: value, denominator: 1, value })));
    },
  });
}

const results = {
  snisb: await publishDamFamily(150, 'snisb', 'snisb_facilities.json', snisb, [13001, 13002, 13003, 13004]),
  anm: await publishDamFamily(151, 'anm', 'anm_facilities.json', anm, [13011, 13012, 13013]),
  atlas: await publishAtlas(),
};
console.log(JSON.stringify({ sourceRows: { snisb: snisb.length, anm: anm.length, atlas: atlas.length }, results }, null, 2));
await pool.end();
