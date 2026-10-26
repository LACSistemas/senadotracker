import type { Pool } from 'pg';
import { DOMAIN } from './indicator-defs.ts';

/** Versões do contrato financeiro (entram no hash de cada fatia: mudar um parser/contrato republica). */
export const FIN_VERSION = { dca: 'dca-ie-v1', dcaRp: 'dca-ig-v1', rreo: 'rreo02-v1', publish: 'fin-v1', fed: 'fed-v1', fedDot: 'fed-dot-v1', rs: 'tcers-v1', pe: 'tcepe-v1' } as const;

/** Fontes de cobertura (exec_fin_cov.source). */
export const FIN_SOURCE = { dcaIE: 1, rreo02: 2, dcaIG: 3, fedExec: 4, fedDot: 5 } as const;
/** Estados de cobertura (exec_fin_cov.status). */
export const COV = { PUBLISHED: 1, PUBLISHED_WITH_CAVEATS: 2, NOT_REPORTED: 3, NO_SOURCE_DATA: 4, SOURCE_UNAVAILABLE: 5, METHODOLOGY_PENDING: 6, RECONCILIATION_FAILED: 7, DECLARED_WITHOUT_FUNCTION: 8 } as const;
export const COV_NAME: Record<number, string> = { 1: 'PUBLISHED', 2: 'PUBLISHED_WITH_CAVEATS', 3: 'NOT_REPORTED', 4: 'NO_SOURCE_DATA', 5: 'SOURCE_UNAVAILABLE', 6: 'METHODOLOGY_PENDING', 7: 'RECONCILIATION_FAILED', 8: 'DECLARED_WITHOUT_FUNCTION' };
/** Bits de exec_fin_cov.caveats. */
export const COV_CAVEAT = { sumFunctionsNeTotal: 1, sumSubfunctionsNeFunction: 2, divergentDuplicates: 4, unknownLabelInFn06: 8 } as const;

/** Domínios de exec_ref_code usados pela camada financeira (0, 3 e 4 já pertencem ao CNES/DEMAS). */
export const FIN_DOMAIN = { conta: 30, colDcaIE: 31, colRreo02: 32, colDcaIG: 33 } as const;

/** Funções orçamentárias (Portaria MOG 42/1999; a função 06 é a Segurança Pública). */
export const FUNCTIONS: Array<[string, string]> = [['01', 'Legislativa'], ['02', 'Judiciária'], ['03', 'Essencial à Justiça'], ['04', 'Administração'], ['05', 'Defesa Nacional'], ['06', 'Segurança Pública'], ['07', 'Relações Exteriores'], ['08', 'Assistência Social'],
  ['09', 'Previdência Social'], ['10', 'Saúde'], ['11', 'Trabalho'], ['12', 'Educação'], ['13', 'Cultura'], ['14', 'Direitos da Cidadania'], ['15', 'Urbanismo'], ['16', 'Habitação'], ['17', 'Saneamento'], ['18', 'Gestão Ambiental'], ['19', 'Ciência e Tecnologia'],
  ['20', 'Agricultura'], ['21', 'Organização Agrária'], ['22', 'Indústria'], ['23', 'Comércio e Serviços'], ['24', 'Comunicações'], ['25', 'Energia'], ['26', 'Transporte'], ['27', 'Desporto e Lazer'], ['28', 'Encargos Especiais'], ['99', 'Reserva de Contingência']];
export const FUNCTION_BY_NAME = new Map(FUNCTIONS.map(([c, n]) => [n, c]));
export const SEC = '06';
/** Subfunções próprias da Segurança Pública (Portaria 42/1999); 122 (Administração Geral) é subfunção comum a todas as funções e concentra a folha e o custeio. */
export const SEC_SUBFUNCTIONS: Array<[string, string]> = [['06.122', 'Administração Geral'], ['06.181', 'Policiamento'], ['06.182', 'Defesa Civil'], ['06.183', 'Informação e Inteligência']];
export const SEC_SUB_BY_NAME = new Map<string, string>([['Policiamento', '06.181'], ['Defesa Civil', '06.182'], ['Informação e Inteligência', '06.183'], ['FU06 - Administração Geral', '06.122'], ['FU06 - Demais Subfunções', 'FU06']]);

/** Colunas (estágios) por demonstrativo. `bit` = bit em exec_fin_cov.stages (só estágios que a função 06 pode ter). */
export interface FinColumn { code: string; label: string; semantic: string; bit: number }
export const DCA_IE_COLUMNS: FinColumn[] = [
  { code: 'EMP', label: 'Despesas empenhadas', semantic: 'estágio: empenho do exercício (fluxo anual, exceto intra-orçamentárias)', bit: 1 },
  { code: 'LIQ', label: 'Despesas liquidadas', semantic: 'estágio: liquidação do exercício', bit: 2 },
  { code: 'PAG', label: 'Despesas pagas', semantic: 'estágio: pagamento do exercício (de empenhos do exercício; não inclui restos a pagar pagos)', bit: 4 },
  { code: 'RPNP_INSC', label: 'Inscrição de restos a pagar não processados', semantic: 'saldo inscrito ao fim do exercício (não é pagamento; não somar às despesas pagas)', bit: 8 },
  { code: 'RPP_INSC', label: 'Inscrição de restos a pagar processados', semantic: 'saldo inscrito ao fim do exercício (não é pagamento; não somar às despesas pagas)', bit: 16 },
];
export const DCA_IG_COLUMNS: FinColumn[] = [
  { code: 'RPNP_IEA', label: 'RP não processados inscritos em exercícios anteriores', semantic: 'saldo de RP não processados inscritos antes do exercício anterior', bit: 1 },
  { code: 'RPNP_I31', label: 'RP não processados inscritos em 31/12 do exercício anterior', semantic: 'saldo inscrito ao fim do exercício anterior', bit: 2 },
  { code: 'RPNP_LIQ', label: 'RP não processados liquidados', semantic: 'estágio no exercício: liquidação de restos a pagar não processados', bit: 4 },
  { code: 'RPNP_PAG', label: 'RP não processados pagos', semantic: 'estágio no exercício: pagamento de restos a pagar não processados (NÃO são despesas pagas do exercício)', bit: 8 },
  { code: 'RPNP_CANC', label: 'RP não processados cancelados', semantic: 'cancelamento no exercício', bit: 16 },
  { code: 'RPP_IEA', label: 'RP processados inscritos em exercícios anteriores', semantic: 'saldo de RP processados inscritos antes do exercício anterior', bit: 32 },
  { code: 'RPP_I31', label: 'RP processados inscritos em 31/12 do exercício anterior', semantic: 'saldo inscrito ao fim do exercício anterior', bit: 64 },
  { code: 'RPP_PAG', label: 'RP processados pagos', semantic: 'pagamento de restos a pagar processados no exercício (NÃO são despesas pagas do exercício)', bit: 128 },
  { code: 'RPP_CANC', label: 'RP processados cancelados', semantic: 'cancelamento no exercício', bit: 256 },
];
export function dcaIgColumn(coluna: string): string | null {
  const n = normLabel(coluna); if (!/^RESTOS A PAGAR/.test(n)) return null;
  const np = /N.{1,3}O PROCESSADOS/.test(n) || /NAO PROCESSADOS/.test(n); const k = np ? 'RPNP' : 'RPP';
  if (/INSCRITOS EM EXERC.{1,3}CIOS ANTERIORES/.test(n)) return `${k}_IEA`; if (/INSCRITOS EM 31 DE DEZEMBRO/.test(n)) return `${k}_I31`;
  if (/LIQUIDADOS$/.test(n) && np) return 'RPNP_LIQ'; if (/PAGOS$/.test(n)) return `${k}_PAG`; if (/CANCELADOS$/.test(n)) return `${k}_CANC`; return null;
}
export const RREO_COLUMNS: FinColumn[] = [
  { code: 'DOT_INI', label: 'Dotação inicial', semantic: 'planejamento: LOA', bit: 1 },
  { code: 'DOT_ATU', label: 'Dotação atualizada', semantic: 'planejamento: LOA + créditos adicionais, na data do bimestre', bit: 2 },
  { code: 'EMP_ATE', label: 'Despesas empenhadas até o bimestre', semantic: 'ACUMULADO do exercício até o bimestre do snapshot (não somar bimestres)', bit: 4 },
  { code: 'LIQ_ATE', label: 'Despesas liquidadas até o bimestre', semantic: 'ACUMULADO do exercício até o bimestre do snapshot', bit: 8 },
  { code: 'EMP_NO', label: 'Despesas empenhadas no bimestre', semantic: 'FLUXO do bimestre do snapshot', bit: 16 },
  { code: 'LIQ_NO', label: 'Despesas liquidadas no bimestre', semantic: 'FLUXO do bimestre do snapshot', bit: 32 },
];

/** Normaliza rótulo de coluna do Siconfi (sem acento, maiúsculas) para casar variações entre exercícios. */
export const normLabel = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 %()/=+.-]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
export function dcaIeColumn(coluna: string): string | null {
  const n = normLabel(coluna);
  if (/^DESPESAS EMPENHADAS/.test(n)) return 'EMP'; if (/^DESPESAS LIQUIDADAS/.test(n)) return 'LIQ'; if (/^DESPESAS PAGAS/.test(n)) return 'PAG';
  if (/^INSCRI.*RESTOS A PAGAR N.{1,3}O PROCESSADOS/.test(n) || /^INSCRICAO DE RESTOS A PAGAR NAO PROCESSADOS/.test(n)) return 'RPNP_INSC';
  if (/^INSCRI.*RESTOS A PAGAR PROCESSADOS/.test(n)) return 'RPP_INSC';
  return null;
}
export function rreoColumn(coluna: string): string | null {
  const n = normLabel(coluna);
  if (/^DOTACAO INICIAL/.test(n)) return 'DOT_INI'; if (/^DOTACAO ATUALIZADA/.test(n)) return 'DOT_ATU';
  if (/^DESPESAS EMPENHADAS ATE O BIMESTRE/.test(n)) return 'EMP_ATE'; if (/^DESPESAS LIQUIDADAS ATE O BIMESTRE/.test(n)) return 'LIQ_ATE';
  if (/^DESPESAS EMPENHADAS NO BIMESTRE/.test(n)) return 'EMP_NO'; if (/^DESPESAS LIQUIDADAS NO BIMESTRE/.test(n)) return 'LIQ_NO';
  return null;
}

export interface FinDef { id: number; code: string; label: string; unit: string; sort: number; numerator: string; denominator: string; source: 'DCA' | 'EDU_DCA' | 'DCA_RP' | 'RREO' | 'PNCP' | 'TRANSFER'; stage: string; note: string; minDenominator?: number }
const NOTE_SCOPE = 'Despesa classificada na FUNÇÃO orçamentária 06 (Segurança Pública) pelo próprio ente: perspectiva funcional, NÃO é o gasto das corporações policiais (um órgão de segurança também executa Previdência e Administração, e a função 06 pode ser executada por órgão que não é secretaria de segurança). Exclui as despesas intra-orçamentárias. Estado e municípios NÃO se somam (há transferências entre esferas); município não recebe gasto estadual.';
const NOTE_DCA = `${NOTE_SCOPE} Fonte: DCA (Siconfi), Anexo I-E, declaração anual do ente; valor exato em centavos em exec_fin_fact. Ente que não declarou a DCA do ano NÃO tem linha (nunca zero); ver exec_fin_cov.`;
const NOTE_RREO = `${NOTE_SCOPE} Fonte: RREO (Siconfi), Anexo 02, snapshot do último bimestre publicado no exercício; valores ACUMULADOS até o bimestre (não são somáveis entre bimestres). Só publicam o RREO completo estados, DF, União e municípios com 50 mil habitantes ou mais (os demais publicam o simplificado, sem função): ausência não é zero. Exercício com bimestre < 6 é preliminar.`;
const dca = (id: number, key: string, label: string, stage: string, num: string, sort: number, extra = ''): FinDef => ({ id, code: `IND-FIN-DCA-${key}`, label, unit: 'R$', sort, numerator: num, denominator: 'não se aplica (valor monetário)', source: 'DCA', stage, note: `${NOTE_DCA} ${extra}`.trim() });
const SUB = (c: string) => `exec_fin_fact: DCA I-E, subfunção ${c} da função 06`;
export const FIN_DEFS: FinDef[] = [
  dca(7001, 'SEG-EMP', 'Despesa empenhada na função Segurança Pública', 'empenhada', 'DCA I-E, função 06, Despesas Empenhadas', 7001),
  dca(7002, 'SEG-LIQ', 'Despesa liquidada na função Segurança Pública', 'liquidada', 'DCA I-E, função 06, Despesas Liquidadas', 7002),
  dca(7003, 'SEG-PAG', 'Despesa paga na função Segurança Pública', 'paga', 'DCA I-E, função 06, Despesas Pagas', 7003, 'Pagamentos de restos a pagar de exercícios anteriores NÃO estão incluídos.'),
  dca(7004, 'SEG-RPNP', 'Restos a pagar não processados inscritos na função Segurança Pública', 'restos a pagar inscritos', 'DCA I-E, função 06, Inscrição de RP não processados', 7004, 'Saldo inscrito, não é pagamento.'),
  dca(7005, 'SEG-RPP', 'Restos a pagar processados inscritos na função Segurança Pública', 'restos a pagar inscritos', 'DCA I-E, função 06, Inscrição de RP processados', 7005, 'Saldo inscrito, não é pagamento.'),
  dca(7006, 'TOT-EMP', 'Despesa total empenhada do ente (exceto intra-orçamentárias)', 'empenhada', 'DCA I-E, Despesas Exceto Intraorçamentárias, empenhadas (= Σ das 28 funções)', 7006, 'Denominador das participações; não é "gasto em segurança".'),
  dca(7007, 'TOT-PAG', 'Despesa total paga do ente (exceto intra-orçamentárias)', 'paga', 'DCA I-E, Despesas Exceto Intraorçamentárias, pagas', 7007),
  ...([['122', 'Administração Geral'], ['181', 'Policiamento'], ['182', 'Defesa Civil'], ['183', 'Informação e Inteligência'], ['OUT', 'demais subfunções']] as const).flatMap(([c, nm], i) => {
    const sub = c === 'OUT' ? 'demais subfunções da função 06 (06.xxx não listadas e "Demais Subfunções")' : `subfunção 06.${c} (${nm})`;
    const extra = c === '122' ? 'A subfunção 122 (Administração Geral) concentra, na prática, a folha e o custeio das corporações em muitos entes: "Policiamento" isolado NÃO é o gasto das polícias.' : '';
    return [dca(7011 + i * 2, `SUB-${c}-EMP`, `Despesa empenhada em Segurança Pública: ${nm}`, 'empenhada', `${c === 'OUT' ? 'Σ ' : ''}${SUB(c === 'OUT' ? 'OUT' : '06.' + c)} — ${sub}, empenhadas`, 7011 + i * 2, extra),
      dca(7012 + i * 2, `SUB-${c}-PAG`, `Despesa paga em Segurança Pública: ${nm}`, 'paga', `${SUB(c === 'OUT' ? 'OUT' : '06.' + c)} — ${sub}, pagas`, 7012 + i * 2, extra)];
  }),
  { id: 7031, code: 'IND-FIN-DCA-SEG-SHARE-EMP', label: 'Participação da função Segurança Pública na despesa total empenhada', unit: '% da despesa empenhada', sort: 7031, numerator: 'empenhada função 06 (7001)', denominator: 'despesa total empenhada exceto intra (7006)', source: 'DCA', stage: 'empenhada', note: `${NOTE_DCA} Razão entre duas medidas do MESMO ente, estágio e declaração.`, minDenominator: 1 },
  { id: 7032, code: 'IND-FIN-DCA-SEG-PAG-PC', label: 'Despesa paga na função Segurança Pública por habitante', unit: 'R$/hab.', sort: 7032, numerator: 'paga função 06 (7003)', denominator: 'população residente estimada (IBGE, exec_territory_population) do mesmo ano', source: 'DCA', stage: 'paga', note: `${NOTE_DCA} Sem população do ano na fundação territorial (2022 e 2023 não têm estimativa) a linha não é calculada. Per capita estadual usa a população do estado e NÃO deve ser comparada a per capita municipal (gastos de esferas diferentes).` },
  { id: 7033, code: 'IND-FIN-DCA-SEG-EMP-PC', label: 'Despesa empenhada na função Segurança Pública por habitante', unit: 'R$/hab.', sort: 7033, numerator: 'empenhada função 06 (7001)', denominator: 'população residente estimada (IBGE) do mesmo ano', source: 'DCA', stage: 'empenhada', note: `${NOTE_DCA} Ver 7032.` },
  { id: 7034, code: 'IND-FIN-DCA-SEG-PAYRATE', label: 'Taxa de pagamento da função Segurança Pública', unit: '% do empenhado', sort: 7034, numerator: 'paga função 06 (7003)', denominator: 'empenhada função 06 (7001)', source: 'DCA', stage: 'paga/empenhada', note: `${NOTE_DCA} Fração do empenhado do ano que foi paga no próprio ano; o restante vira restos a pagar (ou é cancelado).`, minDenominator: 1 },
  ...([[7041, 'SEG-DOTINI', 'Dotação inicial da função Segurança Pública', 'dotação inicial', 'RREO Anexo 02, função 06, DOTAÇÃO INICIAL'], [7042, 'SEG-DOTATU', 'Dotação atualizada da função Segurança Pública', 'dotação atualizada', 'RREO Anexo 02, função 06, DOTAÇÃO ATUALIZADA'],
    [7043, 'SEG-EMPATE', 'Despesa empenhada até o bimestre na função Segurança Pública', 'empenhada (acumulada)', 'RREO Anexo 02, função 06, DESPESAS EMPENHADAS ATÉ O BIMESTRE'], [7044, 'SEG-LIQATE', 'Despesa liquidada até o bimestre na função Segurança Pública', 'liquidada (acumulada)', 'RREO Anexo 02, função 06, DESPESAS LIQUIDADAS ATÉ O BIMESTRE']] as const)
    .map(([id, key, label, stage, num]): FinDef => ({ id, code: `IND-FIN-RREO-${key}`, label, unit: 'R$', sort: id, numerator: num, denominator: 'não se aplica (valor monetário)', source: 'RREO', stage, note: NOTE_RREO })),
  { id: 7045, code: 'IND-FIN-RREO-SEG-EXEC-EMP', label: 'Execução da dotação atualizada: empenhado na função Segurança Pública', unit: '% da dotação atualizada', sort: 7045, numerator: 'empenhada até o bimestre (7043)', denominator: 'dotação atualizada (7042)', source: 'RREO', stage: 'empenhada/dotação', note: NOTE_RREO, minDenominator: 1 },
  { id: 7046, code: 'IND-FIN-RREO-SEG-EXEC-LIQ', label: 'Execução da dotação atualizada: liquidado na função Segurança Pública', unit: '% da dotação atualizada', sort: 7046, numerator: 'liquidada até o bimestre (7044)', denominator: 'dotação atualizada (7042)', source: 'RREO', stage: 'liquidada/dotação', note: NOTE_RREO, minDenominator: 1 },
];

export const FIN_DCA_IDS: number[] = FIN_DEFS.filter(d => d.source === 'DCA').map(d => d.id);
export const FIN_RREO_IDS: number[] = FIN_DEFS.filter(d => d.source === 'RREO').map(d => d.id);

const EDU_NOTE = 'Função orçamentária 12 (Educação), fonte DCA Anexo I-E do Siconfi. Mede a despesa funcional declarada pelo ente, não MDE do SIOPE, Fundeb, receita ou transferência. Empenhado, liquidado e pago são estágios distintos; ausência de linha não é zero.';
const eduDca = (id: number, code: string, label: string, stage: string, num: string, extra = ''): FinDef => ({ id, code: `IND-FIN-DCA-EDU-${code}`, label, unit: 'R$', sort: id, numerator: num, denominator: 'não se aplica (valor monetário)', source: 'EDU_DCA', stage, note: `${EDU_NOTE} ${extra}`.trim() });
export const FIN_EDU_DEFS: FinDef[] = [
  eduDca(7101, 'EDU-EMP', 'Despesa empenhada na função Educação', 'empenhada', 'DCA I-E, função 12, Despesas Empenhadas'),
  eduDca(7102, 'EDU-LIQ', 'Despesa liquidada na função Educação', 'liquidada', 'DCA I-E, função 12, Despesas Liquidadas'),
  eduDca(7103, 'EDU-PAG', 'Despesa paga na função Educação', 'paga', 'DCA I-E, função 12, Despesas Pagas'),
  eduDca(7104, 'EDU-RPNP', 'Restos a pagar não processados inscritos na função Educação', 'restos a pagar inscritos', 'DCA I-E, função 12, Inscrição de RP não processados'),
  eduDca(7105, 'EDU-RPP', 'Restos a pagar processados inscritos na função Educação', 'restos a pagar inscritos', 'DCA I-E, função 12, Inscrição de RP processados'),
  eduDca(7106, 'EDU-TOT-EMP', 'Despesa total empenhada do ente (exceto intra-orçamentárias)', 'empenhada', 'DCA I-E, total exceto intra, Despesas Empenhadas'),
  eduDca(7107, 'EDU-TOT-PAG', 'Despesa total paga do ente (exceto intra-orçamentárias)', 'paga', 'DCA I-E, total exceto intra, Despesas Pagas'),
  eduDca(7108, 'EDU-SHARE-EMP', 'Participação da função Educação na despesa total empenhada', 'participação', 'função 12 / total exceto intra', 'Percentual calculado somente quando ambos os estágios são publicados.'),
  eduDca(7109, 'EDU-PAYRATE', 'Taxa de pagamento da função Educação', 'paga/empenhada', 'pago / empenhado da função 12', 'Não é execução de MDE nem taxa de pagamento de Fundeb.'),
  eduDca(7110, 'EDU-EMP-PC', 'Despesa empenhada em Educação por habitante', 'empenhada', 'função 12 empenhada / população IBGE', 'Sem população válida a linha fica ausente.'),
  eduDca(7111, 'EDU-PAG-PC', 'Despesa paga em Educação por habitante', 'paga', 'função 12 paga / população IBGE', 'Sem população válida a linha fica ausente.'),
  ...([['122', 'Administração Geral'], ['361', 'Ensino Fundamental'], ['362', 'Ensino Médio'], ['363', 'Ensino Profissional'], ['364', 'Ensino Superior'], ['365', 'Educação Infantil'], ['366', 'Educação de Jovens e Adultos'], ['367', 'Educação Especial'], ['368', 'Educação Básica']] as const).flatMap(([c, nm], i) => [
    eduDca(7120 + i * 2, `SUB-${c}-EMP`, `Despesa empenhada em Educação: ${nm}`, 'empenhada', `DCA I-E, subfunção 12.${c}, empenhadas`),
    eduDca(7121 + i * 2, `SUB-${c}-PAG`, `Despesa paga em Educação: ${nm}`, 'paga', `DCA I-E, subfunção 12.${c}, pagas`),
  ]),
];
export const FIN_EDU_DCA_IDS: number[] = FIN_EDU_DEFS.map(d => d.id);

export const FIN_DCARP_DEFS: FinDef[] = [
  { id: 7021, code: 'IND-FIN-DCA-SEG-RP-PAGOS', label: 'Restos a pagar pagos na função Segurança Pública', unit: 'R$', sort: 7021, numerator: 'DCA I-G, função 06: RP não processados pagos + RP processados pagos', denominator: 'não se aplica (valor monetário)', source: 'DCA_RP', stage: 'restos a pagar pagos',
    note: 'Pagamento, no exercício, de restos a pagar inscritos em exercícios anteriores, na função 06. NÃO é despesa paga do exercício (7003) e não se soma a ela: o universo é outro (empenhos de anos anteriores). Fonte: DCA Anexo I-G. Só União, UFs e municípios com 100 mil habitantes ou mais foram coletados: ausência não é zero.' },
  { id: 7022, code: 'IND-FIN-DCA-SEG-RP-CANCELADOS', label: 'Restos a pagar cancelados na função Segurança Pública', unit: 'R$', sort: 7022, numerator: 'DCA I-G, função 06: RP não processados cancelados + RP processados cancelados', denominator: 'não se aplica (valor monetário)', source: 'DCA_RP', stage: 'restos a pagar cancelados',
    note: 'Cancelamento, no exercício, de restos a pagar da função 06 (empenho que não virou pagamento). Fonte: DCA Anexo I-G. Mesmo universo e ressalvas de 7021.' },
];
export const FIN_DCARP_IDS: number[] = FIN_DCARP_DEFS.map(d => d.id);
const NOTE_PNCP = 'Contratos publicados no PNCP (consulta de contratos, ano de PUBLICAÇÃO) classificados em segurança. O vínculo é INSTITUCIONAL (o órgão contratante é uma instituição de segurança, identificada por NOME: confiança alta, não exata) ou TEMÁTICO DERIVADO (o objeto sugere tema de segurança por palavras-chave); o PNCP não traz função orçamentária e NENHUM contrato aqui é "despesa oficial da função 06". Valor CONTRATADO não é empenhado nem pago e não se soma a nenhum outro estágio. Cobertura do PNCP varia por ente: sem linha = nenhum contrato classificado, não "nenhum contrato". Vigilância/segurança patrimonial fica de fora. Fornecedor pessoa física nunca é persistido. Valores globais acima de R$ 10 bilhões num único contrato (erro de digitação na origem) ficam fora das somas de valor.';
const pncp = (id: number, key: string, label: string, unit: string, num: string, extra = ''): FinDef => ({ id, code: `IND-FIN-PNCP-${key}`, label, unit, sort: id, numerator: num, denominator: 'não se aplica (contagem ou valor monetário)', source: 'PNCP', stage: 'contratada', note: `${NOTE_PNCP} ${extra}`.trim() });
export const PNCP_DEFS: FinDef[] = [
  pncp(7061, 'ORG-N', 'Contratos de órgãos de segurança', 'contratos', 'exec_fin_contract: contratos com órgão contratante identificado como de segurança (link 1 ou 3)'),
  pncp(7062, 'ORG-VAL', 'Valor global contratado por órgãos de segurança', 'R$', 'Σ valor global dos contratos de órgãos de segurança', 'Valor global do contrato (vigência inteira), não o gasto do exercício.'),
  pncp(7063, 'ORG-FORN', 'Fornecedores (pessoa jurídica) de órgãos de segurança', 'fornecedores', 'CNPJ distintos nos contratos de órgãos de segurança'),
  pncp(7064, 'TEMA-N', 'Contratos com tema de segurança derivado do objeto', 'contratos', 'contratos com tema derivado (link 2 ou 3), de qualquer órgão', 'Classificação por palavras-chave: pode conter falsos positivos e não enxerga objetos genéricos.'),
  pncp(7065, 'TEMA-VAL', 'Valor global contratado em contratos de tema de segurança derivado', 'R$', 'Σ valor global dos contratos com tema derivado', 'Ver 7064.'),
  pncp(7066, 'ORG-EMPENHO', 'Contratos de órgãos de segurança do tipo Empenho (com referência de empenho)', 'contratos', 'contratos de órgãos de segurança com tipoContrato = Empenho e numeroContratoEmpenho', 'A referência é a numeração do próprio empenho; não prova liquidação nem pagamento.'),
];
const NOTE_TRANSFER = 'Instrumentos (convênios e contratos de repasse) da Plataforma +Brasil/Transferegov cujo CONCEDENTE é o Ministério da Justiça e Segurança Pública (inclui FUNPEN, FNSP, FUNAD), por ano de assinatura e ente beneficiário (CNPJ do proponente = CNPJ do ente no Siconfi: exato; OSC e consórcios ficam sem ente). É ORIGEM DE FINANCIAMENTO, não gasto final: nunca se soma ao pagamento do ente beneficiário (o dinheiro transferido reaparece na despesa de quem executa). Transferências fundo a fundo e obrigatórias não passam por este arquivo (ver execução federal por modalidade). Não equivale a função 06.';
const trf = (id: number, key: string, label: string, unit: string, num: string): FinDef => ({ id, code: `IND-FIN-TRF-${key}`, label, unit, sort: id, numerator: num, denominator: 'não se aplica (contagem ou valor monetário)', source: 'TRANSFER', stage: 'transferência', note: NOTE_TRANSFER });
export const TRANSFER_DEFS: FinDef[] = [
  trf(7071, 'N', 'Convênios e contratos de repasse do MJSP firmados com o ente', 'instrumentos', 'exec_fin_transfer: propostas com convênio assinado no ano, ente beneficiário'),
  trf(7072, 'GLOBAL', 'Valor global dos convênios do MJSP firmados com o ente', 'R$', 'Σ v_global_conv (repasse + contrapartida)'),
  trf(7073, 'REPASSE', 'Valor de repasse dos convênios do MJSP firmados com o ente', 'R$', 'Σ v_repasse_conv (parte da União)'),
  trf(7074, 'DESEMB', 'Valor já desembolsado pela União nos convênios do MJSP firmados com o ente', 'R$', 'Σ v_desembolsado_conv (acumulado até a data do arquivo, imputado ao ano de assinatura)'),
];
export const ALL_FIN_DEFS: FinDef[] = [...FIN_DEFS, ...FIN_EDU_DEFS, ...FIN_DCARP_DEFS, ...PNCP_DEFS, ...TRANSFER_DEFS];
export const FIN_PNCP_IDS: number[] = PNCP_DEFS.map(d => d.id);
export const FIN_TRANSFER_IDS: number[] = TRANSFER_DEFS.map(d => d.id);

export const FIN_DEF_BY_ID = new Map(ALL_FIN_DEFS.map(d => [d.id, d]));
export async function seedFinancasDefs(pool: Pool, defs: FinDef[] = ALL_FIN_DEFS): Promise<number> {
  for (const d of defs) {
    await pool.query(`INSERT INTO civica_exec.exec_ind_def (indicator_id, code, method_version, domain, sort_order, label, unit, grain, numerator_desc, denominator_desc, min_denominator, ranking_allowed, aggregation_allowed, null_semantics, methodology_note)
      VALUES ($1,$2,1,$3,$4,$5,$6,'A',$7,$8,$9,false,false,$10,$11)
      ON CONFLICT (indicator_id) DO UPDATE SET label = EXCLUDED.label, unit = EXCLUDED.unit, numerator_desc = EXCLUDED.numerator_desc, denominator_desc = EXCLUDED.denominator_desc, min_denominator = EXCLUDED.min_denominator, null_semantics = EXCLUDED.null_semantics, methodology_note = EXCLUDED.methodology_note`,
      [d.id, d.code, d.source === 'EDU_DCA' ? DOMAIN.educacao : DOMAIN.seguranca, d.sort, d.label, d.unit, d.numerator, d.denominator, d.minDenominator ?? null,
        'sem linha = ente sem declaração do demonstrativo no exercício, declaração sem a linha da função 06, ou denominador ausente; consultar exec_fin_cov. Valor zero só quando a fonte declara zero. Valores monetários não somam entre esferas nem entre estágios.', d.note]);
  }
  return defs.length;
}

/** Garante os códigos do dicionário (aditivo e idempotente) e devolve code → ref_id por domínio. */
export async function ensureRefCodes(pool: Pool, domain: number, items: Array<{ code: string; label: string; attrs?: Record<string, unknown> }>): Promise<Map<string, number>> {
  // Só insere o que falta: INSERT ... ON CONFLICT DO NOTHING consome um valor da sequência smallint (ref_id) a cada tentativa, mesmo sem inserir, e a esgotaria.
  const have = new Set((await pool.query(`SELECT code FROM civica_exec.exec_ref_code WHERE domain = $1`, [domain])).rows.map(x => String(x.code)));
  for (const it of items) if (!have.has(it.code)) await pool.query(`INSERT INTO civica_exec.exec_ref_code (domain, code, canonical_code, label, attrs) VALUES ($1,$2,$2,$3,$4::jsonb) ON CONFLICT (domain, code, valid_from) DO NOTHING`, [domain, it.code, it.label, JSON.stringify(it.attrs ?? {})]);
  const r = await pool.query(`SELECT code, ref_id FROM civica_exec.exec_ref_code WHERE domain = $1`, [domain]);
  return new Map(r.rows.map(x => [String(x.code), Number(x.ref_id)]));
}
