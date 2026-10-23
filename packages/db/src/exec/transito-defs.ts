import type { Pool } from 'pg';
import { DOMAIN } from './indicator-defs.ts';

/**
 * Contratos semânticos de Trânsito e Segurança Viária (P9.2). Universos DISTINTOS e nunca somados:
 *  SIM = óbitos em declaração de óbito · RENAEST = sinistros e vítimas reportados pelos órgãos participantes · PRF = sinistros registrados em rodovias federais ·
 *  Senatran frota = veículos REGISTRADOS (não circulantes) no município · Senatran infrações = notificações de penalidade por UF de JURISDIÇÃO do veículo (não o local da infração).
 */
export const TRA_VERSION = { sim: 'sim-tra-v1', simExtract: 'sim-tra-x1', frota: 'frota-v1', renaest: 'renaest-v1', prf: 'prf-v1', infr: 'infr-v1', crosswalk: 'tra-xw-v1' } as const;

/** Chave de comparação determinística: sem acentos, maiúsculas, apenas A–Z e 0–9 (remove espaços, hífens e apóstrofos). Não é fuzzy. */
export function compactKey(s: string): string {
  return String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}
export const TRA_UNASSIGNED_KEYS = new Set(['MUNICIPIONAOINFORMADO']);

/** Aliases validados contra a lista do IBGE (UF + chave compacta → município canônico). Validação operacional: nenhuma colisão em 165 meses da frota, nenhuma entidade mapeada duas vezes. */
export interface TraAlias { uf: string; key: string; canonical: string; ibge7: number; sources: string[]; rule: string }
export const TRA_ALIASES: TraAlias[] = [
  { uf: 'BA', key: 'LAGEDODOTABOCAL', canonical: 'Lajedo do Tabocal', ibge7: 2919058, sources: ['senatran'], rule: 'truncamento ou grafia diferente do IBGE' },
  { uf: 'BA', key: 'MUQUEMDESAOFRANCISCO', canonical: 'Muquém do São Francisco', ibge7: 2922250, sources: ['prf'], rule: 'truncamento ou grafia diferente do IBGE' },
  { uf: 'BA', key: 'SANTATERESINHA', canonical: 'Santa Terezinha', ibge7: 2928505, sources: ['senatran', 'prf'], rule: 'truncamento ou grafia diferente do IBGE' },
  { uf: 'CE', key: 'ITAPAGE', canonical: 'Itapajé', ibge7: 2306306, sources: ['prf'], rule: 'truncamento ou grafia diferente do IBGE' },
  { uf: 'GO', key: 'BOMJESUS', canonical: 'Bom Jesus de Goiás', ibge7: 5203500, sources: ['senatran'], rule: 'truncamento ou grafia diferente do IBGE' },
  { uf: 'MG', key: 'AMPARODASERRA', canonical: 'Amparo do Serra', ibge7: 3102506, sources: ['senatran'], rule: 'truncamento ou grafia diferente do IBGE' },
  { uf: 'MG', key: 'BARAOD0MONTEALTO', canonical: 'Barão do Monte Alto', ibge7: 3105509, sources: ['senatran'], rule: 'truncamento ou grafia diferente do IBGE' },
  { uf: 'MG', key: 'BRASOPOLIS', canonical: 'Brazópolis', ibge7: 3108909, sources: ['senatran'], rule: 'truncamento ou grafia diferente do IBGE' },
  { uf: 'MG', key: 'GOUVEA', canonical: 'Gouveia', ibge7: 3127602, sources: ['senatran'], rule: 'truncamento ou grafia diferente do IBGE' },
  { uf: 'MG', key: 'QUELUZITA', canonical: 'Queluzito', ibge7: 3153806, sources: ['senatran'], rule: 'truncamento ou grafia diferente do IBGE' },
  { uf: 'MT', key: 'POXOREO', canonical: 'Poxoréu', ibge7: 5107008, sources: ['senatran', 'prf'], rule: 'truncamento ou grafia diferente do IBGE' },
  { uf: 'MT', key: 'SANTOANTONIODOLEVERGER', canonical: 'Santo Antônio de Leverger', ibge7: 5107800, sources: ['senatran', 'prf'], rule: 'truncamento ou grafia diferente do IBGE' },
  { uf: 'MT', key: 'VILABELADASANTISSIMATRINDA', canonical: 'Vila Bela da Santíssima Trindade', ibge7: 5105507, sources: ['senatran'], rule: 'truncamento ou grafia diferente do IBGE' },
  { uf: 'PA', key: 'ELDORADODOSCARAJAS', canonical: 'Eldorado do Carajás', ibge7: 1502954, sources: ['senatran', 'prf'], rule: 'truncamento ou grafia diferente do IBGE' },
  { uf: 'PA', key: 'SANTAISABELDOPARA', canonical: 'Santa Izabel do Pará', ibge7: 1506500, sources: ['senatran', 'prf'], rule: 'truncamento ou grafia diferente do IBGE' },
  { uf: 'PB', key: 'CAMPODESANTANA', canonical: 'Tacima', ibge7: 2516409, sources: ['senatran'], rule: 'renomeação do município' },
  { uf: 'PB', key: 'SANTAREM', canonical: 'Joca Claudino', ibge7: 2513653, sources: ['senatran', 'prf'], rule: 'renomeação do município' },
  { uf: 'PB', key: 'SAODOMINGOSDEPOMBAL', canonical: 'São Domingos', ibge7: 2513968, sources: ['senatran', 'prf'], rule: 'truncamento ou grafia diferente do IBGE' },
  { uf: 'PE', key: 'BELEMDESAOFRANCISCO', canonical: 'Belém do São Francisco', ibge7: 2601607, sources: ['senatran', 'prf'], rule: 'truncamento ou grafia diferente do IBGE' },
  { uf: 'PE', key: 'IGUARACI', canonical: 'Iguaracy', ibge7: 2606903, sources: ['senatran'], rule: 'truncamento ou grafia diferente do IBGE' },
  { uf: 'PE', key: 'LAGOADOITAENGA', canonical: 'Lagoa de Itaenga', ibge7: 2608503, sources: ['senatran'], rule: 'truncamento ou grafia diferente do IBGE' },
  { uf: 'PI', key: 'SAOFRANCISCODEASSISDOPIAU', canonical: 'São Francisco de Assis do Piauí', ibge7: 2209658, sources: ['senatran'], rule: 'truncamento ou grafia diferente do IBGE' },
  { uf: 'PR', key: 'BELAVISTADOCAROBA', canonical: 'Bela Vista da Caroba', ibge7: 4102752, sources: ['senatran'], rule: 'truncamento ou grafia diferente do IBGE' },
  { uf: 'PR', key: 'MUNHOZDEMELLO', canonical: 'Munhoz de Melo', ibge7: 4116307, sources: ['senatran'], rule: 'truncamento ou grafia diferente do IBGE' },
  { uf: 'PR', key: 'PINHALDOSAOBENTO', canonical: 'Pinhal de São Bento', ibge7: 4119251, sources: ['senatran'], rule: 'truncamento ou grafia diferente do IBGE' },
  { uf: 'PR', key: 'SANTACRUZDOMONTECASTELO', canonical: 'Santa Cruz de Monte Castelo', ibge7: 4123303, sources: ['senatran'], rule: 'truncamento ou grafia diferente do IBGE' },
  { uf: 'RJ', key: 'ARMACAODEBUZIOS', canonical: 'Armação dos Búzios', ibge7: 3300233, sources: ['senatran'], rule: 'renomeação do município' },
  { uf: 'RJ', key: 'PARATI', canonical: 'Paraty', ibge7: 3303807, sources: ['senatran', 'prf'], rule: 'truncamento ou grafia diferente do IBGE' },
  { uf: 'RJ', key: 'TRAJANODEMORAIS', canonical: 'Trajano de Moraes', ibge7: 3305901, sources: ['senatran'], rule: 'truncamento ou grafia diferente do IBGE' },
  { uf: 'RN', key: 'ACU', canonical: 'Assú', ibge7: 2400208, sources: ['prf'], rule: 'truncamento ou grafia diferente do IBGE' },
  { uf: 'RN', key: 'ARES', canonical: 'Arez', ibge7: 2401206, sources: ['senatran', 'prf'], rule: 'truncamento ou grafia diferente do IBGE' },
  { uf: 'RN', key: 'AUGUSTOSEVERO', canonical: 'Campo Grande', ibge7: 2401305, sources: ['prf'], rule: 'renomeação do município' },
  { uf: 'RN', key: 'BOASAUDE', canonical: 'Januário Cicco', ibge7: 2405306, sources: ['senatran'], rule: 'renomeação do município' },
  { uf: 'RO', key: 'NOVADOMAMORE', canonical: 'Nova Mamoré', ibge7: 1100338, sources: ['senatran'], rule: 'truncamento ou grafia diferente do IBGE' },
  { uf: 'RO', key: 'VILANOVADOMAMORE', canonical: 'Nova Mamoré', ibge7: 1100338, sources: ['prf'], rule: 'truncamento ou grafia diferente do IBGE' },
  { uf: 'RR', key: 'SAOLUIZ', canonical: 'São Luiz do Anauá', ibge7: 1400605, sources: ['senatran', 'prf'], rule: 'truncamento ou grafia diferente do IBGE' },
  { uf: 'SC', key: 'BALNEARIODEPICARRAS', canonical: 'Balneário Piçarras', ibge7: 4212809, sources: ['senatran'], rule: 'renomeação do município' },
  { uf: 'SC', key: 'BARRADOSUL', canonical: 'Balneário Barra do Sul', ibge7: 4202057, sources: ['prf'], rule: 'renomeação do município' },
  { uf: 'SC', key: 'LAGEADOGRANDE', canonical: 'Lajeado Grande', ibge7: 4209458, sources: ['senatran'], rule: 'truncamento ou grafia diferente do IBGE' },
  { uf: 'SC', key: 'PICARRAS', canonical: 'Balneário Piçarras', ibge7: 4212809, sources: ['prf'], rule: 'renomeação do município' },
  { uf: 'SC', key: 'PRESIDENTECASTELOBRANCO', canonical: 'Presidente Castello Branco', ibge7: 4213906, sources: ['senatran'], rule: 'truncamento ou grafia diferente do IBGE' },
  { uf: 'SC', key: 'SAOLOURENCODOESTE', canonical: 'São Lourenço do Oeste', ibge7: 4216909, sources: ['senatran'], rule: 'truncamento ou grafia diferente do IBGE' },
  { uf: 'SC', key: 'SAOMIGUELDOESTE', canonical: 'São Miguel do Oeste', ibge7: 4217204, sources: ['senatran', 'prf'], rule: 'truncamento ou grafia diferente do IBGE' },
  { uf: 'SE', key: 'AMPARODESAOFRANCISCO', canonical: 'Amparo do São Francisco', ibge7: 2800100, sources: ['senatran', 'prf'], rule: 'truncamento ou grafia diferente do IBGE' },
  { uf: 'SP', key: 'EMBU', canonical: 'Embu das Artes', ibge7: 3515004, sources: ['senatran', 'prf'], rule: 'renomeação do município' },
  { uf: 'TO', key: 'COUTODEMAGALHAES', canonical: 'Couto Magalhães', ibge7: 1706001, sources: ['senatran'], rule: 'truncamento ou grafia diferente do IBGE' },
  { uf: 'TO', key: 'FORTALEZADOTABOCAO', canonical: 'Tabocão', ibge7: 1708254, sources: ['senatran', 'prf'], rule: 'renomeação do município' },
  { uf: 'TO', key: 'SAOVALERIODANATIVIDADE', canonical: 'São Valério', ibge7: 1720499, sources: ['senatran'], rule: 'renomeação do município' },
];

// ------------------------------------------------------------------------------------------------ SIM
export interface SimTraCategory { code: string; label: string; from: number; to: number }
/** CID-10 capítulo XX, acidentes de transporte (V01–V99). Terrestres = V01–V89 (inclui acidentes fora de via pública); V90–V99 = água, ar e outros. */
export const SIM_TRA_CATEGORIES: SimTraCategory[] = [
  { code: 'PED', label: 'Pedestre', from: 1, to: 9 }, { code: 'CIC', label: 'Ciclista', from: 10, to: 19 }, { code: 'MOT', label: 'Motociclista', from: 20, to: 29 },
  { code: 'TRI', label: 'Ocupante de triciclo motorizado', from: 30, to: 39 }, { code: 'AUT', label: 'Ocupante de automóvel', from: 40, to: 49 }, { code: 'CAM', label: 'Ocupante de camionete', from: 50, to: 59 },
  { code: 'PES', label: 'Ocupante de veículo de transporte pesado', from: 60, to: 69 }, { code: 'ONI', label: 'Ocupante de ônibus', from: 70, to: 79 }, { code: 'OTE', label: 'Outros acidentes de transporte terrestre', from: 80, to: 89 },
];
/** Classifica uma chave do extrator ('V01'…'V99', 'Y850', 'Y85x'). TT = terrestre V01–V89; OUT = V90–V99; SEQ = Y85.0 (sequela, nunca somada ao evento agudo). */
export function classifyTra(k: string): { group: 'TT' | 'OUT' | 'SEQ' | 'OTHERSEQ'; cat?: string } {
  if (k === 'Y850') return { group: 'SEQ' };
  if (k.startsWith('Y85')) return { group: 'OTHERSEQ' };
  const n = Number(k.slice(1, 3));
  if (k[0] !== 'V' || !Number.isInteger(n) || n < 1) throw new Error(`chave CID de trânsito inválida: ${k}`);
  if (n >= 90) return { group: 'OUT' };
  const c = SIM_TRA_CATEGORIES.find(x => n >= x.from && n <= x.to);
  if (!c) throw new Error(`V${n} sem categoria`);
  return { group: 'TT', cat: c.code };
}
export const SIM_TRA_IDS = {
  res: { TT: 4001, AT: 4002, OUT: 4003, SEQ: 4004, cat: Object.fromEntries(SIM_TRA_CATEGORIES.map((c, i) => [c.code, 4011 + i])) as Record<string, number>, taxaTT: 4021, taxaAT: 4022 },
  occ: { TT: 4101, AT: 4102, OUT: 4103, SEQ: 4104, cat: Object.fromEntries(SIM_TRA_CATEGORIES.map((c, i) => [c.code, 4111 + i])) as Record<string, number> },
};
export const SIM_TRA_RES_IDS: number[] = [4001, 4002, 4003, 4004, ...Object.values(SIM_TRA_IDS.res.cat), 4021, 4022];
export const SIM_TRA_OCC_IDS: number[] = [4101, 4102, 4103, 4104, ...Object.values(SIM_TRA_IDS.occ.cat)];

// ------------------------------------------------------------------------------------------------ Senatran frota
/** Colunas de tipo do arquivo "Frota por município e tipo" (nome no arquivo → coluna da tabela exec_tra_frota_mun_mes). */
export const FROTA_COLUMNS: Array<[string, string, string]> = [
  ['AUTOMOVEL', 'automovel', 'Automóvel'], ['BONDE', 'bonde', 'Bonde'], ['CAMINHAO', 'caminhao', 'Caminhão'], ['CAMINHAO TRATOR', 'caminhao_trator', 'Caminhão-trator'], ['CAMINHONETE', 'caminhonete', 'Caminhonete'],
  ['CAMIONETA', 'camioneta', 'Camioneta'], ['CHASSI PLATAF', 'chassi_plataf', 'Chassi-plataforma'], ['CICLOMOTOR', 'ciclomotor', 'Ciclomotor'], ['MICRO-ONIBUS', 'micro_onibus', 'Micro-ônibus'], ['MOTOCICLETA', 'motocicleta', 'Motocicleta'],
  ['MOTONETA', 'motoneta', 'Motoneta'], ['ONIBUS', 'onibus', 'Ônibus'], ['QUADRICICLO', 'quadriciclo', 'Quadriciclo'], ['REBOQUE', 'reboque', 'Reboque'], ['SEMI-REBOQUE', 'semi_reboque', 'Semirreboque'],
  ['SIDE-CAR', 'side_car', 'Side-car'], ['OUTROS', 'outros', 'Outros'], ['TRATOR ESTEI', 'trator_esteira', 'Trator de esteira'], ['TRATOR RODAS', 'trator_rodas', 'Trator de rodas'], ['TRICICLO', 'triciclo', 'Triciclo'], ['UTILITARIO', 'utilitario', 'Utilitário'],
];
export const FROTA_TABLE_COLUMNS = ['total', ...FROTA_COLUMNS.map(c => c[1])];
export const FROTA_IDS = { porMil: 4201, shareMoto: 4202, shareAuto: 4203 };

// ------------------------------------------------------------------------------------------------ RENAEST
export const REN_CORE = { sinistros: 4301, fatais: 4302, obitos: 4303, envolvidos: 4304, feridosIlesos: 4305 } as const;
export const REN_TP_ACIDENTE = ['ACIDENTE PESSOAL DE TRANSITO COM PEDESTRE', 'ATROPELAMENTO COM ANIMAIS', 'ATROPELAMENTO COM PEDESTRE', 'CAPOTAMENTO', 'CHOQUE', 'COLISAO', 'COLISAO FRONTAL', 'COLISAO LATERAL', 'COLISAO TRANSVERSAL', 'COLISAO TRASEIRA', 'DESCONHECIDO', 'ENGAVETAMENTO', 'NAO INFORMADO', 'OUTROS ACIDENTES DE TRANSITO', 'QUEDA', 'TOMBAMENTO'];
export const REN_GRAVIDADE = ['DESCONHECIDO', 'GRAVE', 'LEVE', 'NAO INFORMADO', 'OBITO', 'SEM FERIMENTO'];
export const REN_ENVOLVIDO = ['DESCONHECIDO', 'MOTORISTA', 'NAO INFORMADO', 'OUTRO', 'PASSAGEIROS', 'PEDESTRE'];
export const REN_VEICULO = ['AUTOMOVEL', 'BICICLETA', 'BONDE', 'CAMINHAO', 'CAMINHAO-TRATOR', 'CAMINHONETE', 'CAMIONETA', 'CARRO DE MAO', 'CARROCA', 'CHARRETE', 'CICLO', 'CICLOMOTOR', 'DESCONHECIDO', 'METRO', 'MICRO-ONIBUS', 'MOTOCICLETA', 'MOTONETA', 'MOTORCASA(MOTORHOME)', 'NAO INFORMADO', 'ONIBUS', 'PATINETE/PATINETE ELETRICO', 'QUADRICICLO', 'REBOQUE', 'SEMIRREBOQUE', 'TRAILER', 'TRATOR', 'TREM', 'TREMINHAO', 'TRICICLO', 'TROLEBUS', 'UTILITARIO', 'VEICULO ARTICULADO', 'VEICULO CONJUGADO', 'VEICULO DE SERVICO', 'VEICULO MISTO'];
const base = (b: number, list: string[]) => new Map(list.map((v, i) => [v, b + i]));
export const REN_IDS = { tp: base(4310, REN_TP_ACIDENTE), grav: base(4330, REN_GRAVIDADE), env: base(4340, REN_ENVOLVIDO), veic: base(4350, REN_VEICULO) };
export const REN_ALL_IDS: number[] = [...Object.values(REN_CORE), ...REN_IDS.tp.values(), ...REN_IDS.grav.values(), ...REN_IDS.env.values(), ...REN_IDS.veic.values()];
export const REN_MUN_IDS: number[] = Object.values(REN_CORE);
/** Escopo de reporte por UF × mês (tabela exec_tra_cov). Inferência por dados — não é confirmação da fonte. */
export const COV_SCOPE = { presente: 1, fatais_inferido: 2, sem_registros: 3 } as const;
export const COV_SOURCE = { renaest: 1, prf: 2 } as const;

// ------------------------------------------------------------------------------------------------ PRF
export const PRF_COLS = ['sinistros', 'fatais', 'feridas', 'sem_vitimas', 'class_ign', 'mortos', 'feridos_leves', 'feridos_graves', 'ilesos', 'pessoas', 'veiculos'] as const;
/** Indicadores PRF: mensais (UF) 4601+, anuais (UF e município) 4621+. Mesma ordem em ambos: ver PRF_METRICS. */
export const PRF_METRICS: Array<{ key: string; label: string; unit: string; note?: string }> = [
  { key: 'sinistros', label: 'Sinistros registrados pela PRF', unit: 'sinistros', note: 'A partir de 2016 o arquivo deixa de trazer a maior parte dos sinistros sem vítimas: o total NÃO é comparável entre 2015 e 2016. Use "com vítimas" para séries longas.' },
  { key: 'fatais', label: 'Sinistros com vítimas fatais (PRF)', unit: 'sinistros' }, { key: 'feridas', label: 'Sinistros com vítimas feridas, sem óbito (PRF)', unit: 'sinistros' },
  { key: 'sem_vitimas', label: 'Sinistros sem vítimas (PRF)', unit: 'sinistros', note: 'Cobertura muda em 2016 (ver "sinistros").' },
  { key: 'comVitimas', label: 'Sinistros com vítimas (fatais + feridas) (PRF)', unit: 'sinistros', note: 'Soma das classificações "com vítimas fatais" e "com vítimas feridas": série comparável de 2007 a 2026.' },
  { key: 'mortos', label: 'Mortos em sinistros registrados pela PRF', unit: 'pessoas' }, { key: 'feridos_leves', label: 'Feridos leves (PRF)', unit: 'pessoas' }, { key: 'feridos_graves', label: 'Feridos graves (PRF)', unit: 'pessoas' },
  { key: 'ilesos', label: 'Ilesos (PRF)', unit: 'pessoas' }, { key: 'pessoas', label: 'Pessoas envolvidas (PRF)', unit: 'pessoas' }, { key: 'veiculos', label: 'Veículos envolvidos (PRF)', unit: 'veículos', note: 'Veículos envolvidos NÃO são sinistros.' },
];
export const PRF_MONTHLY_IDS = PRF_METRICS.map((_, i) => 4601 + i);
export const PRF_ANNUAL_IDS = PRF_METRICS.map((_, i) => 4621 + i);
export const PRF_ALL_IDS = [...PRF_MONTHLY_IDS, ...PRF_ANNUAL_IDS];

// ------------------------------------------------------------------------------------------------ Infrações
export const INFR_IDS = { total: 4701 };

// ------------------------------------------------------------------------------------------------ definições (exec_ind_def)
export type TraDef = { id: number; code: string; label: string; unit: string; grain: 'M' | 'A'; sort: number; numerator: string; denominator: string; minDenominator?: number; family: 'SIM' | 'FROTA' | 'RENAEST' | 'PRF' | 'INFR'; granularity: 'municipio' | 'uf'; perspective?: 'residencia' | 'ocorrencia'; definition: string; comparability: string; note: string };

const UNIV = {
  SIM: 'SIM mede óbitos (declaração de óbito) por causa básica CID-10; não é o RENAEST nem a PRF e não pode ser somado a eles.',
  FROTA: 'Frota REGISTRADA (Renavam) no município, não a frota em circulação nele.',
  RENAEST: 'RENAEST: sinistros reportados pelos órgãos participantes; a cobertura varia por UF e mês (ver exec_tra_cov). Ausência de registro NÃO é zero.',
  PRF: 'PRF: sinistros registrados em rodovias federais — não são "todos os acidentes do município".',
  INFR: 'Notificações de penalidade por UF de JURISDIÇÃO do veículo; não representam infrações cometidas na UF.',
};
function defs(): TraDef[] {
  const out: TraDef[] = [];
  const cmpSim = 'Entre municípios: mesmo CID, perspectiva, ano e denominador. Não somar a RENAEST/PRF. Sequelas (Y85.0) ficam fora do evento agudo.';
  const sim = (id: number, persp: 'residencia' | 'ocorrencia', key: string, label: string, def: string) => out.push({ id, code: `IND-TRA-SIM-${key}-${persp === 'residencia' ? 'RES' : 'OCO'}`, label: `${label} — ${persp === 'residencia' ? 'por município de residência' : 'por município de ocorrência'}`, unit: 'óbitos', grain: 'A', sort: id, numerator: def, denominator: 'não se aplica (contagem)',
    family: 'SIM', granularity: 'municipio', perspective: persp, definition: def, comparability: cmpSim, note: `${UNIV.SIM} Perspectiva: ${persp === 'residencia' ? 'município de residência do falecido' : 'município de ocorrência do óbito (reunião dos 27 arquivos de residência; exclui residentes no exterior — arquivo DOEX não preservado)'}. Ano do óbito = ano do arquivo; 2025 é preliminar.` });
  for (const p of ['residencia', 'ocorrencia'] as const) {
    const ids = p === 'residencia' ? SIM_TRA_IDS.res : SIM_TRA_IDS.occ;
    sim(ids.TT, p, 'TT', 'Mortes em acidentes de transporte terrestre (SIM)', 'CID-10 V01–V89 (acidentes de transporte terrestre; inclui os ocorridos fora de via pública)');
    sim(ids.AT, p, 'AT', 'Mortes em acidentes de transporte, total (SIM)', 'CID-10 V01–V99 (terrestre + água + ar + outros); soma de V01–V89 e V90–V99, sem sequelas');
    sim(ids.OUT, p, 'OUT', 'Mortes em outros acidentes de transporte — água, ar e demais (SIM)', 'CID-10 V90–V99');
    sim(ids.SEQ, p, 'SEQ', 'Mortes por sequelas de acidente com veículo a motor (SIM)', 'CID-10 Y85.0 — sequela; NUNCA somada às mortes por evento agudo');
    for (const c of SIM_TRA_CATEGORIES) sim(ids.cat[c.code]!, p, `CAT-${c.code}`, `Mortes — ${c.label} (SIM)`, `CID-10 V${String(c.from).padStart(2, '0')}–V${String(c.to).padStart(2, '0')}`);
  }
  const rate = (id: number, key: string, label: string, numd: string) => out.push({ id, code: `IND-TRA-SIM-${key}-TAXA`, label, unit: 'por 100 mil habitantes', grain: 'A', sort: id, numerator: numd, denominator: 'população residente estimada do ano (IBGE, SIDRA 6579)', minDenominator: 20000,
    family: 'SIM', granularity: 'municipio', perspective: 'residencia', definition: `${numd} ÷ população × 100 mil`, comparability: `${cmpSim} Sem estimativa oficial carregada em 2022 e 2023: taxa não calculada. Municípios com menos de 20 mil habitantes levam sinal de pequeno número.`, note: `${UNIV.SIM} Denominador do mesmo ano; sem interpolação.` });
  rate(4021, 'TT', 'Taxa de mortes em acidentes de transporte terrestre (SIM, residência)', 'mortes V01–V89 por residência');
  rate(4022, 'AT', 'Taxa de mortes em acidentes de transporte (SIM, residência)', 'mortes V01–V99 por residência');
  out.push({ id: 4201, code: 'IND-TRA-FROTA-1000', label: 'Veículos registrados por 1.000 habitantes', unit: 'veículos/1.000 hab.', grain: 'M', sort: 4201, numerator: 'frota registrada total (Senatran, município e tipo)', denominator: 'população residente estimada do ano (IBGE)', minDenominator: 0, family: 'FROTA', granularity: 'municipio',
    definition: 'frota total ÷ população × 1.000 nos instantâneos de dezembro e no último mês publicado', comparability: 'Mesma competência. Frota registrada ≠ frota circulante; municípios-sede de locadoras e de frotas empresariais têm razão inflada. Sem taxa em 2022 e 2023 (sem população oficial).', note: UNIV.FROTA });
  out.push({ id: 4202, code: 'IND-TRA-FROTA-MOTO', label: 'Participação de motocicletas e motonetas na frota registrada', unit: '% da frota', grain: 'M', sort: 4202, numerator: 'motocicleta + motoneta', denominator: 'frota registrada total do mesmo mês', family: 'FROTA', granularity: 'municipio', definition: '(MOTOCICLETA + MOTONETA) ÷ TOTAL', comparability: 'Mesma competência; ciclomotor e side-car não entram.', note: UNIV.FROTA });
  out.push({ id: 4203, code: 'IND-TRA-FROTA-AUTO', label: 'Participação de automóveis na frota registrada', unit: '% da frota', grain: 'M', sort: 4203, numerator: 'automóvel', denominator: 'frota registrada total do mesmo mês', family: 'FROTA', granularity: 'municipio', definition: 'AUTOMOVEL ÷ TOTAL', comparability: 'Mesma competência; camioneta, caminhonete e utilitário são categorias separadas.', note: UNIV.FROTA });
  const ren = (id: number, key: string, label: string, unit: string, def: string, gran: 'municipio' | 'uf', note = '') => out.push({ id, code: `IND-TRA-REN-${key}`, label, unit, grain: 'M', sort: id, numerator: def, denominator: 'não se aplica (contagem)', family: 'RENAEST', granularity: gran, definition: def, comparability: 'Condicional: só entre UF/meses com cobertura e escopo comprovados (exec_tra_cov). Não somar à PRF nem ao SIM; sem ranking nacional de sinistros totais.', note: `${UNIV.RENAEST} ${note}`.trim() });
  ren(4301, 'SIN', 'Sinistros reportados (RENAEST)', 'sinistros', 'uma linha da tabela Acidentes = um sinistro (num_acidente único)', 'municipio');
  ren(4302, 'SIN-FATAL', 'Sinistros com óbito (RENAEST)', 'sinistros', 'qtde_acid_com_obitos', 'municipio');
  ren(4303, 'OBITOS', 'Óbitos em sinistros (RENAEST)', 'pessoas', 'Σ qtde_obitos dos sinistros', 'municipio', 'Janela de óbito e local diferem do SIM: não comparar com o SIM.');
  ren(4304, 'ENVOLVIDOS', 'Pessoas envolvidas em sinistros (RENAEST)', 'pessoas', 'Σ qtde_envolvidos', 'municipio');
  ren(4305, 'FERIDOS-ILESOS', 'Pessoas feridas ou ilesas em sinistros (RENAEST)', 'pessoas', 'Σ qtde_feridosilesos — a fonte não separa feridos de ilesos neste campo', 'municipio', 'Não é "feridos".');
  const dim = (m: Map<string, number>, key: string, what: string, unit: string, valueNote: string) => { for (const [v, id] of m) ren(id, `${key}-${compactKey(v)}`, `${what}: ${v.toLowerCase()} (RENAEST)`, unit, `${what} = "${v}"`, 'uf', valueNote); };
  dim(REN_IDS.tp, 'TP', 'Sinistros por tipo', 'sinistros', 'Somente UF. Tipo conforme a fonte; "DESCONHECIDO" e "NAO INFORMADO" são grandes e não são zero.');
  dim(REN_IDS.grav, 'GRAV', 'Pessoas envolvidas por gravidade da lesão', 'pessoas', 'Somente UF. Ponderado por qtde_envolvidos (tabela Vitimas).');
  dim(REN_IDS.env, 'ENV', 'Pessoas envolvidas por tipo de envolvido', 'pessoas', 'Somente UF. Ponderado por qtde_envolvidos (tabela Vitimas).');
  dim(REN_IDS.veic, 'VEIC', 'Veículos envolvidos por tipo', 'veículos', 'Somente UF. Σ qtde_veiculos (tabela TipoVeiculo); veículos NÃO são sinistros. Cerca de 2 % das linhas não se ligam a um sinistro da tabela Acidentes.');
  const prf = (monthly: boolean) => PRF_METRICS.forEach((m, i) => { const id = (monthly ? 4601 : 4621) + i; out.push({ id, code: `IND-TRA-PRF-${monthly ? 'M' : 'A'}-${m.key.toUpperCase().replace(/_/g, '-')}`, label: `${m.label}${monthly ? ' — mensal, UF' : ' — anual'}`, unit: m.unit, grain: monthly ? 'M' : 'A', sort: id, numerator: m.label, denominator: 'não se aplica (contagem)', family: 'PRF',
    granularity: monthly ? 'uf' : 'municipio', definition: `${m.label} (agrupados por ocorrência)`, comparability: `Somente rodovias federais. Não somar ao RENAEST. ${m.note ?? ''}`.trim(), note: `${UNIV.PRF} 1 linha do arquivo = 1 sinistro (id repetida é contada uma vez). Município por NOME (crosswalk ${TRA_VERSION.crosswalk}); nome sem correspondência vai ao município ignorado da UF.${monthly ? '' : ' Série municipal anual.'}` }); });
  prf(true); prf(false);
  out.push({ id: 4701, code: 'IND-TRA-INF-NP', label: 'Infrações com notificação de penalidade (por UF de jurisdição do veículo)', unit: 'notificações', grain: 'M', sort: 4701, numerator: 'Σ Qt Infração c/ NP de todos os códigos RENAINF', denominator: 'não se aplica (contagem)', family: 'INFR', granularity: 'uf',
    definition: 'notificações de penalidade emitidas no mês, pela UF de jurisdição do veículo', comparability: 'UF de jurisdição do veículo ≠ local da infração. Comparação entre UFs reflete frota e fiscalização, não violações locais.', note: UNIV.INFR });
  return out;
}
export const TRA_DEFS: TraDef[] = defs();
export const TRA_DEF_BY_ID = new Map(TRA_DEFS.map(d => [d.id, d]));

export async function seedTransitoDefs(pool: Pool, list: TraDef[] = TRA_DEFS): Promise<number> {
  for (const d of list) {
    await pool.query(`INSERT INTO civica_exec.exec_ind_def (indicator_id, code, method_version, domain, sort_order, label, unit, grain, numerator_desc, denominator_desc, min_denominator, ranking_allowed, aggregation_allowed, null_semantics, methodology_note)
      VALUES ($1,$2,1,$3,$4,$5,$6,$7,$8,$9,$10,false,false,$11,$12)
      ON CONFLICT (indicator_id) DO UPDATE SET label = EXCLUDED.label, unit = EXCLUDED.unit, numerator_desc = EXCLUDED.numerator_desc, denominator_desc = EXCLUDED.denominator_desc, min_denominator = EXCLUDED.min_denominator, null_semantics = EXCLUDED.null_semantics, methodology_note = EXCLUDED.methodology_note`,
      [d.id, d.code, DOMAIN.seguranca, d.sort, d.label, d.unit, d.grain, d.numerator, d.denominator, d.minDenominator ?? null,
        d.family === 'RENAEST' ? 'RENAEST: ausência de linha ≠ zero; ver exec_tra_cov (sem registros, escopo restrito a fatais, mês não publicado)' : d.family === 'PRF' ? 'PRF: UF × mês dentro do período do arquivo tem linha (zero = nenhum sinistro registrado pela PRF); município sem linha no ano = nenhum sinistro registrado pela PRF naquele município' : d.family === 'SIM' ? 'SIM: totais e município do universo com zero explícito; categorias nonzero — fatia publicada sem linha = zero' : 'sem linha = mês não publicado ou município inexistente na competência',
        `${d.note} Definição: ${d.definition}. Comparabilidade: ${d.comparability}`]);
  }
  return list.length;
}
