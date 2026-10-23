import type { Pool } from 'pg';
import { DOMAIN } from './indicator-defs.ts';

/**
 * Contratos semânticos dos efetivos e da estrutura institucional (P9.3). Regras que valem para todos os indicadores abaixo:
 *  - cada indicador é UMA fonte × UMA corporação × UMA medida: FBSP, ESTADIC e MUNIC nunca se fundem em um número só;
 *  - existente ≠ previsto ≠ vínculo administrativo ≠ efetivo operacional ≠ lotado: nenhuma conversão entre eles;
 *  - efetivo estadual NÃO é distribuído por município nem por população; guarda municipal só existe onde a MUNIC informa município;
 *  - ausência é estado explícito (flags unavailable/notInformed/refused/inexistent), nunca zero.
 */
export const EFE_VERSION = { fbsp: 'efe-fbsp-v1', fbspExtract: 'fbsp-raiox-v2', estadic: 'efe-estadic-v1', siape: 'efe-siape-v1', munic: 'efe-munic-v1', ibgeExtract: 'ibge-perfil-seg-v2' } as const;

export type EfeSource = 'FBSP' | 'ESTADIC' | 'MUNIC' | 'SIAPE';
export type EfeLevel = 'brasil' | 'brasil_uf' | 'uf' | 'municipio';
export type EfeMeasure = 'existente' | 'previsto' | 'ocupacao' | 'diferenca' | 'taxa' | 'estrutura' | 'agregado_uf' | 'existencia' | 'vinculos';
export interface EfeDef {
  id: number; code: string; label: string; unit: string; sort: number; numerator: string; denominator: string; minDenominator?: number;
  source: EfeSource; level: EfeLevel; measure: EfeMeasure; corporation: string | null; definition: string; comparability: string; note: string;
}

/** Janela de referência de uma linha (period_start/period_end de exec_ind_value). */
export interface RefWindow { start: string; end: string; uncertain?: boolean; label: string }
const MAR25: RefWindow = { start: '2025-03-01', end: '2025-04-01', label: 'março/2025' };
const ABR25: RefWindow = { start: '2025-04-01', end: '2025-05-01', label: 'abril/2025' };
const JUN23: RefWindow = { start: '2023-06-01', end: '2023-07-01', label: 'junho/2023' };
const ANO25: RefWindow = { start: '2025-01-01', end: '2026-01-01', label: '2025', uncertain: true };
export const ESTADIC_REF: RefWindow = { start: '2022-12-31', end: '2023-01-01', label: '31/12/2022' };
export const MUNIC_SURVEY: RefWindow = { start: '2023-01-01', end: '2024-01-01', label: 'pesquisa 2023' };
export const MUNIC_REF: RefWindow = ESTADIC_REF;

/** Edições IBGE publicadas. Só entram edições cujas variáveis têm o mesmo código e o mesmo rótulo do dicionário oficial (conferido na carga). */
export interface IbgeEdition { key: 'estadic2019' | 'estadic2023' | 'munic2019' | 'munic2023'; mode: 'estadic' | 'munic'; year: number; refYear: number; ref: RefWindow; survey: RefWindow; competence: number; url: string; relPath: string; dataset: string;
  /** o dicionário da edição traz a data-base no enunciado do efetivo ("Efetivo ... em 31 de dezembro de AAAA") */ datedContext: boolean }
export const IBGE_EDITIONS: Record<IbgeEdition['key'], IbgeEdition> = {
  estadic2023: { key: 'estadic2023', mode: 'estadic', year: 2023, refYear: 2022, ref: ESTADIC_REF, survey: ESTADIC_REF, competence: 202301, url: 'https://ftp.ibge.gov.br/Perfil_Estados/2023/Base_Estadic_2023.xlsx', relPath: 'seguranca/efetivos/ibge-estadic-2023/Base_Estadic_2023.xlsx', dataset: 'ibge_estadic_2023', datedContext: true },
  estadic2019: { key: 'estadic2019', mode: 'estadic', year: 2019, refYear: 2018, ref: { start: '2018-12-31', end: '2019-01-01', label: '31/12/2018' }, survey: { start: '2018-12-31', end: '2019-01-01', label: '31/12/2018' }, competence: 201901, url: 'https://ftp.ibge.gov.br/Perfil_Estados/2019/Base_ESTADIC_2019.xlsx', relPath: 'seguranca/efetivos/ibge-estadic-2019/Base_ESTADIC_2019.xlsx', dataset: 'ibge_estadic_2019', datedContext: true },
  munic2023: { key: 'munic2023', mode: 'munic', year: 2023, refYear: 2022, ref: MUNIC_REF, survey: MUNIC_SURVEY, competence: 202301, url: 'https://ftp.ibge.gov.br/Perfil_Municipios/2023/Base_de_Dados/Base_MUNIC_2023.xlsx', relPath: 'seguranca/efetivos/ibge-munic-2023/Base_MUNIC_2023.xlsx', dataset: 'ibge_munic_2023', datedContext: true },
  /** O dicionário 2019 não informa a data-base do efetivo da guarda (só "Efetivo"): a janela é o ano da pesquisa e as linhas levam refDateUncertain. */
  munic2019: { key: 'munic2019', mode: 'munic', year: 2019, refYear: 2018, ref: { start: '2019-01-01', end: '2020-01-01', uncertain: true, label: 'pesquisa 2019 (data-base do efetivo não informada)' }, survey: { start: '2019-01-01', end: '2020-01-01', label: 'pesquisa 2019' }, competence: 201901, url: 'https://ftp.ibge.gov.br/Perfil_Municipios/2019/Base_de_Dados/Base_MUNIC_2019_20210817.xlsx', relPath: 'seguranca/efetivos/ibge-munic-2019/Base_MUNIC_2019_20210817.xlsx', dataset: 'ibge_munic_2019', datedContext: false },
};

export type FbspCorp = { key: string; label: string; id: number; ref: RefWindow; byUf: boolean; note: string };
/** key = coluna da Tabela 2 do Raio-X (fbsp_extract.py). */
export const FBSP_CORPS: FbspCorp[] = [
  { key: 'PM', label: 'Polícia Militar', id: 5001, ref: MAR25, byUf: true, note: 'Posição dos dados em março/2025 (nota 1 da Tabela 2). São Paulo: o efetivo dos Corpos de Bombeiros já está somado ao da PM nos dados de origem (nota 7), então o valor de SP inclui bombeiros. RJ: a nota da Tabela 3 informa números da PM de março/2022 (a fonte não esclarece se a linha RJ da Tabela 2 também é de 2022).' },
  { key: 'CBM', label: 'Corpo de Bombeiros Militar', id: 5002, ref: MAR25, byUf: true, note: 'Posição março/2025. SP não tem linha própria: os bombeiros estão somados à PM (nota 7); a célula é vazia na fonte e fica sem valor. Total nacional da fonte = soma das demais 26 UFs.' },
  { key: 'PC', label: 'Polícia Civil', id: 5003, ref: MAR25, byUf: true, note: 'Posição março/2025. Somente agentes da Polícia Civil, mesmo onde a perícia é vinculada à instituição (nota da Tabela 4).' },
  { key: 'PERICIA', label: 'Perícia Oficial', id: 5004, ref: MAR25, byUf: true, note: 'Posição março/2025. Perícia oficial independente do órgão a que se vincula.' },
  { key: 'POLICIA_PENAL', label: 'Polícia Penal estadual', id: 5005, ref: MAR25, byUf: true, note: 'Posição março/2025. Não inclui a Polícia Penal Federal (indicador próprio).' },
  { key: 'PF', label: 'Polícia Federal', id: 5006, ref: ABR25, byUf: false, note: 'Posição abril/2025; a fonte traz apenas o total nacional ("..." por UF). Não é o número de vínculos SIAPE.' },
  { key: 'PRF', label: 'Polícia Rodoviária Federal', id: 5007, ref: MAR25, byUf: false, note: 'Posição março/2025; apenas o total nacional ("..." por UF). Não é o número de vínculos SIAPE.' },
  { key: 'POLICIA_PENAL_FEDERAL', label: 'Polícia Penal Federal', id: 5008, ref: JUN23, byUf: false, note: 'Fonte: RELIPEN/Senappen, referência junho/2023 (nota 3): servidores de custódia no Sistema Penitenciário Federal. Data-base diferente das demais colunas da Tabela 2.' },
  { key: 'POLICIA_LEGISLATIVA', label: 'Polícia Legislativa', id: 5009, ref: ANO25, byUf: false, note: 'Soma dos efetivos da Câmara dos Deputados e do Senado (nota 4); a fonte não informa a data-base.' },
  { key: 'GCM', label: 'Guardas Civis Municipais', id: 5010, ref: ANO25, byUf: true, note: 'Esfera municipal. RAIS 2024 (MTE) combinada com a MUNIC 2023 e o Censo Senasp 2024, com checagem do FBSP (nota 5 da Tabela 2 e Tabela 15): não é a leitura direta da MUNIC. AC e DF não têm guarda municipal ("-").' },
];
export const FBSP_CORP_BY_KEY = new Map(FBSP_CORPS.map(c => [c.key, c]));
/** Tabelas 3, 4 e 5 do Raio-X: previsto × existente. */
export type FbspPlan = { table: 'T3' | 'T4' | 'T5'; corp: 'PM' | 'PC' | 'POLICIA_PENAL'; label: string; previsto: number; ocupacao: number; diferenca: number; existente: number };
export const FBSP_PLANS: FbspPlan[] = [
  { table: 'T3', corp: 'PM', label: 'Polícia Militar', previsto: 5011, ocupacao: 5014, diferenca: 5017, existente: 5001 },
  { table: 'T4', corp: 'PC', label: 'Polícia Civil', previsto: 5012, ocupacao: 5015, diferenca: 5018, existente: 5003 },
  { table: 'T5', corp: 'POLICIA_PENAL', label: 'Polícia Penal estadual', previsto: 5013, ocupacao: 5016, diferenca: 5019, existente: 5005 },
];
export const FBSP_GCM_IDS = { munFinal: 5020, efRais: 5021, munRais: 5022 };
/** Taxas por 100 mil habitantes (UF): só onde o denominador "população da UF" faz sentido. */
export const FBSP_RATES: Array<{ id: number; corp: string; source: number }> = [{ id: 5031, corp: 'PM', source: 5001 }, { id: 5032, corp: 'CBM', source: 5002 }, { id: 5033, corp: 'PC', source: 5003 }, { id: 5034, corp: 'GCM', source: 5010 }];
export const FBSP_ALL_IDS: number[] = [...FBSP_CORPS.map(c => c.id), ...FBSP_PLANS.flatMap(p => [p.previsto, p.ocupacao, p.diferenca]), ...Object.values(FBSP_GCM_IDS), ...FBSP_RATES.map(r => r.id)];

/** ESTADIC 2023: variáveis ESEG* de efetivo e unidades (dicionário oficial; rótulo e contexto conferidos na carga). */
/** ctx: trechos exigidos no contexto do dicionário; {Y} = ano da data-base da edição. */
export type EstadicVar = { id: number; v: string; label: string; unit: string; expectLabel: string; ctx: string[]; corp: 'PM' | 'PC'; measure: EfeMeasure; note: string };
export const ESTADIC_VARS: EstadicVar[] = [
  { id: 5101, v: 'ESEG273', label: 'Efetivo existente da Polícia Militar (ESTADIC)', unit: 'policiais', expectLabel: 'Total', ctx: ['Efetivo existente em 31 de dezembro de {Y}'], corp: 'PM', measure: 'existente', note: 'Total (homens + mulheres) informado pela UF.' },
  { id: 5102, v: 'ESEG271', label: 'Efetivo existente da Polícia Militar — homens (ESTADIC)', unit: 'policiais', expectLabel: 'Homens', ctx: ['Efetivo existente em 31 de dezembro de {Y}'], corp: 'PM', measure: 'existente', note: 'UFs podem informar o total sem o recorte por sexo.' },
  { id: 5103, v: 'ESEG272', label: 'Efetivo existente da Polícia Militar — mulheres (ESTADIC)', unit: 'policiais', expectLabel: 'Mulheres', ctx: ['Efetivo existente em 31 de dezembro de {Y}'], corp: 'PM', measure: 'existente', note: 'UFs podem informar o total sem o recorte por sexo.' },
  { id: 5104, v: 'ESEG493', label: 'Efetivo existente da Polícia Civil (ESTADIC)', unit: 'policiais', expectLabel: 'Total', ctx: ['Efetivo existente em 31 de dezembro de {Y}'], corp: 'PC', measure: 'existente', note: 'Total (homens + mulheres) informado pela UF.' },
  { id: 5105, v: 'ESEG491', label: 'Efetivo existente da Polícia Civil — homens (ESTADIC)', unit: 'policiais', expectLabel: 'Homens', ctx: ['Efetivo existente em 31 de dezembro de {Y}'], corp: 'PC', measure: 'existente', note: 'UFs podem informar o total sem o recorte por sexo.' },
  { id: 5106, v: 'ESEG492', label: 'Efetivo existente da Polícia Civil — mulheres (ESTADIC)', unit: 'policiais', expectLabel: 'Mulheres', ctx: ['Efetivo existente em 31 de dezembro de {Y}'], corp: 'PC', measure: 'existente', note: 'UFs podem informar o total sem o recorte por sexo.' },
  { id: 5107, v: 'ESEG3031', label: 'Unidades operacionais da Polícia Militar (ESTADIC)', unit: 'unidades', expectLabel: 'Total', ctx: ['unidades operacionais', '31 de dezembro de {Y}'], corp: 'PM', measure: 'estrutura', note: 'Contagem declarada pela UF (capital + demais municípios); não é cadastro de batalhões nem de endereços.' },
  { id: 5108, v: 'ESEG5131', label: 'Delegacias distritais da Polícia Civil (ESTADIC)', unit: 'delegacias', expectLabel: 'Total', ctx: ['Unidades Policiais', '31 de dezembro de {Y}'], corp: 'PC', measure: 'estrutura', note: 'Contagem declarada pela UF (capital + demais municípios); não é cadastro de delegacias.' },
  { id: 5109, v: 'ESEG5134', label: 'Delegacias especializadas da Polícia Civil (ESTADIC)', unit: 'delegacias', expectLabel: 'Total', ctx: ['Unidades Policiais', '31 de dezembro de {Y}'], corp: 'PC', measure: 'estrutura', note: 'Contagem declarada pela UF (capital + demais municípios); não é cadastro de delegacias.' },
  { id: 5110, v: 'ESEG50', label: 'Perícia Oficial vinculada à Polícia Civil (ESTADIC)', unit: '1 = vinculada; 0 = não', expectLabel: 'vinculada a esta Pol', ctx: [], corp: 'PC', measure: 'existencia', note: 'Resposta Sim/Não da UF. Não informa efetivo da perícia.' },
];
export const ESTADIC_IDS = ESTADIC_VARS.map(v => v.id);

/** MUNIC 2023, aba Segurança Pública. Respostas: Sim / Não / Não informou / "-" (não se aplica: pergunta não feita). */
export type MunicVar = { id: number; v: string; label: string; expectLabel: string; kind: 'bool' | 'count'; note: string; /** presente também na edição 2019 */ core?: boolean; /** contexto exigido só nas edições com data-base no enunciado */ datedCtx?: string };
const EXISTE = 'Existe no município';
export const MUNIC_VARS: MunicVar[] = [
  { id: 5201, v: 'MSEG27', label: 'Município possui guarda municipal (MUNIC)', expectLabel: 'Guarda municipal', kind: 'bool', core: true, note: 'Resposta da prefeitura à pesquisa (2023).' },
  { id: 5202, v: 'MSEG283', label: 'Efetivo da guarda municipal — total (MUNIC)', expectLabel: 'Total', kind: 'count', core: true, datedCtx: 'Efetivo em 31 de dezembro de {Y}', note: 'Efetivo em 31/12/2022 declarado pela prefeitura. Só existe para quem declarou ter guarda; município sem guarda não tem efetivo (pergunta não aplicável).' },
  { id: 5203, v: 'MSEG281', label: 'Efetivo da guarda municipal — homens (MUNIC)', expectLabel: 'Homens', kind: 'count', core: true, datedCtx: 'Efetivo em 31 de dezembro de {Y}', note: 'Efetivo em 31/12/2022.' },
  { id: 5204, v: 'MSEG282', label: 'Efetivo da guarda municipal — mulheres (MUNIC)', expectLabel: 'Mulheres', kind: 'count', core: true, datedCtx: 'Efetivo em 31 de dezembro de {Y}', note: 'Efetivo em 31/12/2022.' },
  { id: 5211, v: 'MSEG161', label: 'Município possui delegacia de Polícia Civil (MUNIC)', expectLabel: 'Delegacia de Pol', kind: 'bool', core: true, note: `"${EXISTE}": existência, não quantidade. "-" na fonte = a prefeitura marcou "Nenhuma das citadas" (indicador 5221), o que também exclui a delegacia de Polícia Civil.` },
  { id: 5212, v: 'MSEG162', label: 'Município possui delegacia de homicídios (MUNIC)', expectLabel: 'Delegacia de Homic', kind: 'bool', note: 'Existência, não quantidade.' },
  { id: 5213, v: 'MSEG163', label: 'Município possui delegacia de proteção à pessoa idosa (MUNIC)', expectLabel: 'Pessoa Idosa', kind: 'bool', note: 'Existência, não quantidade.' },
  { id: 5214, v: 'MSEG164', label: 'Município possui delegacia de proteção à criança e ao adolescente — DPCA (MUNIC)', expectLabel: 'DPCA', kind: 'bool', note: 'Existência, não quantidade.' },
  { id: 5215, v: 'MSEG165', label: 'Município possui delegacia da criança e do adolescente — DCA (MUNIC)', expectLabel: '(DCA)', kind: 'bool', note: 'Existência, não quantidade.' },
  { id: 5216, v: 'MSEG166', label: 'Município possui delegacia da criança e do adolescente, especialidades não separadas (MUNIC)', expectLabel: 'especialidades', kind: 'bool', note: 'Existência, não quantidade.' },
  { id: 5217, v: 'MSEG167', label: 'Município possui delegacia de proteção ao meio ambiente (MUNIC)', expectLabel: 'Meio Ambiente', kind: 'bool', note: 'Existência, não quantidade.' },
  { id: 5218, v: 'MSEG168', label: 'Município possui delegacia especializada no atendimento à mulher (MUNIC)', expectLabel: 'Mulher', kind: 'bool', note: 'Existência, não quantidade.' },
  { id: 5219, v: 'MSEG169', label: 'Município possui delegacia especializada em pessoas desaparecidas (MUNIC)', expectLabel: 'Desaparecidas', kind: 'bool', note: 'Existência, não quantidade.' },
  { id: 5220, v: 'MSEG1610', label: 'Município possui delegacia de repressão aos crimes de informática (MUNIC)', expectLabel: 'Inform', kind: 'bool', note: 'Existência, não quantidade.' },
  { id: 5221, v: 'MSEG1611', label: 'Município declarou nenhuma das delegacias citadas (MUNIC)', expectLabel: 'Nenhuma das citadas', kind: 'bool', note: 'Resposta exclusiva: quando "Sim", o município não tem delegacia de Polícia Civil nem as especializadas listadas.' },
  { id: 5222, v: 'MSEG17', label: 'Município possui Instituto Médico Legal (MUNIC)', expectLabel: 'Instituto M', kind: 'bool', core: true, note: 'Existência, não quantidade.' },
  { id: 5223, v: 'MSEG18', label: 'Município é sede de comarca (MUNIC)', expectLabel: 'Sede de Comarca', kind: 'bool', core: true, note: 'Existência.' },
  { id: 5224, v: 'MSEG19', label: 'Município possui unidade do Corpo de Bombeiros (MUNIC)', expectLabel: 'Corpo de Bombeiros', kind: 'bool', core: true, note: 'Existência, não quantidade.' },
];
export const MUNIC_UF_AGG = { guardas: 5231, efetivo: 5232, semResposta: 5233, delegacia: 5234 };
export const MUNIC_IDS: number[] = [...MUNIC_VARS.map(v => v.id), ...Object.values(MUNIC_UF_AGG)];
export const MUNIC_MUN_IDS: number[] = MUNIC_VARS.map(v => v.id);

const FBSP_SRC = 'Raio-X das Forças de Segurança Pública do Brasil, 2ª edição (FBSP, 2026; dados de 2025). Fontes primárias do FBSP: portais da transparência federal/estaduais, DPF, DPRF, DEPEN, RAIS e MUNIC. Cada corporação tem data-base própria (ver nota). Efetivo da ativa = servidores em atividade na posição informada; não é efetivo operacional nem lotação.';
const ESTADIC_SRC = 'IBGE, Pesquisa de Informações Básicas Estaduais (ESTADIC), aba Segurança Pública, edições 2019 (data-base 31/12/2018) e 2023 (31/12/2022): declaração do órgão gestor estadual. Mesmos códigos de variável e mesmos rótulos nas duas edições. Conceito próprio da ESTADIC; não é comparável ponto a ponto com o FBSP 2025.';
const MUNIC_SRC = 'IBGE, Pesquisa de Informações Básicas Municipais (MUNIC), aba Segurança Pública, edições 2019 e 2023: declaração da prefeitura. Efetivo da guarda em 31/12/2022 (2023); a edição 2019 não informa a data-base do efetivo. Cada pesquisa tem 5.570 municípios; a fundação territorial do Cívica tem 5.571 (o município criado depois não foi pesquisado e não recebe linha). A edição 2019 não tem a pergunta "nenhuma das citadas" (indicador 5221) e usa "Recusa" e "Não soube informar" onde a 2023 usa "Não informou".';
const NO_DISTRIBUTE = ' Não distribuído por município nem por população.';

function fbspDefs(): EfeDef[] {
  const out: EfeDef[] = []; let sort = 5000;
  const cmp = 'FBSP × ESTADIC × SIAPE são conceitos distintos: não somar nem tratar a diferença como variação real. Entre UFs, a comparação depende de a mesma definição de "efetivo da ativa" ter sido aplicada; use junto da população apenas para as taxas publicadas.';
  for (const c of FBSP_CORPS) out.push({ id: c.id, code: `IND-EFE-FBSP-${c.key}`, label: `Efetivo da ativa — ${c.label} (FBSP)`, unit: 'servidores', sort: sort++, numerator: `efetivo da ativa de ${c.label} (Tabela 2)`, denominator: 'não se aplica (contagem)', source: 'FBSP', level: c.byUf ? 'brasil_uf' : 'uf', measure: 'existente', corporation: c.key,
    definition: `Efetivo da ativa de ${c.label}, posição ${c.ref.label}.`, comparability: cmp, note: `${FBSP_SRC} ${c.note}${c.byUf ? NO_DISTRIBUTE : ' Somente Brasil.'}` });
  for (const p of FBSP_PLANS) {
    out.push({ id: p.previsto, code: `IND-EFE-FBSP-${p.corp}-PREV`, label: `Efetivo previsto — ${p.label} (FBSP)`, unit: 'cargos previstos', sort: sort++, numerator: `quadro previsto em lei de ${p.label}`, denominator: 'não se aplica (contagem)', source: 'FBSP', level: 'brasil_uf', measure: 'previsto', corporation: p.corp,
      definition: `Quadro de cargos previsto (não é efetivo existente).`, comparability: cmp + ' Quadro previsto não é meta de policiamento nem necessidade estimada.', note: `${FBSP_SRC} Tabela ${p.table.slice(1)}.${p.corp === 'PM' ? ' Nota da Tabela 3: números da PM do RJ são de março/2022 (a instituição não respondeu à LAI para 2023).' : ''}${p.corp === 'POLICIA_PENAL' ? ' Ceará: previsto "..." (não disponível).' : ''}` });
    out.push({ id: p.ocupacao, code: `IND-EFE-FBSP-${p.corp}-OCUP`, label: `Ocupação do quadro previsto — ${p.label} (FBSP)`, unit: '% do quadro previsto', sort: sort++, numerator: 'efetivo existente', denominator: 'efetivo previsto', source: 'FBSP', level: 'brasil_uf', measure: 'ocupacao', corporation: p.corp,
      definition: 'existente ÷ previsto × 100; pode passar de 100 %.', comparability: 'É o preenchimento do quadro legal, NÃO a cobertura do policiamento do território. Não classifica UF como mais ou menos segura.', note: `${FBSP_SRC} Calculado pelo Cívica a partir dos dois valores da tabela e conferido contra a coluna "Relação" impressa (diferença máxima de arredondamento 0,05 p.p.).` });
    out.push({ id: p.diferenca, code: `IND-EFE-FBSP-${p.corp}-DIF`, label: `Diferença previsto − existente — ${p.label} (FBSP)`, unit: 'cargos', sort: sort++, numerator: 'efetivo previsto', denominator: 'efetivo existente', source: 'FBSP', level: 'brasil_uf', measure: 'diferenca', corporation: p.corp,
      definition: 'previsto − existente (negativo = existente acima do previsto).', comparability: 'Diferença do quadro legal, não déficit de policiamento nem número de policiais a contratar.', note: `${FBSP_SRC} Calculado pelo Cívica.` });
  }
  out.push({ id: 5020, code: 'IND-EFE-FBSP-GCM-MUN', label: 'Municípios com guarda municipal — contagem final FBSP', unit: 'municípios', sort: sort++, numerator: 'municípios com guarda (RAIS 2024 + MUNIC 2023 + Senasp 2024, validado pelo FBSP)', denominator: 'não se aplica (contagem)', source: 'FBSP', level: 'brasil_uf', measure: 'agregado_uf', corporation: 'GCM',
    definition: 'Tabela 15 do Raio-X, coluna final.', comparability: 'Não é a contagem direta da MUNIC (IND 5231).', note: `${FBSP_SRC} Tabela 15.` });
  out.push({ id: 5021, code: 'IND-EFE-FBSP-GCM-RAIS-EF', label: 'Efetivo de guardas municipais — RAIS 2024 (FBSP, Tabela 15)', unit: 'guardas', sort: sort++, numerator: 'vínculos formais com a CBO de guarda-civil municipal (RAIS 2024, dados preliminares)', denominator: 'não se aplica (contagem)', source: 'FBSP', level: 'brasil_uf', measure: 'agregado_uf', corporation: 'GCM',
    definition: 'RAIS/MTE 2024 por UF.', comparability: 'Vínculos formais declarados à RAIS; difere da declaração da MUNIC e do total final do FBSP. Não somar com 5010 nem com a MUNIC.', note: `${FBSP_SRC} Tabela 15.` });
  out.push({ id: 5022, code: 'IND-EFE-FBSP-GCM-RAIS-MUN', label: 'Municípios com guarda municipal — RAIS 2024 (FBSP, Tabela 15)', unit: 'municípios', sort: sort++, numerator: 'municípios com vínculos na CBO de guarda-civil municipal (RAIS 2024)', denominator: 'não se aplica (contagem)', source: 'FBSP', level: 'brasil_uf', measure: 'agregado_uf', corporation: 'GCM',
    definition: 'RAIS/MTE 2024 por UF.', comparability: 'Ver o indicador 5021: mesma fonte e mesmas ressalvas.', note: `${FBSP_SRC} Tabela 15.` });
  for (const r of FBSP_RATES) { const c = FBSP_CORP_BY_KEY.get(r.corp)!;
    out.push({ id: r.id, code: `IND-EFE-FBSP-${r.corp}-TAXA`, label: `${c.label} por 100 mil habitantes (FBSP 2025 ÷ população da UF)`, unit: 'servidores por 100 mil habitantes', sort: sort++, numerator: `efetivo da ativa de ${c.label} (FBSP)`, denominator: 'população residente estimada da UF em 2025 (IBGE, SIDRA 6579)', source: 'FBSP', level: 'uf', measure: 'taxa', corporation: r.corp,
      definition: 'efetivo ÷ população × 100 mil.', comparability: 'Taxa por corporação; NÃO existe "policiais por 100 mil" somado entre corporações. Não indica que uma UF é mais ou menos segura nem eficiência policial.', note: `${FBSP_SRC} Denominador de 2025 (data-base do efetivo: março/2025).${r.corp === 'PM' ? ' São Paulo: numerador inclui bombeiros (nota 7).' : ''}` }); }
  return out;
}
function estadicDefs(): EfeDef[] {
  let sort = 5100;
  return ESTADIC_VARS.map(v => ({ id: v.id, code: `IND-EFE-ESTADIC-${v.v}`, label: v.label, unit: v.unit, sort: sort++, numerator: `${v.v} (ESTADIC 2023)`, denominator: 'não se aplica (contagem)', source: 'ESTADIC' as const, level: 'uf' as const, measure: v.measure, corporation: v.corp,
    definition: `Variável ${v.v} do dicionário oficial da ESTADIC (edições 2019 e 2023); data-base 31/12/2018 e 31/12/2022.`, comparability: 'Pesquisa declaratória do órgão gestor estadual; difere do FBSP (portais da transparência, 2025). Duas edições são dois pontos (2018 e 2022): não há valor para 2019–2021 e a diferença não é variação anual. Sem taxa por habitante: não há estimativa populacional oficial carregada para 2018 e 2022.', note: `${ESTADIC_SRC} ${v.note}${NO_DISTRIBUTE} Rondônia recusou responder em 2023 (estado "recusa", não zero); Pará e Tocantins informaram só o total em parte das variáveis.` }));
}
function municDefs(): EfeDef[] {
  const out: EfeDef[] = []; let sort = 5200;
  for (const v of MUNIC_VARS) out.push({ id: v.id, code: `IND-EFE-MUNIC-${v.v}`, label: v.label, unit: v.kind === 'count' ? 'guardas' : '1 = sim; 0 = não', sort: sort++, numerator: `${v.v} (MUNIC 2023)`, denominator: 'não se aplica', source: 'MUNIC', level: 'municipio', measure: v.kind === 'count' ? 'existente' : 'existencia', corporation: v.id <= 5204 ? 'GCM' : v.id <= 5221 ? 'PC' : null,
    definition: `Variável ${v.v} do dicionário oficial da MUNIC (edições 2019 e 2023).`, comparability: 'Declaração da prefeitura; existência não informa quantidade, funcionamento atual, endereço, lotação nem área atendida. Não afirma que a estrutura continua em 2026.', note: `${MUNIC_SRC} ${v.note}` });
  const agg = (id: number, key: string, label: string, unit: string, num: string, note: string) => out.push({ id, code: `IND-EFE-MUNIC-UF-${key}`, label, unit, sort: sort++, numerator: num, denominator: 'não se aplica (contagem)', source: 'MUNIC', level: 'uf', measure: 'agregado_uf', corporation: 'GCM',
    definition: `Soma dos municípios da UF (conferida contra os valores municipais na publicação).`, comparability: 'Soma de declarações municipais; municípios que não informaram ficam fora e são contados à parte (5233).', note: `${MUNIC_SRC} ${note}` });
  agg(5231, 'GCM-MUN', 'Municípios da UF com guarda municipal (MUNIC)', 'municípios', 'municípios com MSEG27 = Sim', 'Σ dos municípios que declararam ter guarda.');
  agg(5232, 'GCM-EF', 'Efetivo de guardas municipais na UF — soma dos municípios (MUNIC)', 'guardas', 'Σ MSEG283 dos municípios com guarda', 'Σ do efetivo declarado; município com guarda sem efetivo informado não entra como zero.');
  agg(5233, 'GCM-NI', 'Municípios da UF que não informaram se têm guarda municipal (MUNIC)', 'municípios', 'municípios com MSEG27 = Não informou', 'Cobertura da resposta.');
  agg(5234, 'DPC-MUN', 'Municípios da UF com delegacia de Polícia Civil (MUNIC)', 'municípios', 'municípios com MSEG161 = Sim', 'Existência municipal; não é número de delegacias.');
  return out;
}
/** SIAPE (Portal da Transparência): contagem mensal de REGISTROS de vínculo do cadastro por órgão de exercício. Não é efetivo policial. */
export const SIAPE_ORGS = [
  { cod: '20115', key: 'PF', label: 'Polícia Federal (Departamento de Polícia Federal)', total: 5301, cargo: 5302 },
  { cod: '30802', key: 'PRF', label: 'Polícia Rodoviária Federal (Departamento de Polícia Rodoviária Federal)', total: 5303, cargo: 5304 },
] as const;
export const SIAPE_IDS: number[] = SIAPE_ORGS.flatMap(o => [o.total, o.cargo]);
const SIAPE_SRC = 'Portal da Transparência (CGU/MGI), arquivo mensal "Servidores_SIAPE" (Cadastro de servidores civis do Poder Executivo federal). Agregado por órgão de exercício durante a leitura; nenhum registro individual é gravado. Em PF e PRF a situação do vínculo, o cargo, a UF de exercício e o identificador do servidor vêm "Sigiloso": não há como separar ativos de inativos, policiais de administrativos, nem distribuir por UF.';
function siapeDefs(): EfeDef[] {
  let sort = 5300; const out: EfeDef[] = [];
  for (const o of SIAPE_ORGS) {
    out.push({ id: o.total, code: `IND-EFE-SIAPE-${o.key}-VINC`, label: `Registros de vínculo no cadastro SIAPE — ${o.label}`, unit: 'registros de vínculo', sort: sort++, numerator: 'linhas do cadastro com o órgão de exercício', denominator: 'não se aplica (contagem)', source: 'SIAPE', level: 'brasil', measure: 'vinculos', corporation: o.key,
      definition: `Linhas do Cadastro SIAPE do mês cujo órgão de exercício é ${o.label}, qualquer tipo de vínculo (cargo, função, outros).`, comparability: 'Vínculo administrativo ≠ policial em efetivo operacional ≠ efetivo da ativa do FBSP. Uma pessoa pode ter mais de um registro (cargo e função). Não comparar nem substituir os totais do FBSP; diferenças não são variação real de policiais.', note: `${SIAPE_SRC} Somente Brasil.` });
    out.push({ id: o.cargo, code: `IND-EFE-SIAPE-${o.key}-CARGO`, label: `Registros de vínculo de tipo "Cargo" no cadastro SIAPE — ${o.label}`, unit: 'registros de vínculo', sort: sort++, numerator: 'linhas com TIPO_VINCULO = Cargo', denominator: 'não se aplica (contagem)', source: 'SIAPE', level: 'brasil', measure: 'vinculos', corporation: o.key,
      definition: 'Linhas de tipo "Cargo" (exclui função comissionada e outros). Ainda inclui carreiras de apoio administrativo e pode incluir inativos.', comparability: 'Ver o indicador de registros totais. Não é número de policiais.', note: `${SIAPE_SRC} Somente Brasil.` });
  }
  return out;
}
export const EFE_DEFS: EfeDef[] = [...fbspDefs(), ...estadicDefs(), ...municDefs(), ...siapeDefs()];
export const EFE_DEF_BY_ID = new Map(EFE_DEFS.map(d => [d.id, d]));

export async function seedEfetivosDefs(pool: Pool, defs: EfeDef[] = EFE_DEFS): Promise<number> {
  for (const d of defs) {
    await pool.query(`INSERT INTO civica_exec.exec_ind_def (indicator_id, code, method_version, domain, sort_order, label, unit, grain, numerator_desc, denominator_desc, min_denominator, ranking_allowed, aggregation_allowed, null_semantics, methodology_note)
      VALUES ($1,$2,1,$3,$4,$5,$6,$12,$7,$8,$9,false,false,$10,$11)
      ON CONFLICT (indicator_id) DO UPDATE SET label = EXCLUDED.label, unit = EXCLUDED.unit, numerator_desc = EXCLUDED.numerator_desc, denominator_desc = EXCLUDED.denominator_desc, min_denominator = EXCLUDED.min_denominator, null_semantics = EXCLUDED.null_semantics, methodology_note = EXCLUDED.methodology_note`,
      [d.id, d.code, DOMAIN.seguranca, d.sort, d.label, d.unit, d.numerator, d.denominator, d.minDenominator ?? null,
        'valor NULL = a fonte não trouxe o número; os bits de flags dizem por quê (unavailable "...", notInformed, refused "Recusa"); "-" da fonte = inexistente (flags inexistent, valor 0); ausência de linha = pergunta não aplicável ou fora do universo. Nunca zero por falta de resposta.',
        `${d.note} Definição: ${d.definition} Comparabilidade: ${d.comparability}`, d.source === 'SIAPE' ? 'M' : 'A']);
  }
  return defs.length;
}
