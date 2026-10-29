import { createHash } from 'node:crypto';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { openPool } from './db.ts';
import { publishSlice, upsertIndicators, type IndicatorRow } from '../../packages/db/src/exec/publication.ts';

const RAW = 'D:\\Civica\\raw\\bem-estar\\ibge\\censo-2022';
const STAGING = 'D:\\Civica\\staging\\bem-estar\\ibge\\censo-2022';
const DATASET_ID = 120;
const COMPETENCE = 202212;
const PERIOD_START = '2022-01-01';
const PERIOD_END = '2023-01-01';
const MAX_ENVELOPE = 500_000_000;

const IDS = {
  mean: 9001, median: 9002, gini: 9003, water: 9004, sewer: 9005, garbage: 9006,
} as const;

type Sidra = Record<string, string>;
type Entity = { entity_id: number; kind: number; uf_code: number | null; ibge7: number; name: string };

const sha256 = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const num = (v: string | undefined): number | null => {
  if (v == null || v === '' || v === '-') return null;
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const rowsOf = async (name: string): Promise<Sidra[]> => {
  const data = JSON.parse(await readFile(join(RAW, name), 'utf8')) as Sidra[];
  return data.slice(1);
};

const defs = [
  [IDS.mean, 'WB-INC-RDPC-MEAN', 'Renda domiciliar per capita média', 'R$/mês', 'Rendimento nominal médio mensal domiciliar per capita publicado pela SIDRA 10295; universo e exclusões são os da tabela.', 'valor publicado', null],
  [IDS.median, 'WB-INC-RDPC-MEDIAN', 'Renda domiciliar per capita mediana', 'R$/mês', 'Mediana do rendimento nominal mensal domiciliar per capita publicada pela SIDRA 10295; universo e exclusões são os da tabela.', 'valor publicado', null],
  [IDS.gini, 'WB-INC-GINI', 'Gini da renda domiciliar per capita', 'índice', 'Índice de Gini publicado pela SIDRA 10301. A fonte só possui níveis Brasil e UF; não há valor municipal neste recorte.', 'valor publicado', null],
  [IDS.water, 'WB-HOUSING-WATER', 'Abastecimento de água adequado', '%', 'Domicílios com ligação à rede geral e uso principal da rede (SIDRA 6803, categoria 72144) / total 72129 × 100.', 'categoria / total × 100', 'domicílios'],
  [IDS.sewer, 'WB-HOUSING-SEWER', 'Esgotamento sanitário adequado', '%', 'Domicílios em rede geral, rede pluvial ou fossa ligada à rede (SIDRA 6805, categoria 46290) / total 46292 × 100.', 'categoria / total × 100', 'domicílios'],
  [IDS.garbage, 'WB-HOUSING-GARBAGE', 'Coleta de lixo', '%', 'Domicílios com lixo coletado (SIDRA 6892, categoria 2520) / total 10972 × 100.', 'categoria / total × 100', 'domicílios'],
] as const;

async function main() {
  await mkdir(STAGING, { recursive: true });
  const pool = openPool(4);
  const result: Record<string, unknown> = { datasetId: DATASET_ID, competence: COMPETENCE, period: [PERIOD_START, PERIOD_END], source: 'IBGE SIDRA Censo 2022', startedAt: new Date().toISOString() };
  try {
    const db0 = (await pool.query(`SELECT current_database() AS database, pg_database_size(current_database())::bigint AS bytes`)).rows[0];
    if (db0.database !== 'projetoeleitor_db') throw new Error(`DATABASE_GUARD: conectado a ${db0.database}`);
    result.database = db0;

    const fileNames = [
      'sidra-10295-n1-2022.json', 'sidra-10295-n3-2022.json', 'sidra-10295-n6-2022.json',
      'sidra-10301-n1-2022.json', 'sidra-10301-n3-2022.json',
      'sidra-6803-n1-2022.json', 'sidra-6803-n3-2022.json', 'sidra-6803-n6-2022.json',
      'sidra-6805-n1-2022.json', 'sidra-6805-n3-2022.json', 'sidra-6805-n6-2022.json',
      'sidra-6892-n1-2022.json', 'sidra-6892-n3-2022.json', 'sidra-6892-n6-2022.json',
    ];
    const sourceFiles = [];
    for (const name of fileNames) { const b = await readFile(join(RAW, name)); sourceFiles.push({ name, bytes: b.length, sha256: sha256(b) }); }
    const sourceHash = sha256(JSON.stringify(sourceFiles));
    result.sourceFiles = sourceFiles; result.sourceHash = sourceHash;

    const entities = (await pool.query(`SELECT entity_id, kind, uf_code, ibge7, name FROM civica_exec.exec_entity WHERE kind IN (1,3,4)`)).rows as Entity[];
    const byIbge = new Map(entities.map(e => [Number(e.ibge7), e]));
    const brasil = entities.find(e => e.kind === 1);
    if (!brasil) throw new Error('entity Brasil não encontrada');
    const ufEntities = new Map(entities.filter(e => e.kind === 3).map(e => [Number(e.uf_code), e]));
    const municipalEntities = entities.filter(e => e.kind === 4);

    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      for (let i = 0; i < defs.length; i++) {
        const [id, code, label, unit, note, numeratorDesc, denominatorDesc] = defs[i];
        const existing = (await c.query(`SELECT code, method_version, domain FROM civica_exec.exec_ind_def WHERE indicator_id=$1`, [id])).rows[0];
        if (existing && (existing.code !== code || existing.method_version !== 1 || existing.domain !== 4)) throw new Error(`indicator_id ${id} já possui definição incompatível`);
        if (!existing) await c.query(`INSERT INTO civica_exec.exec_ind_def (indicator_id,code,method_version,domain,sort_order,label,unit,grain,numerator_desc,denominator_desc,min_denominator,ranking_allowed,aggregation_allowed,null_semantics,methodology_note)
          VALUES ($1,$2,1,4,$3,$4,$5,'A',$6,$7,NULL,false,false,'missing_not_zero',$8)`, [id, code, i + 1, label, unit, numeratorDesc, denominatorDesc, note]);
      }
      await c.query('COMMIT');
    } finally { c.release(); }
    result.indicatorDefinitions = defs.length;

    const valueRows: IndicatorRow[] = [];
    const byUf = new Map<number, IndicatorRow[]>();
    const add = (uf: number, row: IndicatorRow) => { valueRows.push(row); if (!byUf.has(uf)) byUf.set(uf, []); byUf.get(uf)!.push(row); };
    const entityFor = (r: Sidra): Entity => {
      const code = Number(r.D1C);
      const e = Number(r.NC) === 1 ? brasil! : Number(r.NC) === 3 ? ufEntities.get(code) : byIbge.get(code);
      if (!e) throw new Error(`entidade IBGE não resolvida: ${r.NC}/${r.D1C}`);
      return e;
    };
    const addDirect = (r: Sidra, indicator: number) => {
      const e = entityFor(r); const v = num(r.V); const row: IndicatorRow = { indicator_id: indicator, entity_id: e.entity_id, period_start: PERIOD_START, period_end: PERIOD_END, status: 2, numerator: null, denominator: null, value: v, flags: v == null ? 256 : 0 };
      add(e.kind === 1 ? 0 : Number(e.uf_code), row);
    };
    for (const file of ['sidra-10295-n1-2022.json','sidra-10295-n3-2022.json','sidra-10295-n6-2022.json']) {
      for (const r of await rowsOf(file)) addDirect(r, r.D2C === '13431' ? IDS.mean : IDS.median);
    }
    for (const file of ['sidra-10301-n1-2022.json','sidra-10301-n3-2022.json']) for (const r of await rowsOf(file)) addDirect(r, IDS.gini);

    const housing = [
      ['6803', '72129', '72144', IDS.water], ['6805', '46292', '46290', IDS.sewer], ['6892', '10972', '2520', IDS.garbage],
    ] as const;
    for (const [table, totalCode, goodCode, indicator] of housing) {
      const byEntity = new Map<number, { entity: Entity; total: number | null; good: number | null }>();
      for (const level of ['n1','n3','n6']) for (const r of await rowsOf(`sidra-${table}-${level}-2022.json`)) {
        const e = entityFor(r); const x = byEntity.get(e.entity_id) ?? { entity: e, total: null, good: null };
        if (r.D4C === totalCode) x.total = num(r.V); if (r.D4C === goodCode) x.good = num(r.V); byEntity.set(e.entity_id, x);
      }
      for (const x of byEntity.values()) {
        const value = x.total != null && x.total > 0 && x.good != null ? (x.good / x.total) * 100 : null;
        const flags = value == null ? 256 : 0;
        add(x.entity.kind === 1 ? 0 : Number(x.entity.uf_code), { indicator_id: indicator, entity_id: x.entity.entity_id, period_start: PERIOD_START, period_end: PERIOD_END, status: 2, numerator: x.good, denominator: x.total, value, flags });
      }
    }
    const duplicate = new Set<string>(); for (const r of valueRows) { const k = `${r.indicator_id}:${r.entity_id}:${r.period_start}`; if (duplicate.has(k)) throw new Error(`duplicidade ${k}`); duplicate.add(k); }
    result.sourceRows = { municipalities: 5570, entitiesInDb: municipalEntities.length, valueRows: valueRows.length, municipalExpected: 5570 * 5, note: 'Gini não possui nível municipal na tabela oficial 10301; portanto os municípios têm cinco indicadores neste recorte.' };
    result.municipalEntityCoverage = { sourceMunicipalities: 5570, resolved: valueRows.filter(r => municipalEntities.some(e => e.entity_id === r.entity_id)).map(r => r.entity_id).filter((v,i,a)=>a.indexOf(v)===i).length, currentEntityMunicipalities: municipalEntities.length, note: 'Boa Esperança do Norte (MT, criado após o recorte censitário) não aparece no Censo 2022.' };

    const publish = async (uf: number, rows: IndicatorRow[], replay = false) => {
      const sliceHash = sha256(`${sourceHash}:${uf}:${JSON.stringify(rows)}`);
      const t0 = Number((await pool.query(`SELECT pg_database_size(current_database())::bigint AS b`)).rows[0].b);
      const r = await publishSlice(pool, { datasetId: DATASET_ID, uf, competence: COMPETENCE, sourceHash: sliceHash, parserVersion: 'p12.2-ibge-sidra-2022-v1', bootstrap: true, contiguity: false, tables: [], inputs: { provider: 'IBGE', tables: [10295,10301,6803,6805,6892], sourceFiles }, quality: { rowsIn: rows.length, replay, giniScope: 'BR|UF', municipalRows: rows.filter(x => x.entity_id >= 1000000).length }, derive: async (client, runId) => { await upsertIndicators(client, runId, rows); } });
      const t1 = Number((await pool.query(`SELECT pg_database_size(current_database())::bigint AS b`)).rows[0].b);
      if (t1 - t0 > MAX_ENVELOPE) throw new Error('P12.2 envelope exceeded');
      return { uf, rows: rows.length, status: r.status, runId: 'runId' in r ? r.runId : null, dbBefore: t0, dbAfter: t1, delta: t1 - t0 };
    };
    const slices: Array<Record<string, unknown>> = [];
    const national = byUf.get(0) ?? []; slices.push(await publish(0, national));
    for (const uf of [...ufEntities.keys()].sort((a,b)=>a-b)) slices.push(await publish(uf, byUf.get(uf) ?? []));
    result.slices = slices;
    const replay: Array<Record<string, unknown>> = []; replay.push(await publish(0, national, true)); for (const uf of [...ufEntities.keys()].sort((a,b)=>a-b)) replay.push(await publish(uf, byUf.get(uf) ?? [], true)); result.replay = replay;

    const counts = (await pool.query(`SELECT d.code, d.indicator_id, count(v.*)::int AS rows, count(DISTINCT v.entity_id)::int AS entities, count(*) FILTER (WHERE v.value IS NULL)::int AS nulls FROM civica_exec.exec_ind_def d LEFT JOIN civica_exec.exec_ind_value v USING (indicator_id) WHERE d.indicator_id BETWEEN 9001 AND 9006 GROUP BY d.code,d.indicator_id ORDER BY d.indicator_id`)).rows;
    const pubs = (await pool.query(`SELECT count(*)::int AS slices, count(*) FILTER (WHERE dataset_id=$1)::int AS p122_slices FROM civica_exec.exec_publication`, [DATASET_ID])).rows[0];
    const size = (await pool.query(`SELECT pg_database_size(current_database())::bigint AS db, pg_total_relation_size('civica_exec.exec_ind_value')::bigint AS values_bytes, pg_total_relation_size('civica_exec.exec_ind_latest')::bigint AS latest_bytes, pg_total_relation_size('civica_exec.exec_ind_def')::bigint AS defs_bytes`)).rows[0];
    result.counts = counts; result.publications = pubs; result.storage = size; result.finishedAt = new Date().toISOString();
    console.log(JSON.stringify(result, null, 2));
  } finally { await pool.end(); }
}

main().catch(e => { console.error(e); process.exitCode = 1; });
