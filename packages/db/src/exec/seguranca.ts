import type { PoolClient } from 'pg';
import type { IndicatorRow } from './publication.ts';
import { IND_VALUE_TABLE_ID } from './specs.ts';

const q = (n: string) => `civica_exec.${n}`;

export interface BulkScope {
  indicatorIds: number[];
  /** 0 = todas as UFs (fatia nacional); senão, código IBGE da UF (entidades UF, municípios e município ignorado). */
  ufCode: number;
  /** [from, to): períodos (period_start) pertencentes à fatia. */
  from: string; to: string;
  /** Só com ufCode = 0: a entidade Brasil (kind 1) também pertence ao escopo (efetivos nacionais, P9.3). Padrão: false (P9.1/P9.2 inalterados). */
  includeNational?: boolean;
  /** Escopo SOMENTE da entidade Brasil (kind 1): ignora ufCode (fatia nacional de agregados, P9.4). */
  nationalOnly?: boolean;
}
export interface BulkResult { inserted: number; updated: number; deleted: number; unchanged: number }

/**
 * Substitui, em lote e na transação do chamador, o conteúdo de exec_ind_value dentro de um escopo (indicadores × entidades da UF × períodos).
 * Linhas que somem do arquivo são removidas (a publicação de um XLSX/DBC reescrito não deixa resíduo), tudo com change log (quando `log`)
 * no formato do motor (table_id 7, op I/U/D, old_row = linha anterior) para que `rollbackRun` continue exato, e exec_ind_latest é refeito só nos pares tocados.
 */
export async function replaceIndicatorsBulk(c: PoolClient, runId: number, scope: BulkScope, rows: IndicatorRow[], log: boolean): Promise<BulkResult> {
  await c.query(`CREATE TEMP TABLE stg_seg_ind (indicator_id smallint NOT NULL, entity_id integer NOT NULL, period_start date NOT NULL, period_end date NOT NULL, status smallint NOT NULL,
    numerator double precision, denominator double precision, value double precision, flags smallint NOT NULL, run_id integer NOT NULL, PRIMARY KEY (indicator_id, entity_id, period_start)) ON COMMIT DROP`);
  for (let i = 0; i < rows.length; i += 5000) {
    const part = rows.slice(i, i + 5000).map(r => ({ indicator_id: r.indicator_id, entity_id: r.entity_id, period_start: r.period_start, period_end: r.period_end, status: r.status, numerator: r.numerator, denominator: r.denominator, value: r.value, flags: r.flags ?? 0, run_id: runId }));
    await c.query(`INSERT INTO stg_seg_ind SELECT indicator_id, entity_id, period_start, period_end, status, numerator, denominator, value, flags, run_id FROM jsonb_populate_recordset(NULL::stg_seg_ind, $1::jsonb)`, [JSON.stringify(part)]);
  }
  const nat = scope.includeNational && scope.ufCode === 0 ? ' OR kind = 1' : '';
  const ents = scope.nationalOnly ? `v.entity_id IN (SELECT entity_id FROM ${q('exec_entity')} WHERE kind = 1 AND $4::integer IS NOT NULL)` : `v.entity_id IN (SELECT entity_id FROM ${q('exec_entity')} WHERE (kind IN (3, 4, 5) AND ($4::integer = 0 OR uf_code = $4::integer))${nat})`;
  const inScope = `v.indicator_id = ANY($1::smallint[]) AND v.period_start >= $2::date AND v.period_start < $3::date AND ${ents}`;
  const args = [scope.indicatorIds, scope.from, scope.to, scope.ufCode];
  const same = `v.period_end = s.period_end AND v.status = s.status AND v.numerator IS NOT DISTINCT FROM s.numerator AND v.denominator IS NOT DISTINCT FROM s.denominator AND v.value IS NOT DISTINCT FROM s.value AND v.flags = s.flags`;
  const pk = `v.indicator_id = s.indicator_id AND v.entity_id = s.entity_id AND v.period_start = s.period_start`;
  await c.query(`CREATE TEMP TABLE chg_seg_ind (indicator_id smallint NOT NULL, entity_id integer NOT NULL, PRIMARY KEY (indicator_id, entity_id)) ON COMMIT DROP`);
  const nextSeq = async () => Number((await c.query(`SELECT coalesce(max(seq), 0)::int AS m FROM ${q('exec_change_log')} WHERE run_id = $1`, [runId])).rows[0].m);
  const pkJson = (a: string) => `jsonb_build_object('indicator_id', ${a}.indicator_id, 'entity_id', ${a}.entity_id, 'period_start', ${a}.period_start)`;
  // 1) log (estado anterior) — U, D e I, nesta ordem; o rollback aplica o inverso
  if (log) {
    const upd = `FROM ${q('exec_ind_value')} v JOIN stg_seg_ind s ON ${pk} WHERE NOT (${same})`;
    let off = await nextSeq();
    await c.query(`INSERT INTO ${q('exec_change_log')} (run_id, seq, table_id, op, pk, old_row) SELECT $5, $6::int + row_number() OVER (), ${IND_VALUE_TABLE_ID}, 'U', ${pkJson('v')}, to_jsonb(v) ${upd} AND $1::smallint[] IS NOT NULL AND $2::date IS NOT NULL AND $3::date IS NOT NULL AND $4::integer IS NOT NULL`, [...args, runId, off]);
    off = await nextSeq();
    await c.query(`INSERT INTO ${q('exec_change_log')} (run_id, seq, table_id, op, pk, old_row) SELECT $5, $6::int + row_number() OVER (), ${IND_VALUE_TABLE_ID}, 'D', ${pkJson('v')}, to_jsonb(v)
      FROM ${q('exec_ind_value')} v WHERE ${inScope} AND NOT EXISTS (SELECT 1 FROM stg_seg_ind s WHERE ${pk})`, [...args, runId, off]);
    off = await nextSeq();
    await c.query(`INSERT INTO ${q('exec_change_log')} (run_id, seq, table_id, op, pk, old_row) SELECT $1, $2::int + row_number() OVER (), ${IND_VALUE_TABLE_ID}, 'I', ${pkJson('s')}, NULL
      FROM stg_seg_ind s WHERE NOT EXISTS (SELECT 1 FROM ${q('exec_ind_value')} v WHERE ${pk})`, [runId, off]);
  }
  // 2) pares tocados (para refazer exec_ind_latest)
  await c.query(`INSERT INTO chg_seg_ind SELECT s.indicator_id, s.entity_id FROM stg_seg_ind s LEFT JOIN ${q('exec_ind_value')} v ON ${pk} WHERE v.indicator_id IS NULL OR NOT (${same}) ON CONFLICT DO NOTHING`);
  await c.query(`INSERT INTO chg_seg_ind SELECT v.indicator_id, v.entity_id FROM ${q('exec_ind_value')} v WHERE ${inScope} AND NOT EXISTS (SELECT 1 FROM stg_seg_ind s WHERE ${pk}) ON CONFLICT DO NOTHING`, args);
  await c.query(`DELETE FROM ${q('exec_ind_latest')} l USING chg_seg_ind g WHERE l.indicator_id = g.indicator_id AND l.entity_id = g.entity_id`);
  // 3) aplica
  const upd = await c.query(`UPDATE ${q('exec_ind_value')} v SET period_end = s.period_end, status = s.status, numerator = s.numerator, denominator = s.denominator, value = s.value, flags = s.flags, run_id = s.run_id FROM stg_seg_ind s WHERE ${pk} AND NOT (${same})`);
  const del = await c.query(`DELETE FROM ${q('exec_ind_value')} v WHERE ${inScope} AND NOT EXISTS (SELECT 1 FROM stg_seg_ind s WHERE ${pk})`, args);
  const ins = await c.query(`INSERT INTO ${q('exec_ind_value')} (indicator_id, entity_id, period_start, period_end, status, numerator, denominator, value, flags, run_id)
    SELECT s.indicator_id, s.entity_id, s.period_start, s.period_end, s.status, s.numerator, s.denominator, s.value, s.flags, s.run_id FROM stg_seg_ind s WHERE NOT EXISTS (SELECT 1 FROM ${q('exec_ind_value')} v WHERE ${pk})`);
  // 4) exec_ind_latest: definitivo mais recente; sem definitivo, o preliminar mais recente (mesma regra de refreshLatest)
  await c.query(`INSERT INTO ${q('exec_ind_latest')} (indicator_id, entity_id, period_start, status, value, numerator, denominator, flags, run_id, published_at)
    SELECT DISTINCT ON (v.indicator_id, v.entity_id) v.indicator_id, v.entity_id, v.period_start, v.status, v.value, v.numerator, v.denominator, v.flags, v.run_id, now()
    FROM ${q('exec_ind_value')} v JOIN chg_seg_ind g ON g.indicator_id = v.indicator_id AND g.entity_id = v.entity_id
    ORDER BY v.indicator_id, v.entity_id, (v.status = 2) DESC, v.period_start DESC`);
  return { inserted: ins.rowCount ?? 0, updated: upd.rowCount ?? 0, deleted: del.rowCount ?? 0, unchanged: rows.length - (ins.rowCount ?? 0) - (upd.rowCount ?? 0) };
}
