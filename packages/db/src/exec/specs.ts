/** Identificadores estáveis de dataset e de tabela (usados em exec_ingestion_run/exec_publication/exec_change_log). */
export const DATASET = {
  territory_ibge: 1, population_sidra: 2, cnes_st: 3, cnes_lt: 4, cnes_eq: 5, cnes_pf: 6, sim: 7, sinasc: 8, pni: 9,
  sih_rd: 10, sih_mun: 11, aps: 12, siconfi: 13, ind_derived: 14,
  /** Segurança Pública P9.1: SIM por residência (fatia UF×ano), SIM por ocorrência (fatia nacional×ano), Sinesp VDE (fatia UF×ano). */
  seg_sim_res: 15, seg_sim_occ: 16, seg_vde: 17,
  /** Trânsito P9.2: SIM trânsito (residência UF×ano; ocorrência nacional×ano), frota Senatran (UF×mês), RENAEST (UF×ano), PRF (UF×ano), infrações Senatran (UF×mês). */
  tra_sim_res: 18, tra_sim_occ: 19, tra_frota: 20, tra_renaest: 21, tra_prf: 22, tra_infr: 23,
  /** Efetivos e estrutura institucional P9.3: FBSP Raio-X (nacional×ano), ESTADIC (nacional×edição), MUNIC (UF×edição), SIAPE (agregado mensal por órgão). */
  efe_fbsp: 24, efe_estadic: 25, efe_munic: 26, efe_siape: 27,
  /** Sistema Prisional P9.4 (SISDEPEN): fatias por UF × ciclo semestral (unidades, observações, fatos, crosswalk, cobertura e agregados territoriais) e fatia nacional (agregados do Brasil). */
  pri_uf: 28, pri_br: 29,
  /** Finanças da Segurança P9.5: DCA I-E (UF × exercício), RREO Anexo 02 (UF × exercício), DCA I-G (restos a pagar), União (DCA I-E e RREO, escopo nacional), execução federal mensal e dotação federal (escopo nacional × exercício). */
  fin_dca_uf: 30, fin_rreo_uf: 31, fin_dcarp_uf: 32, fin_dca_br: 33, fin_rreo_br: 34, fin_dcarp_br: 35, fin_fed_exec: 36, fin_fed_dot: 37,
  /** P9.5 ondas F: contratos do PNCP classificados (UF × ano de publicação) e transferências voluntárias do MJSP (UF do proponente × ano). */
  fin_pncp: 38, fin_transfer: 39,
  /** P9.5 onda E: função 06 das prefeituras do RS (TCE-RS), UF × exercício. */
  fin_rs_exec: 40,
  /** P9.5 onda D: função 06 do Estado de Pernambuco (TCE-PE DespesasEstaduais), UF × exercício. */
  fin_pe_exec: 41,
  /** P9.6: criminalidade estadual municipalizada — dataset = CRIME_DATASET_BASE + slot da fonte (ver crime-defs.ts), fatia UF × ano. */
  crime_base: 42,
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
const FIN_SCOPE_UF = `exercicio = ($2::integer / 100)::smallint AND ${UF_OF_ENTITY} AND `;
/** Escopo da União: só a entidade Brasil (kind 1); $1 aparece apenas para fixar o tipo do parâmetro (a fatia nacional usa uf = 0). */
const FIN_SCOPE_BR = `exercicio = ($2::integer / 100)::smallint AND $1::smallint = 0 AND entity_id = (SELECT entity_id FROM civica_exec.exec_entity WHERE kind = 1) AND `;
/** Escopo só de MUNICÍPIOS da UF (fontes municipais detalhadas) e só do ESTADO da UF (fontes estaduais detalhadas): nunca se apagam mutuamente. */
const FIN_SCOPE_MUN = `exercicio = ($2::integer / 100)::smallint AND entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE kind = 4 AND uf_code = $1::smallint) AND `;
const FIN_SCOPE_STATE = `exercicio = ($2::integer / 100)::smallint AND entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE kind = 3 AND uf_code = $1::smallint) AND `;
const FIN_COL = (domain: number) => `coluna_id IN (SELECT ref_id FROM civica_exec.exec_ref_code WHERE domain = ${domain})`;
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
  /** Cobertura do Sinesp VDE por UF × indicador × mês (universo do arquivo; distingue mês com registros de mês zerado). */
  seg_cov: { kind: 'snapshot', name: 'exec_seg_cov', tableId: 15, pk: ['uf', 'indicator_id', 'competence'], values: ['mun_pairs', 'src_lines', 'dup_lines', 'nz_rows', 'uf_total', 'unassigned', 'status'], scopeSql: 'uf = $1::smallint AND competence BETWEEN ($2::integer / 100) * 100 + 1 AND ($2::integer / 100) * 100 + 12' } satisfies SnapshotSpec,
  tra_frota: { kind: 'snapshot', name: 'exec_tra_frota_mun_mes', tableId: 16, pk: ['entity_id', 'competence'], values: ['total', 'automovel', 'bonde', 'caminhao', 'caminhao_trator', 'caminhonete', 'camioneta', 'chassi_plataf', 'ciclomotor', 'micro_onibus', 'motocicleta', 'motoneta', 'onibus', 'quadriciclo', 'reboque', 'semi_reboque', 'side_car', 'outros', 'trator_esteira', 'trator_rodas', 'triciclo', 'utilitario'], scopeSql: 'competence = $2::integer AND ' + UF_OF_ENTITY } satisfies SnapshotSpec,
  tra_infr: { kind: 'snapshot', name: 'exec_tra_infr_uf_mes', tableId: 17, pk: ['uf', 'competence', 'cod_infracao'], values: ['qtde'], scopeSql: 'uf = $1::smallint AND competence = $2::integer' } satisfies SnapshotSpec,
  tra_cov_renaest: { kind: 'snapshot', name: 'exec_tra_cov', tableId: 18, pk: ['source', 'uf', 'competence'], values: ['records', 'fatal_records', 'municipalities', 'universe', 'scope'], scopeSql: 'source = 1 AND uf = $1::smallint AND competence BETWEEN ($2::integer / 100) * 100 + 1 AND ($2::integer / 100) * 100 + 12' } satisfies SnapshotSpec,
  tra_cov_prf: { kind: 'snapshot', name: 'exec_tra_cov', tableId: 19, pk: ['source', 'uf', 'competence'], values: ['records', 'fatal_records', 'municipalities', 'universe', 'scope'], scopeSql: 'source = 2 AND uf = $1::smallint AND competence BETWEEN ($2::integer / 100) * 100 + 1 AND ($2::integer / 100) * 100 + 12' } satisfies SnapshotSpec,
  /** P9.4: scopeSql usa $1 = UF e $2 = competência (fim do semestre). */
  pri_unit: { kind: 'upsert', name: 'exec_pri_unit', tableId: 20, pk: ['unit_id'], values: ['uf', 'ambito', 'first_competence', 'last_competence', 'canonical_name', 'key_kind'] } satisfies UpsertSpec,
  pri_obs: { kind: 'snapshot', name: 'exec_pri_obs', tableId: 21, pk: ['unit_id', 'competence'], values: ['uf', 'cycle', 'source_name', 'other_names', 'entity_id', 'ibge7', 'tipo', 'ambito', 'sex_dest', 'gestao', 'row_no'], scopeSql: 'competence = $2::integer AND uf = $1::smallint' } satisfies SnapshotSpec,
  pri_fact: { kind: 'snapshot', name: 'exec_pri_fact', tableId: 22, pk: ['unit_id', 'competence', 'measure_id'], values: ['value'], scopeSql: 'competence = $2::integer AND unit_id IN (SELECT unit_id FROM civica_exec.exec_pri_unit WHERE uf = $1::smallint)' } satisfies SnapshotSpec,
  pri_xwalk: { kind: 'snapshot', name: 'exec_pri_xwalk', tableId: 23, pk: ['competence', 'row_no'], values: ['uf', 'unit_id', 'source_name', 'source_city', 'ibge7', 'method', 'confidence', 'review', 'evidence'], scopeSql: 'competence = $2::integer AND uf = $1::smallint' } satisfies SnapshotSpec,
  pri_cov: { kind: 'snapshot', name: 'exec_pri_cov', tableId: 24, pk: ['competence', 'uf'], values: ['rows_in_file', 'cela', 'dom_sem', 'dom_com', 'federal', 'new_units', 'continuing', 'absent_vs_prev', 'cap_incomplete', 'unassigned_mun'], scopeSql: 'competence = $2::integer AND uf = $1::smallint' } satisfies SnapshotSpec,

  /** P9.5: a MESMA tabela exec_fin_fact, em fatias disjuntas (cada escopo tem tableId PRÓPRIO: o rollback/hash resolvem o escopo pelo tableId) por demonstrativo (a coluna identifica o demonstrativo no dicionário). Escopo da UF = UF + seus municípios; o da União = só a entidade Brasil. */
  fin_fact_dca: { kind: 'snapshot', name: 'exec_fin_fact', tableId: 32, pk: ['entity_id', 'exercicio', 'periodo', 'conta_id', 'coluna_id'], values: ['valor'], scopeSql: FIN_SCOPE_UF + FIN_COL(31) } satisfies SnapshotSpec,
  fin_fact_rreo: { kind: 'snapshot', name: 'exec_fin_fact', tableId: 33, pk: ['entity_id', 'exercicio', 'periodo', 'conta_id', 'coluna_id'], values: ['valor'], scopeSql: FIN_SCOPE_UF + FIN_COL(32) } satisfies SnapshotSpec,
  fin_fact_dcarp: { kind: 'snapshot', name: 'exec_fin_fact', tableId: 34, pk: ['entity_id', 'exercicio', 'periodo', 'conta_id', 'coluna_id'], values: ['valor'], scopeSql: FIN_SCOPE_UF + FIN_COL(33) } satisfies SnapshotSpec,
  fin_fact_dca_br: { kind: 'snapshot', name: 'exec_fin_fact', tableId: 35, pk: ['entity_id', 'exercicio', 'periodo', 'conta_id', 'coluna_id'], values: ['valor'], scopeSql: FIN_SCOPE_BR + FIN_COL(31) } satisfies SnapshotSpec,
  fin_fact_rreo_br: { kind: 'snapshot', name: 'exec_fin_fact', tableId: 36, pk: ['entity_id', 'exercicio', 'periodo', 'conta_id', 'coluna_id'], values: ['valor'], scopeSql: FIN_SCOPE_BR + FIN_COL(32) } satisfies SnapshotSpec,
  fin_fact_dcarp_br: { kind: 'snapshot', name: 'exec_fin_fact', tableId: 37, pk: ['entity_id', 'exercicio', 'periodo', 'conta_id', 'coluna_id'], values: ['valor'], scopeSql: FIN_SCOPE_BR + FIN_COL(33) } satisfies SnapshotSpec,
  fin_cov_dca: { kind: 'snapshot', name: 'exec_fin_cov', tableId: 38, pk: ['source', 'entity_id', 'exercicio', 'periodo'], values: ['status', 'items', 'fn06', 'stages', 'caveats'], scopeSql: FIN_SCOPE_UF + 'source = 1' } satisfies SnapshotSpec,
  fin_cov_rreo: { kind: 'snapshot', name: 'exec_fin_cov', tableId: 39, pk: ['source', 'entity_id', 'exercicio', 'periodo'], values: ['status', 'items', 'fn06', 'stages', 'caveats'], scopeSql: FIN_SCOPE_UF + 'source = 2' } satisfies SnapshotSpec,
  fin_cov_dcarp: { kind: 'snapshot', name: 'exec_fin_cov', tableId: 40, pk: ['source', 'entity_id', 'exercicio', 'periodo'], values: ['status', 'items', 'fn06', 'stages', 'caveats'], scopeSql: FIN_SCOPE_UF + 'source = 3' } satisfies SnapshotSpec,
  fin_cov_dca_br: { kind: 'snapshot', name: 'exec_fin_cov', tableId: 41, pk: ['source', 'entity_id', 'exercicio', 'periodo'], values: ['status', 'items', 'fn06', 'stages', 'caveats'], scopeSql: FIN_SCOPE_BR + 'source = 1' } satisfies SnapshotSpec,
  fin_cov_rreo_br: { kind: 'snapshot', name: 'exec_fin_cov', tableId: 42, pk: ['source', 'entity_id', 'exercicio', 'periodo'], values: ['status', 'items', 'fn06', 'stages', 'caveats'], scopeSql: FIN_SCOPE_BR + 'source = 2' } satisfies SnapshotSpec,
  fin_cov_dcarp_br: { kind: 'snapshot', name: 'exec_fin_cov', tableId: 43, pk: ['source', 'entity_id', 'exercicio', 'periodo'], values: ['status', 'items', 'fn06', 'stages', 'caveats'], scopeSql: FIN_SCOPE_BR + 'source = 3' } satisfies SnapshotSpec,
  fin_org: { kind: 'upsert', name: 'exec_fin_org', tableId: 26, pk: ['org_id'], values: ['entity_id', 'level', 'code', 'parent_id', 'name', 'first_year', 'last_year', 'names'] } satisfies UpsertSpec,
  fin_exec: { kind: 'snapshot', name: 'exec_fin_exec', tableId: 27, pk: ['entity_id', 'exercicio', 'mes', 'org_id', 'funcao', 'subfuncao', 'programa', 'acao', 'categoria', 'grupo', 'modalidade', 'uf_loc'], values: ['emp', 'liq', 'pago', 'rp_insc', 'rp_canc', 'rp_pago'], scopeSql: FIN_SCOPE_BR + 'TRUE' } satisfies SnapshotSpec,
  fin_dot: { kind: 'snapshot', name: 'exec_fin_dot', tableId: 28, pk: ['entity_id', 'exercicio', 'org_id', 'funcao', 'subfuncao', 'programa', 'acao', 'categoria', 'grupo'], values: ['dot_ini', 'dot_atu', 'orc_emp', 'orc_real'], scopeSql: FIN_SCOPE_BR + 'TRUE' } satisfies SnapshotSpec,
  fin_supplier: { kind: 'upsert', name: 'exec_fin_supplier', tableId: 29, pk: ['cnpj'], values: ['name'] } satisfies UpsertSpec,
  fin_contract: { kind: 'snapshot', name: 'exec_fin_contract', tableId: 30, pk: ['pncp_id'], values: ['year', 'uf', 'entity_id', 'esfera', 'org_cnpj', 'org_kind', 'theme', 'link', 'tipo', 'categoria', 'valor_global', 'valor_inicial', 'signed', 'supplier', 'empenho', 'retif'], scopeSql: 'uf = $1::smallint AND year = ($2::integer / 100)::smallint' } satisfies SnapshotSpec,
  fin_transfer: { kind: 'snapshot', name: 'exec_fin_transfer', tableId: 31, pk: ['proposal_id'], values: ['year', 'uf', 'entity_id', 'benef_kind', 'concedente', 'instrument', 'prop_status', 'conv_status', 'v_global_prop', 'v_repasse_prop', 'v_global_conv', 'v_repasse_conv', 'v_empenhado_conv', 'v_desembolsado_conv', 'signed'], scopeSql: 'uf = $1::smallint AND year = ($2::integer / 100)::smallint' } satisfies SnapshotSpec,
  /** Execução detalhada dos MUNICÍPIOS de uma UF (TCE-RS) e do ESTADO (TCE-PE): escopos disjuntos entre si e da federal (entidade Brasil). */
  fin_exec_uf: { kind: 'snapshot', name: 'exec_fin_exec', tableId: 44, pk: ['entity_id', 'exercicio', 'mes', 'org_id', 'funcao', 'subfuncao', 'programa', 'acao', 'categoria', 'grupo', 'modalidade', 'uf_loc'], values: ['emp', 'liq', 'pago', 'rp_insc', 'rp_canc', 'rp_pago'], scopeSql: FIN_SCOPE_MUN + 'TRUE' } satisfies SnapshotSpec,
  fin_exec_state: { kind: 'snapshot', name: 'exec_fin_exec', tableId: 45, pk: ['entity_id', 'exercicio', 'mes', 'org_id', 'funcao', 'subfuncao', 'programa', 'acao', 'categoria', 'grupo', 'modalidade', 'uf_loc'], values: ['emp', 'liq', 'pago', 'rp_insc', 'rp_canc', 'rp_pago'], scopeSql: FIN_SCOPE_STATE + 'TRUE' } satisfies SnapshotSpec,
} as const;

/** P9.6: cobertura (exec_seg_cov) por fonte estadual, escopo = UF × ano × FAIXA de indicadores da fonte (não apaga a cobertura do VDE/P9.1 nem de outras fontes). tableId = 50 + slot. */
export const CRIME_SLOTS = 20;
export const CRIME_COV_SPECS: SnapshotSpec[] = Array.from({ length: CRIME_SLOTS }, (_, slot) => ({
  kind: 'snapshot', name: 'exec_seg_cov', tableId: 50 + slot, pk: ['uf', 'indicator_id', 'competence'], values: ['mun_pairs', 'src_lines', 'dup_lines', 'nz_rows', 'uf_total', 'unassigned', 'status'],
  scopeSql: `uf = $1::smallint AND indicator_id BETWEEN ${8001 + slot * 100} AND ${8099 + slot * 100} AND competence BETWEEN ($2::integer / 100) * 100 + 1 AND ($2::integer / 100) * 100 + 12`,
} satisfies SnapshotSpec));
export const SPEC_BY_ID = new Map<number, TableSpec>([...Object.values(SPECS), ...CRIME_COV_SPECS].map(s => [s.tableId, s as TableSpec]));
export const IND_VALUE_TABLE_ID = 7;
