import type { Pool } from 'pg';
import { DOMAIN } from './indicator-defs.ts';

/**
 * Contratos semânticos da criminalidade nacional (P9.1). Nada aqui equipara SIM e VDE: são conceitos distintos, com indicadores distintos.
 *  - SIM: óbitos (declarações de óbito não fetais) classificados pela causa básica CID-10; residência e ocorrência são perspectivas separadas.
 *  - VDE: dados informados pelas secretarias/forças ao Sinesp; vítimas, ocorrências/quantidades e peso são medidas diferentes.
 */
/** sim = versão do contrato publicado (muda o hash da fatia); simExtract = versão do extrator DBC → agregados (chave do cache de staging). */
export const SEG_VERSION = { sim: 'sim-seg-v2', simExtract: 'sim-seg-v1', vde: 'vde-seg-v1', crosswalk: 'vde-xw-v1' } as const;

/** Grupos de causa básica (CID-10, 3 primeiros caracteres). Y87.1/Y87.2 (sequelas) e Y85.0 (trânsito) ficam fora. */
export type CidGroup = 'AGR' | 'IND' | 'INT' | 'GUE';
export function classifyCid(causabas: string | null | undefined): CidGroup | null {
  const c = String(causabas ?? '').trim().toUpperCase();
  if (c.length < 3) return null;
  const letter = c[0], n = Number(c.slice(1, 3));
  if (!Number.isInteger(n) || !/^\d\d$/.test(c.slice(1, 3))) return null;
  if (letter === 'X' && n >= 85 && n <= 99) return 'AGR';
  if (letter === 'Y' && n >= 0 && n <= 9) return 'AGR';
  if (letter === 'Y' && n >= 10 && n <= 34) return 'IND';
  if (letter === 'Y' && n === 35) return 'INT';
  if (letter === 'Y' && n === 36) return 'GUE';
  return null;
}

export type SegDef = {
  id: number; code: string; label: string; unit: string; grain: 'M' | 'A'; sort: number; numerator: string; denominator: string; minDenominator?: number;
  source: 'SIM' | 'VDE'; granularity: 'municipio' | 'uf'; perspective?: 'residencia' | 'ocorrencia'; definition: string; comparability: string; note: string;
};

const SIM_NOTE = 'Óbitos não fetais (TIPOBITO = 2) da Declaração de Óbito, por causa básica CID-10. É mortalidade, não é o crime de homicídio doloso registrado pela polícia (VDE): as séries NÃO são equivalentes. Os grupos não são somados entre si, exceto no recorte Atlas declarado.';
const SIM_CMP = 'Entre UFs, interpretar sempre com a proporção de mortes por causa indeterminada (Y10–Y34): UFs com muitas indeterminadas subestimam as agressões. Não redistribuir indeterminadas.';
const simDef = (id: number, persp: 'residencia' | 'ocorrencia', key: string, label: string, def: string, sort: number): SegDef => ({
  id, code: `IND-SEG-SIM-${key}-${persp === 'residencia' ? 'RES' : 'OCO'}`, label: `${label} — ${persp === 'residencia' ? 'por município de residência' : 'por município de ocorrência'}`, unit: 'óbitos', grain: 'A', sort,
  numerator: def, denominator: 'não se aplica (contagem)', source: 'SIM', granularity: 'municipio', perspective: persp, definition: def, comparability: SIM_CMP,
  note: `${SIM_NOTE} Perspectiva: ${persp === 'residencia' ? 'município de residência do falecido (arquivos DORES da UF de residência)' : 'município de ocorrência do óbito, reunindo os 27 arquivos de residência; exclui óbitos de residentes no exterior (arquivo DOEX não preservado)'}. Ano do óbito = ano do arquivo. Município ignorado (código xx0000) vai ao "município ignorado da UF"; 2025 é preliminar.`,
});
const D_AGR = 'CID-10 X85–Y09 (agressões)', D_INT = 'CID-10 Y35 (intervenção legal)', D_GUE = 'CID-10 Y36 (operações de guerra)', D_IND = 'CID-10 Y10–Y34 (eventos cuja intenção é indeterminada)';
const D_ATLAS = 'X85–Y09 + Y35: agressões e intervenção legal, o recorte que reconcilia com o Atlas da Violência (324 pares UF × ano idênticos; o único óbito Y36 do período, MG 2022, é a única diferença e fica de fora). Não equivale a homicídio doloso.';

export const SIM_DEFS: SegDef[] = [
  simDef(3001, 'residencia', 'AGR', 'Mortes por agressão (SIM)', D_AGR, 3001), simDef(3002, 'residencia', 'INT', 'Mortes por intervenção legal (SIM)', D_INT, 3002),
  simDef(3003, 'residencia', 'GUE', 'Mortes por operações de guerra (SIM)', D_GUE, 3003), simDef(3004, 'residencia', 'IND', 'Mortes de intenção indeterminada (SIM)', D_IND, 3004),
  simDef(3005, 'residencia', 'ATL', 'Mortes por agressão e intervenção legal (recorte Atlas, SIM)', D_ATLAS, 3005),
  simDef(3011, 'ocorrencia', 'AGR', 'Mortes por agressão (SIM)', D_AGR, 3011), simDef(3012, 'ocorrencia', 'INT', 'Mortes por intervenção legal (SIM)', D_INT, 3012),
  simDef(3013, 'ocorrencia', 'GUE', 'Mortes por operações de guerra (SIM)', D_GUE, 3013), simDef(3014, 'ocorrencia', 'IND', 'Mortes de intenção indeterminada (SIM)', D_IND, 3014),
  simDef(3015, 'ocorrencia', 'ATL', 'Mortes por agressão e intervenção legal (recorte Atlas, SIM)', D_ATLAS, 3015),
  { id: 3006, code: 'IND-SEG-SIM-AGR-TAXA', label: 'Taxa de mortes por agressão (SIM, residência)', unit: 'por 100 mil habitantes', grain: 'A', sort: 3006, numerator: 'mortes por agressão (X85–Y09) por residência', denominator: 'população residente estimada do ano (IBGE, SIDRA 6579)', minDenominator: 20000,
    source: 'SIM', granularity: 'municipio', perspective: 'residencia', definition: 'mortes por agressão ÷ população × 100 mil', comparability: SIM_CMP + ' Sem estimativa oficial carregada em 2022 e 2023: a taxa não é calculada nesses anos. Municípios com menos de 20 mil habitantes levam o sinal de pequeno número.', note: `${SIM_NOTE} Denominador do mesmo ano; sem interpolação.` },
  { id: 3007, code: 'IND-SEG-SIM-ATL-TAXA', label: 'Taxa de mortes por agressão e intervenção legal (recorte Atlas, SIM, residência)', unit: 'por 100 mil habitantes', grain: 'A', sort: 3007, numerator: D_ATLAS, denominator: 'população residente estimada do ano (IBGE, SIDRA 6579)', minDenominator: 20000,
    source: 'SIM', granularity: 'municipio', perspective: 'residencia', definition: '(X85–Y09 + Y35) ÷ população × 100 mil', comparability: SIM_CMP + ' Sem estimativa oficial carregada em 2022 e 2023.', note: `${SIM_NOTE} Reconciliável com o Atlas da Violência (ES 2023 = 1.161; ES 2024 = 1.064 óbitos). Y36 (operações de guerra) permanece em indicador próprio.` },
  { id: 3008, code: 'IND-SEG-SIM-IND-PROP', label: 'Proporção de mortes violentas com intenção indeterminada (SIM, residência)', unit: '% das mortes violentas', grain: 'A', sort: 3008, numerator: 'Y10–Y34', denominator: 'X85–Y09 + Y10–Y34 + Y35 + Y36', minDenominator: 10,
    source: 'SIM', granularity: 'municipio', perspective: 'residencia', definition: 'indeterminadas ÷ (agressões + indeterminadas + intervenções legais + operações de guerra)', comparability: 'Indicador de qualidade da informação, não de violência. Não reclassifica as indeterminadas como homicídios.', note: `${SIM_NOTE} Só calculada com ao menos 10 mortes violentas no denominador.` },
];

/** Eventos do Sinesp VDE. measure: coluna do XLSX que carrega o valor (vit = total_vitima, tot = total, peso = total_peso). */
type VdeEvent = { slug: string; native: string; measure: 'vit' | 'tot' | 'peso'; level: 'M' | 'U'; abr: Partial<Record<'E' | 'F' | 'R', number>>; unit: string; rate?: number; label: string; note?: string };
const ABR_LABEL = { E: 'Estadual', F: 'Polícia Federal', R: 'Polícia Rodoviária Federal' } as const;
const ABR_NATIVE: Record<string, 'E' | 'F' | 'R'> = { 'Estadual': 'E', 'Polícia Federal': 'F', 'Polícia Rodoviária Federal': 'R' };
export const abrangenciaKey = (native: string): 'E' | 'F' | 'R' | null => ABR_NATIVE[native] ?? null;

export const VDE_EVENTS: VdeEvent[] = [
  // ----- com município na fonte
  { slug: 'homicidio-doloso', native: 'Homicídio doloso', measure: 'vit', level: 'M', abr: { E: 3101 }, unit: 'vítimas', rate: 3201, label: 'Homicídio doloso' },
  { slug: 'tentativa-homicidio', native: 'Tentativa de homicídio', measure: 'vit', level: 'M', abr: { E: 3102 }, unit: 'vítimas', rate: 3202, label: 'Tentativa de homicídio' },
  { slug: 'latrocinio', native: 'Roubo seguido de morte (latrocínio)', measure: 'vit', level: 'M', abr: { E: 3103 }, unit: 'vítimas', rate: 3203, label: 'Roubo seguido de morte (latrocínio)' },
  { slug: 'lesao-corporal-morte', native: 'Lesão corporal seguida de morte', measure: 'vit', level: 'M', abr: { E: 3104 }, unit: 'vítimas', rate: 3204, label: 'Lesão corporal seguida de morte' },
  { slug: 'feminicidio', native: 'Feminicídio', measure: 'vit', level: 'M', abr: { E: 3105 }, unit: 'vítimas', label: 'Feminicídio', note: 'Taxa por 100 mil mulheres exige população feminina compatível (não carregada): sem taxa nesta etapa.' },
  { slug: 'tentativa-feminicidio', native: 'Tentativa de feminicídio', measure: 'vit', level: 'M', abr: { E: 3106 }, unit: 'vítimas', label: 'Tentativa de feminicídio' },
  { slug: 'suicidio', native: 'Suicídio', measure: 'vit', level: 'M', abr: { E: 3107 }, unit: 'vítimas', rate: 3205, label: 'Suicídio' },
  { slug: 'mortes-a-esclarecer', native: 'Mortes a esclarecer (sem indício de crime)', measure: 'vit', level: 'M', abr: { E: 3108 }, unit: 'vítimas', label: 'Mortes a esclarecer (sem indício de crime)' },
  { slug: 'morte-transito-exceto-hd', native: 'Morte no trânsito ou em decorrência dele (exceto homicídio doloso)', measure: 'vit', level: 'M', abr: { E: 3109 }, unit: 'vítimas', rate: 3206, label: 'Morte no trânsito ou em decorrência dele (exceto homicídio doloso)', note: 'Base policial estadual; diferente de "Mortes no trânsito" (rodovias federais) e do SIM (V01–V99): não somar.' },
  { slug: 'mortes-transito-rodovia-federal', native: 'Mortes no trânsito', measure: 'vit', level: 'M', abr: { F: 3110, R: 3111 }, unit: 'vítimas', label: 'Mortes no trânsito em rodovias federais', note: 'Somente rodovias federais (PRF) e eventos da PF; não é o total de mortes no trânsito.' },
  { slug: 'mandado-prisao', native: 'Mandado de prisão cumprido', measure: 'tot', level: 'M', abr: { E: 3112, F: 3113 }, unit: 'mandados cumpridos', label: 'Mandado de prisão cumprido' },
  // ----- somente UF
  { slug: 'estupro', native: 'Estupro', measure: 'vit', level: 'U', abr: { E: 3114 }, unit: 'vítimas', rate: 3207, label: 'Estupro', note: 'Registro policial de vítimas; subnotificação elevada e variável entre UFs.' },
  { slug: 'estupro-vulneravel', native: 'Estupro de vulnerável', measure: 'vit', level: 'U', abr: { E: 3115 }, unit: 'vítimas', rate: 3208, label: 'Estupro de vulnerável', note: 'Registro policial de vítimas; subnotificação elevada e variável entre UFs.' },
  { slug: 'trafico-drogas', native: 'Tráfico de drogas', measure: 'tot', level: 'U', abr: { E: 3116, F: 3117 }, unit: 'ocorrências', label: 'Tráfico de drogas', note: 'Reflete a atividade policial tanto quanto o fenômeno.' },
  { slug: 'furto-veiculo', native: 'Furto de veículo', measure: 'tot', level: 'U', abr: { E: 3118 }, unit: 'ocorrências', label: 'Furto de veículo' },
  { slug: 'roubo-veiculo', native: 'Roubo de veículo', measure: 'tot', level: 'U', abr: { E: 3119 }, unit: 'ocorrências', label: 'Roubo de veículo' },
  { slug: 'roubo-carga', native: 'Roubo de carga', measure: 'tot', level: 'U', abr: { E: 3120 }, unit: 'ocorrências', label: 'Roubo de carga' },
  { slug: 'roubo-instituicao-financeira', native: 'Roubo a instituição financeira', measure: 'tot', level: 'U', abr: { E: 3121 }, unit: 'ocorrências', label: 'Roubo a instituição financeira' },
  { slug: 'arma-fogo-apreendida', native: 'Arma de Fogo Apreendida', measure: 'tot', level: 'U', abr: { E: 3122, F: 3123 }, unit: 'armas', label: 'Arma de fogo apreendida', note: 'Soma de todos os tipos de arma informados.' },
  { slug: 'apreensao-cocaina', native: 'Apreensão de Cocaína', measure: 'peso', level: 'U', abr: { E: 3124, F: 3125 }, unit: 'peso informado (unidade do arquivo)', label: 'Apreensão de cocaína (peso)', note: 'A medida é total_peso; total (quantidade) vem zerado na fonte. A unidade de peso não é declarada no arquivo.' },
  { slug: 'apreensao-maconha', native: 'Apreensão de Maconha', measure: 'peso', level: 'U', abr: { E: 3126, F: 3127 }, unit: 'peso informado (unidade do arquivo)', label: 'Apreensão de maconha (peso)', note: 'A medida é total_peso; total (quantidade) vem zerado na fonte. A unidade de peso não é declarada no arquivo.' },
  { slug: 'morte-agente-estado', native: 'Morte de Agente do Estado', measure: 'vit', level: 'U', abr: { E: 3128, F: 3129 }, unit: 'vítimas', label: 'Morte de agente do Estado', note: 'Soma de todas as corporações informadas (agente).' },
  { slug: 'suicidio-agente-estado', native: 'Suicídio de Agente do Estado', measure: 'vit', level: 'U', abr: { E: 3130, F: 3131 }, unit: 'vítimas', label: 'Suicídio de agente do Estado', note: 'Soma de todas as corporações informadas (agente).' },
  { slug: 'morte-intervencao-agente-estado', native: 'Morte por intervenção de Agente do Estado', measure: 'vit', level: 'U', abr: { E: 3132, F: 3133, R: 3134 }, unit: 'vítimas', label: 'Morte por intervenção de agente do Estado', note: 'Registro informado pelas forças; difere de "intervenção legal" (CID Y35) do SIM.' },
  { slug: 'pessoa-desaparecida', native: 'Pessoa Desaparecida', measure: 'vit', level: 'U', abr: { E: 3135 }, unit: 'pessoas', label: 'Pessoa desaparecida', note: 'Soma das faixas etárias.' },
  { slug: 'pessoa-localizada', native: 'Pessoa Localizada', measure: 'vit', level: 'U', abr: { E: 3136 }, unit: 'pessoas', label: 'Pessoa localizada', note: 'Soma das faixas etárias; não corresponde necessariamente às desaparecidas do mesmo período.' },
  { slug: 'atendimento-pre-hospitalar', native: 'Atendimento pré-hospitalar', measure: 'tot', level: 'U', abr: { E: 3137 }, unit: 'atendimentos', label: 'Atendimento pré-hospitalar (bombeiros)' },
  { slug: 'busca-salvamento', native: 'Busca e salvamento', measure: 'tot', level: 'U', abr: { E: 3138 }, unit: 'ocorrências', label: 'Busca e salvamento (bombeiros)' },
  { slug: 'combate-incendios', native: 'Combate a incêndios', measure: 'tot', level: 'U', abr: { E: 3139 }, unit: 'ocorrências', label: 'Combate a incêndios (bombeiros)' },
  { slug: 'alvaras-licenca', native: 'Emissão de Alvarás de licença', measure: 'tot', level: 'U', abr: { E: 3140 }, unit: 'alvarás', label: 'Emissão de alvarás de licença (bombeiros)' },
  { slug: 'vistorias', native: 'Realização de vistorias', measure: 'tot', level: 'U', abr: { E: 3141 }, unit: 'vistorias', label: 'Realização de vistorias (bombeiros)' },
];
/** Combinações evento × abrangência que são zero em todos os anos 2015–2026 (zero estrutural: a fonte não as informa). Não viram indicador. */
export const VDE_STRUCTURAL_ZERO: Array<[string, string]> = [
  ['Furto de veículo', 'Polícia Federal'], ['Roubo de veículo', 'Polícia Federal'], ['Roubo de carga', 'Polícia Federal'], ['Roubo a instituição financeira', 'Polícia Federal'],
  ['Morte de Agente do Estado', 'Polícia Rodoviária Federal'], ['Suicídio de Agente do Estado', 'Polícia Rodoviária Federal'],
];
export const VDE_BY_NATIVE = new Map(VDE_EVENTS.map(e => [e.native, e]));
export const vdeIndicatorId = (native: string, abrNative: string): number | null => {
  const e = VDE_BY_NATIVE.get(native); const a = abrangenciaKey(abrNative); return e && a ? (e.abr[a] ?? null) : null;
};
export const isStructuralZero = (native: string, abrNative: string): boolean => VDE_STRUCTURAL_ZERO.some(([e, a]) => e === native && a === abrNative);

const VDE_SRC = 'Sinesp VDE (MJSP/SENASP): dados informados pelas secretarias estaduais, PF e PRF. Registro policial, não condenação nem crime judicialmente comprovado. Vítimas, ocorrências e peso são medidas distintas. Sem código IBGE na fonte: município identificado por UF + nome (crosswalk vde-xw-v1).';
const VDE_CMP = 'A comparação entre UFs depende de práticas de registro e de reporte diferentes; mês zerado em toda a UF pode ser zero reportado ou ausência de relato (a fonte não distingue; ver cobertura). Anos iniciais (2015–2017) têm UFs sem relato.';
function vdeDefs(): SegDef[] {
  const out: SegDef[] = []; let sort = 3100;
  for (const e of VDE_EVENTS) for (const [k, id] of Object.entries(e.abr) as Array<['E' | 'F' | 'R', number]>) {
    out.push({ id, code: `IND-SEG-VDE-${e.slug.toUpperCase()}-${k}`, label: `${e.label} — ${ABR_LABEL[k]}`, unit: e.unit, grain: 'M', sort: sort++, numerator: `${e.measure === 'vit' ? 'total_vitima' : e.measure === 'tot' ? 'total' : 'total_peso'} do evento "${e.native}" (abrangência ${ABR_LABEL[k]})`,
      denominator: 'não se aplica (contagem)', source: 'VDE', granularity: e.level === 'M' ? 'municipio' : 'uf', definition: `Evento nativo "${e.native}"; abrangência ${ABR_LABEL[k]}.`, comparability: VDE_CMP,
      note: `${VDE_SRC}${e.level === 'M' ? ' Município no arquivo; linhas sem município ("NÃO INFORMADO") vão ao município ignorado da UF.' : ' Somente UF: o arquivo não traz município para este evento e nada foi distribuído por município.'}${e.note ? ` ${e.note}` : ''}` });
  }
  for (const e of VDE_EVENTS) if (e.rate) out.push({ id: e.rate, code: `IND-SEG-VDE-${e.slug.toUpperCase()}-TAXA`, label: `${e.label}: taxa anual (VDE, Estadual)`, unit: 'por 100 mil habitantes', grain: 'A', sort: sort++,
    numerator: `Σ mensal de ${e.native} (Estadual) no ano civil completo`, denominator: 'população residente estimada do ano (IBGE, SIDRA 6579)', minDenominator: 20000, source: 'VDE', granularity: e.level === 'M' ? 'municipio' : 'uf',
    definition: `${e.native} ÷ população × 100 mil, ano civil completo`, comparability: `${VDE_CMP} Sem estimativa oficial carregada em 2022 e 2023: taxa não calculada. Anos parciais (corrente) não têm taxa.`, note: `${VDE_SRC} Município só recebe taxa se houve registro (zero é derivável pela cobertura).` });
  return out;
}
export const VDE_DEFS: SegDef[] = vdeDefs();
export const SEG_DEFS: SegDef[] = [...SIM_DEFS, ...VDE_DEFS];
export const SEG_DEF_BY_ID = new Map(SEG_DEFS.map(d => [d.id, d]));
export const VDE_RATE_EVENTS = VDE_EVENTS.filter(e => e.rate);

/** Normalização determinística de nomes municipais (maiúsculas, sem acento nem pontuação, espaços únicos). Idempotente. */
export function normalizeName(s: string): string {
  return String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}
/** Aliases validados manualmente contra a lista oficial do IBGE (conferência de 21/10/2026, todas as 27 UFs; 6 grafias divergentes). */
export const VDE_ALIASES: Array<{ uf: string; source: string; canonical: string; ibge7: number; rule: string; evidence: string; validated: string }> = [
  { uf: 'MG', source: 'BARÃO DE MONTE ALTO', canonical: 'Barão do Monte Alto', ibge7: 3105509, rule: 'preposição diferente', evidence: 'IBGE localidades: Barão do Monte Alto/MG', validated: '2026-10-21' },
  { uf: 'MT', source: 'SANTO ANTÔNIO DO LEVERGER', canonical: 'Santo Antônio de Leverger', ibge7: 5107800, rule: 'preposição diferente', evidence: 'IBGE localidades: Santo Antônio de Leverger/MT', validated: '2026-10-21' },
  { uf: 'RN', source: 'ARÊS', canonical: 'Arez', ibge7: 2401206, rule: 'grafia histórica', evidence: 'IBGE localidades: Arez/RN', validated: '2026-10-21' },
  { uf: 'RN', source: 'AÇU', canonical: 'Assú', ibge7: 2400208, rule: 'grafia histórica', evidence: 'IBGE localidades: Assú/RN', validated: '2026-10-21' },
  { uf: 'RR', source: 'SÃO LUIZ', canonical: 'São Luiz do Anauá', ibge7: 1400605, rule: 'nome abreviado', evidence: 'IBGE localidades: São Luiz do Anauá/RR (único "São Luiz" de RR)', validated: '2026-10-21' },
  { uf: 'SE', source: 'GRACHO CARDOSO', canonical: 'Graccho Cardoso', ibge7: 2802601, rule: 'grafia divergente (CC)', evidence: 'IBGE localidades: Graccho Cardoso/SE', validated: '2026-10-21' },
];
export const VDE_UNASSIGNED_NAME = 'NÃO INFORMADO';

export async function seedSegurancaDefs(pool: Pool, defs: SegDef[] = SEG_DEFS): Promise<number> {
  for (const d of defs) {
    await pool.query(`INSERT INTO civica_exec.exec_ind_def (indicator_id, code, method_version, domain, sort_order, label, unit, grain, numerator_desc, denominator_desc, min_denominator, ranking_allowed, aggregation_allowed, null_semantics, methodology_note)
      VALUES ($1,$2,1,$3,$4,$5,$6,$7,$8,$9,$10,false,false,$11,$12)
      ON CONFLICT (indicator_id) DO UPDATE SET label = EXCLUDED.label, unit = EXCLUDED.unit, numerator_desc = EXCLUDED.numerator_desc, denominator_desc = EXCLUDED.denominator_desc, min_denominator = EXCLUDED.min_denominator, null_semantics = EXCLUDED.null_semantics, methodology_note = EXCLUDED.methodology_note`,
      [d.id, d.code, DOMAIN.seguranca, d.sort, d.label, d.unit, d.grain, d.numerator, d.denominator, d.minDenominator ?? null,
        d.source === 'SIM' ? 'SIM: todo município do universo (kind 4 vigente) tem linha com zero explícito; sem linha = município fora do universo do ano (ex.: sem instalação comprovada) ou fatia não publicada; óbitos sem município válido vão ao município ignorado da UF' : 'VDE: ausência de linha municipal só é zero reportado quando exec_seg_cov indica mês com registros e universo completo; nunca zero por falta de relato',
        `${d.note} Definição: ${d.definition}. Comparabilidade: ${d.comparability}`]);
  }
  return defs.length;
}
