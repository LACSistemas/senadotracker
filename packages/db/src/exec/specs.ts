import { INFRA_VARS } from './educacao-infra-catalog.ts';
import { IND_SCHOOL_COLS, IND_TERR_COLS } from './educacao-ind-catalog.ts';
import { DOC_COLS } from './educacao-doc-catalog.ts';
import { FLOW_COLS, INSE_LEVEL_COLS, TRN_COLS } from './educacao-flow-catalog.ts';
import { IDEB_MEASURES, SAEB_LEVEL_COLS } from './educacao-learn-catalog.ts';

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
  /** P10.1: cadastro de escolas do Censo Escolar (INEP), fatia UF × edição (competência = ano × 100 + 5, a referência de maio). */
  edu_censo: 70,
  /** P10.2: matrículas, turmas e oferta por escola (fatia UF × edição, competência = ano × 100 + 5), publicadas à parte do cadastro para rollback e replay independentes. */
  edu_oferta: 71,
  /** P10.3: infraestrutura escolar do Censo Escolar (fatia UF × edição, competência = ano × 100 + 5). */
  edu_infra: 72,
  /** P10.3: Indicadores Educacionais oficiais do INEP (ATU, HAD, DSU, AFD, IED, IRD, ICG): escola e território × edição; uf = 0 é a fatia nacional (Brasil e regiões). */
  edu_ind: 73,
  /** P10.3: docentes distintos oficiais da Sinopse Estatística (Brasil, UF e município × edição); uf = 0 é a fatia nacional. */
  edu_doc: 74,
  /** P10.4: Ideb oficial (INEP; todas as edições 2005–2025), fatia UF × edição; uf = 0 é a fatia nacional (Brasil e regiões). */
  edu_ideb: 75,
  /** P10.4: resultados agregados do Saeb (2017–2025), fatia UF × edição; uf = 0 é a fatia nacional. */
  edu_saeb: 76,
  /** P10.4: rendimento, distorção idade-série, transição e INSE (Indicadores Educacionais), fatia UF × edição; uf = 0 é a fatia nacional. */
  edu_fluxo: 77,
  edu_trn: 78,
  edu_inse: 79,
  /** P10.5: DCA função 12 (Educação), separado da publicação de função 06. */
  fin_edu_dca_uf: 106, fin_edu_dca_br: 107, fin_edu_siope: 108,
  edu_program_portal: 112, edu_program_pdde: 113,
  /** P10.7: contratações e obras educacionais. */
  edu_contract: 114, edu_procurement: 115, edu_term: 116, edu_work: 117, edu_audit: 118,
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
const FIN_FN_COL = (domain: number, code: string) => `${FIN_COL(domain)} AND conta_id IN (SELECT ref_id FROM civica_exec.exec_ref_code WHERE domain = 30 AND (code = '${code}' OR code LIKE '${code}.%' OR code = 'FU${code}'))`;
/** Colunas de medida de exec_edu_offer_year (P10.2), na ordem do DDL v10. */
export const EDU_INFRA_COLS: string[] = INFRA_VARS.map(x => x.code);
export const EDU_INFRA_AGG_COLS: string[] = INFRA_VARS.flatMap(x => x.kind === 'flag' ? [`${x.code}_t`, `${x.code}_f`] : [`${x.code}_s`, `${x.code}_n`]);
export const EDU_OFFER_COLS: string[] = ['mat_bas', 'mat_inf_cre', 'mat_inf_pre', 'mat_fund_ai', 'mat_fund_af', 'mat_med', 'mat_eja_fund', 'mat_eja_med', 'mat_prof', 'mat_esp_cc', 'mat_esp_ce', 'mat_int_inf', 'mat_int_fund', 'mat_int_med', 'mat_noturno', 'mat_ead',
  'tur_bas', 'tur_inf_cre', 'tur_inf_pre', 'tur_fund_ai', 'tur_fund_af', 'tur_med', 'tur_eja', 'tur_eja_fund', 'tur_eja_med', 'tur_prof', 'tur_esp_cc', 'tur_esp_ce', 'tur_int_inf', 'tur_int_fund', 'tur_int_med'];
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
  fin_edu_fact_dca: { kind: 'snapshot', name: 'exec_fin_fact', tableId: 106, pk: ['entity_id', 'exercicio', 'periodo', 'conta_id', 'coluna_id'], values: ['valor'], scopeSql: FIN_SCOPE_UF + FIN_FN_COL(31, '12') } satisfies SnapshotSpec,
  fin_edu_fact_dca_br: { kind: 'snapshot', name: 'exec_fin_fact', tableId: 107, pk: ['entity_id', 'exercicio', 'periodo', 'conta_id', 'coluna_id'], values: ['valor'], scopeSql: FIN_SCOPE_BR + FIN_FN_COL(31, '12') } satisfies SnapshotSpec,
  fin_edu_cov_dca: { kind: 'snapshot', name: 'exec_fin_cov', tableId: 108, pk: ['source', 'entity_id', 'exercicio', 'periodo'], values: ['status', 'items', 'fn06', 'fn12', 'stages', 'caveats'], scopeSql: FIN_SCOPE_UF + 'source = 1' } satisfies SnapshotSpec,
  fin_edu_cov_dca_br: { kind: 'snapshot', name: 'exec_fin_cov', tableId: 109, pk: ['source', 'entity_id', 'exercicio', 'periodo'], values: ['status', 'items', 'fn06', 'fn12', 'stages', 'caveats'], scopeSql: FIN_SCOPE_BR + 'source = 1' } satisfies SnapshotSpec,
  edu_siope_fact: { kind: 'snapshot', name: 'exec_edu_siope_fact', tableId: 110, pk: ['entity_id', 'exercicio', 'periodo', 'componente', 'codigo', 'estagio'], values: ['valor_cents', 'valor_text', 'source_key', 'raw_sha256'], scopeSql: 'exercicio = ($2::integer / 100)::smallint AND ($1::smallint = 0 OR entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE uf_code = $1::smallint))' } satisfies SnapshotSpec,
  edu_siope_cov: { kind: 'snapshot', name: 'exec_edu_siope_cov', tableId: 111, pk: ['uf', 'exercicio', 'periodo', 'componente'], values: ['status', 'rows_in', 'valid', 'rejected', 'source_hash', 'source_updated_at'], scopeSql: 'exercicio = ($2::integer / 100)::smallint AND ($1::smallint = 0 OR uf = $1::smallint)' } satisfies SnapshotSpec,
  edu_program_portal: { kind: 'snapshot', name: 'exec_edu_program_fact', tableId: 112, pk: ['source_key'], values: ['source_dataset', 'competence', 'year', 'month', 'program_code', 'program_name', 'financial_stage', 'amount_cents', 'uf', 'municipality_siafi', 'beneficiary_type', 'beneficiary_code', 'beneficiary_name', 'entity_id', 'school_inep', 'uex_cnpj', 'eex_cnpj', 'action', 'plan', 'source_status', 'raw_id', 'source_url', 'raw_sha256', 'provenance'], scopeSql: "competence = $2::integer AND $1::smallint = 0 AND source_dataset = 'portal_transferencias'" } satisfies SnapshotSpec,
  edu_program_pdde: { kind: 'snapshot', name: 'exec_edu_program_fact', tableId: 113, pk: ['source_key'], values: ['source_dataset', 'competence', 'year', 'month', 'program_code', 'program_name', 'financial_stage', 'amount_cents', 'uf', 'municipality_siafi', 'beneficiary_type', 'beneficiary_code', 'beneficiary_name', 'entity_id', 'school_inep', 'uex_cnpj', 'eex_cnpj', 'action', 'plan', 'source_status', 'raw_id', 'source_url', 'raw_sha256', 'provenance'], scopeSql: "competence = $2::integer AND uf = $1::smallint AND source_dataset = 'pdde_info'" } satisfies SnapshotSpec,
  edu_contract: { kind: 'snapshot', name: 'exec_edu_contract', tableId: 114, pk: ['pncp_id'], values: ['year', 'uf', 'entity_id', 'esfera', 'org_cnpj', 'buyer', 'best_confidence', 'tipo', 'categoria', 'valor_global', 'valor_inicial', 'valor_acumulado', 'outlier', 'signed', 'vig_start', 'vig_end', 'supplier', 'empenho', 'retif', 'compra', 'cipi', 'seq', 'objeto'], scopeSql: 'uf = $1::smallint AND year = ($2::integer / 100)::smallint' } satisfies SnapshotSpec,
  edu_contract_class: { kind: 'snapshot', name: 'exec_edu_contract_class', tableId: 115, pk: ['pncp_id', 'category'], values: ['year', 'uf', 'entity_id', 'esfera', 'valor', 'outlier', 'via', 'rule', 'confidence', 'evidence'], scopeSql: 'uf = $1::smallint AND year = ($2::integer / 100)::smallint' } satisfies SnapshotSpec,
  edu_ctr_cov_contract: { kind: 'snapshot', name: 'exec_edu_ctr_cov', tableId: 116, pk: ['kind', 'year', 'uf'], values: ['rows_in', 'rows_out', 'rejected', 'no_value', 'pending'], scopeSql: 'kind = 1 AND uf = $1::smallint AND year = ($2::integer / 100)::smallint' } satisfies SnapshotSpec,
  edu_procurement: { kind: 'snapshot', name: 'exec_edu_procurement', tableId: 117, pk: ['compra'], values: ['year', 'uf', 'entity_id', 'org_cnpj', 'modalidade', 'modo_disputa', 'situacao', 'srp', 'valor_estimado', 'valor_homologado', 'sigiloso', 'pub_date', 'open_date', 'close_date', 'has_result', 'objeto'], scopeSql: 'uf = $1::smallint AND year = ($2::integer / 100)::smallint' } satisfies SnapshotSpec,
  edu_ctr_cov_procurement: { kind: 'snapshot', name: 'exec_edu_ctr_cov', tableId: 118, pk: ['kind', 'year', 'uf'], values: ['rows_in', 'rows_out', 'rejected', 'no_value', 'pending'], scopeSql: 'kind = 2 AND uf = $1::smallint AND year = ($2::integer / 100)::smallint' } satisfies SnapshotSpec,
  edu_term: { kind: 'snapshot', name: 'exec_edu_contract_term', tableId: 119, pk: ['pncp_id', 'seq'], values: ['year', 'uf', 'kind', 'signed', 'vig_end', 'valor_acrescido', 'valor_global', 'prazo_dias', 'q_valor', 'q_vigencia', 'q_reajuste', 'q_fornecedor', 'objeto'], scopeSql: 'uf = $1::smallint AND year = ($2::integer / 100)::smallint' } satisfies SnapshotSpec,
  edu_ctr_cov_term: { kind: 'snapshot', name: 'exec_edu_ctr_cov', tableId: 120, pk: ['kind', 'year', 'uf'], values: ['rows_in', 'rows_out', 'rejected', 'no_value', 'pending'], scopeSql: 'kind = 3 AND uf = $1::smallint AND year = ($2::integer / 100)::smallint' } satisfies SnapshotSpec,
  edu_work: { kind: 'snapshot', name: 'exec_edu_work', tableId: 121, pk: ['work_id'], values: ['uf', 'entity_id', 'name', 'descricao', 'especie', 'natureza', 'situacao', 'd_start_prev', 'd_end_prev', 'd_start_eff', 'd_end_eff', 'd_situacao', 'd_cadastro', 'valor_previsto', 'valor_placeholder', 'tomadores', 'executores', 'repassadores', 'edu_basis', 'edu_confidence', 'phys_percent', 'phys_situacao', 'phys_date', 'em_operacao', 'committed', 'commits', 'year'], scopeSql: 'uf = $1::smallint AND year = ($2::integer / 100)::smallint' } satisfies SnapshotSpec,
  edu_work_commit: { kind: 'snapshot', name: 'exec_edu_work_commit', tableId: 122, pk: ['work_id', 'idx'], values: ['uf', 'year', 'nota', 'ug_emitente', 'natureza', 'fonte', 'valor'], scopeSql: 'uf = $1::smallint AND year = ($2::integer / 100)::smallint' } satisfies SnapshotSpec,
  edu_ctr_cov_work: { kind: 'snapshot', name: 'exec_edu_ctr_cov', tableId: 123, pk: ['kind', 'year', 'uf'], values: ['rows_in', 'rows_out', 'rejected', 'no_value', 'pending'], scopeSql: 'kind = 4 AND uf = $1::smallint AND year = ($2::integer / 100)::smallint' } satisfies SnapshotSpec,
  edu_audit: { kind: 'snapshot', name: 'exec_edu_contract_audit', tableId: 124, pk: ['pncp_id'], values: ['band', 'verdict', 'cat_ok', 'note', 'rules', 'reviewed_on'], scopeSql: '$1::smallint = 0 AND $2::integer > 0' } satisfies SnapshotSpec,
  fin_org: { kind: 'upsert', name: 'exec_fin_org', tableId: 26, pk: ['org_id'], values: ['entity_id', 'level', 'code', 'parent_id', 'name', 'first_year', 'last_year', 'names'] } satisfies UpsertSpec,
  fin_exec: { kind: 'snapshot', name: 'exec_fin_exec', tableId: 27, pk: ['entity_id', 'exercicio', 'mes', 'org_id', 'funcao', 'subfuncao', 'programa', 'acao', 'categoria', 'grupo', 'modalidade', 'uf_loc'], values: ['emp', 'liq', 'pago', 'rp_insc', 'rp_canc', 'rp_pago'], scopeSql: FIN_SCOPE_BR + 'TRUE' } satisfies SnapshotSpec,
  fin_dot: { kind: 'snapshot', name: 'exec_fin_dot', tableId: 28, pk: ['entity_id', 'exercicio', 'org_id', 'funcao', 'subfuncao', 'programa', 'acao', 'categoria', 'grupo'], values: ['dot_ini', 'dot_atu', 'orc_emp', 'orc_real'], scopeSql: FIN_SCOPE_BR + 'TRUE' } satisfies SnapshotSpec,
  fin_supplier: { kind: 'upsert', name: 'exec_fin_supplier', tableId: 29, pk: ['cnpj'], values: ['name'] } satisfies UpsertSpec,
  fin_contract: { kind: 'snapshot', name: 'exec_fin_contract', tableId: 30, pk: ['pncp_id'], values: ['year', 'uf', 'entity_id', 'esfera', 'org_cnpj', 'org_kind', 'theme', 'link', 'tipo', 'categoria', 'valor_global', 'valor_inicial', 'signed', 'supplier', 'empenho', 'retif'], scopeSql: 'uf = $1::smallint AND year = ($2::integer / 100)::smallint' } satisfies SnapshotSpec,
  fin_transfer: { kind: 'snapshot', name: 'exec_fin_transfer', tableId: 31, pk: ['proposal_id'], values: ['year', 'uf', 'entity_id', 'benef_kind', 'concedente', 'instrument', 'prop_status', 'conv_status', 'v_global_prop', 'v_repasse_prop', 'v_global_conv', 'v_repasse_conv', 'v_empenhado_conv', 'v_desembolsado_conv', 'signed'], scopeSql: 'uf = $1::smallint AND year = ($2::integer / 100)::smallint' } satisfies SnapshotSpec,
  /** Execução detalhada dos MUNICÍPIOS de uma UF (TCE-RS) e do ESTADO (TCE-PE): escopos disjuntos entre si e da federal (entidade Brasil). */
  fin_exec_uf: { kind: 'snapshot', name: 'exec_fin_exec', tableId: 44, pk: ['entity_id', 'exercicio', 'mes', 'org_id', 'funcao', 'subfuncao', 'programa', 'acao', 'categoria', 'grupo', 'modalidade', 'uf_loc'], values: ['emp', 'liq', 'pago', 'rp_insc', 'rp_canc', 'rp_pago'], scopeSql: FIN_SCOPE_MUN + 'TRUE' } satisfies SnapshotSpec,
  fin_exec_state: { kind: 'snapshot', name: 'exec_fin_exec', tableId: 45, pk: ['entity_id', 'exercicio', 'mes', 'org_id', 'funcao', 'subfuncao', 'programa', 'acao', 'categoria', 'grupo', 'modalidade', 'uf_loc'], values: ['emp', 'liq', 'pago', 'rp_insc', 'rp_canc', 'rp_pago'], scopeSql: FIN_SCOPE_STATE + 'TRUE' } satisfies SnapshotSpec,
  /** P10.1: identidade (nunca apaga), registro por escola × edição (escopo = edição × municípios da UF) e cobertura por edição × UF. */
  edu_school: { kind: 'upsert', name: 'exec_edu_school', tableId: 80, pk: ['inep'], values: [] } satisfies UpsertSpec,
  edu_school_year: { kind: 'snapshot', name: 'exec_edu_school_year', tableId: 81, pk: ['inep', 'year'], values: ['entity_id', 'name', 'dep', 'loc', 'sit', 'flags'], scopeSql: 'year = ($2::integer / 100)::smallint AND ' + UF_OF_ENTITY } satisfies SnapshotSpec,
  edu_cov: { kind: 'snapshot', name: 'exec_edu_cov', tableId: 82, pk: ['year', 'uf'], values: ['layout', 'rows_in', 'valid', 'rejected', 'active', 'with_mat', 'univ', 'muns'], scopeSql: 'year = ($2::integer / 100)::smallint AND uf = $1::smallint' } satisfies SnapshotSpec,
  /** P10.2: oferta por escola × edição, soma por (edição, UF, dependência, localização) e cobertura. Escopo da oferta = escolas do cadastro daquela UF na edição (coluna `inep` do cadastro P10.1). */
  edu_offer_year: { kind: 'snapshot', name: 'exec_edu_offer_year', tableId: 83, pk: ['inep', 'year'], values: EDU_OFFER_COLS, scopeSql: 'year = ($2::integer / 100)::smallint AND inep IN (SELECT y.inep FROM civica_exec.exec_edu_school_year y WHERE y.year = ($2::integer / 100)::smallint AND y.entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE uf_code = $1::smallint))' } satisfies SnapshotSpec,
  edu_offer_agg: { kind: 'snapshot', name: 'exec_edu_offer_agg', tableId: 84, pk: ['year', 'uf', 'dep', 'loc'], values: ['schools', ...EDU_OFFER_COLS], scopeSql: 'year = ($2::integer / 100)::smallint AND uf = $1::smallint' } satisfies SnapshotSpec,
  edu_offer_cov: { kind: 'snapshot', name: 'exec_edu_offer_cov', tableId: 85, pk: ['year', 'uf'], values: ['layout', 'rows_in', 'valid', 'rejected', 'with_mat', 'with_tur', 'only_tur'], scopeSql: 'year = ($2::integer / 100)::smallint AND uf = $1::smallint' } satisfies SnapshotSpec,
  edu_infra_year: { kind: 'snapshot', name: 'exec_edu_infra_year', tableId: 86, pk: ['inep', 'year'], values: EDU_INFRA_COLS, scopeSql: 'year = ($2::integer / 100)::smallint AND inep IN (SELECT y.inep FROM civica_exec.exec_edu_school_year y WHERE y.year = ($2::integer / 100)::smallint AND y.entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE uf_code = $1::smallint))' } satisfies SnapshotSpec,
  edu_infra_agg: { kind: 'snapshot', name: 'exec_edu_infra_agg', tableId: 87, pk: ['year', 'uf', 'dep', 'loc'], values: ['schools', ...EDU_INFRA_AGG_COLS], scopeSql: 'year = ($2::integer / 100)::smallint AND uf = $1::smallint' } satisfies SnapshotSpec,
  edu_infra_cov: { kind: 'snapshot', name: 'exec_edu_infra_cov', tableId: 88, pk: ['year', 'uf'], values: ['layout', 'rows_in', 'active', 'valid', 'rejected', 'answered', 'unanswered', 'with_mat', 'extreme', 'coded_unknown'], scopeSql: 'year = ($2::integer / 100)::smallint AND uf = $1::smallint' } satisfies SnapshotSpec,
  edu_ind_school: { kind: 'snapshot', name: 'exec_edu_ind_school', tableId: 89, pk: ['inep', 'year'], values: IND_SCHOOL_COLS, scopeSql: 'year = ($2::integer / 100)::smallint AND inep IN (SELECT y.inep FROM civica_exec.exec_edu_school_year y WHERE y.year = ($2::integer / 100)::smallint AND y.entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE uf_code = $1::smallint))' } satisfies SnapshotSpec,
  edu_ind_terr: { kind: 'snapshot', name: 'exec_edu_ind_terr', tableId: 90, pk: ['year', 'entity_id', 'dep', 'loc'], values: IND_TERR_COLS, scopeSql: "year = ($2::integer / 100)::smallint AND (($1::smallint = 0 AND entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE kind IN (1, 2))) OR ($1::smallint > 0 AND entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE uf_code = $1::smallint AND kind IN (3, 4, 5))))" } satisfies SnapshotSpec,
  edu_ind_cov: { kind: 'snapshot', name: 'exec_edu_ind_cov', tableId: 91, pk: ['year', 'uf', 'family', 'lvl'], values: ['rows_in', 'valid', 'rejected', 'no_value', 'cells_num', 'cells_dash'], scopeSql: 'year = ($2::integer / 100)::smallint AND uf = $1::smallint' } satisfies SnapshotSpec,
  edu_doc_terr: { kind: 'snapshot', name: 'exec_edu_doc_terr', tableId: 92, pk: ['year', 'entity_id'], values: DOC_COLS, scopeSql: "year = ($2::integer / 100)::smallint AND (($1::smallint = 0 AND entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE kind = 1)) OR ($1::smallint > 0 AND entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE uf_code = $1::smallint AND kind IN (3, 4))))" } satisfies SnapshotSpec,
  edu_ideb_school: { kind: 'snapshot', name: 'exec_edu_ideb_school', tableId: 93, pk: ['inep', 'year', 'stage'], values: ['uf', 'dep', ...IDEB_MEASURES], scopeSql: 'year = ($2::integer / 100)::smallint AND uf = $1::smallint' } satisfies SnapshotSpec,
  edu_ideb_terr: { kind: 'snapshot', name: 'exec_edu_ideb_terr', tableId: 94, pk: ['year', 'entity_id', 'stage', 'dep'], values: [...IDEB_MEASURES], scopeSql: "year = ($2::integer / 100)::smallint AND (($1::smallint = 0 AND entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE kind IN (1, 2))) OR ($1::smallint > 0 AND entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE uf_code = $1::smallint AND kind IN (3, 4, 5))))" } satisfies SnapshotSpec,
  edu_ideb_cov: { kind: 'snapshot', name: 'exec_edu_ideb_cov', tableId: 95, pk: ['year', 'uf', 'family', 'lvl'], values: ['rows_in', 'valid', 'rejected', 'no_identity', 'cells_num', 'cells_supp'], scopeSql: 'year = ($2::integer / 100)::smallint AND uf = $1::smallint' } satisfies SnapshotSpec,
  edu_saeb_terr: { kind: 'snapshot', name: 'exec_edu_saeb_terr', tableId: 96, pk: ['year', 'entity_id', 'dep', 'loc', 'cap', 'grade', 'subj'], values: ['media', 'tx_alf', ...SAEB_LEVEL_COLS], scopeSql: "year = ($2::integer / 100)::smallint AND (($1::smallint = 0 AND entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE kind IN (1, 2))) OR ($1::smallint > 0 AND entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE uf_code = $1::smallint AND kind IN (3, 4, 5))))" } satisfies SnapshotSpec,
  edu_saeb_cov: { kind: 'snapshot', name: 'exec_edu_saeb_cov', tableId: 97, pk: ['year', 'uf', 'family', 'lvl'], values: ['rows_in', 'valid', 'rejected', 'no_identity', 'cells_num', 'cells_supp'], scopeSql: 'year = ($2::integer / 100)::smallint AND uf = $1::smallint' } satisfies SnapshotSpec,
  edu_flow_school: { kind: 'snapshot', name: 'exec_edu_flow_school', tableId: 98, pk: ['inep', 'year'], values: ['uf', 'dep', 'loc', ...FLOW_COLS], scopeSql: 'year = ($2::integer / 100)::smallint AND uf = $1::smallint' } satisfies SnapshotSpec,
  edu_flow_terr: { kind: 'snapshot', name: 'exec_edu_flow_terr', tableId: 99, pk: ['year', 'entity_id', 'loc', 'dep'], values: [...FLOW_COLS], scopeSql: "year = ($2::integer / 100)::smallint AND (($1::smallint = 0 AND entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE kind IN (1, 2))) OR ($1::smallint > 0 AND entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE uf_code = $1::smallint AND kind IN (3, 4, 5))))" } satisfies SnapshotSpec,
  edu_flow_cov: { kind: 'snapshot', name: 'exec_edu_flow_cov', tableId: 100, pk: ['year', 'uf', 'family', 'lvl'], values: ['rows_in', 'valid', 'rejected', 'no_identity', 'cells_num', 'cells_supp'], scopeSql: 'year = ($2::integer / 100)::smallint AND uf = $1::smallint' } satisfies SnapshotSpec,
  edu_trn_terr: { kind: 'snapshot', name: 'exec_edu_trn_terr', tableId: 101, pk: ['year', 'entity_id', 'loc', 'dep'], values: [...TRN_COLS], scopeSql: "year = ($2::integer / 100)::smallint AND (($1::smallint = 0 AND entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE kind IN (1, 2))) OR ($1::smallint > 0 AND entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE uf_code = $1::smallint AND kind IN (3, 4, 5))))" } satisfies SnapshotSpec,
  edu_trn_cov: { kind: 'snapshot', name: 'exec_edu_trn_cov', tableId: 102, pk: ['year', 'uf', 'family', 'lvl'], values: ['rows_in', 'valid', 'rejected', 'no_identity', 'cells_num', 'cells_supp'], scopeSql: 'year = ($2::integer / 100)::smallint AND uf = $1::smallint' } satisfies SnapshotSpec,
  edu_inse_school: { kind: 'snapshot', name: 'exec_edu_inse_school', tableId: 103, pk: ['inep', 'year'], values: ['uf', 'dep', 'loc', 'qtd', 'media', 'cls', ...INSE_LEVEL_COLS], scopeSql: 'year = ($2::integer / 100)::smallint AND uf = $1::smallint' } satisfies SnapshotSpec,
  edu_inse_terr: { kind: 'snapshot', name: 'exec_edu_inse_terr', tableId: 104, pk: ['year', 'entity_id', 'dep', 'loc', 'cap'], values: ['qtd', 'media', ...INSE_LEVEL_COLS], scopeSql: "year = ($2::integer / 100)::smallint AND (($1::smallint = 0 AND entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE kind IN (1, 2))) OR ($1::smallint > 0 AND entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE uf_code = $1::smallint AND kind IN (3, 4, 5))))" } satisfies SnapshotSpec,
  edu_inse_cov: { kind: 'snapshot', name: 'exec_edu_inse_cov', tableId: 105, pk: ['year', 'uf', 'family', 'lvl'], values: ['rows_in', 'valid', 'rejected', 'no_identity', 'cells_num', 'cells_supp'], scopeSql: 'year = ($2::integer / 100)::smallint AND uf = $1::smallint' } satisfies SnapshotSpec,
} as const;

/** P9.6: cobertura (exec_seg_cov) por fonte estadual, escopo = UF × ano × FAIXA de indicadores da fonte (não apaga a cobertura do VDE/P9.1 nem de outras fontes). tableId = 50 + slot. */
export const CRIME_SLOTS = 20;
export const CRIME_COV_SPECS: SnapshotSpec[] = Array.from({ length: CRIME_SLOTS }, (_, slot) => ({
  kind: 'snapshot', name: 'exec_seg_cov', tableId: 50 + slot, pk: ['uf', 'indicator_id', 'competence'], values: ['mun_pairs', 'src_lines', 'dup_lines', 'nz_rows', 'uf_total', 'unassigned', 'status'],
  scopeSql: `uf = $1::smallint AND indicator_id BETWEEN ${8001 + slot * 100} AND ${8099 + slot * 100} AND competence BETWEEN ($2::integer / 100) * 100 + 1 AND ($2::integer / 100) * 100 + 12`,
} satisfies SnapshotSpec));
export const SPEC_BY_ID = new Map<number, TableSpec>([...Object.values(SPECS), ...CRIME_COV_SPECS].map(s => [s.tableId, s as TableSpec]));
export const IND_VALUE_TABLE_ID = 7;
