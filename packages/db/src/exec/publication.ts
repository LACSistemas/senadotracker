import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { isValidYm, ymNext, ymPrev } from './ym.ts';
import { RUN_STATUS, SPEC_BY_ID, type IntervalSpec, type SnapshotSpec, type TableSpec, type UpsertSpec } from './specs.ts';

/**
 * Publicação transacional por fatia (dataset × UF × competência). A visibilidade é a do COMMIT; exec_publication só registra.
 * Rollback exato = inverso do exec_change_log (run mais recente da fatia); fora disso, replay do RAW.
 * Referência normativa: docs/executivo-collector-plan/saude-fase1-arquitetura/modelo_dados_territorial_saude.md §7.
 */
export type Row = Record<string, unknown>;
export interface TableInput { spec: TableSpec; rows: Row[] }
export interface PublishInput {
  datasetId: number; uf: number; competence: number; stage?: 1 | 2; sourceHash: string; parserVersion?: string;
  bootstrap?: boolean; contiguity?: boolean; startAfter?: number | null;
  tables: TableInput[]; inputs?: unknown; quality?: unknown;
  /** Derivados (indicadores etc.) na MESMA transação e com o mesmo run_id. Devem registrar o change log via logRows(). */
  derive?: (c: PoolClient, runId: number) => Promise<void>;
  /** Verificações adicionais; lançar exceção cancela tudo. */
  verify?: (c: PoolClient, runId: number) => Promise<void>;
  /** Teste de falha injetada. */
  failAfterApply?: boolean;
}
export type PublishResult = { status: 'PUBLISHED'; runId: number; rowsOut: number; sliceHash: string } | { status: 'NO_CHANGE'; runId: number } | { status: 'FAILED_SAFE'; reason: string };

const q = (n: string) => `civica_exec.${n}`;
const cols = (s: TableSpec) => s.kind === 'interval' ? [...s.keys, ...s.values] : s.kind === 'upsert' ? [...s.pk, ...s.values, ...(s.insertOnly ?? [])] : [...s.pk, ...s.values];
const lockKey = (datasetId: number, uf: number) => `civica_exec:${datasetId}:${uf}`;

export async function lockSlice(c: PoolClient, datasetId: number, uf: number): Promise<void> {
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [lockKey(datasetId, uf)]);
}
export const sha256 = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');

async function nextSeq(c: PoolClient, runId: number): Promise<number> {
  return Number((await c.query(`SELECT coalesce(max(seq), 0)::int AS m FROM ${q('exec_change_log')} WHERE run_id = $1`, [runId])).rows[0].m);
}
const jsonPk = (alias: string, columns: string[]) => `jsonb_build_object(${columns.map(k => `'${k}', ${alias}.${k}`).join(', ')})`;

/** Registra no change log linhas já lidas (usado por derivados). */
export async function logRows(c: PoolClient, runId: number, tableId: number, op: 'I' | 'U' | 'D', pk: Row, oldRow: Row | null): Promise<void> {
  const seq = (await nextSeq(c, runId)) + 1;
  await c.query(`INSERT INTO ${q('exec_change_log')} (run_id, seq, table_id, op, pk, old_row) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb)`, [runId, seq, tableId, op, JSON.stringify(pk), oldRow ? JSON.stringify(oldRow) : null]);
}

async function stage(c: PoolClient, spec: TableSpec, rows: Row[]): Promise<string> {
  const stg = `stg_${spec.name}`;
  const list = cols(spec);
  await c.query(`CREATE TEMP TABLE ${stg} ON COMMIT DROP AS SELECT ${list.join(', ')} FROM ${q(spec.name)} WITH NO DATA`);
  for (let i = 0; i < rows.length; i += 5000) {
    const part = rows.slice(i, i + 5000).map(r => Object.fromEntries(list.map(k => [k, r[k] ?? null])));
    await c.query(`INSERT INTO ${stg} SELECT ${list.join(', ')} FROM jsonb_populate_recordset(NULL::${q(spec.name)}, $1::jsonb)`, [JSON.stringify(part)]);
  }
  return stg;
}

const pkEq = (a: string, b: string, pk: string[]) => pk.map(k => `${a}.${k} = ${b}.${k}`).join(' AND ');
const distinct = (a: string, b: string, v: string[]) => v.length ? `(${v.map(k => `${a}.${k}`).join(', ')}) IS DISTINCT FROM (${v.map(k => `${b}.${k}`).join(', ')})` : 'FALSE';

async function applySnapshot(c: PoolClient, spec: SnapshotSpec | UpsertSpec, stg: string, uf: number, comp: number, runId: number, log: boolean): Promise<void> {
  const t = q(spec.name);
  const scoped = spec.kind === 'snapshot';
  const pkJ = jsonPk('f', spec.pk);
  const args = [uf, comp, runId];
  const logIns = async (op: string, from: string, oldRow: string, pkAlias = 'f') => {
    const off = await nextSeq(c, runId);
    await c.query(`INSERT INTO ${q('exec_change_log')} (run_id, seq, table_id, op, pk, old_row)
      SELECT $3, $4::int + row_number() OVER (), ${spec.tableId}, '${op}', ${jsonPk(pkAlias, spec.pk)}, ${oldRow} ${from} AND $1::integer IS NOT NULL AND $2::integer IS NOT NULL`, [...args, off]);
  };
  if (log) {
    await logIns('U', `FROM ${t} f JOIN ${stg} s ON ${pkEq('f', 's', spec.pk)} WHERE ${distinct('f', 's', spec.values)}`, 'to_jsonb(f)');
    if (scoped) await logIns('D', `FROM ${t} f WHERE ${spec.scopeSql} AND NOT EXISTS (SELECT 1 FROM ${stg} s WHERE ${pkEq('f', 's', spec.pk)})`, 'to_jsonb(f)');
    await logIns('I', `FROM ${stg} f WHERE NOT EXISTS (SELECT 1 FROM ${t} x WHERE ${pkEq('x', 'f', spec.pk)})`, 'NULL::jsonb');
  }
  if (spec.values.length) await c.query(`UPDATE ${t} f SET ${spec.values.map(k => `${k} = s.${k}`).join(', ')} FROM ${stg} s WHERE ${pkEq('f', 's', spec.pk)} AND ${distinct('f', 's', spec.values)}`);
  if (scoped) await c.query(`DELETE FROM ${t} f WHERE ${spec.scopeSql.replace(/\$3/g, '$3')} AND NOT EXISTS (SELECT 1 FROM ${stg} s WHERE ${pkEq('f', 's', spec.pk)})`, [uf, comp]);
  await c.query(`INSERT INTO ${t} (${cols(spec).join(', ')}) SELECT ${cols(spec).join(', ')} FROM ${stg} s WHERE NOT EXISTS (SELECT 1 FROM ${t} f WHERE ${pkEq('f', 's', spec.pk)})`);
}

async function applyInterval(c: PoolClient, spec: IntervalSpec, stg: string, uf: number, comp: number, runId: number, log: boolean): Promise<void> {
  const t = q(spec.name);
  const open = `f.valid_to IS NULL AND (${spec.scopeSql})`;
  const vkey = [...spec.keys, 'valid_from'];
  const changedOrGone = `${open} AND NOT EXISTS (SELECT 1 FROM ${stg} s WHERE ${pkEq('f', 's', spec.keys)} AND NOT (${distinct('f', 's', spec.values)}))`;
  if (log) {
    const off = await nextSeq(c, runId);
    await c.query(`INSERT INTO ${q('exec_change_log')} (run_id, seq, table_id, op, pk, old_row)
      SELECT $3, $4::int + row_number() OVER (), ${spec.tableId}, 'U', ${jsonPk('f', vkey)}, to_jsonb(f) FROM ${t} f WHERE ${changedOrGone} AND $2::integer IS NOT NULL`, [uf, comp, runId, off]);
  }
  await c.query(`UPDATE ${t} f SET valid_to = $2::integer WHERE ${changedOrGone}`, [uf, comp]);
  if (log) {
    const off = await nextSeq(c, runId);
    await c.query(`INSERT INTO ${q('exec_change_log')} (run_id, seq, table_id, op, pk, old_row)
      SELECT $3, $4::int + row_number() OVER (), ${spec.tableId}, 'I', jsonb_build_object(${spec.keys.map(k => `'${k}', s.${k}`).join(', ')}, 'valid_from', $2::integer), NULL
      FROM ${stg} s WHERE NOT EXISTS (SELECT 1 FROM ${t} f WHERE ${pkEq('f', 's', spec.keys)} AND f.valid_to IS NULL AND (${spec.scopeSql}))`, [uf, comp, runId, off]);
  }
  await c.query(`INSERT INTO ${t} (${[...spec.keys, 'valid_from', 'valid_to', ...spec.values].join(', ')})
    SELECT ${spec.keys.map(k => `s.${k}`).join(', ')}, $2::integer, NULL, ${spec.values.map(k => `s.${k}`).join(', ')} FROM ${stg} s
    WHERE NOT EXISTS (SELECT 1 FROM ${t} f WHERE ${pkEq('f', 's', spec.keys)} AND f.valid_to IS NULL) AND $1::integer IS NOT NULL`, [uf, comp]);
}

export async function sliceHash(c: PoolClient, specs: TableSpec[], uf: number, comp: number): Promise<string> {
  const parts: string[] = [];
  for (const s of specs) {
    const order = (s.kind === 'interval' ? [...s.keys, 'valid_from'] : s.pk).join(', ');
    const where = s.kind === 'upsert' ? 'TRUE' : s.scopeSql;
    const r = await c.query(`SELECT md5(coalesce(string_agg(t::text, E'\\n' ORDER BY ${order}), '')) AS h FROM ${q(s.name)} t WHERE ${where}`, s.kind === 'upsert' ? [] : s.kind === 'interval' ? [uf] : [uf, comp]);
    parts.push(String(r.rows[0].h));
  }
  return sha256(parts.join('|'));
}

/** Estado esperado de intervalos: no máximo 1 aberto por chave e nenhuma sobreposição (dentro da UF). */
export async function assertIntervalIntegrity(c: PoolClient, spec: IntervalSpec, uf: number): Promise<void> {
  const t = q(spec.name); const k = spec.keys;
  const open = await c.query(`SELECT count(*)::int n FROM (SELECT ${k.join(', ')} FROM ${t} f WHERE valid_to IS NULL AND (${spec.scopeSql}) GROUP BY ${k.join(', ')} HAVING count(*) > 1) x`, [uf]);
  if (open.rows[0].n) throw new Error(`${spec.name}: mais de um intervalo aberto por chave`);
  const ov = await c.query(`WITH s AS (SELECT * FROM ${t} f WHERE ${spec.scopeSql}) SELECT count(*)::int n FROM s a JOIN s b ON ${pkEq('a', 'b', k)} AND a.valid_from < b.valid_from AND (a.valid_to IS NULL OR a.valid_to > b.valid_from)`, [uf]);
  if (ov.rows[0].n) throw new Error(`${spec.name}: intervalos sobrepostos`);
}

export async function publishSlice(pool: Pool, input: PublishInput): Promise<PublishResult> {
  if (!isValidYm(input.competence)) return { status: 'FAILED_SAFE', reason: `competência inválida ${input.competence}` };
  const stageV = input.stage ?? 2;
  const hash = Buffer.from(input.sourceHash, 'hex');
  const c = await pool.connect();
  let runId = 0;
  try {
    const dup = await c.query(`SELECT r.run_id, r.status, p.run_id AS active FROM ${q('exec_ingestion_run')} r
      LEFT JOIN ${q('exec_publication')} p ON p.dataset_id = r.dataset_id AND p.uf = r.uf AND p.competence = r.competence
      WHERE r.dataset_id = $1 AND r.uf = $2 AND r.competence = $3 AND r.source_hash = $4`, [input.datasetId, input.uf, input.competence, hash]);
    if (dup.rows[0]?.status === RUN_STATUS.PUBLISHED && dup.rows[0].active === dup.rows[0].run_id) return { status: 'NO_CHANGE', runId: dup.rows[0].run_id };
    await c.query('BEGIN');
    await c.query("SET LOCAL lock_timeout = '10s'");
    await lockSlice(c, input.datasetId, input.uf);
    const base = await c.query(`SELECT run_id FROM ${q('exec_publication')} WHERE dataset_id=$1 AND uf=$2 AND competence=$3 FOR UPDATE`, [input.datasetId, input.uf, input.competence]);
    const hasInterval = input.tables.some(t => t.spec.kind === 'interval');
    if (hasInterval && input.contiguity !== false && !input.bootstrap) {
      const last = await c.query(`SELECT max(competence)::int m FROM ${q('exec_publication')} WHERE dataset_id=$1 AND uf=$2`, [input.datasetId, input.uf]);
      const m = last.rows[0].m as number | null;
      if (m !== null && m < input.competence && input.competence !== ymNext(m)) { await c.query('ROLLBACK'); return { status: 'FAILED_SAFE', reason: `GAP: ${input.competence} não é a seguinte a ${m}` }; }
      if (m !== null && m >= input.competence) { await c.query('ROLLBACK'); return { status: 'FAILED_SAFE', reason: `competência ${input.competence} não é posterior à última publicada (${m}); use REPLAY` }; }
    }
    if (hasInterval && input.startAfter != null && input.contiguity !== false) { /* primeira publicação com ponto de partida declarado */ }
    const run = await c.query(`INSERT INTO ${q('exec_ingestion_run')} (dataset_id, uf, competence, stage, status, bootstrap, started_at, parser_version, rows_in, source_hash, inputs, quality)
      VALUES ($1,$2,$3,$4,$5,$6,now(),$7,$8,$9,$10::jsonb,$11::jsonb)
      ON CONFLICT (dataset_id, uf, competence, source_hash) DO UPDATE SET status = EXCLUDED.status, started_at = now(), parser_version = EXCLUDED.parser_version, bootstrap = EXCLUDED.bootstrap RETURNING run_id`,
      [input.datasetId, input.uf, input.competence, stageV, RUN_STATUS.RUNNING, !!input.bootstrap, input.parserVersion ?? null, input.tables.reduce((n, t) => n + t.rows.length, 0), hash, input.inputs == null ? null : JSON.stringify(input.inputs), input.quality == null ? null : JSON.stringify(input.quality)]);
    runId = run.rows[0].run_id;
    await c.query(`DELETE FROM ${q('exec_change_log')} WHERE run_id = $1`, [runId]);
    const preHash = await sliceHash(c, input.tables.map(t => t.spec), input.uf, input.competence);
    await c.query(`UPDATE ${q('exec_ingestion_run')} SET quality = jsonb_set(jsonb_set(coalesce(quality, '{}'::jsonb), '{preHash}', to_jsonb($2::text)), '{specIds}', $3::jsonb) WHERE run_id = $1`, [runId, preHash, JSON.stringify(input.tables.map(t => t.spec.tableId))]);
    let rowsOut = 0;
    for (const t of input.tables) {
      const stg = await stage(c, t.spec, t.rows);
      if (t.spec.kind === 'interval') await applyInterval(c, t.spec, stg, input.uf, input.competence, runId, !input.bootstrap);
      else await applySnapshot(c, t.spec, stg, input.uf, input.competence, runId, !input.bootstrap);
      rowsOut += t.rows.length;
    }
    if (input.derive) await input.derive(c, runId);
    if (input.failAfterApply) throw new Error('falha injetada após aplicar as tabelas');
    for (const t of input.tables) if (t.spec.kind === 'interval') await assertIntervalIntegrity(c, t.spec, input.uf);
    if (input.verify) await input.verify(c, runId);
    const hsh = await sliceHash(c, input.tables.map(t => t.spec), input.uf, input.competence);
    await c.query(`INSERT INTO ${q('exec_publication')} (dataset_id, uf, competence, run_id, previous_run_id, state, stage, row_count, source_hash, activated_at)
      VALUES ($1,$2,$3,$4,$5,1,$6,$7,$8,now())
      ON CONFLICT (dataset_id, uf, competence) DO UPDATE SET previous_run_id = ${q('exec_publication')}.run_id, run_id = EXCLUDED.run_id, state = 1,
        stage = EXCLUDED.stage, row_count = EXCLUDED.row_count, source_hash = EXCLUDED.source_hash, activated_at = EXCLUDED.activated_at`,
      [input.datasetId, input.uf, input.competence, runId, base.rows[0]?.run_id ?? null, stageV, rowsOut, hash]);
    await c.query(`UPDATE ${q('exec_ingestion_run')} SET status = $2, finished_at = now(), rows_out = $3, slice_hash = $4 WHERE run_id = $1`, [runId, RUN_STATUS.PUBLISHED, rowsOut, Buffer.from(hsh, 'hex')]);
    await c.query('COMMIT');
    return { status: 'PUBLISHED', runId, rowsOut, sliceHash: hsh };
  } catch (error) {
    try { await c.query('ROLLBACK'); } catch { /* conexão já encerrada */ }
    const message = error instanceof Error ? error.message : String(error);
    try {
      await c.query(`INSERT INTO ${q('exec_ingestion_run')} (dataset_id, uf, competence, stage, status, bootstrap, started_at, finished_at, source_hash, error)
        VALUES ($1,$2,$3,$4,$5,$6,now(),now(),$7,$8) ON CONFLICT (dataset_id, uf, competence, source_hash) DO UPDATE SET status = EXCLUDED.status, error = EXCLUDED.error, finished_at = now()`,
        [input.datasetId, input.uf, input.competence, stageV, RUN_STATUS.FAILED, !!input.bootstrap, hash, message.slice(0, 500)]);
    } catch { /* registro de falha é melhor esforço */ }
    throw error;
  } finally { c.release(); }
}

async function restoreRows(c: PoolClient, spec: TableSpec, entries: Array<{ op: string; pk: Row; old_row: Row | null }>): Promise<void> {
  const t = q(spec.name);
  const all = spec.kind === 'interval' ? [...spec.keys, 'valid_from', 'valid_to', ...spec.values] : cols(spec);
  const keyCols = spec.kind === 'interval' ? [...spec.keys, 'valid_from'] : spec.pk;
  for (const e of entries) {
    if (e.op === 'I') {
      await c.query(`DELETE FROM ${t} WHERE ${keyCols.map(k => `${k}::text = ($1::jsonb ->> '${k}')`).join(' AND ')}`, [JSON.stringify(e.pk)]);
    } else if (e.op === 'U') {
      const sets = all.filter(k => !keyCols.includes(k)).map(k => `${k} = r.${k}`).join(', ');
      await c.query(`UPDATE ${t} f SET ${sets} FROM jsonb_populate_record(NULL::${t}, $2::jsonb) r WHERE ${keyCols.map(k => `f.${k}::text = ($1::jsonb ->> '${k}')`).join(' AND ')}`, [JSON.stringify(e.pk), JSON.stringify(e.old_row)]);
    } else {
      await c.query(`INSERT INTO ${t} (${all.join(', ')}) SELECT ${all.join(', ')} FROM jsonb_populate_record(NULL::${t}, $1::jsonb)`, [JSON.stringify(e.old_row)]);
    }
  }
}

export type RollbackResult = { status: 'ROLLED_BACK'; runId: number; restoredHash: string | null } | { status: 'REFUSED'; reason: string };

/** Rollback exato pelo change log. Só para o run mais recente da fatia, com log retido e hash atual igual ao do run. */
export async function rollbackRun(pool: Pool, runId: number): Promise<RollbackResult> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN'); await c.query("SET LOCAL lock_timeout = '10s'");
    const r = (await c.query(`SELECT * FROM ${q('exec_ingestion_run')} WHERE run_id = $1`, [runId])).rows[0];
    if (!r) { await c.query('ROLLBACK'); return { status: 'REFUSED', reason: 'run inexistente' }; }
    await lockSlice(c, r.dataset_id, r.uf);
    if (r.status !== RUN_STATUS.PUBLISHED) { await c.query('ROLLBACK'); return { status: 'REFUSED', reason: `run em estado ${r.status}` }; }
    if (r.bootstrap) { await c.query('ROLLBACK'); return { status: 'REFUSED', reason: 'carga inicial não tem change log: use replay' }; }
    const pubs = (await c.query(`SELECT competence, run_id, previous_run_id FROM ${q('exec_publication')} WHERE dataset_id=$1 AND uf=$2 AND run_id=$3`, [r.dataset_id, r.uf, runId])).rows;
    if (!pubs.length) { await c.query('ROLLBACK'); return { status: 'REFUSED', reason: 'o run não é o ativo de nenhuma competência (não é o mais recente)' }; }
    const newer = await c.query(`SELECT 1 FROM ${q('exec_ingestion_run')} WHERE dataset_id=$1 AND uf=$2 AND status=$3 AND run_id > $4 LIMIT 1`, [r.dataset_id, r.uf, RUN_STATUS.PUBLISHED, runId]);
    if (newer.rowCount) { await c.query('ROLLBACK'); return { status: 'REFUSED', reason: 'existe run publicado mais recente na mesma fatia: use replay' }; }
    const log = (await c.query(`SELECT seq, table_id, op, pk, old_row FROM ${q('exec_change_log')} WHERE run_id = $1 ORDER BY seq DESC`, [runId])).rows;
    if (!log.length) { await c.query('ROLLBACK'); return { status: 'REFUSED', reason: 'change log ausente ou expirado: use replay' }; }
    // o hash da fatia cobre TODAS as tabelas da publicação (gravadas em quality.specIds); runs antigos usam as tabelas presentes no change log
    const recorded = ((r.quality as Row | null)?.specIds as number[] | undefined)?.filter(id => SPEC_BY_ID.has(id));
    const specs = (recorded?.length ? recorded : [...new Set(log.map(l => l.table_id as number))].filter(id => SPEC_BY_ID.has(id))).map(id => SPEC_BY_ID.get(id)!);
    const curHash = await sliceHash(c, specs, r.uf, r.competence);
    if (r.slice_hash && Buffer.from(r.slice_hash).toString('hex') !== curHash) { await c.query('ROLLBACK'); return { status: 'REFUSED', reason: 'o estado atual difere do publicado pelo run (alteração posterior): use replay' }; }
    // tabela de indicadores: remove "latest" dos pares afetados antes do inverso
    const indPairs = new Map<string, { i: number; e: number }>();
    for (const l of log) if (l.table_id === 7) { const k = `${l.pk.indicator_id}:${l.pk.entity_id}`; indPairs.set(k, { i: Number(l.pk.indicator_id), e: Number(l.pk.entity_id) }); }
    for (const p of indPairs.values()) await c.query(`DELETE FROM ${q('exec_ind_latest')} WHERE indicator_id = $1 AND entity_id = $2`, [p.i, p.e]);
    for (const l of log) {
      if (l.table_id === 7) await restoreIndicator(c, l.op, l.pk, l.old_row);
      else { const spec = SPEC_BY_ID.get(l.table_id); if (!spec) throw new Error(`table_id desconhecido ${l.table_id}`); await restoreRows(c, spec, [l]); }
    }
    for (const p of indPairs.values()) await refreshLatest(c, p.i, p.e);
    for (const p of pubs) {
      if (p.previous_run_id) await c.query(`UPDATE ${q('exec_publication')} SET run_id = previous_run_id, previous_run_id = NULL, activated_at = now() WHERE dataset_id=$1 AND uf=$2 AND competence=$3`, [r.dataset_id, r.uf, p.competence]);
      else await c.query(`DELETE FROM ${q('exec_publication')} WHERE dataset_id=$1 AND uf=$2 AND competence=$3`, [r.dataset_id, r.uf, p.competence]);
    }
    await c.query(`UPDATE ${q('exec_ingestion_run')} SET status = $2 WHERE run_id = $1`, [runId, RUN_STATUS.ROLLED_BACK]);
    const pre = (r.quality && (r.quality as Row).preHash) as string | undefined;
    let restored: string | null = null;
    if (pre) { restored = await sliceHash(c, specs, r.uf, r.competence); if (restored !== pre) throw new Error('verificação pós-rollback: hash difere do estado anterior à publicação'); }
    await c.query('COMMIT');
    return { status: 'ROLLED_BACK', runId, restoredHash: restored };
  } catch (e) { try { await c.query('ROLLBACK'); } catch { /* */ } throw e; } finally { c.release(); }
}

async function restoreIndicator(c: PoolClient, op: string, pk: Row, old: Row | null): Promise<void> {
  const t = q('exec_ind_value');
  const w = `indicator_id = ($1::jsonb->>'indicator_id')::smallint AND entity_id = ($1::jsonb->>'entity_id')::int AND period_start = ($1::jsonb->>'period_start')::date`;
  if (op === 'I') await c.query(`DELETE FROM ${t} WHERE ${w}`, [JSON.stringify(pk)]);
  else if (op === 'U') await c.query(`UPDATE ${t} f SET period_end=r.period_end, status=r.status, numerator=r.numerator, denominator=r.denominator, value=r.value, flags=r.flags, run_id=r.run_id FROM jsonb_populate_record(NULL::${t}, $1::jsonb) r WHERE f.indicator_id=r.indicator_id AND f.entity_id=r.entity_id AND f.period_start=r.period_start`, [JSON.stringify(old)]);
  else await c.query(`INSERT INTO ${t} SELECT * FROM jsonb_populate_record(NULL::${t}, $1::jsonb)`, [JSON.stringify(old)]);
}

export async function refreshLatest(c: PoolClient, indicatorId: number, entityId: number): Promise<void> {
  await c.query(`DELETE FROM ${q('exec_ind_latest')} WHERE indicator_id=$1 AND entity_id=$2`, [indicatorId, entityId]);
  await c.query(`INSERT INTO ${q('exec_ind_latest')} (indicator_id, entity_id, period_start, status, value, numerator, denominator, flags, run_id, published_at)
    SELECT indicator_id, entity_id, period_start, status, value, numerator, denominator, flags, run_id, now() FROM ${q('exec_ind_value')}
    WHERE indicator_id=$1 AND entity_id=$2 ORDER BY (status = 2) DESC, period_start DESC LIMIT 1`, [indicatorId, entityId]);   // definitivo mais recente; sem definitivo, o preliminar mais recente
}

export interface IndicatorRow { indicator_id: number; entity_id: number; period_start: string; period_end: string; status: 1 | 2; numerator: number | null; denominator: number | null; value: number | null; flags?: number }
/** Grava valores de indicadores com change log e mantém exec_ind_latest. Usar dentro de `derive`. */
export async function upsertIndicators(c: PoolClient, runId: number, rows: IndicatorRow[], log = true): Promise<number> {
  let n = 0; const pairs = new Map<string, { i: number; e: number }>();
  for (const r of rows) {
    const ex = (await c.query(`SELECT * FROM ${q('exec_ind_value')} WHERE indicator_id=$1 AND entity_id=$2 AND period_start=$3`, [r.indicator_id, r.entity_id, r.period_start])).rows[0] as Row | undefined;
    const pk = { indicator_id: r.indicator_id, entity_id: r.entity_id, period_start: r.period_start };
    const flags = r.flags ?? 0;
    if (!ex) {
      await c.query(`INSERT INTO ${q('exec_ind_value')} (indicator_id, entity_id, period_start, period_end, status, numerator, denominator, value, flags, run_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [r.indicator_id, r.entity_id, r.period_start, r.period_end, r.status, r.numerator, r.denominator, r.value, flags, runId]);
      if (log) await logRows(c, runId, 7, 'I', pk, null);
    } else {
      const same = ex.status === r.status && ex.numerator === r.numerator && ex.denominator === r.denominator && ex.value === r.value && ex.flags === flags && String(ex.period_end instanceof Date ? ex.period_end.toISOString().slice(0, 10) : ex.period_end) === r.period_end;
      if (same) continue;
      if (log) await logRows(c, runId, 7, 'U', pk, JSON.parse(JSON.stringify(ex)));
      await c.query(`UPDATE ${q('exec_ind_value')} SET period_end=$4, status=$5, numerator=$6, denominator=$7, value=$8, flags=$9, run_id=$10 WHERE indicator_id=$1 AND entity_id=$2 AND period_start=$3`,
        [r.indicator_id, r.entity_id, r.period_start, r.period_end, r.status, r.numerator, r.denominator, r.value, flags, runId]);
    }
    pairs.set(`${r.indicator_id}:${r.entity_id}`, { i: r.indicator_id, e: r.entity_id }); n++;
  }
  for (const p of pairs.values()) await refreshLatest(c, p.i, p.e);
  return n;
}

export interface ReplayInput { datasetId: number; uf: number; fromCompetence: number; snapshots: Map<number, TableInput[]>; sourceHash: string; failAfterApply?: boolean }
/** REPLAY_FROM(k): refaz os intervalos da UF de k em diante a partir dos snapshots (lidos do RAW), numa única transação. */
export async function replayFrom(pool: Pool, input: ReplayInput): Promise<{ runId: number; competences: number[] }> {
  const comps = [...input.snapshots.keys()].sort((a, b) => a - b);
  if (comps[0] !== input.fromCompetence) throw new Error('o primeiro snapshot deve ser a competência corrigida');
  for (let i = 1; i < comps.length; i++) if (comps[i] !== ymNext(comps[i - 1]!)) throw new Error(`snapshots não contíguos em ${comps[i]}`);
  const specs = [...new Map([...input.snapshots.values()].flat().map(t => [t.spec.name, t.spec])).values()].filter((s): s is IntervalSpec => s.kind === 'interval');
  const c = await pool.connect();
  try {
    await c.query('BEGIN'); await c.query("SET LOCAL lock_timeout = '10s'");
    await lockSlice(c, input.datasetId, input.uf);
    const k = input.fromCompetence;
    const run = await c.query(`INSERT INTO ${q('exec_ingestion_run')} (dataset_id, uf, competence, stage, status, started_at, source_hash, inputs)
      VALUES ($1,$2,$3,2,$4,now(),$5,$6::jsonb) RETURNING run_id`, [input.datasetId, input.uf, k, RUN_STATUS.RUNNING, Buffer.from(input.sourceHash, 'hex'), JSON.stringify({ replay: true, from: k, to: comps.at(-1) })]);
    const runId = run.rows[0].run_id as number;
    await c.query(`UPDATE ${q('exec_ingestion_run')} SET quality = jsonb_set(coalesce(quality, '{}'::jsonb), '{preHash}', to_jsonb($2::text)) WHERE run_id = $1`, [runId, await sliceHash(c, specs, input.uf, k)]);
    for (const spec of specs) {
      const t = q(spec.name); const vkey = [...spec.keys, 'valid_from'];
      const inScope = `(${spec.scopeSql}) AND (valid_from >= $2::integer OR valid_to >= $2::integer)`;
      let off = await nextSeq(c, runId);
      await c.query(`INSERT INTO ${q('exec_change_log')} (run_id, seq, table_id, op, pk, old_row)
        SELECT $3, $4::int + row_number() OVER (ORDER BY CASE WHEN f.valid_from >= $2::integer THEN 0 ELSE 1 END), ${spec.tableId}, CASE WHEN f.valid_from >= $2::integer THEN 'D' ELSE 'U' END, ${jsonPk('f', vkey)}, to_jsonb(f) FROM ${t} f WHERE ${inScope}`, [input.uf, k, runId, off]);
      await c.query(`DELETE FROM ${t} f WHERE ${spec.scopeSql} AND valid_from >= $2::integer`, [input.uf, k]);
      await c.query(`UPDATE ${t} f SET valid_to = NULL WHERE ${spec.scopeSql} AND valid_to >= $2::integer`, [input.uf, k]);
    }
    for (const comp of comps) {
      for (const t of input.snapshots.get(comp)!) {
        if (t.spec.kind !== 'interval') continue;
        const stg = await stage(c, t.spec, t.rows);
        await applyInterval(c, t.spec, stg, input.uf, comp, runId, true);
        await c.query(`DROP TABLE ${stg}`);
      }
    }
    if (input.failAfterApply) throw new Error('falha injetada após o replay');
    for (const spec of specs) await assertIntervalIntegrity(c, spec, input.uf);
    for (const comp of comps) {
      for (const t of input.snapshots.get(comp)!) {
        if (t.spec.kind !== 'interval') continue;
        const n = await c.query(`SELECT count(*)::int n FROM ${q(t.spec.name)} f WHERE valid_from <= $2::integer AND (valid_to IS NULL OR valid_to > $2::integer) AND (${t.spec.scopeSql})`, [input.uf, comp]);
        if (n.rows[0].n !== t.rows.length) throw new Error(`${t.spec.name}: ${n.rows[0].n} intervalos ativos em ${comp}, snapshot tem ${t.rows.length}`);
      }
      const h = await sliceHash(c, specs, input.uf, comp);
      await c.query(`INSERT INTO ${q('exec_publication')} (dataset_id, uf, competence, run_id, previous_run_id, state, stage, row_count, source_hash, activated_at)
        VALUES ($1,$2,$3,$4,NULL,1,2,$5,$6,now())
        ON CONFLICT (dataset_id, uf, competence) DO UPDATE SET previous_run_id = ${q('exec_publication')}.run_id, run_id = EXCLUDED.run_id, row_count = EXCLUDED.row_count, source_hash = EXCLUDED.source_hash, activated_at = EXCLUDED.activated_at`,
        [input.datasetId, input.uf, comp, runId, input.snapshots.get(comp)!.reduce((n, t) => n + t.rows.length, 0), Buffer.from(input.sourceHash, 'hex')]);
      if (comp === comps.at(-1)) await c.query(`UPDATE ${q('exec_ingestion_run')} SET slice_hash = $2 WHERE run_id = $1`, [runId, Buffer.from(h, 'hex')]);
    }
    await c.query(`UPDATE ${q('exec_ingestion_run')} SET status = $2, finished_at = now() WHERE run_id = $1`, [runId, RUN_STATUS.PUBLISHED]);
    await c.query('COMMIT');
    return { runId, competences: comps };
  } catch (e) { try { await c.query('ROLLBACK'); } catch { /* */ } throw e; } finally { c.release(); }
}

export { ymPrev };
