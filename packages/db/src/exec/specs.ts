/** Identificadores estáveis de dataset e de tabela (usados em exec_ingestion_run/exec_publication/exec_change_log). */
export const DATASET = {
  territory_ibge: 1, population_sidra: 2, cnes_st: 3, cnes_lt: 4, cnes_eq: 5, cnes_pf: 6, sim: 7, sinasc: 8, pni: 9,
  sih_rd: 10, sih_mun: 11, aps: 12, siconfi: 13, ind_derived: 14,
} as const;
export const RUN_STATUS = { RUNNING: 1, VALIDATED: 2, PUBLISHED: 9, ROLLED_BACK: 10, FAILED: 11, NO_CHANGE: 12 } as const;

export type TableKind = 'snapshot' | 'interval' | 'upsert';
interface Base { name: string; tableId: number; kind: TableKind }
/** Linhas de uma fatia (scopeSql usa $1 = uf, $2 = competência); o que sumir do arquivo é apagado dentro da fatia. */
export interface SnapshotSpec extends Base { kind: 'snapshot'; pk: string[]; values: string[]; scopeSql: string }
/** Intervalos semiabertos [valid_from, valid_to). keys identificam a entidade; values são comparados para abrir nova versão; scopeSql usa $1 = uf. */
export interface IntervalSpec extends Base { kind: 'interval'; keys: string[]; values: string[]; scopeSql: string }
/** Identidade que só cresce/atualiza (nunca apaga). */
export interface UpsertSpec extends Base { kind: 'upsert'; pk: string[]; values: string[]; /** colunas gravadas só na inserção (ex.: first_seen); não são comparadas nem atualizadas */ insertOnly?: string[] }
export type TableSpec = SnapshotSpec | IntervalSpec | UpsertSpec;

const UF_OF_ENTITY = `entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE uf_code = $1::smallint)`;
export const SPECS = {
  cnes_estab: { kind: 'upsert', name: 'exec_sau_cnes_estab', tableId: 10, pk: ['cnes'], values: ['entity_id'], insertOnly: ['first_seen', 'origin'] } satisfies UpsertSpec,
  cnes_estab_v: { kind: 'interval', name: 'exec_sau_cnes_estab_v', tableId: 1, keys: ['cnes'], values: ['entity_id', 'tp_unid', 'nat_jur', 'gestao', 'vinc_sus', 'flags'], scopeSql: UF_OF_ENTITY } satisfies IntervalSpec,
  cnes_leito_v: { kind: 'interval', name: 'exec_sau_cnes_leito_v', tableId: 2, keys: ['cnes', 'tp_leito', 'cod_leito'], values: ['entity_id', 'qt_exist', 'qt_sus', 'qt_nsus'], scopeSql: UF_OF_ENTITY } satisfies IntervalSpec,
  cnes_equip_v: { kind: 'interval', name: 'exec_sau_cnes_equip_v', tableId: 3, keys: ['cnes', 'tp_equip', 'cod_equip'], values: ['entity_id', 'qt_exist', 'qt_uso', 'sus_flag'], scopeSql: UF_OF_ENTITY } satisfies IntervalSpec,
  hosp_mes_subgrupo: { kind: 'snapshot', name: 'exec_sau_hosp_mes_subgrupo', tableId: 4, pk: ['cnes', 'competence', 'subgrupo'], values: ['uf', 'n_aih', 'valor_cents', 'dias_perm', 'obitos', 'n_icsap'], scopeSql: 'competence = $2::integer AND uf = $1::smallint' } satisfies SnapshotSpec,
  sih_mun_mes: { kind: 'snapshot', name: 'exec_sau_sih_mun_mes', tableId: 5, pk: ['entity_id', 'competence'], values: ['n_aih', 'n_icsap', 'n_fora_mun', 'valor_cents', 'dias_perm', 'obitos'], scopeSql: 'competence = $2::integer AND ($1::smallint = 0 OR ' + UF_OF_ENTITY + ')' } satisfies SnapshotSpec,
  prof_mun_cbo: { kind: 'snapshot', name: 'exec_sau_prof_mun_cbo', tableId: 6, pk: ['entity_id', 'cbo_group', 'snapshot_ym'], values: ['vinculos', 'pessoas'], scopeSql: 'snapshot_ym = $2::integer AND ' + UF_OF_ENTITY } satisfies SnapshotSpec,
  entity: { kind: 'upsert', name: 'exec_entity', tableId: 11, pk: ['entity_id'], values: ['kind', 'ibge7', 'uf_code', 'uf', 'name', 'parent_id', 'is_current'] } satisfies UpsertSpec,
  entity_ext: { kind: 'upsert', name: 'exec_entity_external_id', tableId: 12, pk: ['source', 'code', 'valid_from'], values: ['valid_to', 'entity_id'] } satisfies UpsertSpec,
  entity_version: { kind: 'upsert', name: 'exec_entity_version', tableId: 13, pk: ['entity_id', 'valid_from'], values: ['valid_to', 'change_kind', 'name', 'ibge7_prev', 'source_id', 'evidence_ref'] } satisfies UpsertSpec,
  ref_code: { kind: 'upsert', name: 'exec_ref_code', tableId: 14, pk: ['domain', 'code', 'valid_from'], values: ['valid_to', 'canonical_code', 'label', 'attrs'] } satisfies UpsertSpec,
  population: { kind: 'snapshot', name: 'exec_territory_population', tableId: 9, pk: ['entity_id', 'year', 'source'], values: ['value'], scopeSql: 'year = ($2::integer / 100)::smallint AND ($1::smallint = 0 OR ' + UF_OF_ENTITY + ')' } satisfies SnapshotSpec,
  fin_fact: { kind: 'snapshot', name: 'exec_fin_fact', tableId: 8, pk: ['entity_id', 'exercicio', 'periodo', 'conta_id', 'coluna_id'], values: ['valor'], scopeSql: 'exercicio = ($2::integer / 100)::smallint AND ($1::smallint = 0 OR ' + UF_OF_ENTITY + ')' } satisfies SnapshotSpec,
} as const;
export const SPEC_BY_ID = new Map<number, TableSpec>(Object.values(SPECS).map(s => [s.tableId, s as TableSpec]));
export const IND_VALUE_TABLE_ID = 7;
